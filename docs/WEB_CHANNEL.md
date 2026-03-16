# Web Channel Documentation / Web 通道文档

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## English

The web channel provides both a browser-based chat UI and a REST API for programmatic access to NanoClaw.

### Features

- **Web UI**: Browser-based chat interface with real-time messaging via WebSocket
- **REST API**: Programmatic access for integrations and scripts
- **Session Management**: UUID-based sessions with token authentication
- **Message History**: Persistent message history within session lifetime
- **Dual Access**: Same session can be accessed via both Web UI and API

### Installation

The web channel is included in NanoClaw core. No additional installation required.

#### Dependencies

The following packages are automatically installed with NanoClaw:
- `express` - HTTP server framework
- `ws` - WebSocket implementation
- `uuid` - Session ID generation

### Configuration

Add the following environment variables to your `.env` file:

```bash
# Web Channel Configuration
WEB_PORT=3000                    # Port for web server (default: 3000)
WEB_AUTH_TOKEN=your-secret-token # Required: Authentication token for sessions
WEB_BASE_URL=http://localhost:3000  # Optional: Base URL for references
```

**Important**: The web channel will not start without `WEB_AUTH_TOKEN` configured.

### Usage

#### Web UI (Browser)

1. **Start NanoClaw:**
   ```bash
   npm run dev
   # or
   npm run build && npm start
   ```

2. **Access the Web Interface:**
   - Open your browser to `http://localhost:3000`
   - You'll see an authentication screen

3. **Authenticate:**
   - Enter your `WEB_AUTH_TOKEN` from `.env`
   - Click "Connect"
   - The browser will create a session and establish a WebSocket connection

4. **Chat:**
   - Type messages in the input field
   - Messages are sent in real-time via WebSocket
   - Responses appear instantly in the chat window
   - Message history is preserved within the session

5. **Session Persistence:**
   - Your session is saved in browser localStorage
   - Refreshing the page will auto-reconnect
   - Sessions expire after 24 hours of inactivity

#### REST API (Programmatic Access)

##### 1. Create a Session

```bash
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-secret-token",
    "type": "api"
  }'
```

**Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "jid": "api:550e8400-e29b-41d4-a716-446655440000",
  "type": "api",
  "createdAt": "2026-03-13T10:30:00.000Z"
}
```

Save the `sessionId` for subsequent requests.

##### 2. Send a Message

```bash
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "content": "Hello, NanoClaw!"
  }'
```

**Response:**
```json
{
  "messageId": "660e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-13T10:31:00.000Z"
}
```

##### 3. Poll for Responses

```bash
# Get all messages
curl "http://localhost:3000/api/messages?sessionId=550e8400-e29b-41d4-a716-446655440000"

