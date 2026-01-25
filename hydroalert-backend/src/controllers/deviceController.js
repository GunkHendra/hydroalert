// src/controllers/deviceController.js
import Image from '../models/Image.js';
import fs from 'fs';
import path from 'path';
import Device from '../models/Device.js';
import SensorData from '../models/SensorData.js';
import { getWaterStatus, STATUS_THRESHOLDS } from '../utils/statusHelper.js';
import Notification from '../models/Notification.js';
import { sendTelegramAlert } from '../services/telegramService.js';
import { predictNextStatusTime } from '../services/predictionService.js';

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

    if (!deviceID || lat === undefined || long === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const io = req.app.get('socketio'); // Retrieve io instance

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

        const totalDevices = await Device.countDocuments();

        // Notify dashboard clients about the new device
        io.to('dashboard').emit('update_total_device', { devices: { total: totalDevices } });

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

    if (!deviceID || waterLevel === undefined || rainIntensity === undefined || windSpeed === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const io = req.app.get('socketio'); // Retrieve io instance

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

        const formattedUpdate = {
            deviceID: newSensorData.deviceID,
            location: device.location,
            lastActive: device.lastActive,
            water: {
                level: newSensorData.waterLevel,
                status: newSensorData.status,
                updatedAt: newSensorData.createdAt
            },
            wind: { speed: newSensorData.windSpeed },
            rain: { intensity: newSensorData.rainIntensity }
        };

        // Send it to the Monitoring Page channel
        io.to(deviceID).emit('sensor_data_update', formattedUpdate);

        const devices = await Device.find();
        const activeDevices = devices.filter(
            d => Date.now() - d.lastActive < 5 * 60 * 1000
        );

        // Update Dashboard clients about active device count
        io.to('dashboard').emit('update_active_device', { devices: { active: activeDevices.length } });

        // Get latest sensor data
        const latestPerDevice = await SensorData.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$device',
                    latestData: { $first: '$$ROOT' }
                }
            },
            { $replaceRoot: { newRoot: '$latestData' } }
        ]);

        // Determine worst condition
        const worstData = latestPerDevice.reduce((max, current) => {
            return current.waterLevel > max.waterLevel ? current : max;
        });

        // Update overall dashboard if this device has the worst data
        if (worstData.deviceID === deviceID) {
            const waterStatus = getWaterStatus(worstData.waterLevel);
            io.to('dashboard').emit('update_overall_sensor_data', {
                water: {
                    level: worstData.waterLevel,
                    status: waterStatus,
                    updatedAt: worstData.createdAt
                },
                wind: { speed: worstData.windSpeed },
                rain: { intensity: worstData.rainIntensity }
            });
        }

        // Trigger Notification and Prediction (Only if status is critical)
        if (status !== 'Normal') {
            await handleNotification(req, deviceID, status, waterLevel);

            if (status !== 'Bahaya') {
                // Water level prediction
                let prediction = await predictNextStatusTime(deviceID, newSensorData);
                if (prediction) {
                    io.to(deviceID).emit('water_level_prediction', {
                        deviceID,
                        prediction,
                    });
                }
            }
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

const handleNotification = async (req, deviceID, status, level) => {
    const io = req.app.get('socketio'); // Retrieve io instance
    // COOLDOWN: Don't create a new notification for the same device + status 
    // if one was created in the last 30 minutes.
    const COOLDOWN_MINUTES = 30;
    const SIGNIFICANT_CHANGE_CM = 20;
    const cooldownPeriod = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000);

    const lastNotif = await Notification.findOne({ deviceID }).sort({ createdAt: -1 });

    let shouldNotify = false;

    if (!lastNotif) {
        shouldNotify = true;
    } else {
        const isDifferentStatus = lastNotif.severity !== status;
        const isExpired = lastNotif.createdAt < cooldownPeriod;

        // Extract numeric level from previous message or store it as a separate field (Recommended)
        // If the level has risen significantly, we should ignore the cooldown.
        const levelJump = level - (lastNotif.waterLevel || 0);
        const isSignificantRise = levelJump >= SIGNIFICANT_CHANGE_CM;

        if (isDifferentStatus || isExpired || isSignificantRise) {
            shouldNotify = true;
        }
    }

    if (shouldNotify) {
        const titleMap = {
            'Waspada': '⚠️ Peringatan Waspada',
            'Siaga 2': '🟠 Peringatan Siaga 2',
            'Siaga 1': '🔴 Peringatan Siaga 1',
            'Bahaya': '🆘 DARURAT: Status Bahaya'
        };

        // Use a helper to avoid undefined messages if status doesn't match perfectly
        const getMessage = (s, l) => {
            if (s.includes('Siaga')) return `Ketinggian air mencapai ${l}cm. Pantau area sekitar.`;
            if (s === 'Waspada') return `Ketinggian air ${l}cm. Persiapkan evakuasi.`;
            if (s === 'Bahaya') return `DARURAT! Ketinggian air ${l}cm. Segera evakuasi!`;
            return `Status sensor: ${s} (${l}cm)`;
        };

        const title = titleMap[status] || 'Peringatan Sensor';
        const message = getMessage(status, level);

        // 3. Save to DB (Include waterLevel field for future comparisons)
        const newNotif = await Notification.create({
            deviceID,
            severity: status,
            waterLevel: level, // Add this to your Schema!
            type: 'Sensor Alert',
            title,
            message
        });

        io.to('notifications').emit('new_notification', newNotif);

        // 4. Construct Telegram Message with better formatting
        const telegramMessage = `
📢 *${title}*
━━━━━━━━━━━━━━
🆔 *Device:* ${deviceID}
🌊 *Ketinggian:* ${level} cm
📊 *Status:* ${status}
🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}

📝 ${message}
        `;

        sendTelegramAlert(telegramMessage);

        // Real-time update for your React Native dashboard
        // req.app.get('socketio').to(deviceID).emit('new_notification', { status, level });
    }
};


/**
 * @openapi
 * /api/device/upload-image:
 *   post:
 *     summary: Upload an image from the IoT device
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               deviceID:
 *                 type: string
 *                 example: "DEV-001"
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Image uploaded successfully
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Upload Logic Error
 */
export const uploadImage = async (req, res) => {
    const { deviceID } = req.body;

    if (!deviceID) {
        return res.status(400).json({ error: 'deviceID is required in the form data' });
    }

    const device = await Device.findOne({ deviceID });
    if (!device) {
        return res.status(404).json({ error: 'Device not found' });
    }

    const io = req.app.get('socketio'); // Retrieve io instance

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const newImageUrl = `/uploads/${req.file.filename}`;

        // Find if there's an existing image record for this device
        const existingRecord = await Image.findOne({ deviceID });

        if (existingRecord) {
            // Delete the OLD physical file to save space immediately
            const oldFilePath = path.join(process.cwd(), existingRecord.imageUrl);
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
            }

            // Update the record with the new image info
            existingRecord.imageUrl = newImageUrl;
            await existingRecord.save();
        } else {
            // 4. Create new record if it's the device's first upload
            await Image.create({
                deviceID,
                imageUrl: newImageUrl,
            });
        }

        // Notify dashboard clients about the new image
        io.to(deviceID).emit('new_image', { deviceID, imageUrl: newImageUrl });

        res.status(201).json({ success: true, imageUrl: newImageUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload Logic Error' });
    }
};