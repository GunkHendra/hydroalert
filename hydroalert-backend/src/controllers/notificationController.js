// controllers/notificationController.js
import Notification from '../models/Notification.js';

/**
 * @openapi
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "655b3f..."
 *         deviceID:
 *           type: string
 *           example: "DEV-001"
 *         title:
 *           type: string
 *           example: "Water Level Alert"
 *         message:
 *           type: string
 *           example: "Water level has reached 150cm"
 *         severity:
 *           type: string
 *           enum: [Normal, Siaga, Waspada, Bahaya]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: Get notification history grouped by date
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: deviceID
 *         schema:
 *           type: string
 *         description: Filter by specific device ID (use 'all' for all devices)
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [Normal, Siaga, Waspada, Bahaya, all]
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest]
 *         description: Sort order by date
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       total:
 *                         type: integer
 *                       items:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/Notification'
 */
export const getNotificationHistory = async (req, res) => {
    try {
        const { deviceID, severity, sort, limit } = req.query;

        // 1. Build dynamic filter
        let filter = {};
        if (deviceID && deviceID !== 'all') {
            filter.deviceID = deviceID;
        }
        if (severity && severity !== 'all') {
            filter.severity = severity;
        }
        if (limit) {
            filter.limit = parseInt(limit);
        }

        // 2. Sorting logic
        let sortOrder = { createdAt: sort === 'oldest' ? 1 : -1 };

        // 3. Fetch data
        const notifications = await Notification.find(filter)
            .sort(sortOrder)
            .limit(filter.limit || null);

        // 4. Group by Date and Add Count
        const groupedData = notifications.reduce((acc, item) => {
            // Format date to: "11 November 2025"
            const dateKey = item.createdAt.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            if (!acc[dateKey]) {
                acc[dateKey] = {
                    total: 0,
                    items: []
                };
            }

            acc[dateKey].items.push(item);
            acc[dateKey].total += 1; // Increment count for this specific day

            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: groupedData
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
};