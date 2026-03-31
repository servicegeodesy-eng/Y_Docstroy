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
import inviteRoutes from './routes/invites';
import subscriptionRoutes from './routes/subscriptions';
import materialRoutes from './routes/materials';
import installationRoutes from './routes/installation';
import companyRoutes from './routes/companies';
import leadRoutes from './routes/leads';
import genericRoutes from './routes/generic';

dotenv.config();

// Обязательные переменные — без них сервер не стартует
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters');
  process.exit(1);
}
if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
  console.error('FATAL: JWT_REFRESH_SECRET must be set and at least 32 characters');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL must be set');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
// CORS: поддержка списка origins через запятую (CORS_ORIGIN=https://a.com,https://b.com)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('CORS not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
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
app.use('/api/invites', inviteRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/installation', installationRoutes);
app.use('/api/leads', leadRoutes);

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
