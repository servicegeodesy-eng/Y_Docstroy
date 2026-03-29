import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pool from '../config/db';
import s3Client from '../config/s3';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hasProjectAccess } from '../middleware/permissions';
import { Readable } from 'stream';

const router = Router();
router.use(authMiddleware);

// Извлечь projectId из пути файла (формат: .../projects/{projectId}/...)
function extractProjectIdFromPath(filePath: string): string | null {
  const match = filePath.match(/projects\/([0-9a-f-]{36})\//i);
  return match ? match[1] : null;
}

// Проверить доступ пользователя к файлу по пути
async function checkFileAccess(userId: string, filePath: string): Promise<boolean> {
  const projectId = extractProjectIdFromPath(filePath);
  if (!projectId) return true; // legacy-формат без project — пропускаем (обратная совместимость)
  return hasProjectAccess(userId, projectId);
}

// Multer декодирует originalname как latin1 — исправляем на UTF-8
function fixFileName(name: string): string {
  try {
    return Buffer.from(name, 'latin1').toString('utf-8');
  } catch {
    return name;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// Единый бакет с префиксами по компаниям
const MAIN_BUCKET = process.env.S3_BUCKET || 'docstroy';

// Legacy-маппинг для обратной совместимости (скачивание старых файлов)
function getBucketName(bucketKey: string): string {
  if (bucketKey === MAIN_BUCKET) return MAIN_BUCKET;
  const legacyMap: Record<string, string> = {
    'cell-files': process.env.S3_BUCKET_CELL_FILES || 'docstroy-cell-files',
    'overlay-images': process.env.S3_BUCKET_OVERLAY_IMAGES || 'docstroy-overlay-images',
    'project-images': process.env.S3_BUCKET_PROJECT_IMAGES || 'docstroy-project-images',
    'fileshare-files': process.env.S3_BUCKET_FILESHARE_FILES || 'docstroy-fileshare-files',
  };
  return legacyMap[bucketKey] || bucketKey;
}

// Получить company_id проекта
async function getProjectCompanyId(projectId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT company_id FROM projects WHERE id = $1',
    [projectId]
  );
  return result.rows[0]?.company_id || null;
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

    const companyId = await getProjectCompanyId(projectId);
    const ext = path.extname(fixFileName(file.originalname));
    const storagePath = companyId
      ? `${companyId}/projects/${projectId}/cells/${cellId}/${uuidv4()}${ext}`
      : `${projectId}/${cellId}/${uuidv4()}${ext}`;
    const bucket = companyId ? MAIN_BUCKET : getBucketName('cell-files');

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const result = await pool.query(
      `INSERT INTO cell_files (cell_id, file_name, storage_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, storage_path`,
      [cellId, fixFileName(file.originalname), storagePath, file.size, file.mimetype, userId]
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
    const companyId = await getProjectCompanyId(oldFile.project_id);
    const ext = path.extname(fixFileName(file.originalname));
    const storagePath = companyId
      ? `${companyId}/projects/${oldFile.project_id}/cells/${oldFile.cell_id}/${uuidv4()}${ext}`
      : `${oldFile.project_id}/${oldFile.cell_id}/${uuidv4()}${ext}`;
    const bucket = companyId ? MAIN_BUCKET : getBucketName('cell-files');

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
      [fixFileName(file.originalname), storagePath, file.size, file.mimetype, userId, fileId]
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
    const { projectId } = req.body;
    if (!file) {
      res.status(400).json({ error: 'Файл обязателен' });
      return;
    }

    const ext = path.extname(fixFileName(file.originalname));
    let storagePath: string;
    let bucket: string;

    if (projectId) {
      const companyId = await getProjectCompanyId(projectId);
      if (companyId) {
        storagePath = `${companyId}/projects/${projectId}/overlays/${uuidv4()}${ext}`;
        bucket = MAIN_BUCKET;
      } else {
        storagePath = `${uuidv4()}${ext}`;
        bucket = getBucketName('overlay-images');
      }
    } else {
      storagePath = `${uuidv4()}${ext}`;
      bucket = getBucketName('overlay-images');
    }

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
    const { projectId } = req.body;
    if (!file) {
      res.status(400).json({ error: 'Файл обязателен' });
      return;
    }

    const ext = path.extname(fixFileName(file.originalname));
    let storagePath: string;
    let bucket: string;

    if (projectId) {
      const companyId = await getProjectCompanyId(projectId);
      if (companyId) {
        storagePath = `${companyId}/projects/${projectId}/fileshare/${uuidv4()}${ext}`;
        bucket = MAIN_BUCKET;
      } else {
        storagePath = `${uuidv4()}${ext}`;
        bucket = getBucketName('fileshare-files');
      }
    } else {
      storagePath = `${uuidv4()}${ext}`;
      bucket = getBucketName('fileshare-files');
    }

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

// POST /api/files/upload — generic S3 upload (для uploadRawFile: remarks, gro, supervision и т.д.)
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    const bucketKey = req.body.bucket as string;
    const storagePath = req.body.path as string;

    if (!file || !storagePath) {
      res.status(400).json({ error: 'file и path обязательны' });
      return;
    }

    // Защита от path traversal
    if (storagePath.includes('..') || storagePath.startsWith('/')) {
      res.status(400).json({ error: 'Недопустимый путь файла' });
      return;
    }

    // Проверка доступа к проекту
    if (!await checkFileAccess(req.userId!, storagePath)) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const bucket = storagePath.includes('/projects/') ? MAIN_BUCKET : getBucketName(bucketKey || 'cell-files');

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    res.status(201).json({ storage_path: storagePath });
  } catch (err) {
    console.error('Generic upload error:', err);
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

    // Проверка доступа к проекту
    if (!await checkFileAccess(req.userId!, filePath)) {
      res.status(403).json({ error: 'Нет доступа к файлу' });
      return;
    }

    // Новый формат пути (company/projects/...) → единый бакет
    const bucket = filePath.includes('/projects/') ? MAIN_BUCKET : getBucketName(bucketKey);

    const command = new GetObjectCommand({ Bucket: bucket, Key: filePath });
    const response = await s3Client.send(command);

    if (response.ContentType) {
      res.setHeader('Content-Type', response.ContentType);
    }
    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength.toString());
    }

    const fileName = path.basename(filePath);
    const encodedName = encodeURIComponent(fileName);
    res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);

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

    if (!await checkFileAccess(req.userId!, filePath)) {
      res.status(403).json({ error: 'Нет доступа к файлу' });
      return;
    }

    const bucket = filePath.includes('/projects/') ? MAIN_BUCKET : getBucketName(bucketKey);
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

    // Проверка доступа к проекту для каждого файла
    for (const p of paths) {
      if (!await checkFileAccess(req.userId!, p)) {
        res.status(403).json({ error: 'Нет доступа к файлу' });
        return;
      }
    }

    // Разделяем пути по бакетам: новый формат → MAIN_BUCKET, старый → legacy
    const newFormatPaths = paths.filter((p: string) => p.includes('/projects/'));
    const legacyPaths = paths.filter((p: string) => !p.includes('/projects/'));

    if (newFormatPaths.length > 0) {
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: MAIN_BUCKET,
        Delete: { Objects: newFormatPaths.map((key: string) => ({ Key: key })) },
      }));
    }

    if (legacyPaths.length > 0) {
      const bucket = getBucketName(bucketKey);
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: legacyPaths.map((key: string) => ({ Key: key })) },
      }));
    }

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

    // Определяем бакет: новый формат (company_id/projects/...) → MAIN_BUCKET, иначе legacy
    const isNewFormat = fileRecord.storage_path.includes('/projects/');
    const bucket = isNewFormat ? MAIN_BUCKET : getBucketName('cell-files');

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
