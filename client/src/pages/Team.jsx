import React, { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { MdAdd, MdBlock, MdClose, MdEmail, MdLock, MdPeople, MdPhone } from 'react-icons/md';

function AddCandidateModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', { ...form, role: 'member' });
      toast.success('Candidate added');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add candidate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal small">
        <div className="modal-header">
          <h2>Add Candidate</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Candidate name" />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 chars" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner"></span> : 'Add Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Team() {
  const [candidates, setCandidates] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const [usersRes, performanceRes] = await Promise.all([
        api.get('/users?role=member'),
        api.get('/dashboard/team-performance')
      ]);
      setCandidates((usersRes.data.users || []).filter((candidate) => candidate.role === 'member'));
      setPerformance(performanceRes.data.performance || []);
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCandidates(); }, []);

  const getPerfData = (candidateId) => performance.find((item) => item._id === candidateId);

  const disableCandidate = async (candidate) => {
    if (!confirm(`Disable ${candidate.name}? They will no longer appear in assign/message/webinar candidate lists.`)) return;
    try {
      await api.delete(`/users/${candidate._id}`);
      toast.success('Candidate disabled');
      loadCandidates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disable candidate');
    }
  };

  const resetPassword = async (candidate) => {
    const password = prompt(`New password for ${candidate.name}`);
    if (!password) return;
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await api.put(`/users/${candidate._id}/password`, { password });
      toast.success('Password updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    }
  };

  return (
    <div className="page team-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Candidates</h1>
          <p className="page-subtitle">{candidates.length} candidates</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}><MdAdd /> Add Candidate</button>
      </div>

      {loading ? (
        <div className="page-loader"><div className="loading-spinner"></div></div>
      ) : candidates.length === 0 ? (
        <div className="empty-state card">No candidates found. Add your first candidate.</div>
      ) : (
        <div className="team-grid">
          {candidates.map((candidate) => {
            const perf = getPerfData(candidate._id);
            const conversionRate = perf ? perf.conversionRate : 0;
            return (
              <div key={candidate._id} className="team-card">
                <div className="tc-header">
                  <div className="tc-avatar">
                    {candidate.avatar ? <img src={candidate.avatar} alt={candidate.name} /> : <span>{candidate.name?.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="tc-info">
                    <div className="tc-name">{candidate.name}</div>
                    <div className="tc-role">candidate</div>
                    <div className="tc-email"><MdEmail /> {candidate.email}</div>
                    {candidate.phone && <div className="tc-phone"><MdPhone /> {candidate.phone}</div>}
                  </div>
                </div>

                <div className="tc-stats">
                  <div className="tc-stat">
                    <div className="tc-stat-value">{perf?.totalLeads || 0}</div>
                    <div className="tc-stat-label">Assigned Leads</div>
                  </div>
                  <div className="tc-stat green">
                    <div className="tc-stat-value">{perf?.converted || 0}</div>
                    <div className="tc-stat-label">Converted</div>
                  </div>
                  <div className="tc-stat blue">
                    <div className="tc-stat-value">{perf?.completedToday || 0}/{perf?.followupsToday || 0}</div>
                    <div className="tc-stat-label">Today Followups</div>
                  </div>
                  <div className="tc-stat red">
                    <div className="tc-stat-value">{perf?.missed || 0}</div>
                    <div className="tc-stat-label">Missed</div>
                  </div>
                </div>

                <div className="tc-conversion">
                  <div className="tc-conv-header">
                    <span>Conversion Rate</span>
                    <strong>{conversionRate}%</strong>
                  </div>
                  <div className="tc-conv-bar">
                    <div className="tc-conv-fill" style={{ width: `${conversionRate}%` }}></div>
                  </div>
                </div>

                <div className="tc-footer">
                  <span className="tc-email"><MdPeople /> Assign leads from the Leads page</span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="btn-sm blue" onClick={() => resetPassword(candidate)}><MdLock /> Password</button>
                    <button className="btn-sm red" onClick={() => disableCandidate(candidate)}><MdBlock /> Disable</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddCandidateModal onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); loadCandidates(); }} />}
    </div>
  );
}
