"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const db_1 = require("../db");
async function getSMTPSettings() {
    const settings = await (0, db_1.queryOne)('SELECT setting_value FROM system_settings WHERE setting_key = "smtp_config"', []);
    if (!settings)
        return null;
    try {
        return JSON.parse(settings.setting_value);
    }
    catch (e) {
        return null;
    }
}
async function sendEmail({ to, subject, html }) {
    const config = await getSMTPSettings();
    if (!config || !config.host || !config.user || !config.pass) {
        console.warn('[MAILER] SMTP settings not configured. Logging email to console instead.');
        console.log(`\n--- EMAIL SIMULATION ---`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${html}`);
        console.log(`------------------------\n`);
        return;
    }
    const transporter = nodemailer_1.default.createTransport({
        host: config.host,
        port: parseInt(config.port) || 587,
        secure: config.port === '465',
        auth: {
            user: config.user,
            pass: config.pass,
        },
    });
    try {
        await transporter.sendMail({
            from: `"${config.fromName || 'Wellness PHC'}" <${config.fromEmail || config.user}>`,
            to,
            subject,
            html,
        });
        console.log(`[MAILER] Email sent to ${to}`);
    }
    catch (error) {
        console.error('[MAILER ERROR]', error);
        throw error;
    }
}
