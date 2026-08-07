const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  })
}

async function readTable(path: string) {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) throw new Error('Supabase environment is unavailable')

  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  })
  if (!response.ok) throw new Error(`Data request failed: ${response.status}`)
  return response.json()
}

function tokyoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const today = tokyoDate()
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', weekday: 'short' }).format(new Date())
    const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
    const weekStart = new Date(`${today}T00:00:00+09:00`)
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekdayIndex + 6) % 7))

    const historyQuery = new URLSearchParams({
      select: 'id',
      to_status: 'eq.已投',
      changed_at: `gte.${weekStart.toISOString()}`,
    })
    const diaryQuery = new URLSearchParams({
      select: 'content,mood_tag',
      order: 'created_at.desc',
      limit: '1',
    })

    const [jobs, weekHistory, diary] = await Promise.all([
      readTable('tf_jobs?select=status,next_followup_date'),
      readTable(`tf_status_history?${historyQuery}`),
      readTable(`tf_moods?${diaryQuery}`),
    ])

    const applied = jobs.filter((job: { status: string }) => ['已投', '等回复'].includes(job.status)).length
    const interviewing = jobs.filter((job: { status: string }) => job.status === '面试中').length
    const offers = jobs.filter((job: { status: string }) => job.status === 'Offer').length
    const followupsToday = jobs.filter((job: { status: string; next_followup_date: string | null }) =>
      job.next_followup_date && job.next_followup_date <= today && !['Offer', '结束'].includes(job.status)
    ).length
    const latest = diary[0] as { content: string; mood_tag: string | null } | undefined
    const preview = latest?.content.slice(0, 60)

    return json({
      applied,
      interviewing,
      offers,
      followups_today: followupsToday,
      week_applied: weekHistory.length,
      latest_diary: latest ? {
        mood_tag: latest.mood_tag,
        preview: `${preview}${latest.content.length > 60 ? '……' : ''}`,
      } : null,
    })
  } catch (error) {
    console.error('Failed to load job overview:', error)
    return json({ error: 'Failed to load job overview' }, 500)
  }
})
