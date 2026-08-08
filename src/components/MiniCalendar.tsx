import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface CalendarEntry {
  id: string
  date: string
  content: string | null
  mood: 'great' | 'good' | 'ok' | 'bad' | null
  notes: string | null
}

const moodColors: Record<string, string> = {
  great: 'var(--color-sage-bg)',
  good: 'var(--color-sky-bg)',
  ok: 'var(--color-butter-bg)',
  bad: 'var(--color-rose-bg)',
}

const moodLabels: Record<string, string> = {
  great: '超棒',
  good: '不错',
  ok: '一般',
  bad: '低落',
}

type Mood = NonNullable<CalendarEntry['mood']>

function PixelMood({ mood }: { mood: Mood }) {
  return (
    <span className={`pixel-mood pixel-mood-${mood}`} aria-hidden="true">
      <span className="pixel-mood-eyes" />
      <span className="pixel-mood-mouth" />
    </span>
  )
}

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

export default function MiniCalendar() {
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [hoveredDay, setHoveredDay] = useState<CalendarEntry | null>(null)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<CalendarEntry['mood']>('good')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const now = new Date()
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthName = `${year}年${month + 1}月`
  const firstDay = new Date(year, month, 1)
  let startWeekday = firstDay.getDay() - 1
  if (startWeekday < 0) startWeekday = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const fetchEntries = useCallback(async () => {
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`
    const { data, error } = await supabase
      .from('dd_calendar')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
    if (error) setMessage('日历加载失败，请刷新后再试。')
    else setEntries(data || [])
  }, [year, month, daysInMonth])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const entryMap = new Map(entries.map((entry) => [entry.date, entry]))
  const selectedEntry = selectedDate ? entryMap.get(selectedDate) : undefined
  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const handleSelectDay = (date: string, entry?: CalendarEntry) => {
    setSelectedDate(date)
    setContent(entry?.content || '')
    setMood(entry?.mood || 'good')
    setNotes(entry?.notes || '')
    setMessage('')
  }

  const handleSave = async () => {
    if (!selectedDate) return
    setSaving(true)
    setMessage('')
    const values = {
      date: selectedDate,
      content: content.trim() || null,
      mood,
      notes: notes.trim() || null,
    }
    const { error } = selectedEntry
      ? await supabase.from('dd_calendar').update(values).eq('id', selectedEntry.id)
      : await supabase.from('dd_calendar').insert(values)
    if (error) {
      setMessage('保存失败，请稍后再试。刚才填写的内容还在。')
      setSaving(false)
      return
    }
    setSaving(false)
    setSelectedDate('')
    fetchEntries()
  }

  const handleDelete = async () => {
    if (!selectedEntry || !window.confirm(`确定删除 ${selectedEntry.date} 的记录吗？`)) return
    const { error } = await supabase.from('dd_calendar').delete().eq('id', selectedEntry.id)
    if (error) setMessage('删除失败，请稍后再试。')
    else {
      setSelectedDate('')
      fetchEntries()
    }
  }

  const changeMonth = (offset: number) => {
    setViewDate(new Date(year, month + offset, 1))
    setSelectedDate('')
    setHoveredDay(null)
  }

  return (
    <section id="calendar" className="section calendar-panel">
      <span className="calendar-rings" aria-hidden="true" />
      <h2 className="section-title calendar-title">
        <span className="section-icon calendar-icon">C</span>
        {monthName}
        <span className="calendar-nav">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="上个月">‹</button>
          <button type="button" onClick={() => changeMonth(1)} aria-label="下个月">›</button>
        </span>
      </h2>

      <div className="calendar-sheet">
        <div className="cal-grid">
        {weekDays.map((day) => <div key={day} className="cal-header">{day}</div>)}
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} className="cal-cell empty" />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const entry = entryMap.get(dateStr)
          const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
          return (
            <button
              type="button"
              key={day}
              className={`cal-cell ${entry ? 'has-entry' : ''} ${isToday ? 'today' : ''}`}
              style={entry?.mood ? { background: moodColors[entry.mood] } : undefined}
              onClick={() => handleSelectDay(dateStr, entry)}
              onMouseEnter={() => entry && setHoveredDay(entry)}
              onMouseLeave={() => setHoveredDay(null)}
              aria-label={`${dateStr}${entry ? ` ${entry.mood ? moodLabels[entry.mood] : ''} 有记录` : ''}`}
            >
              <span className="cal-day-number">{day}</span>
              {entry?.mood && <PixelMood mood={entry.mood} />}
            </button>
          )
        })}
        </div>

      {selectedDate ? (
        <div className="calendar-editor">
          <p className="cal-detail-date">{selectedDate.slice(5).replace('-', '/')} {selectedEntry ? '编辑记录' : '新记录'}</p>
          <div className="sleep-quality-row">
            {(Object.keys(moodLabels) as Array<NonNullable<CalendarEntry['mood']>>).map((item) => (
              <button type="button" key={item} className={`filter-btn ${mood === item ? 'active' : ''}`} onClick={() => setMood(item)}>
                <PixelMood mood={item} /> {moodLabels[item]}
              </button>
            ))}
          </div>
          <input className="idea-input" placeholder="今天发生了什么？" value={content} onChange={(event) => setContent(event.target.value)} />
          <input className="idea-input" placeholder="备注（可选）" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <div className="record-form-actions">
            {selectedEntry && <button type="button" className="record-delete-btn" onClick={handleDelete}>删除</button>}
            <button type="button" className="idea-submit calendar-save" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
          {message && <p className="form-error">{message}</p>}
        </div>
      ) : (
        <div className="cal-detail-slot">
          {hoveredDay && (
            <div className="cal-detail">
              <p className="cal-detail-date">
                {hoveredDay.date.slice(5).replace('-', '/')}
                {hoveredDay.mood && <span className="cal-detail-mood"><PixelMood mood={hoveredDay.mood} /> {moodLabels[hoveredDay.mood]}</span>}
              </p>
              {hoveredDay.content && <p className="card-desc">{hoveredDay.content}</p>}
              {hoveredDay.notes && <p className="cal-detail-note">{hoveredDay.notes}</p>}
            </div>
          )}
          {!hoveredDay && <p className="cal-detail-hint">移到有心情的日期上看看 · 点击日期可以记录</p>}
        </div>
      )}

      {!selectedDate && message && <p className="form-error">{message}</p>}
      <div className="cal-legend">
        {(Object.keys(moodLabels) as Array<NonNullable<CalendarEntry['mood']>>).map((item) => (
          <span key={item} className="cal-legend-item"><PixelMood mood={item} /> {moodLabels[item]}</span>
        ))}
      </div>
        <span className="calendar-perforation" aria-hidden="true" />
      </div>
    </section>
  )
}
