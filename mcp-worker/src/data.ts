export interface DotdeskEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

type Row = Record<string, unknown>;

const DAY_MS = 86_400_000;

export function todayInTokyo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function addDays(date: string, amount: number): string {
  const value = Date.parse(`${date}T00:00:00Z`);
  return new Date(value + amount * DAY_MS).toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

async function selectRows(
  env: DotdeskEnv,
  view: string,
  params: Record<string, string>
): Promise<Row[]> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Dotdesk 数据连接尚未配置");
  }

  const url = new URL(`/rest/v1/${view}`, env.SUPABASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`读取 ${view} 失败 (${response.status})`);
  }

  const rows = await response.json<unknown>();
  if (!Array.isArray(rows)) {
    throw new Error(`读取 ${view} 时返回了异常格式`);
  }
  return rows as Row[];
}

function maybeStripNotes(rows: Row[], includeNotes: boolean): Row[] {
  if (includeNotes) return rows;
  return rows.map((row) => {
    const clean = { ...row };
    for (const key of Object.keys(clean)) {
      if (key === "notes" || key.endsWith("_notes") || key === "content") {
        delete clean[key];
      }
    }
    return clean;
  });
}

export async function getCurrentStatus(env: DotdeskEnv) {
  const today = todayInTokyo();
  const weekStart = addDays(today, -6);

  const [health, sleep, logs, calendar] = await Promise.all([
    selectRows(env, "dd_health", {
      select: "date,weight,period_day,period_phase,period_event,exercise,notes",
      date: `lte.${today}`,
      order: "date.desc",
      limit: "7"
    }),
    selectRows(env, "dd_sleep", {
      select: "date,sleep_time,wake_time,hours,quality,had_nightmare,notes",
      date: `lte.${today}`,
      order: "date.desc",
      limit: "7"
    }),
    selectRows(env, "dd_daily_logs", {
      select: "log_date,content,updated_at",
      log_date: `gte.${weekStart}`,
      order: "log_date.desc",
      limit: "7"
    }),
    selectRows(env, "dd_calendar", {
      select: "date,content,mood,notes",
      date: `gte.${today}`,
      order: "date.asc",
      limit: "10"
    })
  ]);

  return {
    asOf: today,
    latestHealth: health[0] ?? null,
    latestSleep: sleep[0] ?? null,
    recentHealth: health,
    recentSleep: sleep,
    recentLogs: logs,
    upcomingCalendar: calendar
  };
}

export async function getHealthAndSleep(
  env: DotdeskEnv,
  days: number,
  includeNotes: boolean
) {
  const safeDays = clamp(days, 1, 30);
  const end = todayInTokyo();
  const start = addDays(end, -(safeDays - 1));
  const [health, sleep] = await Promise.all([
    selectRows(env, "dd_health", {
      select:
        "date,weight,upper_arm,upper_bust,under_bust,waist,hips,thigh,calf,period_day,period_phase,period_event,exercise,notes,weight_notes,measurement_notes,cycle_notes,exercise_notes",
      date: `gte.${start}`,
      order: "date.asc",
      limit: String(safeDays)
    }),
    selectRows(env, "dd_sleep", {
      select: "date,sleep_time,wake_time,hours,quality,had_nightmare,notes",
      date: `gte.${start}`,
      order: "date.asc",
      limit: String(safeDays)
    })
  ]);

  return {
    range: { start, end, days: safeDays },
    health: maybeStripNotes(health, includeNotes),
    sleep: maybeStripNotes(sleep, includeNotes)
  };
}

export async function getRecentLogs(env: DotdeskEnv, days: number) {
  const safeDays = clamp(days, 1, 30);
  const end = todayInTokyo();
  const start = addDays(end, -(safeDays - 1));
  const rows = await selectRows(env, "dd_daily_logs", {
    select: "log_date,content,updated_at",
    log_date: `gte.${start}`,
    order: "log_date.desc",
    limit: String(safeDays)
  });
  return { range: { start, end }, logs: rows };
}

export async function getCalendar(env: DotdeskEnv, daysBack: number, daysAhead: number) {
  const safeBack = clamp(daysBack, 0, 7);
  const safeAhead = clamp(daysAhead, 1, 30);
  const today = todayInTokyo();
  const start = addDays(today, -safeBack);
  const end = addDays(today, safeAhead);
  const rows = await selectRows(env, "dd_calendar", {
    select: "date,content,mood,notes",
    date: `gte.${start}`,
    and: `(date.lte.${end})`,
    order: "date.asc",
    limit: "40"
  });
  return { range: { start, end }, entries: rows };
}

export async function getNovelProgress(env: DotdeskEnv, days: number, novelId?: string) {
  const safeDays = clamp(days, 1, 30);
  const end = todayInTokyo();
  const start = addDays(end, -(safeDays - 1));
  const novelsPromise = selectRows(env, "dd_novels", {
    select: "id,title,sort_order",
    order: "sort_order.asc,created_at.asc",
    limit: "30"
  });
  const statsParams: Record<string, string> = {
    select:
      "id,novel_id,record_date,popularity,favorites,pearls,comments,subscriptions,notes",
    record_date: `gte.${start}`,
    order: "record_date.asc",
    limit: "900"
  };
  if (novelId) statsParams.novel_id = `eq.${novelId}`;

  const [novels, stats, income] = await Promise.all([
    novelsPromise,
    selectRows(env, "dd_novel_daily_stats", statsParams),
    selectRows(env, "dd_novel_account_income", {
      select: "record_date,total_po,notes",
      record_date: `gte.${start}`,
      order: "record_date.asc",
      limit: String(safeDays)
    })
  ]);

  return {
    range: { start, end, days: safeDays },
    novels: novelId ? novels.filter((novel) => novel.id === novelId) : novels,
    dailyStats: stats,
    accountIncome: income
  };
}

export async function getBillingSummary(env: DotdeskEnv, month?: string) {
  const currentMonth = todayInTokyo().slice(0, 7);
  const selectedMonth = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : currentMonth;
  const start = `${selectedMonth}-01`;
  const nextMonthDate = new Date(`${start}T00:00:00Z`);
  nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
  const endExclusive = nextMonthDate.toISOString().slice(0, 10);
  const rows = await selectRows(env, "dd_subscriptions", {
    select:
      "id,name,kind,amount,currency,paid_date,billing_cycle,next_due_date,status,notes",
    paid_date: `gte.${start}`,
    and: `(paid_date.lt.${endExclusive})`,
    order: "paid_date.desc",
    limit: "200"
  });

  const totalsByCurrency: Record<string, number> = {};
  for (const row of rows) {
    const currency = String(row.currency ?? "JPY");
    const amount = Number(row.amount ?? 0);
    totalsByCurrency[currency] = (totalsByCurrency[currency] ?? 0) + amount;
  }

  return { month: selectedMonth, totalsByCurrency, payments: rows };
}

export async function getProjects(env: DotdeskEnv) {
  const rows = await selectRows(env, "dd_projects", {
    select: "name,description,url,repo_url,status,sort_order,is_visible,updated_at",
    is_visible: "eq.true",
    order: "sort_order.asc,updated_at.desc",
    limit: "50"
  });
  return { projects: rows };
}
