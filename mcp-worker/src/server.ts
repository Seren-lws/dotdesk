import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { AuthHandler, type Env } from "./auth-handler";
import {
  getBillingSummary,
  getCalendar,
  getCurrentStatus,
  getHealthAndSleep,
  getNovelProgress,
  getProjects,
  getRecentLogs
} from "./data";

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};

function result(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>
  };
}

function createServer(env: Env) {
  const server = new McpServer({ name: "dotdesk", version: "0.1.0" });

  server.registerTool(
    "get_current_status",
    {
      title: "读取当前状态",
      description:
        "读取晚声最近的健康、睡眠、日志与近期日历摘要。适合在回答近况、安排今天或提供陪伴前调用。",
      annotations: readOnlyAnnotations
    },
    async () => result(await getCurrentStatus(env))
  );

  server.registerTool(
    "get_health_and_sleep",
    {
      title: "读取健康与睡眠变化",
      description: "读取最近 1 至 30 天的体重、围度、周期、运动和睡眠记录。默认不返回私人备注。",
      inputSchema: {
        days: z.number().int().min(1).max(30).default(7),
        includeNotes: z.boolean().default(false)
      },
      annotations: readOnlyAnnotations
    },
    async ({ days, includeNotes }) => result(await getHealthAndSleep(env, days, includeNotes))
  );

  server.registerTool(
    "get_recent_logs",
    {
      title: "读取每日日志",
      description: "读取最近 1 至 30 天写过的每日日志，帮助 AI 了解近期做过什么。",
      inputSchema: { days: z.number().int().min(1).max(30).default(7) },
      annotations: readOnlyAnnotations
    },
    async ({ days }) => result(await getRecentLogs(env, days))
  );

  server.registerTool(
    "get_calendar",
    {
      title: "读取日历",
      description: "读取近期日历内容和心情，最多回看 7 天、向前查看 30 天。",
      inputSchema: {
        daysBack: z.number().int().min(0).max(7).default(0),
        daysAhead: z.number().int().min(1).max(30).default(7)
      },
      annotations: readOnlyAnnotations
    },
    async ({ daysBack, daysAhead }) => result(await getCalendar(env, daysBack, daysAhead))
  );

  server.registerTool(
    "get_novel_progress",
    {
      title: "读取小说成绩",
      description: "读取小说最近 7、14 或 30 天的人气、收藏、珠珠、评论、订阅和账号累计 PO 币收入。",
      inputSchema: {
        days: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(7),
        novelId: z.string().uuid().optional()
      },
      annotations: readOnlyAnnotations
    },
    async ({ days, novelId }) => result(await getNovelProgress(env, days, novelId))
  );

  server.registerTool(
    "get_billing_summary",
    {
      title: "读取订阅账单",
      description: "按月读取订阅和 API 充值记录，并按原始币种汇总。月份格式为 YYYY-MM。",
      inputSchema: { month: z.string().regex(/^\d{4}-\d{2}$/).optional() },
      annotations: readOnlyAnnotations
    },
    async ({ month }) => result(await getBillingSummary(env, month))
  );

  server.registerTool(
    "get_projects",
    {
      title: "读取项目橱窗",
      description: "读取 dotdesk 当前公开展示的项目名称、状态、简介和链接。",
      annotations: readOnlyAnnotations
    },
    async () => result(await getProjects(env))
  );

  return server;
}

const apiHandler = {
  fetch(request, env, ctx) {
    return createMcpHandler(() => createServer(env), {
      route: "/mcp",
      legacy: "stateless"
    })(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;

export default new OAuthProvider<Env>({
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  apiRoute: "/mcp",
  apiHandler,
  defaultHandler: AuthHandler,
  scopesSupported: ["dotdesk:read"],
  accessTokenTTL: 3_600,
  refreshTokenTTL: 2_592_000
});
