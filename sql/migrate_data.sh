#!/usr/bin/env bash
# ============================================================================
# Миграция данных: Supabase → Yandex PostgreSQL
# ============================================================================
# Использование:
#   1. Установи переменные SUPABASE_URL и YANDEX_URL ниже
#   2. Запусти: bash sql/migrate_data.sh
# ============================================================================

set -euo pipefail

# === НАСТРОЙКИ — заполни перед запуском ===
SUPABASE_URL="postgresql://postgres.jbjnqjedqumzkxcfmeyo:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
YANDEX_URL="postgresql://user:password@host:6432/dbname?sslmode=verify-full"

DUMP_DIR="./sql/dump"
mkdir -p "$DUMP_DIR"

echo "=== Шаг 1: Экспорт users (auth.users + profiles) ==="
psql "$SUPABASE_URL" -t -A -c "
  COPY (
    SELECT
      p.id, p.email, u.encrypted_password AS password_hash,
      p.last_name, p.first_name, p.middle_name,
      p.structure, p.organization, p.position, p.phone,
      p.is_portal_admin, p.is_global_reader, p.must_change_password,
      p.created_at, p.updated_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
  ) TO STDOUT WITH (FORMAT csv, HEADER true)
" > "$DUMP_DIR/users.csv"
echo "  → users.csv: $(wc -l < "$DUMP_DIR/users.csv") строк"

echo "=== Шаг 2: Экспорт остальных таблиц ==="

TABLES=(
  projects
  project_organizations
  project_members
  project_statuses
  status_role_assignments
  portal_role_permissions
  user_permissions
  cell_action_permissions
  dict_buildings
  dict_floors
  dict_constructions
  dict_work_types
  dict_work_stages
  dict_sets
  dict_overlays
  dict_works
  dict_building_work_types
  dict_work_stage_buildings
  dict_work_stage_work_types
  dict_work_type_constructions
  dict_work_type_floors
  dict_work_type_overlays
  dict_work_type_sets
  dict_overlay_buildings
  dict_overlay_constructions
  dict_overlay_floors
  dict_overlay_works
  dict_building_floors
  dict_building_work_type_floors
  dict_axis_grids
  dict_axis_grid_axes
  dict_overlay_axis_grids
  overlay_axis_points
  cells
  cell_files
  cell_file_versions
  cell_comments
  cell_comment_files
  cell_public_comments
  cell_history
  cell_shares
  cell_signatures
  cell_archives
  cell_overlay_masks
  gro_cells
  gro_cell_files
  gro_cell_file_versions
  support_messages
  support_message_files
  support_blocked_users
  support_read_status
  file_shares
  file_share_recipients
  file_share_files
  file_share_overlay_masks
  push_subscriptions
  notifications
)

for table in "${TABLES[@]}"; do
  psql "$SUPABASE_URL" -c "\COPY public.${table} TO '$DUMP_DIR/${table}.csv' WITH (FORMAT csv, HEADER true)" 2>/dev/null || echo "  ⚠ $table: пропущена (не существует или пустая)"
  if [ -f "$DUMP_DIR/${table}.csv" ]; then
    count=$(tail -n +2 "$DUMP_DIR/${table}.csv" | wc -l)
    echo "  → ${table}.csv: $count строк"
  fi
done

echo ""
echo "=== Шаг 3: Импорт в Yandex PostgreSQL ==="
echo "Отключаем триггеры на время импорта..."

# Импорт users первыми (остальные таблицы ссылаются на них)
psql "$YANDEX_URL" <<'IMPORT_SQL'
-- Отключить триггеры на время импорта (чтобы seed-триггеры не сработали)
SET session_replication_role = 'replica';
IMPORT_SQL

echo "Импорт users..."
psql "$YANDEX_URL" -c "\COPY users(id, email, password_hash, last_name, first_name, middle_name, structure, organization, position, phone, is_portal_admin, is_global_reader, must_change_password, created_at, updated_at) FROM '$DUMP_DIR/users.csv' WITH (FORMAT csv, HEADER true)"

for table in "${TABLES[@]}"; do
  if [ -f "$DUMP_DIR/${table}.csv" ] && [ "$(wc -l < "$DUMP_DIR/${table}.csv")" -gt 1 ]; then
    echo "Импорт ${table}..."
    psql "$YANDEX_URL" -c "\COPY ${table} FROM '$DUMP_DIR/${table}.csv' WITH (FORMAT csv, HEADER true)" 2>/dev/null || echo "  ⚠ ${table}: ошибка импорта"
  fi
done

# Включить триггеры обратно
psql "$YANDEX_URL" -c "SET session_replication_role = 'origin';"

echo ""
echo "=== Готово! ==="
echo "Проверь данные: psql $YANDEX_URL -c 'SELECT count(*) FROM users;'"
