import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { MdPhone, MdCheck, MdClose, MdSchedule, MdStar } from 'react-icons/md';

const QUICK_OUTCOMES = [
  { value: 'interested', label: 'Interested', color: 'green', emoji: '✅' },
  { value: 'not_interested', label: 'Not Interested', color: 'red', emoji: '❌' },
  { value: 'nurturing', label: 'Nurturing', color: 'orange', emoji: '🌱' },
  { value: 'no_answer', label: 'No Answer', color: 'gray', emoji: '📵' },
  { value: 'callback', label: 'Callback', color: 'blue', emoji: '🔄' },
  { value: 'converted', label: 'Converted', color: 'teal', emoji: '💰' }
];

function QuickCallCard({ lead, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const markOutcome = async (outcome) => {
    setLoading(true);
    try {
      // Update lead status
      await api.put(`/leads/${lead._id}`, {
        status: ['interested', 'converted', 'not_interested', 'nurturing'].includes(outcome) ? outcome : lead.status,
        lastCalledAt: new Date().toISOString(),
        $inc: { callCount: 1 }
      });
      if (remark) await api.post(`/leads/${lead._id}/remark`, { text: `[${outcome}] ${remark}` });
      setDone(true);
      toast.success(`Marked as ${outcome}`);
      setTimeout(() => onUpdate(), 500);
    } catch { toast.error('Failed to update'); }
    finally { setLoading(false); }
  };

  return (
    <div className={`calling-card ${done ? 'done' : ''} ${lead.priority}`}>
      <div className="cc-header" onClick={() => setExpanded(!expanded)}>
        <div className="cc-priority-bar" data-priority={lead.priority}></div>
        <div className="cc-main">
          <div className="cc-name">
            {lead.priority === 'high' && <MdStar className="high-star" />}
            {lead.name}
          </div>
          <div className="cc-meta">
            <a href={`tel:${lead.phone}`} className="cc-phone" onClick={e => e.stopPropagation()}>
              <MdPhone /> {lead.phone}
            </a>
            {lead.alternatePhone && <span className="cc-alt-phone">Alt: {lead.alternatePhone}</span>}
            <span className={`status-badge ${lead.status}`}>{lead.status?.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="cc-info">
          {lead.city && <span className="cc-city">📍 {lead.city}</span>}
          {lead.product && <span className="cc-product">📦 {lead.product}</span>}
          {lead.callCount > 0 && <span className="cc-calls">📞 Called {lead.callCount}x</span>}
          {lead.webinarStatus === 'attended' && <span className="webinar-badge attended">✅ Webinar</span>}
        </div>
        <button className={`expand-btn ${expanded ? 'open' : ''}`}>{expanded ? '▲' : '▼'}</button>
      </div>

      {expanded && (
        <div className="cc-body">
          {lead.latestRemark && (
            <div className="cc-last-remark">
              <span>Last remark:</span> "{lead.latestRemark}"
            </div>
          )}
          <div className="cc-remark-input">
            <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="Add remark after call..." rows={2} />
          </div>
          <div className="cc-outcomes">
            {QUICK_OUTCOMES.map(o => (
              <button key={o.value} className={`outcome-quick-btn ${o.color}`} onClick={() => markOutcome(o.value)} disabled={loading || done}>
                {o.emoji} {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallingList() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await api.get('/leads/today-calling');
      setLeads(res.data.leads || []);
    } catch { toast.error('Failed to load calling list'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadLeads(); }, []);

  const filtered = leads.filter(l => {
    if (filter === 'high') return l.priority === 'high';
    if (filter === 'interested') return l.status === 'interested';
    if (filter === 'nurturing') return l.status === 'nurturing';
    return true;
  });

  const priorityCounts = {
    high: leads.filter(l => l.priority === 'high').length,
    medium: leads.filter(l => l.priority === 'medium').length,
    low: leads.filter(l => l.priority === 'low').length
  };

  return (
    <div className="page calling-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Today's Calling List</h1>
          <p className="page-subtitle">{leads.length} leads scheduled for today &bull; {format(new Date(), 'EEEE, dd MMM yyyy')}</p>
        </div>
        <button className="btn-secondary" onClick={loadLeads}><MdSchedule /> Refresh</button>
      </div>

      {/* Quick Stats */}
      <div className="calling-stats">
        <div className="cs-card high">
          <div className="cs-num">{priorityCounts.high}</div>
          <div className="cs-label">High Priority</div>
        </div>
        <div className="cs-card medium">
          <div className="cs-num">{priorityCounts.medium}</div>
          <div className="cs-label">Medium Priority</div>
        </div>
        <div className="cs-card low">
          <div className="cs-num">{priorityCounts.low}</div>
          <div className="cs-label">Low Priority</div>
        </div>
        <div className="cs-card blue">
          <div className="cs-num">{leads.filter(l => l.webinarStatus === 'attended').length}</div>
          <div className="cs-label">Webinar Attended</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="page-tabs">
        {[
          { id: 'all', label: `All (${leads.length})` },
          { id: 'high', label: `High Priority (${priorityCounts.high})` },
          { id: 'interested', label: 'Interested' },
          { id: 'nurturing', label: 'Nurturing' }
        ].map(t => (
          <button key={t.id} className={`tab-btn ${filter === t.id ? 'active' : ''}`} onClick={() => setFilter(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Calling Cards */}
      <div className="calling-list">
        {loading ? (
          <div className="table-loader"><div className="loading-spinner"></div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {leads.length === 0 ? 'No leads scheduled for today. Set followup dates on leads to see them here.' : 'No leads match this filter.'}
          </div>
        ) : (
          filtered.map(lead => <QuickCallCard key={lead._id} lead={lead} onUpdate={loadLeads} />)
        )}
      </div>
    </div>
  );
}
