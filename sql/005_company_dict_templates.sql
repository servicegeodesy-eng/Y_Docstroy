-- ============================================================================
-- DocStroy — Миграция 005: Шаблоны справочников компании
-- Дата: 2026-03-28
--
-- Шаблоны — это «заготовки» справочников на уровне компании.
-- При создании нового проекта справочники копируются из шаблонов компании
-- (если они есть), а не из захардкоженных дефолтов.
-- Если шаблонов нет — используются старые дефолты из seed_default_dictionaries.
-- ============================================================================

-- ============================
-- 1. ТАБЛИЦЫ ШАБЛОНОВ
-- ============================

-- -------------------------------------------------
-- Шаблоны зданий/площадок
-- -------------------------------------------------
CREATE TABLE company_tpl_buildings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,

  UNIQUE (company_id, name)
);
CREATE INDEX idx_tpl_buildings_company ON company_tpl_buildings (company_id);

-- -------------------------------------------------
-- Шаблоны этажей/уровней
-- -------------------------------------------------
CREATE TABLE company_tpl_floors (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,

  UNIQUE (company_id, name)
);
CREATE INDEX idx_tpl_floors_company ON company_tpl_floors (company_id);

-- -------------------------------------------------
-- Шаблоны конструкций
-- -------------------------------------------------
CREATE TABLE company_tpl_constructions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,

  UNIQUE (company_id, name)
);
CREATE INDEX idx_tpl_constructions_company ON company_tpl_constructions (company_id);

-- -------------------------------------------------
-- Шаблоны видов работ
-- -------------------------------------------------
CREATE TABLE company_tpl_work_types (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,

  UNIQUE (company_id, name)
);
CREATE INDEX idx_tpl_work_types_company ON company_tpl_work_types (company_id);

-- -------------------------------------------------
-- Шаблоны этапов работ
-- -------------------------------------------------
CREATE TABLE company_tpl_work_stages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,

  UNIQUE (company_id, name)
);
CREATE INDEX idx_tpl_work_stages_company ON company_tpl_work_stages (company_id);

-- -------------------------------------------------
-- Шаблоны комплектов
-- -------------------------------------------------
CREATE TABLE company_tpl_sets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,

  UNIQUE (company_id, name)
);
CREATE INDEX idx_tpl_sets_company ON company_tpl_sets (company_id);

-- -------------------------------------------------
-- Шаблоны организаций
-- -------------------------------------------------
CREATE TABLE company_tpl_organizations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,

  UNIQUE (company_id, name)
);
CREATE INDEX idx_tpl_organizations_company ON company_tpl_organizations (company_id);

-- ============================
-- 2. ЗАПОЛНИТЬ ШАБЛОНЫ для «ООО "СУ-10"»
-- (на основе текущих дефолтов из seed_default_dictionaries)
-- ============================

