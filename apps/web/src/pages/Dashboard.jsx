import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { StatCard, Card, Loading, ErrorMsg } from '../components/UI';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, color: '#1a1a2e' }}>
        📊 Dashboard
      </h1>

      {error && <ErrorMsg message={error} />}

      {stats && (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <StatCard
              label="Total Conversations"
              value={stats.stats?.conversations?.total}
              color="#1565c0"
            />
            <StatCard
              label="Active Conversations"
              value={stats.stats?.conversations?.active}
              color="#25d366"
            />
            <StatCard
              label="Human-Owned"
              value={stats.stats?.conversations?.human}
              color="#e65100"
              sub="Awaiting agent response"
            />
            <StatCard
              label="Total Leads"
              value={stats.stats?.leads}
              color="#6a1b9a"
            />
            <StatCard
              label="Quote Requests"
              value={stats.stats?.quotes}
              color="#00695c"
            />
            <StatCard
              label="Support Tickets"
              value={stats.stats?.tickets}
              color="#c62828"
            />
            <StatCard
              label="Opt-Outs"
              value={stats.stats?.optOuts}
              color="#757575"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <Card title="Quick Links">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { href: '/conversations?owner=HUMAN', label: '👤 Human-Owned Conversations', color: '#e65100' },
                  { href: '/leads?status=new', label: '🆕 New Leads', color: '#1565c0' },
                  { href: '/quotes?status=pending_review', label: '📄 Quotes Pending Review', color: '#f57f17' },
                  { href: '/tickets?status=open', label: '🎫 Open Tickets', color: '#c62828' },
                ].map((l) => (
                  <a key={l.href} href={l.href} style={{
                    display: 'block', padding: '10px 14px', background: '#f8f9fc',
                    borderRadius: 8, color: l.color, textDecoration: 'none',
                    fontWeight: 600, fontSize: 14,
                  }}>
                    {l.label}
                  </a>
                ))}
              </div>
            </Card>

            <Card title="System Status">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'WhatsApp Bot', status: 'Operational', ok: true },
                  { label: 'MongoDB', status: 'Connected', ok: true },
                  { label: 'MSG91 Integration', status: 'Mock Mode (configure credentials)', ok: false },
                  { label: 'Catalogue Provider', status: 'Mock Mode (configure provider)', ok: false },
                ].map((s) => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#333' }}>{s.label}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                      background: s.ok ? '#e8f5e9' : '#fff8e1',
                      color: s.ok ? '#2e7d32' : '#f57f17',
                    }}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
