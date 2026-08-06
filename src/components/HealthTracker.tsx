import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface HealthEntry {
  id: string
  date: string
  weight: number | null
  period_day: number | null
  period_phase: string | null
  exercise: string | null
}

const phaseLabels: Record<string, string> = {
  menstrual: '经期',
  follicular: '卵泡期',
  ovulation: '排卵期',
  luteal: '黄体期',
}

const phaseColors: Record<string, string> = {
  menstrual: 'rose',
  follicular: 'sage',
  ovulation: 'sky',
  luteal: 'lavender',
}

export default function HealthTracker() {
  const [entries, setEntries] = useState<HealthEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [weight, setWeight] = useState('')
  const [exercise, setExercise] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('dd_health')
      .select('*')
      .order('date', { ascending: false })
      .limit(7)
      .then(({ data }) => setEntries(data || []))
  }, [])

  const latest = entries[0]
  const weights = [...entries].reverse().filter((e) => e.weight)
  const exerciseDays = entries.filter((e) => e.exercise)

  const handleSubmit = async () => {
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('dd_health').insert({
      date: today,
      weight: weight ? parseFloat(weight) : null,
      exercise: exercise.trim() || null,
    })
    setWeight('')
    setExercise('')
    setShowForm(false)
    setSaving(false)
    const { data } = await supabase
      .from('dd_health')
      .select('*')
      .order('date', { ascending: false })
      .limit(7)
    setEntries(data || [])
  }

  return (
    <section id="health" className="section">
      <h2 className="section-title">
        <span
          className="section-icon"
          style={{
            borderColor: 'var(--color-rose-border)',
            color: 'var(--color-rose-text)',
            background: 'var(--color-rose-light)',
          }}
        >
          H
        </span>
        健康
        <button
          className="add-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '×' : '+'}
        </button>
      </h2>

      {showForm && (
        <div className="idea-form" style={{ borderColor: 'var(--color-rose-border)', background: 'var(--color-rose-light)' }}>
          <input
            className="idea-input"
            placeholder="体重（kg）"
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <input
            className="idea-input"
            placeholder="运动内容（可选）"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
          />
          <button
            className="idea-submit"
            style={{ borderColor: 'var(--color-rose-border)', background: 'var(--color-rose-bg)', color: 'var(--color-rose-text)', boxShadow: '2px 2px 0 var(--color-rose-border)' }}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? '...' : '记录'}
          </button>
        </div>
      )}

      <div className="health-grid">
        {/* Weight */}
        <div className="health-box">
          <p className="health-label">体重</p>
          <p className="health-value">{latest?.weight ? `${latest.weight} kg` : '--'}</p>
          {weights.length > 1 && (
            <div className="weight-bar">
              {weights.map((w) => (
                <div
                  key={w.date}
                  className="weight-dot"
                  title={`${w.date.slice(5)}: ${w.weight}kg`}
                  style={{
                    height: `${Math.max(8, ((w.weight! - 48) / 8) * 40)}px`,
                    background: 'var(--color-rose-border)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Period */}
        <div className="health-box">
          <p className="health-label">经期</p>
          {latest?.period_phase ? (
            <>
              <p className="health-value">Day {latest.period_day}</p>
              <span className={`idea-tag ${phaseColors[latest.period_phase]}`}>
                {phaseLabels[latest.period_phase]}
              </span>
            </>
          ) : (
            <p className="health-value">--</p>
          )}
        </div>

        {/* Exercise */}
        <div className="health-box">
          <p className="health-label">本周运动</p>
          <div className="exercise-dots">
            {entries.map((e) => (
              <span
                key={e.date}
                className="exercise-dot"
                title={e.exercise || '没动'}
                style={{
                  background: e.exercise
                    ? 'var(--color-sage-border)'
                    : 'var(--border-default)',
                }}
              />
            ))}
          </div>
          <p className="card-desc" style={{ marginTop: '4px' }}>
            {exerciseDays.length}/{entries.length} 天
          </p>
        </div>
      </div>
    </section>
  )
}
