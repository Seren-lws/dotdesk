import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLocalDateString } from '../lib/date'
import { supabase } from '../lib/supabase'

interface Novel {
  id: string
  title: string
  sort_order: number
}

interface NovelDailyStat {
  id: string
  novel_id: string
  record_date: string
  popularity: number
  favorites: number
  pearls: number
  comments: number
  subscriptions: number
  notes: string | null
}

interface NovelIncome {
  id: string
  record_date: string
  total_po: number
  notes: string | null
}

type RangeDays = 7 | 14 | 30
type MetricKey = 'popularity' | 'favorites' | 'pearls' | 'comments' | 'subscriptions'

const metrics: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: 'popularity', label: '人气', color: '#8f778b' },
  { key: 'favorites', label: '收藏', color: '#ad7f8a' },
  { key: 'pearls', label: '珠珠', color: '#b49678' },
  { key: 'comments', label: '评论', color: '#82978b' },
  { key: 'subscriptions', label: '订阅', color: '#7f8fa3' },
]

const emptyStatForm = {
  date: getLocalDateString(),
  popularity: '',
  favorites: '',
  pearls: '',
  comments: '',
  subscriptions: '',
  notes: '',
}

const emptyIncomeForm = {
  date: getLocalDateString(),
  totalPo: '',
  notes: '',
}

function rangeStart(days: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - days + 1)
  return getLocalDateString(date)
}

function formatNumber(value: number | undefined) {
  return value === undefined ? '—' : new Intl.NumberFormat('zh-CN').format(value)
}

function parseCount(value: string) {
  return Math.max(0, Number.parseInt(value || '0', 10) || 0)
}

function deltaLabel(current: number | undefined, previous: number | undefined) {
  if (current === undefined || previous === undefined) return '暂无对比'
  const delta = current - previous
  if (delta === 0) return '持平'
  return `${delta > 0 ? '+' : ''}${formatNumber(delta)}`
}

