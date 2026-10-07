import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Card, Table, StatusBadge, Button, Pagination, Loading, ErrorMsg } from '../components/UI';

const STATUS_OPTIONS = ['', 'pending_review', 'in_review', 'quote_sent', 'accepted', 'rejected', 'expired', 'cancelled'];

export default function Quotes() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '' });
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
    api.getQuotes(params)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusUpdate(quoteId, updates) {
    setSaving(true);
    try {
      await api.updateQuote(quoteId, updates);
      setSelected(null);
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: 'quoteId', label: 'Quote ID', render: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
    { key: 'customerName', label: 'Customer', render: (v, row) => v || row.whatsappNumber },
    { key: 'companyName', label: 'Company' },
    {
      key: 'items', label: 'Items',
      render: (v) => v?.length > 0 ? `${v.length} item(s)` : '—',
    },
    { key: 'deliveryPin', label: 'PIN' },
    { key: 'billingType', label: 'Billing', render: (v) => v === 'business' ? '🏢 Business' : '👤 Individual' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'createdAt', label: 'Received',
      render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—',
    },
  ];

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, color: '#1a1a2e' }}>📄 Quote Requests</h1>

      <div style={{
        background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8,
        padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#7a5100',
      }}>
        ⚠️ Quotes require review by the authorized team. Prices and stock are not confirmed until validated.
        Never promise pricing or availability before team sign-off.
      </div>

      {error && <ErrorMsg message={error} />}

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={filters.status} onChange={(e) => { setFilters({ status: e.target.value }); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13 }}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          <Button size="sm" variant="secondary" onClick={load}>↻ Refresh</Button>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#999', lineHeight: '29px' }}>
            {data?.total ?? '—'} total
          </span>
        </div>

        {loading ? <Loading /> : (
          <>
            <Table columns={columns} rows={data?.quotes || []} onRowClick={setSelected} />
            <Pagination page={page} pages={data?.pages || 1} onPage={setPage} />
          </>
        )}
      </Card>

      {selected && (
        <div style={{position: 'fixed', right: 0, top: 0, bottom: 0, width: 'min(480px, 100vw)', boxSizing: 'border-box',
          
          background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
          padding: 28, overflowY: 'auto', zIndex: 100,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Quote Request</h2>
            <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>

          <DetailRow label="Quote ID" value={<code style={{ fontSize: 12 }}>{selected.quoteId}</code>} />
          <DetailRow label="Status" value={<StatusBadge status={selected.status} />} />
          <DetailRow label="Customer" value={selected.customerName || selected.whatsappNumber} />
          <DetailRow label="Company" value={selected.companyName} />
          <DetailRow label="WhatsApp" value={selected.whatsappNumber} />
          <DetailRow label="Billing" value={selected.billingType === 'business' ? 'Business / GST' : 'Individual'} />
          <DetailRow label="Delivery PIN" value={selected.deliveryPin} />
          <DetailRow label="Required By" value={selected.requiredByDate} />
          <DetailRow label="Source" value={selected.source} />
          <DetailRow label="Received" value={selected.createdAt ? new Date(selected.createdAt).toLocaleString('en-IN') : '—'} />

          {selected.items?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>📋 Line Items</div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fc' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#555' }}>#</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#555' }}>Product</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#555' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f5' }}>
                      <td style={{ padding: '6px 10px', color: '#888' }}>{item.lineNumber || i + 1}</td>
                      <td style={{ padding: '6px 10px' }}>{item.productName || item.categoryLabel || '—'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 20, background: '#fff8e1', borderRadius: 8, padding: 12, fontSize: 12, color: '#7a5100' }}>
            ⚠️ Prices are set by the sales team after review. Do not promise pricing before the formal quote is approved.
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 8 }}>Update Status</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['in_review', 'quote_sent', 'accepted', 'rejected'].map((s) => (
                <Button key={s} size="sm"
                  variant={selected.status === s ? 'primary' : 'secondary'}
                  disabled={saving}
                  onClick={() => handleStatusUpdate(selected.quoteId, { status: s })}>
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
