import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format, differenceInCalendarDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  MdAdd, MdSearch, MdFilterList, MdEdit, MdDelete, MdAssignment,
  MdPhoneCallback, MdCloudUpload, MdSync, MdStar, MdVisibility, MdClose,
  MdPerson, MdPhone, MdEmail, MdLocationOn, MdNote, MdSchedule,
  MdTrendingUp, MdCalendarToday, MdChat, MdLabel, MdSort, MdWhatsapp,
  MdCurrencyRupee, MdOndemandVideo
} from 'react-icons/md';
import { useAuth } from '../context/AuthContext';

const PACKAGES = [
  { name: 'Pro',          price: 9999  },
  { name: 'Supreme',      price: 14999 },
  { name: 'Premium',      price: 19999 },
  { name: 'Premium Plus', price: 24999 },
];

const STATUS_COLORS = {
  new: 'blue', contacted: 'purple', interested: 'green',
  not_interested: 'red', nurturing: 'orange', converted: 'teal', lost: 'gray'
};
const STATUSES = ['new', 'contacted', 'interested', 'not_interested', 'nurturing', 'converted', 'lost'];
const WEBINAR_STATUSES = ['not_invited', 'invited', 'registered', 'attended', 'missed'];

// ─── Helper: days until next followup ────────────────────────────────────────
function daysToConnect(date) {
  if (!date) return null;
  const diff = differenceInCalendarDays(new Date(date), new Date());
  if (diff < 0)  return { text: `${Math.abs(diff)}d overdue`, cls: 'dtc-overdue' };
  if (diff === 0) return { text: 'Today',     cls: 'dtc-today' };
  if (diff === 1) return { text: 'Tomorrow',  cls: 'dtc-soon' };
  if (diff <= 7)  return { text: `${diff} days`, cls: 'dtc-soon' };
  return { text: `${diff} days`, cls: 'dtc-future' };
}

