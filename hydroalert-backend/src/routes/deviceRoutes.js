// src/routes/deviceRoutes.js
import express from 'express';
import { registerDevice, storeSensorData } from '../controllers/deviceController.js';

const router = express.Router();

router.post('/register', registerDevice);
router.post('/store-data', storeSensorData);

export default router;