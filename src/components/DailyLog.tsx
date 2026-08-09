import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLocalDateString } from '../lib/date'
import { supabase } from '../lib/supabase'

interface DailyLogEntry {
  id: string
  log_date: string
  content: string
  created_at: string
  updated_at: string
}

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}`, lastDay }
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`)
  next.setDate(next.getDate() + days)
  return getLocalDateString(next)
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(year, monthNumber - 1 + amount, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function readableDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月${parsed.getDate()}日 · 星期${weekdays[parsed.getDay()]}`
}

function excerpt(content: string) {
  const text = content.replace(/\s+/g, ' ').trim()
  return text.length > 34 ? `${text.slice(0, 34)}…` : text
}

export default function DailyLog() {
  const today = getLocalDateString()
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewMonth, setViewMonth] = useState(today.slice(0, 7))
  const [entries, setEntries] = useState<DailyLogEntry[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fetchEntries = useCallback(async (month: string) => {
    setLoading(true)
    const bounds = monthBounds(month)
    const { data, error } = await supabase
      .from('dd_daily_logs')
      .select('*')
      .gte('log_date', bounds.start)
      .lte('log_date', bounds.end)
      .order('log_date')
    if (error) setMessage('日志加载失败，请刷新后再试。')
    else setEntries((data || []) as DailyLogEntry[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries(viewMonth) }, [fetchEntries, viewMonth])

  const selectedEntry = entries.find((entry) => entry.log_date === selectedDate)

  useEffect(() => {
    setContent(selectedEntry?.content || '')
  }, [selectedDate, selectedEntry?.id, selectedEntry?.content])

  useEffect(() => { setMessage('') }, [selectedDate])

  const calendarCells = useMemo(() => {
    const bounds = monthBounds(viewMonth)
    const firstWeekday = new Date(`${bounds.start}T00:00:00`).getDay()
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: bounds.lastDay }, (_, index) => index + 1),
    ]
  }, [viewMonth])

  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.log_date, entry])), [entries])
  const monthEntries = useMemo(() => [...entries].reverse(), [entries])

  const selectDate = (date: string) => {
    setSelectedDate(date)
    setViewMonth(date.slice(0, 7))
  }

  const turnPage = (days: number) => selectDate(shiftDate(selectedDate, days))

  const saveLog = async () => {
    if (!content.trim()) {
      setMessage('写下一点内容后再保存吧。')
      return
    }
    setSaving(true)
    setMessage('')
    const values = {
      log_date: selectedDate,
      content,
      updated_at: new Date().toISOString(),
    }
    const { error } = selectedEntry
      ? await supabase.from('dd_daily_logs').update(values).eq('id', selectedEntry.id)
      : await supabase.from('dd_daily_logs').insert(values)
    if (error) setMessage('保存失败，刚才写的内容还在。')
    else {
      setMessage('已写进日记本。')
      await fetchEntries(viewMonth)
    }
    setSaving(false)
  }

  const deleteLog = async () => {
    if (!selectedEntry || !window.confirm(`确定清空 ${selectedDate} 的日志吗？`)) return
    const { error } = await supabase.from('dd_daily_logs').delete().eq('id', selectedEntry.id)
    if (error) setMessage('删除失败，请稍后再试。')
    else {
      setContent('')
      setMessage('这一天已经清空。')
      await fetchEntries(viewMonth)
    }
  }

  return (
    <section id="daily-log" className="section daily-log-panel">
      <div className="daily-log-cover" aria-hidden="true" />
      <h2 className="section-title daily-log-title">
        <span className="section-icon daily-log-icon">D</span>
        每日日志
        <span className="module-kicker">DAY BY DAY</span>
      </h2>

      <div className="daily-log-book">
        <div className="daily-log-page daily-log-index-page">
          <div className="daily-log-month-head">
            <button type="button" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))} aria-label="上个月">‹</button>
            <strong>{Number(viewMonth.slice(0, 4))}年 {Number(viewMonth.slice(5))}月</strong>
            <button type="button" onClick={() => setViewMonth(shiftMonth(viewMonth, 1))} aria-label="下个月">›</button>
          </div>

          <div className="daily-log-weekdays" aria-hidden="true">
            {weekdays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="daily-log-calendar">
            {calendarCells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="daily-log-day empty" />
              const date = `${viewMonth}-${String(day).padStart(2, '0')}`
              const hasLog = entryMap.has(date)
              return (
                <button
                  type="button"
                  key={date}
                  className={`daily-log-day ${hasLog ? 'written' : ''} ${date === selectedDate ? 'selected' : ''} ${date === today ? 'today' : ''}`}
                  onClick={() => selectDate(date)}
                  aria-label={`${date}${hasLog ? ' 有日志' : ''}`}
                >
                  {day}
                  {hasLog && <i />}
                </button>
              )
            })}
          </div>

          <div className="daily-log-month-list">
            <p><span>本月日志</span><b>{entries.length} 篇</b></p>
            {loading ? <small>翻找日记中…</small> : monthEntries.length === 0 ? <small>这个月还没有写日志。</small> : monthEntries.slice(0, 5).map((entry) => (
              <button type="button" key={entry.id} onClick={() => selectDate(entry.log_date)}>
                <strong>{entry.log_date.slice(8)}日</strong>
                <span>{excerpt(entry.content)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="daily-log-page daily-log-writing-page">
          <div className="daily-log-date-line">
            <span>{selectedDate === today ? 'TODAY' : 'DAILY NOTE'}</span>
            <strong>{readableDate(selectedDate)}</strong>
          </div>
          <textarea
            className="daily-log-textarea"
            value={content}
            onChange={(event) => { setContent(event.target.value); setMessage('') }}
            placeholder={'今天做了什么？\n\n完成的事、突然想到的念头，或者只是今天的天气，都可以写在这里。'}
            aria-label={`${selectedDate} 的日志内容`}
          />
          <div className="daily-log-actions">
            <span>{selectedEntry ? `修改于 ${new Date(selectedEntry.updated_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '这页还是空白的'}</span>
            {selectedEntry && <button type="button" className="daily-log-delete" onClick={deleteLog}>清空本日</button>}
            <button type="button" className="daily-log-save" onClick={saveLog} disabled={saving || !content.trim()}>{saving ? '保存中…' : selectedEntry ? '保存修改' : '写进今天'}</button>
          </div>
          {message && <p className={`daily-log-message ${message.includes('失败') ? 'error' : ''}`}>{message}</p>}

          <div className="daily-log-turners">
            <button type="button" onClick={() => turnPage(-1)} aria-label="翻到昨天"><span>‹</span> 昨天</button>
            <i aria-hidden="true">✦</i>
            <button type="button" onClick={() => turnPage(1)} aria-label="翻到明天">明天 <span>›</span></button>
          </div>
        </div>
      </div>
    </section>
  )
}
