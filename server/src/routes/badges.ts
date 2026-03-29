import { Router, Response } from 'express';
import { Client } from 'pg';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// ============================================================================
// SSE: /api/badges/stream — реалтайм-бейджи через PostgreSQL LISTEN/NOTIFY
// ============================================================================

// Хранилище активных SSE-клиентов: userId → Set<Response>
const clients = new Map<string, Set<Response>>();

// Единственное LISTEN-подключение к PostgreSQL
let pgListener: Client | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

async function startListener() {
  if (pgListener) return;

  try {
    pgListener = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await pgListener.connect();
    await pgListener.query('LISTEN badge_update');

    pgListener.on('notification', (msg) => {
      if (!msg.payload) return;
      try {
        const data = JSON.parse(msg.payload);
        const userId = data.user_id;
        const userClients = clients.get(userId);
        if (userClients) {
          const sseData = `data: ${JSON.stringify({ type: data.type })}\n\n`;
          for (const res of userClients) {
            res.write(sseData);
          }
        }
      } catch { /* ignore malformed payload */ }
    });

    pgListener.on('error', () => {
      pgListener = null;
      scheduleReconnect();
    });

    pgListener.on('end', () => {
      pgListener = null;
      scheduleReconnect();
    });

    console.log('Badge SSE: LISTEN badge_update started');
  } catch (err) {
    console.error('Badge SSE: failed to connect listener', err);
    pgListener = null;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (clients.size > 0) startListener();
  }, 5000);
}

// GET /api/badges/stream — SSE endpoint
router.get('/stream', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Добавляем клиента
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);

  // Запускаем listener если ещё не запущен
  startListener();

  // Сразу отправляем текущие counts
  try {
    const counts = await getBadgeCounts(userId);
    res.write(`data: ${JSON.stringify(counts)}\n\n`);
  } catch { /* ignore */ }

  // Keepalive каждые 30 сек
  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  // Cleanup при отключении
  req.on('close', () => {
    clearInterval(keepalive);
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.delete(res);
      if (userClients.size === 0) clients.delete(userId);
    }
    // Если нет клиентов — отключаем listener
    if (clients.size === 0 && pgListener) {
      pgListener.end().catch(() => {});
      pgListener = null;
    }
  });
});

// GET /api/badges/counts — одноразовый запрос counts (fallback)
router.get('/counts', async (req: AuthRequest, res: Response) => {
  try {
    const counts = await getBadgeCounts(req.userId!);
    res.json(counts);
  } catch (err) {
    console.error('Badge counts error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// Подсчёт бейджей — 3 лёгких COUNT-запроса
// ============================================================================

async function getBadgeCounts(userId: string) {
  // Получаем проекты пользователя
  const projectsRes = await pool.query(
    'SELECT project_id FROM project_members WHERE user_id = $1',
    [userId]
  );
  const projectIds = projectsRes.rows.map((r: { project_id: string }) => r.project_id);

  if (projectIds.length === 0) {
    return { registry: 0, requests: 0, fileshare: 0, notifications: 0 };
  }

  const [registryRes, requestsRes, fileshareRes, notifRes] = await Promise.all([
    // Входящие ячейки, назначенные на пользователя с send_type (требуют действия)
    pool.query(
      `SELECT count(*)::int as cnt FROM cells
       WHERE project_id = ANY($1) AND assigned_to = $2 AND send_type IS NOT NULL`,
      [projectIds, userId]
    ),
    // Заявки: в работе, назначенные на пользователя
    pool.query(
      `SELECT count(*)::int as cnt FROM cells
       WHERE project_id = ANY($1) AND cell_type = 'request'
         AND assigned_to = $2 AND status = 'В работе'`,
      [projectIds, userId]
    ),
    // Непрочитанные файлы
    pool.query(
      `SELECT count(*)::int as cnt FROM file_share_recipients fsr
       JOIN file_shares fs ON fs.id = fsr.share_id
       WHERE fsr.user_id = $1 AND fsr.is_read = false
         AND fs.project_id = ANY($2) AND fs.status = 'sent'`,
      [userId, projectIds]
    ),
    // Непрочитанные уведомления
    pool.query(
      `SELECT count(*)::int as cnt FROM notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    ),
  ]);

  return {
    registry: registryRes.rows[0].cnt,
    requests: requestsRes.rows[0].cnt,
    fileshare: fileshareRes.rows[0].cnt,
    notifications: notifRes.rows[0].cnt,
  };
}

export default router;