# Get messages since a specific timestamp
curl "http://localhost:3000/api/messages?sessionId=550e8400-e29b-41d4-a716-446655440000&since=2026-03-13T10:30:00.000Z"
```

**Response:**
```json
{
  "messages": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "content": "Hello, NanoClaw!",
      "sender": "user",
      "timestamp": "2026-03-13T10:31:00.000Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "content": "Hello! How can I help you?",
      "sender": "assistant",
      "timestamp": "2026-03-13T10:31:05.000Z"
    }
  ]
}
```

##### 4. Delete a Session

```bash
curl -X DELETE http://localhost:3000/api/session/550e8400-e29b-41d4-a716-446655440000
```

**Response:** HTTP 204 No Content

#### API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check endpoint |
| `/api/session` | POST | Create a new session |
| `/api/message` | POST | Send a message |
| `/api/messages` | GET | Poll for messages (supports `since` parameter) |
| `/api/session/:sessionId` | DELETE | Delete a session |

### Architecture

#### Session Types

- **Web Sessions (`web:sessionId`)**: Created via Web UI, use WebSocket for real-time messaging
- **API Sessions (`api:sessionId`)**: Created via REST API, use polling for message retrieval

Both types can access the same NanoClaw agent instance.

#### JID Format

- Web UI: `web:550e8400-e29b-41d4-a716-446655440000`
- API: `api:550e8400-e29b-41d4-a716-446655440000`

These JIDs can be registered with NanoClaw groups using the standard registration process.

#### Message Flow

##### Web UI Flow
```
Browser → WebSocket → WebChannel.sendMessage() → Agent Container
Agent Container → WebChannel.sendMessage() → WebSocket → Browser
```

##### API Flow
```
Script → POST /api/message → WebChannel.sendMessage() → Agent Container
Agent Container → WebChannel.sendMessage() → Session Store
Script → GET /api/messages → Session Store → Script
```

### Registering Web Sessions

To make a web session trigger the agent (similar to registering a WhatsApp group):

1. **Find your session JID:**
   - Web UI: Check browser console or server logs
   - API: Returned in the `/api/session` response

2. **Register the session:**
   - Send a message from the web UI/API
   - The session JID will appear in logs
   - Use the standard group registration process with the JID

Example:
```bash
# The agent sees messages from: web:550e8400-e29b-41d4-a716-446655440000
# Register it as a "group" (solo chat in this case):
# Add to your groups configuration
```

### Security Considerations

#### Token Authentication
- The `WEB_AUTH_TOKEN` is required for all session creation
- Keep this token secure and change it regularly
- Do not commit the token to version control

#### Session Management
- Sessions expire after 24 hours of inactivity
- Stale sessions are automatically cleaned up
- Each session has a unique UUID

#### Network Security
- By default, the web server binds to `localhost` only
- For remote access, use a reverse proxy with TLS
- Do not expose the web port directly to the internet

#### Production Deployment

For production use:

1. **Use HTTPS:**
   ```bash
   # Use a reverse proxy (nginx, caddy, traefik) with TLS
   # Example with Caddy:
   # yourdomain.com {
   #   reverse_proxy localhost:3000
   # }
   ```

2. **Secure the Token:**
   - Use a strong, random token (32+ characters)
   - Store in environment variables, not `.env` file
   - Rotate tokens periodically

3. **Rate Limiting:**
   - Implement rate limiting in your reverse proxy
   - Prevent abuse of the API endpoints

### Troubleshooting

#### Web Channel Not Starting

**Symptom:** No web server URL shown on startup

**Solution:**
- Check that `WEB_AUTH_TOKEN` is set in `.env`
- Verify the token is not empty
- Check logs for error messages

#### WebSocket Connection Fails

**Symptom:** Browser shows "Disconnected" status

**Solution:**
- Check browser console for errors
- Verify `WEB_PORT` is not blocked by firewall
- Ensure WebSocket protocol matches (ws:// vs wss://)

#### Authentication Errors

**Symptom:** "Invalid token" error when connecting

**Solution:**
- Verify the token matches exactly in `.env`
- Check for whitespace or special characters
- Restart NanoClaw after changing `.env`

#### Messages Not Received (API)

**Symptom:** Sent messages but `GET /api/messages` returns empty

**Solution:**
- Ensure session is registered with NanoClaw
- Check that agent is processing messages (check logs)
- Verify you're using the correct `sessionId`
- Try polling without `since` parameter to get all messages

#### Session Expired

**Symptom:** 404 errors when sending messages

**Solution:**
- Sessions expire after 24 hours of inactivity
- Create a new session with `/api/session`
- Web UI will auto-reconnect if token is saved

### Advanced Usage

#### Multiple Web Channels

You can run multiple NanoClaw instances with different ports:

```bash
# Instance 1
WEB_PORT=3000
WEB_AUTH_TOKEN=token1

# Instance 2
WEB_PORT=3001
WEB_AUTH_TOKEN=token2
```

#### Integration with Other Tools

The REST API can be used with any HTTP client:

**Python Example:**
```python
import requests
import json

# Create session
resp = requests.post('http://localhost:3000/api/session',
    json={'token': 'your-secret-token', 'type': 'api'})
session = resp.json()
session_id = session['sessionId']

# Send message
requests.post('http://localhost:3000/api/message',
    json={'sessionId': session_id, 'content': 'Hello from Python!'})

