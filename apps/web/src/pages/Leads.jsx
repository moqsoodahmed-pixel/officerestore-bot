import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Card, Table, StatusBadge, Button, Pagination, Loading, ErrorMsg } from '../components/UI';

const STATUS_OPTIONS = ['', 'new', 'assigned', 'in_progress', 'quoted', 'converted', 'lost', 'cancelled'];
const TYPE_OPTIONS = ['', 'product_enquiry', 'bulk_office', 'quote_request', 'support', 'general'];

export default function Leads() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', leadType: '' });
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
    api.getLeads(params)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusUpdate(leadId, status) {
    setSaving(true);
    try {
      await api.updateLead(leadId, { status });
      setSelected(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: 'leadId', label: 'Lead ID', render: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
    { key: 'leadType', label: 'Type', render: (v) => (v || '').replace(/_/g, ' ') },
    { key: 'customerName', label: 'Customer', render: (v, row) => v || row.whatsappNumber },
    { key: 'companyName', label: 'Company' },
    { key: 'deliveryPin', label: 'PIN' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'createdAt', label: 'Created',
      render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—',
    },
  ];

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, color: '#1a1a2e' }}>🎯 Leads</h1>

      {error && <ErrorMsg message={error} />}

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13 }}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          <select value={filters.leadType} onChange={(e) => { setFilters((f) => ({ ...f, leadType: e.target.value })); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13 }}>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t || 'All Types'}</option>)}
          </select>
          <Button size="sm" variant="secondary" onClick={load}>↻ Refresh</Button>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#999', lineHeight: '29px' }}>
            {data?.total ?? '—'} total
          </span>
        </div>

        {loading ? <Loading /> : (
          <>
            <Table columns={columns} rows={data?.leads || []} onRowClick={setSelected} />
            <Pagination page={page} pages={data?.pages || 1} onPage={setPage} />
          </>
        )}
      </Card>

      {/* Detail panel */}
      {selected && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 'min(420px, 100vw)', boxSizing: 'border-box',
          background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
          padding: 28, overflowY: 'auto', zIndex: 100,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Lead Detail</h2>
            <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>

          <DetailRow label="Lead ID" value={<code style={{ fontSize: 12 }}>{selected.leadId}</code>} />
          <DetailRow label="Status" value={<StatusBadge status={selected.status} />} />
          <DetailRow label="Type" value={(selected.leadType || '').replace(/_/g, ' ')} />
          <DetailRow label="Customer" value={selected.customerName || selected.whatsappNumber} />
          <DetailRow label="Company" value={selected.companyName} />
          <DetailRow label="WhatsApp" value={selected.whatsappNumber} />
          <DetailRow label="Seats" value={selected.seats} />
          <DetailRow label="PIN Code" value={selected.deliveryPin} />
          <DetailRow label="City" value={selected.city} />
          <DetailRow label="Timeline" value={selected.timeline} />
          <DetailRow label="Budget" value={selected.budget} />
          <DetailRow label="Source" value={selected.source} />
          <DetailRow label="Created" value={selected.createdAt ? new Date(selected.createdAt).toLocaleString('en-IN') : '—'} />

          {selected.items?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 6 }}>Items Required</div>
              {selected.items.map((item, i) => (
                <div key={i} style={{ background: '#f8f9fc', borderRadius: 7, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                  {item.categoryLabel || item.productName}
                  {item.quantity && <span style={{ color: '#666', marginLeft: 8 }}>Qty: {item.quantity}</span>}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 8 }}>Update Status</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['assigned', 'in_progress', 'quoted', 'converted', 'lost'].map((s) => (
                <Button key={s} size="sm"
                  variant={selected.status === s ? 'primary' : 'secondary'}
                  disabled={saving}
                  onClick={() => handleStatusUpdate(selected.leadId, s)}>
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

function DetailRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0f5' }}>
      <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#222', fontWeight: 500, maxWidth: '60%', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
