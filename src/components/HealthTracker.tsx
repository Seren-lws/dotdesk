import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../lib/date'

type HealthSection = 'weight' | 'measurements' | 'cycle' | 'exercise'
type PeriodEvent = 'start' | 'end'
type MeasurementKey = 'upper_arm' | 'upper_bust' | 'under_bust' | 'waist' | 'hips' | 'thigh' | 'calf'

interface HealthEntry {
  id: string
  date: string
  weight: number | null
  period_day: number | null
  period_phase: string | null
  exercise: string | null
  notes: string | null
  created_at: string
  upper_arm: number | null
  upper_bust: number | null
  under_bust: number | null
  waist: number | null
  hips: number | null
  thigh: number | null
  calf: number | null
  period_event: PeriodEvent | null
  weight_notes: string | null
  measurement_notes: string | null
  cycle_notes: string | null
  exercise_notes: string | null
}

const measurementFields: Array<{ key: MeasurementKey; label: string }> = [
  { key: 'upper_arm', label: '大臂围' },
  { key: 'upper_bust', label: '上胸围' },
  { key: 'under_bust', label: '下胸围' },
  { key: 'waist', label: '腰围' },
  { key: 'hips', label: '臀围' },
  { key: 'thigh', label: '大腿围' },
  { key: 'calf', label: '小腿围' },
]

const emptyMeasurements = () => measurementFields.reduce<Record<MeasurementKey, string>>((values, field) => {
  values[field.key] = ''
  return values
}, {} as Record<MeasurementKey, string>)

const sectionLabels: Record<HealthSection, string> = {
  weight: '体重', measurements: '身体围度', cycle: '身体周期', exercise: '运动',
}

