import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import {
  MdSend, MdMic, MdStop, MdClose, MdAdd, MdVideoCall,
  MdCheck, MdCheckCircle, MdWhatsapp, MdPeople, MdMessage, MdDelete, MdGroup
} from 'react-icons/md';

const PLATFORM_LABELS = { zoom: '🎥 Zoom', google_meet: '🟢 Google Meet', teams: '🔵 Teams', other: '📡 Other' };
const AUDIO_BASE = import.meta.env.DEV ? 'http://localhost:5000' : '';

// ─── Create Group Modal ────────────────────────────────────────────────────────
function CreateGroupModal({ users, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggle = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Group name is required');
    if (selected.length === 0) return toast.error('Select at least one candidate');
    setLoading(true);
    try {
      const res = await api.post('/groups', { name: name.trim(), memberIds: selected });
      toast.success(`Group "${res.data.group.name}" created`);
      onCreated(res.data.group);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal small">
        <div className="modal-header">
          <h2>Create Group</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <form onSubmit={handleCreate}>
          <div className="modal-body">
            <div className="form-group full-width" style={{ marginBottom: 16 }}>
              <label>Group Name *</label>
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sales Team" />
            </div>
            <div className="form-group full-width">
              <label>Add Candidates *</label>
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                {users.map(u => (
                  <div
                    key={u._id}
                    onClick={() => toggle(u._id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: selected.includes(u._id) ? '#f0fdf4' : 'white', borderBottom: '1px solid #f1f5f9' }}
                  >
                    <input type="checkbox" readOnly checked={selected.includes(u._id)} style={{ accentColor: '#16a34a' }} />
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                      {u.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{u.email}</div>
                    </div>
                    {selected.includes(u._id) && <MdCheck style={{ marginLeft: 'auto', color: '#16a34a' }} />}
                  </div>
                ))}
              </div>
              {selected.length > 0 && <p style={{ fontSize: 12, color: '#16a34a', marginTop: 6 }}>{selected.length} candidate{selected.length > 1 ? 's' : ''} selected</p>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner"></span> : <><MdGroup /> Create Group</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Meeting Modal ─────────────────────────────────────────────────────────────
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
                    <div key={u._id} className={`participant-chip ${form.participants.includes(u._id) ? 'selected' : ''}`} onClick={() => toggleParticipant(u._id)}>
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

// ─── Main Messages Page ────────────────────────────────────────────────────────
export default function Messages() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('messages');
  const [msgMode, setMsgMode] = useState('direct');

  // Direct message state
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  // Group state
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupText, setGroupText] = useState('');
  const [groupSending, setGroupSending] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Meetings
  const [meetings, setMeetings] = useState([]);
  const [showMeetingModal, setShowMeetingModal] = useState(false);

  const bottomRef = useRef(null);
  const groupBottomRef = useRef(null);
  const audioChunks = useRef([]);
  const pollRef = useRef(null);

  const currentUserId = user?._id || user?.id;

  useEffect(() => {
    if (!currentUserId) return;
    loadUsers();
    loadGroups();
    loadMeetings();
  }, [currentUserId]);

  useEffect(() => {
    if (selectedUser) loadMessages(selectedUser._id);
  }, [selectedUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    groupBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages]);

  // Poll group messages every 4 seconds when a group is open
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (selectedGroup) {
      loadGroupMessages(selectedGroup._id);
      pollRef.current = setInterval(() => loadGroupMessages(selectedGroup._id), 4000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedGroup?._id]);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      const others = (res.data.users || []).filter(u => u._id && u._id !== currentUserId);
      setUsers(others);
    } catch {}
  };

  const loadGroups = async () => {
    try {
      const res = await api.get('/groups');
      setGroups(res.data.groups || []);
    } catch {}
  };

  const loadMessages = async (userId) => {
    try {
      const res = await api.get(`/messages?with=${userId}`);
      setMessages(res.data.messages || []);
    } catch {}
  };

  const loadGroupMessages = async (groupId) => {
    try {
      const res = await api.get(`/groups/${groupId}/messages`);
      setGroupMessages(res.data.messages || []);
    } catch {}
  };

  const loadMeetings = async () => {
    try {
      const res = await api.get('/meetings');
      setMeetings(res.data.meetings || []);
    } catch {}
  };

  // ── Direct send ──
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

  // ── Group send ──
  const sendGroupMessage = async () => {
    if (!groupText.trim() || !selectedGroup || groupSending) return;
    setGroupSending(true);
    try {
      const res = await api.post(`/groups/${selectedGroup._id}/messages`, { content: groupText.trim() });
      setGroupMessages(m => [...m, res.data.message]);
      setGroupText('');
      // Update last message preview in sidebar
      setGroups(prev => prev.map(g =>
        g._id === selectedGroup._id ? { ...g, lastMessage: groupText.trim().slice(0, 80), lastMessageAt: new Date() } : g
      ));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); }
    finally { setGroupSending(false); }
  };

  const deleteGroup = async (group) => {
    if (!confirm(`Delete group "${group.name}"? This will remove all messages.`)) return;
    try {
      await api.delete(`/groups/${group._id}`);
      setGroups(prev => prev.filter(g => g._id !== group._id));
      if (selectedGroup?._id === group._id) setSelectedGroup(null);
      toast.success('Group deleted');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  // ── Voice recording ──
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

  const isMine = (msg) => msg.from?._id === currentUserId || msg.from === currentUserId;
  const isGroupMine = (msg) => {
    const senderId = msg.from?._id || msg.from;
    return String(senderId) === String(currentUserId);
  };

  const switchMode = (mode) => {
    setMsgMode(mode);
    setText('');
    setGroupText('');
    if (mode === 'direct') { setSelectedGroup(null); }
    if (mode === 'group') { setSelectedUser(null); }
  };

  return (
    <div className="page messages-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Messages</h1>
          <p className="page-subtitle">Send direct messages or chat in groups</p>
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
          {/* ── Sidebar ── */}
          <div className="msg-sidebar">
            {/* Mode toggle */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 4 }}>
              <button
                onClick={() => switchMode('direct')}
                style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: msgMode === 'direct' ? 700 : 400, color: msgMode === 'direct' ? '#16a34a' : '#64748b', background: 'none', border: 'none', borderBottom: msgMode === 'direct' ? '2px solid #16a34a' : '2px solid transparent', cursor: 'pointer' }}
              >
                <MdMessage style={{ verticalAlign: 'middle', marginRight: 4 }} /> Direct
              </button>
              <button
                onClick={() => switchMode('group')}
                style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: msgMode === 'group' ? 700 : 400, color: msgMode === 'group' ? '#16a34a' : '#64748b', background: 'none', border: 'none', borderBottom: msgMode === 'group' ? '2px solid #16a34a' : '2px solid transparent', cursor: 'pointer' }}
              >
                <MdGroup style={{ verticalAlign: 'middle', marginRight: 4 }} /> Groups
              </button>
            </div>

            {msgMode === 'direct' ? (
              <>
                <div className="msg-sidebar-title"><MdPeople /> Candidates / Team</div>
                {users.length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}>No active candidates found</div>
                ) : users.map(u => (
                  <div key={u._id} className={`msg-user-row ${selectedUser?._id === u._id ? 'active' : ''}`} onClick={() => setSelectedUser(u)}>
                    <div className="msg-user-avatar">{u.name?.charAt(0).toUpperCase()}</div>
                    <div className="msg-user-info">
                      <div className="msg-user-name">{u.name}</div>
                      <div className="msg-user-role">{u.role}</div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
                  <span className="msg-sidebar-title" style={{ margin: 0 }}><MdGroup /> Groups ({groups.length})</span>
                  {isAdmin && (
                    <button className="btn-sm blue" style={{ fontSize: 12 }} onClick={() => setShowCreateGroup(true)}>
                      <MdAdd /> New
                    </button>
                  )}
                </div>
                {groups.length === 0 ? (
                  <div style={{ padding: 16, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                    {isAdmin ? 'No groups yet. Create one!' : 'No groups yet.'}
                  </div>
                ) : groups.map(g => (
                  <div
                    key={g._id}
                    className={`msg-user-row ${selectedGroup?._id === g._id ? 'active' : ''}`}
                    onClick={() => setSelectedGroup(g)}
                  >
                    <div className="msg-user-avatar" style={{ background: '#7c3aed' }}><MdGroup size={18} /></div>
                    <div className="msg-user-info" style={{ flex: 1, minWidth: 0 }}>
                      <div className="msg-user-name">{g.name}</div>
                      <div className="msg-user-role" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.lastMessage ? g.lastMessage : `${g.members?.length || 0} members`}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── Chat Area ── */}
          <div className="msg-chat">
            {msgMode === 'group' ? (
              !selectedGroup ? (
                <div className="msg-empty">
                  <MdGroup size={48} style={{ color: '#334155', marginBottom: 12 }} />
                  <p>{groups.length === 0 ? (isAdmin ? 'Create a group to get started' : 'No groups available') : 'Select a group to open chat'}</p>
                </div>
              ) : (
                <>
                  {/* Group chat header */}
                  <div className="msg-chat-header">
                    <div className="msg-user-avatar" style={{ background: '#7c3aed' }}><MdGroup size={18} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedGroup.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {selectedGroup.members?.map(m => m.name || m).join(', ')}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => deleteGroup(selectedGroup)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 6 }}
                        title="Delete group"
                      >
                        <MdDelete size={20} />
                      </button>
                    )}
                  </div>

                  {/* Group messages thread */}
                  <div className="msg-thread">
                    {groupMessages.length === 0 && (
                      <div className="msg-empty" style={{ height: '100%' }}><p>No messages yet. Start the conversation! 👋</p></div>
                    )}
                    {groupMessages.map(msg => {
                      const mine = isGroupMine(msg);
                      const senderName = msg.from?.name || 'Unknown';
                      const senderInitial = senderName.charAt(0).toUpperCase();
                      return (
                        <div key={msg._id} className={`msg-bubble-wrap ${mine ? 'mine' : 'theirs'}`}>
                          {!mine && (
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7c3aed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, marginRight: 6 }}>
                              {senderInitial}
                            </div>
                          )}
                          <div style={{ maxWidth: '68%' }}>
                            {!mine && <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', marginBottom: 2, paddingLeft: 2 }}>{senderName}</div>}
                            <div className={`msg-bubble ${mine ? 'mine' : 'theirs'}`}>
                              <p>{msg.content}</p>
                              <div className="msg-meta">
                                <span>{format(new Date(msg.createdAt), 'hh:mm a')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={groupBottomRef} />
                  </div>

                  {/* Group input */}
                  <div className="msg-input-bar">
                    <input
                      className="msg-input"
                      placeholder={`Message ${selectedGroup.name}…`}
                      value={groupText}
                      onChange={e => setGroupText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !groupSending && sendGroupMessage()}
                    />
                    <button className="msg-send-btn" onClick={sendGroupMessage} disabled={groupSending || !groupText.trim()}>
                      {groupSending ? <span className="btn-spinner"></span> : <MdSend />}
                    </button>
                  </div>
                </>
              )
            ) : !selectedUser ? (
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
                          <audio controls src={`${AUDIO_BASE}${msg.audioUrl}`} style={{ maxWidth: 240, height: 36 }} />
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
              {m.organizer?._id === currentUserId && (
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

      {showCreateGroup && (
        <CreateGroupModal
          users={users}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(group) => {
            setGroups(prev => [group, ...prev]);
            setShowCreateGroup(false);
            setSelectedGroup(group);
          }}
        />
      )}
    </div>
  );
}