# Poll for response
resp = requests.get(f'http://localhost:3000/api/messages?sessionId={session_id}')
messages = resp.json()['messages']
print(messages)
```

**JavaScript/Node.js Example:**
```javascript
const response = await fetch('http://localhost:3000/api/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'your-secret-token', type: 'api' })
});
const session = await response.json();
const sessionId = session.sessionId;

// Send message
await fetch('http://localhost:3000/api/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId, content: 'Hello from Node.js!' })
});

// Poll for messages
const messagesResp = await fetch(`http://localhost:3000/api/messages?sessionId=${sessionId}`);
const { messages } = await messagesResp.json();
console.log(messages);
```

### Development

#### Running in Development Mode

```bash
npm run dev  # Hot reload enabled
```

#### Testing Web UI

```bash
# Start server
npm run dev

# Open browser
open http://localhost:3000
```

#### Testing API

```bash
# Health check
curl http://localhost:3000/api/health

# Create session and test
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{"token":"your-token","type":"api"}'
```

### File Structure

```
src/
├── channels/
│   ├── web.ts                    # WebChannel implementation
│   └── index.ts                  # Channel registration
├── web/
│   ├── server.ts                 # Express + WebSocket server
│   ├── session-manager.ts        # Session/token management
│   ├── api-router.ts             # REST API endpoints
│   └── public/
│       └── index.html            # Web UI (single-page app)
.env.example                      # Configuration template
```

### Related Documentation

- [NanoClaw README](../README.md) - Main documentation
- [Requirements](./REQUIREMENTS.md) - Architecture decisions
- [Channel Development](./CHANNELS.md) - Creating custom channels

---

<a name="中文"></a>
## 中文

Web 通道为 NanoClaw 提供了基于浏览器的聊天界面和 REST API 编程接口。

### 功能特性

- **Web UI**: 基于浏览器的聊天界面，通过 WebSocket 实现实时消息传递
- **REST API**: 用于集成和脚本的编程接口
- **会话管理**: 基于 UUID 的会话和 Token 认证
- **消息历史**: 在会话生命周期内持久化消息历史
- **双重访问**: 同一会话可通过 Web UI 和 API 访问

### 安装

Web 通道已包含在 NanoClaw 核心中，无需额外安装。

#### 依赖项

以下包会随 NanoClaw 自动安装：
- `express` - HTTP 服务器框架
- `ws` - WebSocket 实现
- `uuid` - 会话 ID 生成

### 配置

在 `.env` 文件中添加以下环境变量：

```bash
# Web Channel Configuration / Web 通道配置
WEB_PORT=3000                    # Web 服务器端口（默认：3000）
WEB_AUTH_TOKEN=your-secret-token # 必需：会话认证令牌
WEB_BASE_URL=http://localhost:3000  # 可选：基础 URL 引用
```

**重要提示**: 未配置 `WEB_AUTH_TOKEN` 时，Web 通道不会启动。

### 使用方法

#### Web UI（浏览器）

1. **启动 NanoClaw:**
   ```bash
   npm run dev
   # 或
   npm run build && npm start
   ```

2. **访问 Web 界面:**
   - 在浏览器中打开 `http://localhost:3000`
   - 你会看到一个认证界面

3. **认证:**
   - 输入 `.env` 中的 `WEB_AUTH_TOKEN`
   - 点击 "Connect"（连接）
   - 浏览器将创建会话并建立 WebSocket 连接

4. **聊天:**
   - 在输入框中输入消息
   - 消息通过 WebSocket 实时发送
   - 响应即时显示在聊天窗口中
   - 消息历史在会话内保留

5. **会话持久化:**
   - 你的会话保存在浏览器的 localStorage 中
   - 刷新页面会自动重新连接
   - 会话在不活动 24 小时后过期

#### REST API（编程访问）

##### 1. 创建会话

```bash
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-secret-token",
    "type": "api"
  }'
```

**响应:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "jid": "api:550e8400-e29b-41d4-a716-446655440000",
  "type": "api",
  "createdAt": "2026-03-13T10:30:00.000Z"
}
```

保存 `sessionId` 用于后续请求。

##### 2. 发送消息

```bash
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "content": "Hello, NanoClaw!"
  }'
