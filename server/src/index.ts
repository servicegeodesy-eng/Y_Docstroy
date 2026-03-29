import path from 'path';
import fs from 'fs';

// Yandex CA cert — должен быть загружен ДО любых pg-подключений
const caPath = [
  path.join(__dirname, '../certs/CA.pem'),
  path.join(process.cwd(), 'certs/CA.pem'),
  path.join(process.cwd(), 'server/certs/CA.pem'),
].find(p => fs.existsSync(p));
if (caPath) process.env.NODE_EXTRA_CA_CERTS = caPath;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import cellRoutes from './routes/cells';
import fileRoutes from './routes/files';
import dictionaryRoutes from './routes/dictionaries';
import overlayRoutes from './routes/overlays';
import statusRoutes from './routes/statuses';
import userRoutes from './routes/users';
import permissionRoutes from './routes/permissions';
import requestRoutes from './routes/requests';
import taskRoutes from './routes/tasks';
import fileshareRoutes from './routes/fileshare';
import notificationRoutes from './routes/notifications';
import pushRoutes from './routes/push';
import badgeRoutes from './routes/badges';
import rpcRoutes from './routes/rpc';
import companyRoutes from './routes/companies';
import genericRoutes from './routes/generic';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/cells', cellRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/dictionaries', dictionaryRoutes);
app.use('/api/overlays', overlayRoutes);
app.use('/api/statuses', statusRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/fileshare', fileshareRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/rpc', rpcRoutes);

// Generic CRUD fallback (MUST be last — catches /api/query/:table)
app.use('/api/query', genericRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
