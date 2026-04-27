import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wellness_app'
  });

  try {
    console.log('Adding ktp_number to lab_results...');
    await connection.execute('ALTER TABLE lab_results ADD COLUMN ktp_number VARCHAR(20) AFTER alcohol_duration');
    console.log('Success!');
  } catch (e) {
    console.error('Failed or already exists:', e);
  } finally {
    await connection.end();
  }
}

run();
