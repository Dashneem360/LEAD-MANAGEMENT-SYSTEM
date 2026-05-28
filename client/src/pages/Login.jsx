import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { MdEmail, MdLock, MdDynamicForm } from 'react-icons/md';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-bg-orb orb1"></div>
        <div className="login-bg-orb orb2"></div>
        <div className="login-bg-orb orb3"></div>
      </div>
      <div className="login-card">
        <div className="login-brand">
          <MdDynamicForm className="login-logo" />
          <h1>Dashneem</h1>
          <p>Sales Lead Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <MdEmail className="input-icon" />
            <input
              type="email" placeholder="Email address" required
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="input-group">
            <MdLock className="input-icon" />
            <input
              type="password" placeholder="Password" required
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {loading ? <span className="btn-spinner"></span> : 'Sign In'}
          </button>
        </form>
        <div className="login-footer">
          <p>Dashneem v1.0 &bull; Powered by MERN Stack</p>
        </div>
      </div>
    </div>
  );
}