// ─── Lead Detail Modal ────────────────────────────────────────────────────────
function LeadDetailModal({ leadId, users, onClose, onEdit, onFollowup }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/leads/${leadId}`)
      .then(r => setLead(r.data.lead))
      .catch(() => toast.error('Failed to load lead'))
      .finally(() => setLoading(false));
  }, [leadId]);

  const dtc = lead?.nextFollowupDate ? daysToConnect(lead.nextFollowupDate) : null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal lead-detail-modal">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="loading-spinner" style={{ margin: '0 auto' }}></div></div>
        ) : lead ? (
          <>
            {/* Header */}
            <div className="ld-header">
              <div className="ld-avatar">{lead.name?.charAt(0).toUpperCase()}</div>
              <div className="ld-header-info">
                <h2 className="ld-name">{lead.name}</h2>
                <div className="ld-badges">
                  <span className={`status-badge ${STATUS_COLORS[lead.status] || 'gray'}`}>{lead.status?.replace('_', ' ')}</span>
                  <span className={`priority-badge ${lead.priority}`}>{lead.priority}</span>
                  {lead.product && <span className="ld-product-tag">{lead.product}</span>}
                </div>
              </div>
              <div className="ld-header-actions">
                <button className="btn-sm green" onClick={() => { onFollowup(lead); onClose(); }} title="Schedule Followup">
                  <MdSchedule /> Followup
                </button>
                <button className="btn-sm blue" onClick={() => { onEdit(lead); onClose(); }} title="Edit Lead">
                  <MdEdit /> Edit
                </button>
                <button className="modal-close" onClick={onClose}><MdClose /></button>
              </div>
            </div>

            <div className="ld-body">
              {/* Left column */}
              <div className="ld-left">
                {/* Contact */}
                <div className="ld-section">
                  <div className="ld-section-title"><MdPhone /> Contact Details</div>
                  <div className="ld-info-grid">
                    <div className="ld-info-row">
                      <span className="ld-label">Phone</span>
                      <span className="ld-value">
                        <a href={`tel:${lead.phone}`} className="call-link">{lead.phone}</a>
                        {lead.phone && (
                          <a href={`https://wa.me/91${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="wa-inline-btn" title="WhatsApp">
                            <MdWhatsapp />
                          </a>
                        )}
                      </span>
                    </div>
                    {lead.alternatePhone && (
                      <div className="ld-info-row">
                        <span className="ld-label">Alt Phone</span>
                        <span className="ld-value">{lead.alternatePhone}</span>
                      </div>
                    )}
                    {lead.email && (
                      <div className="ld-info-row">
                        <span className="ld-label">Email</span>
                        <span className="ld-value"><a href={`mailto:${lead.email}`} className="call-link">{lead.email}</a></span>
                      </div>
                    )}
                    {(lead.city || lead.state) && (
                      <div className="ld-info-row">
                        <span className="ld-label">Location</span>
                        <span className="ld-value">{[lead.city, lead.state].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lead Info */}
                <div className="ld-section">
                  <div className="ld-section-title"><MdTrendingUp /> Lead Info</div>
                  <div className="ld-info-grid">
                    <div className="ld-info-row">
                      <span className="ld-label">Source</span>
                      <span className="ld-value">{lead.source?.replace('_', ' ') || '—'}</span>
                    </div>
                    {lead.dealValue > 0 && (
                      <div className="ld-info-row">
                        <span className="ld-label">Deal Value</span>
                        <span className="ld-value ld-deal">₹{lead.dealValue?.toLocaleString()}</span>
                      </div>
                    )}
                    {lead.commission > 0 && (
                      <div className="ld-info-row">
                        <span className="ld-label">Commission</span>
                        <span className="ld-value">₹{lead.commission?.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="ld-info-row">
                      <span className="ld-label">Assigned To</span>
                      <span className="ld-value">{lead.assignedTo?.name || 'Unassigned'}</span>
                    </div>
                    <div className="ld-info-row">
                      <span className="ld-label">Call Count</span>
                      <span className="ld-value">{lead.callCount || 0} calls</span>
                    </div>
                    {lead.lastCalledAt && (
                      <div className="ld-info-row">
                        <span className="ld-label">Last Called</span>
                        <span className="ld-value">{format(new Date(lead.lastCalledAt), 'dd MMM yyyy')}</span>
                      </div>
                    )}
                    <div className="ld-info-row">
                      <span className="ld-label">Webinar</span>
                      <span className={`status-badge ${lead.webinarStatus === 'attended' ? 'green' : lead.webinarStatus === 'missed' ? 'red' : 'gray'}`}>
                        {lead.webinarStatus?.replace('_', ' ')}
                      </span>
                    </div>
                    {lead.tags?.length > 0 && (
                      <div className="ld-info-row">
                        <span className="ld-label">Tags</span>
                        <span className="ld-value ld-tags">{lead.tags.map(t => <span key={t} className="ld-tag">{t}</span>)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="ld-section">
                  <div className="ld-section-title"><MdCalendarToday /> Timeline</div>
                  <div className="ld-info-grid">
                    <div className="ld-info-row">
                      <span className="ld-label">Created</span>
                      <span className="ld-value">{format(new Date(lead.createdAt), 'dd MMM yyyy')}</span>
                    </div>
                    {lead.nextFollowupDate && (
                      <div className="ld-info-row">
                        <span className="ld-label">Next Connect</span>
                        <span className="ld-value">
                          {format(new Date(lead.nextFollowupDate), 'dd MMM yyyy, hh:mm a')}
                          {dtc && <span className={`dtc-badge ${dtc.cls}`}>{dtc.text}</span>}
                        </span>
                      </div>
                    )}
                    {lead.lastFollowupDate && (
                      <div className="ld-info-row">
                        <span className="ld-label">Last Followup</span>
                        <span className="ld-value">{format(new Date(lead.lastFollowupDate), 'dd MMM yyyy')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {lead.notes && (
                  <div className="ld-section">
                    <div className="ld-section-title"><MdNote /> Notes</div>
                    <p className="ld-notes">{lead.notes}</p>
                  </div>
                )}
              </div>

              {/* Right column — Remarks */}
              <div className="ld-right">
                <div className="ld-section" style={{ flex: 1 }}>
                  <div className="ld-section-title"><MdChat /> Remarks ({lead.remarks?.length || 0})</div>
                  {lead.latestRemark && (
                    <div className="ld-latest-remark">💬 {lead.latestRemark}</div>
                  )}
                  <div className="ld-remarks-list">
                    {(lead.remarks || []).length === 0 ? (
                      <div className="empty-state" style={{ padding: '24px 0' }}>No remarks yet</div>
                    ) : [...(lead.remarks || [])].reverse().map((r, i) => (
                      <div key={i} className="remark-item">
                        <div className="remark-header">
                          <span className="remark-author">{r.addedBy?.name || 'Unknown'}</span>
                          <span className="remark-time">{format(new Date(r.addedAt), 'dd MMM yy, hh:mm a')}</span>
                        </div>
                        <div className="remark-text">{r.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Lead not found</div>
        )}
      </div>
    </div>
  );
}

// ─── Lead Edit/Create Modal ───────────────────────────────────────────────────
function LeadModal({ lead, users, onClose, onSave }) {
  const { user } = useAuth();
  const isNew = !lead?._id;
  const [form, setForm] = useState({
    name: '', phone: '', alternatePhone: '', email: '', city: '', state: '',
    product: '', status: 'new', priority: 'medium', assignedTo: '',
    notes: '', webinarStatus: 'not_invited', dealValue: '', ...lead
  });
  useEffect(() => {
    if (!lead) return;
    setForm((current) => ({
      ...current,
      assignedTo: lead.assignedTo?._id || lead.assignedTo || ''
    }));
  }, [lead]);
  const [remarkText, setRemarkText] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('info');

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isNew) { await api.post('/leads', form); toast.success('Lead created!'); }
      else { await api.put(`/leads/${lead._id}`, form); toast.success('Lead updated!'); }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving lead');
    } finally { setLoading(false); }
  };

  const addRemark = async () => {
    if (!remarkText.trim() || !lead?._id) return;
    try {
      await api.post(`/leads/${lead._id}/remark`, { text: remarkText });
      setRemarkText('');
      toast.success('Remark added');
      onSave();
    } catch { toast.error('Failed to add remark'); }
  };

  const markWebinar = async (status) => {
    if (!lead?._id) return;
    try {
      await api.put(`/leads/${lead._id}/webinar`, { webinarStatus: status });
      toast.success('Webinar status updated');
      onSave();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal large">
        <div className="modal-header">
          <h2>{isNew ? 'Add New Lead' : `Edit Lead — ${lead?.name}`}</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <div className="modal-tabs">
          {['info', 'remarks'].map(t => (
            <button key={t} className={`modal-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <form onSubmit={handleSave}>
          {tab === 'info' && (
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label><MdPerson /> Full Name *</label>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter full name" /></div>
                <div className="form-group"><label><MdPhone /> Phone *</label>
                  <input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" /></div>
                <div className="form-group"><label><MdPhone /> Alternate Phone</label>
                  <input value={form.alternatePhone} onChange={e => setForm({ ...form, alternatePhone: e.target.value })} placeholder="Alternate number" /></div>
                <div className="form-group"><label><MdEmail /> Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email address" /></div>
                <div className="form-group"><label><MdLocationOn /> City</label>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City" /></div>
                <div className="form-group"><label><MdLocationOn /> State</label>
                  <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="State" /></div>
                <div className="form-group"><label>Product / Service</label>
                  <input value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="Product interest" /></div>
                <div className="form-group"><label>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select></div>
                <div className="form-group"><label>Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select></div>
                {user?.role !== 'member' && (
                  <div className="form-group"><label><MdAssignment /> Assign To</label>
                    <select value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })}>
                      <option value="">-- Unassigned --</option>
                      {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select></div>
                )}
                <div className="form-group full-width">
                  <label><MdCurrencyRupee /> Deal Value (₹)</label>
                  <div className="package-selector">
                    {PACKAGES.map(pkg => (
                      <button
                        type="button"
                        key={pkg.name}
                        className={`package-btn ${Number(form.dealValue) === pkg.price ? 'active' : ''}`}
                        onClick={() => setForm({ ...form, dealValue: pkg.price })}
                      >
                        <span className="pkg-name">{pkg.name}</span>
                        <span className="pkg-price">₹{pkg.price.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={form.dealValue}
                    onChange={e => setForm({ ...form, dealValue: e.target.value })}
                    placeholder="Or enter custom amount"
                    className="pkg-custom-input"
                  />
                </div>
                <div className="form-group full-width"><label><MdNote /> Notes</label>
                  <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." /></div>
              </div>
            </div>
          )}
          {tab === 'remarks' && !isNew && (
            <div className="modal-body">
              <div className="remarks-list">
                {(lead?.remarks || []).length === 0 && <div className="empty-state">No remarks yet</div>}
                {(lead?.remarks || []).map((r, i) => (
                  <div key={i} className="remark-item">
                    <div className="remark-header">
                      <span className="remark-author">{r.addedBy?.name || 'Unknown'}</span>
                      <span className="remark-time">{format(new Date(r.addedAt), 'dd MMM yyyy, hh:mm a')}</span>
                    </div>
                    <div className="remark-text">{r.text}</div>
                  </div>
                ))}
              </div>
              <div className="remark-input-row">
                <textarea value={remarkText} onChange={e => setRemarkText(e.target.value)} placeholder="Add a remark..." rows={2} />
                <button type="button" className="btn-primary" onClick={addRemark}>Add</button>
              </div>
            </div>
          )}
          {false && tab === 'webinar' && !isNew && (
            <div className="modal-body">
              <div className="webinar-status-section">
                <h4>Current Status: <span className={`status-badge ${lead?.webinarStatus}`}>{lead?.webinarStatus?.replace('_', ' ')}</span></h4>
                {lead?.webinarSeenAt && <p className="webinar-seen-time">Attended on: {format(new Date(lead.webinarSeenAt), 'dd MMM yyyy')}</p>}
                <div className="webinar-btn-group">
                  {WEBINAR_STATUSES.map(s => (
                    <button type="button" key={s} className={`webinar-mark-btn ${lead?.webinarStatus === s ? 'active' : ''} ${s === 'attended' ? 'green' : ''}`} onClick={() => markWebinar(s)}>
                      {s === 'attended' && '✓ '}{s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            {tab === 'info' && (
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <span className="btn-spinner"></span> : isNew ? 'Create Lead' : 'Save Changes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CSV / Sheet Import Modal ─────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = (line) => {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    result.push(cur.trim());
    return result;
  };
  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) };
}

function ImportModal({ onClose, onImport }) {
  const [tab, setTab] = useState('csv');
  const [sheetId, setSheetId] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  const handlePreview = async () => {
    if (!sheetId.trim()) return toast.error('Enter a Sheet ID');
    setLoading(true);
    try { const res = await api.get(`/sheets/preview?sheetId=${sheetId}`); setPreview(res.data.data); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to preview sheet'); }
    finally { setLoading(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/sheets/sync', { sheetId });
      toast.success(`Sync complete! Created: ${res.data.created}, Updated: ${res.data.updated}`);
      onImport();
    } catch (err) { toast.error(err.response?.data?.message || 'Sync failed'); }
    finally { setSyncing(false); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) return toast.error('Please select a CSV file');
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      if (parsed.headers.length === 0) return toast.error('CSV appears empty');
      setCsvData(parsed);
    };
    reader.readAsText(file);
  };

  const handleCSVUpload = async () => {
    if (!csvData) return toast.error('Please select a CSV file first');
    setUploading(true);
    try {
      const res = await api.post('/sheets/upload-csv', csvData);
      toast.success(`Import complete! Created: ${res.data.created}, Updated: ${res.data.updated}, Skipped: ${res.data.skipped}`);
      onImport();
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Import Leads</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <div className="import-tabs">
          <button className={`import-tab${tab === 'csv' ? ' active' : ''}`} onClick={() => setTab('csv')}><MdCloudUpload /> Upload CSV</button>
          <button className={`import-tab${tab === 'sheet' ? ' active' : ''}`} onClick={() => setTab('sheet')}><MdSync /> Google Sheet</button>
        </div>
        <div className="modal-body">
          {tab === 'csv' ? (
            <>
              <div className="import-info">
                <p>Upload a <strong>.csv</strong> file with your leads.</p>
                <p className="import-hint">Expected columns: Name, Phone, Alternate Phone, Email, City, State, Product, Notes</p>
              </div>
              <label className="csv-upload-area">
                <input type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
                <MdCloudUpload size={36} />
                <span>{csvFileName || 'Click to choose CSV file'}</span>
                {csvFileName && <span className="csv-file-name">{csvFileName}</span>}
              </label>
              {csvData && (
                <div className="preview-section">
                  <p><strong>{csvData.rows.length} rows</strong> found in file</p>
                  <div className="preview-table-wrap">
                    <table className="preview-table">
                      <thead><tr>{csvData.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                      <tbody>{csvData.rows.slice(0, 5).map((row, i) => (
                        <tr key={i}>{csvData.headers.map((_, j) => <td key={j}>{row[j] || '-'}</td>)}</tr>
                      ))}</tbody>
                    </table>
                    {csvData.rows.length > 5 && <p className="preview-more">…and {csvData.rows.length - 5} more rows</p>}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="import-info">
                <p>Enter your Google Sheet ID (the part from the URL between /d/ and /edit)</p>
                <p className="import-hint">Sheet columns expected: Name, Phone, Email, City, State, Product, Notes</p>
              </div>
              <div className="form-group">
                <label>Google Sheet ID</label>
                <input value={sheetId} onChange={e => setSheetId(e.target.value)} placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
              </div>
              <button onClick={handlePreview} className="btn-secondary" disabled={loading}>
                {loading ? <span className="btn-spinner"></span> : 'Preview Data'}
              </button>
              {preview && (
                <div className="preview-section">
                  <p><strong>{preview.totalRows} rows</strong> found in sheet</p>
                  <div className="preview-table-wrap">
                    <table className="preview-table">
                      <thead><tr>{preview.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                      <tbody>{preview.rows.map((row, i) => (
                        <tr key={i}>{preview.headers.map((_, j) => <td key={j}>{row[j] || '-'}</td>)}</tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          {tab === 'csv' ? (
            <button onClick={handleCSVUpload} className="btn-primary" disabled={uploading || !csvData}>
              <MdCloudUpload /> {uploading ? 'Uploading...' : `Upload ${csvData ? csvData.rows.length + ' Leads' : ''}`}
            </button>
          ) : (
            <button onClick={handleSync} className="btn-primary" disabled={syncing || !sheetId}>
              <MdSync /> {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Followup Schedule Modal ──────────────────────────────────────────────────
function FollowupScheduleModal({ lead, users, onClose, onSave }) {
  const [form, setForm] = useState({ scheduledDate: '', scheduledTime: '10:00', type: 'call', priority: 'medium', assignedTo: lead?.assignedTo?._id || '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/followups', {
        lead: lead._id,
        assignedTo: form.assignedTo || lead.assignedTo?._id,
        scheduledDate: new Date(`${form.scheduledDate}T${form.scheduledTime}:00`).toISOString(),
        type: form.type,
        priority: form.priority
      });
      toast.success('Followup scheduled!');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal small">
        <div className="modal-header">
          <h2>Schedule Followup — {lead?.name}</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group"><label>Date *</label>
                <input type="date" required value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} min={format(new Date(), 'yyyy-MM-dd')} /></div>
              <div className="form-group"><label>Time</label>
                <input type="time" value={form.scheduledTime} onChange={e => setForm({ ...form, scheduledTime: e.target.value })} /></div>
              <div className="form-group"><label>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="call">Call</option><option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option><option value="meeting">Meeting</option>
                  <option value="demo">Demo</option><option value="video_call">Video Call</option>
                </select></div>
              <div className="form-group"><label>Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select></div>
              <div className="form-group full-width"><label>Assign To</label>
                <select value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })}>
                  <option value="">Same as lead</option>
                  {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select></div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner"></span> : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Leads Page ──────────────────────────────────────────────────────────
export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', assignedTo: '', search: '', priority: '' });
  const [sortBy, setSortBy] = useState('followup_asc');
  const [followupFrom, setFollowupFrom] = useState('');
  const [followupTo, setFollowupTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [detailLeadId, setDetailLeadId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFollowup, setShowFollowup] = useState(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page, limit: 20,
        sortBy,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
        ...(followupFrom ? { followupFrom } : {}),
        ...(followupTo   ? { followupTo }   : {})
      });
      const res = await api.get(`/leads?${params}`);
      setLeads(res.data.leads);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load leads'); }
    finally { setLoading(false); }
  }, [page, filters, sortBy, followupFrom, followupTo]);

  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { api.get('/users?role=member').then(r => setUsers(r.data.users || [])); }, []);

  const deleteLead = async (id) => {
    if (!confirm('Delete this lead?')) return;
    try { await api.delete(`/leads/${id}`); toast.success('Lead deleted'); loadLeads(); }
    catch { toast.error('Failed to delete'); }
  };

  // Quick date presets
  const applyDatePreset = (preset) => {
    const now = new Date();
    if (preset === 'today') {
      setFollowupFrom(format(now, 'yyyy-MM-dd'));
      setFollowupTo(format(now, 'yyyy-MM-dd'));
    } else if (preset === 'week') {
      setFollowupFrom(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setFollowupTo(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (preset === 'month') {
      setFollowupFrom(format(startOfMonth(now), 'yyyy-MM-dd'));
      setFollowupTo(format(endOfMonth(now), 'yyyy-MM-dd'));
    } else {
      setFollowupFrom(''); setFollowupTo('');
    }
    setPage(1);
  };

  const clearDateFilter = () => { setFollowupFrom(''); setFollowupTo(''); setPage(1); };

  const pages = Math.ceil(total / 20);
  const hasDateFilter = followupFrom || followupTo;

  return (
    <div className="page leads-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">{total} total leads</p>
        </div>
        <div className="header-actions">
          {user?.role !== 'member' && (
            <button className="btn-secondary" onClick={() => setShowImport(true)}>
              <MdCloudUpload /> Import
            </button>
          )}
          <button className="btn-primary" onClick={() => { setSelectedLead(null); setShowModal(true); }}>
            <MdAdd /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <MdSearch />
          <input placeholder="Search by name, phone, email..." value={filters.search}
            onChange={e => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} />
        </div>
        <select value={filters.status} onChange={e => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={filters.priority} onChange={e => { setFilters({ ...filters, priority: e.target.value }); setPage(1); }}>
          <option value="">All Priority</option>
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        {user?.role !== 'member' && (
          <select value={filters.assignedTo} onChange={e => { setFilters({ ...filters, assignedTo: e.target.value }); setPage(1); }}>
            <option value="">All Candidates</option>
            {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        )}
        <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} className="sort-select" title="Sort by">
          <option value="followup_asc">📅 Followup ↑ (Soonest)</option>
          <option value="followup_desc">📅 Followup ↓ (Latest)</option>
          <option value="created_desc">🆕 Newest First</option>
          <option value="created_asc">🕐 Oldest First</option>
          <option value="name_asc">🔤 Name A→Z</option>
          <option value="deal_desc">💰 Deal Value ↓</option>
        </select>
        <button className={`btn-sm filter-date-btn ${hasDateFilter ? 'active' : ''}`} onClick={() => setShowDateFilter(v => !v)}>
          <MdCalendarToday /> {hasDateFilter ? 'Date Filter ●' : 'Date Filter'}
        </button>
      </div>

      {/* Date range filter panel */}
      {showDateFilter && (
        <div className="date-filter-panel">
          <div className="date-preset-btns">
            <button className="date-preset-btn" onClick={() => applyDatePreset('today')}>Today</button>
            <button className="date-preset-btn" onClick={() => applyDatePreset('week')}>This Week</button>
            <button className="date-preset-btn" onClick={() => applyDatePreset('month')}>This Month</button>
            {hasDateFilter && <button className="date-preset-btn clear" onClick={clearDateFilter}>Clear ✕</button>}
          </div>
          <div className="date-range-inputs">
            <label>Connect From</label>
            <input type="date" value={followupFrom} onChange={e => { setFollowupFrom(e.target.value); setPage(1); }} />
            <label>Connect To</label>
            <input type="date" value={followupTo} onChange={e => { setFollowupTo(e.target.value); setPage(1); }} />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card table-card">
        {loading ? (
          <div className="table-loader"><div className="loading-spinner"></div></div>
        ) : leads.length === 0 ? (
          <div className="empty-state">No leads found. Add your first lead or adjust your filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assigned To</th>
                  <th>Webinar</th>
                  <th>Connect On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const dtc = daysToConnect(lead.nextFollowupDate);
                  return (
                    <tr key={lead._id} className="lead-table-row" onClick={() => setDetailLeadId(lead._id)} style={{ cursor: 'pointer' }}>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="lead-cell" onClick={() => setDetailLeadId(lead._id)} style={{ cursor: 'pointer' }}>
                          <div className="lead-name-row">
                            <div className="lead-name-avatar">{lead.name?.charAt(0).toUpperCase()}</div>
                            <div>
                              <div className="lead-name">{lead.name}</div>
                              <div className="lead-email">{lead.product || lead.city || '-'}</div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="phone-cell">
                          <span>{lead.phone}</span>
                          <a href={`tel:${lead.phone}`} className="call-link" title="Call" onClick={e => e.stopPropagation()}><MdPhone /></a>
                        </div>
                      </td>
                      <td><span className={`status-badge ${STATUS_COLORS[lead.status] || 'gray'}`}>{lead.status?.replace('_', ' ')}</span></td>
                      <td><span className={`priority-badge ${lead.priority}`}>{lead.priority}</span></td>
                      <td>
                        {lead.assignedTo ? (
                          <div className="assigned-cell">
                            <div className="mini-avatar">{lead.assignedTo.name?.charAt(0)}</div>
                            <span>{lead.assignedTo.name}</span>
                          </div>
                        ) : <span className="unassigned">Unassigned</span>}
                      </td>
                      <td>
                        <span className={`webinar-badge ${lead.webinarStatus}`}>
                          {lead.webinarStatus === 'attended' ? '✅' : lead.webinarStatus === 'not_invited' ? '—' : '🔔'}
                          {' '}{lead.webinarStatus?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div className="connect-cell">
                          {lead.nextFollowupDate ? (
                            <>
                              <div className="connect-date">
                                {format(new Date(lead.nextFollowupDate), 'dd MMM yyyy')}
                                <span className="connect-time">{format(new Date(lead.nextFollowupDate), 'hh:mm a')}</span>
                              </div>
                              {dtc && <span className={`dtc-badge ${dtc.cls}`}>{dtc.text}</span>}
                            </>
                          ) : (
                            <span className="no-date">Not scheduled</span>
                          )}
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="action-btns">
                          <button title="View Details" className="action-btn" onClick={() => setDetailLeadId(lead._id)}><MdVisibility /></button>
                          <button title="Edit" className="action-btn blue" onClick={() => { setSelectedLead(lead); setShowModal(true); }}><MdEdit /></button>
                          <button title="Schedule Followup" className="action-btn green" onClick={() => setShowFollowup(lead)}><MdSchedule /></button>
                          {user?.role !== 'member' && (
                            <button title="Delete" className="action-btn red" onClick={() => deleteLead(lead._id)}><MdDelete /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="page-btn">Prev</button>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="page-btn">Next</button>
            <span className="page-info">Page {page} of {pages} &bull; {total} leads</span>
          </div>
        )}
      </div>

      {detailLeadId && (
        <LeadDetailModal
          leadId={detailLeadId}
          users={users}
          onClose={() => setDetailLeadId(null)}
          onEdit={(lead) => { setSelectedLead(lead); setShowModal(true); }}
          onFollowup={(lead) => setShowFollowup(lead)}
        />
      )}
      {showModal && <LeadModal lead={selectedLead} users={users} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadLeads(); }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={() => { setShowImport(false); loadLeads(); }} />}
      {showFollowup && <FollowupScheduleModal lead={showFollowup} users={users} onClose={() => setShowFollowup(null)} onSave={() => { setShowFollowup(null); loadLeads(); }} />}
    </div>
  );
}
