import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AuthPage = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'register' && !name.trim()) {
      setErrorMsg('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Please enter your email address');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (res.success) {
          navigate(from, { replace: true });
        } else {
          setErrorMsg(res.error || 'Invalid email or password');
        }
      } else {
        const res = await register(name, email, password);
        if (res.success) {
          navigate(from, { replace: true });
        } else {
          setErrorMsg(res.error || 'Failed to create account');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillDemoAdmin = () => {
    setMode('login');
    setEmail('admin@aicloud.dev');
    setPassword('admin1234');
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col justify-between selection:bg-neutral-800 selection:text-white relative overflow-hidden font-sans">
      {/* Subtle Ambient Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f0a_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white text-black flex items-center justify-center rounded-lg shadow-sm">
            <svg viewBox="0 0 76 65" fill="currentColor" className="w-4 h-4">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white tracking-tight font-mono">AI Cloud</span>
        </div>

        <button
          type="button"
          onClick={handleFillDemoAdmin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 font-mono transition-colors cursor-pointer"
          title="Autofill default admin credentials"
        >
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>Demo Admin</span>
        </button>
      </header>

      {/* Main Auth Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-[#0a0a0a]/90 backdrop-blur-xl border border-neutral-800/90 rounded-2xl shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header with Vercel Triangle */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 mb-4 shadow-inner">
                <svg viewBox="0 0 76 65" fill="currentColor" className="w-6 h-6 text-white">
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {mode === 'login' ? 'Sign in to AI Cloud' : 'Create your account'}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1.5">
                {mode === 'login'
                  ? 'Welcome back. Enter your credentials to access your cluster.'
                  : 'Get started with autonomous cloud hosting and managed PostgreSQL.'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-neutral-950 border border-neutral-800/80 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                }}
                className={`py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-neutral-900 text-white shadow-sm border border-neutral-800'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg('');
                }}
                className={`py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-neutral-900 text-white shadow-sm border border-neutral-800'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full bg-black border border-neutral-800 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-all font-sans"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-all font-sans"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-neutral-300">
                    Password
                  </label>
                  {mode === 'register' && (
                    <span className="text-[10px] text-neutral-500">Min. 6 chars</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-black border border-neutral-800 rounded-lg px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-2.5 px-4 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black font-semibold text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow active:scale-[0.99]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Credentials Footer inside card */}
            <div className="mt-6 pt-5 border-t border-neutral-900/80">
              <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-900 text-[11px] text-neutral-400 font-mono">
                <div className="flex items-center justify-between text-neutral-300 font-medium mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Pre-seeded Admin
                  </span>
                  <button
                    type="button"
                    onClick={handleFillDemoAdmin}
                    className="text-emerald-400 hover:text-emerald-300 text-[10px] underline cursor-pointer"
                  >
                    Click to fill
                  </button>
                </div>
                <div className="space-y-0.5 text-[10px] text-neutral-500">
                  <div>Email: <code className="text-neutral-300 select-all">admin@aicloud.dev</code></div>
                  <div>Password: <code className="text-neutral-300 select-all">admin1234</code></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-500 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>All systems operational</span>
        </div>
        <div className="flex items-center gap-4 text-neutral-500">
          <span>Enterprise Cloud Hosting</span>
          <span>•</span>
          <span>Privacy & Security</span>
        </div>
      </footer>
    </div>
  );
};

export default AuthPage;
