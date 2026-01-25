import SensorData from '../models/SensorData.js';
import { STATUS_THRESHOLDS } from '../utils/statusHelper.js';

const MM_S_TO_MM_H = 3600; 
const MIN_TIME_WINDOW_MIN = 10;

const getRainFactor = (rainMmH) => {
    if (rainMmH < 5) return 1.0;   // Hujan sangat ringan
    if (rainMmH < 20) return 1.1;  // Hujan sedang
    if (rainMmH < 50) return 1.2;  // Hujan lebat
    return 1.35;                   // Hujan sangat lebat
};

const getWindFactor = (wind) => {
    if (wind < 5) return 1.0;
    if (wind < 10) return 1.01;
    return 1.03;
};

export const predictNextStatusTime = async (deviceID, currentData) => {
    const {
        waterLevel,
        createdAt,
        status,
        rainIntensity,
        windSpeed
    } = currentData;

    // Convert rain intensity to mm/h
    const rainMmH = currentData.rainIntensity * MM_S_TO_MM_H;

    // Fetch baseline data from 10 minutes ago
    const tenMinutesAgo = new Date(createdAt.getTime() - (MIN_TIME_WINDOW_MIN * 60000));
    const pastData = await SensorData.find({
        deviceID,
        createdAt: { $gte: tenMinutesAgo, $lt: createdAt }
    }).sort({ createdAt: 1 })

    if (pastData.length < 4) return null;

    // --- HITUNG SLOPE (Garis Tren) ---
    // Menggunakan Simple Linear Regression sederhana agar lebih akurat dari sekadar Delta
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = pastData.length + 1;
    const allData = [...pastData, currentData];

    allData.forEach((d, i) => {
        const x = i; // Kita gunakan index sebagai representasi waktu
        const y = d.waterLevel;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    });

    // Rumus Slope (m): laju kenaikan per interval data
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Konversi slope ke cm/menit (asumsi data masuk tiap 1 menit)
    const baseRiseRate = slope; 

    if (baseRiseRate <= 0.01) return null;

    // --- FAKTOR LINGKUNGAN ---
    const rainFactor = getRainFactor(rainMmH);
    const windFactor = getWindFactor(windSpeed);
    const adjustedRiseRate = baseRiseRate * rainFactor * windFactor;

    // --- PREDIKSI TARGET ---
    const orderedStatuses = ['Normal', 'Waspada', 'Siaga 1', 'Siaga 2', 'Bahaya'];
    const currentIndex = orderedStatuses.indexOf(status);
    if (currentIndex === -1 || currentIndex >= orderedStatuses.length - 1) return null;

    const nextStatus = orderedStatuses[currentIndex + 1];
    const targetHeight = STATUS_THRESHOLDS[nextStatus];
    const remainingHeight = targetHeight - waterLevel;

    const estimatedMinutes = remainingHeight / adjustedRiseRate;

    return {
        fromStatus: status,
        toStatus: nextStatus,
        waterLevel: waterLevel,
        toWaterLevel: targetHeight,
        estimatedMinutes: Math.round(estimatedMinutes),
        adjustedRiseRate: adjustedRiseRate.toFixed(3),
    };
};
