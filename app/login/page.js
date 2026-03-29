'use client';

import { signIn } from 'next-auth/react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const callbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/dashboard';
    const params = new URLSearchParams(window.location.search);
    return params.get('callbackUrl') || '/dashboard';
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const loginPromise = (async () => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl
      });

      if (result?.error) {
        throw new Error('Invalid login.');
      }
      return result;
    })();

    toast.promise(loginPromise, {
      loading: 'Signing in...',
      success: 'Login successful. Redirecting...',
      error: (error) => error.message || 'Login failed.'
    });

    try {
      await loginPromise;
      window.location.href = callbackUrl;
    } catch (error) {
      setError(error.message || 'Invalid login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="panel login-card">
        <div className="heading">
          <div>
            <div className="kicker">Dealio</div>
            <h1>Admin login</h1>
          </div>
        </div>
        <form className="form" onSubmit={handleSubmit}>
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          {error ? <div className="muted">{error}</div> : null}
        </form>
      </div>
    </div>
  );
}
