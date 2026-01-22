// src/controllers/deviceController.js
import Device from '../models/Device.js';
import SensorData from '../models/SensorData.js';
import { getWaterStatus } from '../utils/statusHelper.js';
import Notification from '../models/Notification.js';
import { sendTelegramAlert } from '../services/telegramService.js';
/**
 * @openapi
 * /api/device/register:
 *   post:
 *     summary: Register a new IoT device
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceID: { type: string, example: "DEV-001" }
 *               lat: { type: number, example: -6.200000 }
 *               long: { type: number, example: 106.816666 }
 *     responses:
 *       200:
 *         description: Device already registered
 *       201:
 *         description: Device registered successfully
 *       500:
 *         description: Server Error
 */
export const registerDevice = async (req, res) => {
    const { deviceID, lat, long } = req.body;

    try {
        let device = await Device.findOne({ deviceID });
        if (device) {
            return res.status(200).json({
                message: 'Device already registered'
            });
        }

        device = await Device.create({
            deviceID,
            location: { latitude: lat, longitude: long }
        });

        res.status(201).json({
            success: true,
            message: 'Device registered successfully',
            device
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

/**
 * @openapi
 * /api/device/store-data:
 *   post:
 *     summary: Store sensor data from IoT device
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceID: { type: string, example: "DEV-001" }
 *               rainIntensity: { type: number, example: 15.5 }
 *               waterLevel: { type: number, example: 120 }
 *               windSpeed: { type: number, example: 5.2 }
 *     responses:
 *       201:
 *         description: Sensor data stored successfully
 *       500:
 *         description: Server Error
 */
export const storeSensorData = async (req, res) => {
    const { deviceID, rainIntensity, waterLevel, windSpeed } = req.body;

    try {
        let device = await Device.findOne({ deviceID });

        // Auto-register device if it's new
        if (!device) {
            device = await Device.create({
                deviceID,
                location: null
            });
        }

        // SANITY CHECK: Compare with the most recent reading
        const lastReading = await SensorData.findOne({ deviceID }).sort({ createdAt: -1 });

        if (lastReading) {
            const difference = Math.abs(waterLevel - lastReading.waterLevel);
            const timeDiff = (new Date() - lastReading.createdAt) / 1000; // seconds

            // Reject if water level jumps > 100cm in less than 30 seconds
            // Adjust 100 and 30 based on your physical environment
            if (difference > 100 && timeDiff < 30) {
                console.warn(`[Suspicious Data] Device ${deviceID} jumped ${difference}cm in ${timeDiff}s. Ignoring.`);
                return res.status(400).json({ error: 'Data rejected: Possible sensor error (extreme jump)' });
            }
        }

        // Update last active
        device.lastActive = new Date();
        await device.save();

        // Determine Status
        const status = getWaterStatus(waterLevel);

        const newSensorData = await SensorData.create({
            deviceID,
            rainIntensity,
            waterLevel,
            windSpeed,
            status
        });

        // TRIGGER NOTIFICATION (Only if status is critical)
        if (status !== 'Normal') {
            await handleNotification(deviceID, status, waterLevel);
        }

        res.status(201).json({
            success: true,
            message: 'Sensor data stored successfully',
            status,
            data: newSensorData
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

const handleNotification = async (deviceID, status, level) => {
    // COOLDOWN: Don't create a new notification for the same device + status 
    // if one was created in the last 30 minutes.
    const cooldownPeriod = new Date(Date.now() - 30 * 60 * 1000);

    const existingNotification = await Notification.findOne({
        deviceID,
        severity: status,
        createdAt: { $gt: cooldownPeriod }
    });

    if (!existingNotification) {
        const titleMap = {
            'Siaga': `Siaga: Ketinggian Air Mencapai Tingkat Siaga`,
            'Waspada': `Waspada: Potensi Banjir Terdeteksi`,
            'Bahaya': `BAHAYA: BANJIR TERDETEKSI!`
        };

        const messageMap = {
            'Siaga': `Ketinggian air di device dengan ID: ${deviceID} mencapai ${level}cm. Mohon pantau area sekitar.`,
            'Waspada': `Ketinggian air ${level}cm. Persiapkan barang berharga untuk evakuasi.`,
            'Bahaya': `DARURAT! Ketinggian air ${level}cm. Segera evakuasi ke tempat yang lebih tinggi!`
        };

        await Notification.create({
            deviceID,
            severity: status,
            type: 'Sensor Alert',
            title: titleMap[status] || 'Peringatan Sensor',
            message: messageMap[status] || `Status sensor: ${status} (${level}cm)`
        });

        const telegramMessage = `
[PEMBERITAHUAN]
Device ID: ${deviceID}
Status: ${status}

${titleMap[status]}

${messageMap[status]}

Ketinggian Air: ${level}cm
Waktu: ${new Date().toLocaleString()}
        `;

        // Optional: req.app.get('socketio').emit('new_notification', ...)
        console.log(`[Notification Sent] Device: ${deviceID}, Status: ${status}`);
        sendTelegramAlert(telegramMessage);
    }
};
