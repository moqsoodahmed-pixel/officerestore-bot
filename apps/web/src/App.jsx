import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Quotes from './pages/Quotes';
import Tickets from './pages/Tickets';
import Conversations from './pages/Conversations';

export default function App() {
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
