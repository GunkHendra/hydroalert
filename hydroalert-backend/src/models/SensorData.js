import mongoose from 'mongoose';
const { Schema } = mongoose;

const SensorDataSchema = new Schema({
    deviceID: {
        type: String,
        ref: 'Device',
        required: true
    },
    waterLevel: { type: Number, required: true },
    windSpeed: { type: Number, required: true },
    rainIntensity: { type: Number, required: true },
    status: {
        type: String,
        enum: ['Normal', 'Siaga', 'Waspada', 'Bahaya'],
        required: true
    }
}, { timestamps: true });

SensorDataSchema.index({ deviceID: 1, createdAt: -1 });

export default mongoose.model('SensorData', SensorDataSchema);