export default function HealthTracker() {
  const [entries, setEntries] = useState<HealthEntry[]>([])
  const [activeForm, setActiveForm] = useState<HealthSection | null>(null)
  const [activeHistory, setActiveHistory] = useState<HealthSection | null>(null)
  const [recordDate, setRecordDate] = useState(getLocalDateString())
  const [weight, setWeight] = useState('')
  const [measurements, setMeasurements] = useState(emptyMeasurements)
  const [exercise, setExercise] = useState('')
  const [periodEvent, setPeriodEvent] = useState<PeriodEvent>('start')
  const [sectionNotes, setSectionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('dd_health')
      .select('*')
      .order('date', { ascending: false })
      .limit(180)
    if (error) setSaveError('健康记录加载失败，请刷新后再试。')
    else setEntries((data || []) as HealthEntry[])
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const today = getLocalDateString()
  const weights = useMemo(() => entries.filter((entry) => entry.weight != null), [entries])
  const measurementEntries = useMemo(() => entries.filter(hasMeasurements), [entries])
  const exerciseEntries = useMemo(() => entries.filter((entry) => entry.exercise), [entries])
  const periodEvents = useMemo(() => entries.filter((entry) => entry.period_event), [entries])
  const latestPeriodEvent = periodEvents[0]
  const latestPeriodStart = periodEvents.find((entry) => entry.period_event === 'start' && entry.date <= today)
  const cycleDay = latestPeriodStart ? daysBetween(latestPeriodStart.date, today) + 1 : null
  const isMenstruating = latestPeriodEvent?.period_event === 'start' && latestPeriodEvent.date === latestPeriodStart?.date
  const cyclePhase = cycleDay ? inferCyclePhase(cycleDay, isMenstruating) : null
  const recentWeights = [...weights].slice(0, 7).reverse()
  const recentExerciseDays = Array.from({ length: 7 }, (_, index) => shiftDate(today, index - 6))
  const weightDelta = weights.length > 1 ? Number(weights[0].weight) - Number(weights[1].weight) : null
  const latestMeasurements = measurementEntries[0]

  const openForm = (section: HealthSection, entry?: HealthEntry) => {
    const targetDate = entry?.date || today
    const target = entry || entries.find((item) => item.date === targetDate)
    setActiveForm(section)
    setRecordDate(targetDate)
    setSaveError('')
    setWeight(target?.weight == null ? '' : String(target.weight))
    setExercise(target?.exercise || '')
    setPeriodEvent(target?.period_event || (latestPeriodEvent?.period_event === 'start' ? 'end' : 'start'))
    setMeasurements(measurementFields.reduce<Record<MeasurementKey, string>>((values, field) => {
      values[field.key] = target?.[field.key] == null ? '' : String(target[field.key])
      return values
    }, {} as Record<MeasurementKey, string>))
    setSectionNotes(
      section === 'weight' ? target?.weight_notes || target?.notes || ''
        : section === 'measurements' ? target?.measurement_notes || ''
          : section === 'cycle' ? target?.cycle_notes || ''
            : target?.exercise_notes || '',
    )
  }

  const closeForm = () => {
    setActiveForm(null)
    setRecordDate(today)
    setWeight('')
    setMeasurements(emptyMeasurements())
    setExercise('')
    setSectionNotes('')
    setSaveError('')
  }

  const changeFormDate = (nextDate: string) => {
    const target = entries.find((entry) => entry.date === nextDate)
    openForm(activeForm || 'weight', target || ({ date: nextDate } as HealthEntry))
  }

  const saveSection = async () => {
    if (!activeForm || !recordDate) return
    setSaving(true)
    setSaveError('')

    const payload = buildPayload(activeForm, {
      weight, measurements, exercise, periodEvent, notes: sectionNotes,
    })
    let existingId = entries.find((entry) => entry.date === recordDate)?.id

    if (!existingId) {
      const { data, error } = await supabase.from('dd_health').select('id').eq('date', recordDate).maybeSingle()
      if (error) {
        setSaveError('保存前检查日期失败，刚才填写的内容还在。')
        setSaving(false)
        return
      }
      existingId = data?.id
    }

    const result = existingId
      ? await supabase.from('dd_health').update(payload).eq('id', existingId)
      : await supabase.from('dd_health').insert({ date: recordDate, ...payload })

    if (result.error) {
      setSaveError('保存失败，请稍后再试。刚才填写的内容还在。')
      setSaving(false)
      return
    }

    setSaving(false)
    closeForm()
    await fetchEntries()
  }

  const toggleHistory = (section: HealthSection) => {
    setActiveHistory((current) => current === section ? null : section)
  }

  return (
    <section id="health" className="section module-panel health-section">
      <img className="health-gardener" src="/health-gardener.png" alt="抱着植物的像素园丁" />
      <span className="health-roof-decor" aria-hidden="true">✦ · ♣ · +</span>
      <h2 className="section-title health-title">
        <span className="section-icon health-icon">H</span>
        健康
        <span className="module-kicker">BODY GARDEN</span>
      </h2>

      <div className="health-grid health-v2-grid">
        <HealthCard className="health-weight-box" title="体重" kicker="WEIGHT" onAdd={() => openForm('weight')} onHistory={() => toggleHistory('weight')} historyOpen={activeHistory === 'weight'}>
          <div className="health-box-heading">
            <p className="health-value">{weights[0]?.weight != null ? `${weights[0].weight} kg` : '--'}</p>
            {weightDelta != null && <span className={`health-change ${weightDelta > 0 ? 'up' : weightDelta < 0 ? 'down' : ''}`}>{weightDelta === 0 ? '持平' : `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg`}</span>}
          </div>
          <MiniWeightChart entries={recentWeights} />
        </HealthCard>

        <HealthCard className="health-measure-box" title="身体围度" kicker="MEASURE" onAdd={() => openForm('measurements')} onHistory={() => toggleHistory('measurements')} historyOpen={activeHistory === 'measurements'}>
          <details className="health-measure-fold">
            <summary><span>{latestMeasurements ? `${latestMeasurements.date.slice(5)} 最近记录` : '暂时没有记录'}</span><b>展开围度</b></summary>
            {latestMeasurements && <div className="health-measure-values">{measurementFields.map((field) => latestMeasurements[field.key] != null && <span key={field.key}><i>{field.label}</i><strong>{latestMeasurements[field.key]} cm</strong></span>)}</div>}
          </details>
        </HealthCard>

        <HealthCard className="health-cycle-box" title="身体周期" kicker="CYCLE" onAdd={() => openForm('cycle')} onHistory={() => toggleHistory('cycle')} historyOpen={activeHistory === 'cycle'}>
          <div className="health-cycle-main">
            <span className="cycle-moon" aria-hidden="true">◐</span>
            <div><p className="health-value">{cycleDay ? `DAY ${cycleDay}` : '--'}</p><span className={`idea-tag ${cyclePhase?.color || 'lavender'}`}>{cyclePhase?.label || '记录开始日后自动计算'}</span></div>
          </div>
          <p className="health-mini-note">{latestPeriodStart ? `从 ${latestPeriodStart.date.slice(5)} 自动计数${isMenstruating ? ' · 经期中' : ''}` : '来月经时只需记一次开始'}</p>
        </HealthCard>

        <HealthCard className="health-exercise-box" title="运动" kicker="MOVE" onAdd={() => openForm('exercise')} onHistory={() => toggleHistory('exercise')} historyOpen={activeHistory === 'exercise'}>
          <p className="health-value">{recentExerciseDays.filter((date) => entries.some((entry) => entry.date === date && entry.exercise)).length}<small> / 7 天</small></p>
          <div className="exercise-dots">{recentExerciseDays.map((date) => {
            const entry = entries.find((item) => item.date === date)
            return <span key={date} className={`exercise-dot ${entry?.exercise ? 'active' : ''}`} title={entry?.exercise || `${date.slice(5)} 休息`}>{entry?.exercise ? '♣' : '·'}</span>
          })}</div>
          <p className="health-mini-note">{exerciseEntries[0]?.exercise || '今天也可以好好休息'}</p>
        </HealthCard>
      </div>

      {activeForm && (
        <div className={`idea-form health-form health-section-form ${activeForm}`}>
          <div className="health-form-head"><div><span>{formIcon(activeForm)}</span><strong>记录{sectionLabels[activeForm]}</strong></div><button type="button" onClick={closeForm}>×</button></div>
          <label className="sleep-label health-date-field">日期<input className="idea-input" type="date" value={recordDate} onChange={(event) => changeFormDate(event.target.value)} /></label>

          {activeForm === 'weight' && <label className="sleep-label">体重（kg）<input className="idea-input" type="number" min="0" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} autoFocus /></label>}

          {activeForm === 'measurements' && <div className="health-measure-form-grid">{measurementFields.map((field) => <label key={field.key} className="sleep-label">{field.label}（cm）<input className="idea-input" type="number" min="0" step="0.1" value={measurements[field.key]} onChange={(event) => setMeasurements({ ...measurements, [field.key]: event.target.value })} /></label>)}</div>}

          {activeForm === 'cycle' && <div className="health-period-choice"><button type="button" className={periodEvent === 'start' ? 'active' : ''} onClick={() => setPeriodEvent('start')}><b>● 本次开始</b><span>之后 DAY 数字会每天自动增加</span></button><button type="button" className={periodEvent === 'end' ? 'active' : ''} onClick={() => setPeriodEvent('end')}><b>○ 本次结束</b><span>记下经期结束的日期</span></button></div>}

          {activeForm === 'exercise' && <label className="sleep-label">今天做了什么<input className="idea-input" placeholder="散步20分钟 / 瑜伽 / 健身…" value={exercise} onChange={(event) => setExercise(event.target.value)} autoFocus /></label>}

          <label className="sleep-label">备注（可选）<input className="idea-input" placeholder="身体感受、变化或想记住的事" value={sectionNotes} onChange={(event) => setSectionNotes(event.target.value)} /></label>
          <button className="idea-submit health-submit" onClick={saveSection} disabled={saving || !canSave(activeForm, weight, measurements, exercise)}>{saving ? '保存中…' : `保存${sectionLabels[activeForm]}`}</button>
          {saveError && <p className="form-error">{saveError}</p>}
        </div>
      )}

      {activeHistory && <HealthHistory section={activeHistory} entries={entries} onEdit={(entry) => openForm(activeHistory, entry)} onClose={() => setActiveHistory(null)} />}
      {!activeForm && saveError && <p className="form-error">{saveError}</p>}
    </section>
  )
}

