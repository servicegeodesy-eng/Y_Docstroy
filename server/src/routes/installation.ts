import { Router, Response } from 'express';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hasProjectAccess } from '../middleware/permissions';

const router = Router();
router.use(authMiddleware);

// ============================================================================
// GET /api/installation/works?project_id=...&status=...
// ============================================================================

router.get('/works', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = req.query.project_id as string;
    const status = req.query.status as string;

    if (!projectId) { res.status(400).json({ error: 'project_id обязателен' }); return; }
    if (!await hasProjectAccess(userId, projectId)) { res.status(403).json({ error: 'Нет доступа' }); return; }

    let sql = `
      SELECT iw.*,
        db.name as building_name, dwt.name as work_type_name,
        df.name as floor_name, dc.name as construction_name,
        u.last_name, u.first_name,
        (SELECT json_agg(json_build_object(
          'id', im.id, 'order_item_id', im.order_item_id,
          'required_qty', im.required_qty, 'used_qty', im.used_qty,
          'material_name', dm.name, 'unit_short', du.short_name,
          'order_number', mo.order_number,
          'ordered_qty', moi.quantity, 'delivered_qty', moi.delivered_qty
        )) FROM installation_materials im
          JOIN material_order_items moi ON moi.id = im.order_item_id
          JOIN dict_materials dm ON dm.id = moi.material_id
          LEFT JOIN dict_units du ON du.id = dm.unit_id
          JOIN material_orders mo ON mo.id = moi.order_id
          WHERE im.work_id = iw.id
        ) as materials
      FROM installation_works iw
      LEFT JOIN dict_buildings db ON db.id = iw.building_id
      LEFT JOIN dict_work_types dwt ON dwt.id = iw.work_type_id
      LEFT JOIN dict_floors df ON df.id = iw.floor_id
      LEFT JOIN dict_constructions dc ON dc.id = iw.construction_id
      LEFT JOIN users u ON u.id = iw.created_by
      WHERE iw.project_id = $1`;
    const params: unknown[] = [projectId];

    if (status) { sql += ` AND iw.status = $2`; params.push(status); }
    sql += ` ORDER BY iw.created_at DESC`;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get works error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/installation/works/:id — одна работа с деталями
// ============================================================================

router.get('/works/:id', async (req: AuthRequest, res: Response) => {
  try {
    const workId = req.params.id;

    const work = await pool.query(
      `SELECT iw.*, db.name as building_name, dwt.name as work_type_name,
              df.name as floor_name, dc.name as construction_name
       FROM installation_works iw
       LEFT JOIN dict_buildings db ON db.id = iw.building_id
       LEFT JOIN dict_work_types dwt ON dwt.id = iw.work_type_id
       LEFT JOIN dict_floors df ON df.id = iw.floor_id
       LEFT JOIN dict_constructions dc ON dc.id = iw.construction_id
       WHERE iw.id = $1`, [workId]
    );
    if (work.rows.length === 0) { res.status(404).json({ error: 'Работа не найдена' }); return; }

    const materials = await pool.query(
      `SELECT im.*, dm.name as material_name, du.short_name as unit_short,
              mo.order_number, moi.quantity as ordered_qty, moi.delivered_qty
       FROM installation_materials im
       JOIN material_order_items moi ON moi.id = im.order_item_id
       JOIN dict_materials dm ON dm.id = moi.material_id
       LEFT JOIN dict_units du ON du.id = dm.unit_id
       JOIN material_orders mo ON mo.id = moi.order_id
       WHERE im.work_id = $1`, [workId]
    );

    const files = await pool.query(
      'SELECT * FROM installation_files WHERE work_id = $1 ORDER BY created_at', [workId]
    );

    const log = await pool.query(
      `SELECT il.*, u.last_name, u.first_name
       FROM installation_log il
       LEFT JOIN users u ON u.id = il.created_by
       WHERE il.work_id = $1 ORDER BY il.created_at DESC`, [workId]
    );

    res.json({ ...work.rows[0], materials: materials.rows, files: files.rows, log: log.rows });
  } catch (err) {
    console.error('Get work error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/installation/works — создать работу
// ============================================================================

router.post('/works', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { project_id, building_id, work_type_id, floor_id, construction_id,
            planned_date, notes, materials } = req.body;

    if (!project_id) { res.status(400).json({ error: 'project_id обязателен' }); return; }
    if (!await hasProjectAccess(userId, project_id)) { res.status(403).json({ error: 'Нет доступа' }); return; }

    const workResult = await pool.query(
      `INSERT INTO installation_works (project_id, building_id, work_type_id, floor_id, construction_id, planned_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [project_id, building_id || null, work_type_id || null, floor_id || null,
       construction_id || null, planned_date || null, notes || null, userId]
    );
    const work = workResult.rows[0];

    // Привязка материалов из заявок
    if (materials && Array.isArray(materials)) {
      for (const m of materials) {
        if (m.order_item_id && m.required_qty > 0) {
          await pool.query(
            'INSERT INTO installation_materials (work_id, order_item_id, required_qty) VALUES ($1, $2, $3)',
            [work.id, m.order_item_id, m.required_qty]
          );
        }
      }
    }

    // Лог
    await pool.query(
      `INSERT INTO installation_log (work_id, action, created_by) VALUES ($1, 'created', $2)`,
      [work.id, userId]
    );

    res.status(201).json(work);
  } catch (err) {
    console.error('Create work error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/installation/works/:id/start — начать процесс монтажа
// ============================================================================

router.post('/works/:id/start', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const workId = req.params.id;

    const result = await pool.query(
      `UPDATE installation_works SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'planned' RETURNING *`,
      [workId]
    );
    if (result.rows.length === 0) { res.status(400).json({ error: 'Работа не найдена или уже начата' }); return; }

    await pool.query(
      `INSERT INTO installation_log (work_id, action, created_by) VALUES ($1, 'started', $2)`,
      [workId, userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Start work error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/installation/works/:id/use-material — зафиксировать использование материала
// ============================================================================

router.post('/works/:id/use-material', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const workId = req.params.id;
    const { installation_material_id, quantity } = req.body;

    if (!installation_material_id || !quantity || quantity <= 0) {
      res.status(400).json({ error: 'installation_material_id и quantity обязательны' }); return;
    }

    // Обновляем used_qty
    const result = await pool.query(
      `UPDATE installation_materials SET used_qty = used_qty + $1
       WHERE id = $2 AND work_id = $3 RETURNING *`,
      [quantity, installation_material_id, workId]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Материал не найден' }); return; }

    // Лог
    await pool.query(
      `INSERT INTO installation_log (work_id, action, details, created_by)
       VALUES ($1, 'material_used', $2, $3)`,
      [workId, JSON.stringify({ material_id: installation_material_id, quantity }), userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Use material error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/installation/works/:id/complete — завершить монтаж
// ============================================================================

router.post('/works/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const workId = req.params.id;
    const { dispositions } = req.body;
    // dispositions: [{ order_item_id, quantity, disposition: 'scrap'|'returned', notes }]

    // Завершаем работу
    const result = await pool.query(
      `UPDATE installation_works SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'in_progress' RETURNING *`,
      [workId]
    );
    if (result.rows.length === 0) { res.status(400).json({ error: 'Работа не найдена или не в процессе' }); return; }

    // Сохраняем распределение остатков
    if (dispositions && Array.isArray(dispositions)) {
      for (const d of dispositions) {
        if (d.order_item_id && d.quantity > 0 && (d.disposition === 'scrap' || d.disposition === 'returned')) {
          await pool.query(
            `INSERT INTO material_dispositions (work_id, order_item_id, quantity, disposition, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [workId, d.order_item_id, d.quantity, d.disposition, d.notes || null, userId]
          );
        }
      }
    }

    // Лог
    await pool.query(
      `INSERT INTO installation_log (work_id, action, details, created_by)
       VALUES ($1, 'completed', $2, $3)`,
      [workId, JSON.stringify({ dispositions_count: dispositions?.length || 0 }), userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Complete work error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/installation/available-materials?project_id=...&building_id=...&...
// Доступные материалы по заявкам для данной локации
// ============================================================================

router.get('/available-materials', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.project_id as string;
    const buildingId = req.query.building_id as string;
    const workTypeId = req.query.work_type_id as string;
    const floorId = req.query.floor_id as string;
    const constructionId = req.query.construction_id as string;

    if (!projectId) { res.status(400).json({ error: 'project_id обязателен' }); return; }

    let sql = `
      SELECT moi.id as order_item_id, moi.quantity as ordered_qty, moi.delivered_qty,
             dm.name as material_name, du.short_name as unit_short,
             mo.order_number, mo.id as order_id, mo.status as order_status,
             moi.delivered_qty - coalesce((
               SELECT sum(im.used_qty) FROM installation_materials im WHERE im.order_item_id = moi.id
             ), 0) + coalesce((
               SELECT sum(md.quantity) FROM material_dispositions md
               WHERE md.order_item_id = moi.id AND md.disposition = 'returned'
             ), 0) as available_qty
      FROM material_order_items moi
      JOIN material_orders mo ON mo.id = moi.order_id
      JOIN dict_materials dm ON dm.id = moi.material_id
      LEFT JOIN dict_units du ON du.id = dm.unit_id
      WHERE mo.project_id = $1 AND mo.status != 'cancelled' AND mo.status != 'draft'`;
    const params: unknown[] = [projectId];
    let idx = 2;

    if (buildingId) { sql += ` AND mo.building_id = $${idx++}`; params.push(buildingId); }
    if (workTypeId) { sql += ` AND mo.work_type_id = $${idx++}`; params.push(workTypeId); }
    if (floorId) { sql += ` AND mo.floor_id = $${idx++}`; params.push(floorId); }
    if (constructionId) { sql += ` AND mo.construction_id = $${idx++}`; params.push(constructionId); }

    sql += ` ORDER BY mo.order_number, dm.name`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get available materials error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