```

**响应:**
```json
{
  "messageId": "660e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-13T10:31:00.000Z"
}
```

##### 3. 轮询响应

```bash
# 获取所有消息
curl "http://localhost:3000/api/messages?sessionId=550e8400-e29b-41d4-a716-446655440000"

# 获取特定时间戳之后的消息
curl "http://localhost:3000/api/messages?sessionId=550e8400-e29b-41d4-a716-446655440000&since=2026-03-13T10:30:00.000Z"
```

**响应:**
```json
{
  "messages": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "content": "Hello, NanoClaw!",
      "sender": "user",
      "timestamp": "2026-03-13T10:31:00.000Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "content": "Hello! How can I help you?",
      "sender": "assistant",
      "timestamp": "2026-03-13T10:31:05.000Z"
    }
  ]
}
```

##### 4. 删除会话

```bash
curl -X DELETE http://localhost:3000/api/session/550e8400-e29b-41d4-a716-446655440000
```

**响应:** HTTP 204 No Content

#### API 端点参考

| 端点 | 方法 | 描述 |
|----------|--------|-------------|
| `/api/health` | GET | 健康检查端点 |
| `/api/session` | POST | 创建新会话 |
| `/api/message` | POST | 发送消息 |
| `/api/messages` | GET | 轮询消息（支持 `since` 参数） |
| `/api/session/:sessionId` | DELETE | 删除会话 |

### 架构设计

#### 会话类型

- **Web 会话 (`web:sessionId`)**: 通过 Web UI 创建，使用 WebSocket 进行实时消息传递
- **API 会话 (`api:sessionId`)**: 通过 REST API 创建，使用轮询获取消息

两种类型都可以访问同一个 NanoClaw 代理实例。

#### JID 格式

- Web UI: `web:550e8400-e29b-41d4-a716-446655440000`
- API: `api:550e8400-e29b-41d4-a716-446655440000`

这些 JID 可以使用标准注册流程注册到 NanoClaw 组中。

#### 消息流程

##### Web UI 流程
```
浏览器 → WebSocket → WebChannel.sendMessage() → Agent 容器
Agent 容器 → WebChannel.sendMessage() → WebSocket → 浏览器
```

##### API 流程
```
脚本 → POST /api/message → WebChannel.sendMessage() → Agent 容器
Agent 容器 → WebChannel.sendMessage() → Session 存储
脚本 → GET /api/messages → Session 存储 → 脚本
```

### 注册 Web 会话

要让 web 会话触发代理（类似于注册 WhatsApp 群组）：

1. **找到你的会话 JID:**
   - Web UI: 检查浏览器控制台或服务器日志
   - API: 在 `/api/session` 响应中返回

2. **注册会话:**
   - 从 web UI/API 发送消息
   - 会话 JID 将出现在日志中
   - 使用标准的组注册流程和 JID

示例：
```bash
# 代理看到来自以下的消息: web:550e8400-e29b-41d4-a716-446655440000
# 将其注册为"组"（在这种情况下是单人聊天）：
# 添加到你的组配置中
```

### 安全注意事项

#### Token 认证
- 所有会话创建都需要 `WEB_AUTH_TOKEN`
- 保持此令牌安全并定期更换
- 不要将令牌提交到版本控制

#### 会话管理
- 会话在不活动 24 小时后过期
- 陈旧会话会自动清理
- 每个会话都有唯一的 UUID

#### 网络安全
- 默认情况下，Web 服务器仅绑定到 `localhost`
- 对于远程访问，使用带 TLS 的反向代理
- 不要直接将 Web 端口暴露到互联网

#### 生产部署

生产环境使用：

1. **使用 HTTPS:**
   ```bash
   # 使用带 TLS 的反向代理（nginx, caddy, traefik）
   # Caddy 示例：
   # yourdomain.com {
   #   reverse_proxy localhost:3000
   # }
   ```

2. **保护令牌:**
   - 使用强随机令牌（32+ 字符）
   - 存储在环境变量中，而不是 `.env` 文件
   - 定期轮换令牌

3. **速率限制:**
   - 在反向代理中实现速率限制
   - 防止 API 端点滥用

### 故障排除

#### Web 通道未启动

**症状:** 启动时未显示 Web 服务器 URL

**解决方案:**
- 检查 `.env` 中是否设置了 `WEB_AUTH_TOKEN`
- 验证令牌不为空
- 检查日志中的错误消息

#### WebSocket 连接失败

**症状:** 浏览器显示"Disconnected"（已断开）状态

**解决方案:**
- 检查浏览器控制台错误
- 验证 `WEB_PORT` 未被防火墙阻止
- 确保 WebSocket 协议匹配（ws:// vs wss://）

#### 认证错误

**症状:** 连接时出现"Invalid token"（无效令牌）错误

**解决方案:**
- 验证令牌与 `.env` 中完全匹配
- 检查空格或特殊字符
- 更改 `.env` 后重启 NanoClaw

#### 未收到消息（API）

**症状:** 发送了消息但 `GET /api/messages` 返回空

**解决方案:**
- 确保会话已在 NanoClaw 中注册
- 检查代理是否正在处理消息（检查日志）
- 验证你使用了正确的 `sessionId`
- 尝试不带 `since` 参数轮询以获取所有消息

#### 会话过期

**症状:** 发送消息时出现 404 错误

**解决方案:**
- 会话在不活动 24 小时后过期
- 使用 `/api/session` 创建新会话
- 如果令牌已保存，Web UI 将自动重新连接

### 高级用法

#### 多个 Web 通道

你可以在不同端口运行多个 NanoClaw 实例：

```bash
# 实例 1
WEB_PORT=3000
WEB_AUTH_TOKEN=token1

