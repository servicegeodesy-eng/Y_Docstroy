/**
 * Скрипт миграции файлов из legacy-бакетов в единый бакет с префиксами компании.
 *
 * Что делает:
 * 1. Находит все файлы в БД, у которых storage_path ещё в старом формате
 * 2. Копирует файл из старого бакета в новый (docstroy) с новым путём
 * 3. Обновляет storage_path в БД
 *
 * Запуск: node scripts/migrate_s3_files.mjs
 * Требует: .env файл в server/ с переменными S3 и DATABASE_URL
 *
 * ВАЖНО: запускать вручную, не автоматически!
 */

import { S3Client, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=verify-full')
    ? { rejectUnauthorized: true }
    : false,
});

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'ru-central1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
});

const NEW_BUCKET = process.env.S3_BUCKET || 'docstroy';

const LEGACY_BUCKETS = {
  'cell-files': process.env.S3_BUCKET_CELL_FILES || 'docstroy-cell-files',
  'overlay-images': process.env.S3_BUCKET_OVERLAY_IMAGES || 'docstroy-overlay-images',
  'project-images': process.env.S3_BUCKET_PROJECT_IMAGES || 'docstroy-project-images',
  'fileshare-files': process.env.S3_BUCKET_FILESHARE_FILES || 'docstroy-fileshare-files',
};

// Таблицы и их связь с бакетами и проектами
const FILE_TABLES = [
  {
    table: 'cell_files',
    pathCol: 'storage_path',
    legacyBucket: 'cell-files',
    // cell_files → cells → projects
    projectQuery: `
      SELECT cf.id, cf.storage_path, c.project_id, p.company_id
      FROM cell_files cf
      JOIN cells c ON c.id = cf.cell_id
      JOIN projects p ON p.id = c.project_id
      WHERE cf.storage_path NOT LIKE '%/projects/%'
    `,
    newPathFn: (row) => `${row.company_id}/projects/${row.project_id}/cells/${row.storage_path}`,
  },
  {
    table: 'cell_file_versions',
    pathCol: 'storage_path',
    legacyBucket: 'cell-files',
    projectQuery: `
      SELECT cfv.id, cfv.storage_path, c.project_id, p.company_id
      FROM cell_file_versions cfv
      JOIN cell_files cf ON cf.id = cfv.cell_file_id
      JOIN cells c ON c.id = cf.cell_id
      JOIN projects p ON p.id = c.project_id
      WHERE cfv.storage_path NOT LIKE '%/projects/%'
    `,
    newPathFn: (row) => `${row.company_id}/projects/${row.project_id}/cells/versions/${row.storage_path}`,
  },
  {
    table: 'cell_comment_files',
    pathCol: 'storage_path',
    legacyBucket: 'cell-files',
    projectQuery: `
      SELECT ccf.id, ccf.storage_path, c.project_id, p.company_id
      FROM cell_comment_files ccf
      JOIN cell_comments cc ON cc.id = ccf.comment_id
      JOIN cells c ON c.id = cc.cell_id
      JOIN projects p ON p.id = c.project_id
      WHERE ccf.storage_path NOT LIKE '%/projects/%'
    `,
    newPathFn: (row) => `${row.company_id}/projects/${row.project_id}/cells/comments/${row.storage_path}`,
  },
  {
    table: 'dict_overlays',
    pathCol: 'storage_path',
    legacyBucket: 'overlay-images',
    projectQuery: `
      SELECT d.id, d.storage_path, d.project_id, p.company_id
      FROM dict_overlays d
      JOIN projects p ON p.id = d.project_id
      WHERE d.storage_path NOT LIKE '%/projects/%'
    `,
    newPathFn: (row) => `${row.company_id}/projects/${row.project_id}/overlays/${row.storage_path}`,
  },
  {
    table: 'gro_cell_files',
    pathCol: 'storage_path',
    legacyBucket: 'cell-files',
    projectQuery: `
      SELECT gcf.id, gcf.storage_path, gc.project_id, p.company_id
      FROM gro_cell_files gcf
      JOIN gro_cells gc ON gc.id = gcf.gro_cell_id
      JOIN projects p ON p.id = gc.project_id
      WHERE gcf.storage_path NOT LIKE '%/projects/%'
    `,
    newPathFn: (row) => `${row.company_id}/projects/${row.project_id}/gro/${row.storage_path}`,
  },
  {
    table: 'gro_cell_file_versions',
    pathCol: 'storage_path',
    legacyBucket: 'cell-files',
    projectQuery: `
      SELECT gfv.id, gfv.storage_path, gc.project_id, p.company_id
      FROM gro_cell_file_versions gfv
      JOIN gro_cell_files gcf ON gcf.id = gfv.file_id
      JOIN gro_cells gc ON gc.id = gcf.gro_cell_id
      JOIN projects p ON p.id = gc.project_id
      WHERE gfv.storage_path NOT LIKE '%/projects/%'
    `,
    newPathFn: (row) => `${row.company_id}/projects/${row.project_id}/gro/versions/${row.storage_path}`,
  },
  {
    table: 'file_share_files',
    pathCol: 'storage_path',
    legacyBucket: 'fileshare-files',
    projectQuery: `
      SELECT fsf.id, fsf.storage_path, fs.project_id, p.company_id
      FROM file_share_files fsf
      JOIN file_shares fs ON fs.id = fsf.file_share_id
      JOIN projects p ON p.id = fs.project_id
      WHERE fsf.storage_path NOT LIKE '%/projects/%'
    `,
    newPathFn: (row) => `${row.company_id}/projects/${row.project_id}/fileshare/${row.storage_path}`,
  },
  {
    table: 'support_message_files',
    pathCol: 'storage_path',
    legacyBucket: 'cell-files',
    projectQuery: `
      SELECT smf.id, smf.storage_path, sm.project_id, p.company_id
      FROM support_message_files smf
      JOIN support_messages sm ON sm.id = smf.message_id
      JOIN projects p ON p.id = sm.project_id
      WHERE smf.storage_path NOT LIKE '%/projects/%'
    `,
    newPathFn: (row) => `${row.company_id}/projects/${row.project_id}/support/${row.storage_path}`,
  },
];

