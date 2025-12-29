import mongoose from 'mongoose';
const { Schema } = mongoose;

const DeviceSchema = new Schema({
    deviceID: { type: String, required: true, unique: true },
    location: { type: String, required: true },
    lastActive: { type: Date, default: Date.now }
});

export default mongoose.model('Device', DeviceSchema);