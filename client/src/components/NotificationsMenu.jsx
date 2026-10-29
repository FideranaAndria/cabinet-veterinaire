import { useEffect, useState } from 'react';
import { http } from '../api/http.js';

export default function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const { data } = await http.get('/notifications', { params: { pageSize: 10 } });
      setItems(data.data);
      setUnreadCount(data.unread_count);
      setError('');
    } catch {
      setError('Impossible de charger les notifications.');
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function markRead(id) {
    try { await http.patch(`/notifications/${id}/read`); await refresh(); }
    catch { setError('Impossible de mettre à jour cette notification.'); }
  }

  async function markAllRead() {
    try { await http.patch('/notifications/read-all'); await refresh(); }
    catch { setError('Impossible de mettre à jour les notifications.'); }
  }

  return (
    <div className="notifications-menu">
      <button className="text-button notifications-trigger" type="button" aria-expanded={open} onClick={() => { const next = !open; setOpen(next); if (next) void refresh(); }}>
        Notifications{unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && <section className="notifications-popover" aria-label="Notifications">
        <div className="notifications-heading"><strong>Notifications</strong>{unreadCount > 0 && <button className="text-button" type="button" onClick={markAllRead}>Tout lire</button>}</div>
        {error && <p className="form-error">{error}</p>}
        {items.length === 0 && !error && <p className="muted">Aucune notification.</p>}
        <ul>{items.map((item) => <li className={item.read_at ? '' : 'unread'} key={item.id}>
          <strong>{item.title}</strong><p>{item.message}</p><time>{new Date(item.created_at).toLocaleString()}</time>
          {!item.read_at && <button className="text-button" type="button" onClick={() => markRead(item.id)}>Marquer comme lue</button>}
        </li>)}</ul>
      </section>}
    </div>
  );
}
