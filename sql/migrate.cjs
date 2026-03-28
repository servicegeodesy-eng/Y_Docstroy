/**
 * Миграция данных: Supabase (REST API) → Yandex PostgreSQL
 * Запуск: node sql/migrate.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// === НАСТРОЙКИ ===
const SUPABASE_URL = 'https://jbjnqjedqumzkxcfmeyo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impiam5xamVkcXVtemt4Y2ZtZXlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODkyNjM3MCwiZXhwIjoyMDU0NTAyMzcwfQ.RDPOh84kJXecF1IjbZBvn0YMSh_2y2jEMJjBpg2HYXU';
// ↑ Возьми из Supabase Dashboard → Settings → API → service_role key
// Если ключ неверный — замени на правильный

const caCertPath = path.join(__dirname, '..', 'server', 'certs', 'CA.pem');

const yandex = new Pool({
  host: 'rc1b-dodaeuotgajif7fu.mdb.yandexcloud.net',
  port: 6432,
  database: 'docstroy',
  user: 'docstroy_admin',
  password: 'BntU114338',
  ssl: {
    rejectUnauthorized: true,
    ca: fs.existsSync(caCertPath) ? fs.readFileSync(caCertPath, 'utf-8') : undefined,
  },
});

// ============================================================================
// Supabase REST API helper
// ============================================================================

async function supabaseQuery(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}&limit=10000`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${table}: ${res.status} ${text}`);
  }
  return res.json();
}

// Таблицы в порядке зависимостей
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

async function migrateTable(tableName) {
  const rows = await supabaseQuery(tableName, 'select=*');
  if (!rows || rows.length === 0) {
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
      await yandex.query(
        `INSERT INTO "${tableName}" (${quotedCols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values
      );
      inserted++;
    } catch (err) {
      if (inserted === 0) console.error(`  ✗ ${tableName} ошибка:`, err.message);
    }
  }

  console.log(`  ✓ ${tableName}: ${inserted}/${rows.length}`);
  return inserted;
}

async function main() {
  console.log('=== Миграция Supabase → Yandex PostgreSQL ===\n');

  // Проверка Supabase REST API
  try {
    const test = await supabaseQuery('profiles', 'select=id&limit=1');
    console.log(`✓ Supabase REST API: подключено (${test.length >= 0 ? 'ОК' : 'пусто'})`);
  } catch (err) {
    console.error('✗ Supabase:', err.message);
    console.error('\n→ Проверь SUPABASE_SERVICE_KEY в sql/migrate.cjs');
    console.error('  Взять: Supabase Dashboard → Settings → API → service_role (secret)');
    process.exit(1);
  }

  // Проверка Yandex
  try {
    await yandex.query('SELECT 1');
    console.log('✓ Yandex: подключено');
  } catch (err) {
    console.error('✗ Yandex:', err.message);
    process.exit(1);
  }

  // Отключить seed-триггеры
  const TRIGGERS_OFF = [
    'ALTER TABLE projects DISABLE TRIGGER trg_project_created_seed_statuses',
    'ALTER TABLE projects DISABLE TRIGGER trg_project_created_seed_dictionaries',
    'ALTER TABLE project_statuses DISABLE TRIGGER trg_seed_cap_on_status',
    'ALTER TABLE users DISABLE TRIGGER protect_user_fields_trigger',
  ];
  for (const sql of TRIGGERS_OFF) {
    try { await yandex.query(sql); } catch (e) { console.log(`  ⚠ ${e.message}`); }
  }
  console.log('\n⚙ Seed-триггеры отключены\n');

  // === Шаг 1: users из profiles ===
  console.log('--- Шаг 1: users ---');
  const profiles = await supabaseQuery('profiles', 'select=*');
  console.log(`  Получено ${profiles.length} профилей`);

  const TEMP_HASH = '$2a$12$LJ3m4ys2Y8EElyBGOCHrTe5OwUjHVe/XPyGi/dGDlr0YphFOGmjWq'; // "changeme123"
  let usersInserted = 0;

  for (const p of profiles) {
    try {
      await yandex.query(`
        INSERT INTO users (id, email, password_hash, last_name, first_name, middle_name,
          structure, organization, position, phone,
          is_portal_admin, is_global_reader, must_change_password, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO NOTHING
      `, [
        p.id, p.email, TEMP_HASH,
        p.last_name, p.first_name, p.middle_name || null,
        p.structure, p.organization, p.position, p.phone || null,
        p.is_portal_admin || false, p.is_global_reader || false, true,
        p.created_at, p.updated_at,
      ]);
      usersInserted++;
    } catch (err) {
      console.error(`  ✗ user ${p.email}:`, err.message);
    }
  }
  console.log(`  ✓ users: ${usersInserted}/${profiles.length}\n`);

  // === Шаг 2: все остальные таблицы ===
  console.log('--- Шаг 2: таблицы ---');
  let totalRows = 0;

  for (const table of TABLES) {
    try {
      const count = await migrateTable(table);
      totalRows += count;
    } catch (err) {
      console.error(`  ✗ ${table}: ${err.message}`);
    }
  }

  // Включить триггеры обратно
  const TRIGGERS_ON = [
    'ALTER TABLE projects ENABLE TRIGGER trg_project_created_seed_statuses',
    'ALTER TABLE projects ENABLE TRIGGER trg_project_created_seed_dictionaries',
    'ALTER TABLE project_statuses ENABLE TRIGGER trg_seed_cap_on_status',
    'ALTER TABLE users ENABLE TRIGGER protect_user_fields_trigger',
  ];
  for (const sql of TRIGGERS_ON) {
    try { await yandex.query(sql); } catch (e) { /* ignore */ }
  }
  console.log('\n⚙ Триггеры включены');

  // Проверка
  const { rows: check } = await yandex.query('SELECT count(*)::int AS c FROM users');
  console.log(`\n=== Готово! Users: ${check[0].c}, строк: ${totalRows} ===`);

  await yandex.end();
}

main().catch(err => {
  console.error('Фатальная ошибка:', err.message);
  process.exit(1);
});
