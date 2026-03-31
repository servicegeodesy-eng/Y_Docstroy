import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../config/db';

const router = Router();

// Rate limit: 5 заявок в час с одного IP
const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Слишком много заявок. Попробуйте через час.' },
});

const VALID_PLANS = ['start', 'standard', 'business', 'corporation'] as const;

router.post('/', leadLimiter, async (req: Request, res: Response) => {
  try {
    const { plan_key, company_name, inn, contact_name, phone, email } = req.body;

    // Валидация обязательных полей
    if (!plan_key || !company_name || !contact_name || !phone || !email) {
      res.status(400).json({ error: 'Заполните все обязательные поля' });
      return;
    }

    if (!VALID_PLANS.includes(plan_key)) {
      res.status(400).json({ error: 'Некорректный тариф' });
      return;
    }

    // Простая валидация email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Некорректный email' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO leads (plan_key, company_name, inn, contact_name, phone, email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [plan_key, company_name.trim(), inn?.trim() || null, contact_name.trim(), phone.trim(), email.trim().toLowerCase()]
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('leads POST error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
