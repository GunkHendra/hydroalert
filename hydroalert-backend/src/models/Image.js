import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema({
    deviceID: {
        type: String,
        ref: 'Device',
        required: true,
        unique: true // This ensures one entry per device
    },
    imageUrl: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Image', ImageSchema);