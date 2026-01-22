import mongoose from 'mongoose';
const { Schema } = mongoose;

const DeviceSchema = new Schema({
    deviceID: { type: String, required: true, unique: true },
    location: {
        latitude: { type: Number },
        longitude: { type: Number }
    },
    lastActive: { type: Date, default: Date.now }
});

export default mongoose.model('Device', DeviceSchema);