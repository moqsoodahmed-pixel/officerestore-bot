import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Card, Table, StatusBadge, Button, Pagination, Loading, ErrorMsg } from '../components/UI';

const STATUS_OPTIONS = ['', 'open', 'in_review', 'pending_customer', 'resolved', 'closed'];
const CATEGORY_OPTIONS = ['', 'damaged_item', 'wrong_item', 'missing_item', 'return_cancellation', 'warranty', 'invoice', 'delivery', 'payment', 'general_complaint', 'other'];

export default function Tickets() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
    api.getTickets(params)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  async function handleUpdate(ticketId, updates) {
    setSaving(true);
    try {
      await api.updateTicket(ticketId, updates);
      setSelected(null);
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: 'ticketId', label: 'Ticket', render: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
    { key: 'category', label: 'Category', render: (v) => (v || '').replace(/_/g, ' ') },
    { key: 'whatsappNumber', label: 'Customer' },
    { key: 'orderRef', label: 'Order Ref' },
    { key: 'summary', label: 'Summary', render: (v) => v ? v.substring(0, 50) + (v.length > 50 ? '…' : '') : '—' },
    { key: 'priority', label: 'Priority', render: (v) => {
      const colors = { low: '#4caf50', medium: '#ff9800', high: '#f44336', urgent: '#9c27b0' };
      return <span style={{ fontWeight: 700, color: colors[v] || '#555' }}>{v}</span>;
    }},
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'createdAt', label: 'Created', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
  ];

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, color: '#1a1a2e' }}>🎫 Support Tickets</h1>

      <div style={{
        background: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 8,
        padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#880e4f',
      }}>
        ⚠️ Do NOT promise refunds, replacements or pickups in tickets. All resolutions require team review under the applicable policy.
      </div>

      {error && <ErrorMsg message={error} />}

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13 }}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          <select value={filters.category} onChange={(e) => { setFilters((f) => ({ ...f, category: e.target.value })); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13 }}>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c ? c.replace(/_/g, ' ') : 'All Categories'}</option>)}
          </select>
          <Button size="sm" variant="secondary" onClick={load}>↻ Refresh</Button>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#999', lineHeight: '29px' }}>{data?.total ?? '—'} total</span>
        </div>

        {loading ? <Loading /> : (
          <>
            <Table columns={columns} rows={data?.tickets || []} onRowClick={setSelected} />
            <Pagination page={page} pages={data?.pages || 1} onPage={setPage} />
          </>
        )}
      </Card>

      {selected && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 420,
          background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
          padding: 28, overflowY: 'auto', zIndex: 100,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Ticket Detail</h2>
            <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>

          <Row label="Ticket" value={<code style={{ fontSize: 12 }}>{selected.ticketId}</code>} />
          <Row label="Status" value={<StatusBadge status={selected.status} />} />
          <Row label="Category" value={(selected.category || '').replace(/_/g, ' ')} />
          <Row label="Priority" value={selected.priority} />
          <Row label="Customer" value={selected.whatsappNumber} />
          <Row label="Order Ref" value={selected.orderRef} />
          <Row label="Product" value={selected.productName} />
          <Row label="Summary" value={selected.summary} />
          <Row label="Description" value={selected.description} />
          <Row label="Created" value={selected.createdAt ? new Date(selected.createdAt).toLocaleString('en-IN') : '—'} />

          {selected.timeline?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Timeline</div>
              {selected.timeline.map((t, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f5', fontSize: 12 }}>
                  <span style={{ color: '#888' }}>{new Date(t.at).toLocaleString('en-IN')}</span>
                  <span style={{ marginLeft: 8, fontWeight: 600 }}>{t.actor}</span>
                  <span style={{ marginLeft: 6, color: '#555' }}>{t.action}</span>
                  {t.note && <span style={{ marginLeft: 6, color: '#888' }}>— {t.note}</span>}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 8 }}>Update Status</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['in_review', 'pending_customer', 'resolved', 'closed'].map((s) => (
                <Button key={s} size="sm"
                  variant={selected.status === s ? 'primary' : 'secondary'}
                  disabled={saving}
                  onClick={() => handleUpdate(selected.ticketId, { status: s })}>
                  {s.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0f5' }}>
      <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#222', fontWeight: 500, maxWidth: '65%', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
