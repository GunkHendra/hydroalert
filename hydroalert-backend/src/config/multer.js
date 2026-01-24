import multer from 'multer';
import path from 'path';

// Set storage engine
const storage = multer.diskStorage({
    destination: './uploads/', // Where images go on your VPS
    filename: (req, file, cb) => {
        // Name format: DEV123-1706123456789.jpg
        cb(null, `${req.body.deviceID || 'unknown'}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Initialize upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit 5MB
});

export default upload;