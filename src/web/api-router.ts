import { Router, Request, Response } from 'express';
import { SessionManager, SessionMessage } from './session-manager.js';
import { logger } from '../logger.js';

export interface ApiRouterConfig {
  sessionManager: SessionManager;
  onMessage: (jid: string, content: string) => void;
}

export interface CreateSessionRequest {
  token: string;
  type?: 'web' | 'api';
}

export interface CreateSessionResponse {
  sessionId: string;
  jid: string;
  type: 'web' | 'api';
  createdAt: string;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
}

export interface SendMessageResponse {
  messageId: string;
  timestamp: string;
}

export interface GetMessagesRequest {
  sessionId: string;
  since?: string; // ISO timestamp
}

export interface GetMessagesResponse {
  messages: Array<{
    id: string;
    content: string;
    sender: 'user' | 'assistant';
    timestamp: string;
  }>;
}

export interface ErrorResponse {
  error: string;
}

export function createApiRouter(config: ApiRouterConfig): Router {
  const router = Router();
  const { sessionManager, onMessage } = config;

  // Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Create session
  router.post('/session', (req: Request, res: Response<CreateSessionResponse | ErrorResponse>) => {
    try {
      const { token, type = 'api' } = req.body as CreateSessionRequest;

      if (!token) {
        res.status(400).json({ error: 'Token is required' });
        return;
      }

      const sessionType = sessionManager.validateToken(token);
      if (!sessionType) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      // Use the requested type if valid, otherwise fall back to token type
      const finalType = type === 'web' || type === 'api' ? type : sessionType;
      const session = sessionManager.createSession(finalType);

      logger.info({ sessionId: session.sessionId, type: finalType }, 'Session created');

      res.status(201).json({
        sessionId: session.sessionId,
        jid: session.jid,
        type: finalType,
        createdAt: session.createdAt.toISOString(),
      });
    } catch (err) {
      logger.error({ err }, 'Failed to create session');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Send message
  router.post('/message', (req: Request, res: Response<SendMessageResponse | ErrorResponse>) => {
    try {
      const { sessionId, content } = req.body as SendMessageRequest;

      if (!sessionId || !content) {
        res.status(400).json({ error: 'Session ID and content are required' });
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Add message to session
      const message = sessionManager.addMessage(sessionId, content, 'user');
      if (!message) {
        res.status(500).json({ error: 'Failed to store message' });
        return;
      }

      // Notify handler
      onMessage(session.jid, content);

      logger.debug({ sessionId, messageId: message.id }, 'Message received via API');

      res.status(201).json({
        messageId: message.id,
        timestamp: message.timestamp.toISOString(),
      });
    } catch (err) {
      logger.error({ err }, 'Failed to send message');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get messages (polling endpoint)
  router.get('/messages', (req: Request, res: Response<GetMessagesResponse | ErrorResponse>) => {
    try {
      const { sessionId, since } = req.query as { sessionId?: string; since?: string };

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Update last seen
      sessionManager.touchSession(sessionId);

      let messages: SessionMessage[];
      if (since) {
        const sinceDate = new Date(since);
        if (isNaN(sinceDate.getTime())) {
          res.status(400).json({ error: 'Invalid since timestamp' });
          return;
        }
        messages = sessionManager.getMessagesSince(sessionId, sinceDate);
      } else {
        messages = sessionManager.getMessages(sessionId);
      }

      res.json({
        messages: messages.map((m) => ({
          id: m.id,
          content: m.content,
          sender: m.sender,
          timestamp: m.timestamp.toISOString(),
        })),
      });
    } catch (err) {
      logger.error({ err }, 'Failed to get messages');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete session
  router.delete('/session/:sessionId', (req: Request, res: Response<void | ErrorResponse>) => {
    try {
      const { sessionId } = req.params;
      const deleted = sessionManager.deleteSession(sessionId);

      if (!deleted) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      logger.info({ sessionId }, 'Session deleted');
      res.status(204).send();
    } catch (err) {
      logger.error({ err }, 'Failed to delete session');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
