import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import axios from "../../api/axiosInstance";
import "./NotificationBell.css";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unreadCount: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controlRef = useRef(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      const response = await axios.get("/notifications", {
        params: { status: "unread" },
      });
      if (currentRequest !== requestId.current) return;
      setData({
        notifications: (response.data.notifications || []).slice(0, 5),
        unreadCount: response.data.unreadCount || 0,
      });
      setError("");
    } catch {
      if (currentRequest === requestId.current) {
        setError("Could not load notifications.");
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const interval = setInterval(refresh, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      requestId.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!controlRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const mark = async (id) => {
    if (busy) return;
    setBusy(true);
    requestId.current += 1;
    try {
      await axios.put(id ? `/notifications/${id}/read` : "/notifications/read-all");
      setData((previous) => ({
        notifications: id
          ? previous.notifications.filter((item) => item._id !== id)
          : [],
        unreadCount: id ? Math.max(0, previous.unreadCount - 1) : 0,
      }));
      setError("");
      await refresh();
    } catch {
      await refresh();
      setError("Could not mark notifications read.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notification-control" ref={controlRef}>
      <button
        type="button"
        className={open ? "is-open" : ""}
        aria-label={`Notifications, ${data.unreadCount} unread`}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          setOpen((value) => !value);
          void refresh();
        }}
      >
        <Bell size={18} />
        {data.unreadCount > 0 && (
          <span className="notification-count">{data.unreadCount > 99 ? "99+" : data.unreadCount}</span>
        )}
      </button>

      {open && (
        <section className="notification-panel" id="notification-panel" aria-label="Notifications">
          <div className="notification-panel-header">
            <div>
              <span className="notification-panel-kicker">ACCOUNT ACTIVITY</span>
              <h4>Notifications <span>{data.unreadCount}</span></h4>
            </div>
            {data.unreadCount > 0 && (
              <button
                type="button"
                className="notification-read-all"
                disabled={busy}
                onClick={() => mark()}
              >
                <Check size={13} /> Mark all read
              </button>
            )}
          </div>

          {error && <p className="notification-error" role="alert">{error}</p>}
          {data.notifications.length === 0 ? (
            <div className="notification-empty">
              <span className="notification-empty-icon"><Bell size={17} /></span>
              <strong>All caught up</strong>
              <p>New notifications will appear here.</p>
            </div>
          ) : (
            <div className="notification-list">
              {data.notifications.map((item) => (
                <article key={item._id} className="notification-item">
                  <span className="notification-item-dot" aria-hidden="true" />
                  <div className="notification-item-content">
                    <p>{item.message}</p>
                    <div className="notification-item-footer">
                      <time dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleString()}
                      </time>
                      <button type="button" disabled={busy} onClick={() => mark(item._id)}>
                        Mark read
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {data.unreadCount > 5 && (
            <div className="notification-panel-footer">
              Showing the 5 most recent of {data.unreadCount} unread
            </div>
          )}
        </section>
      )}
    </div>
  );
}
