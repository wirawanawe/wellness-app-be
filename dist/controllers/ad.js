"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAds = getAds;
exports.createAd = createAd;
exports.deleteAd = deleteAd;
exports.toggleAdStatus = toggleAdStatus;
const db_1 = require("../db");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
async function getAds(req, res) {
    try {
        const ads = await (0, db_1.query)('SELECT * FROM ads ORDER BY created_at DESC');
        res.json({ ads });
    }
    catch (error) {
        console.error('[GET ADS ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function createAd(req, res) {
    try {
        const { title, link_url } = req.body;
        const file = req.file;
        if (!title || !file) {
            return res.status(400).json({ error: 'Title and Banner Image are required' });
        }
        const ext = path_1.default.extname(file.originalname);
        const filename = `ad-${Date.now()}${ext}`;
        const uploadsDir = path_1.default.join(__dirname, '../../uploads');
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path_1.default.join(uploadsDir, filename);
        fs_1.default.writeFileSync(filePath, file.buffer);
        const image_url = `/uploads/${filename}`;
        await (0, db_1.execute)('INSERT INTO ads (title, image_url, link_url) VALUES (?, ?, ?)', [title, image_url, link_url || null]);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[CREATE AD ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function deleteAd(req, res) {
    try {
        const { id } = req.params;
        await (0, db_1.execute)('DELETE FROM ads WHERE id = ?', [id]);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[DELETE AD ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function toggleAdStatus(req, res) {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        await (0, db_1.execute)('UPDATE ads SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[TOGGLE AD STATUS ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
