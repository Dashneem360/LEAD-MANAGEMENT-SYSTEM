import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { MdClose, MdCheck, MdSchedule, MdWarning, MdPhone, MdWhatsapp, MdEmail } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';

const OUTCOME_OPTIONS = ['interested', 'not_interested', 'nurturing', 'converted', 'no_answer', 'callback', 'other'];
const TYPE_ICONS = { call: '📞', whatsapp: '💬', email: '✉️', meeting: '🤝', demo: '🎥' };

function CompleteModal({ followup, onClose, onSave }) {
  const [form, setForm] = useState({ outcome: 'interested', remark: '', duration: '', nextFollowupDate: '', nextFollowupTime: '10:00', nextFollowupType: 'call' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { outcome: form.outcome, remark: form.remark, duration: parseInt(form.duration) || 0 };
      if (form.nextFollowupDate) {
        payload.nextFollowupDate = new Date(`${form.nextFollowupDate}T${form.nextFollowupTime}:00`).toISOString();
        payload.nextFollowupType = form.nextFollowupType;
      }
      await api.put(`/followups/${followup._id}/complete`, payload);
      toast.success('Followup completed!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal small">
        <div className="modal-header">
          <h2>Complete Followup — {followup.lead?.name}</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Outcome *</label>
                <div className="outcome-btns">
                  {OUTCOME_OPTIONS.map(o => (
                    <button type="button" key={o}
                      className={`outcome-btn ${form.outcome === o ? 'active ' + o : ''}`}
                      onClick={() => setForm({ ...form, outcome: o })}>
                      {o.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group full-width">
                <label>Remark</label>
                <textarea rows={3} value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} placeholder="What happened in this call?" />
              </div>
              <div className="form-group">
                <label>Call Duration (seconds)</label>
                <input type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 120" />
              </div>
              <div className="section-divider"><span>Schedule Next Followup (optional)</span></div>
              <div className="form-group">
                <label>Next Followup Date</label>
                <input type="date" value={form.nextFollowupDate} onChange={e => setForm({ ...form, nextFollowupDate: e.target.value })} min={format(new Date(), 'yyyy-MM-dd')} />
              </div>
              <div className="form-group">
                <label>Time</label>
                <input type="time" value={form.nextFollowupTime} onChange={e => setForm({ ...form, nextFollowupTime: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={form.nextFollowupType} onChange={e => setForm({ ...form, nextFollowupType: e.target.value })}>
                  <option value="call">Call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="demo">Demo</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner"></span> : 'Mark Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RescheduleModal({ followup, onClose, onSave }) {
  const [form, setForm] = useState({ rescheduledTo: '', rescheduledReason: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/followups/${followup._id}/reschedule`, {
        rescheduledTo: new Date(form.rescheduledTo).toISOString(),
        rescheduledReason: form.rescheduledReason
      });
      toast.success('Rescheduled successfully');
      onSave();
    } catch { toast.error('Failed to reschedule'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal small">
        <div className="modal-header">
          <h2>Reschedule Followup</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>New Date & Time *</label>
              <input type="datetime-local" required value={form.rescheduledTo}
                onChange={e => setForm({ ...form, rescheduledTo: e.target.value })}
                min={new Date().toISOString().slice(0, 16)} />
            </div>
            <div className="form-group">
              <label>Reason</label>
              <textarea rows={2} value={form.rescheduledReason} onChange={e => setForm({ ...form, rescheduledReason: e.target.value })} placeholder="Why is it being rescheduled?" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner"></span> : 'Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Followups() {
  const { user } = useAuth();
  const [followups, setFollowups] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ assignedTo: '', status: '' });
  const [completeModal, setCompleteModal] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);

  useEffect(() => {
    api.get('/users?role=member').then(r => setUsers(r.data.users || []));
  }, []);

  const loadFollowups = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, sRes] = await Promise.all([
        api.get(`/followups/${activeTab === 'today' ? 'today' : activeTab === 'missed' ? 'missed' : ''}${activeTab === 'all' ? `?status=${filters.status}&assignedTo=${filters.assignedTo}` : ''}`),
        api.get('/followups/stats')
      ]);
      setFollowups(activeTab === 'today' ? fRes.data.followups : activeTab === 'missed' ? fRes.data.followups : fRes.data.followups);
      setStats(sRes.data);
    } catch { toast.error('Failed to load followups'); }
    finally { setLoading(false); }
  }, [activeTab, filters]);

  useEffect(() => { loadFollowups(); }, [loadFollowups]);

  const missedCount = stats.totalMissed || 0;
  const summaryStats = activeTab === 'all' ? (stats.all || {}) : activeTab === 'missed' ? { total: missedCount, missed: missedCount } : (stats.today || {});
  const summaryScope = activeTab === 'all' ? 'All' : activeTab === 'missed' ? 'Missed' : 'Today';

  return (
    <div className="page followups-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Followups</h1>
          <p className="page-subtitle">Track and manage all sales followups</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="followup-stats-bar">
        <div className="fstat-card blue">
          <div className="fstat-value">{summaryStats.total || 0}</div>
          <div className="fstat-label">{summaryScope} Total</div>
        </div>
        <div className="fstat-card green">
          <div className="fstat-value">{summaryStats.completed || 0}</div>
          <div className="fstat-label">Completed</div>
        </div>
        <div className="fstat-card orange">
          <div className="fstat-value">{summaryStats.pending || 0}</div>
          <div className="fstat-label">Pending</div>
        </div>
        <div className="fstat-card red">
          <div className="fstat-value">{summaryStats.missed || 0}</div>
          <div className="fstat-label">Missed</div>
        </div>
        <div className="fstat-card teal">
          <div className="fstat-value">{stats.week?.total || stats.weekTotal || 0}</div>
          <div className="fstat-label">This Week</div>
        </div>
        <div className="fstat-card purple">
          <div className="fstat-value">{stats.month?.total || stats.monthTotal || 0}</div>
          <div className="fstat-label">This Month</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="page-tabs">
        {[
          { id: 'today', label: "Today's" },
          { id: 'missed', label: `Missed ${missedCount > 0 ? `(${missedCount})` : ''}` },
          { id: 'all', label: 'All Followups' }
        ].map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''} ${t.id === 'missed' && missedCount > 0 ? 'alert-tab' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            {t.id === 'missed' && missedCount > 0 && <MdWarning />} {t.label}
          </button>
        ))}
      </div>

      {/* Filters (All tab) */}
      {activeTab === 'all' && (
        <div className="filters-bar">
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="rescheduled">Rescheduled</option>
          </select>
          {user?.role !== 'member' && (
            <select value={filters.assignedTo} onChange={e => setFilters({ ...filters, assignedTo: e.target.value })}>
              <option value="">All Candidates</option>
              {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Followup Cards */}
      <div className="card">
        {loading ? (
          <div className="table-loader"><div className="loading-spinner"></div></div>
        ) : followups.length === 0 ? (
          <div className="empty-state">
            {activeTab === 'today' ? 'No followups scheduled for today' : activeTab === 'missed' ? 'No missed followups' : 'No followups found'}
          </div>
        ) : (
          <div className="followup-cards-list">
            {followups.map(f => (
              <div key={f._id} className={`followup-card ${f.status}`}>
                <div className="fc-left">
                  <div className="fc-type">{TYPE_ICONS[f.type] || '📞'}</div>
                  <div className="fc-info">
                    <div className="fc-name">{f.lead?.name}</div>
                    <div className="fc-phone">
                      <a href={`tel:${f.lead?.phone}`}>{f.lead?.phone}</a>
                    </div>
                    {f.remark && <div className="fc-remark">"{f.remark}"</div>}
                  </div>
                </div>
                <div className="fc-mid">
                  <span className={`status-badge ${f.status}`}>{f.status}</span>
                  <span className="fc-time">{format(new Date(f.scheduledDate), 'dd MMM, hh:mm a')}</span>
                  {f.assignedTo && (
                    <span className="fc-assignee">
                      <div className="mini-avatar">{f.assignedTo.name?.charAt(0)}</div>
                      {f.assignedTo.name}
                    </span>
                  )}
                </div>
                <div className="fc-actions">
                  {f.status === 'pending' && (
                    <>
                      <button className="btn-sm green" onClick={() => setCompleteModal(f)}><MdCheck /> Done</button>
                      <button className="btn-sm orange" onClick={() => setRescheduleModal(f)}><MdSchedule /> Reschedule</button>
                    </>
                  )}
                  {f.status === 'missed' && (
                    <button className="btn-sm red" onClick={() => setCompleteModal(f)}><MdWarning /> Complete Now</button>
                  )}
                  {f.outcome && (
                    <span className={`outcome-badge ${f.outcome}`}>{f.outcome.replace('_', ' ')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {completeModal && <CompleteModal followup={completeModal} onClose={() => setCompleteModal(null)} onSave={() => { setCompleteModal(null); loadFollowups(); }} />}
      {rescheduleModal && <RescheduleModal followup={rescheduleModal} onClose={() => setRescheduleModal(null)} onSave={() => { setRescheduleModal(null); loadFollowups(); }} />}
    </div>
  );
}
