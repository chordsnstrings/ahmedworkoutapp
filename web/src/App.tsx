import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { Analytics } from './pages/Analytics';
import { Chargers } from './pages/Chargers';
import { StationMap } from './pages/StationMap';
import { ChargerDetail } from './pages/ChargerDetail';
import { Transactions } from './pages/Transactions';
import { Tokens } from './pages/Tokens';
import { Tariffs } from './pages/Tariffs';
import { LoadGroups } from './pages/LoadGroups';
import { Energy } from './pages/Energy';
import { Alerts } from './pages/Alerts';
import { Payments } from './pages/Payments';
import { Roaming } from './pages/Roaming';
import { PlugAndCharge } from './pages/PlugAndCharge';
import { Assistant } from './pages/Assistant';
import { Reports } from './pages/Reports';
import { Audit } from './pages/Audit';
import { Users } from './pages/Users';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/chargers" element={<Chargers />} />
        <Route path="/map" element={<StationMap />} />
        <Route path="/chargers/:id" element={<ChargerDetail />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/load" element={<LoadGroups />} />
        <Route path="/energy" element={<Energy />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/access" element={<Tokens />} />
        <Route path="/plug-and-charge" element={<PlugAndCharge />} />
        <Route path="/tariffs" element={<Tariffs />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/roaming" element={<Roaming />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/users" element={<Users />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
