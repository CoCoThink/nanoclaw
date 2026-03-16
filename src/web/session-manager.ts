import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

export interface WebSession {
  sessionId: string;
  jid: string;
  type: 'web' | 'api';
  websocket?: WebSocket;
  lastSeen: Date;
  createdAt: Date;
  messages: SessionMessage[];
}

export interface SessionMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export interface SessionManagerConfig {
  authToken: string;
  sessionTimeoutMs?: number;
}

export class SessionManager {
  private sessions = new Map<string, WebSession>();
  private config: SessionManagerConfig;

  constructor(config: SessionManagerConfig) {
    this.config = {
      sessionTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours default
      ...config,
    };
  }

  /**
   * Validate an auth token and return the session type if valid
   */
  validateToken(token: string): 'web' | 'api' | null {
    if (token === this.config.authToken) {
      return 'web';
    }
    // Could extend to support separate API tokens
    return null;
  }

  /**
   * Create a new session
   */
  createSession(type: 'web' | 'api'): WebSession {
    const sessionId = uuidv4();
    const session: WebSession = {
      sessionId,
      jid: `${type}:${sessionId}`,
      type,
      lastSeen: new Date(),
      createdAt: new Date(),
      messages: [],
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): WebSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Bind a WebSocket to a session
   */
  bindWebSocket(sessionId: string, ws: WebSocket): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.websocket = ws;
    session.lastSeen = new Date();
    return true;
  }

  /**
   * Unbind WebSocket from a session
   */
  unbindWebSocket(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.websocket = undefined;
    }
  }

  /**
   * Update last seen timestamp
   */
  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastSeen = new Date();
    }
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, content: string, sender: 'user' | 'assistant'): SessionMessage | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const message: SessionMessage = {
      id: uuidv4(),
      content,
      sender,
      timestamp: new Date(),
    };
    session.messages.push(message);
    session.lastSeen = new Date();
    return message;
  }

  /**
   * Get messages since a timestamp
   */
  getMessagesSince(sessionId: string, since: Date): SessionMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.messages.filter((m) => m.timestamp >= since);
  }

  /**
   * Get all messages for a session
   */
  getMessages(sessionId: string): SessionMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? [...session.messages] : [];
  }

  /**
   * Get session by JID
   */
  getSessionByJid(jid: string): WebSession | null {
    for (const session of this.sessions.values()) {
      if (session.jid === jid) {
        return session;
      }
    }
    return null;
  }

  /**
   * Remove stale sessions
   */
  cleanupStale(): number {
    const now = new Date();
    const timeout = this.config.sessionTimeoutMs!;
    let removed = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.lastSeen.getTime();
      if (age > timeout) {
        // Close WebSocket if still connected
        if (session.websocket && session.websocket.readyState === WebSocket.OPEN) {
          session.websocket.close();
        }
        this.sessions.delete(sessionId);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): WebSession[] {
    return [...this.sessions.values()];
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.websocket && session.websocket.readyState === WebSocket.OPEN) {
        session.websocket.close();
      }
      return this.sessions.delete(sessionId);
    }
    return false;
  }
}
