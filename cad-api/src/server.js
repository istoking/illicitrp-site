import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { authMiddleware, requireAuth, loadPermissions } from './lib/middleware.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import cadRoutes from './routes/cad.js';
import adminRoutes from './routes/admin.js';

const app = express();

if ((process.env.TRUST_PROXY || '').toLowerCase() === 'true') {
  app.set('trust proxy', 1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.WEB_ORIGIN,
  credentials: true,
}));
app.use(morgan('combined'));
app.use(rateLimit({ windowMs: 60_000, max: 180 }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/health', (_, res) => res.json({ ok: true }));

app.use(authMiddleware);
app.use(loadPermissions);

app.use('/auth', authRoutes);
app.use('/me', requireAuth, meRoutes);
app.use('/cad', requireAuth, cadRoutes);
app.use('/admin', requireAuth, adminRoutes);

app.use((err, req, res, next) => {
  res.status(500).json({ error: 'server_error' });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`IRP CAD API listening on ${port}`);
});
