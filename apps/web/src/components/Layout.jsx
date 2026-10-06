import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/', label: '📊 Dashboard', end: true },
  { to: '/conversations', label: '💬 Conversations' },
  { to: '/leads', label: '🎯 Leads' },
  { to: '/quotes', label: '📄 Quotes' },
  { to: '/tickets', label: '🎫 Tickets' },
];

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220, background: '#1a1a2e', color: '#fff', padding: '24px 0',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #2d2d4e' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#25d366' }}>🪑 Officerestore</div>
          <div style={{ fontSize: 12, color: '#8888aa', marginTop: 4 }}>WhatsApp Bot Admin</div>
        </div>
        <div style={{ marginTop: 16 }}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              style={({ isActive }) => ({
                display: 'block', padding: '10px 20px',
                color: isActive ? '#25d366' : '#ccccee',
                textDecoration: 'none', fontSize: 14,
                background: isActive ? 'rgba(37,211,102,0.1)' : 'transparent',
                borderLeft: isActive ? '3px solid #25d366' : '3px solid transparent',
              })}>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, background: '#f5f6fa', padding: 32, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