function HealthCard({ className, title, kicker, children, onAdd, onHistory, historyOpen }: { className: string; title: string; kicker: string; children: React.ReactNode; onAdd: () => void; onHistory: () => void; historyOpen: boolean }) {
  return <div className={`health-box health-v2-card ${className}`}>
    <div className="health-card-title"><div><strong>{title}</strong><span>{kicker}</span></div><button type="button" onClick={onAdd} aria-label={`记录${title}`}>+</button></div>
    <div className="health-card-body">{children}</div>
    <button type="button" className={`health-history-link ${historyOpen ? 'active' : ''}`} onClick={onHistory}>{historyOpen ? '收起变化 ↑' : '查看时间变化 →'}</button>
  </div>
}

function MiniWeightChart({ entries }: { entries: HealthEntry[] }) {
  if (entries.length < 2) return <p className="health-mini-note">再记一次，就能看到变化。</p>
  const values = entries.map((entry) => Number(entry.weight))
  const min = Math.min(...values)
  const range = Math.max(Math.max(...values) - min, .4)
  return <div className="weight-bar">{entries.map((entry) => <div key={entry.id} className="weight-column"><div className="weight-dot" title={`${entry.date.slice(5)}: ${entry.weight}kg`} style={{ height: `${12 + ((Number(entry.weight) - min) / range) * 28}px` }} /><span>{entry.date.slice(8)}</span></div>)}</div>
}

