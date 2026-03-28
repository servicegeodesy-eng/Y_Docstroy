-- ============================================================================
-- Экспорт ВСЕХ данных из Supabase PostgreSQL
-- Запусти этот скрипт в Supabase SQL Editor и скопируй результат
-- ============================================================================
-- Каждый SELECT возвращает одну строку с JSON-массивом всех записей таблицы.
-- Формат: table_name | data (JSON array)
-- Пустые таблицы вернут [].
-- ============================================================================

-- 1. Пользователи (из auth.users + profiles)
SELECT 'auth_users' AS table_name, COALESCE(json_agg(json_build_object(
  'id', u.id,
  'email', u.email,
  'encrypted_password', u.encrypted_password,
  'created_at', u.created_at
)), '[]'::json) AS data
FROM auth.users u;

SELECT 'profiles' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.profiles t;

-- 2. Проекты и организации
SELECT 'projects' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.projects t;
SELECT 'project_organizations' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.project_organizations t;
SELECT 'project_members' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.project_members t;

-- 3. Статусы и роли
SELECT 'project_statuses' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.project_statuses t;
SELECT 'status_role_assignments' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.status_role_assignments t;
SELECT 'portal_role_permissions' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.portal_role_permissions t;

-- 4. Права
SELECT 'user_permissions' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.user_permissions t;
SELECT 'cell_action_permissions' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_action_permissions t;

-- 5. Справочники
SELECT 'dict_buildings' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_buildings t;
SELECT 'dict_floors' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_floors t;
SELECT 'dict_constructions' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_constructions t;
SELECT 'dict_work_types' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_work_types t;
SELECT 'dict_work_stages' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_work_stages t;
SELECT 'dict_sets' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_sets t;
SELECT 'dict_overlays' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_overlays t;
SELECT 'dict_works' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_works t;

-- 6. Связи справочников
SELECT 'dict_building_work_types' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_building_work_types t;
SELECT 'dict_work_stage_buildings' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_work_stage_buildings t;
SELECT 'dict_work_stage_work_types' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_work_stage_work_types t;
SELECT 'dict_work_type_constructions' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_work_type_constructions t;
SELECT 'dict_work_type_floors' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_work_type_floors t;
SELECT 'dict_work_type_overlays' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_work_type_overlays t;
SELECT 'dict_work_type_sets' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_work_type_sets t;
SELECT 'dict_overlay_buildings' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_overlay_buildings t;
SELECT 'dict_overlay_constructions' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_overlay_constructions t;
SELECT 'dict_overlay_floors' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_overlay_floors t;
SELECT 'dict_overlay_works' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_overlay_works t;
SELECT 'dict_building_floors' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_building_floors t;
SELECT 'dict_building_work_type_floors' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_building_work_type_floors t;

-- 7. Оси
SELECT 'dict_axis_grids' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_axis_grids t;
SELECT 'dict_axis_grid_axes' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_axis_grid_axes t;
SELECT 'dict_overlay_axis_grids' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.dict_overlay_axis_grids t;
SELECT 'overlay_axis_points' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.overlay_axis_points t;

-- 8. Ячейки и связанные таблицы
SELECT 'cells' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cells t;
SELECT 'cell_files' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_files t;
SELECT 'cell_file_versions' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_file_versions t;
SELECT 'cell_comments' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_comments t;
SELECT 'cell_comment_files' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_comment_files t;
SELECT 'cell_public_comments' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_public_comments t;
SELECT 'cell_history' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_history t;
SELECT 'cell_shares' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_shares t;
SELECT 'cell_signatures' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_signatures t;
SELECT 'cell_archives' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_archives t;
SELECT 'cell_overlay_masks' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.cell_overlay_masks t;

-- 9. ГРО
SELECT 'gro_cells' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.gro_cells t;
SELECT 'gro_cell_files' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.gro_cell_files t;
SELECT 'gro_cell_file_versions' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.gro_cell_file_versions t;

-- 10. Поддержка
SELECT 'support_messages' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.support_messages t;
SELECT 'support_message_files' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.support_message_files t;
SELECT 'support_blocked_users' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.support_blocked_users t;
SELECT 'support_read_status' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.support_read_status t;

-- 11. Файлообмен
SELECT 'file_shares' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.file_shares t;
SELECT 'file_share_recipients' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.file_share_recipients t;
SELECT 'file_share_files' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.file_share_files t;
SELECT 'file_share_overlay_masks' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.file_share_overlay_masks t;

-- 12. Push и уведомления
SELECT 'push_subscriptions' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.push_subscriptions t;
SELECT 'notifications' AS table_name, COALESCE(json_agg(t), '[]'::json) AS data FROM public.notifications t;
