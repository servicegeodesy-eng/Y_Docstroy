import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import cellRoutes from './routes/cells.js';
import fileRoutes from './routes/files.js';
import dictionaryRoutes from './routes/dictionaries.js';
import overlayRoutes from './routes/overlays.js';
import statusRoutes from './routes/statuses.js';
import userRoutes from './routes/users.js';
import permissionRoutes from './routes/permissions.js';
import requestRoutes from './routes/requests.js';
import taskRoutes from './routes/tasks.js';
import fileshareRoutes from './routes/fileshare.js';
import notificationRoutes from './routes/notifications.js';
import pushRoutes from './routes/push.js';
import rpcRoutes from './routes/rpc.js';

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
app.use('/api/rpc', rpcRoutes);

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