function HealthHistory({ section, entries, onEdit, onClose }: { section: HealthSection; entries: HealthEntry[]; onEdit: (entry: HealthEntry) => void; onClose: () => void }) {
  const relevant = section === 'weight' ? entries.filter((entry) => entry.weight != null)
    : section === 'measurements' ? entries.filter(hasMeasurements)
      : section === 'cycle' ? entries.filter((entry) => entry.period_event)
        : entries.filter((entry) => entry.exercise)

  return <div className={`health-history-panel ${section}`}>
    <div className="health-history-head"><div><span>{formIcon(section)}</span><strong>{sectionLabels[section]}变化</strong><small>{historyHint(section)}</small></div><button type="button" onClick={onClose}>×</button></div>
    {relevant.length === 0 ? <p className="health-history-empty">还没有记录，先记下第一笔吧。</p> : <div className="health-history-list">{relevant.map((entry, index) => {
      const previous = relevant[index + 1]
      return <button type="button" key={entry.id} onClick={() => onEdit(entry)}>
        <strong>{entry.date.slice(5)}</strong>
        <span>{historyText(section, entry, previous)}</span>
        <i>{historyNote(section, entry) || '点击编辑'}</i>
      </button>
    })}</div>}
  </div>
}

function buildPayload(section: HealthSection, values: { weight: string; measurements: Record<MeasurementKey, string>; exercise: string; periodEvent: PeriodEvent; notes: string }) {
  if (section === 'weight') return { weight: numberOrNull(values.weight), weight_notes: values.notes.trim() || null }
  if (section === 'exercise') return { exercise: values.exercise.trim() || null, exercise_notes: values.notes.trim() || null }
  if (section === 'cycle') return { period_event: values.periodEvent, cycle_notes: values.notes.trim() || null }
  return {
    ...measurementFields.reduce<Record<string, number | null>>((payload, field) => {
      payload[field.key] = numberOrNull(values.measurements[field.key])
      return payload
    }, {}),
    measurement_notes: values.notes.trim() || null,
  }
}

function canSave(section: HealthSection, weight: string, measurements: Record<MeasurementKey, string>, exercise: string) {
  if (section === 'weight') return Boolean(weight)
  if (section === 'measurements') return measurementFields.some((field) => measurements[field.key])
  if (section === 'exercise') return Boolean(exercise.trim())
  return true
}

function hasMeasurements(entry: HealthEntry) { return measurementFields.some((field) => entry[field.key] != null) }
function numberOrNull(value: string) { return value === '' ? null : Number(value) }
function parseDate(value: string) { return new Date(`${value}T12:00:00`) }
function daysBetween(from: string, to: string) { return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000) }
function shiftDate(date: string, amount: number) { const next = parseDate(date); next.setDate(next.getDate() + amount); return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}` }
function inferCyclePhase(day: number, menstruating: boolean) {
  if (menstruating || day <= 5) return { label: '经期', color: 'rose' }
  const normalized = ((day - 1) % 28) + 1
  if (normalized <= 13) return { label: '卵泡期', color: 'sage' }
  if (normalized <= 16) return { label: '排卵期', color: 'sky' }
  return { label: '黄体期', color: 'lavender' }
}
function formIcon(section: HealthSection) { return { weight: '▥', measurements: '⌗', cycle: '◐', exercise: '♣' }[section] }
function historyHint(section: HealthSection) { return { weight: '每次称重', measurements: '不必天天记录', cycle: '开始与结束', exercise: '动过就算' }[section] }
function historyNote(section: HealthSection, entry: HealthEntry) { return section === 'weight' ? entry.weight_notes || entry.notes : section === 'measurements' ? entry.measurement_notes : section === 'cycle' ? entry.cycle_notes : entry.exercise_notes }
function historyText(section: HealthSection, entry: HealthEntry, previous?: HealthEntry) {
  if (section === 'weight') {
    const delta = previous?.weight != null && entry.weight != null ? Number(entry.weight) - Number(previous.weight) : null
    return `${entry.weight} kg${delta == null ? '' : delta === 0 ? ' · 持平' : ` · ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}`
  }
  if (section === 'measurements') return measurementFields.filter((field) => entry[field.key] != null).map((field) => `${field.label} ${entry[field.key]}`).join(' · ')
  if (section === 'cycle') return entry.period_event === 'start' ? `本次开始${previous?.period_event === 'start' ? ` · 周期 ${daysBetween(previous.date, entry.date)} 天` : ''}` : '本次结束'
  return entry.exercise || ''
}