export default function NovelPerformance() {
  const [novels, setNovels] = useState<Novel[]>([])
  const [selectedNovelId, setSelectedNovelId] = useState('')
  const [stats, setStats] = useState<NovelDailyStat[]>([])
  const [income, setIncome] = useState<NovelIncome[]>([])
  const [range, setRange] = useState<RangeDays>(7)
  const [showNovelForm, setShowNovelForm] = useState(false)
  const [novelTitle, setNovelTitle] = useState('')
  const [editingNovelId, setEditingNovelId] = useState<string | null>(null)
  const [showStatForm, setShowStatForm] = useState(false)
  const [statForm, setStatForm] = useState(emptyStatForm)
  const [editingStatId, setEditingStatId] = useState<string | null>(null)
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [incomeForm, setIncomeForm] = useState(emptyIncomeForm)
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const fetchNovels = useCallback(async () => {
    const { data, error } = await supabase.from('dd_novels').select('*').order('sort_order').order('created_at')
    if (error) setMessage('小说列表加载失败，请刷新后再试。')
    else {
      const rows = (data || []) as Novel[]
      setNovels(rows)
      setSelectedNovelId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id || '')
    }
    setLoading(false)
  }, [])

  const fetchStats = useCallback(async (novelId: string) => {
    if (!novelId) {
      setStats([])
      return
    }
    const { data, error } = await supabase
      .from('dd_novel_daily_stats')
      .select('*')
      .eq('novel_id', novelId)
      .gte('record_date', rangeStart(30))
      .order('record_date')
    if (error) setMessage('小说成绩加载失败，请稍后再试。')
    else setStats((data || []) as NovelDailyStat[])
  }, [])

  const fetchIncome = useCallback(async () => {
    const { data, error } = await supabase
      .from('dd_novel_account_income')
      .select('*')
      .gte('record_date', rangeStart(30))
      .order('record_date')
    if (error) setMessage('账号收入加载失败，请稍后再试。')
    else setIncome((data || []) as NovelIncome[])
  }, [])

  useEffect(() => {
    fetchNovels()
    fetchIncome()
  }, [fetchIncome, fetchNovels])

  useEffect(() => { fetchStats(selectedNovelId) }, [fetchStats, selectedNovelId])

  const visibleStats = useMemo(
    () => stats.filter((item) => item.record_date >= rangeStart(range)),
    [range, stats],
  )
  const visibleIncome = useMemo(
    () => income.filter((item) => item.record_date >= rangeStart(range)),
    [income, range],
  )
  const latestStat = visibleStats.at(-1)
  const previousStat = visibleStats.at(-2)
  const latestIncome = visibleIncome.at(-1)
  const previousIncome = visibleIncome.at(-2)
  const rangeIncomeGain = latestIncome && visibleIncome[0]
    ? latestIncome.total_po - visibleIncome[0].total_po
    : undefined

  const chartLines = useMemo(() => {
    const width = 720
    const height = 210
    const left = 30
    const right = 18
    const top = 18
    const bottom = 28
    const start = new Date(`${rangeStart(range)}T00:00:00`).getTime()
    const span = Math.max(1, (range - 1) * 86400000)

    return metrics.map((metric) => {
      const values = visibleStats.map((item) => Number(item[metric.key]))
      const min = Math.min(...values)
      const max = Math.max(...values)
      const valueSpan = Math.max(1, max - min)
      const points = visibleStats.map((item) => {
        const time = new Date(`${item.record_date}T00:00:00`).getTime()
        const x = left + ((time - start) / span) * (width - left - right)
        const y = top + (1 - (Number(item[metric.key]) - min) / valueSpan) * (height - top - bottom)
        return { x, y, value: Number(item[metric.key]), date: item.record_date }
      })
      return { ...metric, points, polyline: points.map((point) => `${point.x},${point.y}`).join(' ') }
    })
  }, [range, visibleStats])

  const resetNovelForm = () => {
    setNovelTitle('')
    setEditingNovelId(null)
    setShowNovelForm(false)
  }

  const saveNovel = async () => {
    if (!novelTitle.trim()) return
    setSaving(true)
    setMessage('')
    if (editingNovelId) {
      const { error } = await supabase.from('dd_novels').update({ title: novelTitle.trim() }).eq('id', editingNovelId)
      if (error) setMessage('小说名称保存失败，刚才填写的内容还在。')
      else {
        resetNovelForm()
        fetchNovels()
      }
    } else {
      const { data, error } = await supabase
        .from('dd_novels')
        .insert({ title: novelTitle.trim(), sort_order: novels.length })
        .select()
        .single()
      if (error) setMessage('添加小说失败，刚才填写的内容还在。')
      else {
        resetNovelForm()
        await fetchNovels()
        setSelectedNovelId(data.id)
      }
    }
    setSaving(false)
  }

  const editNovel = (novel: Novel) => {
    setNovelTitle(novel.title)
    setEditingNovelId(novel.id)
    setShowNovelForm(true)
  }

  const deleteNovel = async (novel: Novel) => {
    if (!window.confirm(`确定删除《${novel.title}》和它的全部每日成绩吗？`)) return
    const { error } = await supabase.from('dd_novels').delete().eq('id', novel.id)
    if (error) setMessage('删除小说失败，请稍后再试。')
    else {
      if (selectedNovelId === novel.id) setSelectedNovelId('')
      fetchNovels()
    }
  }

  const openStatForm = (entry?: NovelDailyStat) => {
    setStatForm(entry ? {
      date: entry.record_date,
      popularity: String(entry.popularity),
      favorites: String(entry.favorites),
      pearls: String(entry.pearls),
      comments: String(entry.comments),
      subscriptions: String(entry.subscriptions),
      notes: entry.notes || '',
    } : emptyStatForm)
    setEditingStatId(entry?.id || null)
    setShowStatForm(true)
    setMessage('')
    if (entry) window.setTimeout(() => document.querySelector('#novel-stat-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const closeStatForm = () => {
    setShowStatForm(false)
    setEditingStatId(null)
    setStatForm(emptyStatForm)
  }

  const saveStat = async () => {
    if (!selectedNovelId || !statForm.date) return
    setSaving(true)
    setMessage('')
    const values = {
      novel_id: selectedNovelId,
      record_date: statForm.date,
      popularity: parseCount(statForm.popularity),
      favorites: parseCount(statForm.favorites),
      pearls: parseCount(statForm.pearls),
      comments: parseCount(statForm.comments),
      subscriptions: parseCount(statForm.subscriptions),
      notes: statForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const existing = editingStatId
      ? stats.find((item) => item.id === editingStatId)
      : stats.find((item) => item.record_date === statForm.date)
    const { error } = existing
      ? await supabase.from('dd_novel_daily_stats').update(values).eq('id', existing.id)
      : await supabase.from('dd_novel_daily_stats').insert(values)
    if (error) setMessage('成绩保存失败，刚才填写的内容还在。')
    else {
      closeStatForm()
      fetchStats(selectedNovelId)
    }
    setSaving(false)
  }

  const deleteStat = async (entry: NovelDailyStat) => {
    if (!window.confirm(`确定删除 ${entry.record_date} 的成绩吗？`)) return
    const { error } = await supabase.from('dd_novel_daily_stats').delete().eq('id', entry.id)
    if (error) setMessage('删除成绩失败，请稍后再试。')
    else {
      if (editingStatId === entry.id) closeStatForm()
      fetchStats(selectedNovelId)
    }
  }

  const openIncomeForm = (entry?: NovelIncome) => {
    setIncomeForm(entry ? {
      date: entry.record_date,
      totalPo: String(entry.total_po),
      notes: entry.notes || '',
    } : emptyIncomeForm)
    setEditingIncomeId(entry?.id || null)
    setShowIncomeForm(true)
    setMessage('')
    if (entry) window.setTimeout(() => document.querySelector('#novel-income-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const closeIncomeForm = () => {
    setShowIncomeForm(false)
    setEditingIncomeId(null)
    setIncomeForm(emptyIncomeForm)
  }

  const saveIncome = async () => {
    if (!incomeForm.date) return
    setSaving(true)
    setMessage('')
    const values = {
      record_date: incomeForm.date,
      total_po: parseCount(incomeForm.totalPo),
      notes: incomeForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const existing = editingIncomeId
      ? income.find((item) => item.id === editingIncomeId)
      : income.find((item) => item.record_date === incomeForm.date)
    const { error } = existing
      ? await supabase.from('dd_novel_account_income').update(values).eq('id', existing.id)
      : await supabase.from('dd_novel_account_income').insert(values)
    if (error) setMessage('收入保存失败，刚才填写的内容还在。')
    else {
      closeIncomeForm()
      fetchIncome()
    }
    setSaving(false)
  }

  const deleteIncome = async (entry: NovelIncome) => {
    if (!window.confirm(`确定删除 ${entry.record_date} 的收入记录吗？`)) return
    const { error } = await supabase.from('dd_novel_account_income').delete().eq('id', entry.id)
    if (error) setMessage('删除收入失败，请稍后再试。')
    else {
      if (editingIncomeId === entry.id) closeIncomeForm()
      fetchIncome()
    }
  }

  return (
    <section id="novels" className="section module-panel novel-section">
      <div className="novel-desk-decor" aria-hidden="true">
        <span className="novel-trophy">🏆</span>
        <span className="novel-pencil">✎</span>
        <span className="novel-sparkle">✦</span>
      </div>
      <h2 className="section-title novel-title">
        <span className="section-icon novel-icon">N</span>
        小说成绩
        <span className="module-kicker">STORY SCOREBOARD</span>
        <button className="add-btn" onClick={() => showStatForm ? closeStatForm() : openStatForm()} aria-label="记录今日小说成绩" disabled={!selectedNovelId}>
          {showStatForm ? '×' : '+'}
        </button>
      </h2>

      <div className="novel-screen">
        <div className="novel-screen-bar" aria-hidden="true">
          <span>WRITING LOG · ONLINE</span>
          <i></i><i></i><i></i>
        </div>

      <div className="novel-shelf">
        <div className="novel-tabs">
          {novels.map((novel) => (
            <div key={novel.id} className={`novel-tab-wrap ${selectedNovelId === novel.id ? 'active' : ''}`}>
              <button type="button" className="novel-tab" onClick={() => setSelectedNovelId(novel.id)}>{novel.title}</button>
              <details className="novel-menu">
                <summary aria-label={`管理《${novel.title}》`}>···</summary>
                <div className="novel-menu-actions">
                  <button type="button" onClick={() => editNovel(novel)}>改名</button>
                  <button type="button" onClick={() => deleteNovel(novel)}>删除</button>
                </div>
              </details>
            </div>
          ))}
        </div>
        <button type="button" className="novel-add-book" onClick={() => showNovelForm ? resetNovelForm() : setShowNovelForm(true)}>
          {showNovelForm ? '取消' : '+ 添加小说'}
        </button>
      </div>

      {showNovelForm && (
        <div className="novel-inline-form">
          <input className="idea-input" placeholder="小说名称" value={novelTitle} onChange={(event) => setNovelTitle(event.target.value)} />
          <button type="button" className="idea-submit novel-submit" onClick={saveNovel} disabled={saving || !novelTitle.trim()}>
            {saving ? '保存中…' : editingNovelId ? '保存名称' : '放上书架'}
          </button>
        </div>
      )}

      <div className="novel-income-panel">
        <div>
          <span className="novel-overline">账号累计总收入</span>
          <strong>{formatNumber(latestIncome?.total_po)} <small>PO币</small></strong>
        </div>
        <div className="novel-income-delta">
          <span>较上次</span>
          <b>{deltaLabel(latestIncome?.total_po, previousIncome?.total_po)}</b>
        </div>
        <div className="novel-income-delta">
          <span>近{range}天</span>
          <b>{rangeIncomeGain === undefined ? '暂无对比' : `${rangeIncomeGain >= 0 ? '+' : ''}${formatNumber(rangeIncomeGain)}`}</b>
        </div>
        <button type="button" className="novel-income-btn" onClick={() => showIncomeForm ? closeIncomeForm() : openIncomeForm()}>
          {showIncomeForm ? '收起' : '记录收入'}
        </button>
      </div>

      {showIncomeForm && (
        <div id="novel-income-form" className="record-form novel-record-form">
          <div className="novel-form-grid income-form-grid">
            <label>日期<input type="date" className="idea-input" value={incomeForm.date} onChange={(event) => setIncomeForm({ ...incomeForm, date: event.target.value })} /></label>
            <label>累计 PO 币<input type="number" min="0" step="1" className="idea-input" value={incomeForm.totalPo} onChange={(event) => setIncomeForm({ ...incomeForm, totalPo: event.target.value })} /></label>
            <label className="novel-note-field">备注<input className="idea-input" value={incomeForm.notes} onChange={(event) => setIncomeForm({ ...incomeForm, notes: event.target.value })} placeholder="例如：本月稿费结算" /></label>
          </div>
          <div className="record-form-actions">
            {(editingIncomeId ? income.find((item) => item.id === editingIncomeId) : income.find((item) => item.record_date === incomeForm.date)) && (
              <button type="button" className="record-delete-btn" onClick={() => deleteIncome((editingIncomeId ? income.find((item) => item.id === editingIncomeId) : income.find((item) => item.record_date === incomeForm.date))!)}>删除这条</button>
            )}
            <button type="button" className="idea-submit novel-submit" onClick={saveIncome} disabled={saving || !incomeForm.totalPo}>{saving ? '保存中…' : editingIncomeId ? '保存修改' : '保存收入'}</button>
          </div>
        </div>
      )}

      {income.length > 0 && (
        <div className="novel-history novel-income-history">
          <p className="novel-history-title">最近收入记录</p>
          {[...income].reverse().slice(0, 5).map((entry) => (
            <div key={entry.id} className="novel-history-row">
              <strong>{entry.record_date.slice(5)}</strong>
              <span>累计 {formatNumber(entry.total_po)} PO 币</span>
              <small>{entry.notes || '没有备注'}</small>
              <div className="novel-history-actions">
                <button type="button" onClick={() => openIncomeForm(entry)}>编辑</button>
                <button type="button" onClick={() => deleteIncome(entry)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showStatForm && selectedNovelId && (
        <div id="novel-stat-form" className="record-form novel-record-form">
          <div className="novel-form-grid">
            <label>日期<input type="date" className="idea-input" value={statForm.date} onChange={(event) => setStatForm({ ...statForm, date: event.target.value })} /></label>
            <label>人气值<input type="number" min="0" step="1" className="idea-input" value={statForm.popularity} onChange={(event) => setStatForm({ ...statForm, popularity: event.target.value })} /></label>
            <label>收藏数<input type="number" min="0" step="1" className="idea-input" value={statForm.favorites} onChange={(event) => setStatForm({ ...statForm, favorites: event.target.value })} /></label>
            <label>珠珠数<input type="number" min="0" step="1" className="idea-input" value={statForm.pearls} onChange={(event) => setStatForm({ ...statForm, pearls: event.target.value })} /></label>
            <label>评论数<input type="number" min="0" step="1" className="idea-input" value={statForm.comments} onChange={(event) => setStatForm({ ...statForm, comments: event.target.value })} /></label>
            <label>订阅数<input type="number" min="0" step="1" className="idea-input" value={statForm.subscriptions} onChange={(event) => setStatForm({ ...statForm, subscriptions: event.target.value })} /></label>
            <label className="novel-note-field">备注<input className="idea-input" value={statForm.notes} onChange={(event) => setStatForm({ ...statForm, notes: event.target.value })} placeholder="例如：今天更新了新章节" /></label>
          </div>
          <div className="record-form-actions">
            {(editingStatId ? stats.find((item) => item.id === editingStatId) : stats.find((item) => item.record_date === statForm.date)) && (
              <button type="button" className="record-delete-btn" onClick={() => deleteStat((editingStatId ? stats.find((item) => item.id === editingStatId) : stats.find((item) => item.record_date === statForm.date))!)}>删除这条</button>
            )}
            <button type="button" className="idea-submit novel-submit" onClick={saveStat} disabled={saving}>{saving ? '保存中…' : editingStatId ? '保存修改' : '保存成绩'}</button>
          </div>
        </div>
      )}

      {novels.length === 0 && !loading ? (
        <div className="novel-empty">
          <span>▤</span>
          <p>书架还是空的，先添加第一本小说吧。</p>
        </div>
      ) : (
        <>
          <div className="novel-metric-grid">
            {metrics.map((metric) => (
              <div key={metric.key} className="novel-metric-card" style={{ '--metric-color': metric.color } as React.CSSProperties}>
                <span>{metric.label}</span>
                <strong>{formatNumber(latestStat?.[metric.key])}</strong>
                <small>{deltaLabel(latestStat?.[metric.key], previousStat?.[metric.key])}</small>
              </div>
            ))}
          </div>

          <div className="novel-chart-card">
            <div className="novel-chart-head">
              <div>
                <strong>成绩变化</strong>
                <span>各指标使用独立刻度，方便看清趋势</span>
              </div>
              <div className="novel-range-tabs">
                {([7, 14, 30] as RangeDays[]).map((days) => (
                  <button type="button" key={days} className={range === days ? 'active' : ''} onClick={() => setRange(days)}>{days === 7 ? '7天' : days === 14 ? '两周' : '一月'}</button>
                ))}
              </div>
            </div>

            <div className="novel-chart-legend">
              {metrics.map((metric) => <span key={metric.key}><i style={{ background: metric.color }} />{metric.label}</span>)}
            </div>

            {visibleStats.length > 0 ? (
              <svg className="novel-chart" viewBox="0 0 720 210" role="img" aria-label={`近${range}天小说成绩折线图`}>
                {[0, 1, 2, 3, 4].map((line) => <line key={line} x1="30" x2="702" y1={18 + line * 41} y2={18 + line * 41} className="novel-chart-gridline" />)}
                {chartLines.map((line) => (
                  <g key={line.key}>
                    {line.points.length > 1 && <polyline points={line.polyline} fill="none" stroke={line.color} strokeWidth="3" vectorEffect="non-scaling-stroke" />}
                    {line.points.map((point) => (
                      <circle key={`${line.key}-${point.date}`} cx={point.x} cy={point.y} r="4" fill={line.color} stroke="#fffdf8" strokeWidth="2">
                        <title>{`${point.date} · ${line.label} ${formatNumber(point.value)}`}</title>
                      </circle>
                    ))}
                  </g>
                ))}
                <text x="30" y="204" className="novel-chart-date">{rangeStart(range).slice(5)}</text>
                <text x="702" y="204" textAnchor="end" className="novel-chart-date">{getLocalDateString().slice(5)}</text>
              </svg>
            ) : (
              <div className="novel-chart-empty">记录一天成绩后，这里就会长出折线。</div>
            )}
          </div>

          <div className="novel-history">
            <p className="novel-history-title">最近记录</p>
            {[...visibleStats].reverse().slice(0, 5).map((entry) => (
              <div key={entry.id} className="novel-history-row">
                <strong>{entry.record_date.slice(5)}</strong>
                <span>人气 {formatNumber(entry.popularity)} · 收藏 {formatNumber(entry.favorites)} · 珠珠 {formatNumber(entry.pearls)} · 评论 {formatNumber(entry.comments)} · 订阅 {formatNumber(entry.subscriptions)}</span>
                <small>{entry.notes || '没有备注'}</small>
                <div className="novel-history-actions">
                  <button type="button" onClick={() => openStatForm(entry)}>编辑</button>
                  <button type="button" onClick={() => deleteStat(entry)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {message && <p className="form-error">{message}</p>}
      </div>

      <div className="novel-monitor-stand" aria-hidden="true">
        <span></span>
      </div>
    </section>
  )
}
