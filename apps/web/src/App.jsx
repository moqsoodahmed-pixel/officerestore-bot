import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Quotes from './pages/Quotes';
import Tickets from './pages/Tickets';
import Conversations from './pages/Conversations';
import Login from './pages/Login';
import { getAdminKey } from './services/api';

export default function App() {
  const [signedIn, setSignedIn] = useState(Boolean(getAdminKey()));

  useEffect(() => {
    const onLogout = () => setSignedIn(false);
    window.addEventListener('officerestore:logout', onLogout);
    return () => window.removeEventListener('officerestore:logout', onLogout);
  }, []);

  if (!signedIn) return <Login onSuccess={() => setSignedIn(true)} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="leads" element={<Leads />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="tickets" element={<Tickets />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}