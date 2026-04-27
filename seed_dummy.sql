-- Seed dummy lab result for Budi Santoso (ID 5)
INSERT INTO lab_results (user_id, lab_date, status, notes) 
VALUES (5, CURDATE(), 'needs_program', 'Hasil medical checkup menunjukkan beberapa parameter di luar batas normal.');

-- Get the ID of the inserted lab result
SET @last_id = LAST_INSERT_ID();

-- Insert lab parameters
INSERT INTO lab_parameters (lab_result_id, param_key, param_label, value, unit, normal_min, normal_max, status) VALUES
(@last_id, 'gula_darah_puasa', 'Gula Darah Puasa', 115.0, 'mg/dL', 70.0, 100.0, 'high'),
(@last_id, 'kolesterol_total', 'Kolesterol Total', 210.0, 'mg/dL', 0.0, 200.0, 'high'),
(@last_id, 'tekanan_sistolik', 'Tekanan Darah Sistolik', 140.0, 'mmHg', 90.0, 130.0, 'high'),
(@last_id, 'ldl', 'LDL (Kolesterol Jahat)', 145.0, 'mg/dL', 0.0, 130.0, 'high');
