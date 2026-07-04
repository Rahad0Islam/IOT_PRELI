/**
 * app.ts
 *
 * Express application factory. Exported separately from `server.ts` so it
 * can be unit-tested without binding a port.
 */

import express from 'express';
import cors from 'cors';
import path from 'node:path';

import { config } from './config/config.js';
import { requestLogger } from './middleware/logger.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFound } from './middleware/notfound.middleware.js';

import { deviceRoutes } from './modules/devices/device.routes.js';
import { usageRoutes } from './modules/usage/usage.routes.js';
import { alertRoutes } from './modules/alerts/alert.routes.js';
import { runtimeRoutes } from './modules/runtime/runtime.routes.js';
import { officeRoutes } from './modules/office/office.routes.js';

export const createApp = (): express.Application => {
  const app = express();

  // CORS — default "*" for LAN-friendly dashboards.
  const origins = config.cors.origins.includes('*') ? '*' : config.cors.origins;
  app.use(cors({ origin: origins }));

  // Body parsing.
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request log.
  app.use(requestLogger);

  // Static public/ (welcome page).
  app.use(express.static(path.resolve(config.paths.publicDir)));

  // Healthcheck.
  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { uptime: process.uptime(), env: config.env } });
  });

  // API routes.
  app.use('/api/devices', deviceRoutes);
  app.use('/api/device', deviceRoutes); // /toggle lives under /api/device too
  app.use('/api/usage', usageRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/office', officeRoutes);
  app.use('/api/runtime', runtimeRoutes);
  app.use('/api/rooms', deviceRoutes); // /api/rooms/* is implemented in device.routes

  // 404 + error handler (order matters).
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
