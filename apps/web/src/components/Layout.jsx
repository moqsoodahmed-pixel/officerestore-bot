import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { clearAdminKey } from '../services/api';

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: '📊', end: true },
  { to: '/conversations', label: 'Conversations', short: 'Chats', icon: '💬' },
  { to: '/leads', label: 'Leads', short: 'Leads', icon: '🎯' },
  { to: '/quotes', label: 'Quotes', short: 'Quotes', icon: '📄' },
  { to: '/tickets', label: 'Tickets', short: 'Tickets', icon: '🎫' },
];

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function signOut() {
  clearAdminKey();
  window.dispatchEvent(new Event('officerestore:logout'));
}

export default function Layout() {
  const { pathname } = useLocation();
  const fullBleed = pathname.startsWith('/conversations');
  const isMobile = useIsMobile();

  if (isMobile) return <MobileLayout fullBleed={fullBleed} />;

  return (
    <div style={{ display: 'flex', height: '100dvh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220, background: '#1a1a2e', color: '#fff', padding: '24px 0',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
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
              {n.icon} {n.label}
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
      <main style={{
        flex: 1, minWidth: 0, background: '#f5f6fa',
        padding: fullBleed ? 0 : 32, overflowY: fullBleed ? 'hidden' : 'auto', boxSizing: 'border-box',
      }}>
        <Outlet />
      </main>
    </div>
  );
}

/**
 * Phone layout: slim top bar + bottom tab bar (thumb-friendly), like WhatsApp.
 */
function MobileLayout({ fullBleed }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      fontFamily: 'system-ui, sans-serif', background: '#f5f6fa',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#1a1a2e', color: '#fff', flexShrink: 0,
        padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#25d366' }}>🪑 Officerestore</div>
        <button onClick={signOut} style={{
          background: 'transparent', border: '1px solid #2d2d4e', borderRadius: 6,
          color: '#ccccee', fontSize: 12, padding: '6px 10px', cursor: 'pointer',
        }}>
          Sign out
        </button>
      </header>

      <main style={{
        flex: 1, minHeight: 0, overflowY: fullBleed ? 'hidden' : 'auto',
        padding: fullBleed ? 0 : 14, boxSizing: 'border-box',
      }}>
        <Outlet />
      </main>

      <nav aria-label="Main" style={{
        display: 'flex', background: '#fff', borderTop: '1px solid #e6e7ef', flexShrink: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '8px 0 6px', textDecoration: 'none', fontSize: 11, fontWeight: 600,
              color: isActive ? '#128c4a' : '#6b6b80',
              borderTop: isActive ? '2px solid #128c4a' : '2px solid transparent',
            })}>
            <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span>
            {n.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}