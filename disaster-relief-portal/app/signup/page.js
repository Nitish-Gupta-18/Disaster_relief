'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../components/AuthContext';
import { AlertTriangle, Eye, EyeOff, Lock, Mail, User, UserPlus, Shield, ChevronDown } from 'lucide-react';

const roles = [
  { value: 'volunteer', label: 'Volunteer', description: 'Respond to relief requests in the field' },
  { value: 'admin', label: 'Admin', description: 'Full access — manage volunteers, assignments & operations' },
  { value: 'user', label: 'Viewer', description: 'Read-only access to dashboards and maps' },
];

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const { signup } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('volunteer');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, name, role);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] p-5">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF7A30] to-[#F97316] shadow-xl shadow-orange-500/20 mb-4">
            <UserPlus className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Create Account</h1>
          <p className="mt-1 text-sm text-[#64748B]">Join the disaster relief coordination network</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid overflow-hidden">
          <div className="border-b border-[#E2E8F0]/60 px-6 py-4">
            <h2 className="text-lg font-semibold text-[#0F172A] flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#FF7A30]" /> Register
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <div>
              <label className="text-label">Full name</label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
              </div>
            </div>

            <div>
              <label className="text-label">Email address</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
              </div>
            </div>

            <div>
              <label className="text-label">Password</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-11 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-label">Confirm password</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <div>
              <label className="text-label">Account role</label>
              <div className="relative mt-1.5">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <select value={role} onChange={(e) => setRole(e.target.value)}
                  className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-8 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white appearance-none">
                  {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
              </div>
              <p className="mt-1 text-xs text-[#94A3B8]">
                {roles.find((r) => r.value === role)?.description}
              </p>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#F97316] text-sm font-bold text-white shadow-lg shadow-orange-500/20 hover:shadow-xl hover:brightness-105 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {loading ? 'Creating account...' : <>Create Account <UserPlus className="h-4 w-4" /></>}
            </button>

            <div className="text-center text-sm text-[#64748B]">
              Already have an account?{' '}
              <Link href={`/login${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                className="font-semibold text-[#FF7A30] hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
