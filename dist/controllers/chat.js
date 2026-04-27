"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessages = getMessages;
exports.sendMessage = sendMessage;
exports.getRecentChats = getRecentChats;
const db_1 = require("../db");
async function getMessages(req, res) {
    try {
        const userId = req.user.id;
        const { otherId } = req.params;
        const messages = await (0, db_1.query)(`
      SELECT * FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) 
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `, [userId, otherId, otherId, userId]);
        // Mark as read
        await (0, db_1.execute)('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?', [otherId, userId]);
        res.json({ messages });
    }
    catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
async function sendMessage(req, res) {
    try {
        const senderId = req.user.id;
        const { receiverId, message } = req.body;
        const result = await (0, db_1.execute)('INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)', [senderId, receiverId, message]);
        // Add notification
        const sender = await (0, db_1.queryOne)(`
      SELECT COALESCE(d.name, e.name) as name 
      FROM users u 
      LEFT JOIN doctors d ON d.id = u.doctor_id 
      LEFT JOIN employees e ON e.id = u.employee_id_ref 
      WHERE u.id = ?
    `, [senderId]);
        const senderName = sender?.name || 'Seseorang';
        await (0, db_1.execute)('INSERT INTO notifications (user_id, title, message, type, action_url) VALUES (?, ?, ?, ?, ?)', [receiverId, 'Pesan Baru', `${senderName} mengirimkan pesan kepada Anda`, 'chat', `/chat/${senderId}`]);
        res.json({ success: true, messageId: result.insertId });
    }
    catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
async function getRecentChats(req, res) {
    try {
        const userId = req.user.id;
        const chats = await (0, db_1.query)(`
      SELECT DISTINCT 
        u.id, 
        COALESCE(d.name, e.name) as name, 
        u.role, 
        COALESCE(d.profile_photo_url, e.avatar_url) as avatar_url,
        (SELECT message FROM messages 
         WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages 
         WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
         ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM users u
      LEFT JOIN doctors d ON d.id = u.doctor_id
      LEFT JOIN employees e ON e.id = u.employee_id_ref
      JOIN messages m ON (m.sender_id = u.id OR m.receiver_id = u.id)
      WHERE (m.sender_id = ? OR m.receiver_id = ?) AND u.id != ?
      ORDER BY last_message_time DESC
    `, [userId, userId, userId, userId, userId, userId, userId]);
        res.json({ chats });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
