// src/routes/notificationRoutes.js
import express from 'express';
const router = express.Router();
import { getNotificationHistory } from '../controllers/notificationController.js';

router.get('/notifications', getNotificationHistory);

export default router;