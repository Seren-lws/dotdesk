import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Bookmark } from '../types'

const categoryLabels: Record<string, string> = {
  all: '全部',
  tools: '工具',
  design: '设计',
  ai: 'AI',
  docs: '文档',
  other: '其他',
}

const categoryOrder = ['all', 'tools', 'design', 'ai', 'docs', 'other']

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    supabase
      .from('dd_bookmarks')
      .select('*')
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) console.error('Failed to fetch bookmarks:', error)
        else setBookmarks(data || [])
        setLoading(false)
      })
  }, [])

  const filtered =
    activeFilter === 'all'
      ? bookmarks
      : bookmarks.filter((b) => b.category === activeFilter)

  const availableCategories = categoryOrder.filter(
    (cat) => cat === 'all' || bookmarks.some((b) => b.category === cat)
  )

  if (loading) {
    return (
      <section id="bookmarks" className="section">
        <h2 className="section-title">
          <span className="section-icon" style={{ borderColor: 'var(--color-rose-border)', color: 'var(--color-rose-text)', background: 'var(--color-rose-light)' }}>B</span>
          收藏夹
        </h2>
        <p className="card-desc">加载中...</p>
      </section>
    )
  }

  return (
    <section id="bookmarks" className="section">
      <h2 className="section-title">
        <span className="section-icon" style={{ borderColor: 'var(--color-rose-border)', color: 'var(--color-rose-text)', background: 'var(--color-rose-light)' }}>B</span>
        收藏夹
      </h2>

      <div className="filter-bar">
        {availableCategories.map((cat) => (
          <button
            key={cat}
            className={`filter-btn ${activeFilter === cat ? 'active' : ''}`}
            onClick={() => setActiveFilter(cat)}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {filtered.map((b) => (
          <a
            key={b.id}
            className={`pixel-pill cat-${b.category}`}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {b.icon && <span>{getIconEmoji(b.icon)}</span>}
            {b.name}
          </a>
        ))}
        {filtered.length === 0 && (
          <p className="card-desc">这个分类还没有收藏~</p>
        )}
      </div>
    </section>
  )
}

function getIconEmoji(icon: string): string {
  const map: Record<string, string> = {
    'brand-github': '🐙',
    'brand-vercel': '▲',
    'database': '🗄️',
    'wand': '✨',
    'message-circle': '💬',
    'palette': '🎨',
    'layout': '📐',
    'notebook': '📓',
  }
  return map[icon] || '🔗'
}
