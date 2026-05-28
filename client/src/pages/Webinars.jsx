import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { MdAdd, MdClose, MdEdit, MdDelete, MdVideoCall, MdPeople, MdLink, MdWhatsapp, MdWifi, MdWifiOff } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';

const PLATFORM_ICONS = { zoom: '🎥', google_meet: '🟢', youtube: '🔴', teams: '🔵', other: '📡' };

function WASetupModal({ onClose }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const poll = async () => {
    try { const res = await api.get('/whatsapp/status'); setStatus(res.data); } catch {}
  };

  useEffect(() => {
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  const connect = async () => {
    setLoading(true);
    try { await api.post('/whatsapp/init'); toast.success('WhatsApp initializing…'); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const disconnect = async () => {
    try { await api.post('/whatsapp/disconnect'); toast.success('Disconnected'); poll(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal small">
        <div className="modal-header">
          <h2>WhatsApp Setup</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center', padding: '24px 32px' }}>
          {!status ? (
            <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
          ) : status.status === 'ready' ? (
            <>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
              <p style={{ color: '#22c55e', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>WhatsApp Connected!</p>
              <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>Messages and webinar invites will be sent via WhatsApp.</p>
              <button className="btn-ghost" onClick={disconnect}>Disconnect</button>
            </>
          ) : (status.status === 'initializing' || status.status === 'authenticated') ? (
            <>
              <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
              <p style={{ color: '#94a3b8' }}>Initializing WhatsApp… please wait</p>
            </>
          ) : status.status === 'qr_pending' && status.qr ? (
            <>
              <p style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 14 }}>Scan with WhatsApp on your phone</p>
              <img src={status.qr} alt="QR" style={{ width: 220, height: 220, borderRadius: 12, border: '2px solid #334155', display: 'block', margin: '0 auto' }} />
              <p style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>WhatsApp → Settings → Linked Devices → Link a Device</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 52, marginBottom: 12 }}>📱</div>
              <p style={{ color: '#94a3b8', marginBottom: 20, fontSize: 13 }}>Connect your WhatsApp to send webinar invites and team messages directly from the app.</p>
              {!status.available ? (
                <p style={{ color: '#ef4444', fontSize: 12 }}>whatsapp-web.js is installing. Restart the server and try again.</p>
              ) : (
                <button className="btn-primary" onClick={connect} disabled={loading}>
                  {loading ? <span className="btn-spinner"></span> : '📲 Connect WhatsApp'}
                </button>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  );
}

function WebinarModal({ webinar, onClose, onSave }) {
  const isNew = !webinar?._id;
  const [candidates, setCandidates] = useState([]);
  const [leads, setLeads] = useState([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', scheduledAt: '', duration: 60,
    link: '', youtubeLink: '', zoomLink: '', platform: 'zoom', status: 'upcoming',
    candidates: [], selectedLeads: [],
    ...webinar
  });
  useEffect(() => {
    Promise.all([
      api.get('/users?role=member'),
      api.get('/leads?limit=500')
    ]).then(([usersRes, leadsRes]) => {
      setCandidates(usersRes.data.users || []);
      setLeads(leadsRes.data.leads || []);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!webinar?.scheduledAt) return;
    setForm((current) => ({
      ...current,
      scheduledAt: format(new Date(webinar.scheduledAt), "yyyy-MM-dd'T'HH:mm"),
      candidates: (webinar.candidates || []).map((candidate) => candidate._id || candidate),
      selectedLeads: (webinar.attendees || []).map((attendee) => attendee.lead?._id || attendee.lead).filter(Boolean)
    }));
  }, [webinar]);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleCandidate = (id) => {
    setForm((current) => ({
      ...current,
      candidates: current.candidates.includes(id)
        ? current.candidates.filter((candidateId) => candidateId !== id)
        : [...current.candidates, id]
    }));
  };
  const toggleLead = (id) => {
    setForm((current) => ({
      ...current,
      selectedLeads: current.selectedLeads.includes(id)
        ? current.selectedLeads.filter((leadId) => leadId !== id)
        : [...current.selectedLeads, id]
    }));
  };
  const normalizedLeadSearch = leadSearch.trim().toLowerCase();
  const filteredLeads = normalizedLeadSearch
    ? leads.filter((lead) => {
      const phone = (lead.phone || '').replace(/\D/g, '');
      const queryPhone = normalizedLeadSearch.replace(/\D/g, '');
      return (
        lead.name?.toLowerCase().includes(normalizedLeadSearch) ||
        lead.email?.toLowerCase().includes(normalizedLeadSearch) ||
        phone.includes(queryPhone)
      );
    })
    : leads;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = { ...form, leads: form.selectedLeads, scheduledAt: new Date(form.scheduledAt).toISOString() };
      if (isNew) await api.post('/webinars', data);
      else await api.put(`/webinars/${webinar._id}`, data);
      toast.success(isNew ? 'Webinar created!' : 'Webinar updated!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{isNew ? 'Create Webinar' : 'Edit Webinar'}</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Title *</label>
                <input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Webinar title" />
              </div>
              <div className="form-group full-width">
                <label>Description</label>
                <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What's this webinar about?" />
              </div>
              <div className="form-group">
                <label>Scheduled Date & Time *</label>
                <input type="datetime-local" required value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input type="number" value={form.duration} onChange={e => set('duration', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Platform</label>
                <select value={form.platform} onChange={e => set('platform', e.target.value)}>
                  <option value="zoom">Zoom</option>
                  <option value="google_meet">Google Meet</option>
                  <option value="youtube">YouTube</option>
                  <option value="teams">Teams</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label>🔴 YouTube Live Link</label>
                <input value={form.youtubeLink} onChange={e => set('youtubeLink', e.target.value)} placeholder="https://youtube.com/live/..." />
              </div>
              <div className="form-group full-width">
                <label>🎥 Zoom Meeting Link</label>
                <input value={form.zoomLink} onChange={e => set('zoomLink', e.target.value)} placeholder="https://zoom.us/j/..." />
              </div>
              <div className="form-group full-width">
                <label><MdLink /> Other / Primary Link</label>
                <input value={form.link} onChange={e => set('link', e.target.value)} placeholder="https://..." />
              </div>
              <div className="form-group full-width">
                <label>Add Candidates</label>
                <div className="participant-grid">
                  {candidates.map((candidate) => (
                    <button
                      type="button"
                      key={candidate._id}
                      className={`participant-chip ${form.candidates.includes(candidate._id) ? 'selected' : ''}`}
                      onClick={() => toggleCandidate(candidate._id)}
                      aria-pressed={form.candidates.includes(candidate._id)}
                    >
                      <span className="chip-avatar">{candidate.name?.charAt(0).toUpperCase()}</span>
                      <span>{candidate.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group full-width">
                <label>Add Leads</label>
                <input
                  className="search-input compact"
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder="Search by mobile number, name, or email"
                />
                <div className="participant-grid scroll-picker">
                  {filteredLeads.length === 0 ? (
                    <div className="empty-state" style={{ padding: 12 }}>No matching leads found</div>
                  ) : filteredLeads.map((lead) => (
                    <button
                      type="button"
                      key={lead._id}
                      className={`participant-chip ${form.selectedLeads.includes(lead._id) ? 'selected' : ''}`}
                      onClick={() => toggleLead(lead._id)}
                      aria-pressed={form.selectedLeads.includes(lead._id)}
                    >
                      <span className="chip-avatar">{lead.name?.charAt(0).toUpperCase()}</span>
                      <span className="chip-text">{lead.name}</span>
                      {lead.phone && <span className="chip-muted">{lead.phone}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner"></span> : isNew ? 'Create Webinar' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AttendancePopup({ webinar, onClose, onUpdate }) {
  const [attendees, setAttendees] = useState(
    (webinar.attendees || []).map(a => ({ ...a }))
  );
  const [search, setSearch] = useState('');

  const markAttendance = async (leadId, status) => {
    // Optimistic update — turn green instantly
    setAttendees(prev => prev.map(a => {
      const id = a.lead?._id || a.lead;
      return String(id) === String(leadId) ? { ...a, status } : a;
    }));
    try {
      await api.put(`/webinars/${webinar._id}/mark-attendance`, { leadId, status });
      onUpdate();
    } catch {
      toast.error('Failed to mark attendance');
      // Revert on failure
      setAttendees(webinar.attendees || []);
    }
  };

  const totalAttended = attendees.filter(a => a.status === 'attended').length;

  const filtered = attendees.filter(a => {
    const lead = a.lead || {};
    const q = search.toLowerCase();
    return !q || lead.name?.toLowerCase().includes(q) || (lead.phone || '').includes(q);
  });

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal large">
        <div className="modal-header">
          <h2>Attendance — {webinar.title}</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <div className="modal-body">
          <div className="attendance-stats">
            <span>Attended: <strong>{totalAttended}</strong></span>
            <span>Invited: <strong>{attendees.length}</strong></span>
          </div>
          <input className="search-input" placeholder="Search invited leads..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="attendance-list">
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                {attendees.length === 0 ? 'No leads invited to this webinar.' : 'No matching leads.'}
              </div>
            ) : filtered.map(a => {
              const lead = a.lead || {};
              const status = a.status;
              return (
                <div key={lead._id} className={`attendance-row ${status || ''}`}>
                  <div className="att-info">
                    <div className="att-name">{lead.name}</div>
                    <div className="att-phone">{lead.phone}</div>
                  </div>
                  <div className="att-actions">
                    {['attended', 'registered', 'invited', 'missed'].map(s => (
                      <button key={s} className={`att-btn ${s} ${status === s ? 'active' : ''}`} onClick={() => markAttendance(lead._id, s)}>
                        {s === 'attended' ? '✅' : s === 'missed' ? '❌' : s === 'registered' ? '📝' : '📨'} {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">Done</button>
        </div>
      </div>
    </div>
  );
}

export default function Webinars() {
  const { user } = useAuth();
  const [webinars, setWebinars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editWebinar, setEditWebinar] = useState(null);
  const [attendanceWebinar, setAttendanceWebinar] = useState(null);
  const [showWASetup, setShowWASetup] = useState(false);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [sendingInvites, setSendingInvites] = useState(null);

  const loadWebinars = async () => {
    setLoading(true);
    try { const res = await api.get('/webinars'); setWebinars(res.data.webinars || []); }
    catch { toast.error('Failed to load webinars'); }
    finally { setLoading(false); }
  };

  const pollWA = async () => {
    try { const r = await api.get('/whatsapp/status'); setWaStatus(r.data.status); } catch {}
  };

  useEffect(() => {
    loadWebinars();
    pollWA();
    const t = setInterval(pollWA, 5000);
    return () => clearInterval(t);
  }, []);

  const deleteWebinar = async (id) => {
    if (!confirm('Delete this webinar?')) return;
    try { await api.delete(`/webinars/${id}`); toast.success('Deleted'); loadWebinars(); }
    catch { toast.error('Failed'); }
  };

  const sendInvites = async (webinarId) => {
    if (waStatus !== 'ready') { toast.error('Connect WhatsApp first — click the WhatsApp button'); setShowWASetup(true); return; }
    if (!confirm('Send WhatsApp invites to all leads who have NOT attended this webinar?')) return;
    setSendingInvites(webinarId);
    try {
      const res = await api.post(`/webinars/${webinarId}/send-invites`);
      toast.success(`✅ Sent: ${res.data.sent} | Failed: ${res.data.failed}`);
      loadWebinars();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSendingInvites(null); }
  };

  const statusColor = { upcoming: 'blue', live: 'green', completed: 'gray', cancelled: 'red' };

  return (
    <div className="page webinars-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Webinars</h1>
          <p className="page-subtitle">{webinars.length} webinars total</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className={`wa-status-btn ${waStatus === 'ready' ? 'connected' : ''}`} onClick={() => setShowWASetup(true)}>
            {waStatus === 'ready' ? <MdWifi /> : <MdWifiOff />}
            WhatsApp {waStatus === 'ready' ? '● Connected' : 'Setup'}
          </button>
          {user?.role !== 'member' && (
            <button className="btn-primary" onClick={() => { setEditWebinar(null); setShowModal(true); }}>
              <MdAdd /> Create Webinar
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="page-loader"><div className="loading-spinner"></div></div>
      ) : webinars.length === 0 ? (
        <div className="empty-state card">No webinars yet. Create your first webinar to get started.</div>
      ) : (
        <div className="webinar-grid">
          {webinars.map(w => (
            <div key={w._id} className={`webinar-card ${w.status}`}>
              <div className="wc-header">
                <div className="wc-platform">{PLATFORM_ICONS[w.platform] || '📡'}</div>
                <span className={`status-badge ${statusColor[w.status]}`}>{w.status}</span>
                {(w.notSeenCount > 0) && (
                  <span className="not-seen-pill">🔴 {w.notSeenCount} not seen</span>
                )}
              </div>
              <div className="wc-body">
                <h3 className="wc-title">{w.title}</h3>
                {w.description && <p className="wc-desc">{w.description}</p>}
                <div className="wc-meta">
                  <span>📅 {format(new Date(w.scheduledAt), 'dd MMM yyyy, hh:mm a')}</span>
                  <span>⏱️ {w.duration} mins</span>
                  <span><MdPeople /> {w.totalAttended || 0} attended</span>
                </div>
                <div className="wc-links">
                  {w.youtubeLink && <a href={w.youtubeLink} target="_blank" rel="noreferrer" className="wc-link-btn youtube">🔴 YouTube</a>}
                  {w.zoomLink && <a href={w.zoomLink} target="_blank" rel="noreferrer" className="wc-link-btn zoom">🎥 Zoom</a>}
                  {w.link && !w.youtubeLink && !w.zoomLink && (
                    <a href={w.link} target="_blank" rel="noreferrer" className="wc-join-btn"><MdVideoCall /> Join</a>
                  )}
                </div>
              </div>
              <div className="wc-footer">
                <button className="btn-sm blue" onClick={() => setAttendanceWebinar(w)}><MdPeople /> Attendance</button>
                <button className="btn-sm green" onClick={() => sendInvites(w._id)} disabled={sendingInvites === w._id}>
                  <MdWhatsapp /> {sendingInvites === w._id ? 'Sending…' : 'Send Invites'}
                </button>
                {user?.role !== 'member' && (
                  <>
                    <button className="btn-sm" onClick={() => { setEditWebinar(w); setShowModal(true); }}><MdEdit /></button>
                    <button className="btn-sm red" onClick={() => deleteWebinar(w._id)}><MdDelete /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <WebinarModal webinar={editWebinar} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadWebinars(); }} />}
      {attendanceWebinar && (
        <AttendancePopup
          webinar={attendanceWebinar}
          onClose={() => setAttendanceWebinar(null)}
          onUpdate={() => loadWebinars()}
        />
      )}
      {showWASetup && <WASetupModal onClose={() => { setShowWASetup(false); pollWA(); }} />}
    </div>
  );
}
