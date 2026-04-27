import { Request, Response } from 'express';
import { query, execute } from '../db';
import path from 'path';
import fs from 'fs';

export async function getAds(req: Request, res: Response) {
  try {
    const ads = await query('SELECT * FROM ads ORDER BY created_at DESC');
    res.json({ ads });
  } catch (error) {
    console.error('[GET ADS ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createAd(req: Request, res: Response) {
  try {
    const { title, link_url } = req.body;
    const file = req.file;

    if (!title || !file) {
      return res.status(400).json({ error: 'Title and Banner Image are required' });
    }

    const ext = path.extname(file.originalname);
    const filename = `ad-${Date.now()}${ext}`;
    const uploadsDir = path.join(__dirname, '../../uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const image_url = `/uploads/${filename}`;

    await execute(
      'INSERT INTO ads (title, image_url, link_url) VALUES (?, ?, ?)',
      [title, image_url, link_url || null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[CREATE AD ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteAd(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await execute('DELETE FROM ads WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[DELETE AD ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function toggleAdStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    await execute('UPDATE ads SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[TOGGLE AD STATUS ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
