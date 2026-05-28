import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

/* ── small helpers ── */
const Stars = ({ n = 5 }) => '★'.repeat(n);

const faqs = [
  { q: 'What is Dashneem and who is it for?', a: 'Dashneem is a full-stack Lead Management CRM built for sales teams of all sizes. Whether you are a solo founder tracking 50 leads or a 20-person sales team managing thousands of prospects, Dashneem gives you a single place to capture, nurture, and convert every lead.' },
  { q: 'How does the Google Sheets import work?', a: 'Connect your Google Sheet once using a Service Account. Dashneem auto-syncs every 5 minutes — new rows become new leads, updated rows update existing records. No manual CSV exports ever again.' },
  { q: 'Can I assign leads to specific team members?', a: 'Yes. Admins and Managers can assign any lead to any active team member. Each member sees only their assigned leads, while managers have a full team view with performance metrics and earnings tracking.' },
  { q: 'What is the Follow-up system?', a: 'Every lead can have a scheduled follow-up call. Dashneem surfaces "Today\'s Follow-ups" each morning, alerts you about missed calls, and lets you log outcomes (interested, not interested, callback, converted) with a single click.' },
  { q: 'Does Dashneem support role-based access?', a: 'Absolutely. There are three roles — Admin, Manager, and Member. Admins control everything. Managers can view team performance and reassign leads. Members see only their own pipeline.' },
  { q: 'Is my data secure?', a: 'All API routes are protected with JWT authentication. Passwords are hashed with bcryptjs. You can deploy to your own MongoDB Atlas cluster for full data ownership, or use our in-memory mode for demos.' },
  { q: 'How do I get started for free?', a: 'Clone the repo, run npm install, set USE_IN_MEMORY_DB=true and SEED_DEMO_DATA=true in your .env, then npm run dev. You will have a fully working demo with sample leads and team data in under 2 minutes.' },
];

const integrations = [
  { icon: '📊', name: 'Google Sheets' },
  { icon: '💬', name: 'WhatsApp' },
  { icon: '📘', name: 'Facebook Ads' },
  { icon: '⚡', name: 'Zapier' },
  { icon: '📸', name: 'Instagram' },
  { icon: '🔗', name: 'Webhooks' },
  { icon: '📧', name: 'Gmail' },
  { icon: '🎯', name: 'HubSpot' },
  { icon: '📦', name: 'Wix' },
  { icon: '🛒', name: 'Shopify' },
  { icon: '🤖', name: 'IFTTT' },
  { icon: '📝', name: 'Google Forms' },
];

const features = [
  {
    icon: '📞',
    color: '#e8f0ea',
    title: 'Smart Calling List',
    desc: 'Start every morning with an auto-generated calling list. Prioritise hot leads, track call outcomes in one tap, and never lose a prospect again.',
  },
  {
    icon: '🎯',
    color: '#fff4de',
    title: 'Lead Management',
    desc: 'Full CRUD with filters, bulk actions, priority flags, status pipeline (New → Contacted → Interested → Converted), and smart search across all fields.',
  },
  {
    icon: '📅',
    color: '#e0f7f4',
    title: 'Follow-up System',
    desc: 'Schedule follow-ups, get missed-call alerts, and log outcomes instantly. The dashboard shows overdue and upcoming follow-ups so nothing slips through.',
  },
  {
    icon: '👥',
    color: '#e7f0ff',
    title: 'Team Management',
    desc: 'Assign leads to team members, track individual performance, monitor call volumes, and calculate earnings — all from one management view.',
  },
  {
    icon: '🎓',
    color: '#fdf1dc',
    title: 'Webinar Tracking',
    desc: 'Create webinars, invite leads, and track attendance. Mark each lead as Seen or Not Seen with a single click and follow up automatically.',
  },
  {
    icon: '📈',
    color: '#eefbf3',
    title: 'Analytics & Reports',
    desc: 'Live dashboard charts, growth trends, team leaderboards, and conversion funnels. Understand your pipeline health at a glance every morning.',
  },
];

