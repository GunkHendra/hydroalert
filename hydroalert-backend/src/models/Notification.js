// src/models/Notification.js
import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    deviceID: {
        type: String,
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: {
        type: String,
        enum: ['Normal', 'Waspada', 'Siaga 1', 'Siaga 2', 'Bahaya'],
        default: 'Normal'
    },
    avgWaterLevel: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model('Notification', NotificationSchema);
