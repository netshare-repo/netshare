import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import axios from '../../api/axiosInstance';
import './NotificationBell.css';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unreadCount: 0, total: 0 });
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { const response = await axios.get('/notifications', { params: { offset } }); setData(response.data); setError(''); }
    catch { setError('Could not load notifications.'); }
  }, [offset]);
  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const interval = setInterval(refresh, 30000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [refresh]);
  const mark = async id => {
    setBusy(true);
    try { await axios.put(id ? `/notifications/${id}/read` : '/notifications/read-all'); await refresh(); }
    catch { setError('Could not mark notifications read.'); }
    finally { setBusy(false); }
  };
  return <div className="notification-control">
    <button aria-label={`Notifications, ${data.unreadCount} unread`} aria-expanded={open} onClick={() => { setOpen(!open); void refresh(); }}>
      <Bell size={19} /> {data.unreadCount > 0 && <span>{data.unreadCount}</span>}
    </button>
    {open && <section className="notification-panel" aria-label="Notifications">
      <h4>Notifications ({data.unreadCount} unread)</h4>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy || !data.unreadCount} onClick={() => mark()}>Mark all read</button>
      {!data.notifications.length && <p>No notifications.</p>}
      {data.notifications.map(item => <article key={item._id} className={item.status}>
        <p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small>
        {item.status === 'unread' && <button disabled={busy} onClick={() => mark(item._id)}>Mark read</button>}
      </article>)}
      <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
      <button disabled={offset + 50 >= data.total} onClick={() => setOffset(offset + 50)}>Next</button>
    </section>}
  </div>;
}
