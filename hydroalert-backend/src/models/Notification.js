import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    deviceID: {
        type: String,
        ref: 'Device',
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: {
        type: String,
        enum: ['Normal', 'Siaga 1', 'Siaga 2', 'Waspada', 'Bahaya'],
        default: 'Normal'
    },
}, { timestamps: true });

export default mongoose.model('Notification', NotificationSchema);
