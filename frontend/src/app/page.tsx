'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function HomePage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const res = await api('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setSuccess(res.message + (res.resetToken ? ` Token: ${res.resetToken}` : ''));
        if (res.resetToken) {
          setResetToken(res.resetToken);
          setMode('reset');
        }
      } else if (mode === 'reset') {
        const res = await api('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, newPassword }),
        });
        setSuccess(res.message);
        setMode('login');
      } else {
        const data =
          mode === 'login'
            ? await authApi.login({ email, password })
            : await authApi.register({ email, password, name });
        setTokens(data.accessToken, data.refreshToken);
        setUser({ email, name });
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Secure Sheets
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Multi-tenant collaborative spreadsheets with strong security
          </p>
        </div>

        {(mode === 'login' || mode === 'register') && (
          <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Register
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Your name"
              />
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="you@company.com"
              />
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="••••••••"
              />
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reset Token</label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="••••••••"
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          )}
          {success && (
            <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg break-all">{success}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg transition disabled:opacity-50"
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign in'
              : mode === 'register'
              ? 'Create account'
              : mode === 'forgot'
              ? 'Send reset token'
              : 'Reset password'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
              className="text-sky-600 hover:underline"
            >
              Forgot password?
            </button>
          )}
          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className="text-sky-600 hover:underline"
            >
              Back to login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
