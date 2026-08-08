import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Bookmark } from '../types'

const categoryLabels: Record<string, string> = {
  tools: '工具',
  design: '设计',
  ai: 'AI',
  docs: '文档',
  other: '其他',
}

const categoryColors = ['tools', 'design', 'ai', 'docs', 'other']

function categoryLabel(category: string) {
  return categoryLabels[category] || category
}

function categoryColor(category: string) {
  if (categoryColors.includes(category)) return category
  const value = [...category].reduce((total, char) => total + char.charCodeAt(0), 0)
  return categoryColors[value % categoryColors.length]
}

function normalizeUrl(value: string) {
  const raw = value.trim()
  if (!raw) return null
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withProtocol)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [tag, setTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fetchBookmarks = useCallback(async () => {
    const { data, error } = await supabase.from('dd_bookmarks').select('*').order('sort_order')
    if (error) setMessage('收藏夹加载失败，请刷新后再试。')
    else setBookmarks(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchBookmarks() }, [fetchBookmarks])

  const categories = [...new Set(bookmarks.map((bookmark) => bookmark.category).filter(Boolean))]
  const filtered = activeFilter === 'all'
    ? bookmarks
    : bookmarks.filter((bookmark) => bookmark.category === activeFilter)

  const resetForm = () => {
    setName('')
    setUrl('')
    setTag('')
    setEditingId(null)
    setShowForm(false)
    setMessage('')
  }

  const handleEdit = (bookmark: Bookmark) => {
    setName(bookmark.name)
    setUrl(bookmark.url)
    setTag(categoryLabel(bookmark.category))
    setEditingId(bookmark.id)
    setShowForm(true)
    setMessage('')
  }

  const handleSave = async () => {
    const normalizedUrl = normalizeUrl(url)
    if (!name.trim() || !normalizedUrl) {
      setMessage('请填写网站名称和正确的网址。')
      return
    }

    setSaving(true)
    setMessage('')
    const existing = editingId ? bookmarks.find((bookmark) => bookmark.id === editingId) : null
    const values = {
      name: name.trim(),
      url: normalizedUrl,
      category: tag.trim() || 'other',
      icon: existing?.icon || null,
      sort_order: existing?.sort_order ?? bookmarks.length,
    }
    const { error } = editingId
      ? await supabase.from('dd_bookmarks').update(values).eq('id', editingId)
      : await supabase.from('dd_bookmarks').insert(values)

    setSaving(false)
    if (error) {
      setMessage('保存失败，刚才填写的内容还在。')
      return
    }
    resetForm()
    fetchBookmarks()
  }

  const handleDelete = async (bookmark: Bookmark) => {
    if (!window.confirm(`确定删除“${bookmark.name}”吗？`)) return
    const { error } = await supabase.from('dd_bookmarks').delete().eq('id', bookmark.id)
    if (error) setMessage('删除失败，请稍后再试。')
    else fetchBookmarks()
  }

  return (
    <section id="bookmarks" className="section bookmark-panel">
      <span className="bookmark-binding" aria-hidden="true" />
      <span className="bookmark-decoration" aria-hidden="true">✦ · ♣ · ✎</span>
      <h2 className="section-title bookmark-title">
        <span className="section-icon bookmark-icon">B</span>
        收藏夹
        <button className="add-btn" onClick={() => showForm ? resetForm() : setShowForm(true)} aria-label="添加收藏">
          {showForm ? '×' : '+'}
        </button>
      </h2>

      {showForm && (
        <div className="bookmark-form">
          <div className="bookmark-form-grid">
            <input className="idea-input" placeholder="网站名称" value={name} onChange={(event) => setName(event.target.value)} />
            <input className="idea-input" placeholder="网址，例如 github.com" value={url} onChange={(event) => setUrl(event.target.value)} />
            <input className="idea-input" placeholder="自定义标签，例如：写作" value={tag} onChange={(event) => setTag(event.target.value)} />
          </div>
          <button className="idea-submit bookmark-submit" onClick={handleSave} disabled={saving || !name.trim() || !url.trim()}>
            {saving ? '保存中…' : editingId ? '保存修改' : '加入收藏夹'}
          </button>
          {message && <p className="form-error">{message}</p>}
        </div>
      )}

      <div className="filter-bar">
        <button className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>全部</button>
        {categories.map((category) => (
          <button key={category} className={`filter-btn ${activeFilter === category ? 'active' : ''}`} onClick={() => setActiveFilter(category)}>
            {categoryLabel(category)}
          </button>
        ))}
      </div>

      <div className="bookmark-list">
        {filtered.map((bookmark) => (
          <div key={bookmark.id} className="bookmark-entry">
            <a className={`pixel-pill cat-${categoryColor(bookmark.category)}`} href={bookmark.url} target="_blank" rel="noopener noreferrer">
              {bookmark.icon && <span className="bookmark-note-icon">{getIconEmoji(bookmark.icon)}</span>}
              <span className="bookmark-note-name">{bookmark.name}</span>
              <small>{categoryLabel(bookmark.category)}</small>
            </a>
            <details className="bookmark-menu">
              <summary aria-label={`管理“${bookmark.name}”`}>···</summary>
              <div className="bookmark-actions">
                <button type="button" onClick={() => handleEdit(bookmark)}>编辑</button>
                <button type="button" onClick={() => handleDelete(bookmark)}>删除</button>
              </div>
            </details>
          </div>
        ))}
        {!loading && filtered.length === 0 && <p className="card-desc">这个标签还没有收藏</p>}
        {loading && <p className="card-desc">加载中…</p>}
      </div>

      {!showForm && message && <p className="form-error">{message}</p>}
    </section>
  )
}

function getIconEmoji(icon: string): string {
  const map: Record<string, string> = {
    'brand-github': '🐙',
    'brand-vercel': '▲',
    database: '🗄️',
    wand: '✨',
    'message-circle': '💬',
    palette: '🎨',
    layout: '📋',
    notebook: '📓',
  }
  return map[icon] || '🔗'
}
