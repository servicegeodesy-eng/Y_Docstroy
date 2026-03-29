-- ============================================================================
-- 009: Бейджи + автопрочтение уведомлений + LISTEN/NOTIFY для SSE
-- Выполнить вручную в SQL Editor
-- ============================================================================

-- 1. Добавляем cell_id в notifications для связи уведомления с ячейкой
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS cell_id uuid REFERENCES cells(id) ON DELETE CASCADE;

-- 2. Индексы для быстрых COUNT-запросов бейджей
-- Бейдж реестра: входящие ячейки, требующие действия
CREATE INDEX IF NOT EXISTS idx_cells_badge_incoming
  ON cells (project_id, assigned_to, send_type) WHERE send_type IS NOT NULL;

-- Бейдж заявок: заявки в работе
CREATE INDEX IF NOT EXISTS idx_cells_badge_requests
  ON cells (project_id, cell_type, status) WHERE cell_type = 'request';

-- Бейдж файлообмена: непрочитанные входящие файлы
CREATE INDEX IF NOT EXISTS idx_fsr_badge_unread
  ON file_share_recipients (user_id, is_read) WHERE is_read = false;

-- Индекс для поиска уведомлений по cell_id (автопрочтение)
CREATE INDEX IF NOT EXISTS idx_notifications_cell_unread
  ON notifications (user_id, cell_id) WHERE is_read = false AND cell_id IS NOT NULL;

