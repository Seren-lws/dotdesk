import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLocalDateString } from '../lib/date'
import { supabase } from '../lib/supabase'

type Currency = 'CNY' | 'JPY' | 'USD'

interface BillingEntry {
  id: string
  name: string
  kind: 'subscription' | 'api_topup'
  amount: number
  currency: Currency
  paid_date: string
  billing_cycle: 'monthly' | 'yearly' | 'once'
  next_due_date: string | null
  status: 'active' | 'paused' | 'cancelled'
  notes: string | null
  created_at: string
}

interface ExchangeRates {
  date: string
  jpy: Record<Currency, number>
}

const FALLBACK_RATES: ExchangeRates = {
  date: '参考值',
  jpy: { JPY: 1, CNY: 23.45, USD: 158.23 },
}

const emptyForm = {
  name: '',
  kind: 'subscription' as BillingEntry['kind'],
  amount: '',
  currency: 'CNY' as Currency,
  paidDate: getLocalDateString(),
  billingCycle: 'monthly' as BillingEntry['billing_cycle'],
  nextDueDate: '',
  status: 'active' as BillingEntry['status'],
  notes: '',
}

export default function BillingTracker() {
  const [entries, setEntries] = useState<BillingEntry[]>([])
  const [form, setForm] = useState(emptyForm)
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('dd_subscriptions')
      .select('*')
      .order('paid_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) setMessage('账单加载失败，请刷新后再试。')
    else setEntries((data || []).map((entry) => ({ ...entry, currency: entry.currency || 'CNY' })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  useEffect(() => {
    const cacheKey = 'dotdesk-jpy-rates'
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try { setRates(JSON.parse(cached) as ExchangeRates) } catch { localStorage.removeItem(cacheKey) }
    }

    fetch('https://api.frankfurter.dev/v2/rates?base=JPY&quotes=CNY,USD')
      .then((response) => {
        if (!response.ok) throw new Error('rate request failed')
        return response.json()
      })
      .then((data: Array<{ date: string; quote: Currency; rate: number }>) => {
        const cny = data.find((item) => item.quote === 'CNY')
        const usd = data.find((item) => item.quote === 'USD')
        if (!cny?.rate || !usd?.rate) return
        const nextRates: ExchangeRates = {
          date: cny.date,
          jpy: { JPY: 1, CNY: 1 / cny.rate, USD: 1 / usd.rate },
        }
        setRates(nextRates)
        localStorage.setItem(cacheKey, JSON.stringify(nextRates))
      })
      .catch(() => undefined)
  }, [])

  const totals = useMemo(() => {
    const month = getLocalDateString().slice(0, 7)
    const toJpy = (entry: BillingEntry) => Number(entry.amount) * rates.jpy[entry.currency || 'CNY']
    const monthSpent = entries
      .filter((entry) => entry.paid_date.startsWith(month))
      .reduce((sum, entry) => sum + toJpy(entry), 0)
    const recurring = entries
      .filter((entry) => entry.kind === 'subscription' && entry.status === 'active')
      .reduce((sum, entry) => {
        const amount = toJpy(entry)
        if (entry.billing_cycle === 'monthly') return sum + amount
        if (entry.billing_cycle === 'yearly') return sum + amount / 12
        return sum
      }, 0)
    const today = getLocalDateString()
    const nextDue = entries
      .filter((entry) => entry.kind === 'subscription' && entry.status === 'active' && entry.next_due_date && entry.next_due_date >= today)
      .sort((a, b) => (a.next_due_date || '').localeCompare(b.next_due_date || ''))[0]
    return { monthSpent, recurring, nextDue }
  }, [entries, rates])

  const monthlyOverview = useMemo(() => {
    const today = new Date(`${getLocalDateString()}T12:00:00`)
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return { key, label: `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}` }
    })
    const spentByMonth = entries.reduce<Record<string, number>>((totalsByMonth, entry) => {
      const month = entry.paid_date.slice(0, 7)
      totalsByMonth[month] = (totalsByMonth[month] || 0) + Number(entry.amount) * rates.jpy[entry.currency || 'CNY']
      return totalsByMonth
    }, {})
    const overview = months.map((month) => ({ ...month, amount: spentByMonth[month.key] || 0 }))
    const highest = Math.max(...overview.map((month) => month.amount), 1)
    return overview.map((month) => ({ ...month, height: month.amount ? Math.max(12, (month.amount / highest) * 100) : 4 }))
  }, [entries, rates])

  const resetForm = () => {
    setForm({ ...emptyForm, paidDate: getLocalDateString() })
    setEditingId(null)
    setShowForm(false)
    setMessage('')
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount || !form.paidDate) return
    setSaving(true)
    setMessage('')
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      amount: Number(form.amount),
      currency: form.currency,
      paid_date: form.paidDate,
      billing_cycle: form.kind === 'api_topup' ? 'once' : form.billingCycle,
      next_due_date: form.kind === 'subscription' && form.nextDueDate ? form.nextDueDate : null,
      status: form.kind === 'subscription' ? form.status : 'active',
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = editingId
      ? await supabase.from('dd_subscriptions').update(payload).eq('id', editingId)
      : await supabase.from('dd_subscriptions').insert(payload)

    if (error) {
      setMessage('保存失败，请稍后再试。刚才填写的内容还在。')
      setSaving(false)
      return
    }
    resetForm()
    setSaving(false)
    fetchEntries()
  }

  const handleEdit = (entry: BillingEntry) => {
    setForm({
      name: entry.name,
      kind: entry.kind,
      amount: String(entry.amount),
      currency: entry.currency || 'CNY',
      paidDate: entry.paid_date,
      billingCycle: entry.billing_cycle,
      nextDueDate: entry.next_due_date || '',
      status: entry.status,
      notes: entry.notes || '',
    })
    setEditingId(entry.id)
    setShowForm(true)
    setMessage('')
  }

  const handleDelete = async (entry: BillingEntry) => {
    if (!window.confirm(`确定删除“${entry.name}”这条账单吗？`)) return
    const { error } = await supabase.from('dd_subscriptions').delete().eq('id', entry.id)
    if (error) setMessage('删除失败，请稍后再试。')
    else fetchEntries()
  }

  return (
    <section id="billing" className="section module-panel billing-section">
      <img
        className="billing-mascot"
        src="/billing-nap.gif"
        alt="趴在软垫上的小动物"
      />
      <h2 className="section-title billing-title">
        <span className="section-icon billing-icon">¥</span>
        订阅账单
        <span className="module-kicker">PIXEL LEDGER</span>
        <button className="add-btn" onClick={() => showForm ? resetForm() : setShowForm(true)} aria-label="新增账单">
          {showForm ? '×' : '+'}
        </button>
      </h2>

      <div className="billing-receipt-meta" aria-hidden="true">
        <span>DOTDESK RECEIPT</span>
        <span>NO. 0007</span>
        <span>PRIVATE LEDGER</span>
      </div>

      <div className="billing-summary">
        <div className="billing-summary-card billing-total-card">
          <span className="health-label">本月已支出 · 约</span>
          <strong>{formatJpy(totals.monthSpent)}</strong>
          <span className="summary-caption">不同币种已合并</span>
        </div>
        <div className="billing-summary-card">
          <span className="health-label">每月固定预计 · 约</span>
          <strong>{formatJpy(totals.recurring)}</strong>
          <span className="summary-caption">年付已折算月均</span>
        </div>
        <div className="billing-summary-card billing-next-card">
          <span className="health-label">下一笔扣费</span>
          <strong>{totals.nextDue?.next_due_date?.slice(5) || '--'}</strong>
          <span className="summary-caption">{totals.nextDue?.name || '暂时没有待扣费'}</span>
        </div>
      </div>

      <p className="exchange-note">
        汇率参考 {rates.date === '参考值' ? '最近值' : rates.date.slice(5)} · 1 CNY ≈ ¥{rates.jpy.CNY.toFixed(2)} · 1 USD ≈ ¥{rates.jpy.USD.toFixed(2)}
      </p>

      <details className="billing-monthly-overview">
        <summary className="billing-monthly-heading">
          <div><span>MONTHLY TOTALS</span><strong>近 6 个月支出</strong></div>
          <small><i>按付款 / 充值日期统计 · 已换算日元</i><b aria-hidden="true" /></small>
        </summary>
        <div className="billing-monthly-chart">
          {monthlyOverview.map((month, index) => (
            <div key={month.key} className={`billing-month-column ${index === monthlyOverview.length - 1 ? 'current' : ''}`} title={`${month.key} 支出 ${formatJpy(month.amount)}`}>
              <span>{formatJpy(month.amount)}</span>
              <div className="billing-month-bar"><i style={{ height: `${month.height}%` }} /></div>
              <b>{month.label}</b>
            </div>
          ))}
        </div>
      </details>

      {showForm && (
        <div className="idea-form billing-form">
          <div className="billing-type-row">
            <button type="button" className={`filter-btn ${form.kind === 'subscription' ? 'active' : ''}`} onClick={() => setForm({ ...form, kind: 'subscription', billingCycle: form.billingCycle === 'once' ? 'monthly' : form.billingCycle })}>固定订阅</button>
            <button type="button" className={`filter-btn ${form.kind === 'api_topup' ? 'active' : ''}`} onClick={() => setForm({ ...form, kind: 'api_topup', billingCycle: 'once', nextDueDate: '' })}>API 充值</button>
          </div>
          <div className="billing-form-grid">
            <label className="sleep-label">名称<input className="idea-input" placeholder="例如 ChatGPT / API 中转站" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="sleep-label">金额<input className="idea-input" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label className="sleep-label">扣款币种<select className="idea-input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}><option value="CNY">人民币 CNY</option><option value="JPY">日元 JPY</option><option value="USD">美元 USD</option></select></label>
            <label className="sleep-label">{form.kind === 'subscription' ? '付款日期' : '充值日期'}<input className="idea-input" type="date" value={form.paidDate} onChange={(e) => setForm({ ...form, paidDate: e.target.value })} /></label>
            {form.kind === 'subscription' && (
              <>
                <label className="sleep-label">订阅周期<select className="idea-input" value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value as BillingEntry['billing_cycle'] })}><option value="monthly">月付</option><option value="yearly">年付</option><option value="once">一次性</option></select></label>
                <label className="sleep-label">下次扣费 / 到期日（可选）<input className="idea-input" type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} /></label>
                <label className="sleep-label">状态<select className="idea-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BillingEntry['status'] })}><option value="active">使用中</option><option value="paused">已暂停</option><option value="cancelled">已取消</option></select></label>
              </>
            )}
          </div>
          <input className="idea-input" placeholder="备注（可选）" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button className="idea-submit billing-submit" onClick={handleSave} disabled={saving || !form.name.trim() || !form.amount || !form.paidDate}>{saving ? '保存中...' : editingId ? '保存修改' : '记一笔'}</button>
          {message && <p className="form-error">{message}</p>}
        </div>
      )}

      {message && !showForm && <p className="form-error">{message}</p>}
      {loading ? <p className="card-desc">加载中...</p> : entries.length === 0 ? <p className="card-desc">还没有账单，点右上角 + 记下第一笔。</p> : (
        <div className="billing-list">
          {entries.map((entry) => {
            const converted = Number(entry.amount) * rates.jpy[entry.currency || 'CNY']
            return (
              <div key={entry.id} className={`billing-item ${entry.kind === 'api_topup' ? 'api' : 'subscription'}`}>
                <span className="receipt-stub" aria-hidden="true">{entry.kind === 'subscription' ? '◫' : '⚡'}</span>
                <div className="billing-item-main">
                  <div className="billing-item-title-row"><span className={`idea-tag ${entry.kind === 'subscription' ? 'butter' : 'sky'}`}>{entry.kind === 'subscription' ? '订阅' : 'API 充值'}</span><p className="card-title">{entry.name}</p></div>
                  <p className="card-desc">{entry.paid_date} · {entry.kind === 'api_topup' ? '一次性充值' : cycleLabel(entry.billing_cycle)}{entry.next_due_date ? ` · 下次 ${entry.next_due_date}` : ''}</p>
                  {entry.notes && <p className="cal-detail-note">{entry.notes}</p>}
                </div>
                <div className="billing-item-side">
                  <strong>{formatOriginal(Number(entry.amount), entry.currency || 'CNY')}</strong>
                  {entry.currency !== 'JPY' && <span className="converted-amount">≈ {formatJpy(converted)}</span>}
                  {entry.kind === 'subscription' && <span className={`billing-status ${entry.status}`}>{statusLabel(entry.status)}</span>}
                  <RecordMenu onEdit={() => handleEdit(entry)} onDelete={() => handleDelete(entry)} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="billing-receipt-footer" aria-hidden="true">
        <span>·· THANK YOU ··</span>
        <b>已记录</b>
        <span>DOTDESK / PERSONAL COPY</span>
      </div>
    </section>
  )
}

function RecordMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <details className="record-menu"><summary aria-label="管理记录">···</summary><div className="record-menu-actions"><button type="button" onClick={onEdit}>编辑</button><button type="button" onClick={onDelete}>删除</button></div></details>
}

function formatOriginal(amount: number, currency: Currency) {
  if (currency === 'JPY') return `¥${Math.round(amount).toLocaleString()}`
  if (currency === 'USD') return `$${amount.toFixed(2)}`
  return `CN¥${amount.toFixed(2)}`
}

function formatJpy(amount: number) { return `¥${Math.round(amount).toLocaleString()}` }
function cycleLabel(cycle: BillingEntry['billing_cycle']) { return { monthly: '月付', yearly: '年付', once: '一次性' }[cycle] }
function statusLabel(status: BillingEntry['status']) { return { active: '使用中', paused: '已暂停', cancelled: '已取消' }[status] }
