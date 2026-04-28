"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.register = register;
exports.verifyOTP = verifyOTP;
exports.getRegistrationOptions = getRegistrationOptions;
exports.verifyRegistration = verifyRegistration;
exports.getAuthenticationOptions = getAuthenticationOptions;
exports.verifyAuthentication = verifyAuthentication;
exports.setupPIN = setupPIN;
exports.disablePIN = disablePIN;
exports.checkPINEnabled = checkPINEnabled;
exports.verifyPIN = verifyPIN;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../db");
const mailer_1 = require("../utils/mailer");
const server_1 = require("@simplewebauthn/server");
const helpers_1 = require("@simplewebauthn/server/helpers");
async function login(req, res) {
    try {
        const { email, password, app_type } = req.body;
        if (!email || !password || !app_type) {
            return res.status(400).json({ error: 'Missing email, password, or app_type' });
        }
        const user = await (0, db_1.queryOne)(`SELECT u.id, u.email, u.password_hash, u.role, 
              COALESCE(d.name, e.name) as name, 
              COALESCE(d.profile_photo_url, e.avatar_url) as avatar_url,
              e.company_id 
       FROM users u 
       LEFT JOIN doctors d ON d.id = u.doctor_id 
       LEFT JOIN employees e ON e.id = u.employee_id_ref 
       WHERE u.email = ? AND u.is_active = 1`, [email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Allow both 'karyawan' and 'dokter' to login to mobile app
        if (app_type === 'mobile' && user.role !== 'karyawan' && user.role !== 'dokter') {
            return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki izin untuk login ke aplikasi seluler' });
        }
        if (app_type === 'dashboard' && user.role === 'karyawan') {
            return res.status(403).json({ error: 'Akses ditolak: Karyawan tidak memiliki akses ke dashboard' });
        }
        const isValid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        return res.json({
            user: {
                id: String(user.id),
                name: user.name,
                email: user.email,
                role: user.role,
                companyId: user.company_id,
                image: user.avatar_url,
            }
        });
    }
    catch (error) {
        console.error('[AUTH LOGIN ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function register(req, res) {
    const { email, role, company_code, phone, ktp_number, employee_id } = req.body;
    try {
        if (role === 'karyawan') {
            if (!company_code)
                return res.status(400).json({ error: 'Kode perusahaan wajib diisi untuk karyawan' });
            const company = await (0, db_1.queryOne)('SELECT id FROM companies WHERE code = ?', [company_code]);
            if (!company)
                return res.status(400).json({ error: 'Kode perusahaan tidak valid atau belum terdaftar' });
        }
        const existingEmail = await (0, db_1.queryOne)('SELECT id FROM users WHERE email = ?', [email]);
        if (existingEmail)
            return res.status(400).json({ error: 'Email sudah terdaftar' });
        if (phone) {
            const existingPhone = await (0, db_1.queryOne)('SELECT id FROM employees WHERE phone = ?', [phone]);
            if (existingPhone)
                return res.status(400).json({ error: 'Nomor HP sudah terdaftar' });
        }
        if (ktp_number) {
            const existingKtp = await (0, db_1.queryOne)('SELECT id FROM employees WHERE ktp_number = ?', [ktp_number]);
            if (existingKtp)
                return res.status(400).json({ error: 'Nomor KTP sudah terdaftar' });
        }
        if (employee_id) {
            const existingEmpId = await (0, db_1.queryOne)('SELECT id FROM employees WHERE employee_id = ?', [employee_id]);
            if (existingEmpId)
                return res.status(400).json({ error: 'Kode pegawai sudah terdaftar' });
        }
        // 1. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 10 * 60000); // 10 minutes
        // 2. Save OTP
        await (0, db_1.execute)('DELETE FROM otps WHERE email = ?', [email]);
        await (0, db_1.execute)('INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)', [email, otp, expires]);
        // 3. Send Email
        try {
            await (0, mailer_1.sendEmail)({
                to: email,
                subject: 'Kode Verifikasi Wellness PHC',
                html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #10b981; color: white; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Verifikasi Akun Anda</h1>
            </div>
            <div style="padding: 32px; text-align: center; color: #1e293b;">
              <p style="font-size: 16px; margin-bottom: 24px;">Gunakan kode di bawah ini untuk memverifikasi pendaftaran akun Wellness PHC Anda:</p>
              <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981;">
                ${otp}
              </div>
              <p style="font-size: 14px; color: #64748b; margin-top: 24px;">Kode ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapapun.</p>
            </div>
            <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
              &copy; 2026 Wellness PHC. All rights reserved.
            </div>
          </div>
        `
            });
        }
        catch (mailError) {
            console.error('[MAIL SEND ERROR]', mailError);
        }
        res.json({ success: true, message: 'OTP telah dikirim ke email' });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Gagal mengirim OTP' });
    }
}
async function verifyOTP(req, res) {
    const { name, email, phone, ktp_number, employee_id, password, otp, role = 'umum', company_code } = req.body;
    try {
        const otpRecord = await (0, db_1.queryOne)('SELECT * FROM otps WHERE email = ? AND otp = ?', [email, otp]);
        if (!otpRecord)
            return res.status(400).json({ error: 'Kode OTP salah atau tidak ditemukan' });
        if (new Date(otpRecord.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Kode OTP sudah kadaluarsa' });
        }
        let companyId = null;
        if (role === 'karyawan') {
            if (!company_code)
                return res.status(400).json({ error: 'Kode perusahaan wajib diisi untuk karyawan' });
            const company = await (0, db_1.queryOne)('SELECT id FROM companies WHERE code = ?', [company_code]);
            if (!company)
                return res.status(400).json({ error: 'Kode perusahaan tidak valid' });
            companyId = company.id;
        }
        // OTP Valid -> Create User
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Check again just in case
        const existing = await (0, db_1.queryOne)('SELECT id FROM users WHERE email = ?', [email]);
        if (existing)
            return res.status(400).json({ error: 'Email sudah terdaftar' });
        if (phone) {
            const existingPhone = await (0, db_1.queryOne)('SELECT id FROM employees WHERE phone = ?', [phone]);
            if (existingPhone)
                return res.status(400).json({ error: 'Nomor HP sudah terdaftar' });
        }
        if (ktp_number) {
            const existingKtp = await (0, db_1.queryOne)('SELECT id FROM employees WHERE ktp_number = ?', [ktp_number]);
            if (existingKtp)
                return res.status(400).json({ error: 'Nomor KTP sudah terdaftar' });
        }
        if (employee_id) {
            const existingEmpId = await (0, db_1.queryOne)('SELECT id FROM employees WHERE employee_id = ?', [employee_id]);
            if (existingEmpId)
                return res.status(400).json({ error: 'Kode pegawai sudah terdaftar' });
        }
        const userResult = await (0, db_1.execute)('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)', [email, hashedPassword, role]);
        const userId = userResult.insertId;
        const empResult = await (0, db_1.execute)('INSERT INTO employees (user_id, company_id, name, phone, ktp_number, employee_id) VALUES (?, ?, ?, ?, ?, ?)', [userId, companyId, name, phone, ktp_number || null, employee_id || null]);
        await (0, db_1.execute)('UPDATE users SET employee_id_ref = ? WHERE id = ?', [empResult.insertId, userId]);
        await (0, db_1.execute)('DELETE FROM otps WHERE email = ?', [email]);
        res.json({ success: true, message: 'Registrasi berhasil' });
    }
    catch (e) {
        console.error(e);
        if (e.code === 'ER_DUP_ENTRY') {
            if (e.sqlMessage?.includes('phone'))
                return res.status(400).json({ error: 'Nomor HP sudah terdaftar' });
            if (e.sqlMessage?.includes('ktp_number'))
                return res.status(400).json({ error: 'Nomor KTP sudah terdaftar' });
            if (e.sqlMessage?.includes('employee_id'))
                return res.status(400).json({ error: 'Kode pegawai sudah terdaftar' });
            return res.status(400).json({ error: 'Data sudah terdaftar' });
        }
        res.status(500).json({ error: 'Gagal memverifikasi OTP' });
    }
}
// ── WEBAUTHN (BIOMETRIC) ───────────────────────────────────────
async function getRegistrationOptions(req, res) {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const user = await (0, db_1.queryOne)('SELECT email, name FROM users u LEFT JOIN employees e ON e.user_id = u.id WHERE u.id = ?', [req.user.id]);
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const host = req.headers.host?.split(':')[0] || 'localhost';
        const RP_ID = host;
        const options = await (0, server_1.generateRegistrationOptions)({
            rpName: 'Wellness PHC Mobile',
            rpID: RP_ID,
            userID: helpers_1.isoBase64URL.toBuffer(req.user.id.toString(), 'base64url'),
            userName: user.email,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'discouraged',
                userVerification: 'preferred',
                authenticatorAttachment: 'platform',
            },
        });
        await (0, db_1.execute)('INSERT INTO webauthn_challenges (user_id, challenge) VALUES (?, ?)', [req.user.id, options.challenge]);
        res.json(options);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function verifyRegistration(req, res) {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const body = req.body;
        const challengeRecord = await (0, db_1.queryOne)('SELECT challenge FROM webauthn_challenges WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.id]);
        if (!challengeRecord)
            return res.status(400).json({ error: 'Challenge not found' });
        const verification = await (0, server_1.verifyRegistrationResponse)({
            response: body,
            expectedChallenge: challengeRecord.challenge,
            expectedOrigin: req.headers.origin || `http://${req.headers.host}`,
            expectedRPID: req.headers.host?.split(':')[0] || 'localhost',
        });
        if (verification.verified && verification.registrationInfo) {
            const { credential } = verification.registrationInfo;
            await (0, db_1.execute)('INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter) VALUES (?, ?, ?, ?)', [req.user.id, credential.id, helpers_1.isoBase64URL.fromBuffer(credential.publicKey), credential.counter]);
            await (0, db_1.execute)('DELETE FROM webauthn_challenges WHERE user_id = ?', [req.user.id]);
            res.json({ success: true });
        }
        else {
            res.status(400).json({ error: 'Verification failed' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function getAuthenticationOptions(req, res) {
    try {
        const host = req.headers.host?.split(':')[0] || 'localhost';
        const RP_ID = host;
        const options = await (0, server_1.generateAuthenticationOptions)({
            rpID: RP_ID,
            userVerification: 'preferred',
        });
        await (0, db_1.execute)('INSERT INTO webauthn_challenges (challenge) VALUES (?)', [options.challenge]);
        res.json(options);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function verifyAuthentication(req, res) {
    try {
        const body = req.body;
        // Find the credential
        const cred = await (0, db_1.queryOne)('SELECT * FROM webauthn_credentials WHERE credential_id = ?', [body.id]);
        if (!cred)
            return res.status(404).json({ error: 'Credential not found' });
        const challengeRecord = await (0, db_1.queryOne)('SELECT challenge FROM webauthn_challenges ORDER BY created_at DESC LIMIT 1');
        if (!challengeRecord)
            return res.status(400).json({ error: 'Challenge not found' });
        const verification = await (0, server_1.verifyAuthenticationResponse)({
            response: body,
            expectedChallenge: challengeRecord.challenge,
            expectedOrigin: req.headers.origin || `http://${req.headers.host}`,
            expectedRPID: req.headers.host?.split(':')[0] || 'localhost',
            credential: {
                id: cred.credential_id,
                publicKey: helpers_1.isoBase64URL.toBuffer(cred.public_key, 'base64url'),
                counter: cred.counter,
            },
        });
        if (verification.verified) {
            await (0, db_1.execute)('UPDATE webauthn_credentials SET counter = ? WHERE id = ?', [verification.authenticationInfo.newCounter, cred.id]);
            // Return user data for login
            const user = await (0, db_1.queryOne)(`SELECT u.id, u.email, u.role, 
                COALESCE(d.name, e.name) as name, 
                COALESCE(d.profile_photo_url, e.avatar_url) as avatar_url,
                e.company_id 
         FROM users u 
         LEFT JOIN doctors d ON d.id = u.doctor_id 
         LEFT JOIN employees e ON e.id = u.employee_id_ref 
         WHERE u.id = ?`, [cred.user_id]);
            await (0, db_1.execute)('DELETE FROM webauthn_challenges WHERE challenge = ?', [challengeRecord.challenge]);
            res.json({
                user: {
                    id: String(user.id),
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    companyId: user.company_id,
                    image: user.avatar_url,
                }
            });
        }
        else {
            res.status(400).json({ error: 'Authentication failed' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
// ── PIN SECURITY ───────────────────────────────────────────────
async function setupPIN(req, res) {
    try {
        const { pin } = req.body;
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
            return res.status(400).json({ error: 'PIN must be 6 digits' });
        }
        const hashedPin = await bcryptjs_1.default.hash(pin, 10);
        await (0, db_1.execute)('UPDATE users SET security_pin = ?, pin_enabled = TRUE WHERE id = ?', [hashedPin, userId]);
        res.json({ success: true, message: 'PIN set successfully' });
    }
    catch (error) {
        console.error('[SETUP PIN ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function disablePIN(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        await (0, db_1.execute)('UPDATE users SET pin_enabled = FALSE WHERE id = ?', [userId]);
        res.json({ success: true, message: 'PIN disabled' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function checkPINEnabled(req, res) {
    try {
        const { email } = req.query;
        if (!email)
            return res.status(400).json({ error: 'Email required' });
        const user = await (0, db_1.queryOne)('SELECT pin_enabled FROM users WHERE email = ?', [String(email)]);
        res.json({ enabled: !!user?.pin_enabled });
    }
    catch (error) {
        console.error('[CHECK PIN ERROR]', error);
        res.status(500).json({
            error: 'Error checking PIN status',
            details: error.message,
            stack: error.stack
        });
    }
}
async function verifyPIN(req, res) {
    try {
        const { email, pin } = req.body;
        const user = await (0, db_1.queryOne)('SELECT id, security_pin, pin_enabled FROM users WHERE email = ?', [email]);
        if (!user || !user.pin_enabled || !user.security_pin) {
            return res.status(400).json({ error: 'PIN security not enabled' });
        }
        const isValid = await bcryptjs_1.default.compare(pin, user.security_pin);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }
        const fullUser = await (0, db_1.queryOne)(`
        SELECT u.id, u.email, u.role, 
               COALESCE(d.name, e.name) as name, 
               COALESCE(d.profile_photo_url, e.avatar_url) as avatar_url,
               e.company_id 
        FROM users u 
        LEFT JOIN doctors d ON d.id = u.doctor_id 
        LEFT JOIN employees e ON e.id = u.employee_id_ref 
        WHERE u.id = ?`, [user.id]);
        res.json({
            user: {
                id: String(fullUser.id),
                name: fullUser.name,
                email: fullUser.email,
                role: fullUser.role,
                companyId: fullUser.company_id,
                image: fullUser.avatar_url,
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
