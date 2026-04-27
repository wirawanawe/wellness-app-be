import { Request, Response } from 'express';
import { query, queryOne, execute } from '../db';
import bcrypt from 'bcryptjs';

export async function getReports(req: Request, res: Response) {
  try {
    const total_employees = (await queryOne('SELECT COUNT(*) as c FROM users WHERE role="karyawan"'))?.c || 0;
    const active_programs = (await queryOne('SELECT COUNT(*) as c FROM wellness_programs WHERE status="active"'))?.c || 0;
    
    // Very simplified summary for the microservice structure
    res.json({
      overview: { total_employees, active_programs, completed_programs: 0, ideal_count: 0, needs_program_count: 0 },
      programStats: [{status: 'active', count: active_programs}],
      healthTrends: [],
      topAbnormal: []
    });
  } catch(e) { res.status(500).send(); }
}

export async function getCompanies(req: Request, res: Response) {
  try {
    const companies = await query('SELECT * FROM companies ORDER BY created_at DESC');
    res.json({ companies });
  } catch(e) { res.status(500).send(); }
}

export async function createCompany(req: Request, res: Response) {
  try {
    const { name, code, address } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Nama dan kode perusahaan wajib diisi' });

    // Cek apakah kode sudah dipakai
    const existing = await queryOne('SELECT id FROM companies WHERE code = ?', [code]);
    if (existing) return res.status(400).json({ error: 'Kode perusahaan sudah digunakan' });

    const result = await execute('INSERT INTO companies (name, code, address) VALUES (?, ?, ?)', [name, code, address || '']);
    res.json({ success: true, companyId: result.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal menambahkan perusahaan' });
  }
}

export async function getEmployees(req: Request, res: Response) {
  try {
    const employees = await query(`
      SELECT u.id, e.name, u.email, c.name as company_name 
      FROM users u 
      JOIN employees e ON e.user_id = u.id
      LEFT JOIN companies c ON c.id = e.company_id 
      WHERE u.role = 'karyawan'
      ORDER BY e.created_at DESC`);
    res.json({ employees });
  } catch(e) { 
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' }); 
  }
}

export async function createEmployee(req: Request, res: Response) {
  const { name, email, password, company_id, employee_id } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password || 'wellness123', 10);
    
    // 1. Insert into users
    const userResult = await execute(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, hashedPassword, 'karyawan']
    );
    const userId = userResult.insertId;

    // 2. Insert into employees
    const empResult = await execute(
      'INSERT INTO employees (user_id, company_id, employee_id, name) VALUES (?, ?, ?, ?)',
      [userId, company_id, employee_id, name]
    );

    // 3. Link back to users (if employee_id_ref exists in users table)
    await execute(
      'UPDATE users SET employee_id_ref = ? WHERE id = ?',
      [empResult.insertId, userId]
    );

    res.json({ success: true, employeeId: empResult.insertId });
  } catch (e: any) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    }
    res.status(500).json({ error: 'Gagal menambahkan karyawan' });
  }
}

export async function createDoctor(req: Request, res: Response) {
  const { name, email, password, specialization, hospital_affiliation } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password || 'dokter123', 10);
    
    // 1. Insert into users
    const userResult = await execute(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, hashedPassword, 'dokter']
    );
    const userId = userResult.insertId;

    // 2. Insert into doctors
    const docResult = await execute(
      'INSERT INTO doctors (user_id, name, specialization, hospital_affiliation) VALUES (?, ?, ?, ?)',
      [userId, name, specialization, hospital_affiliation]
    );
    const doctorId = docResult.insertId;

    // 3. Link back to users
    await execute(
      'UPDATE users SET doctor_id = ? WHERE id = ?',
      [doctorId, userId]
    );

    res.json({ success: true, doctorId });
  } catch (e: any) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    }
    res.status(500).json({ error: 'Gagal menambahkan dokter' });
  }
}

export async function updateDoctor(req: Request, res: Response) {
  const { id } = req.params;
  const { name, specialization, hospital_affiliation, quota } = req.body;
  try {
    await execute(
      `UPDATE doctors SET 
        name = ?, 
        specialization = ?, 
        hospital_affiliation = ?, 
        available_slots = ? 
      WHERE id = ?`,
      [name, specialization, hospital_affiliation, quota, id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal memperbarui data dokter' });
  }
}
