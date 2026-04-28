"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDailyWellness = logDailyWellness;
exports.getDailyWellness = getDailyWellness;
const db_1 = require("../db");
async function logDailyWellness(req, res) {
    try {
        const { mood, stress_level } = req.body;
        const userId = req.user.id;
        if (!mood || stress_level === undefined) {
            return res.status(400).json({ error: 'Mood and stress level are required' });
        }
        // Check if already logged today
        const today = new Date().toISOString().split('T')[0];
        const existing = await (0, db_1.queryOne)('SELECT id FROM daily_wellness WHERE user_id = ? AND DATE(logged_at) = ?', [userId, today]);
        if (existing) {
            await (0, db_1.execute)('UPDATE daily_wellness SET mood = ?, stress_level = ? WHERE id = ?', [mood, stress_level, existing.id]);
        }
        else {
            await (0, db_1.execute)('INSERT INTO daily_wellness (user_id, mood, stress_level) VALUES (?, ?, ?)', [userId, mood, stress_level]);
        }
        res.json({ success: true, message: 'Wellness data logged' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function getDailyWellness(req, res) {
    try {
        const userId = req.user.id;
        const today = new Date().toISOString().split('T')[0];
        const data = await (0, db_1.queryOne)('SELECT mood, stress_level FROM daily_wellness WHERE user_id = ? AND DATE(logged_at) = ?', [userId, today]);
        res.json({ wellness: data || null });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
}
