import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../lib/date'

interface HealthEntry {
  id: string
  date: string
  weight: number | null
  period_day: number | null
  period_phase: string | null
  exercise: string | null
  notes: string | null
}

const phaseLabels: Record<string, string> = {
  menstrual: '经期', follicular: '卵泡期', ovulation: '排卵期', luteal: '黄体期',
}

const phaseColors: Record<string, string> = {
  menstrual: 'rose', follicular: 'sage', ovulation: 'sky', luteal: 'lavender',
}

export default function HealthTracker() {
  const [entries, setEntries] = useState<HealthEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [recordDate, setRecordDate] = useState(getLocalDateString())
  const [weight, setWeight] = useState('')
  const [exercise, setExercise] = useState('')
  const [periodDay, setPeriodDay] = useState('')
  const [periodPhase, setPeriodPhase] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('dd_health')
      .select('*')
      .order('date', { ascending: false })
      .limit(7)
    if (error) setSaveError('健康记录加载失败，请刷新后再试。')
    else setEntries(data || [])
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const latest = entries[0]
  const weights = [...entries].reverse().filter((entry) => entry.weight != null)
  const exerciseDays = entries.filter((entry) => entry.exercise)
  const latestWeight = weights[weights.length - 1]
  const oldestWeight = weights[0]
  const weightValues = weights.map((entry) => Number(entry.weight))
  const weightMin = weightValues.length ? Math.min(...weightValues) : 0
  const weightMax = weightValues.length ? Math.max(...weightValues) : 0
  const weightDelta = latestWeight && oldestWeight && latestWeight.id !== oldestWeight.id
    ? Number(latestWeight.weight) - Number(oldestWeight.weight)
    : null

  const resetForm = () => {
    setEditingId(null)
    setRecordDate(getLocalDateString())
    setWeight('')
    setExercise('')
    setPeriodDay('')
    setPeriodPhase('')
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

  const handleEdit = (entry: HealthEntry) => {
    setEditingId(entry.id)
    setRecordDate(entry.date)
    setWeight(entry.weight == null ? '' : String(entry.weight))
    setExercise(entry.exercise || '')
    setPeriodDay(entry.period_day == null ? '' : String(entry.period_day))
    setPeriodPhase(entry.period_phase || '')
    setNotes(entry.notes || '')
    setShowForm(true)
    setSaveError('')
  }

  const handleSubmit = async () => {
    setSaving(true)
    setSaveError('')
    const values = {
      date: recordDate,
      weight: weight ? Number(weight) : null,
      exercise: exercise.trim() || null,
      period_day: periodDay ? Number(periodDay) : null,
      period_phase: periodPhase || null,
      notes: notes.trim() || null,
    }
    const existing = editingId ? entries.find((entry) => entry.id === editingId) : entries.find((entry) => entry.date === recordDate)
    const { error } = existing
      ? await supabase.from('dd_health').update(values).eq('id', existing.id)
      : await supabase.from('dd_health').insert(values)
    if (error) {
      setSaveError('保存失败，请稍后再试。刚才填写的内容还在。')
      setSaving(false)
      return
    }
    setSaving(false)
    resetForm()
    fetchEntries()
  }

  const handleDelete = async (entry: HealthEntry) => {
    if (!window.confirm(`确定删除 ${entry.date} 的健康记录吗？`)) return
    const { error } = await supabase.from('dd_health').delete().eq('id', entry.id)
    if (error) setSaveError('删除失败，请稍后再试。')
    else {
      if (editingId === entry.id) resetForm()
      fetchEntries()
    }
  }

  return (
    <section id="health" className="section module-panel health-section">
      <img className="health-gardener" src="/health-gardener.png" alt="抱着植物的像素园丁" />
      <span className="health-roof-decor" aria-hidden="true">✦ · ♣ · +</span>
      <h2 className="section-title health-title">
        <span className="section-icon health-icon">H</span>
        健康
        <span className="module-kicker">BODY GARDEN</span>
        <button className="add-btn" onClick={() => showForm ? resetForm() : openNewForm()} aria-label="新增健康记录">
          {showForm ? '×' : '+'}
        </button>
      </h2>

      {showForm && (
        <div className="idea-form health-form">
          <div className="record-form-grid">
            <label className="sleep-label">日期<input className="idea-input" type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} /></label>
            <label className="sleep-label">体重（kg）<input className="idea-input" type="number" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
            <label className="sleep-label">周期第几天<input className="idea-input" type="number" min="1" placeholder="可选" value={periodDay} onChange={(event) => setPeriodDay(event.target.value)} /></label>
            <label className="sleep-label">周期阶段
              <select className="idea-input" value={periodPhase} onChange={(event) => setPeriodPhase(event.target.value)}>
                <option value="">不记录</option>
                {Object.entries(phaseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <input className="idea-input" placeholder="运动内容（可选）" value={exercise} onChange={(event) => setExercise(event.target.value)} />
          <input className="idea-input" placeholder="身体感受或备注（可选）" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <button className="idea-submit health-submit" onClick={handleSubmit} disabled={saving || !recordDate}>
            {saving ? '保存中...' : editingId ? '保存修改' : '记录'}
          </button>
          {saveError && <p className="form-error">{saveError}</p>}
        </div>
      )}

      <div className="health-grid">
        <div className="health-box health-weight-box">
          <div className="health-box-heading"><p className="health-label">7日体重</p>{weightDelta != null && <span className={`health-change ${weightDelta > 0 ? 'up' : weightDelta < 0 ? 'down' : ''}`}>{weightDelta === 0 ? '持平' : `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg`}</span>}</div>
          <p className="health-value">{latestWeight?.weight != null ? `${latestWeight.weight} kg` : '--'}</p>
          {weights.length > 1 && <div className="weight-bar">{weights.map((entry) => {
            const range = Math.max(weightMax - weightMin, 0.4)
            const height = 12 + ((Number(entry.weight) - weightMin) / range) * 28
            return <div key={entry.id} className="weight-column"><div className="weight-dot" title={`${entry.date.slice(5)}: ${entry.weight}kg`} style={{ height: `${height}px` }} /><span>{entry.date.slice(8)}</span></div>
          })}</div>}
        </div>
        <div className="health-box health-cycle-box">
          <p className="health-label">身体周期</p>
          {latest?.period_phase ? <><span className="cycle-moon" aria-hidden="true">◐</span><p className="health-value">DAY {latest.period_day || '--'}</p><span className={`idea-tag ${phaseColors[latest.period_phase]}`}>{phaseLabels[latest.period_phase]}</span></> : <><span className="cycle-moon empty" aria-hidden="true">○</span><p className="health-value">--</p></>}
        </div>
        <div className="health-box health-exercise-box">
          <p className="health-label">7日活动</p>
          <p className="health-value">{exerciseDays.length}<small> / {entries.length || 7} 天</small></p>
          <div className="exercise-dots">{[...entries].reverse().map((entry) => <span key={entry.id} className={`exercise-dot ${entry.exercise ? 'active' : ''}`} title={entry.exercise || '休息'}>{entry.exercise ? '♣' : '·'}</span>)}</div>
          <p className="health-mini-note">{exerciseDays[0]?.exercise || '今天也可以好好休息'}</p>
        </div>
      </div>

      <div className="record-list">
        {entries.map((entry) => (
          <div key={entry.id} className="record-row">
            <div>
              <strong>{entry.date.slice(5)}</strong>
              <span>{entry.weight ? `${entry.weight}kg` : '未记体重'}{entry.exercise ? ` · ${entry.exercise}` : ''}{entry.notes ? ` · ${entry.notes}` : ''}</span>
            </div>
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
