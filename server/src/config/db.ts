import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Ищем CA.pem в нескольких местах
const possiblePaths = [
  path.join(__dirname, '../../certs/CA.pem'),       // dist/config → certs/
  path.join(process.cwd(), 'server/certs/CA.pem'),  // корень проекта
  path.join(process.cwd(), 'certs/CA.pem'),          // server/
];
const caCertPath = possiblePaths.find(p => fs.existsSync(p));
const caCert = caCertPath ? fs.readFileSync(caCertPath, 'utf-8') : undefined;

if (caCert && caCertPath) {
  // Установить NODE_EXTRA_CA_CERTS для Node.js TLS (pg использует его)
  process.env.NODE_EXTRA_CA_CERTS = caCertPath;
  console.log(`DB SSL: CA.pem loaded from ${caCertPath}`);
} else {
  console.log('DB SSL: CA.pem not found, using rejectUnauthorized=false');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  statement_timeout: 10000,
  ssl: {
    rejectUnauthorized: false,
    ca: caCert || undefined,
  },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
