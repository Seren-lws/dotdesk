import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import {
  getBillingSummary,
  getCalendar,
  getCurrentStatus,
  getHealthAndSleep,
  getNovelProgress,
  getProjects,
  getRecentLogs,
  type DotdeskEnv
} from "./data";

export interface Env extends DotdeskEnv {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  MCP_ACCESS_CODE: string;
  EVERING_TOKEN: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function encodeState(value: AuthRequest): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeState(value: string): AuthRequest {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as AuthRequest;
}

async function safeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right))
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function base64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signAuthorizationState(state: string, secret: string): Promise<string> {
  const issuedAt = Date.now().toString();
  return signAuthorizationStateAt(state, secret, issuedAt);
}

async function verifyAuthorizationState(
  token: string,
  state: string,
  secret: string
): Promise<boolean> {
  const separator = token.indexOf(".");
  if (separator < 1 || !secret) return false;
  const issuedAt = Number(token.slice(0, separator));
  if (!Number.isFinite(issuedAt)) return false;
  const age = Date.now() - issuedAt;
  if (age < -60_000 || age > 600_000) return false;
  const expected = await signAuthorizationStateAt(state, secret, String(issuedAt));
  return safeEqual(token, expected);
}

async function signAuthorizationStateAt(
  state: string,
  secret: string,
  issuedAt: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${issuedAt}.${state}`)
  );
  return `${issuedAt}.${base64Url(signature)}`;
}

function securityHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
  );
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return headers;
}

function htmlPage(content: string, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dotdesk MCP</title><style>body{margin:0;background:#f5f0e7;color:#4b443d;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}main{width:min(520px,calc(100% - 40px));margin:10vh auto;border:2px solid #aaa39a;box-shadow:6px 6px 0 #d5cec3;background:#fffdf8;padding:28px;box-sizing:border-box}h1{letter-spacing:.15em;font-size:22px}p{line-height:1.7;color:#70675f}.client{padding:12px;background:#eef3ea;border-left:4px solid #9aaf92;margin:18px 0}label{display:block;margin:18px 0 8px}input{width:100%;box-sizing:border-box;padding:12px;border:2px solid #aaa39a;background:#fff;font:inherit}button{margin-top:18px;padding:10px 18px;border:2px solid #726a63;background:#e9dfe5;color:#403a36;font:inherit;cursor:pointer}.small{font-size:12px;color:#91877e}</style></head><body><main>${content}</main></body></html>`,
    {
      status,
      headers: securityHeaders({ "Content-Type": "text/html; charset=utf-8", ...extraHeaders })
    }
  );
}

async function handleAuthorizeGet(request: Request, env: Env): Promise<Response> {
  const authRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const client = await env.OAUTH_PROVIDER.lookupClient(authRequest.clientId);
  if (!client) return htmlPage("<h1>连接请求无效</h1>", 400);

  const encodedState = encodeState(authRequest);
  const authorizationToken = await signAuthorizationState(encodedState, env.MCP_ACCESS_CODE);
  const clientName = escapeHtml(client.clientName ?? "未知 MCP 客户端");
  const scopes = authRequest.scope.length ? escapeHtml(authRequest.scope.join(", ")) : "只读状态";

  return htmlPage(
    `<h1>DOTDESK MCP</h1><p>正在把晚声的私人工作台连接给 AI。这里只授权读取，不会修改、添加或删除任何记录。</p><div class="client"><strong>${clientName}</strong><br><span class="small">权限：${scopes}</span></div><form method="post" action="/authorize"><input type="hidden" name="state" value="${escapeHtml(encodedState)}"><input type="hidden" name="authorization_token" value="${escapeHtml(authorizationToken)}"><label for="access_code">私人连接码</label><input id="access_code" name="access_code" type="password" autocomplete="current-password" required autofocus><button type="submit">允许只读连接</button></form><p class="small">连接码只在这次授权时验证，不会交给 GPT 或 Claude。</p>`,
    200
  );
}

async function handleAuthorizePost(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const state = String(form.get("state") ?? "");
  const accessCode = String(form.get("access_code") ?? "");
  const authorizationToken = String(form.get("authorization_token") ?? "");

  if (!(await verifyAuthorizationState(authorizationToken, state, env.MCP_ACCESS_CODE))) {
    return htmlPage("<h1>授权页面已过期</h1><p>请返回客户端重新发起连接。</p>", 400);
  }
  if (!env.MCP_ACCESS_CODE || !(await safeEqual(accessCode, env.MCP_ACCESS_CODE))) {
    return htmlPage("<h1>连接码不正确</h1><p>请返回客户端重试。</p>", 401);
  }

  let authRequest: AuthRequest;
  try {
    authRequest = decodeState(state);
  } catch {
    return htmlPage("<h1>授权请求无效</h1>", 400);
  }

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: authRequest,
    userId: "wansheng",
    metadata: { server: "dotdesk-mcp" },
    scope: authRequest.scope,
    props: { owner: "wansheng", access: "read-only" }
  });

  return new Response(null, {
    status: 302,
    headers: securityHeaders({
      Location: redirectTo
    })
  });
}

async function handleEveringSnapshot(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get("Authorization") ?? "";
  const expected = `Bearer ${env.EVERING_TOKEN ?? ""}`;
  if (!env.EVERING_TOKEN || !(await safeEqual(authorization, expected))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "current";
  const days = Number(url.searchParams.get("days") ?? 7);
  const includeNotes = url.searchParams.get("include_notes") === "true";
  let data: unknown;
  switch (view) {
    case "health":
      data = await getHealthAndSleep(env, days, includeNotes);
      break;
    case "logs":
      data = await getRecentLogs(env, days);
      break;
    case "calendar":
      data = await getCalendar(env, 2, days);
      break;
    case "novels":
      data = await getNovelProgress(env, days);
      break;
    case "billing":
      data = await getBillingSummary(env, url.searchParams.get("month") ?? undefined);
      break;
    case "projects":
      data = await getProjects(env);
      break;
    case "current":
      data = await getCurrentStatus(env);
      break;
    default:
      return Response.json({ error: "unknown_view" }, { status: 400 });
  }
  return Response.json(data, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export const AuthHandler: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/authorize" && request.method === "GET") {
        return await handleAuthorizeGet(request, env);
      }
      if (url.pathname === "/authorize" && request.method === "POST") {
        return await handleAuthorizePost(request, env);
      }
      if (url.pathname === "/api/snapshot" && request.method === "GET") {
        return await handleEveringSnapshot(request, env);
      }
      if (url.pathname === "/") {
        return Response.json({
          name: "dotdesk-mcp",
          description: "晚声的私人工作台只读连接层",
          mcp: "/mcp",
          access: "OAuth 2.1 / read-only"
        });
      }
      return Response.json({ error: "not_found" }, { status: 404 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "服务器暂时不可用";
      return Response.json({ error: message }, { status: 500 });
    }
  }
};
