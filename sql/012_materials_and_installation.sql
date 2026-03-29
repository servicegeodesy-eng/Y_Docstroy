-- ============================================================================
-- 012: Модули «Материалы» и «Монтаж» для РМ Производителя работ
-- Выполнить вручную в SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. Справочники
-- ============================================================================

-- Единицы измерения (общие для проекта)
CREATE TABLE IF NOT EXISTS dict_units (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text NOT NULL,           -- "Кубический метр"
  short_name text NOT NULL,           -- "м³"
  sort_order int  NOT NULL DEFAULT 0,
  UNIQUE (project_id, short_name)
);

CREATE INDEX IF NOT EXISTS idx_dict_units_project ON dict_units (project_id);

-- Номенклатура материалов (создаётся "на лету" при вводе)
CREATE TABLE IF NOT EXISTS dict_materials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text NOT NULL,           -- "Бетон М150", "ПГС", "Арматура d12"
  unit_id    uuid REFERENCES dict_units(id),
  sort_order int  NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_dict_materials_project ON dict_materials (project_id);

-- Начальные единицы измерения (seed при создании проекта — вручную или через функцию)
-- INSERT выполняется в seed_default_dictionaries или вручную


-- ============================================================================
-- 2. Заявки на материалы
-- ============================================================================

CREATE TABLE IF NOT EXISTS material_orders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_number    serial,                                       -- порядковый номер заявки
  building_id     uuid        REFERENCES dict_buildings(id),    -- место
  work_type_id    uuid        REFERENCES dict_work_types(id),   -- вид работ
  floor_id        uuid        REFERENCES dict_floors(id),       -- уровень
  construction_id uuid        REFERENCES dict_constructions(id),-- конструкция
  status          text        NOT NULL DEFAULT 'draft',         -- draft, ordered, partial, delivered, cancelled
  notes           text,
  created_by      uuid        NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_orders_project ON material_orders (project_id, status);
CREATE INDEX IF NOT EXISTS idx_material_orders_location ON material_orders (project_id, building_id, work_type_id, floor_id, construction_id);

