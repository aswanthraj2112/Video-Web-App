import React, { useState } from 'react';
import { confirmSignUp, resendSignUpCode, signIn, signUp } from 'aws-amplify/auth';
import { useToast } from '../App.jsx';

function Login ({ onAuthenticated, loading }) {
  const notify = useToast();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', code: '' });
  const [submitting, setSubmitting] = useState(false);
  const [pendingUser, setPendingUser] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const resetForm = () => {
    setForm({ username: '', password: '', code: '' });
    setPendingUser('');
  };

  const handleSignIn = async () => {
    const username = form.username.trim();
    const password = form.password;
    const result = await signIn({ username, password });
    if (result.isSignedIn) {
      onAuthenticated();
    } else if (result.nextStep?.signInStep !== 'DONE') {
      notify('Additional authentication is required. Complete the Cognito challenge in the Hosted UI.', 'warning');
    } else {
      onAuthenticated();
    }
  };

  const handleSignUp = async () => {
    const username = form.username.trim();
    const password = form.password;
    const result = await signUp({ username, password });
    if (result.isSignUpComplete) {
      notify('Registration complete. Signing you in…', 'success');
      await handleSignIn();
    } else {
      setPendingUser(username);
      setMode('confirm');
      notify('Verification required. Enter the confirmation code sent to your email or phone.', 'info');
    }
  };

  const handleConfirm = async () => {
    const username = pendingUser || form.username.trim();
    if (!username) {
      throw new Error('No user to confirm. Start the registration flow again.');
    }
    const code = form.code.trim();
    await confirmSignUp({ username, confirmationCode: code });
    notify('Account confirmed. Please sign in.', 'success');
    setMode('login');
    setForm({ username, password: '', code: '' });
  };

  const handleResend = async () => {
    const username = pendingUser || form.username.trim();
    if (!username) {
      throw new Error('Enter the username to resend the confirmation code.');
    }
    await resendSignUpCode({ username });
    notify('Verification code sent again.', 'info');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || loading) return;

    if (mode === 'confirm') {
      if (!form.code) {
        notify('Enter the verification code sent by Cognito.', 'error');
        return;
      }
    } else if (!form.username || !form.password) {
      notify('Username and password are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await handleSignIn();
      } else if (mode === 'register') {
        await handleSignUp();
      } else if (mode === 'confirm') {
        await handleConfirm();
      }
    } catch (error) {
      notify(error.message || 'Authentication failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode) => {
    resetForm();
    setMode(nextMode);
  };

  return (
    <div className="auth-card">
      <h2>
        {mode === 'login' && 'Sign in'}
        {mode === 'register' && 'Create an account'}
        {mode === 'confirm' && 'Confirm your account'}
      </h2>
      {loading && <p>Checking session…</p>}
      <form onSubmit={handleSubmit}>
        {(mode === 'login' || mode === 'register') && (
          <>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
              disabled={submitting || loading || mode === 'confirm'}
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
          </>
        )}
        {mode === 'confirm' && (
          <>
            <p>Enter the verification code Cognito sent to your email or phone.</p>
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              name="code"
              type="text"
              value={form.code}
              onChange={handleChange}
              disabled={submitting || loading}
            />
            <button type="button" className="btn-link" onClick={handleResend} disabled={submitting}>
              Resend code
            </button>
          </>
        )}
        <button type="submit" className="btn" disabled={submitting || loading}>
          {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Register' : 'Confirm'}
        </button>
      </form>
      {mode !== 'confirm' && (
        <button
          type="button"
          className="btn-link"
          onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          disabled={submitting}
        >
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
        </button>
      )}
      {mode === 'confirm' && (
        <button
          type="button"
          className="btn-link"
          onClick={() => switchMode('login')}
          disabled={submitting}
        >
          Back to sign in
        </button>
      )}
    </div>
  );
}

export default Login;
