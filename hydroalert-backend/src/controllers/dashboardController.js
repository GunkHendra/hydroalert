// src/controllers/dashboardController.js
import SensorData from '../models/SensorData.js';
import Device from '../models/Device.js';
import Notification from '../models/Notification.js';
import { getWaterStatus } from '../utils/statusHelper.js';

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
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     water:
 *                       type: object
 *                       properties:
 *                         level: { type: number }
 *                         status: { type: string }
 *                         updatedAt: { type: string, format: date-time }
 *                     wind:
 *                       type: object
 *                       properties:
 *                         speed: { type: number }
 *                     rain:
 *                       type: object
 *                       properties:
 *                         intensity: { type: number }
 *                     devices:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         active: { type: integer }
 *                     notifications:
 *                       type: array
 *                       items: { type: object }
 */
export const getDashboardData = async (req, res) => {
    try {
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

        const rainData = await SensorData.find({
            device: worstData.device,
            rainIntensity: { $gt: 0 }
        })
            .sort({ createdAt: -1 })
            .limit(20);

        // Device info
        const devices = await Device.find();
        const activeDevices = devices.filter(
            d => Date.now() - d.lastActive < 5 * 60 * 1000
        );

        // Notifications
        const notifications = await Notification.find()
            .sort({ createdAt: -1 })
            .limit(5);

        const waterStatus = getWaterStatus(worstData.waterLevel);

        res.json({
            success: true,
            data: {
                water: {
                    level: worstData.waterLevel,
                    status: waterStatus,
                    updatedAt: worstData.createdAt
                },
                wind: {
                    speed: worstData.windSpeed
                },
                rain: {
                    intensity: worstData.rainIntensity,
                },
                devices: {
                    total: devices.length,
                    active: activeDevices.length
                },
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
 */
export const getMonitoringData = async (req, res) => {
    try {
        // 1. Run aggregation and Device count in parallel for speed
        const [monitoringData, allDevices] = await Promise.all([
            SensorData.aggregate([
                { $sort: { deviceID: 1, createdAt: -1 } },
                {
                    $group: {
                        _id: '$deviceID',
                        latestReading: { $first: '$$ROOT' }
                    }
                },
                {
                    $lookup: {
                        from: 'devices',
                        localField: '_id',
                        foreignField: 'deviceID',
                        as: 'deviceDetails'
                    }
                },
                { $unwind: '$deviceDetails' },
                {
                    $project: {
                        _id: 0,
                        deviceID: '$_id',
                        location: '$deviceDetails.location',
                        lastActive: '$deviceDetails.lastActive',
                        water: {
                            level: '$latestReading.waterLevel',
                            status: '$latestReading.status',
                            updatedAt: '$latestReading.createdAt'
                        },
                        wind: { speed: '$latestReading.windSpeed' },
                        rain: { intensity: '$latestReading.rainIntensity' }
                    }
                }
            ]),
            Device.find()
        ]);

        // 2. Calculate activity status (Active if pinged in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const activeCount = allDevices.filter(d => d.lastActive > fiveMinutesAgo).length;

        // 3. Return combined data
        res.status(200).json({
            success: true,
            stats: {
                totalDevices: allDevices.length,
                activeDevices: activeCount
            },
            devices: monitoringData
        });
    } catch (error) {
        console.error('Monitoring Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

