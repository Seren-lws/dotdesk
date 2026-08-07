import { useEffect, useState, useCallback } from 'react'
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
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const fetchIdeas = useCallback(() => {
    supabase
      .from('dd_ideas')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setIdeas(data || []))
  }, [])

  useEffect(() => { fetchIdeas() }, [fetchIdeas])

  const allTags = ['全部', ...new Set(ideas.flatMap((i) => i.tags))]

  const filtered =
    activeTag === '全部'
      ? ideas
      : ideas.filter((i) => i.tags.includes(activeTag))

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    setSaveError('')
    const tags = tagInput
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    const values = {
      title: title.trim(),
      content: content.trim() || null,
      tags,
    }
    const { error } = editingId
      ? await supabase.from('dd_ideas').update(values).eq('id', editingId)
      : await supabase.from('dd_ideas').insert(values)
    if (error) {
      setSaveError('保存失败，请稍后再试。刚才填写的内容还在。')
      setSaving(false)
      return
    }
    resetForm()
    setSaving(false)
    fetchIdeas()
  }

  const resetForm = () => {
    setTitle('')
    setContent('')
    setTagInput('')
    setEditingId(null)
    setShowForm(false)
    setSaveError('')
  }

  const handleEdit = (idea: Idea) => {
    setTitle(idea.title)
    setContent(idea.content || '')
    setTagInput(idea.tags.join(', '))
    setEditingId(idea.id)
    setShowForm(true)
    setSaveError('')
  }

  const handleDelete = async (idea: Idea) => {
    if (!window.confirm(`确定删除“${idea.title}”吗？`)) return
    const { error } = await supabase.from('dd_ideas').delete().eq('id', idea.id)
    if (error) setSaveError('删除失败，请稍后再试。')
    else fetchIdeas()
  }

  return (
    <section id="ideas" className="section idea-board">
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
        <button
          className="add-btn"
          onClick={() => showForm ? resetForm() : setShowForm(true)}
          aria-label="添加灵感"
        >
          {showForm ? '×' : '+'}
        </button>
      </h2>

      <div className="chalk-stickers" aria-hidden="true">
        <span className="chalk-spark">✦</span>
        <span className="chalk-heart">♡</span>
        <span className="chalk-piece chalk-piece-pink" />
        <span className="chalk-piece chalk-piece-blue" />
        <span className="chalk-piece chalk-piece-yellow" />
      </div>

      {showForm && (
        <div className="idea-form">
          <input
            className="idea-input"
            placeholder="灵感标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="idea-textarea"
            placeholder="详细描述（可选）"
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <input
            className="idea-input"
            placeholder="标签，用逗号分隔（如：AI, evering）"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
          <button
            className="idea-submit"
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
          >
            {saving ? '保存中...' : editingId ? '保存修改' : '记下来'}
          </button>
          {saveError && <p className="form-error">{saveError}</p>}
        </div>
      )}

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
            <div className="record-title-row">
              <p className="idea-title">{idea.title}</p>
              <div className="record-actions">
                <button type="button" onClick={() => handleEdit(idea)}>编辑</button>
                <button type="button" onClick={() => handleDelete(idea)}>删除</button>
              </div>
            </div>
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
