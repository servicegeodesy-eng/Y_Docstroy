import { Router, Response } from 'express';
import webpush from 'web-push';
import pool from '../config/db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Configure VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@docstroy.ru',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// POST /api/push/subscribe
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      res.status(400).json({ error: 'subscription обязательна' });
      return;
    }

    // Upsert subscription
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, updated_at = NOW()`,
      [
        userId,
        subscription.endpoint,
        subscription.keys?.p256dh || null,
        subscription.keys?.auth || null,
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/push/send
router.post('/send', async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, title, body, data } = req.body;

    if (!user_id || !title) {
      res.status(400).json({ error: 'user_id и title обязательны' });
      return;
    }

    const subscriptions = await pool.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1',
      [user_id]
    );

    if (subscriptions.rows.length === 0) {
      res.json({ sent: 0 });
      return;
    }

    const payload = JSON.stringify({ title, body: body || '', data: data || {} });
    let sent = 0;

    for (const sub of subscriptions.rows) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
      } catch (pushErr: unknown) {
        const statusCode = (pushErr as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired, remove it
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        } else {
          console.error('Push send error for subscription:', sub.id, pushErr);
        }
      }
    }

    res.json({ sent });
  } catch (err) {
    console.error('Push send error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
