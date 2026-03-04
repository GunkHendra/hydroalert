// src/controllers/dashboardController.js
import Device from '../models/Device.js';
import Notification from '../models/Notification.js';
import Image from '../models/Image.js';
import { redisClient } from '../utils/redisClient.js';

/**
 * @openapi
 * /api/dashboard:
 *   get:
 *     summary: Get dashboard data summary
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard data summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     deviceID:
 *                       type: string
 *                     water:
 *                       type: object
 *                       properties:
 *                         level:
 *                           type: number
 *                         status:
 *                           type: string
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                     wind:
 *                       type: object
 *                       properties:
 *                         speed:
 *                           type: number
 *                     rain:
 *                       type: object
 *                       properties:
 *                         intensity:
 *                           type: number
 *                     devices:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                     notifications:
 *                       type: array
 *                       items:
 *                         type: object
 */
export const getDashboardData = async (req, res) => {
    try {
        const allDevicesRaw = await redisClient.hGetAll('latest_device_status');
        const allDevicesData = Object.values(allDevicesRaw)
            .map(d => JSON.parse(d))
            .filter(d => (new Date() - new Date(d.updatedAt)) < 5 * 60 * 1000); // Only recent data

        let worstData = null;
        if (allDevicesData.length > 0) {
            worstData = allDevicesData.reduce((max, current) => (current.waterLevel > max.waterLevel ? current : max));
        }

        const [devices, notifications] = await Promise.all([
            Device.find(),
            Notification.find().sort({ createdAt: -1 }).limit(5)
        ]);

        const activeDevices = devices.filter(
            d => Date.now() - d.lastActive < 5 * 60 * 1000
        );

        let worstPrediction = null;
        if (worstData) {
            const worstPredictionRaw = await redisClient.hGet('latest_predictions', worstData.deviceID);
            worstPrediction = worstPredictionRaw ? JSON.parse(worstPredictionRaw) : null;

            // Reset prediksi jika status kembali Normal
            if (worstData.status === 'Normal') {
                worstPrediction = null;
            }
        }


        res.json({
            success: true,
            data: {
                deviceID: worstData?.deviceID ?? null,
                water: {
                    level: worstData?.waterLevel ?? null,
                    status: worstData?.status ?? null,
                    updatedAt: worstData?.updatedAt ?? null
                },
                wind: { speed: worstData?.windSpeed ?? null },
                rain: { intensity: worstData?.rainIntensity ?? null },
                devices: {
                    total: devices.length,
                    active: activeDevices.length
                },
                prediction: worstPrediction,
                notifications
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

/**
 * @openapi
 * /api/monitoring:
 *   get:
 *     summary: Get monitoring data for all devices
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Monitoring data for all devices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalDevices: { type: integer }
 *                     activeDevices: { type: integer }
 *                 devices:
 *                   type: array
 *                   description: "Array of device monitoring data"
 *                   items:
 *                     type: object
 *                     properties:
 *                       deviceID: { type: string }
 *                       location: { type: string }
 *                       lastActive: { type: string, format: date-time }
 *                       water:
 *                         type: object
 *                         properties:
 *                           level: { type: number }
 *                           status: { type: string }
 *                           updatedAt: { type: string, format: date-time }
 *                       wind:
 *                         type: object
 *                         properties:
 *                           speed: { type: number }
 *                       rain:
 *                         type: object
 *                         properties:
 *                           intensity: { type: number }
 *                       imageUrl: { type: string }
 */
export const getMonitoringData = async (req, res) => {
    try {
        const [allDevicesRaw, allPredictionsRaw] = await Promise.all([
            redisClient.hGetAll('latest_device_status'),
            redisClient.hGetAll('latest_predictions') // Get latest predictions for devices
        ]);

        // Preload Devices and Images to reduce DB calls
        const [devices, images] = await Promise.all([
            Device.find().lean(),
            Image.find().lean()
        ]);

        const imageMap = images.reduce((acc, img) => {
            acc[img.deviceID] = img.imageUrl;
            return acc;
        }, {});

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const activeCount = devices.filter(d => d.lastActive > fiveMinutesAgo).length;

        // Combine all monitoring data
        const devicesMonitoring = devices.map(device => {
            const raw = allDevicesRaw[device.deviceID];
            const parsed = raw ? JSON.parse(raw) : null;

            // Check if data is fresh (updated within last 5 minutes)
            const isFresh = parsed && new Date(parsed.updatedAt) >= fiveMinutesAgo;
            const sensorData = isFresh ? parsed : null; // Ignore stale/inactive readings

            // Get prediction if available
            const rawPred = allPredictionsRaw[device.deviceID];
            const parsedPred = rawPred ? JSON.parse(rawPred) : null;

            // Only consider prediction valid if it's based on fresh data
            const isPredictionValid = isFresh && parsedPred && sensorData?.status !== 'Normal' && sensorData?.status !== 'Bahaya';
            const predictionData = isPredictionValid ? parsedPred : null;

            const deviceImage = imageMap[device.deviceID];

            return {
                deviceID: device.deviceID,
                location: device.location,
                lastActive: device.lastActive,
                water: {
                    level: sensorData?.waterLevel ?? null,
                    status: sensorData?.status ?? null,
                    updatedAt: sensorData?.updatedAt ?? null
                },
                wind: { speed: sensorData?.windSpeed ?? null },
                rain: { intensity: sensorData?.rainIntensity ?? null },
                prediction: predictionData,
                imageUrl: deviceImage ?? null
            };
        });

        res.status(200).json({
            success: true,
            stats: {
                totalDevices: devices.length,
                activeDevices: activeCount
            },
            devices: devicesMonitoring
        });
    } catch (error) {
        console.error('Monitoring Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