const testimonials = [
  {
    stars: 5,
    text: '"Dashneem transformed how our sales team operates. The follow-up alerts alone saved us from missing 40+ calls every week. Conversion rate jumped by 3x in the first month."',
    name: 'Rahul Mehta',
    role: 'Sales Head, EduTech Startup',
    initial: 'R',
  },
  {
    stars: 5,
    text: '"The Google Sheets sync is a game-changer. Our marketing team drops leads into a Sheet and the sales team sees them in Dashneem within minutes — zero manual work."',
    name: 'Priya Sharma',
    role: 'Co-founder, FinServ Company',
    initial: 'P',
  },
  {
    stars: 5,
    text: '"We evaluated 5 CRM tools. Dashneem was the only one that fit our exact telecalling workflow without any customisation. Setup was done in a single afternoon."',
    name: 'Ankit Joshi',
    role: 'Operations Manager, Real Estate Firm',
    initial: 'A',
  },
];

const stories = [
  {
    bg: '#e8f0ea',
    emoji: '🏢',
    stat: '3.4×',
    desc: 'An EdTech firm increased lead-to-enrolment conversion by 3.4× after switching from spreadsheets to Dashneem\'s structured pipeline and follow-up alerts.',
    source: 'EdTech — 12-person sales team',
  },
  {
    bg: '#e0f7f4',
    emoji: '📊',
    stat: '68%',
    desc: 'A financial advisory company reduced missed follow-ups by 68% in 30 days using Dashneem\'s daily calling list and automated overdue alerts.',
    source: 'FinServ — 5-person team',
  },
  {
    bg: '#fff4de',
    emoji: '🚀',
    stat: '2 min',
    desc: 'A real-estate agency onboarded their entire team and imported 1,200 leads from Google Sheets in under 2 minutes on day one.',
    source: 'Real Estate — 8-person team',
  },
];

