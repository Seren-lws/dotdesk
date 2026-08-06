import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface SleepEntry {
  id: string
  date: string
  sleep_time: string | null
  wake_time: string | null
  hours: number | null
  quality: string | null
  had_nightmare: boolean
  notes: string | null
}

const qualityLabels: Record<string, string> = {
  great: '超棒',
  good: '不错',
  ok: '一般',
  bad: '很差',
}

const qualityColors: Record<string, string> = {
  great: 'sage',
  good: 'sky',
  ok: 'butter',
  bad: 'rose',
}

export default function SleepLog() {
  const [entries, setEntries] = useState<SleepEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [sleepTime, setSleepTime] = useState('')
  const [wakeTime, setWakeTime] = useState('')
  const [quality, setQuality] = useState('good')
  const [nightmare, setNightmare] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchEntries = () => {
    supabase
      .from('dd_sleep')
      .select('*')
      .order('date', { ascending: false })
      .limit(7)
      .then(({ data }) => setEntries(data || []))
  }

  useEffect(() => { fetchEntries() }, [])

  const latest = entries[0]
  const avgHours = entries.length
    ? (entries.reduce((s, e) => s + (e.hours || 0), 0) / entries.length).toFixed(1)
    : '--'

  const handleSubmit = async () => {
    if (!sleepTime || !wakeTime) return
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const h = calcHours(sleepTime, wakeTime)
    await supabase.from('dd_sleep').insert({
      date: today,
      sleep_time: sleepTime,
      wake_time: wakeTime,
      hours: h,
      quality,
      had_nightmare: nightmare,
      notes: notes.trim() || null,
    })
    setSleepTime('')
    setWakeTime('')
    setQuality('good')
    setNightmare(false)
    setNotes('')
    setShowForm(false)
    setSaving(false)
    fetchEntries()
  }

  return (
    <section id="sleep" className="section">
      <h2 className="section-title">
        <span
          className="section-icon"
          style={{
            borderColor: 'var(--color-mint-border)',
            color: 'var(--color-mint-text)',
            background: 'var(--color-mint-light)',
          }}
        >
          S
        </span>
        睡眠
        <button
          className="add-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '×' : '+'}
        </button>
      </h2>

      {showForm && (
        <div className="idea-form" style={{ borderColor: 'var(--color-mint-border)', background: 'var(--color-mint-light)' }}>
          <div className="sleep-time-row">
            <label className="sleep-label">
              入睡
              <input className="idea-input" type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} />
            </label>
            <label className="sleep-label">
              起床
              <input className="idea-input" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
            </label>
          </div>
          <div className="sleep-quality-row">
            {(['great', 'good', 'ok', 'bad'] as const).map((q) => (
              <button
                key={q}
                className={`filter-btn ${quality === q ? 'active' : ''}`}
                onClick={() => setQuality(q)}
                type="button"
              >
                {qualityLabels[q]}
              </button>
            ))}
          </div>
          <label className="sleep-checkbox">
            <input type="checkbox" checked={nightmare} onChange={(e) => setNightmare(e.target.checked)} />
            做了噩梦
          </label>
          <input
            className="idea-input"
            placeholder="备注（可选）"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            className="idea-submit"
            style={{ borderColor: 'var(--color-mint-border)', background: 'var(--color-mint-bg)', color: 'var(--color-mint-text)', boxShadow: '2px 2px 0 var(--color-mint-border)' }}
            onClick={handleSubmit}
            disabled={saving || !sleepTime || !wakeTime}
          >
            {saving ? '...' : '记录'}
          </button>
        </div>
      )}

      {/* Latest */}
      {latest && (
        <div className="sleep-latest pixel-card mint">
          <div className="sleep-latest-header">
            <div>
              <p className="card-title">昨晚</p>
              <p className="card-desc">
                {latest.sleep_time} - {latest.wake_time}（{latest.hours}h）
              </p>
            </div>
            {latest.quality && (
              <span className={`idea-tag ${qualityColors[latest.quality]}`}>
                {qualityLabels[latest.quality]}
              </span>
            )}
          </div>
          {latest.had_nightmare && <p className="sleep-nightmare">做了噩梦</p>}
          {latest.notes && <p className="cal-detail-note">{latest.notes}</p>}
        </div>
      )}

      {/* Week summary */}
      <div className="sleep-summary">
        <div className="sleep-summary-item">
          <span className="health-label">7日均</span>
          <span className="health-value">{avgHours}h</span>
        </div>
        <div className="sleep-bars">
          {[...entries].reverse().map((e) => (
            <div key={e.date} className="sleep-bar-col" title={`${e.date.slice(5)}: ${e.hours}h`}>
              <div
                className="sleep-bar"
                style={{
                  height: `${Math.max(4, ((e.hours || 0) / 10) * 50)}px`,
                  background: `var(--color-${qualityColors[e.quality || 'ok']}-border)`,
                }}
              />
              <span className="sleep-bar-label">{e.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function calcHours(sleep: string, wake: string): number {
  const [sh, sm] = sleep.split(':').map(Number)
  const [wh, wm] = wake.split(':').map(Number)
  let sleepMin = sh * 60 + sm
  let wakeMin = wh * 60 + wm
  if (wakeMin <= sleepMin) wakeMin += 24 * 60
  return Math.round((wakeMin - sleepMin) / 6) / 10
}
