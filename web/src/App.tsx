import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { Chargers } from './pages/Chargers';
import { ChargerDetail } from './pages/ChargerDetail';
import { Transactions } from './pages/Transactions';
import { Tokens } from './pages/Tokens';
import { Tariffs } from './pages/Tariffs';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/chargers" element={<Chargers />} />
        <Route path="/chargers/:id" element={<ChargerDetail />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/access" element={<Tokens />} />
        <Route path="/tariffs" element={<Tariffs />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
