import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { GitHubRepositoryActivity, Project } from '../types'

const statusLabels: Record<string, string> = {
  deployed: '已上线',
  building: '搭建中',
  planning: '规划中',
  archived: '已归档',
}

function repoName(repoUrl: string | null) {
  return repoUrl?.replace(/\/$/, '').split('/').pop()?.toLowerCase() || ''
}

function relativeTime(date: string) {
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })

  if (Math.abs(seconds) < 60) return '刚刚'
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return formatter.format(days, 'day')
  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) return formatter.format(months, 'month')
  return formatter.format(Math.round(months / 12), 'year')
}

export default function ProjectShowcase() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activity, setActivity] = useState<Record<string, GitHubRepositoryActivity>>({})
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('dd_projects')
      .select('*')
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) console.error('Failed to fetch projects:', error)
        else setProjects(data || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    supabase.functions.invoke<{ repositories: GitHubRepositoryActivity[] }>('github-activity')
      .then(({ data, error }) => {
        if (error || !data?.repositories) return
        setActivity(Object.fromEntries(data.repositories.map((item) => [item.repo.toLowerCase(), item])))
      })
  }, [])

  if (loading) {
    return (
      <section id="projects" className="section">
        <h2 className="section-title">
          <span className="section-icon" style={{ borderColor: 'var(--color-sky-border)', color: 'var(--color-sky-text)', background: 'var(--color-sky-light)' }}>P</span>
          项目橱窗
        </h2>
        <p className="card-desc">加载中...</p>
      </section>
    )
  }

  return (
    <section id="projects" className="section">
      <h2 className="section-title">
        <span className="section-icon" style={{ borderColor: 'var(--color-sky-border)', color: 'var(--color-sky-text)', background: 'var(--color-sky-light)' }}>P</span>
        项目橱窗
      </h2>
      <div className="grid grid-3">
        {projects.map((p) => {
          const commits = activity[repoName(p.repo_url)]?.commits || []
          const isExpanded = expandedProject === p.id

          return (
          <div
            key={p.id}
            className={`pixel-card project-card ${p.color}${isExpanded ? ' activity-expanded' : ''}`}
            onClick={() => commits.length > 0 && setExpandedProject(isExpanded ? null : p.id)}
          >
            <p className="card-title">{p.name}</p>
            {p.description && <p className="card-desc">{p.description}</p>}
            <span className={`card-tag status-${p.status}`}>
              {statusLabels[p.status] || p.status}
            </span>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
              {p.url && (
                <a
                  className="card-link card-title"
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {'>'} 访问
                </a>
              )}
              {p.repo_url && (
                <a
                  className="card-link card-title"
                  href={p.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {'>'} 仓库
                </a>
              )}
            </div>
            {commits.length > 0 && (
              <>
                <button
                  type="button"
                  className="activity-hint"
                  aria-expanded={isExpanded}
                  onClick={(event) => {
                    event.stopPropagation()
                    setExpandedProject(isExpanded ? null : p.id)
                  }}
                >
                  <span className="activity-dot" /> 最近提交
                </button>
                <div className="commit-popover" onClick={(event) => event.stopPropagation()}>
                  <p className="commit-popover-title">RECENT COMMITS</p>
                  <ul className="commit-list">
                    {commits.map((commit) => (
                      <li key={commit.sha}>
                        <a href={commit.url} target="_blank" rel="noopener noreferrer">
                          <span className="commit-message">{commit.message}</span>
                          <span className="commit-meta">{commit.sha.slice(0, 7)} · {relativeTime(commit.committed_at)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
          )
        })}
      </div>
    </section>
  )
}