-- ============================================================================
-- 3. Обновляем create_notification — теперь принимает cell_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_title text, p_body text, p_url text DEFAULT '/', p_cell_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, title, body, url, cell_id)
  VALUES (p_user_id, p_title, p_body, p_url, p_cell_id);

  -- Уведомляем бэкенд через NOTIFY для SSE
  PERFORM pg_notify('badge_update', json_build_object(
    'user_id', p_user_id,
    'type', CASE
      WHEN p_url LIKE '%/requests' THEN 'requests'
      WHEN p_url LIKE '%/fileshare' THEN 'fileshare'
      ELSE 'registry'
    END
  )::text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Обновляем все триггеры — передаём cell_id в create_notification
-- ============================================================================

-- 4a. Cell share → notification (отправка на проверку/ознакомление/контроль)
CREATE OR REPLACE FUNCTION public.trg_notify_cell_share()
RETURNS trigger AS $$
DECLARE
  v_cell_name text; v_sender_name text; v_action text; v_project_id uuid; v_body text;
BEGIN
  SELECT c.name, c.project_id INTO v_cell_name, v_project_id
  FROM cells c WHERE c.id = NEW.cell_id;

  SELECT coalesce(u.last_name || ' ' || left(u.first_name, 1) || '.', 'Пользователь')
  INTO v_sender_name FROM users u WHERE u.id = NEW.from_user_id;

  v_action := CASE NEW.share_type
    WHEN 'review' THEN 'на проверку' WHEN 'acknowledge' THEN 'на ознакомление'
    WHEN 'supervision' THEN 'на контроль' ELSE 'задачу' END;

  v_body := v_sender_name || ' отправил(а) ' || v_action || ': ' || coalesce(v_cell_name, 'Без названия');

  PERFORM create_notification(NEW.to_user_id, 'Новая задача', v_body, '/projects/' || v_project_id || '/tasks', NEW.cell_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4b. Cell signature → notification (подпись/ознакомление/согласование)
CREATE OR REPLACE FUNCTION public.trg_notify_cell_signature()
RETURNS trigger AS $$
DECLARE
  v_cell_name text; v_signer_name text; v_creator_id uuid; v_project_id uuid;
  v_status_text text; v_body text;
BEGIN
  SELECT c.name, c.created_by, c.project_id INTO v_cell_name, v_creator_id, v_project_id
  FROM cells c WHERE c.id = NEW.cell_id;

  IF v_creator_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT coalesce(u.last_name || ' ' || left(u.first_name, 1) || '.', 'Пользователь')
  INTO v_signer_name FROM users u WHERE u.id = NEW.user_id;

  v_status_text := CASE NEW.status
    WHEN 'Подписано' THEN 'подписал(а)' WHEN 'Отклонено' THEN 'отклонил(а)'
    WHEN 'Подписано с замечанием' THEN 'подписал(а) с замечанием'
    WHEN 'Ознакомлен' THEN 'ознакомился(-ась)' WHEN 'Согласовано' THEN 'согласовал(а)'
    ELSE 'обработал(а)' END;

  v_body := v_signer_name || ' ' || v_status_text;

  PERFORM create_notification(v_creator_id, coalesce(v_cell_name, 'Ячейка'), v_body, '/projects/' || v_project_id || '/tasks', NEW.cell_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4c. File share → notification
CREATE OR REPLACE FUNCTION public.trg_notify_file_share()
RETURNS trigger AS $$
DECLARE
  v_sender_name text; v_comment text; v_project_id uuid; v_share_status text; v_body text;
BEGIN
  SELECT fs.comment, fs.project_id, fs.status,
    coalesce(u.last_name || ' ' || left(u.first_name, 1) || '.', 'Пользователь')
  INTO v_comment, v_project_id, v_share_status, v_sender_name
  FROM file_shares fs JOIN users u ON u.id = fs.created_by
  WHERE fs.id = NEW.share_id;

  IF v_share_status != 'sent' THEN RETURN NEW; END IF;

  v_body := v_sender_name || ' отправил(а) файл' ||
    CASE WHEN v_comment IS NOT NULL AND v_comment != '' THEN ': ' || left(v_comment, 80) ELSE '' END;

  PERFORM create_notification(NEW.user_id, 'Новый файл', v_body, '/projects/' || v_project_id || '/fileshare', NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4d. Cell comment → notification
CREATE OR REPLACE FUNCTION public.trg_notify_cell_comment()
RETURNS trigger AS $$
DECLARE
  v_cell_name text; v_creator_id uuid; v_assigned_to uuid; v_project_id uuid;
  v_commenter_name text; v_body text;
BEGIN
  SELECT c.name, c.created_by, c.assigned_to, c.project_id
  INTO v_cell_name, v_creator_id, v_assigned_to, v_project_id
  FROM cells c WHERE c.id = NEW.cell_id;

  SELECT coalesce(u.last_name || ' ' || left(u.first_name, 1) || '.', 'Пользователь')
  INTO v_commenter_name FROM users u WHERE u.id = NEW.user_id;

  v_body := v_commenter_name || ' к "' || coalesce(left(v_cell_name, 40), 'ячейке') || '": ' || left(NEW.text, 60);

  IF v_creator_id IS NOT NULL AND v_creator_id != NEW.user_id THEN
    PERFORM create_notification(v_creator_id, 'Комментарий', v_body, '/projects/' || v_project_id || '/tasks', NEW.cell_id);
  END IF;

  IF v_assigned_to IS NOT NULL AND v_assigned_to != NEW.user_id AND v_assigned_to != v_creator_id THEN
    PERFORM create_notification(v_assigned_to, 'Комментарий', v_body, '/projects/' || v_project_id || '/tasks', NEW.cell_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4e. Request event → notification
CREATE OR REPLACE FUNCTION public.trg_notify_request_event()
RETURNS trigger AS $$
DECLARE
  v_cell_type text; v_cell_name text; v_project_id uuid;
  v_created_by uuid; v_assigned_to uuid;
  v_actor_name text; v_title text; v_body text; v_url text;
  v_target_user uuid;
BEGIN
  IF NEW.action NOT IN (
    'created', 'status_changed', 'request_executed',
    'request_rejected', 'request_forwarded', 'request_remarks'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.cell_type, c.name, c.project_id, c.created_by, c.assigned_to
  INTO v_cell_type, v_cell_name, v_project_id, v_created_by, v_assigned_to
  FROM cells c WHERE c.id = NEW.cell_id;

  IF v_cell_type != 'request' THEN RETURN NEW; END IF;

  SELECT coalesce(u.last_name || ' ' || left(u.first_name, 1) || '.', 'Пользователь')
  INTO v_actor_name FROM users u WHERE u.id = NEW.user_id;

  v_url := '/projects/' || v_project_id || '/requests';

  CASE NEW.action
    WHEN 'created' THEN
      v_title := 'Новая заявка';
      v_body := v_actor_name || ' создал(а) заявку: ' || coalesce(left(v_cell_name, 60), 'Без названия');
      FOR v_target_user IN
        SELECT pm.user_id FROM project_members pm
        WHERE pm.project_id = v_project_id
          AND pm.user_id != NEW.user_id
          AND has_permission(pm.user_id, v_project_id, 'can_execute_requests')
      LOOP
        PERFORM create_notification(v_target_user, v_title, v_body, v_url, NEW.cell_id);
      END LOOP;
      RETURN NEW;

    WHEN 'request_executed' THEN
      v_title := 'Заявка выполнена';
      v_body := v_actor_name || ' выполнил(а): ' || coalesce(left(v_cell_name, 60), 'Без названия');
      v_target_user := v_created_by;

    WHEN 'request_rejected' THEN
      v_title := 'Заявка отклонена';
      v_body := v_actor_name || ' отклонил(а): ' || coalesce(left(v_cell_name, 60), 'Без названия');
      v_target_user := v_created_by;

    WHEN 'request_remarks' THEN
      v_title := 'Замечание по заявке';
      v_body := v_actor_name || ' добавил(а) замечание: ' || coalesce(left(v_cell_name, 60), 'Без названия');
      v_target_user := v_created_by;

    WHEN 'request_forwarded' THEN
      v_title := 'Заявка переадресована';
      v_body := v_actor_name || ' переадресовал(а): ' || coalesce(left(v_cell_name, 60), 'Без названия');
      v_target_user := v_assigned_to;

    WHEN 'status_changed' THEN
      IF NEW.user_id = v_created_by THEN RETURN NEW; END IF;
      v_title := 'Статус заявки изменён';
      v_body := v_actor_name || ': ' || coalesce(left(v_cell_name, 40), 'Заявка') ||
        ' -> ' || coalesce((NEW.details->>'to')::text, '');
      v_target_user := v_created_by;

    ELSE
      RETURN NEW;
  END CASE;

  IF v_target_user IS NOT NULL AND v_target_user != NEW.user_id THEN
    PERFORM create_notification(v_target_user, v_title, v_body, v_url, NEW.cell_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Триггер автопрочтения: при действии пользователя помечаем его уведомления
--    по этой ячейке как прочитанные + NOTIFY для обновления бейджей
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_read_notifications()
RETURNS trigger AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = NEW.user_id
    AND cell_id = NEW.cell_id
    AND is_read = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Если были непрочитанные — уведомляем SSE
  IF v_updated > 0 THEN
    PERFORM pg_notify('badge_update', json_build_object(
      'user_id', NEW.user_id,
      'type', 'read'
    )::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_read_notifications
  AFTER INSERT ON cell_history
  FOR EACH ROW EXECUTE FUNCTION auto_read_notifications();

-- ============================================================================
-- 6. NOTIFY при прочтении файлообмена (file_share_recipients.is_read = true)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_fileshare_read()
RETURNS trigger AS $$
BEGIN
  IF OLD.is_read = false AND NEW.is_read = true THEN
    PERFORM pg_notify('badge_update', json_build_object(
      'user_id', NEW.user_id,
      'type', 'fileshare'
    )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_fileshare_read_notify
  AFTER UPDATE OF is_read ON file_share_recipients
  FOR EACH ROW EXECUTE FUNCTION notify_fileshare_read();
