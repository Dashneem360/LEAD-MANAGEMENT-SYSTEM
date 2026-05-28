import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Followups from './pages/Followups';
import CallingList from './pages/CallingList';
import Team from './pages/Team';
import Webinars from './pages/Webinars';
import Messages from './pages/Messages';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="app-loading">
      <div className="loading-spinner"></div>
      <p>Loading Dashneem...</p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/app' : '/login'} replace />} />
      <Route path="/login" element={user ? <Navigate to="/app" /> : <Login />} />
      <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="followups" element={<Followups />} />
        <Route path="calling" element={<CallingList />} />
        <Route path="team" element={<Team />} />
        <Route path="webinars" element={<Webinars />} />
        <Route path="messages" element={<Messages />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{
          duration: 3000,
          style: { background: '#1e293b', color: '#f1f5f9', borderRadius: '12px', fontSize: '14px' }
        }} />
      </BrowserRouter>
    </AuthProvider>
  );
}
