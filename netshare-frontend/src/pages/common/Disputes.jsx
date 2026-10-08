import { useCallback, useEffect, useState } from 'react';
import axios from '../../api/axiosInstance';
import { useAuth } from '../../context/authState';
import ClientLayout from '../../layouts/ClientLayout';
import NodeLayout from '../../layouts/NodeLayout';
import AdminLayout from '../../layouts/AdminLayout';
import './Operations.css';

export default function Disputes() {
  const { user } = useAuth();
  const Layout = user?.role === 'admin' ? AdminLayout : user?.role === 'node_participant' ? NodeLayout : ClientLayout;
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [type, setType] = useState('task');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { const res = await axios.get('/disputes', { params: { offset } }); setItems(res.data.disputes); setTotal(res.data.total); }
    catch { setError('Could not load disputes.'); }
  }, [offset]);
  useEffect(() => { const timer = setTimeout(refresh, 0); return () => clearTimeout(timer); }, [refresh]);
  const submit = async e => {
    e.preventDefault(); setBusy(true);
    try { await axios.post('/disputes', { relatedType: type, relatedId: reference.trim(), description });
      setReference(''); setDescription(''); setError(''); await refresh(); }
    catch (err) { setError(err.response?.data?.error?.message || 'Could not submit dispute.'); }
    finally { setBusy(false); }
  };
  return <Layout><div className="operations-page"><h2>Disputes</h2>
    <p>Use the ID from your task, order, or payment history. One case per owned reference.</p>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={submit}>
      <label>Reference type <select value={type} onChange={e => setType(e.target.value)}>
        {['task', 'order', 'topup', 'withdrawal'].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Reference ID <input required pattern="[a-fA-F0-9]{24}" value={reference} onChange={e => setReference(e.target.value)} /></label>
      <label>Description <textarea required minLength={10} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <button disabled={busy}>Submit dispute</button>
    </form>
    {!items.length && <p>No disputes yet.</p>}
    {items.map(item => <article key={item._id}><h3>{item.relatedType} — {item.status}</h3>
      <small>Case: {item._id} | Reference: {item.relatedId}</small><p>{item.description}</p>
      <p>Admin note: {item.adminNote || 'Awaiting review'}</p>
      {item.history.map((entry, index) => <p key={index}>{entry.status}: {entry.note}</p>)}
    </article>)}
    <button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
    <button disabled={offset + 50 >= total} onClick={() => setOffset(offset + 50)}>Next</button>
  </div></Layout>;
}
