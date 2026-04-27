"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReports = getReports;
exports.getCompanies = getCompanies;
exports.createCompany = createCompany;
exports.getEmployees = getEmployees;
exports.createEmployee = createEmployee;
exports.createDoctor = createDoctor;
exports.updateDoctor = updateDoctor;
const db_1 = require("../db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function getReports(req, res) {
    try {
        const total_employees = (await (0, db_1.queryOne)('SELECT COUNT(*) as c FROM users WHERE role="karyawan"'))?.c || 0;
        const active_programs = (await (0, db_1.queryOne)('SELECT COUNT(*) as c FROM wellness_programs WHERE status="active"'))?.c || 0;
        // Very simplified summary for the microservice structure
        res.json({
            overview: { total_employees, active_programs, completed_programs: 0, ideal_count: 0, needs_program_count: 0 },
            programStats: [{ status: 'active', count: active_programs }],
            healthTrends: [],
            topAbnormal: []
        });
    }
    catch (e) {
        res.status(500).send();
    }
}
async function getCompanies(req, res) {
    try {
        const companies = await (0, db_1.query)('SELECT * FROM companies ORDER BY created_at DESC');
        res.json({ companies });
    }
    catch (e) {
        res.status(500).send();
    }
}
async function createCompany(req, res) {
    try {
        const { name, code, address } = req.body;
        if (!name || !code)
            return res.status(400).json({ error: 'Nama dan kode perusahaan wajib diisi' });
        // Cek apakah kode sudah dipakai
        const existing = await (0, db_1.queryOne)('SELECT id FROM companies WHERE code = ?', [code]);
        if (existing)
            return res.status(400).json({ error: 'Kode perusahaan sudah digunakan' });
        const result = await (0, db_1.execute)('INSERT INTO companies (name, code, address) VALUES (?, ?, ?)', [name, code, address || '']);
        res.json({ success: true, companyId: result.insertId });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Gagal menambahkan perusahaan' });
    }
}
async function getEmployees(req, res) {
    try {
        const employees = await (0, db_1.query)(`
      SELECT u.id, e.name, u.email, c.name as company_name 
      FROM users u 
      JOIN employees e ON e.user_id = u.id
      LEFT JOIN companies c ON c.id = e.company_id 
      WHERE u.role = 'karyawan'
      ORDER BY e.created_at DESC`);
        res.json({ employees });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
async function createEmployee(req, res) {
    const { name, email, password, company_id, employee_id } = req.body;
    try {
        const hashedPassword = await bcryptjs_1.default.hash(password || 'wellness123', 10);
        // 1. Insert into users
        const userResult = await (0, db_1.execute)('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)', [email, hashedPassword, 'karyawan']);
        const userId = userResult.insertId;
        // 2. Insert into employees
        const empResult = await (0, db_1.execute)('INSERT INTO employees (user_id, company_id, employee_id, name) VALUES (?, ?, ?, ?)', [userId, company_id, employee_id, name]);
        // 3. Link back to users (if employee_id_ref exists in users table)
        await (0, db_1.execute)('UPDATE users SET employee_id_ref = ? WHERE id = ?', [empResult.insertId, userId]);
        res.json({ success: true, employeeId: empResult.insertId });
    }
    catch (e) {
        console.error(e);
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email sudah terdaftar' });
        }
        res.status(500).json({ error: 'Gagal menambahkan karyawan' });
    }
}
async function createDoctor(req, res) {
    const { name, email, password, specialization, hospital_affiliation } = req.body;
    try {
        const hashedPassword = await bcryptjs_1.default.hash(password || 'dokter123', 10);
        // 1. Insert into users
        const userResult = await (0, db_1.execute)('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)', [email, hashedPassword, 'dokter']);
        const userId = userResult.insertId;
        // 2. Insert into doctors
        const docResult = await (0, db_1.execute)('INSERT INTO doctors (user_id, name, specialization, hospital_affiliation) VALUES (?, ?, ?, ?)', [userId, name, specialization, hospital_affiliation]);
        const doctorId = docResult.insertId;
        // 3. Link back to users
        await (0, db_1.execute)('UPDATE users SET doctor_id = ? WHERE id = ?', [doctorId, userId]);
        res.json({ success: true, doctorId });
    }
    catch (e) {
        console.error(e);
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email sudah terdaftar' });
        }
        res.status(500).json({ error: 'Gagal menambahkan dokter' });
    }
}
async function updateDoctor(req, res) {
    const { id } = req.params;
    const { name, specialization, hospital_affiliation, quota } = req.body;
    try {
        await (0, db_1.execute)(`UPDATE doctors SET 
        name = ?, 
        specialization = ?, 
        hospital_affiliation = ?, 
        available_slots = ? 
      WHERE id = ?`, [name, specialization, hospital_affiliation, quota, id]);
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Gagal memperbarui data dokter' });
    }
}
