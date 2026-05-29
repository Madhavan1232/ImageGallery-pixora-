import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useGoogleLogin } from '@react-oauth/google'
import axios from 'axios';

/* ── Inline SVG icons ───────────────────────────────────────────────────────── */
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
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AuthField = ({
  id,
  label,
  value,
  error,
  focused,
  type = 'text',
  placeholder,
  autoComplete,
  onChange,
  onFocus,
  onBlur,
  children,
}) => (
  <div className={`form-field-v2${focused ? ' focused' : ''}${error ? ' has-error' : ''}${value ? ' has-value' : ''}`}>
    <label htmlFor={id} className="form-label-v2">{label}</label>
    {children || (
      <input
        id={id}
        type={type}
        className="form-input-v2"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        autoComplete={autoComplete}
      />
    )}
    {error && (
      <span className="form-error-v2" role="alert">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
        {error}
      </span>
    )}
  </div>
);

/* ── Password strength scoring ──────────────────────────────────────────────── */
function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score: 2, label: 'Fair', color: '#f59e0b' };
  if (score <= 3) return { score: 3, label: 'Good', color: '#10b981' };
  return { score: 4, label: 'Strong', color: '#22c55e' };
}

export default function SignupPage() {
  const { signup, loading, setSession } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '', username: '', email: '', password: '', confirm: '',
  });
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const strength = useMemo(() => getStrength(form.password), [form.password]);

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.username.trim()) e.username = 'Username is required';
    else if (form.username.trim().length < 3) e.username = 'At least 3 characters';
    if (!form.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'At least 6 characters';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    if (!agreedToTerms) e.terms = 'Please accept the terms to continue';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const result = await signup(form.username.trim(), form.email, form.password);
    if (result.success) {
      toast.success('Account created! Welcome to Pixora ✦');
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
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });

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

        console.log(userInfo.data);
      } catch (error) {
        console.log(error);
      }
    },
    onError: () =>{
      console.log("Google Login Failed");
    }
  });
  return (
    <div className="auth-page-v2">
      {/* Animated background orbs */}
      <div className="auth-orb auth-orb--1" aria-hidden="true" />
      <div className="auth-orb auth-orb--2" aria-hidden="true" />
      <div className="auth-orb auth-orb--3" aria-hidden="true" />
      <div className="auth-grid-bg" aria-hidden="true" />

      <div className="auth-v2-wrapper">
        {/* ── Left panel — branding ──────────────────────────── */}
        <aside className="auth-brand-panel" aria-hidden="true">
          <div className="auth-brand-inner">
            <div className="auth-brand-badge">✦ Join the Community</div>
            <h2 className="auth-brand-headline">
              Your Creative<br />
              <em>Journey Starts Here</em>
            </h2>
            <p className="auth-brand-sub">
              Discover, save, and share the world's most stunning HD photography from artists across the globe.
            </p>
            <div className="auth-brand-features">
              {[
                { icon: '✦', text: 'Curated aesthetic feeds' },
                { icon: '◈', text: 'Infinite discovery gallery' },
                { icon: '◉', text: 'Bookmark & collections' },
                { icon: '◆', text: 'HD downloads included' },
              ].map(f => (
                <div key={f.text} className="auth-brand-feature">
                  <span className="auth-brand-feature-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="auth-mosaic auth-mosaic--signup" aria-hidden="true">
            {[70, 80, 100, 200, 300, 400].map((id, i) => (
              <div key={id} className={`auth-mosaic__cell auth-mosaic__cell--${i + 1}`}>
                <img src={`https://picsum.photos/id/${id}/400/500`} alt="" loading="lazy" />
              </div>
            ))}
          </div>
        </aside>

        {/* ── Right panel — form ─────────────────────────────── */}
        <main className="auth-form-panel">
          <div className="auth-card-v2 auth-card-v2--signup">

            <div className="auth-card-header">
              <h1 className="auth-title-v2">Create account</h1>
              <p className="auth-subtitle-v2">Join thousands of visual explorers worldwide</p>
            </div>

            {/* Google SSO */}
            <button type="button" className="auth-sso-btn" id="signup-google-btn" onClick={() => loginWithGoogle()}>
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            <div className="auth-divider-v2">
              <div className="auth-divider-line-v2" />
              <span className="auth-divider-text-v2">or fill in your details</span>
              <div className="auth-divider-line-v2" />
            </div>

            <form className="auth-form-v2" onSubmit={handleSubmit} noValidate>
              {/* Full name + Username in a row */}
              <div className="form-row-v2">
                <AuthField
                  id="signup-fullname"
                  label="Full name"
                  field="fullName"
                  value={form.fullName}
                  error={errors.fullName}
                  focused={focused.fullName}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  onChange={set('fullName')}
                  onFocus={() => handleFocus('fullName')}
                  onBlur={() => handleBlur('fullName')}
                />
                <AuthField
                  id="signup-username"
                  label="Username"
                  field="username"
                  value={form.username}
                  error={errors.username}
                  focused={focused.username}
                  placeholder="janedoe"
                  autoComplete="username"
                  onChange={set('username')}
                  onFocus={() => handleFocus('username')}
                  onBlur={() => handleBlur('username')}
                />
              </div>

              {/* Email */}
              <AuthField
                id="signup-email"
                label="Email address"
                field="email"
                type="email"
                value={form.email}
                error={errors.email}
                focused={focused.email}
                placeholder="you@example.com"
                autoComplete="email"
                onChange={set('email')}
                onFocus={() => handleFocus('email')}
                onBlur={() => handleBlur('email')}
              />

              {/* Password */}
              <div className={`form-field-v2${focused.password ? ' focused' : ''}${errors.password ? ' has-error' : ''}${form.password ? ' has-value' : ''}`}>
                <label htmlFor="signup-password" className="form-label-v2">Password</label>
                <div className="form-input-wrap-v2">
                  <input
                    id="signup-password"
                    type={showPass ? 'text' : 'password'}
                    className="form-input-v2"
                    placeholder="Min. 6 characters"
                    value={form.password}
                    onChange={set('password')}
                    onFocus={() => handleFocus('password')}
                    onBlur={() => handleBlur('password')}
                    autoComplete="new-password"
                  />
                  <button type="button" className="form-eye-btn" onClick={() => setShowPass(p => !p)} aria-label={showPass ? 'Hide' : 'Show'}>
                    {showPass ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {/* Strength bar */}
                {form.password && (
                  <div className="password-strength">
                    <div className="strength-bars">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="strength-bar" style={{
                          background: i <= strength.score ? strength.color : 'var(--surface-3)',
                          transition: `background 0.3s ease ${i * 0.05}s`,
                        }} />
                      ))}
                    </div>
                    <span className="strength-label" style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}
                {errors.password && (
                  <span className="form-error-v2" role="alert">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                    {errors.password}
                  </span>
                )}
              </div>

              {/* Confirm password */}
              <div className={`form-field-v2${focused.confirm ? ' focused' : ''}${errors.confirm ? ' has-error' : ''}${form.confirm ? ' has-value' : ''}${form.confirm && form.confirm === form.password ? ' is-valid' : ''}`}>
                <label htmlFor="signup-confirm" className="form-label-v2">Confirm password</label>
                <div className="form-input-wrap-v2">
                  <input
                    id="signup-confirm"
                    type={showConf ? 'text' : 'password'}
                    className="form-input-v2"
                    placeholder="Repeat your password"
                    value={form.confirm}
                    onChange={set('confirm')}
                    onFocus={() => handleFocus('confirm')}
                    onBlur={() => handleBlur('confirm')}
                    autoComplete="new-password"
                  />
                  <button type="button" className="form-eye-btn" onClick={() => setShowConf(p => !p)} aria-label={showConf ? 'Hide' : 'Show'}>
                    {showConf ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                  {form.confirm && form.confirm === form.password && (
                    <span className="form-match-icon" aria-label="Passwords match"><CheckIcon /></span>
                  )}
                </div>
                {errors.confirm && (
                  <span className="form-error-v2" role="alert">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                    {errors.confirm}
                  </span>
                )}
              </div>

              {/* Terms checkbox */}
              <div className={`form-terms-row${errors.terms ? ' has-error' : ''}`}>
                <label className="form-terms-label" htmlFor="signup-terms">
                  <input
                    id="signup-terms"
                    type="checkbox"
                    className="form-terms-checkbox"
                    checked={agreedToTerms}
                    onChange={e => { setAgreedToTerms(e.target.checked); setErrors(err => ({ ...err, terms: '' })); }}
                  />
                  <span className="form-terms-custom" aria-hidden="true">
                    {agreedToTerms && <CheckIcon />}
                  </span>
                  <span className="form-terms-text">
                    I agree to the{' '}
                    <a href="#" className="auth-switch-link" onClick={e => e.preventDefault()}>Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" className="auth-switch-link" onClick={e => e.preventDefault()}>Privacy Policy</a>
                  </span>
                </label>
                {errors.terms && (
                  <span className="form-error-v2" role="alert">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                    {errors.terms}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="auth-submit-v2"
                id="signup-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <><div className="auth-spinner" /> Creating account…</>
                ) : (
                  <>
                    Create Account
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </>
                )}
              </button>
            </form>

            <p className="auth-switch-v2">
              Already have an account?{' '}
              <Link to="/login" className="auth-switch-link">Sign in instead</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
