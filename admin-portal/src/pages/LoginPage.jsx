import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const features = [
  { text: 'Real-time GPS Fleet Tracking' },
  { text: 'Cargo Safety & Incident Management' },
  { text: 'Analytics & Performance Reports' },
  { text: 'Automated Route Monitoring' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loginResponse, setLoginResponse] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data?.mfaRequired) {
        setMfaRequired(true);
        setLoginResponse(res.data);
        setLoading(false);
        return;
      }
      setAuth(res.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/mfa/verify', {
        code,
        email,
        loginId: loginResponse?.loginId,
      });
      setAuth(res.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'MFA verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      {/* ── Left  Panel ── */}
      <div style={s.left}>
        <div className="login-bg-image" style={s.bgImage} />
        <div style={s.overlay} />

        <div style={s.leftContent} className="fade-in">
          {/* Logo */}
          <div style={s.logoRow}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#14B8A6" />
              <path d="M10 20L17 27L30 13" stroke="white" strokeWidth="3.5"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={s.logoText}>FleetTrack Pro</span>
          </div>

          <h2 style={s.tagline}>Intelligent Fleet Management Platform</h2>
          <p style={s.taglineSub}>
            Monitor your entire fleet in real-time. Track deliveries, manage
            drivers, and ensure cargo safety — all from one dashboard.
          </p>

          {/* Feature list */}
          <div style={s.features}>
            {features.map((f, i) => (
              <div key={i} style={s.featureRow}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="rgba(20,184,166,0.15)" />
                  <path d="M6 10L9 13L14 7" stroke="#14B8A6" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={s.featureLabel}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* Trust bar */}
          <div style={s.trustBar}>
            <div style={s.trustItem}>
              <span style={s.trustNumber}>99.9%</span>
              <span style={s.trustLabel}>Uptime</span>
            </div>
            <div style={s.trustDivider} />
            <div style={s.trustItem}>
              <span style={s.trustNumber}>50k+</span>
              <span style={s.trustLabel}>Deliveries</span>
            </div>
            <div style={s.trustDivider} />
            <div style={s.trustItem}>
              <span style={s.trustNumber}>500+</span>
              <span style={s.trustLabel}>Vehicles</span>
            </div>
          </div>

          <p style={s.copyright}>&copy; 2026 FleetTrack Pro. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div style={s.right}>
        <div style={s.formWrapper} className="page-enter">
          <h1 style={s.heading}>Welcome back</h1>
          <p style={s.subheading}>Sign in to your admin account to continue</p>

          <form
            onSubmit={mfaRequired ? handleMfaVerify : handleLogin}
            style={s.form}
          >
            {/* Email */}
            <div style={s.field}>
              <label style={s.label}>Email address</label>
              <input
                className="login-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fleettrack.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div style={s.field}>
              <div style={s.labelRow}>
                <label style={s.label}>Password</label>
                <span style={s.forgotLink}>Forgot password?</span>
              </div>
              <input
                className="login-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            {/* MFA slide-in */}
            <div
              style={{
                overflow: 'hidden',
                transition:
                  'max-height 350ms cubic-bezier(0.4,0,0.2,1), opacity 300ms, margin-top 300ms',
                maxHeight: mfaRequired ? 90 : 0,
                opacity: mfaRequired ? 1 : 0,
                marginTop: mfaRequired ? 4 : 0,
              }}
            >
              <label style={s.label}>6-digit MFA code</label>
              <input
                className="login-input"
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                maxLength={6}
                style={{ letterSpacing: 10, textAlign: 'center', fontWeight: 600 }}
              />
            </div>

            {/* Submit */}
            <button
              className="login-btn"
              type="submit"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? (
                <span style={s.spinner}>
                  <span style={s.dot} />
                  <span style={{ ...s.dot, animationDelay: '0.15s' }} />
                  <span style={{ ...s.dot, animationDelay: '0.3s' }} />
                </span>
              ) : mfaRequired ? (
                'Verify MFA'
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Error pill */}
          {error && (
            <div style={s.errorPill} className="page-enter">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                   style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="8" fill="#FEE2E2" />
                <path d="M8 5v3M8 10.5h.01" stroke="#DC2626" strokeWidth="1.5"
                      strokeLinecap="round" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Footer */}
          <p style={s.formFooter}>
            Secure login powered by JWT authentication
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Inline styles ─────────────────────────────────────────────── */

const s = {
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },

  /* Left panel */
  left: {
    width: '55%',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 56px',
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'url(/login-bg.jpeg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(160deg, rgba(15,35,71,0.92) 0%, rgba(27,58,107,0.85) 50%, rgba(13,148,136,0.75) 100%)',
  },
  leftContent: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 440,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 32,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 600,
    lineHeight: 1.35,
    marginBottom: 12,
  },
  taglineSub: {
    color: 'rgba(174, 214, 241, 0.85)',
    fontSize: 14.5,
    lineHeight: 1.65,
    marginBottom: 40,
  },

  /* Features */
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginBottom: 48,
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  featureLabel: {
    color: '#E2E8F0',
    fontSize: 14.5,
    fontWeight: 400,
  },

  /* Trust bar */
  trustBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 28,
    padding: '20px 0',
    borderTop: '1px solid rgba(255,255,255,0.12)',
    borderBottom: '1px solid rgba(255,255,255,0.12)',
    marginBottom: 32,
  },
  trustItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  trustNumber: {
    color: '#14B8A6',
    fontSize: 20,
    fontWeight: 700,
  },
  trustLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trustDivider: {
    width: 1,
    height: 36,
    background: 'rgba(255,255,255,0.12)',
  },

  copyright: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
  },

  /* Right panel */
  right: {
    width: '45%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 56px',
    background: '#FFFFFF',
    overflow: 'hidden',
  },
  formWrapper: {
    width: '100%',
    maxWidth: 400,
  },
  heading: {
    fontSize: 28,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 32,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: '#374151',
  },
  forgotLink: {
    fontSize: 12.5,
    fontWeight: 500,
    color: '#1B3A6B',
    cursor: 'pointer',
  },

  /* Loading dots */
  spinner: {
    display: 'inline-flex',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#FFFFFF',
    animation: 'bounce 0.6s infinite',
  },

  /* Error */
  errorPill: {
    marginTop: 20,
    padding: '11px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: '#DC2626',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  formFooter: {
    marginTop: 32,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
};
