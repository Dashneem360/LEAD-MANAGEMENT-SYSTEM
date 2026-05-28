import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { format } from 'date-fns';
import {
  MdPeople, MdTrendingUp, MdWarning, MdCheckCircle,
  MdSchedule, MdStar, MdClose, MdOndemandVideo, MdWhatsapp, MdMessage
} from 'react-icons/md';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

function StatCard({ icon: Icon, label, value, sub, color, alert, onClick }) {
  return (
    <div className={`stat-card ${color} ${alert ? 'alert-card' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="stat-icon"><Icon /></div>
      <div className="stat-info">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
      {alert && <div className="alert-dot"></div>}
    </div>
  );
}

function FollowupListModal({ title, followups, color, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal large">
        <div className="modal-header">
          <h2>{title} <span className={`badge ${color}`}>{followups.length}</span></h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <div className="modal-body">
          <div className="not-seen-list">
            {followups.length === 0 ? (
              <div className="empty-state">No followups here</div>
            ) : followups.map(f => (
              <div key={f._id} className={`not-seen-row`}>
                <div className="ns-info">
                  <div className="ns-name">{f.lead?.name}</div>
                  <div className="ns-phone">{f.lead?.phone}</div>
                  {f.assignedTo && <div className="ns-city">Assigned to: {f.assignedTo.name}</div>}
                </div>
                <span className={`status-badge ${f.status}`}>{f.status}</span>
                <div className="ns-city">{f.scheduledDate ? format(new Date(f.scheduledDate), 'dd MMM, hh:mm a') : '—'}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  );
}

function LeadListModal({ title, leads, onClose }) {
  const [waStatus, setWaStatus] = useState({});

  const sendWA = async (lead) => {
    if (!lead.phone) return;
    setWaStatus((current) => ({ ...current, [lead._id]: 'sending' }));
    try {
      const message = `Hi ${lead.name}, your webinar invite is pending. Please check your webinar link and join the session.`;
      await api.post('/whatsapp/send', { phone: lead.phone, message });
      setWaStatus((current) => ({ ...current, [lead._id]: 'sent' }));
    } catch {
      setWaStatus((current) => ({ ...current, [lead._id]: 'failed' }));
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal large">
        <div className="modal-header">
          <h2>{title} <span className="badge red">{leads.length}</span></h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <div className="modal-body">
          <div className="not-seen-list">
            {leads.length === 0 ? (
              <div className="empty-state">No candidates found</div>
            ) : leads.map(lead => (
              <div key={lead._id} className="not-seen-row">
                <div className="ns-info">
                  <div className="ns-name">{lead.name}</div>
                  <div className="ns-phone">{lead.phone}</div>
                  {lead.city && <div className="ns-city">{lead.city}</div>}
                </div>
                <span className={`status-badge ${lead.webinarStatus}`}>{lead.webinarStatus || 'not_invited'}</span>
                <button className="btn-sm green" onClick={() => sendWA(lead)} disabled={!lead.phone || waStatus[lead._id] === 'sending'}>
                  <MdWhatsapp /> {waStatus[lead._id] === 'sending' ? 'Sending...' : waStatus[lead._id] === 'sent' ? 'Sent' : 'Send WA'}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [growthData, setGrowthData] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [teamPerf, setTeamPerf] = useState([]);
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [missedFollowups, setMissedFollowups] = useState([]);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [missedModal, setMissedModal] = useState(false);
  const [todayModal, setTodayModal] = useState(false);
  const [notSeenModal, setNotSeenModal] = useState(false);
  const [notSeenLeads, setNotSeenLeads] = useState([]);

  useEffect(() => { loadAll(); }, [period]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, g, sc, tf, mf] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get(`/dashboard/growth-chart?period=${period}`),
        api.get('/dashboard/lead-status-chart'),
        api.get('/followups/today'),
        api.get('/followups/missed')
      ]);
      setStats(s.data.stats);
      setGrowthData(g.data);
      setStatusData(sc.data.data);
      setTodayFollowups(tf.data.followups || []);
      setMissedFollowups(mf.data.followups || []);
      if (user?.role !== 'member') {
        const tp = await api.get('/dashboard/team-performance');
        setTeamPerf(tp.data.performance || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openNotSeen = async () => {
    try {
      const res = await api.get('/webinars/not-seen-leads');
      setNotSeenLeads(res.data.leads || []);
      setNotSeenModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="page-loader"><div className="loading-spinner"></div></div>;

  const buildChartData = () => {
    if (!growthData) return null;
    const labels = [...new Set([
      ...(growthData.leadsData || []).map(d => d._id),
      ...(growthData.followupsData || []).map(d => d._id)
    ])].sort().slice(-30);
    const getVal = (arr, date) => arr.find(d => d._id === date)?.count || 0;
    return {
      labels,
      datasets: [
        { label: 'New Leads', data: labels.map(d => getVal(growthData.leadsData, d)), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', fill: true, tension: 0.4, pointRadius: 3 },
        { label: 'Followups Done', data: labels.map(d => getVal(growthData.followupsData, d)), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)', fill: true, tension: 0.4, pointRadius: 3 },
        { label: 'Conversions', data: labels.map(d => getVal(growthData.conversionsData, d)), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', fill: true, tension: 0.4, pointRadius: 3 }
      ]
    };
  };

  const buildStatusChart = () => {
    if (!statusData) return null;
    const statusMap = { new: 'New', contacted: 'Contacted', interested: 'Interested', not_interested: 'Not Interested', nurturing: 'Nurturing', converted: 'Converted', lost: 'Lost' };
    const colors = ['#6366f1', '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#14b8a6', '#8b5cf6'];
    return {
      labels: statusData.map(d => statusMap[d._id] || d._id),
      datasets: [{ data: statusData.map(d => d.count), backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }]
    };
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { color: '#94a3b8', font: { size: 12 } } }, tooltip: { mode: 'index', intersect: false } },
    scales: { x: { grid: { color: '#1e293b' }, ticks: { color: '#64748b', maxTicksLimit: 10 } }, y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' }, beginAtZero: true } }
  };
  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } } },
    cutout: '65%'
  };

  const chartData = buildChartData();
  const statusChart = buildStatusChart();

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name} &bull; {format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="period-tabs">
          {['week', 'month', 'year'].map(p => (
            <button key={p} className={`tab-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {missedFollowups.length > 0 && (
        <div className="alert-banner" style={{ cursor: 'pointer' }} onClick={() => setMissedModal(true)}>
          <MdWarning className="alert-icon" />
          <strong>{missedFollowups.length} missed followup{missedFollowups.length > 1 ? 's' : ''}!</strong>
          <span>Please complete your pending followups immediately.</span>
          <span className="alert-link">View All →</span>
        </div>
      )}

      {stats && (
        <div className="stats-grid">
          <StatCard icon={MdPeople}      label="Total Leads"       value={stats.totalLeads}      sub={`+${stats.weekLeads} this week`}        color="purple" />
          <StatCard icon={MdTrendingUp}  label="Interested"        value={stats.interestedLeads} sub={`${stats.conversionRate}% conversion`}   color="green" />
          <StatCard icon={MdStar}        label="Converted"         value={stats.convertedLeads}  sub="All time"                                color="gold" />
          <StatCard icon={MdSchedule}    label="Today's Followups" value={stats.todayFollowups}  sub={`${stats.pendingFollowups} pending`}      color="blue"  onClick={() => setTodayModal(true)} />
          <StatCard icon={MdCheckCircle} label="Completed Today"   value={stats.todayFollowups - stats.pendingFollowups} sub="Follow-ups done" color="teal" />
          <StatCard icon={MdWarning}     label="Missed Followups"  value={stats.missedFollowups} sub="Click to view list"                      color="red"   alert={stats.missedFollowups > 0} onClick={() => setMissedModal(true)} />
          <StatCard icon={MdOndemandVideo} label="Not Seen Webinar" value={stats.notSeenWebinar || 0} sub="Click to send WA invites" color="red" alert={(stats.notSeenWebinar || 0) > 0} onClick={openNotSeen} />
          <StatCard icon={MdMessage} label="Unread Messages" value={stats.unreadMessages || 0} sub="Team and candidate chat" color="purple" alert={(stats.unreadMessages || 0) > 0} />
        </div>
      )}

      <div className="charts-row">
        <div className="chart-card wide">
          <div className="chart-header"><h3>Growth Overview</h3><span className="chart-badge">{period}</span></div>
          <div className="chart-body" style={{ height: 280 }}>
            {chartData ? <Line data={chartData} options={chartOptions} /> : <div className="no-data">No data available</div>}
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-header"><h3>Lead Status</h3></div>
          <div className="chart-body" style={{ height: 280 }}>
            {statusChart ? <Doughnut data={statusChart} options={doughnutOptions} /> : <div className="no-data">No data</div>}
          </div>
        </div>
      </div>

      <div className="bottom-row">
        <div className="card today-followups-card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setTodayModal(true)}>
            <h3>Today's Followups</h3>
            <span className="badge blue">{todayFollowups.length}</span>
          </div>
          <div className="followup-scroll">
            {todayFollowups.length === 0 ? (
              <div className="empty-state">No followups scheduled for today</div>
            ) : todayFollowups.slice(0, 8).map(f => (
              <div key={f._id} className={`followup-row ${f.status}`}>
                <div className="followup-info">
                  <div className="followup-name">{f.lead?.name}</div>
                  <div className="followup-phone">{f.lead?.phone}</div>
                </div>
                <div className="followup-meta">
                  <span className={`status-badge ${f.status}`}>{f.status}</span>
                  <span className="followup-time">{f.scheduledDate ? format(new Date(f.scheduledDate), 'hh:mm a') : '—'}</span>
                </div>
              </div>
            ))}
            {todayFollowups.length > 8 && (
              <div className="view-all-link" onClick={() => setTodayModal(true)}>View all {todayFollowups.length} →</div>
            )}
          </div>
        </div>

        <div className="card missed-card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setMissedModal(true)}>
            <h3>Missed Followups</h3>
            <span className="badge red">{missedFollowups.length}</span>
          </div>
          <div className="followup-scroll">
            {missedFollowups.length === 0 ? (
              <div className="empty-state">No missed followups</div>
            ) : missedFollowups.slice(0, 8).map(f => (
              <div key={f._id} className="followup-row missed">
                <MdWarning className="missed-icon" />
                <div className="followup-info">
                  <div className="followup-name">{f.lead?.name}</div>
                  <div className="followup-phone">{f.lead?.phone}</div>
                </div>
                <div className="followup-date">{format(new Date(f.scheduledDate), 'dd MMM, hh:mm a')}</div>
              </div>
            ))}
            {missedFollowups.length > 8 && (
              <div className="view-all-link" onClick={() => setMissedModal(true)}>View all {missedFollowups.length} →</div>
            )}
          </div>
        </div>

        {user?.role !== 'member' && teamPerf.length > 0 && (
          <div className="card team-perf-card">
            <div className="card-header"><h3>Candidate Performance</h3></div>
            <div className="team-perf-list">
              {teamPerf.map(m => (
                <div key={m._id} className="team-perf-row">
                  <div className="perf-avatar">
                    {m.avatar ? <img src={m.avatar} alt={m.name} /> : <span>{m.name?.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="perf-info">
                    <div className="perf-name">{m.name}</div>
                    <div className="perf-stats">
                      <span>{m.totalLeads} leads</span>
                      <span>{m.converted} converted</span>
                      <span>{m.completedToday}/{m.followupsToday} today</span>
                    </div>
                  </div>
                  <div className="perf-rate">
                    <div className="rate-bar"><div className="rate-fill" style={{ width: `${m.conversionRate}%` }}></div></div>
                    <span>{m.conversionRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {missedModal && <FollowupListModal title="Missed Followups" followups={missedFollowups} color="red" onClose={() => setMissedModal(false)} />}
      {todayModal && <FollowupListModal title="Today's Followups" followups={todayFollowups} color="blue" onClose={() => setTodayModal(false)} />}
      {notSeenModal && <LeadListModal title="Not Seen Webinar" leads={notSeenLeads} onClose={() => setNotSeenModal(false)} />}
    </div>
  );
}
