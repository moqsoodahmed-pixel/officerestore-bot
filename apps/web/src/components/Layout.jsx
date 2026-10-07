import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { clearAdminKey } from '../services/api';

const NAV = [
  { to: '/', label: '📊 Dashboard', end: true },
  { to: '/conversations', label: '💬 Conversations' },
  { to: '/leads', label: '🎯 Leads' },
  { to: '/quotes', label: '📄 Quotes' },
  { to: '/tickets', label: '🎫 Tickets' },
];

export default function Layout() {
  const { pathname } = useLocation();
  const fullBleed = pathname.startsWith('/conversations');

  function signOut() {
    clearAdminKey();
    window.dispatchEvent(new Event('officerestore:logout'));
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
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
        <button onClick={signOut} style={{
          margin: 'auto 20px 0', padding: '8px 0', background: 'transparent',
          border: '1px solid #2d2d4e', borderRadius: 6, color: '#8888aa', fontSize: 13, cursor: 'pointer',
        }}>
          Sign out
        </button>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, background: '#f5f6fa', padding: fullBleed ? 0 : 32, overflowY: fullBleed ? 'hidden' : 'auto', height: '100vh', boxSizing: 'border-box' }}>
        <Outlet />
      </main>
    </div>
  );
}