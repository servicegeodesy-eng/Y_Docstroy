import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const caCertPath = path.join(__dirname, '../../certs/CA.pem');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  statement_timeout: 10000,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.existsSync(caCertPath)
      ? fs.readFileSync(caCertPath, 'utf-8')
      : undefined,
  },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
