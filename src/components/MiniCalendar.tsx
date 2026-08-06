import { useEffect, useState } from 'react'
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

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

export default function MiniCalendar() {
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [hoveredDay, setHoveredDay] = useState<CalendarEntry | null>(null)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthName = `${year}年${month + 1}月`

  const firstDay = new Date(year, month, 1)
  let startWeekday = firstDay.getDay() - 1
  if (startWeekday < 0) startWeekday = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  useEffect(() => {
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`
    supabase
      .from('dd_calendar')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .then(({ data }) => setEntries(data || []))
  }, [year, month, daysInMonth])

  const entryMap = new Map(entries.map((e) => [e.date, e]))

  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <section id="calendar" className="section">
      <h2 className="section-title">
        <span
          className="section-icon"
          style={{
            borderColor: 'var(--color-sand-border)',
            color: 'var(--color-sand-text)',
            background: 'var(--color-sand-light)',
          }}
        >
          C
        </span>
        {monthName}
      </h2>

      <div className="cal-grid">
        {weekDays.map((d) => (
          <div key={d} className="cal-header">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="cal-cell empty" />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const entry = entryMap.get(dateStr)
          const isToday = day === now.getDate()
          return (
            <div
              key={day}
              className={`cal-cell ${entry ? 'has-entry' : ''} ${isToday ? 'today' : ''}`}
              style={entry?.mood ? { background: moodColors[entry.mood] } : undefined}
              onMouseEnter={() => entry && setHoveredDay(entry)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              {day}
            </div>
          )
        })}
      </div>

      {hoveredDay && (
        <div className="cal-detail">
          <p className="cal-detail-date">
            {hoveredDay.date.slice(5).replace('-', '/')}
            {hoveredDay.mood && (
              <span className="cal-detail-mood">{moodLabels[hoveredDay.mood]}</span>
            )}
          </p>
          {hoveredDay.content && <p className="card-desc">{hoveredDay.content}</p>}
          {hoveredDay.notes && <p className="cal-detail-note">{hoveredDay.notes}</p>}
        </div>
      )}

      <div className="cal-legend">
        <span className="cal-legend-item"><span className="cal-legend-dot" style={{ background: moodColors.great }} /> 超棒</span>
        <span className="cal-legend-item"><span className="cal-legend-dot" style={{ background: moodColors.good }} /> 不错</span>
        <span className="cal-legend-item"><span className="cal-legend-dot" style={{ background: moodColors.ok }} /> 一般</span>
        <span className="cal-legend-item"><span className="cal-legend-dot" style={{ background: moodColors.bad }} /> 低落</span>
      </div>
    </section>
  )
}
