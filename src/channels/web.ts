import { WebServer } from '../web/server.js';
import { logger } from '../logger.js';
import { registerChannel, ChannelOpts } from './registry.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';
import { readEnvFile } from '../env.js';

export interface WebChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
  registerGroup: (jid: string, group: RegisteredGroup) => void;
}

export class WebChannel implements Channel {
  name = 'web';

  private server: WebServer | null = null;
  private opts: WebChannelOpts;
  private port: number;
  private authToken: string;

  constructor(port: number, authToken: string, opts: WebChannelOpts) {
    this.port = port;
    this.authToken = authToken;
    this.opts = opts;
  }

  async connect(): Promise<void> {
    this.server = new WebServer({
      port: this.port,
      authToken: this.authToken,
      onMessage: (jid, content) => this.handleInboundMessage(jid, content),
    });

    await this.server.start();
    logger.info({ port: this.port }, 'Web channel connected');
  }

  private handleInboundMessage(jid: string, content: string): void {
    if (!this.server) return;

    const sessionManager = this.server.getSessionManager();
    const session = sessionManager.getSessionByJid(jid);
    if (!session) {
      logger.warn({ jid }, 'Message from unknown session');
      return;
    }

    const timestamp = new Date().toISOString();

    // Store chat metadata for discovery
    this.opts.onChatMetadata(
      jid,
      timestamp,
      `Web ${session.type === 'web' ? 'UI' : 'API'} (${session.sessionId.substring(0, 8)})`,
      'web',
      false, // Not a group chat
    );

    // Auto-register new web sessions on first message
    let group = this.opts.registeredGroups()[jid];
    if (!group) {
      const triggerPattern = process.env.TRIGGER_PATTERN || '@Andy';
      this.opts.registerGroup(jid, {
        name: `Web ${session.type === 'web' ? 'UI' : 'API'} (${session.sessionId.substring(0, 8)})`,
        folder: `web_${session.sessionId.substring(0, 8)}`,
        trigger: triggerPattern,
        added_at: new Date().toISOString(),
        containerConfig: undefined,
        requiresTrigger: false, // Web sessions don't need trigger prefix
      });
      group = this.opts.registeredGroups()[jid];
      logger.info(
        { jid, folder: group?.folder },
        'Web session auto-registered',
      );
    }

    // Only deliver full message for registered sessions
    if (!group) {
      logger.warn({ jid }, 'Failed to register web session');
      return;
    }

    // Deliver message — startMessageLoop() will pick it up
    this.opts.onMessage(jid, {
      id: session.messages[session.messages.length - 1]?.id || '',
      chat_jid: jid,
      sender: session.sessionId,
      sender_name: session.type === 'web' ? 'Web User' : 'API Client',
      content,
      timestamp,
      is_from_me: false,
    });

    logger.info({ jid, sender: session.type }, 'Web message stored');
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.server) {
      logger.warn('Web server not initialized');
      return;
    }

    const sessionManager = this.server.getSessionManager();
    const session = sessionManager.getSessionByJid(jid);

    if (!session) {
      logger.warn({ jid }, 'Session not found for sendMessage');
      return;
    }

    // Add message to session history
    sessionManager.addMessage(session.sessionId, text, 'assistant');

    // Send via WebSocket if connected
    if (session.websocket && session.websocket.readyState === 1) {
      // WebSocket.OPEN
      try {
        session.websocket.send(
          JSON.stringify({
            type: 'message',
            content: text,
            timestamp: new Date().toISOString(),
          }),
        );
        logger.info(
          { jid, length: text.length },
          'Web message sent via WebSocket',
        );
      } catch (err) {
        logger.error({ jid, err }, 'Failed to send WebSocket message');
      }
    } else {
      logger.debug(
        { jid },
        'Message stored for API polling (WebSocket not connected)',
      );
    }
  }

  isConnected(): boolean {
    return this.server !== null && this.server.isServerRunning();
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('web:') || jid.startsWith('api:');
  }

  async disconnect(): Promise<void> {
    if (this.server) {
      await this.server.stop();
      this.server = null;
      logger.info('Web channel stopped');
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!this.server) return;

    const sessionManager = this.server.getSessionManager();
    const session = sessionManager.getSessionByJid(jid);

    if (session?.websocket && session.websocket.readyState === 1) {
      // WebSocket.OPEN
      try {
        session.websocket.send(
          JSON.stringify({
            type: 'typing',
            isTyping,
          }),
        );
      } catch (err) {
        logger.debug({ jid, err }, 'Failed to send typing indicator');
      }
    }
  }
}

registerChannel('web', (opts: ChannelOpts) => {
  const envVars = readEnvFile(['WEB_PORT', 'WEB_AUTH_TOKEN']);
  const port = parseInt(process.env.WEB_PORT || envVars.WEB_PORT || '3000', 10);
  const authToken = process.env.WEB_AUTH_TOKEN || envVars.WEB_AUTH_TOKEN;

  if (!authToken) {
    logger.warn(
      'Web: WEB_AUTH_TOKEN not set. Web channel will not be available.',
    );
    return null;
  }

  return new WebChannel(port, authToken, opts);
});
