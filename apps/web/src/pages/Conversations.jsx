import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Card, Table, StatusBadge, Button, Pagination, Loading, ErrorMsg } from '../components/UI';

export default function Conversations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [sendText, setSendText] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (ownerFilter) params.owner = ownerFilter;
    if (statusFilter) params.status = statusFilter;
    api.getConversations(params)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, ownerFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleTakeover(convId) {
    setActionLoading(true);
    try {
      await api.takeoverConversation(convId, 'admin');
      load();
      setSelected((s) => s ? { ...s, owner: 'HUMAN' } : s);
    } catch (e) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleRelease(convId) {
    setActionLoading(true);
    try {
      await api.releaseConversation(convId);
      load();
      setSelected((s) => s ? { ...s, owner: 'BOT' } : s);
    } catch (e) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleSendMessage(to) {
    if (!sendText.trim()) return;
    setActionLoading(true);
    try {
      await api.sendMessage(to, sendText.trim());
      setSendText('');
      alert('Message sent!');
    } catch (e) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  const columns = [
    { key: 'whatsappNumber', label: 'WhatsApp Number' },
    {
      key: 'currentFlow', label: 'Current Flow',
      render: (v) => <code style={{ fontSize: 12 }}>{v || 'idle'}</code>,
    },
    {
      key: 'currentStep', label: 'Step',
      render: (v) => <code style={{ fontSize: 12 }}>{v || '—'}</code>,
    },
    {
      key: 'owner', label: 'Owner',
      render: (v) => <StatusBadge status={v || 'BOT'} />,
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'selectedItems', label: 'Selection',
      render: (v) => v?.length > 0 ? `${v.length} item(s)` : '—',
    },
    {
      key: 'lastMessageAt', label: 'Last Message',
      render: (v) => v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—',
    },
  ];

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, color: '#1a1a2e' }}>💬 Conversations</h1>

      <div style={{
        background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8,
        padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#1b5e20',
      }}>
        ✅ When you take over a conversation, the bot stops auto-replying. Release it to return control to the bot.
      </div>

      {error && <ErrorMsg message={error} />}

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={ownerFilter} onChange={(e) => { setOwnerFilter(e.target.value); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13 }}>
            <option value="">All Owners</option>
            <option value="BOT">🤖 Bot</option>
            <option value="HUMAN">👤 Human</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13 }}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="timed_out">Timed Out</option>
            <option value="opted_out">Opted Out</option>
          </select>
          <Button size="sm" variant="secondary" onClick={load}>↻ Refresh</Button>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#999', lineHeight: '29px' }}>{data?.total ?? '—'} total</span>
        </div>

        {loading ? <Loading /> : (
          <>
            <Table columns={columns} rows={data?.conversations || []} onRowClick={setSelected} />
            <Pagination page={page} pages={Math.ceil((data?.total || 0) / 20)} onPage={setPage} />
          </>
        )}
      </Card>

      {selected && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 440,
          background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
          padding: 28, overflowY: 'auto', zIndex: 100,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Conversation</h2>
            <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>

          <Row label="WhatsApp" value={selected.whatsappNumber} />
          <Row label="Owner" value={<StatusBadge status={selected.owner || 'BOT'} />} />
          <Row label="Status" value={<StatusBadge status={selected.status} />} />
          <Row label="Current Flow" value={<code style={{ fontSize: 12 }}>{selected.currentFlow}</code>} />
          <Row label="Current Step" value={<code style={{ fontSize: 12 }}>{selected.currentStep}</code>} />
          <Row label="Last Message" value={selected.lastMessageAt ? new Date(selected.lastMessageAt).toLocaleString('en-IN') : '—'} />

          {selected.selectedItems?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Current Selection</div>
              {selected.selectedItems.map((item, i) => (
                <div key={i} style={{ background: '#f8f9fc', borderRadius: 6, padding: '6px 10px', marginBottom: 4, fontSize: 13 }}>
                  {item.categoryLabel}
                  {item.quantity && <span style={{ color: '#666', marginLeft: 8 }}>Qty: {item.quantity}</span>}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            {selected.owner !== 'HUMAN' ? (
              <Button onClick={() => handleTakeover(selected._id)} disabled={actionLoading} variant="outline">
                👤 Take Over
              </Button>
            ) : (
              <Button onClick={() => handleRelease(selected._id)} disabled={actionLoading} variant="primary">
                🤖 Release to Bot
              </Button>
            )}
          </div>

          {selected.owner === 'HUMAN' && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Send Message</div>
              <textarea
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                placeholder="Type your message as agent..."
                style={{
                  width: '100%', minHeight: 80, padding: 10, borderRadius: 7,
                  border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', resize: 'vertical',
                }}
              />
              <Button onClick={() => handleSendMessage(selected.whatsappNumber)} disabled={actionLoading || !sendText.trim()} style={{ marginTop: 8 }}>
                Send Message
              </Button>
            </div>
          )}
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
      <span style={{ fontSize: 13, color: '#222', fontWeight: 500, maxWidth: '65%', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
