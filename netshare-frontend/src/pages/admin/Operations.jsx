import { useCallback, useEffect, useState } from 'react';
import axios from '../../api/axiosInstance';
import AdminLayout from '../../layouts/AdminLayout';
import '../common/Operations.css';

export default function Operations() {
  const [tab, setTab] = useState('alerts');
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [notes, setNotes] = useState({});
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (tab === 'reports') return;
    try {
      const response = await axios.get(`/admin/${tab}`, { params: { status, offset } });
      setItems(response.data[tab]); setTotal(response.data.total); setError('');
    } catch (err) { setError(err.response?.data?.error?.message || 'Could not load records.'); }
  }, [tab, status, offset]);
  useEffect(() => { const timer = setTimeout(refresh, 0); return () => clearTimeout(timer); }, [refresh]);
  const review = async (id, nextStatus) => {
    setBusy(true);
    try { await axios.put(`/admin/${tab}/${id}/review`, { status: nextStatus, adminNote: notes[id] || '' }); await refresh(); }
    catch (err) { setError(err.response?.data?.error?.message || 'Review failed.'); }
    finally { setBusy(false); }
  };
  const loadReport = async (exportCsv = false) => {
    setBusy(true);
    try {
      const response = await axios.get(`/admin/reports${exportCsv ? '/export' : ''}`, {
        params: { ...(from && { from }), ...(to && { to }) }, ...(exportCsv && { responseType: 'blob' }),
      });
      if (exportCsv) {
        const url = URL.createObjectURL(response.data); const link = document.createElement('a');
        link.href = url; link.download = 'netshare-admin-report.csv'; link.click(); URL.revokeObjectURL(url);
      } else setReport(response.data.report);
      setError('');
    } catch (err) { setError(err.response?.data?.error?.message || 'Report failed. Check dates (maximum 366 days).'); }
    finally { setBusy(false); }
  };
  return <AdminLayout><div className="operations-page">
    <h2>Alerts, reports and disputes</h2>
    <nav aria-label="Operations"><button onClick={() => { setTab('alerts'); setOffset(0); setItems([]); }}>Alerts</button>
      <button onClick={() => { setTab('disputes'); setOffset(0); setItems([]); }}>Disputes</button>
      <button onClick={() => setTab('reports')}>Reports / CSV</button></nav>
    {error && <p role="alert">{error}</p>}
    {tab !== 'reports' ? <>
      <p>{tab === 'alerts' ? 'Rule-based flags for review, not ML predictions or proof of wrongdoing.' : 'Review owned task, order and payment disputes. Resolution does not automatically move funds.'}</p>
      <label>Status <select value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}>
        {['open', 'under_review', 'resolved', 'dismissed', ''].map(value => <option key={value} value={value}>{value || 'all'}</option>)}
      </select></label><button disabled={busy} onClick={refresh}>Refresh</button>
      {!items.length && <p>No records.</p>}
      {items.map(item => <article key={item._id}>
        <h3>{item.alertType || `${item.relatedType} dispute`} — {item.status} {item.severity}</h3>
        <small>ID: {item._id} | User: {item.userId || item.relatedUserId} | Reference: {item.relatedId || item.relatedDeviceId}</small>
        <p>{item.description}</p>
        {item.evidence && <pre>{JSON.stringify(item.evidence, null, 2)}</pre>}
        <p>Admin note: {item.adminNote || 'None'}</p>
        {item.history?.map((entry, index) => <p key={index}>{entry.status}: {entry.note} ({new Date(entry.at).toLocaleString()})</p>)}
        {['open', 'under_review'].includes(item.status) && <>
          <label>Review note <textarea maxLength={1000} value={notes[item._id] || ''} onChange={event => setNotes({ ...notes, [item._id]: event.target.value })} /></label>
          {item.status === 'open' ? <button disabled={busy} onClick={() => review(item._id, 'under_review')}>Start review</button> : <>
            <button disabled={busy} onClick={() => review(item._id, 'resolved')}>Resolve</button>
            <button disabled={busy} onClick={() => review(item._id, 'dismissed')}>Dismiss</button></>}
        </>}
      </article>)}
      <button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
      <button disabled={offset + 50 >= total} onClick={() => setOffset(offset + 50)}>Next</button>
    </> : <>
      <p>UTC dates, inclusive. Defaults to the last 30 days. Wallet balances are current snapshots.</p>
      <label>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>To <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <button disabled={busy} onClick={() => loadReport()}>View summary</button>
      <button disabled={busy} onClick={() => loadReport(true)}>Download CSV</button>
      {report && <><p>{report.basis}</p><p>{report.from} to {report.to} | New users: {report.newUsers}</p>
        {Object.entries({ Tasks: report.tasks, Bandwidth: report.bandwidth, Payments: report.payments,
          Orders: report.orders, Ledger: report.ledger, 'Current wallets': report.walletSnapshot }).map(([name, value]) =>
          <article key={name}><h3>{name}</h3><pre>{JSON.stringify(value, null, 2)}</pre></article>)}
      </>}
    </>}
  </div></AdminLayout>;
}
