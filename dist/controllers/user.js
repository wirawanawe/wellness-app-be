"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.changePassword = changePassword;
const db_1 = require("../db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// GET /api/users/:userId/profile
async function getProfile(req, res) {
    try {
        const { userId } = req.params;
        const requestUserId = req.user?.id;
        const requestRole = req.user?.role;
        const isOwnProfile = String(requestUserId) === String(userId);
        const isAdmin = requestRole === 'admin';
        const isDoctor = requestRole === 'dokter';
        const user = await (0, db_1.queryOne)(`SELECT u.id, u.email, u.role,
              COALESCE(d.name, e.name) as name,
              COALESCE(d.phone, e.phone) as phone,
              COALESCE(d.date_of_birth, e.date_of_birth) as birth_date,
              COALESCE(d.gender, e.gender) as gender,
              COALESCE(d.address, e.address) as address,
              COALESCE(d.ktp_number, e.ktp_number) as ktp_number,
              COALESCE(d.profile_photo_url, e.avatar_url) as avatar_url,
              e.blood_type, e.emergency_contact, e.emergency_contact_name,
              e.department, e.employee_id,
              c.name as company_name
       FROM users u
       LEFT JOIN doctors d ON d.id = u.doctor_id
       LEFT JOIN employees e ON e.id = u.employee_id_ref
       LEFT JOIN companies c ON c.id = e.company_id
       WHERE u.id = ?`, [userId]);
        if (!user)
            return res.status(404).json({ error: 'User tidak ditemukan' });
        // Restrict sensitive data if not own profile or admin
        if (!isOwnProfile && !isAdmin && !isDoctor) {
            delete user.phone;
            delete user.email;
            delete user.address;
            delete user.ktp_number;
            delete user.emergency_contact;
            delete user.emergency_contact_name;
        }
        // Normalize gender to full text for display
        const genderMap = { 'L': 'male', 'P': 'female' };
        if (user.gender)
            user.gender = genderMap[user.gender] || user.gender;
        return res.json({ user });
    }
    catch (error) {
        console.error('[GET PROFILE ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
// PUT /api/users/:userId/profile
async function updateProfile(req, res) {
    try {
        const { userId } = req.params;
        const requestUserId = req.user?.id;
        const requestRole = req.user?.role;
        if (String(requestUserId) !== String(userId) && requestRole !== 'admin') {
            return res.status(403).json({ error: 'Akses ditolak' });
        }
        const { name, phone, birth_date, gender, address, ktp_number, blood_type, emergency_contact, emergency_contact_name } = req.body;
        // Normalize gender back to DB format
        const genderDbMap = { 'male': 'L', 'female': 'P' };
        const genderDb = gender ? (genderDbMap[gender] || gender) : null;
        const userBase = await (0, db_1.queryOne)('SELECT role, doctor_id, employee_id_ref FROM users WHERE id = ?', [userId]);
        if (userBase.role === 'dokter') {
            await (0, db_1.execute)(`UPDATE doctors SET
          name = COALESCE(NULLIF(?, ''), name),
          phone = ?,
          gender = ?,
          date_of_birth = ?,
          address = ?,
          ktp_number = ?
        WHERE id = ?`, [name, phone || null, genderDb || null, birth_date || null, address || null, ktp_number || null, userBase.doctor_id]);
        }
        else if (userBase.role === 'karyawan' || userBase.role === 'umum') {
            await (0, db_1.execute)(`UPDATE employees SET
          name = COALESCE(NULLIF(?, ''), name),
          phone = ?,
          date_of_birth = ?,
          gender = ?,
          address = ?,
          ktp_number = ?,
          blood_type = ?,
          emergency_contact = ?,
          emergency_contact_name = ?
        WHERE id = ?`, [name, phone || null, birth_date || null, genderDb || null, address || null,
                ktp_number || null, blood_type || null, emergency_contact || null,
                emergency_contact_name || null, userBase.employee_id_ref]);
        }
        // Return updated profile
        return getProfile(req, res);
    }
    catch (error) {
        console.error('[UPDATE PROFILE ERROR]', error);
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage?.includes('phone'))
                return res.status(400).json({ error: 'Nomor HP sudah terdaftar' });
            if (error.sqlMessage?.includes('ktp_number'))
                return res.status(400).json({ error: 'Nomor KTP sudah terdaftar' });
            if (error.sqlMessage?.includes('employee_id'))
                return res.status(400).json({ error: 'Kode pegawai sudah terdaftar' });
            return res.status(400).json({ error: 'Data sudah terdaftar' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}
// POST /api/users/:userId/change-password
async function changePassword(req, res) {
    try {
        const { userId } = req.params;
        const requestUserId = req.user?.id;
        const { currentPassword, newPassword } = req.body;
        if (String(requestUserId) !== String(userId)) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Data tidak lengkap' });
        }
        const user = await (0, db_1.queryOne)('SELECT password_hash FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }
        const isMatch = await bcryptjs_1.default.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Password saat ini salah' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const newHash = await bcryptjs_1.default.hash(newPassword, salt);
        await (0, db_1.execute)('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
        return res.json({ message: 'Password berhasil diubah' });
    }
    catch (error) {
        console.error('[CHANGE PASSWORD ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