DO $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE name = 'ООО "СУ-10"' LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE 'Компания ООО "СУ-10" не найдена, шаблоны не заполнены';
    RETURN;
  END IF;

  INSERT INTO company_tpl_organizations (company_id, name, sort_order) VALUES
    (v_company_id, 'СУ-10', 0), (v_company_id, 'СУ-90', 1);

  INSERT INTO company_tpl_buildings (company_id, name, sort_order) VALUES
    (v_company_id, 'Строительная площадка', 0), (v_company_id, 'Котлован', 1),
    (v_company_id, 'Автостоянка', 2), (v_company_id, 'Корпус 1', 3),
    (v_company_id, 'Благоустройство', 4), (v_company_id, 'Другое', 5);

  INSERT INTO company_tpl_work_types (company_id, name, sort_order) VALUES
    (v_company_id, 'Исходная поверхность', 0), (v_company_id, 'Ситуационный план', 1),
    (v_company_id, 'Бытовой городок', 2), (v_company_id, 'Дороги и площадки', 3),
    (v_company_id, 'Кран', 4), (v_company_id, 'Шпунт', 5),
    (v_company_id, 'Стена в грунте', 6), (v_company_id, 'Объем грунта', 7),
    (v_company_id, 'Грунтовое основание', 8), (v_company_id, 'Песчаное основание', 9),
    (v_company_id, 'Бетонная подготовка', 10), (v_company_id, 'Защитная стяжка', 11),
    (v_company_id, 'Монолит', 12), (v_company_id, 'Кладка', 13),
    (v_company_id, 'Полы', 14), (v_company_id, 'Фасад', 15);

  INSERT INTO company_tpl_floors (company_id, name, sort_order) VALUES
    (v_company_id, '-3 этаж', 0), (v_company_id, '-2 этаж', 1),
    (v_company_id, '-1 этаж', 2), (v_company_id, '1 этаж', 3),
    (v_company_id, '2 этаж', 4), (v_company_id, 'тех. этаж', 5),
    (v_company_id, '3 этаж', 6), (v_company_id, '4 этаж', 7),
    (v_company_id, '5 этаж', 8), (v_company_id, '6 этаж', 9),
    (v_company_id, '7 этаж', 10), (v_company_id, '8 этаж', 11),
    (v_company_id, '9 этаж', 12), (v_company_id, '10 этаж', 13),
    (v_company_id, '11 этаж', 14), (v_company_id, '12 этаж', 15),
    (v_company_id, '13 этаж', 16), (v_company_id, '14 этаж', 17),
    (v_company_id, '15 этаж', 18), (v_company_id, 'кровля', 19),
    (v_company_id, 'вид А', 20), (v_company_id, 'вид Б', 21),
    (v_company_id, 'вид В', 22), (v_company_id, 'вид Г', 23);

  INSERT INTO company_tpl_constructions (company_id, name, sort_order) VALUES
    (v_company_id, 'ФП', 0), (v_company_id, 'ВК', 1),
    (v_company_id, 'ПП', 2), (v_company_id, 'Кронштейны', 3),
    (v_company_id, 'Направляющие', 4), (v_company_id, 'Зона 1', 5),
    (v_company_id, 'Зона 2', 6);

  INSERT INTO company_tpl_sets (company_id, name, sort_order) VALUES
    (v_company_id, 'АОСР', 0), (v_company_id, 'АООК', 1);
END;
$$;

-- ============================
-- 3. ОБНОВИТЬ ФУНКЦИЮ seed_default_dictionaries
-- Теперь она сначала проверяет шаблоны компании.
-- Если есть — копирует из них. Если нет — использует дефолты.
-- ============================

