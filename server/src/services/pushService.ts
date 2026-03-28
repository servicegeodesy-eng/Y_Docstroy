import webpush from 'web-push';
import pool from '../config/db.js';

// Initialize VAPID (idempotent — safe to call at import time)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@docstroy.ru',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// ============================================================================
// Core: send push to a single user
// ============================================================================

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}

export async function sendPushToUser(userId: string | number, payload: PushPayload): Promise<number> {
  const { rows: subscriptions } = await pool.query(
    'SELECT id, endpoint, p256dh, auth_key FROM push_subscriptions WHERE user_id = $1',
    [userId],
  );

  if (subscriptions.length === 0) return 0;

  let sent = 0;
  const payloadStr = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payloadStr,
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription expired — remove
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
      } else {
        console.error(`Push error for subscription ${sub.id}:`, err);
      }
    }
  }

  return sent;
}

// ============================================================================
// Create in-app notification + push
// ============================================================================

async function createNotification(
  userId: string,
  title: string,
  body: string,
  url = '/',
): Promise<void> {
  await pool.query(
    'INSERT INTO notifications (user_id, title, body, url) VALUES ($1, $2, $3, $4)',
    [userId, title, body, url],
  );
}

async function notifyUser(userId: string, title: string, body: string, url = '/'): Promise<void> {
  await createNotification(userId, title, body, url);
  // Fire-and-forget push — don't await to avoid blocking the response
  sendPushToUser(userId, { title, body, url }).catch((e) =>
    console.error('Push send error:', e),
  );
}

// ============================================================================
// Helper: get short name for a user
// ============================================================================

async function getShortName(userId: string): Promise<string> {
  const { rows } = await pool.query(
    "SELECT last_name, first_name FROM users WHERE id = $1",
    [userId],
  );
  if (rows.length === 0) return 'Пользователь';
  const u = rows[0];
  return u.first_name
    ? `${u.last_name} ${u.first_name.charAt(0)}.`
    : u.last_name;
}

// ============================================================================
// Cell action notifications
// ============================================================================

type CellAction = 'share' | 'sign' | 'comment' | 'status_changed';

export async function notifyOnCellAction(
  cellId: string | number,
  action: CellAction,
  actorId: string | number,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    const { rows } = await pool.query(
      'SELECT name, project_id, created_by, assigned_to FROM cells WHERE id = $1',
      [cellId],
    );
    if (rows.length === 0) return;

    const cell = rows[0];
    const actorName = await getShortName(String(actorId));
    const cellName = cell.name || 'Без названия';
    const url = `/projects/${cell.project_id}/tasks`;

    switch (action) {
      case 'share': {
        const toUserId = extra?.to_user_id as string;
        if (!toUserId || toUserId === actorId) return;

        const sendType = extra?.send_type as string;
        const actionLabel =
          sendType === 'review' ? 'на проверку' :
          sendType === 'acknowledge' ? 'на ознакомление' :
          sendType === 'supervision' ? 'на контроль' : 'задачу';

        await notifyUser(
          toUserId,
          'Новая задача',
          `${actorName} отправил(а) ${actionLabel}: ${cellName}`,
          url,
        );
        break;
      }

      case 'sign': {
        // Notify cell creator
        const creatorId = cell.created_by;
        if (!creatorId || creatorId === actorId) return;

        const status = extra?.status as string || 'обработал(а)';
        const statusLabel =
          status === 'Подписано' ? 'подписал(а)' :
          status === 'Отклонено' ? 'отклонил(а)' :
          status === 'Подписано с замечанием' ? 'подписал(а) с замечанием' :
          status === 'Ознакомлен' ? 'ознакомился(-ась)' :
          status === 'Согласовано' ? 'согласовал(а)' : 'обработал(а)';

        await notifyUser(
          creatorId,
          cellName,
          `${actorName} ${statusLabel}`,
          url,
        );
        break;
      }

      case 'comment': {
        const targets = new Set<string>();
        if (cell.created_by && cell.created_by !== actorId) targets.add(cell.created_by);
        if (cell.assigned_to && cell.assigned_to !== actorId && cell.assigned_to !== cell.created_by) {
          targets.add(cell.assigned_to);
        }

        const commentText = extra?.text as string || '';
        const body = `${actorName} к «${cellName.substring(0, 40)}»: ${commentText.substring(0, 60)}`;

        for (const targetId of targets) {
          await notifyUser(targetId, 'Комментарий', body, url);
        }
        break;
      }

      case 'status_changed': {
        const creatorId = cell.created_by;
        if (!creatorId || creatorId === actorId) return;

        const newStatus = extra?.new_status as string || '';
        await notifyUser(
          creatorId,
          'Статус изменён',
          `${actorName}: ${cellName.substring(0, 40)} → ${newStatus}`,
          url,
        );
        break;
      }
    }
  } catch (err) {
    console.error('notifyOnCellAction error:', err);
  }
}
