// src/routes/dashboardRoutes.js
import express from 'express';
const router = express.Router();
import { getDashboardData, getMonitoringData } from '../controllers/dashboardController.js';

router.get('/dashboard', getDashboardData);
router.get('/monitoring', getMonitoringData);

export default router;