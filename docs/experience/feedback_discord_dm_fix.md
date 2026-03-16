---
name: Discord 私聊消息接收修复
description: 修复 Discord 私聊频道无法接收消息的问题 - 需要配置 Partials.Channel
type: feedback
---

# Discord 私聊消息接收问题修复

## 问题现象
- 文本频道（guild text channels）可以正常接收和响应消息
- 私聊频道（DM channels）无法接收消息，没有任何日志记录

## 根本原因
Discord.js v14 中，要接收私聊消息，客户端必须配置 `partials: [Partials.Channel]`。原始代码中缺少此配置。

**Why**: Discord.js 对私聊消息的处理机制要求显式声明 partials，因为私聊频道可能不在缓存中，需要通过 partials 来处理未缓存的频道数据。

## 排查步骤

1. **检查服务状态**: 确认 nanoclaw 服务正在运行
2. **查看日志**: 发现文本频道有消息记录，私聊频道没有任何日志
3. **检查数据库注册**: 确认两个频道 ID 都已在 `registered_groups` 表中注册
4. **验证 Discord bot 连接**: Bot 已连接，有正确的 intents 配置
5. **创建诊断脚本**: 测试 Discord 客户端配置，发现缺少 partials

## 解决方案

在 `src/channels/discord.ts` 中：

```typescript
// 添加 Partials 导入
import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  Partials,  // 添加此导入
  TextChannel,
} from 'discord.js';

// 在客户端配置中添加 partials
this.client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],  // 添加此配置
});
```

**How to apply**:
- 未来如果添加新的 Discord 集成或修改客户端配置，必须包含 `partials: [Partials.Channel]`
- 如果遇到私聊相关的问题，首先检查 partials 配置
- Discord.js v14 文档中明确说明：私聊消息需要 Channel partial

## 相关配置要求

在 Discord Developer Portal 中必须启用：
- ✅ MESSAGE CONTENT INTENT（必需）
- ✅ SERVER MEMBERS INTENT（可选，但推荐）

Intents 已配置：
- `GatewayIntentBits.DirectMessages` - 接收私聊消息事件
- `GatewayIntentBits.MessageContent` - 读取消息内容

## 测试验证

修复后，私聊消息正常接收：
```
chatJid: "dc:1481828571960971296"
chatName: "Fred"
sender: "Fred"
```

## 参考资料
- Discord.js Guide: https://discordjs.guide/popular-topics/partials.html
- Discord.js Documentation: https://discord.js.org/#/docs/discord.js/main/class/Client