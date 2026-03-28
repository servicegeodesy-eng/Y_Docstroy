import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pool from '../config/db.js';
import s3Client from '../config/s3.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { hasProjectAccess } from '../middleware/permissions.js';
import { Readable } from 'stream';

const router = Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

function getBucketName(bucketKey: string): string {
  const map: Record<string, string> = {
    'cell-files': process.env.S3_BUCKET_CELL_FILES || 'docstroy-cell-files',
    'overlay-images': process.env.S3_BUCKET_OVERLAY_IMAGES || 'docstroy-overlay-images',
    'project-images': process.env.S3_BUCKET_PROJECT_IMAGES || 'docstroy-project-images',
    'fileshare-files': process.env.S3_BUCKET_FILESHARE_FILES || 'docstroy-fileshare-files',
  };
  return map[bucketKey] || bucketKey;
}

// POST /api/files/cell — upload cell file
router.post('/cell', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const file = req.file;
    const { cellId, projectId } = req.body;

    if (!file || !cellId || !projectId) {
      res.status(400).json({ error: 'file, cellId и projectId обязательны' });
      return;
    }

    const access = await hasProjectAccess(userId, projectId);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const ext = path.extname(file.originalname);
    const storagePath = `${projectId}/${cellId}/${uuidv4()}${ext}`;
    const bucket = getBucketName('cell-files');

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const result = await pool.query(
      `INSERT INTO cell_files (cell_id, file_name, storage_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, storage_path`,
      [cellId, file.originalname, storagePath, file.size, file.mimetype, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload cell file error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/files/cell/:fileId/version — replace file version
router.post('/cell/:fileId/version', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const fileId = req.params.fileId;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Файл обязателен' });
      return;
    }

    const existing = await pool.query(
      `SELECT cf.*, c.project_id FROM cell_files cf
       JOIN cells c ON c.id = cf.cell_id
       WHERE cf.id = $1`,
      [fileId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Файл не найден' });
      return;
    }

    const oldFile = existing.rows[0];
    const access = await hasProjectAccess(userId, oldFile.project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    // Save old version
    await pool.query(
      `INSERT INTO cell_file_versions (cell_file_id, file_name, storage_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fileId, oldFile.file_name, oldFile.storage_path, oldFile.file_size, oldFile.mime_type, oldFile.uploaded_by]
    );

    // Upload new version
    const ext = path.extname(file.originalname);
    const storagePath = `${oldFile.project_id}/${oldFile.cell_id}/${uuidv4()}${ext}`;
    const bucket = getBucketName('cell-files');

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    // Update record
    const result = await pool.query(
      `UPDATE cell_files SET file_name = $1, storage_path = $2, file_size = $3, mime_type = $4, uploaded_by = $5, updated_at = NOW()
       WHERE id = $6 RETURNING id, storage_path`,
      [file.originalname, storagePath, file.size, file.mimetype, userId, fileId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Upload file version error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/files/overlay — upload overlay image
router.post('/overlay', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Файл обязателен' });
      return;
    }

    const ext = path.extname(file.originalname);
    const storagePath = `${uuidv4()}${ext}`;
    const bucket = getBucketName('overlay-images');

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    res.status(201).json({ storage_path: storagePath });
  } catch (err) {
    console.error('Upload overlay error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/files/fileshare — upload fileshare file
router.post('/fileshare', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Файл обязателен' });
      return;
    }

    const ext = path.extname(file.originalname);
    const storagePath = `${uuidv4()}${ext}`;
    const bucket = getBucketName('fileshare-files');

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    res.status(201).json({ storage_path: storagePath });
  } catch (err) {
    console.error('Upload fileshare error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/files/download?bucket=...&path=...
router.get('/download', async (req: AuthRequest, res: Response) => {
  try {
    const bucketKey = req.query.bucket as string;
    const filePath = req.query.path as string;

    if (!bucketKey || !filePath) {
      res.status(400).json({ error: 'bucket и path обязательны' });
      return;
    }

    const bucket = getBucketName(bucketKey);

    const command = new GetObjectCommand({ Bucket: bucket, Key: filePath });
    const response = await s3Client.send(command);

    if (response.ContentType) {
      res.setHeader('Content-Type', response.ContentType);
    }
    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength.toString());
    }

    const fileName = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    if (response.Body instanceof Readable) {
      response.Body.pipe(res);
    } else {
      const bytes = await response.Body!.transformToByteArray();
      res.send(Buffer.from(bytes));
    }
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Ошибка скачивания' });
  }
});

// GET /api/files/signed-url?bucket=...&path=...&expiresIn=3600
router.get('/signed-url', async (req: AuthRequest, res: Response) => {
  try {
    const bucketKey = req.query.bucket as string;
    const filePath = req.query.path as string;
    const expiresIn = parseInt(req.query.expiresIn as string, 10) || 3600;

    if (!bucketKey || !filePath) {
      res.status(400).json({ error: 'bucket и path обязательны' });
      return;
    }

    const bucket = getBucketName(bucketKey);
    const command = new GetObjectCommand({ Bucket: bucket, Key: filePath });
    const url = await getSignedUrl(s3Client, command, { expiresIn });

    res.json({ url });
  } catch (err) {
    console.error('Signed URL error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/files/remove
router.post('/remove', async (req: AuthRequest, res: Response) => {
  try {
    const { bucket: bucketKey, paths } = req.body;

    if (!bucketKey || !Array.isArray(paths) || paths.length === 0) {
      res.status(400).json({ error: 'bucket и paths обязательны' });
      return;
    }

    const bucket = getBucketName(bucketKey);

    await s3Client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: paths.map((key: string) => ({ Key: key })),
      },
    }));

    res.json({ ok: true });
  } catch (err) {
    console.error('Remove files error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/files/cell/:fileId
router.delete('/cell/:fileId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const fileId = req.params.fileId;

    const existing = await pool.query(
      `SELECT cf.*, c.project_id FROM cell_files cf
       JOIN cells c ON c.id = cf.cell_id
       WHERE cf.id = $1`,
      [fileId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Файл не найден' });
      return;
    }

    const fileRecord = existing.rows[0];
    const access = await hasProjectAccess(userId, fileRecord.project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const bucket = getBucketName('cell-files');

    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: fileRecord.storage_path,
    }));

    await pool.query('DELETE FROM cell_files WHERE id = $1', [fileId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete cell file error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
