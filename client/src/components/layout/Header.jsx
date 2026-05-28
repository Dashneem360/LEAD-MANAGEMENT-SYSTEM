import React, { useState, useEffect, useRef } from 'react';
import { MdClose, MdLock, MdNotifications, MdRefresh } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { format } from 'date-fns';

export default function Header({ onMenuClick }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const dropRef = useRef();

  useEffect(() => {
    fetchNotifications();
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/dashboard/notifications');
      setNotifications(res.data.notifications || []);
      setUnread(res.data.unreadCount || 0);
    } catch { }
  };

  const markRead = async () => {
    await api.put('/dashboard/notifications/read');
    setUnread(0);
    setNotifications(n => n.map(x => ({ ...x, isRead: true })));
  };

  const notifTypeIcon = (type) => {
    const icons = { missed_followup: '⚠️', upcoming_followup: '📅', lead_assigned: '👤', webinar_reminder: '🎬' };
    return icons[type] || '🔔';
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await api.put('/auth/update-password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setShowPassword(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-datetime">
          <span className="header-date">{format(now, 'EEEE, dd MMM yyyy')}</span>
          <span className="header-time">{format(now, 'hh:mm a')}</span>
        </div>
      </div>

      <div className="header-right">
        <button className="icon-btn" onClick={fetchNotifications} title="Refresh"><MdRefresh /></button>

        <div className="notif-wrapper" ref={dropRef}>
          <button className="icon-btn notif-btn" onClick={() => { setShowNotif(!showNotif); if (!showNotif) markRead(); }}>
            <MdNotifications />
            {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>

          {showNotif && (
            <div className="notif-dropdown">
              <div className="notif-header">
                <h4>Notifications</h4>
                <span className="notif-count">{notifications.length} total</span>
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications</div>
                ) : notifications.map(n => (
                  <div key={n._id} className={`notif-item ${!n.isRead ? 'unread' : ''} ${n.type === 'missed_followup' ? 'alert' : ''}`}>
                    <span className="notif-emoji">{notifTypeIcon(n.type)}</span>
                    <div className="notif-body">
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-msg">{n.message}</div>
                      <div className="notif-time">{format(new Date(n.createdAt), 'dd MMM, hh:mm a')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className="header-user profile-action" onClick={() => setShowPassword(true)} title="Change Password">
          <div className="user-avatar-sm">
            {user?.avatar ? <img src={user.avatar} alt={user.name} /> : <span>{user?.name?.charAt(0).toUpperCase()}</span>}
          </div>
          <span className="header-username">{user?.name}</span>
        </button>
        <button className="icon-btn" onClick={() => setShowPassword(true)} title="Change Password"><MdLock /></button>
      </div>
      {showPassword && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowPassword(false)}>
          <div className="modal small">
            <div className="modal-header">
              <h2>Change Password</h2>
              <button className="modal-close" onClick={() => setShowPassword(false)}><MdClose /></button>
            </div>
            <form onSubmit={changePassword}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Current Password</label>
                    <input type="password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
                  </div>
                  <div className="form-group full-width">
                    <label>New Password</label>
                    <input type="password" required minLength={6} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowPassword(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={savingPassword}>{savingPassword ? <span className="btn-spinner"></span> : 'Update Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
