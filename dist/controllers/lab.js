"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLab = uploadLab;
exports.getLatestLab = getLatestLab;
exports.getLabById = getLabById;
exports.extractLab = extractLab;
exports.saveManualLab = saveManualLab;
const path_1 = __importDefault(require("path"));
const promises_1 = require("fs/promises");
const db_1 = require("../db");
const generative_ai_1 = require("@google/generative-ai");
const REFERENCE_RANGES = {
    gula_darah_puasa: { min: 70, max: 100, unit: 'mg/dL', label: 'Gula Darah Puasa' },
    kolesterol_total: { min: 0, max: 200, unit: 'mg/dL', label: 'Kolesterol Total' },
    hdl: { min: 40, max: 100, unit: 'mg/dL', label: 'HDL (Kolesterol Baik)' },
    ldl: { min: 0, max: 130, unit: 'mg/dL', label: 'LDL (Kolesterol Jahat)' },
    trigliserida: { min: 0, max: 150, unit: 'mg/dL', label: 'Trigliserida' },
    asam_urat: { min: 2.4, max: 7.0, unit: 'mg/dL', label: 'Asam Urat' },
    hemoglobin: { min: 11.5, max: 17.5, unit: 'g/dL', label: 'Hemoglobin' },
    tekanan_sistolik: { min: 90, max: 130, unit: 'mmHg', label: 'Tekanan Darah Sistolik' },
    tekanan_diastolik: { min: 60, max: 85, unit: 'mmHg', label: 'Tekanan Darah Diastolik' },
    sgot: { min: 0, max: 40, unit: 'U/L', label: 'SGOT (AST)' },
    sgpt: { min: 0, max: 41, unit: 'U/L', label: 'SGPT (ALT)' },
    kreatinin: { min: 0.6, max: 1.2, unit: 'mg/dL', label: 'Kreatinin' },
    berat_badan: { min: 40, max: 120, unit: 'kg', label: 'Berat Badan' },
    tinggi_badan: { min: 100, max: 220, unit: 'cm', label: 'Tinggi Badan' },
};
async function parseLabWithGemini(base64Image, mimeType) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        return { gula_darah_puasa: 95, kolesterol_total: 210, asam_urat: 7.2 }; // Mock
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Extract numeric lab values. Return ONLY JSON with keys: gula_darah_puasa, kolesterol_total, asam_urat.`;
    const res = await model.generateContent([
        prompt,
        { inlineData: { data: base64Image, mimeType } }
    ]);
    try {
        return JSON.parse(res.response.text());
    }
    catch (e) {
        return {};
    }
}
async function uploadLab(req, res) {
    try {
        const file = req.file;
        const { lab_date, family_history, accident_history, serious_illness_history, is_smoker, smoking_duration, drinks_alcohol, alcohol_duration, ktp_number } = req.body;
        if (!file || !req.user)
            return res.status(400).json({ error: 'File and Authenticated user required' });
        const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
        const filename = `lab_${req.user.id}_${Date.now()}.${ext}`;
        const uploadDir = path_1.default.join(process.cwd(), '../mobile-pwa/public/uploads/labs');
        await (0, promises_1.mkdir)(uploadDir, { recursive: true });
        await (0, promises_1.writeFile)(path_1.default.join(uploadDir, filename), file.buffer);
        const base64 = file.buffer.toString('base64');
        const mimeType = file.mimetype;
        const insertResult = await (0, db_1.execute)(`INSERT INTO lab_results (
        user_id, upload_filename, file_url, file_type, lab_date, status,
        family_history, accident_history, serious_illness_history,
        is_smoker, smoking_duration, drinks_alcohol, alcohol_duration,
        ktp_number
      ) VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?, ?, ?)`, [
            req.user.id, file.originalname, `/uploads/labs/${filename}`,
            ext === 'pdf' ? 'pdf' : 'image', lab_date || null,
            family_history || null, accident_history || null, serious_illness_history || null,
            is_smoker === 'true' ? 1 : 0, smoking_duration || null,
            drinks_alcohol === 'true' ? 1 : 0, alcohol_duration || null,
            ktp_number || null
        ]);
        const labResultId = insertResult.insertId;
        let extractedValues = {};
        let status = 'ideal';
        let recommendation = 'none';
        try {
            extractedValues = await parseLabWithGemini(base64, mimeType);
            let hasAbnormal = false;
            for (const [key, value] of Object.entries(extractedValues)) {
                const ref = REFERENCE_RANGES[key];
                if (!ref)
                    continue;
                const pStatus = value < ref.min ? 'low' : value > ref.max ? 'high' : 'normal';
                if (pStatus !== 'normal')
                    hasAbnormal = true;
                await (0, db_1.execute)(`INSERT INTO lab_parameters (lab_result_id, param_key, param_label, value, unit, normal_min, normal_max, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [labResultId, key, ref.label, value, ref.unit, ref.min, ref.max, pStatus]);
            }
            if (hasAbnormal) {
                status = 'needs_program';
                recommendation = 'mandatory';
            }
            else {
                // Logic for good lab results but have risk factors
                const smoker = is_smoker === 'true' || is_smoker === 1;
                const drinker = drinks_alcohol === 'true' || drinks_alcohol === 1;
                const familyRisk = !!family_history;
                const seriousRisk = !!serious_illness_history;
                if (smoker || drinker) {
                    status = 'needs_program';
                    recommendation = 'mandatory';
                }
                else if (familyRisk || seriousRisk) {
                    status = 'needs_program';
                    recommendation = 'recommended';
                }
                else {
                    status = 'ideal';
                    recommendation = 'none';
                }
            }
            await (0, db_1.execute)('UPDATE lab_results SET status = ?, recommendation = ?, ai_raw_response = ? WHERE id = ?', [status, recommendation, JSON.stringify(extractedValues), labResultId]);
        }
        catch (e) {
            status = 'needs_program';
            await (0, db_1.execute)('UPDATE lab_results SET status = ? WHERE id = ?', [status, labResultId]);
        }
        res.json({
            success: true,
            labResultId,
            status,
            recommendation,
            message: recommendation === 'mandatory' ? 'Wajib mengikuti program wellness' :
                recommendation === 'recommended' ? 'Dianjurkan mengikuti program wellness' :
                    'Kondisi Anda ideal'
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function getLatestLab(req, res) {
    if (!req.user)
        return res.status(401).send();
    const labResult = await (0, db_1.queryOne)('SELECT * FROM lab_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.id]);
    if (!labResult)
        return res.json({ labResult: null, parameters: [] });
    const parameters = await (0, db_1.query)('SELECT * FROM lab_parameters WHERE lab_result_id = ?', [labResult.id]);
    res.json({ labResult, parameters });
}
async function getLabById(req, res) {
    if (!req.user)
        return res.status(401).send();
    const labResult = await (0, db_1.queryOne)('SELECT * FROM lab_results WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!labResult)
        return res.status(404).json({ error: 'Not found' });
    const parameters = await (0, db_1.query)('SELECT * FROM lab_parameters WHERE lab_result_id = ?', [labResult.id]);
    res.json({ labResult, parameters });
}
async function extractLab(req, res) {
    try {
        const file = req.file;
        if (!file || !req.user)
            return res.status(400).json({ error: 'File and Authenticated user required' });
        const base64 = file.buffer.toString('base64');
        const mimeType = file.mimetype;
        const extractedValues = await parseLabWithGemini(base64, mimeType);
        res.json({ success: true, parameters: extractedValues });
    }
    catch (error) {
        console.error('[EXTRACT LAB ERROR]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function saveManualLab(req, res) {
    try {
        if (!req.user)
            return res.status(401).send();
        const { lab_date, parameters, family_history, accident_history, serious_illness_history, is_smoker, smoking_duration, drinks_alcohol, alcohol_duration, ktp_number } = req.body;
        const insertResult = await (0, db_1.execute)(`INSERT INTO lab_results (
        user_id, lab_date, status, recommendation,
        family_history, accident_history, serious_illness_history,
        is_smoker, smoking_duration, drinks_alcohol, alcohol_duration,
        ktp_number
      ) VALUES (?, ?, 'processing', 'none', ?, ?, ?, ?, ?, ?, ?, ?)`, [
            req.user.id, lab_date || null,
            family_history || null, accident_history || null, serious_illness_history || null,
            is_smoker === 'true' || is_smoker === true ? 1 : 0, smoking_duration || null,
            drinks_alcohol === 'true' || drinks_alcohol === true ? 1 : 0, alcohol_duration || null,
            ktp_number || null
        ]);
        const labResultId = insertResult.insertId;
        let hasAbnormal = false;
        for (const [key, valueStr] of Object.entries(parameters || {})) {
            const value = parseFloat(valueStr);
            if (isNaN(value))
                continue;
            const ref = REFERENCE_RANGES[key];
            if (!ref)
                continue;
            const pStatus = value < ref.min ? 'low' : value > ref.max ? 'high' : 'normal';
            if (pStatus !== 'normal' && key !== 'berat_badan' && key !== 'tinggi_badan') {
                hasAbnormal = true;
            }
            await (0, db_1.execute)(`INSERT INTO lab_parameters (lab_result_id, param_key, param_label, value, unit, normal_min, normal_max, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [labResultId, key, ref.label, value, ref.unit, ref.min, ref.max, pStatus]);
        }
        let status = 'ideal';
        let recommendation = 'none';
        if (hasAbnormal) {
            status = 'needs_program';
            recommendation = 'mandatory';
        }
        else {
            const smoker = is_smoker === 'true' || is_smoker === true || is_smoker === 1;
            const drinker = drinks_alcohol === 'true' || drinks_alcohol === true || drinks_alcohol === 1;
            const familyRisk = !!family_history;
            const seriousRisk = !!serious_illness_history;
            if (smoker || drinker) {
                status = 'needs_program';
                recommendation = 'mandatory';
            }
            else if (familyRisk || seriousRisk) {
                status = 'needs_program';
                recommendation = 'recommended';
            }
        }
        await (0, db_1.execute)('UPDATE lab_results SET status = ?, recommendation = ? WHERE id = ?', [status, recommendation, labResultId]);
        // If there is a requested program, update it to use this new lab result
        await (0, db_1.execute)('UPDATE wellness_programs SET lab_result_id = ? WHERE user_id = ? AND status = \'requested\'', [labResultId, req.user.id]);
        res.json({ success: true, labResultId, status, recommendation });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
