import mongoose from 'mongoose';
const { Schema } = mongoose;

const SensorDataSchema = new Schema({
    deviceID: { type: String, ref: 'Device', required: true },
    waterDebit: { type: Number, required: true },
    waterLevel: { type: Number, required: true },
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    windSpeed: { type: Number, required: true },
    status: { type: String, required: true },
}, { timestamps: true });

SensorDataSchema.index({ deviceID: 1, createdAt: -1 });

export default mongoose.model('SensorData', SensorDataSchema);