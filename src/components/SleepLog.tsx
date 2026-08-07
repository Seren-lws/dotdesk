import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../lib/date'

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

const qualityLabels: Record<string, string> = { great: '超棒', good: '不错', ok: '一般', bad: '很差' }
const qualityColors: Record<string, string> = { great: 'sage', good: 'sky', ok: 'butter', bad: 'rose' }

export default function SleepLog() {
  const [entries, setEntries] = useState<SleepEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [recordDate, setRecordDate] = useState(getLocalDateString())
  const [sleepTime, setSleepTime] = useState('')
  const [wakeTime, setWakeTime] = useState('')
  const [quality, setQuality] = useState('good')
  const [nightmare, setNightmare] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('dd_sleep')
      .select('*')
      .order('date', { ascending: false })
      .limit(7)
    if (error) setSaveError('睡眠记录加载失败，请刷新后再试。')
    else setEntries(data || [])
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const latest = entries[0]
  const hoursEntries = entries.filter((entry) => entry.hours != null)
  const avgHours = hoursEntries.length
    ? (hoursEntries.reduce((sum, entry) => sum + Number(entry.hours), 0) / hoursEntries.length).toFixed(1)
    : '--'

  const resetForm = () => {
    setEditingId(null)
    setRecordDate(getLocalDateString())
    setSleepTime('')
    setWakeTime('')
    setQuality('good')
    setNightmare(false)
    setNotes('')
    setShowForm(false)
    setSaveError('')
  }

  const openNewForm = () => {
    const todayEntry = entries.find((entry) => entry.date === getLocalDateString())
    if (todayEntry) handleEdit(todayEntry)
    else {
      resetForm()
      setShowForm(true)
    }
  }

  const handleEdit = (entry: SleepEntry) => {
    setEditingId(entry.id)
    setRecordDate(entry.date)
    setSleepTime(entry.sleep_time || '')
    setWakeTime(entry.wake_time || '')
    setQuality(entry.quality || 'good')
    setNightmare(entry.had_nightmare)
    setNotes(entry.notes || '')
    setShowForm(true)
    setSaveError('')
  }

  const handleSubmit = async () => {
    if (!recordDate || !sleepTime || !wakeTime) return
    setSaving(true)
    setSaveError('')
    const values = {
      date: recordDate,
      sleep_time: sleepTime,
      wake_time: wakeTime,
      hours: calcHours(sleepTime, wakeTime),
      quality,
      had_nightmare: nightmare,
      notes: notes.trim() || null,
    }
    const existing = editingId ? entries.find((entry) => entry.id === editingId) : entries.find((entry) => entry.date === recordDate)
    const { error } = existing
      ? await supabase.from('dd_sleep').update(values).eq('id', existing.id)
      : await supabase.from('dd_sleep').insert(values)
    if (error) {
      setSaveError('保存失败，请稍后再试。刚才填写的内容还在。')
      setSaving(false)
      return
    }
    setSaving(false)
    resetForm()
    fetchEntries()
  }

  const handleDelete = async (entry: SleepEntry) => {
    if (!window.confirm(`确定删除 ${entry.date} 的睡眠记录吗？`)) return
    const { error } = await supabase.from('dd_sleep').delete().eq('id', entry.id)
    if (error) setSaveError('删除失败，请稍后再试。')
    else {
      if (editingId === entry.id) resetForm()
      fetchEntries()
    }
  }

  return (
    <section id="sleep" className="section">
      <h2 className="section-title">
        <span className="section-icon sleep-icon">S</span>
        睡眠
        <button className="add-btn" onClick={() => showForm ? resetForm() : openNewForm()} aria-label="新增睡眠记录">{showForm ? '×' : '+'}</button>
      </h2>

      {showForm && (
        <div className="idea-form sleep-form">
          <label className="sleep-label">日期<input className="idea-input" type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} /></label>
          <div className="sleep-time-row">
            <label className="sleep-label">入睡<input className="idea-input" type="time" value={sleepTime} onChange={(event) => setSleepTime(event.target.value)} /></label>
            <label className="sleep-label">起床<input className="idea-input" type="time" value={wakeTime} onChange={(event) => setWakeTime(event.target.value)} /></label>
          </div>
          <div className="sleep-quality-row">
            {(['great', 'good', 'ok', 'bad'] as const).map((item) => <button key={item} className={`filter-btn ${quality === item ? 'active' : ''}`} onClick={() => setQuality(item)} type="button">{qualityLabels[item]}</button>)}
          </div>
          <label className="sleep-checkbox"><input type="checkbox" checked={nightmare} onChange={(event) => setNightmare(event.target.checked)} />做了噩梦</label>
          <input className="idea-input" placeholder="备注（可选）" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <button className="idea-submit sleep-submit" onClick={handleSubmit} disabled={saving || !recordDate || !sleepTime || !wakeTime}>
            {saving ? '保存中...' : editingId ? '保存修改' : '记录'}
          </button>
          {saveError && <p className="form-error">{saveError}</p>}
        </div>
      )}

      {latest && (
        <div className="sleep-latest pixel-card mint">
          <div className="sleep-latest-header">
            <div><p className="card-title">最近记录 · {latest.date.slice(5)}</p><p className="card-desc">{latest.sleep_time} - {latest.wake_time}（{latest.hours}h）</p></div>
            {latest.quality && <span className={`idea-tag ${qualityColors[latest.quality]}`}>{qualityLabels[latest.quality]}</span>}
          </div>
          {latest.had_nightmare && <p className="sleep-nightmare">做了噩梦</p>}
          {latest.notes && <p className="cal-detail-note">{latest.notes}</p>}
        </div>
      )}

      <div className="sleep-summary">
        <div className="sleep-summary-item"><span className="health-label">7日均</span><span className="health-value">{avgHours}h</span></div>
        <div className="sleep-bars">
          {[...entries].reverse().map((entry) => (
            <div key={entry.id} className="sleep-bar-col" title={`${entry.date.slice(5)}: ${entry.hours}h`}>
              <div className="sleep-bar" style={{ height: `${Math.max(4, ((entry.hours || 0) / 10) * 50)}px`, background: `var(--color-${qualityColors[entry.quality || 'ok']}-border)` }} />
              <span className="sleep-bar-label">{entry.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="record-list">
        {entries.map((entry) => (
          <div key={entry.id} className="record-row">
            <div><strong>{entry.date.slice(5)}</strong><span>{entry.sleep_time}–{entry.wake_time} · {entry.hours}h</span></div>
            <div className="record-actions"><button type="button" onClick={() => handleEdit(entry)}>编辑</button><button type="button" onClick={() => handleDelete(entry)}>删除</button></div>
          </div>
        ))}
      </div>
      {!showForm && saveError && <p className="form-error">{saveError}</p>}
    </section>
  )
}

function calcHours(sleep: string, wake: string): number {
  const [sleepHour, sleepMinute] = sleep.split(':').map(Number)
  const [wakeHour, wakeMinute] = wake.split(':').map(Number)
  const sleepMinutes = sleepHour * 60 + sleepMinute
  let wakeMinutes = wakeHour * 60 + wakeMinute
  if (wakeMinutes <= sleepMinutes) wakeMinutes += 24 * 60
  return Math.round((wakeMinutes - sleepMinutes) / 6) / 10
}