-- Позиции заявки (номенклатура + количество)
CREATE TABLE IF NOT EXISTS material_order_items (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid    NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  material_id   uuid    NOT NULL REFERENCES dict_materials(id),
  quantity      numeric NOT NULL DEFAULT 0,     -- заказано
  delivered_qty numeric NOT NULL DEFAULT 0,     -- поступило (суммарно)
  UNIQUE (order_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_material_order_items_order ON material_order_items (order_id);

-- Файлы заявки
CREATE TABLE IF NOT EXISTS material_order_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid        NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  storage_path text        NOT NULL,
  file_size    bigint      NOT NULL DEFAULT 0,
  mime_type    text        NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by  uuid        REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 3. Поступления материалов
-- ============================================================================

CREATE TABLE IF NOT EXISTS material_deliveries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid        NOT NULL REFERENCES material_order_items(id) ON DELETE CASCADE,
  quantity      numeric     NOT NULL,           -- сколько поступило в этой поставке
  notes         text,
  created_by    uuid        NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_deliveries_item ON material_deliveries (order_item_id);

-- Файлы/фото поступлений
CREATE TABLE IF NOT EXISTS material_delivery_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id  uuid        NOT NULL REFERENCES material_deliveries(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  storage_path text        NOT NULL,
  file_size    bigint      NOT NULL DEFAULT 0,
  mime_type    text        NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by  uuid        REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Триггер: обновлять delivered_qty в material_order_items при новой поставке
CREATE OR REPLACE FUNCTION update_delivered_qty()
RETURNS trigger AS $$
BEGIN
  UPDATE material_order_items
  SET delivered_qty = (
    SELECT coalesce(sum(quantity), 0)
    FROM material_deliveries
    WHERE order_item_id = NEW.order_item_id
  )
  WHERE id = NEW.order_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_delivered_qty
  AFTER INSERT OR DELETE ON material_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_delivered_qty();

-- Триггер: обновлять статус заявки при поступлении
CREATE OR REPLACE FUNCTION update_order_status_on_delivery()
RETURNS trigger AS $$
DECLARE
  v_order_id uuid;
  v_total_qty numeric;
  v_total_delivered numeric;
BEGIN
  SELECT oi.order_id INTO v_order_id
  FROM material_order_items oi WHERE oi.id = NEW.order_item_id;

  SELECT sum(quantity), sum(delivered_qty)
  INTO v_total_qty, v_total_delivered
  FROM material_order_items WHERE order_id = v_order_id;

  IF v_total_delivered >= v_total_qty THEN
    UPDATE material_orders SET status = 'delivered', updated_at = now() WHERE id = v_order_id;
  ELSIF v_total_delivered > 0 THEN
    UPDATE material_orders SET status = 'partial', updated_at = now() WHERE id = v_order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_order_status
  AFTER INSERT ON material_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_order_status_on_delivery();


-- ============================================================================
-- 4. Монтаж (работы)
-- ============================================================================

CREATE TABLE IF NOT EXISTS installation_works (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  building_id     uuid        REFERENCES dict_buildings(id),
  work_type_id    uuid        REFERENCES dict_work_types(id),
  floor_id        uuid        REFERENCES dict_floors(id),
  construction_id uuid        REFERENCES dict_constructions(id),
  planned_date    date,
  status          text        NOT NULL DEFAULT 'planned',  -- planned, in_progress, completed
  notes           text,
  created_by      uuid        NOT NULL REFERENCES users(id),
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installation_works_project ON installation_works (project_id, status);

-- Привязка материалов к работе (из каких заявок берём)
CREATE TABLE IF NOT EXISTS installation_materials (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id       uuid    NOT NULL REFERENCES installation_works(id) ON DELETE CASCADE,
  order_item_id uuid    NOT NULL REFERENCES material_order_items(id),
  required_qty  numeric NOT NULL DEFAULT 0,     -- необходимый объём для работы
  used_qty      numeric NOT NULL DEFAULT 0,     -- фактически использовано
  UNIQUE (work_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_installation_materials_work ON installation_materials (work_id);

-- Лог процесса монтажа
CREATE TABLE IF NOT EXISTS installation_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id    uuid        NOT NULL REFERENCES installation_works(id) ON DELETE CASCADE,
  action     text        NOT NULL,  -- started, material_used, delivery_fixed, completed
  details    jsonb,
  created_by uuid        NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installation_log_work ON installation_log (work_id);

-- Файлы/фото монтажа
CREATE TABLE IF NOT EXISTS installation_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id      uuid        NOT NULL REFERENCES installation_works(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  storage_path text        NOT NULL,
  file_size    bigint      NOT NULL DEFAULT 0,
  mime_type    text        NOT NULL DEFAULT 'application/octet-stream',
  category     text        NOT NULL DEFAULT 'during',  -- before, during, after
  created_by   uuid        REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Утиль / возврат в остатки (при завершении монтажа)
CREATE TABLE IF NOT EXISTS material_dispositions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id       uuid        NOT NULL REFERENCES installation_works(id) ON DELETE CASCADE,
  order_item_id uuid        NOT NULL REFERENCES material_order_items(id),
  quantity      numeric     NOT NULL,
  disposition   text        NOT NULL,   -- 'scrap' (утиль) | 'returned' (в остатки)
  notes         text,
  created_by    uuid        NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 5. Добавляем таблицы в whitelist generic CRUD
-- (выполнить в queryParser.ts — НЕ SQL, просто напоминание)
-- ============================================================================
-- Добавить в ALLOWED_TABLES:
--   'dict_units', 'dict_materials',
--   'material_orders', 'material_order_items', 'material_order_files',
--   'material_deliveries', 'material_delivery_files',
--   'installation_works', 'installation_materials', 'installation_log',
--   'installation_files', 'material_dispositions'


-- ============================================================================
-- 6. Типовые единицы измерения (seed)
-- ============================================================================

-- Функция для seed единиц измерения при создании проекта
CREATE OR REPLACE FUNCTION seed_default_units(p_project_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO dict_units (project_id, name, short_name, sort_order) VALUES
    (p_project_id, 'Кубический метр', 'м³', 1),
    (p_project_id, 'Тонна', 'тн', 2),
    (p_project_id, 'Штука', 'шт', 3),
    (p_project_id, 'Погонный метр', 'м.п.', 4),
    (p_project_id, 'Квадратный метр', 'м²', 5),
    (p_project_id, 'Килограмм', 'кг', 6),
    (p_project_id, 'Литр', 'л', 7),
    (p_project_id, 'Комплект', 'компл.', 8)
  ON CONFLICT (project_id, short_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