CREATE OR REPLACE FUNCTION public.seed_default_dictionaries(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_company_id uuid;
  v_has_templates boolean := false;
BEGIN
  -- Получаем компанию проекта
  SELECT company_id INTO v_company_id FROM projects WHERE id = p_project_id;

  -- Проверяем есть ли шаблоны у компании
  IF v_company_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM company_tpl_buildings WHERE company_id = v_company_id LIMIT 1
    ) INTO v_has_templates;
  END IF;

  IF v_has_templates AND v_company_id IS NOT NULL THEN
    -- ====== КОПИРУЕМ ИЗ ШАБЛОНОВ КОМПАНИИ ======

    INSERT INTO public.project_organizations (project_id, name, sort_order)
    SELECT p_project_id, name, sort_order
    FROM company_tpl_organizations WHERE company_id = v_company_id;

    INSERT INTO public.dict_buildings (project_id, name, sort_order)
    SELECT p_project_id, name, sort_order
    FROM company_tpl_buildings WHERE company_id = v_company_id;

    INSERT INTO public.dict_work_types (project_id, name, sort_order)
    SELECT p_project_id, name, sort_order
    FROM company_tpl_work_types WHERE company_id = v_company_id;

    INSERT INTO public.dict_floors (project_id, name, sort_order)
    SELECT p_project_id, name, sort_order
    FROM company_tpl_floors WHERE company_id = v_company_id;

    INSERT INTO public.dict_constructions (project_id, name, sort_order)
    SELECT p_project_id, name, sort_order
    FROM company_tpl_constructions WHERE company_id = v_company_id;

    INSERT INTO public.dict_sets (project_id, name, sort_order)
    SELECT p_project_id, name, sort_order
    FROM company_tpl_sets WHERE company_id = v_company_id;

    INSERT INTO public.dict_work_stages (project_id, name, sort_order)
    SELECT p_project_id, name, sort_order
    FROM company_tpl_work_stages WHERE company_id = v_company_id;

  ELSE
    -- ====== СТАРЫЕ ДЕФОЛТЫ (fallback) ======

    INSERT INTO public.project_organizations (project_id, name, sort_order) VALUES
      (p_project_id, 'Организация 1', 0);

    INSERT INTO public.dict_buildings (project_id, name, sort_order) VALUES
      (p_project_id, 'Строительная площадка', 0), (p_project_id, 'Котлован', 1),
      (p_project_id, 'Автостоянка', 2), (p_project_id, 'Корпус 1', 3),
      (p_project_id, 'Благоустройство', 4), (p_project_id, 'Другое', 5);

    INSERT INTO public.dict_work_types (project_id, name, sort_order) VALUES
      (p_project_id, 'Исходная поверхность', 0), (p_project_id, 'Ситуационный план', 1),
      (p_project_id, 'Бытовой городок', 2), (p_project_id, 'Дороги и площадки', 3),
      (p_project_id, 'Кран', 4), (p_project_id, 'Шпунт', 5),
      (p_project_id, 'Стена в грунте', 6), (p_project_id, 'Объем грунта', 7),
      (p_project_id, 'Грунтовое основание', 8), (p_project_id, 'Песчаное основание', 9),
      (p_project_id, 'Бетонная подготовка', 10), (p_project_id, 'Защитная стяжка', 11),
      (p_project_id, 'Монолит', 12), (p_project_id, 'Кладка', 13),
      (p_project_id, 'Полы', 14), (p_project_id, 'Фасад', 15);

    INSERT INTO public.dict_floors (project_id, name, sort_order) VALUES
      (p_project_id, '-3 этаж', 0), (p_project_id, '-2 этаж', 1),
      (p_project_id, '-1 этаж', 2), (p_project_id, '1 этаж', 3),
      (p_project_id, '2 этаж', 4), (p_project_id, 'тех. этаж', 5),
      (p_project_id, '3 этаж', 6), (p_project_id, '4 этаж', 7),
      (p_project_id, '5 этаж', 8), (p_project_id, '6 этаж', 9),
      (p_project_id, '7 этаж', 10), (p_project_id, '8 этаж', 11),
      (p_project_id, '9 этаж', 12), (p_project_id, '10 этаж', 13),
      (p_project_id, '11 этаж', 14), (p_project_id, '12 этаж', 15),
      (p_project_id, '13 этаж', 16), (p_project_id, '14 этаж', 17),
      (p_project_id, '15 этаж', 18), (p_project_id, 'кровля', 19),
      (p_project_id, 'вид А', 20), (p_project_id, 'вид Б', 21),
      (p_project_id, 'вид В', 22), (p_project_id, 'вид Г', 23);

    INSERT INTO public.dict_constructions (project_id, name, sort_order) VALUES
      (p_project_id, 'ФП', 0), (p_project_id, 'ВК', 1),
      (p_project_id, 'ПП', 2), (p_project_id, 'Кронштейны', 3),
      (p_project_id, 'Направляющие', 4), (p_project_id, 'Зона 1', 5),
      (p_project_id, 'Зона 2', 6);

    INSERT INTO public.dict_sets (project_id, name, sort_order) VALUES
      (p_project_id, 'АОСР', 0), (p_project_id, 'АООК', 1);
  END IF;
END;
$function$;
