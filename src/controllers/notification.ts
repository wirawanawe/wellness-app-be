import { Request, Response } from 'express';
import { query, execute } from '../db';

export async function getNotifications(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const notifications = await query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    const unreadCount = await query(
      'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    res.json({ notifications, unreadCount: unreadCount[0]?.c || 0 });
  } catch (e) { res.status(500).json({ error: 'Internal Server Error' }); }
}

export async function markAsRead(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    if (id === 'all') {
      await execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    } else {
      await execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Internal Server Error' }); }
}