let stats = { total: 0, copied: 0, updated: 0, errors: 0, skipped: 0 };

async function fileExists(bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copyFile(srcBucket, srcKey, dstBucket, dstKey) {
  await s3.send(new CopyObjectCommand({
    Bucket: dstBucket,
    Key: dstKey,
    CopySource: encodeURIComponent(`${srcBucket}/${srcKey}`),
  }));
}

async function migrateTable(config) {
  const { table, pathCol, legacyBucket, projectQuery, newPathFn } = config;
  const srcBucket = LEGACY_BUCKETS[legacyBucket];

  console.log(`\n--- ${table} (${srcBucket} → ${NEW_BUCKET}) ---`);

  const { rows } = await pool.query(projectQuery);
  console.log(`  Найдено ${rows.length} файлов для миграции`);

  for (const row of rows) {
    stats.total++;
    const oldPath = row.storage_path;
    const newPath = newPathFn(row);

    try {
      // Проверяем существование исходного файла
      const exists = await fileExists(srcBucket, oldPath);
      if (!exists) {
        console.log(`  [SKIP] ${oldPath} — не найден в ${srcBucket}`);
        stats.skipped++;
        // Всё равно обновляем путь в БД (файл мог быть удалён)
        await pool.query(
          `UPDATE ${table} SET ${pathCol} = $1 WHERE id = $2`,
          [newPath, row.id]
        );
        stats.updated++;
        continue;
      }

      // Копируем
      await copyFile(srcBucket, oldPath, NEW_BUCKET, newPath);
      stats.copied++;

      // Обновляем путь в БД
      await pool.query(
        `UPDATE ${table} SET ${pathCol} = $1 WHERE id = $2`,
        [newPath, row.id]
      );
      stats.updated++;

      if (stats.total % 100 === 0) {
        console.log(`  ... обработано ${stats.total} файлов`);
      }
    } catch (err) {
      console.error(`  [ERROR] ${oldPath}: ${err.message}`);
      stats.errors++;
    }
  }
}

async function main() {
  console.log('=== Миграция файлов S3 ===');
  console.log(`Целевой бакет: ${NEW_BUCKET}`);
  console.log(`Legacy-бакеты:`, LEGACY_BUCKETS);

  // Проверяем что все проекты имеют company_id
  const { rows: orphans } = await pool.query(
    'SELECT id, name FROM projects WHERE company_id IS NULL'
  );
  if (orphans.length > 0) {
    console.error('\nОШИБКА: Есть проекты без company_id:');
    orphans.forEach(p => console.error(`  - ${p.name} (${p.id})`));
    console.error('Сначала выполните миграцию 004_projects_to_companies.sql');
    process.exit(1);
  }

  for (const config of FILE_TABLES) {
    await migrateTable(config);
  }

  console.log('\n=== Итоги ===');
  console.log(`Всего файлов: ${stats.total}`);
  console.log(`Скопировано: ${stats.copied}`);
  console.log(`Обновлено в БД: ${stats.updated}`);
  console.log(`Пропущено (не найдены): ${stats.skipped}`);
  console.log(`Ошибок: ${stats.errors}`);

  await pool.end();
}

main().catch(err => {
  console.error('Фатальная ошибка:', err);
  process.exit(1);
});
