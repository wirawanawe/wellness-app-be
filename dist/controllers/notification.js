"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = getNotifications;
exports.markAsRead = markAsRead;
const db_1 = require("../db");
async function getNotifications(req, res) {
    try {
        const userId = req.user.id;
        const notifications = await (0, db_1.query)('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [userId]);
        const unreadCount = await (0, db_1.query)('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
        res.json({ notifications, unreadCount: unreadCount[0]?.c || 0 });
    }
    catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
async function markAsRead(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        if (id === 'all') {
            await (0, db_1.execute)('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
        }
        else {
            await (0, db_1.execute)('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
        }
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
