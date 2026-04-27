import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wellness_app'
  });

  try {
    console.log('Starting detailed logs migration...');

    // 1. Alter daily_logs
    try {
      await connection.execute('ALTER TABLE daily_logs ADD COLUMN stress_level TINYINT DEFAULT 5 AFTER mood');
      console.log('Added stress_level to daily_logs');
    } catch (e: any) {
      if (!e.message.includes('Duplicate column')) console.error(e);
    }

    // 2. Create meal_logs
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS meal_logs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        daily_log_id INT UNSIGNED NOT NULL,
        meal_time ENUM('sarapan', 'makan siang', 'makan malam', 'snack') NOT NULL,
        food_name VARCHAR(255) NOT NULL,
        calories INT DEFAULT 0,
        protein_g DECIMAL(5,2) DEFAULT 0,
        fat_g DECIMAL(5,2) DEFAULT 0,
        carbs_g DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created meal_logs table');

    // 3. Create water_logs
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS water_logs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        daily_log_id INT UNSIGNED NOT NULL,
        amount_ml INT NOT NULL,
        time_logged TIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created water_logs table');

    // 4. Create exercise_logs
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS exercise_logs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        daily_log_id INT UNSIGNED NOT NULL,
        activity_type VARCHAR(100) NOT NULL,
        duration_minutes INT NOT NULL,
        calories_burned INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created exercise_logs table');

    console.log('Migration completed successfully!');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await connection.end();
  }
}

run();