/* ── FAQ Item ── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lp-faq-item ${open ? 'open' : ''}`}>
      <div className="lp-faq-question" onClick={() => setOpen(o => !o)}>
        {q}
        <span className="lp-faq-chevron">▾</span>
      </div>
      <div className="lp-faq-answer">{a}</div>
    </div>
  );
}

/* ── Main Component ── */
export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', team: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleDemo = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
    setForm({ name: '', company: '', email: '', phone: '', team: '' });
  };

  const chartBars = [40, 55, 35, 70, 60, 85, 75, 90, 65, 95, 80, 100];

  return (
    <div className="landing">

      {/* ── NAVBAR ── */}
      <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="lp-container">
          <div className="lp-nav-inner">
            <div className="lp-logo">
              <div className="lp-logo-icon">D</div>
              Dashneem
            </div>
            <div className="lp-nav-links">
              <a href="#features">Features</a>
              <a href="#integrations">Integrations</a>
              <a href="#testimonials">Testimonials</a>
              <a href="#faq">FAQ</a>
              <a href="#demo">Pricing</a>
            </div>
            <div className="lp-nav-actions">
              <a className="lp-nav-login" onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>Login</a>
              <a className="lp-btn-primary" href="#demo" style={{ cursor: 'pointer' }}>REQUEST DEMO</a>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-inner">
            <div className="lp-hero-content">
              <div className="lp-hero-tag">
                <span>NEW</span>
                Google Sheets Sync is now live
              </div>
              <h1 className="lp-hero-title">
                The only Lead Management CRM your <em>sales team</em> will ever need.
              </h1>
              <p className="lp-hero-sub">
                Capture, assign, nurture, and convert leads — with built-in telecalling, follow-up alerts,
                team performance tracking, and Google Sheets integration. Everything in one place.
              </p>
              <div className="lp-hero-actions">
                <a className="lp-btn-primary" href="#demo">REQUEST DEMO</a>
                <a className="lp-btn-white" onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>Login to Dashboard →</a>
              </div>
              <div className="lp-hero-note">✓ Free to self-host &nbsp;·&nbsp; ✓ No credit card needed &nbsp;·&nbsp; ✓ Setup in 2 minutes</div>
            </div>

            <div className="lp-hero-img">
              <div className="lp-hero-mockup">
                <div className="lp-hero-mockup-bar">
                  <span /><span /><span />
                </div>
                <div className="lp-hero-dashboard">
                  <div className="lp-hero-dash-header">
                    <span>⚡</span>
                    <span>Dashneem Dashboard</span>
                  </div>
                  <div className="lp-hero-dash-body">
                    <div className="lp-hero-stats">
                      {[['247', 'Total Leads'], ['38', "Today's Calls"], ['12', 'Converted'], ['94%', 'Follow-ups']].map(([n, l]) => (
                        <div className="lp-hero-stat" key={l}>
                          <div className="lp-hero-stat-num">{n}</div>
                          <div className="lp-hero-stat-label">{l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="lp-hero-chart">
                      {chartBars.map((h, i) => (
                        <div key={i} className="lp-chart-bar" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CLIENTS ── */}
      <section className="lp-clients">
        <div className="lp-container">
          <p className="lp-clients-title">Trusted by growing sales teams</p>
          <div className="lp-clients-logos">
            {['NovaSales', 'GrowthEdge', 'SyncCRM', 'LeapForce', 'PrimeLeads', 'SalesNest', 'ConvertIQ'].map(name => (
              <span className="lp-client-logo" key={name}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY LEADPRO ── */}
      <section className="lp-why">
        <div className="lp-container">
          <div className="lp-why-inner">
            <div>
              <span className="lp-section-tag">Why Dashneem</span>
              <h2 className="lp-section-title">Built for sales teams who refuse to lose leads</h2>
              <p className="lp-section-sub">
                Most CRMs are bloated, expensive, and built for enterprise teams with 6-month onboarding.
                Dashneem is lean, fast, and opinionated — designed for telecalling sales teams who need
                clarity, speed, and zero missed follow-ups.
              </p>
              <div className="lp-why-stats">
                {[['3×', 'Higher conversion rate vs spreadsheets'], ['68%', 'Fewer missed follow-ups'], ['2 min', 'Average setup time'], ['100%', 'Role-based data access']].map(([n, l]) => (
                  <div className="lp-why-stat" key={n}>
                    <div className="lp-why-stat-num">{n}</div>
                    <div className="lp-why-stat-label">{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-why-visual">
              <div className="lp-why-visual-header">
                <h4>Lead Pipeline — This Week</h4>
                <span className="lp-why-visual-badge">↑ 24% growth</span>
              </div>
              <div className="lp-pipeline">
                {[
                  { label: 'New Leads', pct: 100, color: '#1A6340', val: '84' },
                  { label: 'Contacted', pct: 72, color: '#3B82F6', val: '61' },
                  { label: 'Interested', pct: 50, color: '#F5B800', val: '42' },
                  { label: 'Nurturing', pct: 30, color: '#F97316', val: '25' },
                  { label: 'Converted', pct: 18, color: '#22C55E', val: '15' },
                ].map(r => (
                  <div className="lp-pipeline-row" key={r.label}>
                    <span className="lp-pipeline-label">{r.label}</span>
                    <div className="lp-pipeline-bar-wrap">
                      <div className="lp-pipeline-bar" style={{ width: `${r.pct}%`, background: r.color }} />
                    </div>
                    <span className="lp-pipeline-val">{r.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-features" id="features">
        <div className="lp-container">
          <div className="lp-features-header">
            <span className="lp-section-tag">Features</span>
            <h2 className="lp-section-title">Everything your sales team needs. Nothing they don't.</h2>
            <p className="lp-section-sub" style={{ margin: '0 auto' }}>
              From the first touchpoint to the final conversion, Dashneem handles every step
              of your sales workflow without the complexity.
            </p>
          </div>
          <div className="lp-features-grid">
            {features.map(f => (
              <div className="lp-feature-card" key={f.title}>
                <div className="lp-feature-icon" style={{ background: f.color }}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <span className="lp-feature-link">Learn more →</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS ── */}
      <section className="lp-integrations" id="integrations">
        <div className="lp-container">
          <div className="lp-integrations-header">
            <span className="lp-section-tag">Integrations</span>
            <h2 className="lp-section-title">Connects with the tools you already use</h2>
            <p className="lp-section-sub" style={{ margin: '0 auto' }}>
              Dashneem plugs into your existing stack so you don't have to change how you work —
              just work smarter.
            </p>
          </div>
          <div className="lp-integrations-grid">
            {integrations.map(i => (
              <div className="lp-integration-tile" key={i.name}>
                <span className="lp-integration-icon">{i.icon}</span>
                <span className="lp-integration-name">{i.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL BANNER ── */}
      <section className="lp-testimonial-banner">
        <div className="lp-container">
          <div className="lp-testimonial-banner-inner">
            <div className="lp-testimonial-rating-box">
              <div className="lp-rating-num">4.9</div>
              <div className="lp-rating-stars"><Stars /></div>
              <div className="lp-rating-label">Average rating from 200+ teams</div>
            </div>
            <div>
              <div className="lp-testimonial-stars"><Stars /></div>
              <p className="lp-testimonial-quote">
                "We tried three different CRMs before Dashneem. Nothing else handled our telecalling workflow
                as cleanly. The daily calling list and missed follow-up alerts are genuinely life-changing
                for a small sales team."
              </p>
              <div className="lp-testimonial-author">
                <div className="lp-testimonial-avatar">S</div>
                <div className="lp-testimonial-author-info">
                  <strong>Sanjay Kapoor</strong>
                  <span>Founder, InsureBetter — Mumbai</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="lp-benefits">
        <div className="lp-container">
          <div className="lp-benefits-header">
            <span className="lp-section-tag">Benefits</span>
            <h2 className="lp-section-title">Why 200+ teams switched to Dashneem</h2>
          </div>
          <div className="lp-benefits-grid">
            {[
              { icon: '⚡', title: 'Zero Setup Friction', desc: 'Import your existing leads from Google Sheets and have your team calling within the first hour.' },
              { icon: '🔔', title: 'Never Miss a Follow-up', desc: 'Smart alerts surface overdue follow-ups every morning so no lead ever goes cold again.' },
              { icon: '📊', title: 'Real-time Visibility', desc: 'Managers get a live view of team activity, conversion rates, and pipeline health — no manual reports.' },
              { icon: '🔒', title: 'Enterprise-grade Security', desc: 'JWT auth, bcrypt password hashing, role-based access control, and full data ownership.' },
            ].map(b => (
              <div className="lp-benefit-card" key={b.title}>
                <div className="lp-benefit-icon">{b.icon}</div>
                <h4>{b.title}</h4>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS GRID ── */}
      <section className="lp-testimonials" id="testimonials">
        <div className="lp-container">
          <div className="lp-testimonials-header">
            <span className="lp-section-tag">Testimonials</span>
            <h2 className="lp-section-title">Real results from real sales teams</h2>
          </div>
          <div className="lp-testimonials-grid">
            {testimonials.map(t => (
              <div className="lp-testi-card" key={t.name}>
                <div className="lp-testi-stars"><Stars n={t.stars} /></div>
                <p className="lp-testi-text">{t.text}</p>
                <div className="lp-testi-author">
                  <div className="lp-testi-avatar">{t.initial}</div>
                  <div className="lp-testi-author-info">
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CUSTOMER STORIES ── */}
      <section className="lp-stories">
        <div className="lp-container">
          <div className="lp-stories-header">
            <span className="lp-section-tag">Customer Stories</span>
            <h2 className="lp-section-title">The numbers speak for themselves</h2>
          </div>
          <div className="lp-stories-grid">
            {stories.map(s => (
              <div className="lp-story-card" key={s.stat}>
                <div className="lp-story-img" style={{ background: s.bg }}>{s.emoji}</div>
                <div className="lp-story-body">
                  <div className="lp-story-stat">{s.stat}</div>
                  <p className="lp-story-desc">{s.desc}</p>
                  <span className="lp-story-source">— {s.source}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY ── */}
      <section className="lp-security">
        <div className="lp-container">
          <div className="lp-security-header">
            <span className="lp-section-tag">Security</span>
            <h2 className="lp-section-title">Your data, fully protected</h2>
          </div>
          <div className="lp-security-grid">
            {[
              { icon: '🔐', title: 'JWT Authentication', desc: 'Every API request is verified with a signed JWT token. Sessions expire automatically.' },
              { icon: '🛡️', title: 'Role-Based Access', desc: 'Admins, Managers, and Members each see only the data their role permits.' },
              { icon: '🔑', title: 'Encrypted Passwords', desc: 'All passwords are hashed with bcryptjs — plain text is never stored or transmitted.' },
              { icon: '☁️', title: 'Self-Hostable', desc: 'Deploy on your own server with your own MongoDB Atlas cluster for complete data ownership.' },
            ].map(s => (
              <div className="lp-security-item" key={s.title}>
                <div className="lp-security-icon">{s.icon}</div>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA / DEMO FORM ── */}
      <section className="lp-cta" id="demo">
        <div className="lp-container">
          <div className="lp-cta-inner">
            <div className="lp-cta-content">
              <span className="lp-section-tag">Get Started</span>
              <h2>Think your current system is good enough? It could be great.</h2>
              <p>
                Most sales teams are losing 30–40% of their leads to poor follow-up and missed calls.
                Dashneem fixes that in day one. Request a free personalised demo and see the difference.
              </p>
              <div className="lp-cta-bullets">
                {[
                  'Full walkthrough of your team\'s workflow',
                  'Live import of your existing lead data',
                  'Custom setup for your team size and role structure',
                  'No commitment — free, no credit card',
                ].map(b => (
                  <div className="lp-cta-bullet" key={b}>
                    <span>✓</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-form-card">
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 48 }}>🎉</div>
                  <h3 style={{ marginTop: 16, marginBottom: 8 }}>Demo Requested!</h3>
                  <p>We'll reach out within 24 hours to schedule your session.</p>
                </div>
              ) : (
                <form onSubmit={handleDemo}>
                  <h3>Request a Free Demo</h3>
                  <p>Fill in your details and we'll set it up within 24 hours.</p>
                  <div className="lp-form-row">
                    <div className="lp-form-group">
                      <label>Your Name *</label>
                      <input required placeholder="Rahul Mehta" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="lp-form-group">
                      <label>Company *</label>
                      <input required placeholder="Acme Sales Inc." value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
                    </div>
                  </div>
                  <div className="lp-form-row">
                    <div className="lp-form-group">
                      <label>Work Email *</label>
                      <input required type="email" placeholder="rahul@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="lp-form-group">
                      <label>Phone Number</label>
                      <input placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="lp-form-group">
                    <label>Team Size</label>
                    <select value={form.team} onChange={e => setForm({ ...form, team: e.target.value })}>
                      <option value="">Select team size</option>
                      <option>1–5 people</option>
                      <option>6–15 people</option>
                      <option>16–50 people</option>
                      <option>50+ people</option>
                    </select>
                  </div>
                  <button type="submit" className="lp-form-submit">REQUEST FREE DEMO →</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-faq" id="faq">
        <div className="lp-container">
          <div className="lp-faq-header">
            <span className="lp-section-tag">FAQs</span>
            <h2 className="lp-section-title">Frequently Asked Questions</h2>
            <p className="lp-section-sub" style={{ margin: '0 auto' }}>
              Everything you need to know about Dashneem. Can't find your answer?
              Request a demo and we'll answer in person.
            </p>
          </div>
          <div className="lp-faq-list">
            {faqs.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <div className="lp-footer-logo">
                <div className="lp-footer-logo-icon">D</div>
                <span>Dashneem</span>
              </div>
              <p>The complete Lead Management CRM for modern sales teams. Capture, nurture, and convert every lead — without the complexity.</p>
              <div className="lp-footer-socials">
                {['𝕏', 'in', 'fb', 'yt'].map(s => (
                  <div className="lp-social-btn" key={s}>{s}</div>
                ))}
              </div>
            </div>
            <div className="lp-footer-col">
              <h5>Product</h5>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#integrations">Integrations</a></li>
                <li><a href="#demo">Pricing</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <h5>Use Cases</h5>
              <ul>
                <li><a href="#">EdTech Sales</a></li>
                <li><a href="#">Real Estate</a></li>
                <li><a href="#">Insurance</a></li>
                <li><a href="#">Finance</a></li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <h5>Company</h5>
              <ul>
                <li><a href="#">About Us</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <h5>Legal</h5>
              <ul>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
                <li><a href="#">Cookie Policy</a></li>
                <li><a href="#">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2025 Dashneem. All rights reserved. Built with MERN Stack.</span>
            <div>
              <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }}>Login</a>
              <a href="#demo">Request Demo</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
