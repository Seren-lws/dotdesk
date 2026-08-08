import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface JobSummary {
  applied: number
  interviewing: number
  offers: number
  followups_today: number
  week_applied: number
  latest_diary: { mood_tag: string | null; preview: string } | null
}

const jobUrl = 'https://tenshoku-fune.vercel.app'

export default function JobOverview() {
  const [summary, setSummary] = useState<JobSummary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    supabase.functions.invoke<JobSummary>('job-overview')
      .then(({ data, error: loadError }) => {
        if (loadError || !data) setError(true)
        else setSummary(data)
      })
  }, [])

  const stats = [
    { value: summary?.applied ?? 0, label: '投递中' },
    { value: summary?.interviewing ?? 0, label: '面试中' },
    { value: summary?.offers ?? 0, label: 'Offer' },
    { value: summary?.followups_today ?? 0, label: '今天待跟进' },
  ]

  return (
    <section id="job" className="section job-section">
      <span className="job-signal-lights" aria-hidden="true" />
      <span className="job-hull-code" aria-hidden="true">FUNE · 07</span>
      <h2 className="section-title job-title">
        <span className="section-icon job-icon">J</span>
        转职之船
        <a className="section-title-link" href={jobUrl} target="_blank" rel="noopener noreferrer">
          查看详情 {'>'}
        </a>
        <img className="job-title-cat" src="/job-cat-leaf.png" alt="" aria-hidden="true" />
      </h2>

      <div className="job-overview-grid">
        {stats.map((stat) => (
          <a key={stat.label} className="job-overview-stat" href={jobUrl} target="_blank" rel="noopener noreferrer">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </a>
        ))}
      </div>

      <div className="job-overview-bottom">
        <a className="job-week-card" href={jobUrl} target="_blank" rel="noopener noreferrer">
          <span>本周新投递</span>
          <strong>{summary?.week_applied ?? 0}<small> 个</small></strong>
        </a>
        <a className="job-diary-card" href={jobUrl} target="_blank" rel="noopener noreferrer">
          <span>最近的航海日记</span>
          <p>
            {summary?.latest_diary
              ? `${summary.latest_diary.mood_tag ? `${summary.latest_diary.mood_tag} · ` : ''}${summary.latest_diary.preview}`
              : '还没写过日记，去写下第一篇吧'}
          </p>
        </a>
      </div>

      {!summary && !error && <p className="job-overview-note">正在从转职之船取回航行记录…</p>}
      {error && <p className="job-overview-note">暂时没取到总览，点击卡片仍可前往转职之船。</p>}
      <span className="job-hull-base" aria-hidden="true" />
    </section>
  )
}
