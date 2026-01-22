import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    deviceID: { 
        type: String, 
        ref: 'Device', 
        required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { 
        type: String, 
        enum: ['Normal', 'Siaga', 'Waspada', 'Bahaya'], 
        default: 'Normal' 
    },
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
