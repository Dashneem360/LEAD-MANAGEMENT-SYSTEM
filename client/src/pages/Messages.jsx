import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import {
  MdSend, MdMic, MdStop, MdClose, MdAdd, MdVideoCall,
  MdCheck, MdCheckCircle, MdWhatsapp, MdPeople, MdMessage
} from 'react-icons/md';

const PLATFORM_LABELS = { zoom: '🎥 Zoom', google_meet: '🟢 Google Meet', teams: '🔵 Teams', other: '📡 Other' };

function MeetingModal({ users, currentUser, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '', scheduledAt: '', duration: 30,
    meetingLink: '', platform: 'zoom', participants: [], notes: ''
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleParticipant = (id) => {
    setForm(f => ({
      ...f,
      participants: f.participants.includes(id) ? f.participants.filter(p => p !== id) : [...f.participants, id]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.participants.length) return toast.error('Select at least one participant');
    setLoading(true);
    try {
      await api.post('/meetings', { ...form, scheduledAt: new Date(form.scheduledAt).toISOString() });

      // Notify participants via WhatsApp if connected
      try {
        const waRes = await api.get('/whatsapp/status');
        if (waRes.data.status === 'ready') {
          const selectedUsers = users.filter(u => form.participants.includes(u._id));
          for (const u of selectedUsers) {
            if (u.phone) {
              const msg = `📹 *Meeting Scheduled by ${currentUser.name}*\n\n*${form.title}*\n📅 ${format(new Date(form.scheduledAt), 'dd MMM yyyy, hh:mm a')}\n⏱️ ${form.duration} mins\n🔗 ${form.meetingLink || 'Link TBD'}\n\n${form.notes || ''}`;
              await api.post('/whatsapp/send', { phone: u.phone, message: msg }).catch(() => {});
            }
          }
          toast.success('Meeting scheduled & WhatsApp sent to participants!');
        } else {
          toast.success('Meeting scheduled!');
        }
      } catch { toast.success('Meeting scheduled!'); }

      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Schedule Video Call / Meeting</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Meeting Title *</label>
                <input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Weekly team sync" />
              </div>
              <div className="form-group">
                <label>Date & Time *</label>
                <input type="datetime-local" required value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input type="number" value={form.duration} onChange={e => set('duration', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Platform</label>
                <select value={form.platform} onChange={e => set('platform', e.target.value)}>
                  {Object.entries(PLATFORM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Meeting Link</label>
                <input value={form.meetingLink} onChange={e => set('meetingLink', e.target.value)} placeholder="https://zoom.us/j/..." />
              </div>
              <div className="form-group full-width">
                <label>Participants *</label>
                <div className="participant-grid">
                  {users.map(u => (
                    <div
                      key={u._id}
                      className={`participant-chip ${form.participants.includes(u._id) ? 'selected' : ''}`}
                      onClick={() => toggleParticipant(u._id)}
                    >
                      <span className="chip-avatar">{u.name?.charAt(0).toUpperCase()}</span>
                      <span>{u.name}</span>
                      {form.participants.includes(u._id) && <MdCheck />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group full-width">
                <label>Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Agenda or notes..." />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner"></span> : <><MdVideoCall /> Schedule Meeting</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [tab, setTab] = useState('messages');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const bottomRef = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    const currentUserId = user?._id || user?.id;
    if (!currentUserId) return;
    loadUsers();
    loadMeetings();
  }, [user?._id, user?.id]);

  useEffect(() => {
    if (selectedUser) loadMessages(selectedUser._id);
  }, [selectedUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      const currentUserId = user?._id || user?.id;
      const others = (res.data.users || []).filter(u => u._id && u._id !== currentUserId);
      setUsers(others);
    } catch {}
  };

  const loadMessages = async (userId) => {
    try {
      const res = await api.get(`/messages?with=${userId}`);
      setMessages(res.data.messages || []);
    } catch {}
  };

  const loadMeetings = async () => {
    try {
      const res = await api.get('/meetings');
      setMeetings(res.data.meetings || []);
    } catch {}
  };

  const sendText = async () => {
    if (!text.trim() || !selectedUser) return;
    setSending(true);
    try {
      const res = await api.post('/messages/send', { toUserId: selectedUser._id, content: text.trim() });
      setMessages(m => [...m, res.data.message]);
      setText('');
      loadUsers();
      if (res.data.whatsappSent) toast.success('Message sent via WhatsApp!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); }
    finally { setSending(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunks.current = [];
      mr.ondataavailable = e => audioChunks.current.push(e.data);
      mr.onstop = () => uploadVoice(stream);
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
    } catch { toast.error('Microphone access denied'); }
  };

  const stopRecording = () => {
    if (mediaRecorder) { mediaRecorder.stop(); setRecording(false); }
  };

  const uploadVoice = async (stream) => {
    stream.getTracks().forEach(t => t.stop());
    if (!selectedUser) return;
    const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
    const fd = new FormData();
    fd.append('audio', blob, 'voice.webm');
    fd.append('toUserId', selectedUser._id);
    setSending(true);
    try {
      const res = await api.post('/messages/send-voice', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessages(m => [...m, res.data.message]);
      if (res.data.whatsappSent) toast.success('Voice note sent via WhatsApp!');
      else toast.success('Voice note sent!');
    } catch { toast.error('Failed to send voice note'); }
    finally { setSending(false); }
  };

  const deleteMeeting = async (id) => {
    try { await api.delete(`/meetings/${id}`); loadMeetings(); toast.success('Meeting cancelled'); }
    catch { toast.error('Failed'); }
  };

  const isMine = (msg) => {
    const currentUserId = user?._id || user?.id;
    return msg.from?._id === currentUserId || msg.from === currentUserId;
  };

  return (
    <div className="page messages-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Messages</h1>
      <p className="page-subtitle">Send direct messages to one candidate or schedule meetings with selected candidates</p>
        </div>
        <button className="btn-primary" onClick={() => setShowMeetingModal(true)}>
          <MdVideoCall /> Schedule Meeting
        </button>
      </div>

      <div className="msg-tabs">
        <button className={`msg-tab ${tab === 'messages' ? 'active' : ''}`} onClick={() => setTab('messages')}><MdMessage /> Messages</button>
        <button className={`msg-tab ${tab === 'meetings' ? 'active' : ''}`} onClick={() => setTab('meetings')}><MdVideoCall /> Meetings ({meetings.length})</button>
      </div>

      {tab === 'messages' ? (
        <div className="msg-layout">
          {/* User list */}
          <div className="msg-sidebar">
            <div className="msg-sidebar-title"><MdPeople /> Candidates / Team</div>
            {users.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>No active candidates found</div>
            ) : users.map(u => (
              <div
                key={u._id}
                className={`msg-user-row ${selectedUser?._id === u._id ? 'active' : ''}`}
                onClick={() => setSelectedUser(u)}
              >
                <div className="msg-user-avatar">{u.name?.charAt(0).toUpperCase()}</div>
                <div className="msg-user-info">
                  <div className="msg-user-name">{u.name}</div>
                  <div className="msg-user-role">{u.role}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat area */}
          <div className="msg-chat">
            {!selectedUser ? (
              <div className="msg-empty">
                <MdMessage size={48} style={{ color: '#334155', marginBottom: 12 }} />
                <p>Select one candidate to start messaging</p>
              </div>
            ) : (
              <>
                <div className="msg-chat-header">
                  <div className="msg-user-avatar">{selectedUser.name?.charAt(0).toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{selectedUser.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{selectedUser.role} {selectedUser.phone ? `· ${selectedUser.phone}` : ''}</div>
                  </div>
                </div>

                <div className="msg-thread">
                  {messages.length === 0 && (
                    <div className="msg-empty" style={{ height: '100%' }}><p>No messages yet. Say hi! 👋</p></div>
                  )}
                  {messages.map(msg => (
                    <div key={msg._id} className={`msg-bubble-wrap ${isMine(msg) ? 'mine' : 'theirs'}`}>
                      <div className={`msg-bubble ${isMine(msg) ? 'mine' : 'theirs'}`}>
                        {msg.type === 'voice' ? (
                          <audio controls src={`http://localhost:5000${msg.audioUrl}`} style={{ maxWidth: 240, height: 36 }} />
                        ) : (
                          <p>{msg.content}</p>
                        )}
                        <div className="msg-meta">
                          <span>{format(new Date(msg.createdAt), 'hh:mm a')}</span>
                          {msg.whatsappSent && <MdWhatsapp title="Sent via WhatsApp" style={{ color: '#22c55e' }} />}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                <div className="msg-input-bar">
                  <input
                    className="msg-input"
                    placeholder={`Message ${selectedUser.name}…`}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendText()}
                  />
                  <button
                    className={`msg-voice-btn ${recording ? 'recording' : ''}`}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    title="Hold to record voice note"
                    disabled={sending}
                  >
                    {recording ? <MdStop /> : <MdMic />}
                  </button>
                  <button className="msg-send-btn" onClick={sendText} disabled={sending || !text.trim()}>
                    {sending ? <span className="btn-spinner"></span> : <MdSend />}
                  </button>
                </div>
                {recording && <div className="recording-indicator">🔴 Recording… release to send</div>}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="meetings-list">
          {meetings.length === 0 ? (
            <div className="empty-state card" style={{ marginTop: 24 }}>
              No meetings scheduled. Click "Schedule Meeting" to create one.
            </div>
          ) : meetings.map(m => (
            <div key={m._id} className={`meeting-card ${m.status}`}>
              <div className="meeting-card-header">
                <div>
                  <div className="meeting-title">{m.title}</div>
                  <div className="meeting-meta">
                    {PLATFORM_LABELS[m.platform]} &bull; {format(new Date(m.scheduledAt), 'dd MMM yyyy, hh:mm a')} &bull; {m.duration} mins
                  </div>
                </div>
                <span className={`status-badge ${m.status === 'scheduled' ? 'blue' : m.status === 'completed' ? 'green' : 'red'}`}>{m.status}</span>
              </div>
              {m.meetingLink && (
                <a href={m.meetingLink} target="_blank" rel="noreferrer" className="meeting-join-btn">
                  <MdVideoCall /> Join Meeting
                </a>
              )}
              <div className="meeting-participants">
                <span style={{ fontSize: 12, color: '#64748b' }}>Participants: </span>
                {m.participants?.map(p => (
                  <span key={p._id} className="participant-tag">{p.name}</span>
                ))}
              </div>
              {m.notes && <p className="meeting-notes">{m.notes}</p>}
              {m.organizer?._id === (user?._id || user?.id) && (
                <div className="meeting-actions">
                  <button className="btn-sm red" onClick={() => deleteMeeting(m._id)}><MdClose /> Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showMeetingModal && (
        <MeetingModal
          users={users}
          currentUser={user}
          onClose={() => setShowMeetingModal(false)}
          onSave={() => { setShowMeetingModal(false); loadMeetings(); }}
        />
      )}
    </div>
  );
}
