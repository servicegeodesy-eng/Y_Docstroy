/**
 * Копирование файлов: Supabase Storage → Yandex S3
 * Запуск: node sql/copy_files.cjs
 *
 * Supabase НЕ изменяется — только чтение.
 * Файлы копируются с теми же путями (storage_path).
 */

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// === НАСТРОЙКИ ===

// === ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ===
// Создай файл sql/.env с содержимым:
//   SUPABASE_URL=https://jbjnqjedqumzkxcfmeyo.supabase.co
//   SUPABASE_KEY=your-service-role-key
//   S3_ACCESS_KEY=your-yandex-s3-access-key
//   S3_SECRET_KEY=your-yandex-s3-secret-key
//   DATABASE_URL=postgresql://user:pass@host:6432/db?sslmode=require&uselibpqcompat=true

// Загружаем .env
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Создай sql/.env с SUPABASE_URL и SUPABASE_KEY');
  process.exit(1);
}

// Yandex S3
const s3 = new S3Client({
  endpoint: 'https://storage.yandexcloud.net',
  region: 'ru-central1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
});

// Yandex PostgreSQL
const caCertPath = path.join(__dirname, '..', 'server', 'certs', 'CA.pem');
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    ca: fs.existsSync(caCertPath) ? fs.readFileSync(caCertPath, 'utf-8') : undefined,
  },
});

// Маппинг: Supabase bucket → Yandex bucket
const BUCKET_MAP = {
  'cell-files': 'docstroy-cell-files',
  'overlay-images': 'docstroy-overlay-images',
  'project-images': 'docstroy-project-images',
  'fileshare-files': 'docstroy-fileshare-files',
};

// ============================================================================
// Helpers
// ============================================================================

async function downloadFromSupabase(bucket, storagePath) {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(storagePath)}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase download ${res.status}: ${bucket}/${storagePath}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function fileExistsInS3(bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadToS3(bucket, key, data, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: contentType || 'application/octet-stream',
  }));
}

async function copyFile(supabaseBucket, storagePath, mimeType) {
  const yandexBucket = BUCKET_MAP[supabaseBucket];
  if (!yandexBucket) {
    console.log(`  ⚠ Неизвестный бакет: ${supabaseBucket}`);
    return false;
  }

  // Проверить — может уже скопирован
  const exists = await fileExistsInS3(yandexBucket, storagePath);
  if (exists) {
    return true; // уже есть
  }

  // Скачать из Supabase
  const data = await downloadFromSupabase(supabaseBucket, storagePath);

  // Загрузить в Yandex S3
  await uploadToS3(yandexBucket, storagePath, data, mimeType);
  return true;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== Копирование файлов: Supabase → Yandex S3 ===\n');

  // Проверка подключений
  try {
    await db.query('SELECT 1');
    console.log('✓ Yandex PostgreSQL: подключено');
  } catch (err) {
    console.error('✗ Yandex PostgreSQL:', err.message);
    process.exit(1);
  }

  // Собираем все файлы из БД
  const queries = [
    { name: 'cell_files', bucket: 'cell-files', sql: 'SELECT storage_path, mime_type FROM cell_files' },
    { name: 'cell_file_versions', bucket: 'cell-files', sql: 'SELECT storage_path, mime_type FROM cell_file_versions' },
    { name: 'cell_comment_files', bucket: 'cell-files', sql: 'SELECT storage_path, mime_type FROM cell_comment_files' },
    { name: 'dict_overlays', bucket: 'overlay-images', sql: 'SELECT storage_path FROM dict_overlays' },
    { name: 'file_share_files', bucket: 'fileshare-files', sql: 'SELECT storage_path, mime_type FROM file_share_files' },
    { name: 'gro_cell_files', bucket: 'cell-files', sql: 'SELECT storage_path, mime_type FROM gro_cell_files' },
    { name: 'gro_cell_file_versions', bucket: 'cell-files', sql: 'SELECT storage_path, mime_type FROM gro_cell_file_versions' },
    { name: 'support_message_files', bucket: 'cell-files', sql: 'SELECT storage_path, mime_type FROM support_message_files' },
  ];

  let totalCopied = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const q of queries) {
    console.log(`\n--- ${q.name} (${q.bucket}) ---`);
    const { rows } = await db.query(q.sql);

    if (rows.length === 0) {
      console.log('  Пусто');
      continue;
    }

    console.log(`  Файлов: ${rows.length}`);
    let copied = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const result = await copyFile(q.bucket, row.storage_path, row.mime_type);
        if (result) {
          copied++;
        }
      } catch (err) {
        errors++;
        if (errors <= 3) console.log(`  ✗ ${row.storage_path}: ${err.message}`);
      }

      // Прогресс каждые 10 файлов
      if ((copied + skipped + errors) % 10 === 0) {
        process.stdout.write(`  ${copied + skipped + errors}/${rows.length}\r`);
      }
    }

    console.log(`  ✓ Скопировано: ${copied}, пропущено (уже есть): ${skipped}, ошибок: ${errors}`);
    totalCopied += copied;
    totalSkipped += skipped;
    totalErrors += errors;
  }

  console.log(`\n=== Готово! Скопировано: ${totalCopied}, ошибок: ${totalErrors} ===`);

  await db.end();
}

main().catch(err => {
  console.error('Фатальная ошибка:', err.message);
  process.exit(1);
});
