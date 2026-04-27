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
    const [rows] = await connection.execute('SHOW CREATE TABLE daily_logs');
    console.log((rows as any)[0]['Create Table']);
  } catch (e) {
    console.error(e);
  } finally {
    await connection.end();
  }
}

run();
