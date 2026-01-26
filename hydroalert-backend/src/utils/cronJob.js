import cron from 'node-cron';
import { redisClient } from './redisClient.js';

// Menjadwalkan tugas setiap 10 menit
cron.schedule('*/10 * * * *', async () => {
    try {
        console.log('=== [CRON] Memulai Pembersihan Data Device Inaktif ===');

        const allData = await redisClient.hGetAll('latest_device_status');
        const deviceIDs = Object.keys(allData);

        if (deviceIDs.length === 0) {
            console.log('[CRON] Tidak ada data di Redis untuk dibersihkan.');
            return;
        }

        const now = new Date();
        let deletedCount = 0;

        for (const deviceID of deviceIDs) {
            const data = JSON.parse(allData[deviceID]);
            const lastUpdate = new Date(data.updatedAt);

            // Hapus jika sudah tidak update lebih dari 15 menit
            if (now - lastUpdate > 15 * 60 * 1000) {
                await redisClient.hDel('latest_device_status', deviceID);
                // Opsional: Hapus juga marker atau raw data lainnya
                await redisClient.del(`last_raw:${deviceID}`);
                deletedCount++;
            }
        }

        console.log(`=== [CRON] Selesai. Menghapus ${deletedCount} device inaktif ===`);
    } catch (error) {
        console.error('[CRON ERROR]:', error);
    }
}); 