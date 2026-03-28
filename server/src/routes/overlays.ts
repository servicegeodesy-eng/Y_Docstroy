import { Router, Response } from 'express';
import pool from '../config/db.js';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import s3Client from '../config/s3.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { hasProjectAccess } from '../middleware/permissions.js';

const router = Router();
router.use(authMiddleware);

// GET /api/overlays?project_id=...
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = req.query.project_id as string;

    if (!projectId) {
      res.status(400).json({ error: 'project_id обязателен' });
      return;
    }

    const access = await hasProjectAccess(userId, projectId);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const overlays = await pool.query(
      'SELECT * FROM dict_overlays WHERE project_id = $1 ORDER BY sort_order, id',
      [projectId]
    );

    const overlayIds = overlays.rows.map((o: { id: number }) => o.id);

    if (overlayIds.length > 0) {
      const [axisGrids, buildings, floors, constructions] = await Promise.all([
        pool.query('SELECT * FROM dict_overlay_axis_grids WHERE overlay_id = ANY($1)', [overlayIds]),
        pool.query('SELECT * FROM dict_overlay_buildings WHERE overlay_id = ANY($1)', [overlayIds]),
        pool.query('SELECT * FROM dict_overlay_floors WHERE overlay_id = ANY($1)', [overlayIds]),
        pool.query('SELECT * FROM dict_overlay_constructions WHERE overlay_id = ANY($1)', [overlayIds]),
      ]);

      const groupBy = <T extends Record<string, unknown>>(rows: T[], key: string) => {
        const map = new Map<number, T[]>();
        for (const row of rows) {
          const id = row[key] as number;
          if (!map.has(id)) map.set(id, []);
          map.get(id)!.push(row);
        }
        return map;
      };

      const axisMap = groupBy(axisGrids.rows, 'overlay_id');
      const buildingsMap = groupBy(buildings.rows, 'overlay_id');
      const floorsMap = groupBy(floors.rows, 'overlay_id');
      const constructionsMap = groupBy(constructions.rows, 'overlay_id');

      for (const overlay of overlays.rows) {
        overlay.axis_grids = axisMap.get(overlay.id) || [];
        overlay.buildings = buildingsMap.get(overlay.id) || [];
        overlay.floors = floorsMap.get(overlay.id) || [];
        overlay.constructions = constructionsMap.get(overlay.id) || [];
      }
    }

    res.json(overlays.rows);
  } catch (err) {
    console.error('Get overlays error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/overlays
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { project_id, name, image_path, width, height, sort_order } = req.body;

    if (!project_id || !name) {
      res.status(400).json({ error: 'project_id и name обязательны' });
      return;
    }

    const access = await hasProjectAccess(userId, project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO dict_overlays (project_id, name, image_path, width, height, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [project_id, name, image_path || null, width || null, height || null, sort_order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create overlay error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/overlays/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const overlayId = req.params.id;

    const existing = await pool.query('SELECT project_id FROM dict_overlays WHERE id = $1', [overlayId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Подложка не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const allowedFields = ['name', 'image_path', 'width', 'height', 'sort_order'];
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(req.body[field]);
      }
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'Нечего обновлять' });
      return;
    }

    values.push(overlayId);
    const result = await pool.query(
      `UPDATE dict_overlays SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update overlay error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/overlays/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const overlayId = req.params.id;

    const existing = await pool.query('SELECT project_id, image_path FROM dict_overlays WHERE id = $1', [overlayId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Подложка не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    // Delete image from S3
    if (existing.rows[0].image_path) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_OVERLAY_IMAGES || 'docstroy-overlay-images',
          Key: existing.rows[0].image_path,
        }));
      } catch (s3Err) {
        console.error('S3 delete overlay image error:', s3Err);
      }
    }

    await pool.query('DELETE FROM dict_overlays WHERE id = $1', [overlayId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete overlay error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/overlays/:id/axis-link
router.post('/:id/axis-link', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const overlayId = req.params.id;
    const { axis_grid_id, x, y } = req.body;

    const existing = await pool.query('SELECT project_id FROM dict_overlays WHERE id = $1', [overlayId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Подложка не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO dict_overlay_axis_grids (overlay_id, axis_grid_id, x, y) VALUES ($1, $2, $3, $4) RETURNING *',
      [overlayId, axis_grid_id, x || null, y || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Axis link error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/overlays/:id/axis-points
router.get('/:id/axis-points', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const overlayId = req.params.id;

    const existing = await pool.query('SELECT project_id FROM dict_overlays WHERE id = $1', [overlayId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Подложка не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM overlay_axis_points WHERE overlay_id = $1',
      [overlayId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get axis points error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/overlays/:id/axis-points
router.post('/:id/axis-points', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const overlayId = req.params.id;
    const { points } = req.body;

    if (!Array.isArray(points)) {
      res.status(400).json({ error: 'points должен быть массивом' });
      return;
    }

    const existing = await pool.query('SELECT project_id FROM dict_overlays WHERE id = $1', [overlayId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Подложка не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM overlay_axis_points WHERE overlay_id = $1', [overlayId]);

      for (const point of points) {
        await client.query(
          'INSERT INTO overlay_axis_points (overlay_id, axis_name, pixel_x, pixel_y, real_x, real_y) VALUES ($1, $2, $3, $4, $5, $6)',
          [overlayId, point.axis_name, point.pixel_x, point.pixel_y, point.real_x, point.real_y]
        );
      }

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Save axis points error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
