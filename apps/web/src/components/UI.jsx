export function Card({ children, title, action }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: 24,
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 24,
    }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          {title && <h3 style={{ margin: 0, fontSize: 16, color: '#1a1a2e' }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, color = '#1a1a2e', sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const STATUS_COLORS = {
  // Lead statuses
  new: { bg: '#e3f2fd', color: '#1565c0' },
  assigned: { bg: '#fff3e0', color: '#e65100' },
  in_progress: { bg: '#f3e5f5', color: '#6a1b9a' },
  quoted: { bg: '#e8f5e9', color: '#2e7d32' },
  converted: { bg: '#c8e6c9', color: '#1b5e20' },
  lost: { bg: '#fce4ec', color: '#880e4f' },
  cancelled: { bg: '#eeeeee', color: '#616161' },
  // Quote statuses
  pending_review: { bg: '#fff8e1', color: '#f57f17' },
  in_review: { bg: '#e8eaf6', color: '#283593' },
  quote_sent: { bg: '#e0f7fa', color: '#006064' },
  accepted: { bg: '#e8f5e9', color: '#2e7d32' },
  rejected: { bg: '#fce4ec', color: '#880e4f' },
  expired: { bg: '#eeeeee', color: '#616161' },
  // Ticket statuses
  open: { bg: '#e3f2fd', color: '#1565c0' },
  in_review: { bg: '#f3e5f5', color: '#6a1b9a' },
  pending_customer: { bg: '#fff3e0', color: '#e65100' },
  resolved: { bg: '#e8f5e9', color: '#2e7d32' },
  closed: { bg: '#eeeeee', color: '#616161' },
  // Conversation owner
  BOT: { bg: '#e8f5e9', color: '#2e7d32' },
  HUMAN: { bg: '#fff3e0', color: '#e65100' },
  // Generic
  active: { bg: '#e8f5e9', color: '#2e7d32' },
  idle: { bg: '#eeeeee', color: '#616161' },
};

export function StatusBadge({ status }) {
  const style = STATUS_COLORS[status] || { bg: '#eeeeee', color: '#555' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: style.bg, color: style.color, display: 'inline-block',
    }}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  );
}

export function Table({ columns, rows, onRowClick }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8f9fc' }}>
            {columns.map((col) => (
              <th key={col.key} style={{
                padding: '10px 14px', textAlign: 'left', fontWeight: 600,
                color: '#555', borderBottom: '1px solid #e8e8ef', whiteSpace: 'nowrap',
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: '24px 14px', textAlign: 'center', color: '#999' }}>
                No records found
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={i}
              onClick={() => onRowClick && onRowClick(row)}
              style={{
                borderBottom: '1px solid #f0f0f5',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.background = '#f8f9fc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '10px 14px', color: '#333' }}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', size = 'md', disabled }) {
  const base = {
    border: 'none', borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, transition: 'opacity 0.15s', opacity: disabled ? 0.5 : 1,
    fontSize: size === 'sm' ? 12 : 14,
    padding: size === 'sm' ? '5px 12px' : '9px 18px',
  };
  const variants = {
    primary: { background: '#25d366', color: '#fff' },
    danger: { background: '#e53935', color: '#fff' },
    secondary: { background: '#e8e8ef', color: '#333' },
    outline: { background: 'transparent', color: '#25d366', border: '1px solid #25d366' },
  };
  return (
    <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
      <Button size="sm" variant="secondary" onClick={() => onPage(page - 1)} disabled={page <= 1}>← Prev</Button>
      <span style={{ lineHeight: '29px', fontSize: 13, color: '#555' }}>Page {page} of {pages}</span>
      <Button size="sm" variant="secondary" onClick={() => onPage(page + 1)} disabled={page >= pages}>Next →</Button>
    </div>
  );
}

export function Loading() {
  return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading...</div>;
}

export function ErrorMsg({ message }) {
  return (
    <div style={{ background: '#fce4ec', color: '#c62828', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
      ⚠️ {message}
    </div>
  );
}

export function useAsync(fn, deps = []) {
  const { useState, useEffect } = require('react');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fn()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, deps);

  return { data, loading, error, reload: () => fn().then(setData).catch((e) => setError(e.message)) };
}
