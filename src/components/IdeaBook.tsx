import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Idea {
  id: string
  title: string
  content: string | null
  tags: string[]
  created_at: string
}

const tagColors: Record<string, string> = {
  evering: 'sky',
  AI: 'butter',
  dotdesk: 'lavender',
  '工具': 'sage',
  '求职': 'peach',
}

export default function IdeaBook() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [activeTag, setActiveTag] = useState('全部')

  useEffect(() => {
    supabase
      .from('dd_ideas')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setIdeas(data || []))
  }, [])

  const allTags = ['全部', ...new Set(ideas.flatMap((i) => i.tags))]

  const filtered =
    activeTag === '全部'
      ? ideas
      : ideas.filter((i) => i.tags.includes(activeTag))

  return (
    <section id="ideas" className="section">
      <h2 className="section-title">
        <span
          className="section-icon"
          style={{
            borderColor: 'var(--color-lavender-border)',
            color: 'var(--color-lavender-text)',
            background: 'var(--color-lavender-light)',
          }}
        >
          I
        </span>
        灵感簿
      </h2>

      <div className="filter-bar">
        {allTags.map((tag) => (
          <button
            key={tag}
            className={`filter-btn ${activeTag === tag ? 'active' : ''}`}
            onClick={() => setActiveTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="idea-list">
        {filtered.map((idea) => (
          <div key={idea.id} className="idea-item">
            <p className="idea-title">{idea.title}</p>
            {idea.content && <p className="card-desc">{idea.content}</p>}
            <div className="idea-tags">
              {idea.tags.map((t) => (
                <span
                  key={t}
                  className={`idea-tag ${tagColors[t] || 'sand'}`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="card-desc">还没有灵感~</p>
        )}
      </div>
    </section>
  )
}
