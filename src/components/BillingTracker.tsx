import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLocalDateString } from '../lib/date'
import { supabase } from '../lib/supabase'

interface BillingEntry {
  id: string
  name: string
  kind: 'subscription' | 'api_topup'
  amount: number
  paid_date: string
  billing_cycle: 'monthly' | 'yearly' | 'once'
  next_due_date: string | null
  status: 'active' | 'paused' | 'cancelled'
  notes: string | null
  created_at: string
}

const emptyForm = {
  name: '',
  kind: 'subscription' as BillingEntry['kind'],
  amount: '',
  paidDate: getLocalDateString(),
  billingCycle: 'monthly' as BillingEntry['billing_cycle'],
  nextDueDate: '',
  status: 'active' as BillingEntry['status'],
  notes: '',
}

export default function BillingTracker() {
  const [entries, setEntries] = useState<BillingEntry[]>([])
  const [form, setForm] = useState(emptyForm)
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
    else setEntries(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const totals = useMemo(() => {
    const month = getLocalDateString().slice(0, 7)
    const monthSpent = entries
      .filter((entry) => entry.paid_date.startsWith(month))
      .reduce((sum, entry) => sum + Number(entry.amount), 0)
    const recurring = entries
      .filter((entry) => entry.kind === 'subscription' && entry.status === 'active')
      .reduce((sum, entry) => {
        if (entry.billing_cycle === 'monthly') return sum + Number(entry.amount)
        if (entry.billing_cycle === 'yearly') return sum + Number(entry.amount) / 12
        return sum
      }, 0)
    return { monthSpent, recurring }
  }, [entries])

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
    <section id="billing" className="section">
      <h2 className="section-title">
        <span className="section-icon billing-icon">¥</span>
        订阅账单
        <button
          className="add-btn"
          onClick={() => showForm ? resetForm() : setShowForm(true)}
          aria-label="新增账单"
        >
          {showForm ? '×' : '+'}
        </button>
      </h2>

      <div className="billing-summary">
        <div className="billing-summary-card">
          <span className="health-label">本月已支出</span>
          <strong>¥{totals.monthSpent.toFixed(2)}</strong>
        </div>
        <div className="billing-summary-card">
          <span className="health-label">每月固定预计</span>
          <strong>¥{totals.recurring.toFixed(2)}</strong>
        </div>
      </div>

      {showForm && (
        <div className="idea-form billing-form">
          <div className="billing-type-row">
            <button
              type="button"
              className={`filter-btn ${form.kind === 'subscription' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, kind: 'subscription', billingCycle: form.billingCycle === 'once' ? 'monthly' : form.billingCycle })}
            >
              固定订阅
            </button>
            <button
              type="button"
              className={`filter-btn ${form.kind === 'api_topup' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, kind: 'api_topup', billingCycle: 'once', nextDueDate: '' })}
            >
              API 充值
            </button>
          </div>
          <div className="billing-form-grid">
            <label className="sleep-label">
              名称
              <input className="idea-input" placeholder="例如 ChatGPT / API 中转站" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="sleep-label">
              金额（人民币）
              <input className="idea-input" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </label>
            <label className="sleep-label">
              {form.kind === 'subscription' ? '付款日期' : '充值日期'}
              <input className="idea-input" type="date" value={form.paidDate} onChange={(e) => setForm({ ...form, paidDate: e.target.value })} />
            </label>
            {form.kind === 'subscription' && (
              <>
                <label className="sleep-label">
                  订阅周期
                  <select className="idea-input" value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value as BillingEntry['billing_cycle'] })}>
                    <option value="monthly">月付</option>
                    <option value="yearly">年付</option>
                    <option value="once">一次性</option>
                  </select>
                </label>
                <label className="sleep-label">
                  下次扣费 / 到期日（可选）
                  <input className="idea-input" type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
                </label>
                <label className="sleep-label">
                  状态
                  <select className="idea-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BillingEntry['status'] })}>
                    <option value="active">使用中</option>
                    <option value="paused">已暂停</option>
                    <option value="cancelled">已取消</option>
                  </select>
                </label>
              </>
            )}
          </div>
          <input className="idea-input" placeholder="备注（可选）" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button className="idea-submit billing-submit" onClick={handleSave} disabled={saving || !form.name.trim() || !form.amount || !form.paidDate}>
            {saving ? '保存中...' : editingId ? '保存修改' : '记一笔'}
          </button>
          {message && <p className="form-error">{message}</p>}
        </div>
      )}

      {message && !showForm && <p className="form-error">{message}</p>}
      {loading ? (
        <p className="card-desc">加载中...</p>
      ) : entries.length === 0 ? (
        <p className="card-desc">还没有账单，点右上角 + 记下第一笔。</p>
      ) : (
        <div className="billing-list">
          {entries.map((entry) => (
            <div key={entry.id} className="billing-item">
              <div className="billing-item-main">
                <div className="billing-item-title-row">
                  <span className={`idea-tag ${entry.kind === 'subscription' ? 'butter' : 'sky'}`}>
                    {entry.kind === 'subscription' ? '订阅' : 'API 充值'}
                  </span>
                  <p className="card-title">{entry.name}</p>
                </div>
                <p className="card-desc">
                  {entry.paid_date} · {entry.kind === 'api_topup' ? '一次性充值' : cycleLabel(entry.billing_cycle)}
                  {entry.next_due_date ? ` · 下次 ${entry.next_due_date}` : ''}
                </p>
                {entry.notes && <p className="cal-detail-note">{entry.notes}</p>}
              </div>
              <div className="billing-item-side">
                <strong>¥{Number(entry.amount).toFixed(2)}</strong>
                {entry.kind === 'subscription' && <span className={`billing-status ${entry.status}`}>{statusLabel(entry.status)}</span>}
                <div className="billing-actions">
                  <button type="button" onClick={() => handleEdit(entry)}>编辑</button>
                  <button type="button" onClick={() => handleDelete(entry)}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function cycleLabel(cycle: BillingEntry['billing_cycle']) {
  return { monthly: '月付', yearly: '年付', once: '一次性' }[cycle]
}

function statusLabel(status: BillingEntry['status']) {
  return { active: '使用中', paused: '已暂停', cancelled: '已取消' }[status]
}
