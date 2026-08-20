# Dotdesk MCP

Dotdesk 的轻量只读连接层。它不复制数据，也不改变现有 Vite 页面；只从已有 Supabase 视图读取固定范围的数据。

## 对外入口

- `/mcp`：给 ChatGPT、Claude 等远程 MCP 客户端使用，OAuth 2.1 授权。
- `/api/snapshot`：给 Evering 使用的只读近况 JSON，需要独立 Bearer Token。
- `/`：仅返回服务器说明，不包含私人数据。

## 本地配置

复制 `.dev.vars.example` 为 `.dev.vars`，填写四项变量：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `MCP_ACCESS_CODE`：连接 GPT/Claude 时输入的一次性私人连接码
- `EVERING_TOKEN`：Evering 请求摘要接口使用的独立 Token

## 命令

```powershell
npm.cmd run check
npm.cmd run dev
npm.cmd run deploy
```

Cloudflare 部署前需先创建 KV，并把 `wrangler.jsonc` 中的占位 ID 换成实际 ID；四项变量均使用 `wrangler secret put` 保存，不提交到 Git。
