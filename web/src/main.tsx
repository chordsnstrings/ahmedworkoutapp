import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { GuestCharge } from './pages/GuestCharge';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './store/auth';
import { LiveProvider } from './store/live';
import './index.css';

/** Authenticated dashboard, gated behind login. */
function Console() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Login />;
  return (
    <LiveProvider>
      <App />
    </LiveProvider>
  );
}

function Root() {
  return (
    <Routes>
      {/* Public ad-hoc charging (QR) — no login required. */}
      <Route path="/charge/:id" element={<GuestCharge />} />
      <Route path="/*" element={<Console />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
