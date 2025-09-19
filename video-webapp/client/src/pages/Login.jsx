import React, { useState } from 'react';
import api from '../api.js';
import { useToast } from '../App.jsx';

function Login ({ onAuthenticated, loading }) {
  const notify = useToast();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.username || !form.password) {
      notify('Username and password are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const username = form.username.trim();
      const password = form.password;
      if (mode === 'register') {
        await api.register(username, password);
        notify('Registration successful. Logging you in…', 'success');
      }
      const { token, user } = await api.login(username, password);
      onAuthenticated(token, user);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>{mode === 'login' ? 'Sign in' : 'Create an account'}</h2>
      {loading && <p>Validating session…</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          value={form.username}
          onChange={handleChange}
          disabled={submitting || loading}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={form.password}
          onChange={handleChange}
          disabled={submitting || loading}
        />
        <button type="submit" className="btn" disabled={submitting || loading}>
          {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>
      </form>
      <button
        type="button"
        className="btn-link"
        onClick={() => setMode((current) => (current === 'login' ? 'register' : 'login'))}
        disabled={submitting}
      >
        {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
      </button>
    </div>
  );
}

export default Login;
