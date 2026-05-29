import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

/* ── Inline SVG icons (no extra deps) ──────────────────────────────────────── */
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
  </svg>
);
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function LoginPage() {
  const { login, loading, setSession } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState({});

  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const result = await login(form.email, form.password);
    if (result.success) {
      toast.success('Welcome back to Pixora ✦');
      navigate('/');
    } else {
      toast.error(result.error);
      setErrors({ general: result.error });
    }
  };

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(err => ({ ...err, [field]: '' }));
  };

  const handleFocus = (field) => setFocused(f => ({ ...f, [field]: true }));
  const handleBlur = (field) => setFocused(f => ({ ...f, [field]: false }));

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const userInfo = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        // Send Google user info to backend to create or return user and receive JWT
        const payload = {
          email: userInfo.data.email,
          name: userInfo.data.name,
          avatar: userInfo.data.picture,
        };

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const resp = await axios.post(`${API_URL}/auth/google`, payload);
        if (resp?.data?.token) {
          setSession(resp.data.user, resp.data.token);
          toast.success(`Signed in with Google as ${resp.data.user.username || resp.data.user.email}`);
          navigate('/');
          return;
        }

        toast.success(`Signed in with Google as ${userInfo.data?.name || userInfo.data?.email || 'your account'}`);
        navigate('/');
      } catch (error) {
        console.error(error);
        toast.error('Google sign-in failed');
      }
    },
    onError: () => {
      toast.error('Google sign-in failed');
    },
    ux_mode: 'popup',
  });

  return (
    <div className="auth-page-v2">
      {/* Animated background orbs */}
      <div className="auth-orb auth-orb--1" aria-hidden="true" />
      <div className="auth-orb auth-orb--2" aria-hidden="true" />
      <div className="auth-orb auth-orb--3" aria-hidden="true" />

      {/* Grid noise texture */}
      <div className="auth-grid-bg" aria-hidden="true" />

      <div className="auth-v2-wrapper">
        {/* ── Left panel — branding ──────────────────────────── */}
        <aside className="auth-brand-panel" aria-hidden="true">
          <div className="auth-brand-inner">
            <div className="auth-brand-badge">✦ Premium Photography</div>
            <h2 className="auth-brand-headline">
              Discover the World<br />
              <em>Through the Lens</em>
            </h2>
            <p className="auth-brand-sub">
              A curated universe of HD photography, art, and aesthetics — handpicked from the world's finest creators.
            </p>
            <div className="auth-brand-stats">
              <div className="auth-brand-stat"><span>50K+</span>Photos</div>
              <div className="auth-brand-stat"><span>12K+</span>Artists</div>
              <div className="auth-brand-stat"><span>4K</span>HD Resolution</div>
            </div>
          </div>
          {/* Decorative image mosaic */}
          <div className="auth-mosaic" aria-hidden="true">
            {[10, 20, 30, 40, 50, 60].map((id, i) => (
              <div key={id} className={`auth-mosaic__cell auth-mosaic__cell--${i + 1}`}>
                <img src={`https://picsum.photos/id/${id}/400/500`} alt="" loading="lazy" />
              </div>
            ))}
          </div>
        </aside>

        {/* ── Right panel — form ─────────────────────────────── */}
        <main className="auth-form-panel">
          <div className="auth-card-v2">

            <div className="auth-card-header">
              <h1 className="auth-title-v2">Welcome back</h1>
              <p className="auth-subtitle-v2">Sign in to continue your visual journey</p>
            </div>

            {/* Google SSO */}
            <button type="button" className="auth-sso-btn" id="login-google-btn" onClick={() => loginWithGoogle()}>
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            <div className="auth-divider-v2">
              <div className="auth-divider-line-v2" />
              <span className="auth-divider-text-v2">or sign in with email</span>
              <div className="auth-divider-line-v2" />
            </div>

            <form className="auth-form-v2" onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div className={`form-field-v2${focused.email ? ' focused' : ''}${errors.email ? ' has-error' : ''}${form.email ? ' has-value' : ''}`}>
                <label htmlFor="login-email" className="form-label-v2">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-input-v2"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                  onFocus={() => handleFocus('email')}
                  onBlur={() => handleBlur('email')}
                  autoComplete="email"
                  autoFocus
                />
                {errors.email && (
                  <span className="form-error-v2" role="alert">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                    {errors.email}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className={`form-field-v2${focused.password ? ' focused' : ''}${errors.password ? ' has-error' : ''}${form.password ? ' has-value' : ''}`}>
                <label htmlFor="login-password" className="form-label-v2">Password</label>
                <div className="form-input-wrap-v2">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    className="form-input-v2"
                    placeholder="Your password"
                    value={form.password}
                    onChange={set('password')}
                    onFocus={() => handleFocus('password')}
                    onBlur={() => handleBlur('password')}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="form-eye-btn"
                    onClick={() => setShowPass(p => !p)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {errors.password && (
                  <span className="form-error-v2" role="alert">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                    {errors.password}
                  </span>
                )}
                <div className="form-forgot-row">
                  <button type="button" className="form-forgot-btn">Forgot password?</button>
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit-v2"
                id="login-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="auth-spinner" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </>
                )}
              </button>
            </form>

            <p className="auth-switch-v2">
              Don't have an account?{' '}
              <Link to="/signup" className="auth-switch-link">Create one free</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
