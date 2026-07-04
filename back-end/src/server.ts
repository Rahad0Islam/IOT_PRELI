/**
 * server.ts
 *
 * Process entry-point. Wires the HTTP server, Socket.IO, the database,
 * the simulator, the alert scheduler and the Discord bot together.
 */

import http from 'node:http';

import { createApp } from './app.js';
import { config } from './config/config.js';
import { databaseService } from './database/database.service.js';
import { socketService } from './socket/socket.service.js';
import { simulatorService } from './modules/simulator/simulator.service.js';
import { alertScheduler } from './modules/alerts/alert.scheduler.js';
import { discordService } from './modules/discord/discord.service.js';
import { runtimeService } from './modules/runtime/runtime.service.js';
import { logger } from './utils/logger.js';

const bootstrap = async (): Promise<void> => {
  logger.info('boot', `starting office-iot backend (env=${config.env})`);

  // 1. Database (must be initialised before any service that reads data).
  await databaseService.init();

  // 2. HTTP server + Express app.
  const app = createApp();
  const httpServer = http.createServer(app);

  // 3. Socket.IO bound to the same HTTP server.
  socketService.init(httpServer);

  // 4. Runtime tracking service.
  // Must init after the database (it seeds records from the live device
  // list) and before the simulator/alert workers — once it starts ticking,
  // those workers should see a fully-initialised runtime history.
  await runtimeService.init();
  runtimeService.start();

  // 5. Start background workers.
  simulatorService.start();
  alertScheduler.start();

  // 5. Discord bot (non-blocking — won't crash server if token missing).
  discordService.init().catch((err) => logger.warn('discord', 'init error', err));

  // 6. Listen.
  httpServer.listen(config.port, () => {
    logger.info('boot', `HTTP listening on http://localhost:${config.port}`);
    logger.info('boot', `Socket.IO listening on ws://localhost:${config.port}`);
    logger.info('boot', `Dashboard backend ready`);
  });

  // Graceful shutdown.
  const shutdown = (signal: string) => {
    logger.info('boot', `received ${signal}, shutting down…`);
    simulatorService.stop();
    alertScheduler.stop();
    runtimeService.stop();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

bootstrap().catch((err) => {
  logger.error('boot', 'bootstrap failed', err);
  process.exit(1);
});
