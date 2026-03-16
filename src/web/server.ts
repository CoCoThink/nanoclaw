import express, { Request, Response } from 'express';
import { createServer } from 'http';
import WebSocketImport from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { SessionManager } from './session-manager.js';
import { createApiRouter } from './api-router.js';
import { logger } from '../logger.js';

// Access Server and WebSocket from the imported module
const WebSocket = WebSocketImport;
const WebSocketServer = (WebSocketImport as any).Server;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WebServerConfig {
  port: number;
  authToken: string;
  onMessage: (jid: string, content: string) => void;
}

export class WebServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer> | null = null;
  private wss: any | null = null;
  private sessionManager: SessionManager;
  private config: WebServerConfig;
  private isRunning = false;

  constructor(config: WebServerConfig) {
    this.config = config;
    this.sessionManager = new SessionManager({ authToken: config.authToken });
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // API routes
    const apiRouter = createApiRouter({
      sessionManager: this.sessionManager,
      onMessage: this.config.onMessage,
    });
    this.app.use('/api', apiRouter);

    // Serve static HTML for web UI
    this.app.get('/', (_req: Request, res: Response) => {
      const htmlPath = path.join(__dirname, 'public', 'index.html');
      res.sendFile(htmlPath);
    });

    // Favicon and other static assets
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Web server is already running');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.server = createServer(this.app);

        // Create WebSocket server
        this.wss = new WebSocketServer({ server: this.server });

        this.setupWebSocket();

        // Start listening
        this.server.listen(this.config.port, () => {
          this.isRunning = true;
          logger.info({ port: this.config.port }, 'Web server started');
          console.log(`\n  Web UI: http://localhost:${this.config.port}`);
          console.log(`  API: http://localhost:${this.config.port}/api\n`);
          resolve();
        });

        this.server.on('error', (err) => {
          logger.error({ err }, 'Web server error');
          reject(err);
        });
      } catch (err) {
        logger.error({ err }, 'Failed to start web server');
        reject(err);
      }
    });
  }

  private setupWebSocket(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: any, req: any) => {
      // Extract session ID from query string
      const url = new URL(req.url || '', `http://localhost:${this.config.port}`);
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        logger.warn('WebSocket connection without sessionId');
        ws.close(4000, 'Session ID required');
        return;
      }

      const session = this.sessionManager.getSession(sessionId);
      if (!session) {
        logger.warn({ sessionId }, 'WebSocket connection with invalid sessionId');
        ws.close(4001, 'Invalid session');
        return;
      }

      // Bind WebSocket to session
      this.sessionManager.bindWebSocket(sessionId, ws);
      logger.info({ sessionId }, 'WebSocket connected');

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'message' && message.content) {
            // Add to session history
            this.sessionManager.addMessage(sessionId, message.content, 'user');

            // Notify handler
            this.config.onMessage(session.jid, message.content);
          }
        } catch (err) {
          logger.error({ err, sessionId }, 'Failed to parse WebSocket message');
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        this.sessionManager.unbindWebSocket(sessionId);
        logger.info({ sessionId }, 'WebSocket disconnected');
      });

      // Handle errors
      ws.on('error', (err: Error) => {
        logger.error({ err, sessionId }, 'WebSocket error');
        this.sessionManager.unbindWebSocket(sessionId);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        sessionId,
        messages: this.sessionManager.getMessages(sessionId),
      }));
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.server || !this.wss) {
      return;
    }

    return new Promise((resolve) => {
      // Close all WebSocket connections
      this.wss!.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      });

      // Close WebSocket server
      this.wss!.close(() => {
        // Close HTTP server
        this.server!.close(() => {
          this.isRunning = false;
          this.server = null;
          this.wss = null;
          logger.info('Web server stopped');
          resolve();
        });
      });
    });
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }
}