"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveProgram = getActiveProgram;
exports.requestProgram = requestProgram;
exports.cancelProgramRequest = cancelProgramRequest;
exports.saveProgress = saveProgress;
exports.createProgram = createProgram;
exports.updateProgram = updateProgram;
exports.getProgramsList = getProgramsList;
exports.getDetailedLogs = getDetailedLogs;
exports.addMealLog = addMealLog;
exports.deleteMealLog = deleteMealLog;
exports.addWaterLog = addWaterLog;
exports.deleteWaterLog = deleteWaterLog;
exports.addExerciseLog = addExerciseLog;
exports.deleteExerciseLog = deleteExerciseLog;
exports.searchNutrition = searchNutrition;
exports.scanFoodImage = scanFoodImage;
const db_1 = require("../db");
const generative_ai_1 = require("@google/generative-ai");
const fs_1 = __importDefault(require("fs"));
async function getActiveProgram(req, res) {
    try {
        const { userId } = req.params;
        if (String(req.user?.id) !== userId)
            return res.status(403).json({ error: 'Forbidden' });
        const program = await (0, db_1.queryOne)(`SELECT wp.*, d.name as doctor_name, d.specialization as doctor_specialization
       FROM wellness_programs wp
       JOIN users ud ON ud.id = wp.doctor_id
       JOIN doctors d ON d.id = ud.doctor_id
       WHERE wp.user_id = ? AND wp.status IN ('active', 'requested')
       ORDER BY wp.created_at DESC LIMIT 1`, [userId]);
        if (!program)
            return res.json({ program: null });
        const today = new Date().toISOString().split('T')[0];
        const todayLog = await (0, db_1.queryOne)('SELECT * FROM daily_logs WHERE program_id = ? AND log_date = ?', [program.id, today]);
        const weekStats = await (0, db_1.queryOne)(`
       SELECT AVG(kalori_makan) as avg_kalori_makan, AVG(air_liter) as avg_air_liter, 
              AVG(bakar_kalori) as avg_bakar_kalori, AVG(jam_istirahat) as avg_jam_istirahat, COUNT(*) as days_logged
       FROM daily_logs WHERE program_id = ? AND log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`, [program.id]);
        const daysElapsed = Math.floor((new Date().getTime() - new Date(program.start_date).getTime()) / 86400000);
        const progressPercent = Math.min(100, Math.round((Math.max(0, daysElapsed) / program.target_durasi_program) * 100)) || 0;
        res.json({ program, todayLog, weekStats, daysElapsed, progressPercent });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function requestProgram(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        const { doctor_id, lab_result_id } = req.body; // doctor_id here is doctors.id from frontend
        // Get the user_id for this doctor
        const doctorUser = await (0, db_1.queryOne)('SELECT user_id FROM doctors WHERE id = ?', [doctor_id]);
        if (!doctorUser)
            return res.status(404).json({ error: 'Dokter tidak ditemukan' });
        const doctorUserId = doctorUser.user_id;
        await (0, db_1.execute)(`INSERT INTO wellness_programs (user_id, doctor_id, lab_result_id, status) VALUES (?, ?, ?, 'requested')`, [req.user.id, doctorUserId, lab_result_id || null]);
        // Notify doctor
        const patient = await (0, db_1.queryOne)(`
      SELECT COALESCE(d.name, e.name) as name 
      FROM users u 
      LEFT JOIN doctors d ON d.id = u.doctor_id 
      LEFT JOIN employees e ON e.id = u.employee_id_ref 
      WHERE u.id = ?
    `, [req.user.id]);
        const patientName = patient?.name || 'Pasien';
        await (0, db_1.execute)('INSERT INTO notifications (user_id, title, message, type, action_url) VALUES (?, ?, ?, ?, ?)', [doctorUserId, 'Permintaan Program Baru', `${patientName} meminta program wellness dari Anda.`, 'program_request', '/dashboard']);
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function cancelProgramRequest(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        // Only cancel if it's still 'requested'
        await (0, db_1.execute)(`UPDATE wellness_programs SET status = 'cancelled' WHERE user_id = ? AND status = 'requested'`, [req.user.id]);
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function saveProgress(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        const { program_id, kalori_makan, air_liter, bakar_kalori, jam_istirahat, mood, stress_level, weight_kg, notes } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const existing = await (0, db_1.queryOne)('SELECT id FROM daily_logs WHERE program_id = ? AND log_date = ?', [program_id, today]);
        if (existing) {
            await (0, db_1.execute)('UPDATE daily_logs SET kalori_makan=?, air_liter=?, bakar_kalori=?, jam_istirahat=?, mood=?, stress_level=?, weight_kg=?, notes=? WHERE program_id=? AND log_date=?', [kalori_makan, air_liter, bakar_kalori, jam_istirahat, mood, stress_level || 5, weight_kg || null, notes || null, program_id, today]);
        }
        else {
            await (0, db_1.execute)('INSERT INTO daily_logs (program_id, user_id, log_date, kalori_makan, air_liter, bakar_kalori, jam_istirahat, mood, stress_level, weight_kg, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [program_id, req.user.id, today, kalori_makan, air_liter, bakar_kalori, jam_istirahat, mood, stress_level || 5, weight_kg || null, notes || null]);
        }
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function createProgram(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        const body = req.body;
        await (0, db_1.execute)("UPDATE wellness_programs SET status = 'cancelled' WHERE user_id = ? AND status = 'active'", [body.patient_id]);
        const result = await (0, db_1.execute)(`INSERT INTO wellness_programs (user_id, doctor_id, lab_result_id, status, start_date, end_date, duration_days, target_kalori_makan, target_air_liter, target_bakar_kalori, target_jam_istirahat, target_durasi_program, doctor_notes) 
       VALUES (?, ?, ?, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?, ?, ?, ?)`, [body.patient_id, req.user.id, body.lab_result_id || null, body.target_durasi_program, body.target_durasi_program, body.target_kalori_makan, body.target_air_liter, body.target_bakar_kalori, body.target_jam_istirahat, body.target_durasi_program, body.doctor_notes]);
        // Notify patient
        const doctor = await (0, db_1.queryOne)('SELECT name FROM doctors WHERE id = (SELECT doctor_id FROM users WHERE id = ?)', [req.user.id]);
        const doctorName = doctor?.name || 'Dokter';
        await (0, db_1.execute)('INSERT INTO notifications (user_id, title, message, type, action_url) VALUES (?, ?, ?, ?, ?)', [body.patient_id, 'Program Wellness Aktif', `Dokter ${doctorName} telah membuatkan program wellness untuk Anda.`, 'program_update', '/program']);
        res.json({ success: true, programId: result.insertId });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function updateProgram(req, res) {
    try {
        const body = req.body;
        const existing = await (0, db_1.queryOne)('SELECT status FROM wellness_programs WHERE id = ?', [body.program_id]);
        if (existing?.status === 'requested') {
            await (0, db_1.execute)(`UPDATE wellness_programs SET 
          target_kalori_makan=?, target_air_liter=?, target_bakar_kalori=?, target_jam_istirahat=?, 
          target_durasi_program=?, doctor_notes=?, status='active', 
          start_date=CURDATE(), end_date=DATE_ADD(CURDATE(), INTERVAL ? DAY), duration_days=? 
        WHERE id=?`, [body.target_kalori_makan, body.target_air_liter, body.target_bakar_kalori, body.target_jam_istirahat, body.target_durasi_program, body.doctor_notes, body.target_durasi_program, body.target_durasi_program, body.program_id]);
        }
        else {
            await (0, db_1.execute)('UPDATE wellness_programs SET target_kalori_makan=?, target_air_liter=?, target_bakar_kalori=?, target_jam_istirahat=?, target_durasi_program=?, doctor_notes=? WHERE id=?', [body.target_kalori_makan, body.target_air_liter, body.target_bakar_kalori, body.target_jam_istirahat, body.target_durasi_program, body.doctor_notes, body.program_id]);
        }
        // Notify patient
        const prog = await (0, db_1.queryOne)('SELECT user_id FROM wellness_programs WHERE id = ?', [body.program_id]);
        if (prog) {
            await (0, db_1.execute)('INSERT INTO notifications (user_id, title, message, type, action_url) VALUES (?, ?, ?, ?, ?)', [prog.user_id, 'Update Program', 'Program wellness Anda telah diperbarui oleh dokter.', 'program_update', '/program']);
        }
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function getProgramsList(req, res) {
    try {
        const programs = await (0, db_1.query)(`
       SELECT wp.*, ep.name AS patient_name, u.email AS patient_email, dp.name AS doctor_name, c.name AS company_name, lr.status AS lab_status
       FROM wellness_programs wp
       JOIN users u ON u.id = wp.user_id
       LEFT JOIN employees ep ON ep.id = u.employee_id_ref
       JOIN users ud ON ud.id = wp.doctor_id
       JOIN doctors dp ON dp.id = ud.doctor_id
       LEFT JOIN companies c ON c.id = ep.company_id
       LEFT JOIN lab_results lr ON lr.id = wp.lab_result_id
       ${req.user?.role === 'dokter' ? "WHERE wp.doctor_id = ? AND wp.status IN ('active', 'requested')" : "WHERE wp.status IN ('active', 'requested')"}
    `, req.user?.role === 'dokter' ? [req.user.id] : []);
        res.json({ programs });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
// DETAILED LOGGING HELPERS
async function getOrCreateDailyLog(program_id, user_id, log_date) {
    let log = await (0, db_1.queryOne)('SELECT id FROM daily_logs WHERE program_id = ? AND log_date = ?', [program_id, log_date]);
    if (!log) {
        const result = await (0, db_1.execute)('INSERT INTO daily_logs (program_id, user_id, log_date) VALUES (?, ?, ?)', [program_id, user_id, log_date]);
        return result.insertId;
    }
    return log.id;
}
async function getDetailedLogs(req, res) {
    try {
        console.log('[DEBUG] getDetailedLogs called with query:', req.query);
        if (!req.user)
            return res.status(401).send();
        const { program_id, log_date } = req.query;
        if (!program_id || !log_date)
            return res.status(400).json({ error: 'Missing parameters' });
        const log = await (0, db_1.queryOne)('SELECT * FROM daily_logs WHERE program_id = ? AND log_date = ? AND user_id = ?', [program_id, log_date, req.user.id]);
        if (!log)
            return res.json({ meals: [], water: [], exercise: [] });
        const meals = await (0, db_1.query)('SELECT * FROM meal_logs WHERE daily_log_id = ? ORDER BY created_at ASC', [log.id]);
        const water = await (0, db_1.query)('SELECT * FROM water_logs WHERE daily_log_id = ? ORDER BY created_at ASC', [log.id]);
        const exercise = await (0, db_1.query)('SELECT * FROM exercise_logs WHERE daily_log_id = ? ORDER BY created_at ASC', [log.id]);
        res.json({ log, meals, water, exercise });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function addMealLog(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        const { program_id, log_date, meal_time, logged_at, food_name, calories, protein_g, fat_g, carbs_g } = req.body;
        const dailyLogId = await getOrCreateDailyLog(program_id, req.user.id, log_date);
        await (0, db_1.execute)('INSERT INTO meal_logs (daily_log_id, meal_time, logged_at, food_name, calories, protein_g, fat_g, carbs_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [dailyLogId, meal_time, logged_at || null, food_name, calories, protein_g || 0, fat_g || 0, carbs_g || 0]);
        await (0, db_1.execute)('UPDATE daily_logs SET kalori_makan = (SELECT SUM(calories) FROM meal_logs WHERE daily_log_id = ?) WHERE id = ?', [dailyLogId, dailyLogId]);
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function deleteMealLog(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        const { id } = req.params;
        const meal = await (0, db_1.queryOne)('SELECT daily_log_id FROM meal_logs WHERE id = ?', [id]);
        if (!meal)
            return res.status(404).send();
        await (0, db_1.execute)('DELETE FROM meal_logs WHERE id = ?', [id]);
        await (0, db_1.execute)('UPDATE daily_logs SET kalori_makan = IFNULL((SELECT SUM(calories) FROM meal_logs WHERE daily_log_id = ?), 0) WHERE id = ?', [meal.daily_log_id, meal.daily_log_id]);
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function addWaterLog(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        const { program_id, log_date, amount_ml, time_logged } = req.body;
        const dailyLogId = await getOrCreateDailyLog(program_id, req.user.id, log_date);
        await (0, db_1.execute)('INSERT INTO water_logs (daily_log_id, amount_ml, time_logged) VALUES (?, ?, ?)', [dailyLogId, amount_ml, time_logged]);
        // Convert ML to Liters and update daily_logs
        await (0, db_1.execute)('UPDATE daily_logs SET air_liter = (SELECT SUM(amount_ml) / 1000.0 FROM water_logs WHERE daily_log_id = ?) WHERE id = ?', [dailyLogId, dailyLogId]);
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function deleteWaterLog(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        const { id } = req.params;
        const water = await (0, db_1.queryOne)('SELECT daily_log_id FROM water_logs WHERE id = ?', [id]);
        if (!water)
            return res.status(404).send();
        await (0, db_1.execute)('DELETE FROM water_logs WHERE id = ?', [id]);
        await (0, db_1.execute)('UPDATE daily_logs SET air_liter = IFNULL((SELECT SUM(amount_ml) / 1000.0 FROM water_logs WHERE daily_log_id = ?), 0) WHERE id = ?', [water.daily_log_id, water.daily_log_id]);
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function addExerciseLog(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        const { program_id, log_date, activity_type, duration_minutes, calories_burned } = req.body;
        const dailyLogId = await getOrCreateDailyLog(program_id, req.user.id, log_date);
        await (0, db_1.execute)('INSERT INTO exercise_logs (daily_log_id, activity_type, duration_minutes, calories_burned) VALUES (?, ?, ?, ?)', [dailyLogId, activity_type, duration_minutes, calories_burned]);
        await (0, db_1.execute)('UPDATE daily_logs SET bakar_kalori = (SELECT SUM(calories_burned) FROM exercise_logs WHERE daily_log_id = ?) WHERE id = ?', [dailyLogId, dailyLogId]);
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function deleteExerciseLog(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        const { id } = req.params;
        const exercise = await (0, db_1.queryOne)('SELECT daily_log_id FROM exercise_logs WHERE id = ?', [id]);
        if (!exercise)
            return res.status(404).send();
        await (0, db_1.execute)('DELETE FROM exercise_logs WHERE id = ?', [id]);
        await (0, db_1.execute)('UPDATE daily_logs SET bakar_kalori = IFNULL((SELECT SUM(calories_burned) FROM exercise_logs WHERE daily_log_id = ?), 0) WHERE id = ?', [exercise.daily_log_id, exercise.daily_log_id]);
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
// Data makanan Indonesia sekarang diambil langsung dari database (tabel 'foods')
async function searchNutrition(req, res) {
    try {
        const searchQuery = req.query.query;
        if (!searchQuery || typeof searchQuery !== 'string')
            return res.json({ results: [] });
        const q = searchQuery.toLowerCase();
        // 1. Search local Indonesian database (from 'foods' table)
        const localResults = await (0, db_1.query)('SELECT name, category, calories, protein_g, fat_g, carbs_g FROM foods WHERE name LIKE ? LIMIT 10', [`%${q}%`]);
        // 2. Fetch from Open Food Facts API for global snacks/products
        let globalResults = [];
        try {
            const offRes = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=5`);
            const offData = await offRes.json();
            if (offData && offData.products) {
                globalResults = offData.products
                    .filter((p) => p.nutriments && p.nutriments['energy-kcal_100g'] !== undefined)
                    .map((p) => ({
                    name: p.product_name || 'Unknown Product',
                    calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
                    protein_g: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
                    fat_g: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
                    carbs_g: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10
                }));
            }
        }
        catch (apiErr) {
            console.error('Open Food Facts API error:', apiErr);
        }
        // Combine and return
        const combined = [...localResults, ...globalResults];
        res.json({ results: combined.slice(0, 10) });
    }
    catch (e) {
        console.error(e);
        res.status(500).send();
    }
}
async function scanFoodImage(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            return res.status(503).json({ error: 'Gemini API key is not configured' });
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const fileBytes = fs_1.default.readFileSync(req.file.path);
        const mimeType = req.file.mimetype;
        const imageParts = [
            {
                inlineData: {
                    data: fileBytes.toString("base64"),
                    mimeType
                }
            }
        ];
        const prompt = `
      Anda adalah ahli nutrisi. Analisis gambar makanan ini dan perkirakan nilai nutrisinya secara akurat.
      Keluarkan HASIL SAJA dalam format JSON persis seperti ini, tanpa markdown, tanpa penjelasan:
      {
        "name": "Nama Makanan (Bahasa Indonesia)",
        "calories": 150,
        "protein_g": 5,
        "fat_g": 2,
        "carbs_g": 10
      }
    `;
        const result = await model.generateContent([prompt, ...imageParts]);
        const responseText = result.response.text();
        // Clean up markdown code blocks if any
        let jsonStr = responseText;
        if (jsonStr.includes('\`\`\`')) {
            jsonStr = jsonStr.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        }
        const nutritionData = JSON.parse(jsonStr);
        // Clean up temp file
        fs_1.default.unlinkSync(req.file.path);
        res.json({ results: [nutritionData] });
    }
    catch (e) {
        console.error('Scan error:', e);
        // Cleanup if file exists
        if (req.file && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to process image' });
    }
}
