/**
 * socket/socket.service.ts
 *
 * Owns the Socket.IO server. Other modules call `socketService.emit(...)`
 * to push events to every connected dashboard client. Keep the channel
 * surface (event names) inside one file so we never typo an event name.
 */

import { Server as HttpServer } from 'node:http';
import { Server as IOServer } from 'socket.io';

import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { SocketEvent } from '../types/enums.js';

class SocketService {
  private io: IOServer | null = null;

  /**
   * Initialise Socket.IO bound to the HTTP server. CORS is permissive by
   * default (`*`) because the dashboard is meant to be LAN-reachable;
   * production deployments should restrict this via `CORS_ORIGINS`.
   */
  init(httpServer: HttpServer): void {
    const origins = config.cors.origins.includes('*') ? '*' : config.cors.origins;
    this.io = new IOServer(httpServer, {
      cors: { origin: origins, methods: ['GET', 'POST'] },
      serveClient: false,
    });

    this.io.on('connection', (socket) => {
      logger.debug('socket', `client connected: ${socket.id}`);
      socket.on('disconnect', () => {
        logger.debug('socket', `client disconnected: ${socket.id}`);
      });
    });

    logger.info('socket', 'Socket.IO initialised');
  }

  /** Convenience helper to guarantee init happened. */
  private getIO(): IOServer {
    if (!this.io) throw new Error('SocketService used before init()');
    return this.io;
  }

  /** Emit a typed event to every connected client. */
  emit<T>(event: SocketEvent, payload: T): void {
    this.getIO().emit(event, payload);
  }

  /** Get the raw server instance — only for the rare case where a controller needs it. */
  getRaw(): IOServer {
    return this.getIO();
  }
}

export const socketService = new SocketService();
