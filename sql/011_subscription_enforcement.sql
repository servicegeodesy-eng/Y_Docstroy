-- ============================================================================
-- 011: Подписки — дополнения для enforce лимитов и хранилища
-- Выполнить вручную в SQL Editor (после 010)
-- ============================================================================

-- Дополнительные поля для отслеживания состояния подписки
ALTER TABLE company_subscriptions ADD COLUMN IF NOT EXISTS storage_used_bytes bigint NOT NULL DEFAULT 0;
ALTER TABLE company_subscriptions ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE company_subscriptions ADD COLUMN IF NOT EXISTS delete_scheduled_at timestamptz;
ALTER TABLE company_subscriptions ADD COLUMN IF NOT EXISTS notes text;

-- История подписок (аудит)
CREATE TABLE IF NOT EXISTS subscription_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action        text        NOT NULL,  -- created, renewed, upgraded, suspended, reactivated, deleted
  plan_name     text,
  amount        numeric,
  performed_by  uuid        REFERENCES users(id),
  details       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_company ON subscription_history (company_id);

-- Функция подсчёта хранилища компании (вызывается периодически)
CREATE OR REPLACE FUNCTION calculate_company_storage(p_company_id uuid)
RETURNS bigint AS $$
DECLARE
  v_total bigint := 0;
  v_cell_files bigint;
  v_share_files bigint;
  v_versions bigint;
BEGIN
  -- Файлы ячеек
  SELECT coalesce(sum(cf.file_size), 0) INTO v_cell_files
  FROM cell_files cf
  JOIN cells c ON c.id = cf.cell_id
  JOIN projects p ON p.id = c.project_id
  WHERE p.company_id = p_company_id;

  -- Файлы файлообмена
  SELECT coalesce(sum(fsf.file_size), 0) INTO v_share_files
  FROM file_share_files fsf
  JOIN file_shares fs ON fs.id = fsf.share_id
  JOIN projects p ON p.id = fs.project_id
  WHERE p.company_id = p_company_id;

  -- Версии файлов
  SELECT coalesce(sum(cfv.file_size), 0) INTO v_versions
  FROM cell_file_versions cfv
  JOIN cell_files cf ON cf.id = cfv.file_id
  JOIN cells c ON c.id = cf.cell_id
  JOIN projects p ON p.id = c.project_id
  WHERE p.company_id = p_company_id;

  v_total := v_cell_files + v_share_files + v_versions;

  -- Обновляем в подписке
  UPDATE company_subscriptions
  SET storage_used_bytes = v_total
  WHERE company_id = p_company_id
    AND status IN ('trial', 'active', 'suspended');

  RETURN v_total;
END;
$$ LANGUAGE plpgsql;
