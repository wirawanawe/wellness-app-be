import { Request, Response } from 'express';
import { query, queryOne, execute } from '../db';

export async function getMessages(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { otherId } = req.params;
    
    const messages = await query(`
      SELECT * FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) 
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `, [userId, otherId, otherId, userId]);

    // Mark as read
    await execute('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?', [otherId, userId]);

    res.json({ messages });
  } catch (e) { res.status(500).json({ error: 'Internal Server Error' }); }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const senderId = (req as any).user.id;
    const { receiverId, message } = req.body;
    
    const result = await execute(
      'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
      [senderId, receiverId, message]
    );

    // Add notification
    const sender = await queryOne(`
      SELECT COALESCE(d.name, e.name) as name 
      FROM users u 
      LEFT JOIN doctors d ON d.id = u.doctor_id 
      LEFT JOIN employees e ON e.id = u.employee_id_ref 
      WHERE u.id = ?
    `, [senderId]) as any;
    
    const senderName = sender?.name || 'Seseorang';
    
    await execute(
      'INSERT INTO notifications (user_id, title, message, type, action_url) VALUES (?, ?, ?, ?, ?)',
      [receiverId, 'Pesan Baru', `${senderName} mengirimkan pesan kepada Anda`, 'chat', `/chat/${senderId}`]
    );

    res.json({ success: true, messageId: (result as any).insertId });
  } catch (e) { res.status(500).json({ error: 'Internal Server Error' }); }
}

export async function getRecentChats(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const chats = await query(`
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
  } catch (e) { 
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' }); 
  }
}
