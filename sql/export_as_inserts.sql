-- ============================================================================
-- Экспорт данных из Supabase → INSERT-ы для Yandex PostgreSQL
-- Запусти в Supabase SQL Editor. Результат — готовый SQL для Yandex.
-- ============================================================================
-- ВАЖНО: Выполняй по частям (1-3, потом 4-5, потом 6-8 и т.д.)
-- если Supabase обрезает вывод.
-- ============================================================================

-- Часть 1: USERS (объединение auth.users + profiles)
-- В Yandex таблица users = profiles + password_hash из auth.users
SELECT string_agg(
  format(
    'INSERT INTO users (id, email, password_hash, last_name, first_name, middle_name, structure, organization, position, phone, is_portal_admin, is_global_reader, must_change_password, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %s, %s, %s, %L, %L) ON CONFLICT (id) DO NOTHING;',
    p.id,
    p.email,
    u.encrypted_password,
    p.last_name,
    p.first_name,
    COALESCE(p.middle_name, ''),
    p.structure,
    p.organization,
    p.position,
    p.phone,
    COALESCE(p.is_portal_admin, false),
    COALESCE(p.is_global_reader, false),
    COALESCE(p.must_change_password, false),
    p.created_at,
    p.updated_at
  ), E'\n'
) AS sql
FROM public.profiles p
JOIN auth.users u ON u.id = p.id;