# 实例 2
WEB_PORT=3001
WEB_AUTH_TOKEN=token2
```

#### 与其他工具集成

REST API 可以与任何 HTTP 客户端一起使用：

**Python 示例:**
```python
import requests
import json

# 创建会话
resp = requests.post('http://localhost:3000/api/session',
    json={'token': 'your-secret-token', 'type': 'api'})
session = resp.json()
session_id = session['sessionId']

# 发送消息
requests.post('http://localhost:3000/api/message',
    json={'sessionId': session_id, 'content': 'Hello from Python!'})

# 轮询响应
resp = requests.get(f'http://localhost:3000/api/messages?sessionId={session_id}')
messages = resp.json()['messages']
print(messages)
```

**JavaScript/Node.js 示例:**
```javascript
const response = await fetch('http://localhost:3000/api/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'your-secret-token', type: 'api' })
});
const session = await response.json();
const sessionId = session.sessionId;

// 发送消息
await fetch('http://localhost:3000/api/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId, content: 'Hello from Node.js!' })
});

// 轮询消息
const messagesResp = await fetch(`http://localhost:3000/api/messages?sessionId=${sessionId}`);
const { messages } = await messagesResp.json();
console.log(messages);
```

### 开发

#### 开发模式运行

```bash
npm run dev  # 启用热重载
```

#### 测试 Web UI

```bash
# 启动服务器
npm run dev

# 打开浏览器
open http://localhost:3000
```

#### 测试 API

```bash
# 健康检查
curl http://localhost:3000/api/health

# 创建会话并测试
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{"token":"your-token","type":"api"}'
```

### 文件结构

```
src/
├── channels/
│   ├── web.ts                    # WebChannel 实现
│   └── index.ts                  # 通道注册
├── web/
│   ├── server.ts                 # Express + WebSocket 服务器
│   ├── session-manager.ts        # 会话/令牌管理
│   ├── api-router.ts             # REST API 端点
│   └── public/
│       └── index.html            # Web UI（单页应用）
.env.example                      # 配置模板
```

### 相关文档

- [NanoClaw README](../README.md) - 主要文档
- [Requirements](./REQUIREMENTS.md) - 架构决策
- [Channel Development](./CHANNELS.md) - 创建自定义通道