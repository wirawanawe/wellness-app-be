"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUIConfigs = getUIConfigs;
exports.saveUIConfigs = saveUIConfigs;
exports.getSMTPSettings = getSMTPSettings;
exports.saveSMTPSettings = saveSMTPSettings;
exports.testSMTPSettings = testSMTPSettings;
const db_1 = require("../db");
async function getUIConfigs(req, res) {
    try {
        const { app } = req.params;
        const configs = await (0, db_1.query)('SELECT config_key, config_value FROM ui_configurations WHERE app = ? AND is_active = 1', [app]);
        const configMap = {};
        configs.forEach(c => {
            configMap[c.config_key] = c.config_value;
        });
        res.json({ configs: configMap });
    }
    catch (error) {
        console.error('[GET UI CONFIGS ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function saveUIConfigs(req, res) {
    try {
        const { app, configs } = req.body;
        if (!app || !configs)
            return res.status(400).json({ error: 'Missing app or configs' });
        for (const [key, value] of Object.entries(configs)) {
            await (0, db_1.execute)(`INSERT INTO ui_configurations (app, config_key, config_value, is_active) 
         VALUES (?, ?, ?, 1) 
         ON DUPLICATE KEY UPDATE config_value = ?, updated_at = CURRENT_TIMESTAMP`, [app, key, value, value]);
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('[SAVE UI CONFIGS ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function getSMTPSettings(req, res) {
    try {
        const row = await (0, db_1.queryOne)('SELECT setting_value FROM system_settings WHERE setting_key = "smtp_config"', []);
        res.json({ config: row ? JSON.parse(row.setting_value) : null });
    }
    catch (error) {
        console.error('[GET SMTP SETTINGS ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function saveSMTPSettings(req, res) {
    try {
        const { config } = req.body;
        await (0, db_1.execute)('INSERT INTO system_settings (setting_key, setting_value) VALUES ("smtp_config", ?) ON DUPLICATE KEY UPDATE setting_value = ?', [JSON.stringify(config), JSON.stringify(config)]);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[SAVE SMTP SETTINGS ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
const nodemailer_1 = __importDefault(require("nodemailer"));
async function testSMTPSettings(req, res) {
    try {
        const { config } = req.body;
        if (!config || !config.host || !config.user || !config.pass) {
            return res.status(400).json({ error: 'Konfigurasi tidak lengkap' });
        }
        const transporter = nodemailer_1.default.createTransport({
            host: config.host,
            port: parseInt(config.port) || 587,
            secure: config.port === '465',
            auth: {
                user: config.user,
                pass: config.pass,
            },
            connectTimeout: 10000,
        });
        await transporter.verify();
        res.json({ success: true, message: 'Koneksi SMTP berhasil!' });
    }
    catch (error) {
        console.error('[TEST SMTP ERROR]', error);
        res.status(500).json({ error: error.message || 'Koneksi SMTP gagal' });
    }
}
