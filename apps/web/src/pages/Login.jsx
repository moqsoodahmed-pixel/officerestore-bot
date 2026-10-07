import { useState } from 'react';
import { api, setAdminKey } from '../services/api';

export default function Login({ onSuccess }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!key.trim()) return;
    setChecking(true);
    setError('');
    try {
      await api.verifyKey(key.trim());
      setAdminKey(key.trim());
      onSuccess();
    } catch (err) {
      setError(err.message.includes('incorrect')
        ? 'That admin key is not correct. Use the ADMIN_API_KEY value from Railway.'
        : `Could not reach the bot server: ${err.message}`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: '#1a1a2e', fontFamily: 'system-ui, sans-serif', padding: 20,
    }}>
      <form onSubmit={submit} style={{
        background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 380,
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>🪑 Officerestore</div>
        <div style={{ fontSize: 14, color: '#666', margin: '6px 0 24px' }}>Sign in to the WhatsApp bot dashboard</div>

        <label htmlFor="admin-key" style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Admin key</label>
        <input
          id="admin-key"
          type="password"
          autoFocus
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your admin key"
          style={{
            width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '10px 12px',
            border: '1px solid #ccc', borderRadius: 8, fontSize: 14,
          }}
        />
        {error && <div role="alert" style={{ color: '#c62828', fontSize: 13, marginTop: 10 }}>{error}</div>}

        <button type="submit" disabled={checking || !key.trim()} style={{
          width: '100%', marginTop: 20, padding: '11px 0', border: 'none', borderRadius: 8,
          background: '#128c4a', color: '#fff', fontSize: 15, fontWeight: 600,
          cursor: checking ? 'wait' : 'pointer', opacity: checking || !key.trim() ? 0.6 : 1,
        }}>
          {checking ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}