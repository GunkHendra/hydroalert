import express from 'express';
const router = express.Router();
import Device from '../models/Device.js';
import SensorData from '../models/SensorData.js';

router.post('/register', async (req, res) => {
    const deviceID = req.body.deviceID;
    const location = req.body.location || 'Unknown';
    try {
        let device = await Device.findOne({ deviceID });
        if (device) {
            return res.status(400).json({ message: 'Device already registered' });
        }
        device = new Device({ deviceID, location });
        await device.save();
        res.status(201).json({ message: 'Device registered successfully' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

router.post('/data', async (req, res) => {
    const { deviceID, waterDebit, waterLevel, temperature, humidity, windSpeed } = req.body;
    const io = req.app.get('socketio'); // Get socket instance

    try {
        let device = await Device.findOne({ deviceID });

        // Auto-register device if it's new
        if (!device) {
            device = await Device.create({ deviceID, location: 'Unknown' });
        }

        // Determine Status
        let status = 'NORMAL';
        // TODO: Add logic for status determination based on thresholds

        // Save Sensor Data
        const newSensorData = new SensorData({ deviceID, waterLevel, waterDebit, temperature, humidity, windSpeed, status });
        await newSensorData.save();

        // Emit data to React frontend immediately
        io.emit('sensor-update', {
            deviceID,
            waterLevel,
            waterDebit,
            temperature,
            humidity,
            windSpeed,
            status,
            timestamp: new Date()
        });

        // If Danger, emit a specific critical alert
        if (status === 'DANGER') {
            io.emit('danger-alert', {
                message: `CRITICAL: Flood detected at ${device.location}`,
                level: waterLevel,
                debit: waterDebit,
                timestamp: new Date()
            });
            // TODO: Add SMS/Whatsapp/Telegram logic (e.g., Twilio or Nodemailer)
        }

        res.status(201).json({ message: 'Data processed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

export default router;