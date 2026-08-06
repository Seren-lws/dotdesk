import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Project } from '../types'

const statusLabels: Record<string, string> = {
  deployed: '已上线',
  building: '搭建中',
  planning: '规划中',
  archived: '已归档',
}

export default function ProjectShowcase() {
  const [projects, setProjects] = useState<Project[]>([])
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
        {projects.map((p) => (
          <div key={p.id} className={`pixel-card ${p.color}`}>
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
                >
                  {'>'} 仓库
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
