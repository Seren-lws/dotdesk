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
const qualityFaces: Record<string, string> = { great: '^‿^', good: '˘‿˘', ok: '–‿–', bad: ';﹏;' }

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

  const fillForm = (entry: SleepEntry) => {
    setEditingId(entry.id)
    setRecordDate(entry.date)
    setSleepTime(entry.sleep_time || '')
    setWakeTime(entry.wake_time || '')
    setQuality(entry.quality || 'good')
    setNightmare(entry.had_nightmare)
    setNotes(entry.notes || '')
  }

  const handleEdit = (entry: SleepEntry) => {
    fillForm(entry)
    setShowForm(true)
    setSaveError('')
  }

  const handleDateChange = (nextDate: string) => {
    const targetEntry = entries.find((entry) => entry.date === nextDate)
    if (targetEntry) fillForm(targetEntry)
    else {
      setEditingId(null)
      setRecordDate(nextDate)
      setSleepTime('')
      setWakeTime('')
      setQuality('good')
      setNightmare(false)
      setNotes('')
    }
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
    const editingEntry = editingId ? entries.find((entry) => entry.id === editingId) : null
    let existingId = editingEntry?.date === recordDate
      ? editingEntry.id
      : entries.find((entry) => entry.date === recordDate)?.id

    if (!existingId) {
      const { data, error: lookupError } = await supabase
        .from('dd_sleep')
        .select('id')
        .eq('date', recordDate)
        .limit(1)
        .maybeSingle()
      if (lookupError) {
        setSaveError('保存前检查日期失败，请稍后再试。刚才填写的内容还在。')
        setSaving(false)
        return
      }
      existingId = data?.id
    }

    const { error } = existingId
      ? await supabase.from('dd_sleep').update(values).eq('id', existingId)
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
    <section id="sleep" className="section module-panel sleep-section">
      <h2 className="section-title sleep-title">
        <span className="section-icon sleep-icon">S</span>
        睡眠
        <span className="module-kicker">NIGHT WINDOW</span>
        <button className="add-btn" onClick={() => showForm ? resetForm() : openNewForm()} aria-label="新增睡眠记录">{showForm ? '×' : '+'}</button>
      </h2>

      {showForm && (
        <div className="idea-form sleep-form">
          <label className="sleep-label">日期<input className="idea-input" type="date" value={recordDate} onChange={(event) => handleDateChange(event.target.value)} /></label>
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
        <div className="sleep-latest">
          <span className="sleep-moon" aria-hidden="true">☾</span>
          <div className="sleep-latest-copy">
            <p className="health-label">昨夜航程 · {latest.date.slice(5)}</p>
            <p className="sleep-hours">{latest.hours}<small> h</small></p>
            <p className="sleep-time-line"><span>{latest.sleep_time}</span><i>·····→</i><span>{latest.wake_time}</span></p>
          </div>
          {latest.quality && <div className={`sleep-face ${qualityColors[latest.quality]}`}><span>{qualityFaces[latest.quality]}</span><small>{qualityLabels[latest.quality]}</small></div>}
          {latest.had_nightmare && <p className="sleep-nightmare">做了噩梦</p>}
          {latest.notes && <p className="cal-detail-note">{latest.notes}</p>}
        </div>
      )}

      <div className="sleep-summary">
        <div className="sleep-summary-item"><span className="health-label">7日平均</span><span className="health-value">{avgHours}<small>h</small></span><span className="summary-caption">理想线 8h</span></div>
        <div className="sleep-chart">
          <span className="sleep-goal-line">8h</span>
          <div className="sleep-bars">
            {[...entries].reverse().map((entry) => (
              <div key={entry.id} className="sleep-bar-col" title={`${entry.date.slice(5)}: ${entry.hours}h`}>
                <div className="sleep-bar" style={{ height: `${Math.max(4, ((entry.hours || 0) / 10) * 62)}px`, background: `var(--color-${qualityColors[entry.quality || 'ok']}-border)` }} />
                <span className="sleep-bar-label">{entry.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="record-list">
        {entries.map((entry) => (
          <div key={entry.id} className="record-row">
            <div><strong>{entry.date.slice(5)}</strong><span>{qualityFaces[entry.quality || 'ok']} · {entry.sleep_time}–{entry.wake_time} · {entry.hours}h{entry.had_nightmare ? ' · 噩梦' : ''}</span></div>
            <RecordMenu onEdit={() => handleEdit(entry)} onDelete={() => handleDelete(entry)} />
          </div>
        ))}
      </div>
      {!showForm && saveError && <p className="form-error">{saveError}</p>}
    </section>
  )
}

function RecordMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <details className="record-menu"><summary aria-label="管理记录">···</summary><div className="record-menu-actions"><button type="button" onClick={onEdit}>编辑</button><button type="button" onClick={onDelete}>删除</button></div></details>
}

function calcHours(sleep: string, wake: string): number {
  const [sleepHour, sleepMinute] = sleep.split(':').map(Number)
  const [wakeHour, wakeMinute] = wake.split(':').map(Number)
  const sleepMinutes = sleepHour * 60 + sleepMinute
  let wakeMinutes = wakeHour * 60 + wakeMinute
  if (wakeMinutes <= sleepMinutes) wakeMinutes += 24 * 60
  return Math.round((wakeMinutes - sleepMinutes) / 6) / 10
}
