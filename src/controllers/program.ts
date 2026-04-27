import { Request, Response } from 'express';
import { query, queryOne, execute } from '../db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

export async function getActiveProgram(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    if (String(req.user?.id) !== userId) return res.status(403).json({ error: 'Forbidden' });

    const program: any = await queryOne(
      `SELECT wp.*, d.name as doctor_name, d.specialization as doctor_specialization
       FROM wellness_programs wp
       JOIN users ud ON ud.id = wp.doctor_id
       JOIN doctors d ON d.id = ud.doctor_id
       WHERE wp.user_id = ? AND wp.status IN ('active', 'requested')
       ORDER BY wp.created_at DESC LIMIT 1`,
      [userId]
    );

    if (!program) return res.json({ program: null });

    const today = new Date().toISOString().split('T')[0];
    const todayLog = await queryOne('SELECT * FROM daily_logs WHERE program_id = ? AND log_date = ?', [program.id, today]);
    const weekStats = await queryOne(`
       SELECT AVG(kalori_makan) as avg_kalori_makan, AVG(air_liter) as avg_air_liter, 
              AVG(bakar_kalori) as avg_bakar_kalori, AVG(jam_istirahat) as avg_jam_istirahat, COUNT(*) as days_logged
       FROM daily_logs WHERE program_id = ? AND log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`, [program.id]);

    const { weekOffset } = req.query;
    const offset = Number(weekOffset) || 0;

    const last7DaysLogs = await query(`
       SELECT log_date, kalori_makan, air_liter, bakar_kalori, jam_istirahat 
       FROM daily_logs 
       WHERE program_id = ? 
         AND log_date >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL (WEEKDAY(CURDATE())) DAY), INTERVAL ? WEEK)
         AND log_date < DATE_ADD(DATE_SUB(DATE_SUB(CURDATE(), INTERVAL (WEEKDAY(CURDATE())) DAY), INTERVAL ? WEEK), INTERVAL 7 DAY)
       ORDER BY log_date ASC`, [program.id, offset, offset]);

    const daysElapsed = Math.floor((new Date().getTime() - new Date(program.start_date).getTime()) / 86400000);
    const progressPercent = Math.min(100, Math.round((Math.max(0, daysElapsed) / program.target_durasi_program) * 100)) || 0;

    res.json({ program, todayLog, weekStats, last7DaysLogs, daysElapsed, progressPercent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function requestProgram(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    const { doctor_id, lab_result_id } = req.body; // doctor_id here is doctors.id from frontend
    
    // Get the user_id for this doctor
    const doctorUser = await queryOne('SELECT user_id FROM doctors WHERE id = ?', [doctor_id]) as any;
    if (!doctorUser) return res.status(404).json({ error: 'Dokter tidak ditemukan' });
    const doctorUserId = doctorUser.user_id;

    await execute(
      `INSERT INTO wellness_programs (user_id, doctor_id, lab_result_id, status) VALUES (?, ?, ?, 'requested')`,
      [req.user.id, doctorUserId, lab_result_id || null]
    );

    // Notify doctor
    const patient = await queryOne(`
      SELECT COALESCE(d.name, e.name) as name 
      FROM users u 
      LEFT JOIN doctors d ON d.id = u.doctor_id 
      LEFT JOIN employees e ON e.id = u.employee_id_ref 
      WHERE u.id = ?
    `, [req.user.id]) as any;
    
    const patientName = patient?.name || 'Pasien';
    await execute(
      'INSERT INTO notifications (user_id, title, message, type, action_url) VALUES (?, ?, ?, ?, ?)',
      [doctorUserId, 'Permintaan Program Baru', `${patientName} meminta program wellness dari Anda.`, 'program_request', '/dashboard']
    );

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

export async function cancelProgramRequest(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    // Only cancel if it's still 'requested'
    await execute(
      `UPDATE wellness_programs SET status = 'cancelled' WHERE user_id = ? AND status = 'requested'`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

export async function saveProgress(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    const { program_id, kalori_makan, air_liter, bakar_kalori, jam_istirahat, mood, stress_level, weight_kg, notes, sleep_start, sleep_end, sleep_quality } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const existing = await queryOne('SELECT id FROM daily_logs WHERE program_id = ? AND log_date = ?', [program_id, today]);
    
    if (existing) {
      await execute('UPDATE daily_logs SET kalori_makan=?, air_liter=?, bakar_kalori=?, jam_istirahat=?, mood=?, stress_level=?, weight_kg=?, notes=?, sleep_start=?, sleep_end=?, sleep_quality=? WHERE program_id=? AND log_date=?',
        [kalori_makan, air_liter, bakar_kalori, jam_istirahat, mood, stress_level||5, weight_kg||null, notes||null, sleep_start||null, sleep_end||null, sleep_quality||null, program_id, today]);
    } else {
      await execute('INSERT INTO daily_logs (program_id, user_id, log_date, kalori_makan, air_liter, bakar_kalori, jam_istirahat, mood, stress_level, weight_kg, notes, sleep_start, sleep_end, sleep_quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [program_id, req.user.id, today, kalori_makan, air_liter, bakar_kalori, jam_istirahat, mood, stress_level||5, weight_kg||null, notes||null, sleep_start||null, sleep_end||null, sleep_quality||null]);
    }
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

export async function createProgram(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    const body = req.body;
    await execute("UPDATE wellness_programs SET status = 'cancelled' WHERE user_id = ? AND status = 'active'", [body.patient_id]);
    
    const result = await execute(
      `INSERT INTO wellness_programs (user_id, doctor_id, lab_result_id, status, start_date, end_date, duration_days, target_kalori_makan, target_air_liter, target_bakar_kalori, target_jam_istirahat, target_durasi_program, doctor_notes) 
       VALUES (?, ?, ?, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?, ?, ?, ?)`,
      [body.patient_id, req.user.id, body.lab_result_id || null, body.target_durasi_program, body.target_durasi_program, body.target_kalori_makan, body.target_air_liter, body.target_bakar_kalori, body.target_jam_istirahat, body.target_durasi_program, body.doctor_notes]
    );

    // Notify patient
    const doctor = await queryOne('SELECT name FROM doctors WHERE id = (SELECT doctor_id FROM users WHERE id = ?)', [req.user.id]) as any;
    const doctorName = doctor?.name || 'Dokter';
    
    await execute(
      'INSERT INTO notifications (user_id, title, message, type, action_url) VALUES (?, ?, ?, ?, ?)',
      [body.patient_id, 'Program Wellness Aktif', `Dokter ${doctorName} telah membuatkan program wellness untuk Anda.`, 'program_update', '/program']
    );

    res.json({ success: true, programId: (result as any).insertId });
  } catch(e) { 
    console.error(e);
    res.status(500).send(); 
  }
}

export async function updateProgram(req: Request, res: Response) {
  try {
    const body = req.body;
    const existing = await queryOne('SELECT status FROM wellness_programs WHERE id = ?', [body.program_id]) as any;
    
    if (existing?.status === 'requested') {
      await execute(
        `UPDATE wellness_programs SET 
          target_kalori_makan=?, target_air_liter=?, target_bakar_kalori=?, target_jam_istirahat=?, 
          target_durasi_program=?, doctor_notes=?, status='active', 
          start_date=CURDATE(), end_date=DATE_ADD(CURDATE(), INTERVAL ? DAY), duration_days=? 
        WHERE id=?`,
        [body.target_kalori_makan, body.target_air_liter, body.target_bakar_kalori, body.target_jam_istirahat, body.target_durasi_program, body.doctor_notes, body.target_durasi_program, body.target_durasi_program, body.program_id]
      );
    } else {
      await execute(
        'UPDATE wellness_programs SET target_kalori_makan=?, target_air_liter=?, target_bakar_kalori=?, target_jam_istirahat=?, target_durasi_program=?, doctor_notes=? WHERE id=?',
        [body.target_kalori_makan, body.target_air_liter, body.target_bakar_kalori, body.target_jam_istirahat, body.target_durasi_program, body.doctor_notes, body.program_id]
      );
    }

     // Notify patient
     const prog = await queryOne('SELECT user_id FROM wellness_programs WHERE id = ?', [body.program_id]);
     if (prog) {
       await execute(
         'INSERT INTO notifications (user_id, title, message, type, action_url) VALUES (?, ?, ?, ?, ?)',
         [prog.user_id, 'Update Program', 'Program wellness Anda telah diperbarui oleh dokter.', 'program_update', '/program']
       );
     }

     res.json({ success: true });
  } catch(e) { 
    console.error(e);
    res.status(500).send(); 
  }
}

export async function getProgramsList(req: Request, res: Response) {
  try {
    const programs = await query(`
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
  } catch(e) { 
    console.error(e);
    res.status(500).send(); 
  }
}

// DETAILED LOGGING HELPERS
async function getOrCreateDailyLog(program_id: number, user_id: number, log_date: string) {
  let log = await queryOne('SELECT id FROM daily_logs WHERE program_id = ? AND log_date = ?', [program_id, log_date]) as any;
  if (!log) {
    const result: any = await execute('INSERT INTO daily_logs (program_id, user_id, log_date) VALUES (?, ?, ?)', [program_id, user_id, log_date]);
    return result.insertId;
  }
  return log.id;
}

export async function getDetailedLogs(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    const { program_id, log_date } = req.query;
    if (!program_id || !log_date) return res.status(400).json({ error: 'Missing parameters' });

    const log = await queryOne('SELECT * FROM daily_logs WHERE program_id = ? AND log_date = ? AND user_id = ?', [program_id, log_date, req.user.id]) as any;
    if (!log) return res.json({ meals: [], water: [], exercise: [] });

    const meals = await query('SELECT * FROM meal_logs WHERE daily_log_id = ? ORDER BY created_at ASC', [log.id]);
    const water = await query('SELECT * FROM water_logs WHERE daily_log_id = ? ORDER BY created_at ASC', [log.id]);
    const exercise = await query('SELECT * FROM exercise_logs WHERE daily_log_id = ? ORDER BY created_at ASC', [log.id]);

    res.json({ log, meals, water, exercise });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

export async function addMealLog(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    const { program_id, log_date, meal_time, logged_at, food_name, calories, protein_g, fat_g, carbs_g } = req.body;
    
    const dailyLogId = await getOrCreateDailyLog(program_id, req.user.id, log_date);
    
    await execute(
      'INSERT INTO meal_logs (daily_log_id, meal_time, logged_at, food_name, calories, protein_g, fat_g, carbs_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [dailyLogId, meal_time, logged_at || null, food_name, calories, protein_g || 0, fat_g || 0, carbs_g || 0]
    );

    await execute('UPDATE daily_logs SET kalori_makan = (SELECT SUM(calories) FROM meal_logs WHERE daily_log_id = ?) WHERE id = ?', [dailyLogId, dailyLogId]);

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

export async function deleteMealLog(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    const { id } = req.params;
    
    const meal = await queryOne('SELECT daily_log_id FROM meal_logs WHERE id = ?', [id]) as any;
    if (!meal) return res.status(404).send();
    
    await execute('DELETE FROM meal_logs WHERE id = ?', [id]);
    await execute('UPDATE daily_logs SET kalori_makan = IFNULL((SELECT SUM(calories) FROM meal_logs WHERE daily_log_id = ?), 0) WHERE id = ?', [meal.daily_log_id, meal.daily_log_id]);
    
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

export async function addWaterLog(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    const { program_id, log_date, amount_ml, time_logged } = req.body;
    
    const dailyLogId = await getOrCreateDailyLog(program_id, req.user.id, log_date);
    
    await execute(
      'INSERT INTO water_logs (daily_log_id, amount_ml, time_logged) VALUES (?, ?, ?)',
      [dailyLogId, amount_ml, time_logged]
    );

    // Convert ML to Liters and update daily_logs
    await execute('UPDATE daily_logs SET air_liter = (SELECT SUM(amount_ml) / 1000.0 FROM water_logs WHERE daily_log_id = ?) WHERE id = ?', [dailyLogId, dailyLogId]);

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

export async function deleteWaterLog(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    const { id } = req.params;
    
    const water = await queryOne('SELECT daily_log_id FROM water_logs WHERE id = ?', [id]) as any;
    if (!water) return res.status(404).send();
    
    await execute('DELETE FROM water_logs WHERE id = ?', [id]);
    await execute('UPDATE daily_logs SET air_liter = IFNULL((SELECT SUM(amount_ml) / 1000.0 FROM water_logs WHERE daily_log_id = ?), 0) WHERE id = ?', [water.daily_log_id, water.daily_log_id]);
    
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

export async function addExerciseLog(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    const { program_id, log_date, activity_type, duration_minutes, calories_burned } = req.body;
    
    const dailyLogId = await getOrCreateDailyLog(program_id, req.user.id, log_date);
    
    await execute(
      'INSERT INTO exercise_logs (daily_log_id, activity_type, duration_minutes, calories_burned) VALUES (?, ?, ?, ?)',
      [dailyLogId, activity_type, duration_minutes, calories_burned]
    );

    await execute('UPDATE daily_logs SET bakar_kalori = (SELECT SUM(calories_burned) FROM exercise_logs WHERE daily_log_id = ?) WHERE id = ?', [dailyLogId, dailyLogId]);

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

export async function deleteExerciseLog(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).send();
    const { id } = req.params;
    
    const exercise = await queryOne('SELECT daily_log_id FROM exercise_logs WHERE id = ?', [id]) as any;
    if (!exercise) return res.status(404).send();
    
    await execute('DELETE FROM exercise_logs WHERE id = ?', [id]);
    await execute('UPDATE daily_logs SET bakar_kalori = IFNULL((SELECT SUM(calories_burned) FROM exercise_logs WHERE daily_log_id = ?), 0) WHERE id = ?', [exercise.daily_log_id, exercise.daily_log_id]);
    
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

// Data makanan Indonesia sekarang diambil langsung dari database (tabel 'foods')

export async function searchNutrition(req: Request, res: Response) {
  try {
    const searchQuery = req.query.query;
    if (!searchQuery || typeof searchQuery !== 'string') return res.json({ results: [] });

    const q = searchQuery.toLowerCase();
    
    // 1. Search local Indonesian database (from 'foods' table)
    const localResults = await query(
      'SELECT name, category, calories, protein_g, fat_g, carbs_g FROM foods WHERE name LIKE ? LIMIT 10',
      [`%${q}%`]
    ) as any[];

    // 2. Fetch from Open Food Facts API for global snacks/products
    let globalResults: any[] = [];
    try {
      const offRes = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=5`);
      const offData = await offRes.json();
      
      if (offData && offData.products) {
        globalResults = offData.products
          .filter((p: any) => p.nutriments && p.nutriments['energy-kcal_100g'] !== undefined)
          .map((p: any) => ({
            name: p.product_name || 'Unknown Product',
            calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
            protein_g: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
            fat_g: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
            carbs_g: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10
          }));
      }
    } catch (apiErr) {
      console.error('Open Food Facts API error:', apiErr);
    }

    // Combine and return
    const combined = [...localResults, ...globalResults];
    res.json({ results: combined.slice(0, 10) });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
}

export async function scanFoodImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.status(503).json({ error: 'Gemini API key is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fileBytes = fs.readFileSync(req.file.path);
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
    fs.unlinkSync(req.file.path);

    res.json({ results: [nutritionData] });
  } catch (e) {
    console.error('Scan error:', e);
    // Cleanup if file exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process image' });
  }
}
