// src/models/SensorData.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const SensorDataSchema = new Schema({
    deviceID: {
        type: String,
        required: true
    },
    waterLevel: { type: Number, required: true },
    windSpeed: { type: Number, required: true },
    rainIntensity: { type: Number, required: true },
    status: {
        type: String,
        enum: ['Normal', 'Waspada', 'Siaga 1', 'Siaga 2', 'Bahaya'],
        required: true
    }
}, { timestamps: true });

SensorDataSchema.index({ deviceID: 1, createdAt: -1 });

export default mongoose.model('SensorData', SensorDataSchema);