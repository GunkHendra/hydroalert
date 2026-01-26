// src/models/Image.js
import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema({
    deviceID: {
        type: String,
        required: true,
        unique: true // This ensures one entry per device
    },
    imageUrl: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Image', ImageSchema);