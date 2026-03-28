/**
 * Миграция данных: Supabase → Yandex PostgreSQL
 * Запуск: node sql/migrate.js
 * Требования: npm install pg (уже есть в server/node_modules)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Принудительно IPv4 для всех подключений
dns.setDefaultResultOrder('ipv4first');

// === НАСТРОЙКИ ===
const caCertPath = path.join(__dirname, '..', 'server', 'certs', 'CA.pem');

// Supabase Pooler (Transaction mode, порт 6543)
const supabase = new Pool({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.jbjnqjedqumzkxcfmeyo',
  password: '1QwertYqazxswEdCbnj',
  ssl: { rejectUnauthorized: false },
  // Таймаут подключения 15 секунд
  connectionTimeoutMillis: 15000,
});

const yandex = new Pool({
  host: 'rc1b-dodaeuotgajif7fu.mdb.yandexcloud.net',
  port: 6432,
  database: 'docstroy',
  user: 'docstroy_admin',
  password: 'D0c$tr0Y',
  ssl: {
    rejectUnauthorized: true,
    ca: fs.existsSync(caCertPath) ? fs.readFileSync(caCertPath, 'utf-8') : undefined,
  },
});

// Таблицы в порядке зависимостей (родительские первыми)
const TABLES = [
  'projects',
  'project_organizations',
  'project_members',
  'project_statuses',
  'status_role_assignments',
  'portal_role_permissions',
  'user_permissions',
  'cell_action_permissions',
  'dict_buildings',
  'dict_floors',
  'dict_constructions',
  'dict_work_types',
  'dict_work_stages',
  'dict_sets',
  'dict_overlays',
  'dict_works',
  'dict_building_work_types',
  'dict_work_stage_buildings',
  'dict_work_stage_work_types',
  'dict_work_type_constructions',
  'dict_work_type_floors',
  'dict_work_type_overlays',
  'dict_work_type_sets',
  'dict_overlay_buildings',
  'dict_overlay_constructions',
  'dict_overlay_floors',
  'dict_overlay_works',
  'dict_building_floors',
  'dict_building_work_type_floors',
  'dict_axis_grids',
  'dict_axis_grid_axes',
  'dict_overlay_axis_grids',
  'overlay_axis_points',
  'cells',
  'cell_files',
  'cell_file_versions',
  'cell_comments',
  'cell_comment_files',
  'cell_public_comments',
  'cell_history',
  'cell_shares',
  'cell_signatures',
  'cell_archives',
  'cell_overlay_masks',
  'gro_cells',
  'gro_cell_files',
  'gro_cell_file_versions',
  'support_messages',
  'support_message_files',
  'support_blocked_users',
  'support_read_status',
  'file_shares',
  'file_share_recipients',
  'file_share_files',
  'file_share_overlay_masks',
  'push_subscriptions',
  'notifications',
];

async function migrateTable(tableName, sourcePool, destPool) {
  const { rows } = await sourcePool.query(`SELECT * FROM public."${tableName}"`);
  if (rows.length === 0) {
    console.log(`  ⏭ ${tableName}: пусто`);
    return 0;
  }

  const columns = Object.keys(rows[0]);
  const quotedCols = columns.map(c => `"${c}"`).join(', ');

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map(c => row[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    try {
      await destPool.query(
        `INSERT INTO "${tableName}" (${quotedCols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values
      );
      inserted++;
    } catch (err) {
      console.error(`  ✗ ${tableName} ошибка строки:`, err.message);
    }
  }

  console.log(`  ✓ ${tableName}: ${inserted}/${rows.length}`);
  return inserted;
}

async function main() {
  console.log('=== Миграция Supabase → Yandex PostgreSQL ===\n');

  // Проверка подключений
  try {
    await supabase.query('SELECT 1');
    console.log('✓ Supabase: подключено');
  } catch (err) {
    console.error('✗ Supabase: не удалось подключиться:', err.message);
    process.exit(1);
  }

  try {
    await yandex.query('SELECT 1');
    console.log('✓ Yandex: подключено');
  } catch (err) {
    console.error('✗ Yandex: не удалось подключиться:', err.message);
    process.exit(1);
  }

  // Отключить триггеры на время импорта
  await yandex.query("SET session_replication_role = 'replica'");
  console.log('\n⚙ Триггеры отключены\n');

  // === Шаг 1: users (auth.users + profiles) ===
  console.log('--- Шаг 1: users ---');
  const { rows: users } = await supabase.query(`
    SELECT
      p.id, p.email, u.encrypted_password AS password_hash,
      p.last_name, p.first_name, p.middle_name,
      p.structure, p.organization, p.position, p.phone,
      p.is_portal_admin, p.is_global_reader, p.must_change_password,
      p.created_at, p.updated_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
  `);

  let usersInserted = 0;
  for (const u of users) {
    try {
      await yandex.query(`
        INSERT INTO users (id, email, password_hash, last_name, first_name, middle_name,
          structure, organization, position, phone,
          is_portal_admin, is_global_reader, must_change_password, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO NOTHING
      `, [
        u.id, u.email, u.password_hash,
        u.last_name, u.first_name, u.middle_name || null,
        u.structure, u.organization, u.position, u.phone || null,
        u.is_portal_admin || false, u.is_global_reader || false, u.must_change_password || false,
        u.created_at, u.updated_at,
      ]);
      usersInserted++;
    } catch (err) {
      console.error(`  ✗ user ${u.email}:`, err.message);
    }
  }
  console.log(`  ✓ users: ${usersInserted}/${users.length}\n`);

  // === Шаг 2: все остальные таблицы ===
  console.log('--- Шаг 2: таблицы ---');
  let totalTables = 0;
  let totalRows = 0;

  for (const table of TABLES) {
    try {
      const count = await migrateTable(table, supabase, yandex);
      totalRows += count;
      totalTables++;
    } catch (err) {
      console.error(`  ✗ ${table}: ${err.message}`);
    }
  }

  // Включить триггеры обратно
  await yandex.query("SET session_replication_role = 'origin'");
  console.log('\n⚙ Триггеры включены');

  console.log(`\n=== Готово! ===`);
  console.log(`Пользователей: ${usersInserted}`);
  console.log(`Таблиц: ${totalTables}`);
  console.log(`Строк: ${totalRows}`);

  // Проверка
  const { rows: check } = await yandex.query('SELECT count(*)::int AS c FROM users');
  console.log(`\nПроверка: ${check[0].c} пользователей в Yandex БД`);

  await supabase.end();
  await yandex.end();
}

main().catch(err => {
  console.error('Фатальная ошибка:', err);
  process.exit(1);
});
