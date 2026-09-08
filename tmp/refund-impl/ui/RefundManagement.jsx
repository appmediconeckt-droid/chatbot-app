import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import api from '../api/axios'
import './Users.css'

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function RefundManagement() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [selected, setSelected] = useState(null)
  const [action, setAction] = useState('')
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const res = await api.get('/refunds', { params: { status, page, limit: 10 } })
      setRows(res.data.data || [])
      setPages(res.data.pagination?.totalPages || 1)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Refund requests load nahi ho payi')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [status, page])

  const open = (row, nextAction) => { setSelected(row); setAction(nextAction); setInput('') }
  const close = () => { setSelected(null); setAction(''); setInput('') }
  const submit = async () => {
    try {
      setSaving(true)
      if (action === 'approve') await api.put(`/refunds/${selected._id}/approve`, { notes: input })
      if (action === 'paid') await api.put(`/refunds/${selected._id}/paid`, { transactionReference: input })
      if (action === 'reject') await api.put(`/refunds/${selected._id}/reject`, { failureReason: input })
      toast.success(action === 'reject' ? 'Rejected; amount user wallet mein return ho gaya' : action === 'paid' ? 'Refund paid mark ho gaya' : 'Refund approved')
      close(); load()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action complete nahi hua')
    } finally { setSaving(false) }
  }

  const badge = value => <span className={`badge ${value === 'paid' ? 'success' : value === 'rejected' ? 'danger' : value === 'pending' ? 'warning' : 'info'}`}>{String(value).toUpperCase()}</span>

  return <div className="dashboard-container">
    <div className="dashboard-header"><h1 className="page-title">User Refunds</h1><p className="dashboard-subtitle">Review unused wallet balance refund requests and complete bank transfers within 48 hours</p></div>
    <div className="card">
      <div className="md-toolbar"><select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">All requests</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="rejected">Rejected</option></select></div>
      <div style={{ overflowX: 'auto' }}><table><thead><tr><th>User</th><th>Amount</th><th>Bank</th><th>Status</th><th>Requested</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="6"><div className="loading">Loading refunds…</div></td></tr> : rows.length === 0 ? <tr><td colSpan="6"><div className="md-empty">No refund requests</div></td></tr> : rows.map(row => <tr key={row._id}>
          <td><strong>{row.user?.fullName || 'User'}</strong><div style={{ fontSize: 12, opacity: .7 }}>{row.user?.email}</div></td>
          <td className="mono"><strong>{money(row.amount)}</strong></td>
          <td>{row.bankDetails?.bankName}<div style={{ fontSize: 12, opacity: .7 }}>•••• {row.bankDetails?.last4}</div></td>
          <td>{badge(row.status)}</td><td>{new Date(row.createdAt).toLocaleString()}</td>
          <td><div className="payout-actions">{row.status === 'pending' && <><button className="payout-action payout-action-approve" onClick={() => open(row, 'approve')}>Approve</button><button className="payout-action payout-action-reject" onClick={() => open(row, 'reject')}>Reject</button></>}{row.status === 'approved' && <button className="payout-action payout-action-process" onClick={() => open(row, 'paid')}>Confirm transfer</button>}<button className="payout-action payout-action-details" onClick={() => open(row, 'details')}>Details</button></div></td>
        </tr>)}
      </tbody></table></div>
      <div className="md-pagination"><button className="text" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="text" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
    </div>
    {selected && <div className="md-scrim" onClick={close}><div className="md-dialog-card" onClick={e => e.stopPropagation()}>
      <h3 className="md-dialog-title">{action === 'details' ? 'Refund details' : action === 'paid' ? 'Confirm bank transfer' : action === 'reject' ? 'Reject refund' : 'Approve refund'}</h3>
      <div className="md-detail-grid"><div><span>User</span><strong>{selected.user?.fullName}</strong></div><div><span>Amount</span><strong>{money(selected.amount)}</strong></div><div><span>Account holder</span><strong>{selected.bankDetails?.accountName}</strong></div><div><span>Bank</span><strong>{selected.bankDetails?.bankName}</strong></div><div><span>Account number</span><strong>{selected.bankDetails?.accountNumber}</strong></div><div><span>IFSC</span><strong>{selected.bankDetails?.ifsc}</strong></div></div>
      {action !== 'details' && <textarea rows="3" style={{ marginTop: 16 }} value={input} onChange={e => setInput(e.target.value)} placeholder={action === 'paid' ? 'Bank UTR / transaction reference (required)' : action === 'reject' ? 'Rejection reason (required)' : 'Admin notes (optional)'} />}
      <div className="md-dialog-actions"><button className="text" onClick={close}>Close</button>{action !== 'details' && <button className={action === 'reject' ? 'danger' : 'success'} disabled={saving || ((action === 'paid' || action === 'reject') && !input.trim())} onClick={submit}>{saving ? 'Saving…' : 'Confirm'}</button>}</div>
    </div></div>}
    <style>{`.md-scrim{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:200}.md-dialog-card{width:92%;max-width:560px;background:var(--md-surface);border-radius:24px;padding:24px}.md-dialog-title{margin:0 0 12px}.md-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.md-detail-grid div{display:flex;flex-direction:column;gap:4px}.md-detail-grid span{font-size:11px;color:var(--md-on-surface-variant);text-transform:uppercase}.md-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}`}</style>
  </div>
}
