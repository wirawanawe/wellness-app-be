"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllDoctors = getAllDoctors;
exports.getPatientDetails = getPatientDetails;
exports.getLabRequests = getLabRequests;
exports.createLabRequest = createLabRequest;
const db_1 = require("../db");
async function getAllDoctors(req, res) {
    try {
        const doctors = await (0, db_1.query)(`
      SELECT 
        d.id, d.name, u.email, d.profile_photo_url as avatar_url, d.gender, 
        d.specialization, d.hospital_affiliation, d.bio, d.rating, 
        d.available_slots as quota, d.profile_photo_url, d.consultation_fee,
        IFNULL(p.count, 0) as total_patients,
        (d.available_slots - IFNULL(p.count, 0)) as remaining_slots
      FROM doctors d
      LEFT JOIN users u ON u.id = d.user_id
      LEFT JOIN (
        SELECT doctor_id, COUNT(*) as count 
        FROM wellness_programs 
        WHERE status IN ('active', 'requested')
        GROUP BY doctor_id
      ) p ON p.doctor_id = u.id
      WHERE (u.role = 'dokter' OR u.role IS NULL) AND (u.is_active = 1 OR u.is_active IS NULL)
      ORDER BY d.rating DESC
    `);
        res.json({ doctors });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function getPatientDetails(req, res) {
    try {
        const { id } = req.params;
        const patient = await (0, db_1.queryOne)(`
      SELECT u.id, u.email, u.role, e.*, c.name as company_name 
      FROM users u 
      JOIN employees e ON e.id = u.employee_id_ref 
      LEFT JOIN companies c ON c.id = e.company_id 
      WHERE u.id = ? AND u.role = 'karyawan'
    `, [id]);
        const latestLab = await (0, db_1.queryOne)(`SELECT * FROM lab_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`, [id]);
        const labParameters = latestLab ? await (0, db_1.query)('SELECT * FROM lab_parameters WHERE lab_result_id = ? ORDER BY status DESC', [latestLab.id]) : [];
        const activeProgram = await (0, db_1.queryOne)(`
      SELECT wp.*, d.name as doctor_name 
      FROM wellness_programs wp 
      JOIN users u ON u.id = wp.doctor_id 
      JOIN doctors d ON d.id = u.doctor_id
      WHERE wp.user_id = ? AND wp.status IN ('active', 'requested') 
      ORDER BY wp.created_at DESC LIMIT 1
    `, [id]);
        const progressHistory = activeProgram ? await (0, db_1.query)('SELECT * FROM daily_logs WHERE program_id = ? ORDER BY log_date DESC LIMIT 14', [activeProgram.id]) : [];
        res.json({ patient, latestLab, labParameters, activeProgram, progressHistory });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function getLabRequests(req, res) {
    // Returning dummy data for UI demonstration
    const requests = [
        { id: 1, patient_name: 'Budi Santoso', patient_email: 'budi@example.com', request_date: new Date().toISOString(), status: 'pending', notes: 'Pemeriksaan rutin kolesterol' },
        { id: 2, patient_name: 'Siti Aminah', patient_email: 'siti@example.com', request_date: new Date(Date.now() - 86400000).toISOString(), status: 'completed', notes: 'Cek gula darah puasa' },
        { id: 3, patient_name: 'Iwan Fals', patient_email: 'iwan@example.com', request_date: new Date(Date.now() - 172800000).toISOString(), status: 'pending', notes: 'Tindak lanjut asam urat' },
    ];
    res.json({ requests });
}
async function createLabRequest(req, res) {
    res.json({ success: true });
}
