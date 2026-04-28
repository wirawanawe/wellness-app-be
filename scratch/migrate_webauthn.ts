
import { execute } from '../src/db';

async function migrate() {
  try {
    console.log('Creating webauthn_credentials table...');
    await execute(`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        credential_id VARCHAR(512) NOT NULL,
        public_key TEXT NOT NULL,
        counter INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(credential_id)
      )
    `);
    await execute(`
      CREATE TABLE IF NOT EXISTS webauthn_challenges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        challenge VARCHAR(512) NOT NULL,
        user_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tables created successfully.');

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
