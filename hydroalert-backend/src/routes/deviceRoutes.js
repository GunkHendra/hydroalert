// src/routes/deviceRoutes.js
import express from 'express';
import { registerDevice, storeSensorData, uploadImage } from '../controllers/deviceController.js';
import upload from '../config/multer.js';

const router = express.Router();

router.post('/register', registerDevice);
router.post('/store-data', storeSensorData);
router.post('/upload-image', upload.single('image'), uploadImage);

export default router;