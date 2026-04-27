import { Request, Response } from 'express';
import { query, queryOne, execute } from '../db';

export async function getUIConfigs(req: Request, res: Response) {
  try {
    const { app } = req.params;
    const configs = await query(
      'SELECT config_key, config_value FROM ui_configurations WHERE app = ? AND is_active = 1',
      [app]
    );
    
    const configMap: Record<string, string> = {};
    (configs as any[]).forEach(c => {
      configMap[c.config_key] = c.config_value;
    });

    res.json({ configs: configMap });
  } catch (error) {
    console.error('[GET UI CONFIGS ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function saveUIConfigs(req: Request, res: Response) {
  try {
    const { app, configs } = req.body;
    if (!app || !configs) return res.status(400).json({ error: 'Missing app or configs' });

    for (const [key, value] of Object.entries(configs)) {
      await execute(
        `INSERT INTO ui_configurations (app, config_key, config_value, is_active) 
         VALUES (?, ?, ?, 1) 
         ON DUPLICATE KEY UPDATE config_value = ?, updated_at = CURRENT_TIMESTAMP`,
        [app, key, value, value]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[SAVE UI CONFIGS ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getSMTPSettings(req: Request, res: Response) {
  try {
    const row = await queryOne('SELECT setting_value FROM system_settings WHERE setting_key = "smtp_config"', []);
    res.json({ config: row ? JSON.parse(row.setting_value) : null });
  } catch (error) {
    console.error('[GET SMTP SETTINGS ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function saveSMTPSettings(req: Request, res: Response) {
  try {
    const { config } = req.body;
    await execute(
      'INSERT INTO system_settings (setting_key, setting_value) VALUES ("smtp_config", ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      [JSON.stringify(config), JSON.stringify(config)]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('[SAVE SMTP SETTINGS ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

import nodemailer from 'nodemailer';

export async function testSMTPSettings(req: Request, res: Response) {
  try {
    const { config } = req.body;
    if (!config || !config.host || !config.user || !config.pass) {
      return res.status(400).json({ error: 'Konfigurasi tidak lengkap' });
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port) || 587,
      secure: config.port === '465',
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectTimeout: 10000,
    } as any);

    await transporter.verify();
    res.json({ success: true, message: 'Koneksi SMTP berhasil!' });
  } catch (error: any) {
    console.error('[TEST SMTP ERROR]', error);
    res.status(500).json({ error: error.message || 'Koneksi SMTP gagal' });
  }
}
