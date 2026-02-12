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
import { redisClient } from '../utils/redisClient.js';
import { getWaterLevel } from '../utils/waterLevel.js';

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
    const { deviceID, rainIntensity, windSpeed } = req.body;
    let { waterLevel } = req.body;

    if (!deviceID || waterLevel === undefined || rainIntensity === undefined || windSpeed === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate water level based on river depth and raw sensor reading
    waterLevel = getWaterLevel(waterLevel);

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

        // First Sanity Check
        const lastReadingKey = `last_raw:${deviceID}`;
        const lastRaw = await redisClient.get(lastReadingKey);
        console.log(`[Debug] Last raw data for ${deviceID}:`, lastRaw ? JSON.parse(lastRaw) : null, `Current raw water level: ${waterLevel}cm`);

        if (lastRaw) {
            const last = JSON.parse(lastRaw);
            const diff = Math.abs(waterLevel - last.waterLevel);
            //  If the difference is too high, reject the data as noise
            if (diff > 50 && diff > (last.waterLevel * 0.5)) {
                console.warn(`[Rejected] Noise detected on ${deviceID}: ${diff}cm jump.`);
                return res.status(400).json({ error: 'Data rejected: Noise detected' });
            }
        }


        res.status(201).json({
            success: true,
            message: 'Sensor data stored successfully (water level has been calculated based on river depth)',
            status: getWaterStatus(waterLevel),
            data: {
                deviceID: deviceID,
                waterLevel: waterLevel,
                rainIntensity: rainIntensity,
                windSpeed: windSpeed,
            }
        });

        setImmediate(async () => {
            try {
                // Update last raw data in Redis for future noise checks
                await redisClient.set(lastReadingKey, JSON.stringify({ waterLevel, createdAt: new Date() }), { EX: 60 });

                // Also update latest device status in Redis Hash
                await redisClient.hSet('latest_device_status', deviceID, JSON.stringify({
                    deviceID, waterLevel, rainIntensity, windSpeed,
                    status: getWaterStatus(waterLevel), updatedAt: new Date()
                }));

                // Update active devices set for dashboard
                const nowEpoch = Math.floor(Date.now() / 1000);
                await redisClient.zAdd('active_devices_zset', { score: nowEpoch, value: deviceID });

                // Hapus device yang sudah tidak aktif > 5 menit (0 s/d sekarang - 300 detik)
                await redisClient.zRemRangeByScore('active_devices_zset', 0, nowEpoch - 300);

                // Update monitoring page for this device
                const formattedUpdate = {
                    deviceID,
                    location: device.location,
                    lastActive: device.lastActive,
                    water: { level: waterLevel, status: getWaterStatus(waterLevel), updatedAt: new Date() },
                    wind: { speed: windSpeed },
                    rain: { intensity: rainIntensity }
                };
                io.to(deviceID).emit('sensor_data_update', formattedUpdate);

                // Update dashboard about total and active devices
                const activeCount = await redisClient.zCard('active_devices_zset');
                const totalDevices = await Device.countDocuments();
                io.to('dashboard').emit('update_total_device', { devices: { total: totalDevices } });
                io.to('dashboard').emit('update_active_device', { devices: { active: activeCount } });

                // Update device's last active timestamp in MongoDB
                await Device.updateOne({ deviceID }, { lastActive: new Date() }).catch(err => console.error(err));

                // Determine worst condition from all devices from Redis
                const allDevicesRaw = await redisClient.hGetAll('latest_device_status');
                const allDevicesData = Object.values(allDevicesRaw)
                    .map(d => JSON.parse(d))
                    .filter(d => {
                        // Only consider data updated within last 5 minutes
                        const dataAge = new Date() - new Date(d.updatedAt);
                        return dataAge < 5 * 60 * 1000;
                    });

                if (allDevicesData.length > 0) {
                    const worstData = allDevicesData.reduce((max, current) => {
                        return current.waterLevel > max.waterLevel ? current : max;
                    });

                    // Emit to dashboard if this device is the worst
                    if (worstData.deviceID === deviceID) {
                        io.to('dashboard').emit('update_overall_sensor_data', {
                            deviceID: worstData.deviceID,
                            water: {
                                level: worstData.waterLevel,
                                status: worstData.status,
                                updatedAt: worstData.updatedAt
                            },
                            wind: { speed: worstData.windSpeed },
                            rain: { intensity: worstData.rainIntensity }
                        });
                    }
                }

                // Redis Buffering
                const redisKey = `buffer:${deviceID}`;
                await redisClient.rPush(redisKey, JSON.stringify({ waterLevel, rainIntensity, windSpeed }));
                const bufferLength = await redisClient.lLen(redisKey);

                if (bufferLength >= 12) {
                    const processingKey = `processing:buffer:${deviceID}`;
                    // Move data to a processing key to avoid blocking new incoming data
                    const renamed = await redisClient.rename(redisKey, processingKey).catch(() => null);
                    if (!renamed) {
                        // If rename fails, another process is handling it
                        return;
                    }

                    await redisClient.expire(processingKey, 300); // 5 minutes

                    const rawDataList = await redisClient.lRange(processingKey, 0, -1)
                    const parsedData = rawDataList.map(d => JSON.parse(d));

                    const avgWater = parsedData.reduce((a, b) => a + b.waterLevel, 0) / parsedData.length;
                    const avgRain = (parsedData.reduce((a, b) => a + b.rainIntensity, 0) / parsedData.length) * 3600; // mm/h
                    const avgWind = parsedData.reduce((a, b) => a + b.windSpeed, 0) / parsedData.length;

                    const status = getWaterStatus(avgWater);

                    // Store averaged data to MongoDB
                    const newSensorData = await SensorData.create({
                        deviceID: deviceID,
                        waterLevel: avgWater,
                        rainIntensity: avgRain,
                        windSpeed: avgWind,
                        status: status
                    });

                    // Send Notification
                    if (status !== 'Normal') {
                        await handleNotification(req, deviceID, status, avgWater);
                    }

                    // Predictive Analysis
                    if (status !== 'Normal' && status !== 'Bahaya') {
                        const prediction = await predictNextStatusTime(deviceID, newSensorData);
                        if (prediction) {
                            io.to(deviceID).emit('water_level_prediction', { deviceID, prediction });
                        }
                    }

                    // Clear Redis Buffer
                    await redisClient.del(processingKey)
                }
            } catch (err) {
                console.error("Error on background processing:", err);
            }
        })
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

const handleNotification = async (req, deviceID, status, avgWaterlevel) => {
    const io = req.app.get('socketio'); // Retrieve io instance
    // COOLDOWN: Don't create a new notification for the same device + status 
    // if one was created in the last 30 minutes.
    const COOLDOWN_MINUTES = 30;
    const SIGNIFICANT_CHANGE_CM = 10;
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
        const levelJump = avgWaterlevel - (lastNotif.avgWaterLevel || 0);
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
            if (s.includes('Siaga')) return `Rata-rata ketinggian air mencapai ${l.toFixed(1)}cm dalam 1 menit terakhir. Pantau area sekitar.`;
            if (s === 'Waspada') return `Rata-rata ketinggian air ${l.toFixed(1)}cm dalam 1 menit terakhir. Persiapkan evakuasi.`;
            if (s === 'Bahaya') return `DARURAT! Rata-rata ketinggian air ${l.toFixed(1)}cm dalam 1 menit terakhir. Segera evakuasi!`;
            return `Status sensor: ${s} (${l.toFixed(1)}cm)`;
        };

        const title = titleMap[status] || 'Peringatan Sensor';
        const message = getMessage(status, avgWaterlevel);

        // Save to DB (Include waterLevel field for future comparisons)
        const newNotif = await Notification.create({
            deviceID,
            severity: status,
            avgWaterLevel: avgWaterlevel,
            title,
            message
        });

        io.to('notifications').emit('new_notification', newNotif);

        // 4. Construct Telegram Message with better formatting
        const telegramMessage = `
📢 ${title}
━━━━━━━━━━━━━━
🆔 ID Device: ${deviceID}
🌊 Rata-rata ketinggian (1 menit terakhir): ${avgWaterlevel.toFixed(1)} cm
📊 Status: ${status}
🕒 Waktu: ${new Date().toLocaleString('id-ID')}

📝 ${message}
`;

        sendTelegramAlert(telegramMessage);
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