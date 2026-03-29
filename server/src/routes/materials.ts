import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import pool from '../config/db';
import s3Client from '../config/s3';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hasProjectAccess } from '../middleware/permissions';

const router = Router();
router.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const MAIN_BUCKET = process.env.S3_BUCKET || 'docstroy';

// ============================================================================
// GET /api/materials/orders?project_id=...&status=...
// ============================================================================

router.get('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = req.query.project_id as string;
    const status = req.query.status as string;

    if (!projectId) { res.status(400).json({ error: 'project_id обязателен' }); return; }
    if (!await hasProjectAccess(userId, projectId)) { res.status(403).json({ error: 'Нет доступа' }); return; }

    let sql = `
      SELECT mo.*,
        db.name as building_name, dwt.name as work_type_name,
        df.name as floor_name, dc.name as construction_name,
        u.last_name, u.first_name,
        (SELECT json_agg(json_build_object(
          'id', moi.id, 'material_id', moi.material_id,
          'quantity', moi.quantity, 'delivered_qty', moi.delivered_qty,
          'material_name', dm.name, 'unit_short', du.short_name
        )) FROM material_order_items moi
          JOIN dict_materials dm ON dm.id = moi.material_id
          LEFT JOIN dict_units du ON du.id = dm.unit_id
          WHERE moi.order_id = mo.id
        ) as items
      FROM material_orders mo
      LEFT JOIN dict_buildings db ON db.id = mo.building_id
      LEFT JOIN dict_work_types dwt ON dwt.id = mo.work_type_id
      LEFT JOIN dict_floors df ON df.id = mo.floor_id
      LEFT JOIN dict_constructions dc ON dc.id = mo.construction_id
      LEFT JOIN users u ON u.id = mo.created_by
      WHERE mo.project_id = $1`;
    const params: unknown[] = [projectId];

    if (status) {
      sql += ` AND mo.status = $2`;
      params.push(status);
    }

    sql += ` ORDER BY mo.order_number DESC`;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/materials/orders/:id — одна заявка с деталями
// ============================================================================

router.get('/orders/:id', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.id;

    const order = await pool.query(
      `SELECT mo.*,
        db.name as building_name, dwt.name as work_type_name,
        df.name as floor_name, dc.name as construction_name
       FROM material_orders mo
       LEFT JOIN dict_buildings db ON db.id = mo.building_id
       LEFT JOIN dict_work_types dwt ON dwt.id = mo.work_type_id
       LEFT JOIN dict_floors df ON df.id = mo.floor_id
       LEFT JOIN dict_constructions dc ON dc.id = mo.construction_id
       WHERE mo.id = $1`,
      [orderId]
    );

    if (order.rows.length === 0) { res.status(404).json({ error: 'Заявка не найдена' }); return; }

    const items = await pool.query(
      `SELECT moi.*, dm.name as material_name, du.short_name as unit_short
       FROM material_order_items moi
       JOIN dict_materials dm ON dm.id = moi.material_id
       LEFT JOIN dict_units du ON du.id = dm.unit_id
       WHERE moi.order_id = $1`,
      [orderId]
    );

    const files = await pool.query(
      'SELECT * FROM material_order_files WHERE order_id = $1 ORDER BY created_at',
      [orderId]
    );

    res.json({ ...order.rows[0], items: items.rows, files: files.rows });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/materials/orders — создать заявку
// ============================================================================

router.post('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { project_id, building_id, work_type_id, floor_id, construction_id, items, notes, status } = req.body;

    if (!project_id) { res.status(400).json({ error: 'project_id обязателен' }); return; }
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Необходимо указать хотя бы один материал' }); return;
    }
    if (!await hasProjectAccess(userId, project_id)) { res.status(403).json({ error: 'Нет доступа' }); return; }

    const orderStatus = status === 'draft' ? 'draft' : 'ordered';

    const orderResult = await pool.query(
      `INSERT INTO material_orders (project_id, building_id, work_type_id, floor_id, construction_id, status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [project_id, building_id || null, work_type_id || null, floor_id || null, construction_id || null, orderStatus, notes || null, userId]
    );

    const order = orderResult.rows[0];

    // Создаём/находим материалы и добавляем позиции
    for (const item of items) {
      let materialId = item.material_id;

      // Если material_id не указан, но есть name — создаём новый
      if (!materialId && item.material_name) {
        const existing = await pool.query(
          'SELECT id FROM dict_materials WHERE project_id = $1 AND name = $2',
          [project_id, item.material_name]
        );
        if (existing.rows.length > 0) {
          materialId = existing.rows[0].id;
        } else {
          const newMat = await pool.query(
            'INSERT INTO dict_materials (project_id, name, unit_id, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
            [project_id, item.material_name, item.unit_id || null, userId]
          );
          materialId = newMat.rows[0].id;
        }
      }

      if (materialId) {
        await pool.query(
          'INSERT INTO material_order_items (order_id, material_id, quantity) VALUES ($1, $2, $3)',
          [order.id, materialId, item.quantity || 0]
        );
      }
    }

    res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// PATCH /api/materials/orders/:id — обновить заявку (статус, notes)
// ============================================================================

router.patch('/orders/:id', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.id;
    const { status, notes } = req.body;

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (status) { sets.push(`status = $${idx++}`); vals.push(status); }
    if (notes !== undefined) { sets.push(`notes = $${idx++}`); vals.push(notes); }
    sets.push(`updated_at = NOW()`);

    if (sets.length <= 1) { res.status(400).json({ error: 'Нечего обновлять' }); return; }

    vals.push(orderId);
    const result = await pool.query(
      `UPDATE material_orders SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );

    if (result.rows.length === 0) { res.status(404).json({ error: 'Не найдено' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/materials/deliveries — зафиксировать поступление
// ============================================================================

router.post('/deliveries', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { items } = req.body;
    // items: [{ order_item_id, quantity, notes }]

    if (!items || !Array.isArray(items)) {
      res.status(400).json({ error: 'items обязателен' }); return;
    }

    const results = [];
    for (const item of items) {
      if (!item.order_item_id || !item.quantity || item.quantity <= 0) continue;

      const result = await pool.query(
        'INSERT INTO material_deliveries (order_item_id, quantity, notes, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
        [item.order_item_id, item.quantity, item.notes || null, userId]
      );
      results.push(result.rows[0]);
    }

    res.status(201).json(results);
  } catch (err) {
    console.error('Create delivery error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/materials/remaining?project_id=... — остатки суммарно по позициям
// ============================================================================

router.get('/remaining', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.project_id as string;
    if (!projectId) { res.status(400).json({ error: 'project_id обязателен' }); return; }

    // Остатки = Поступило - Использовано + Возвращено по каждой позиции
    const result = await pool.query(`
      SELECT
        mo.building_id, db.name as building_name,
        mo.work_type_id, dwt.name as work_type_name,
        mo.floor_id, df.name as floor_name,
        mo.construction_id, dc.name as construction_name,
        dm.id as material_id, dm.name as material_name,
        du.short_name as unit_short,
        sum(moi.quantity) as total_ordered,
        sum(moi.delivered_qty) as total_delivered,
        coalesce(sum(im.used_qty), 0) as total_used,
        coalesce(sum(CASE WHEN md.disposition = 'returned' THEN md.quantity ELSE 0 END), 0) as total_returned,
        sum(moi.delivered_qty) - coalesce(sum(im.used_qty), 0)
          + coalesce(sum(CASE WHEN md.disposition = 'returned' THEN md.quantity ELSE 0 END), 0) as remaining
      FROM material_order_items moi
      JOIN material_orders mo ON mo.id = moi.order_id
      JOIN dict_materials dm ON dm.id = moi.material_id
      LEFT JOIN dict_units du ON du.id = dm.unit_id
      LEFT JOIN dict_buildings db ON db.id = mo.building_id
      LEFT JOIN dict_work_types dwt ON dwt.id = mo.work_type_id
      LEFT JOIN dict_floors df ON df.id = mo.floor_id
      LEFT JOIN dict_constructions dc ON dc.id = mo.construction_id
      LEFT JOIN installation_materials im ON im.order_item_id = moi.id
      LEFT JOIN material_dispositions md ON md.order_item_id = moi.id
      WHERE mo.project_id = $1 AND mo.status != 'cancelled'
      GROUP BY mo.building_id, db.name, mo.work_type_id, dwt.name,
               mo.floor_id, df.name, mo.construction_id, dc.name,
               dm.id, dm.name, du.short_name
      ORDER BY dm.name
    `, [projectId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Get remaining error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/materials/units?project_id=... — единицы измерения
// ============================================================================

router.get('/units', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.project_id as string;
    if (!projectId) { res.status(400).json({ error: 'project_id обязателен' }); return; }

    const result = await pool.query(
      'SELECT * FROM dict_units WHERE project_id = $1 ORDER BY sort_order', [projectId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get units error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/materials/nomenclature?project_id=...&q=... — автокомплит номенклатуры
// ============================================================================

router.get('/nomenclature', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.project_id as string;
    const q = req.query.q as string;
    if (!projectId) { res.status(400).json({ error: 'project_id обязателен' }); return; }

    let sql = 'SELECT dm.*, du.short_name as unit_short FROM dict_materials dm LEFT JOIN dict_units du ON du.id = dm.unit_id WHERE dm.project_id = $1';
    const params: unknown[] = [projectId];

    if (q) {
      sql += ' AND dm.name ILIKE $2';
      params.push(`%${q}%`);
    }

    sql += ' ORDER BY dm.name LIMIT 50';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get nomenclature error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/materials/orders/files — загрузить файл к заказу
// ============================================================================

router.post('/orders/files', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const file = req.file;
    const orderId = req.body.order_id;

    if (!file || !orderId) {
      res.status(400).json({ error: 'file и order_id обязательны' });
      return;
    }

    const order = await pool.query('SELECT project_id FROM material_orders WHERE id = $1', [orderId]);
    if (order.rows.length === 0) { res.status(404).json({ error: 'Заказ не найден' }); return; }

    const projectId = order.rows[0].project_id;
    const ext = path.extname(file.originalname);
    const storagePath = `${projectId}/materials/${orderId}/${uuidv4()}${ext}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: MAIN_BUCKET, Key: storagePath, Body: file.buffer, ContentType: file.mimetype,
    }));

    const result = await pool.query(
      `INSERT INTO material_order_files (order_id, file_name, storage_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [orderId, file.originalname, storagePath, file.size, file.mimetype, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload order file error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/materials/deliveries/files — загрузить фото/файл поступления
// ============================================================================

router.post('/deliveries/files', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const file = req.file;
    const deliveryId = req.body.delivery_id;

    if (!file || !deliveryId) {
      res.status(400).json({ error: 'file и delivery_id обязательны' });
      return;
    }

    const ext = path.extname(file.originalname);
    const storagePath = `deliveries/${deliveryId}/${uuidv4()}${ext}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: MAIN_BUCKET, Key: storagePath, Body: file.buffer, ContentType: file.mimetype,
    }));

    const result = await pool.query(
      `INSERT INTO material_delivery_files (delivery_id, file_name, storage_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [deliveryId, file.originalname, storagePath, file.size, file.mimetype, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload delivery file error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
