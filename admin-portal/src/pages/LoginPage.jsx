import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const features = [
  { icon: '📍', text: 'Real-time Fleet Tracking' },
  { icon: '🛡️', text: 'Cargo Safety & Incident Management' },
  { icon: '📊', text: 'Analytics & Performance Reports' },
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
        code, email, loginId: loginResponse?.loginId,
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
    <div style={styles.container}>
      {/* Left Panel */}
      <div style={styles.leftPanel}>
        <div className="login-bg-image" style={styles.bgImage} />
        <div style={styles.bgOverlay} />
        <div style={styles.leftContent}>
          <div style={styles.logoRow}>
            <div style={styles.logoIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#14B8A6" />
                <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={styles.logoText}>FleetTrack Pro</span>
          </div>
          <p style={styles.subtitle}>Fleet Management Platform</p>

          <div style={styles.featureList}>
            {features.map((f, i) => (
              <div key={i} style={styles.featureItem}>
                <div style={styles.featureCheck}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="9" fill="#14B8A6" opacity="0.2" />
                    <path d="M5 9L8 12L13 6" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span style={styles.featureText}>{f.text}</span>
              </div>
            ))}
          </div>

          <p style={styles.copyright}>© 2026 FleetTrack Pro. All rights reserved.</p>
        </div>
      </div>

      {/* Right Panel */}
      <div style={styles.rightPanel}>
        <div style={styles.formCard} className="page-enter">
          <h1 style={styles.heading}>Welcome back</h1>
          <p style={styles.subheading}>Sign in to your account</p>

          <form onSubmit={mfaRequired ? handleMfaVerify : handleLogin} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fleettrack.com"
                required
                style={styles.input}
                onFocus={(e) => {
                  e.target.style.borderColor = '#1B3A6B';
                  e.target.style.boxShadow = '0 0 0 3px rgba(27,58,107,0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E5E7EB';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={styles.input}
                onFocus={(e) => {
                  e.target.style.borderColor = '#1B3A6B';
                  e.target.style.boxShadow = '0 0 0 3px rgba(27,58,107,0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E5E7EB';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* MFA slide-in */}
            <div style={{
              ...styles.mfaWrapper,
              maxHeight: mfaRequired ? 80 : 0,
              opacity: mfaRequired ? 1 : 0,
              marginTop: mfaRequired ? 4 : 0,
            }}>
              <label style={styles.label}>6-digit MFA code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                style={{ ...styles.input, letterSpacing: 8, textAlign: 'center', fontWeight: 600 }}
              />
            </div>

            <button type="submit" disabled={loading} style={{
              ...styles.button,
              opacity: loading ? 0.8 : 1,
              transform: loading ? 'scale(0.98)' : 'scale(1)',
            }}>
              {loading ? (
                <span style={styles.spinner}>
                  <span style={styles.dot} /><span style={{ ...styles.dot, animationDelay: '0.15s' }} /><span style={{ ...styles.dot, animationDelay: '0.3s' }} />
                </span>
              ) : mfaRequired ? 'Verify MFA' : 'Sign in'}
            </button>
          </form>

          {error && (
            <div style={styles.errorPill} className="page-enter">
              {error}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.3); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes slowZoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        .login-bg-image {
          animation: slowZoom 20s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
  },
  leftPanel: {
    width: '55%',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'url(/login-bg.jpeg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  bgOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(160deg, rgba(15,35,71,0.88) 0%, rgba(27,58,107,0.82) 100%)',
  },
  leftContent: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 420,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  logoIcon: {},
  logoText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#AED6F1',
    fontSize: 14,
    fontWeight: 400,
    marginBottom: 48,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    marginBottom: 64,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  featureCheck: {},
  featureText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: 400,
  },
  copyright: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  rightPanel: {
    width: '45%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    background: '#FFFFFF',
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
  },
  heading: {
    fontSize: 28,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 32,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 14,
    border: '1px solid #E5E7EB',
    borderRadius: 10,
    color: '#111827',
    background: '#FFFFFF',
    transition: 'border-color 250ms, box-shadow 250ms',
  },
  mfaWrapper: {
    overflow: 'hidden',
    transition: 'max-height 350ms cubic-bezier(0.4,0,0.2,1), opacity 300ms, margin-top 300ms',
  },
  button: {
    width: '100%',
    padding: 14,
    fontSize: 15,
    fontWeight: 600,
    color: '#FFFFFF',
    background: '#1B3A6B',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 250ms, transform 150ms',
    marginTop: 4,
  },
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
  errorPill: {
    marginTop: 16,
    padding: '10px 14px',
    fontSize: 13,
    color: '#DC2626',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 8,
  },
};
