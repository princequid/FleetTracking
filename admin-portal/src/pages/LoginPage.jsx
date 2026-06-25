import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loginResponse, setLoginResponse] = useState(null);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data?.mfaRequired) {
        setMfaRequired(true);
        setLoginResponse(response.data);
        return;
      }
      setAuth(response.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  const handleMfaVerify = async () => {
    setError('');
    try {
      const response = await api.post('/auth/mfa/verify', {
        code,
        email,
        loginId: loginResponse?.loginId,
      });
      setAuth(response.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'MFA verification failed');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 24 }}>
      <h1>Admin Login</h1>
      <div style={{ display: 'grid', gap: 12 }}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>

        {mfaRequired && (
          <label>
            6-digit MFA code
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </label>
        )}

        {error && <div style={{ color: 'red' }}>{error}</div>}

        {!mfaRequired ? (
          <button onClick={handleLogin} style={{ padding: '10px 16px' }}>
            Login
          </button>
        ) : (
          <button onClick={handleMfaVerify} style={{ padding: '10px 16px' }}>
            Verify MFA
          </button>
        )}
      </div>
    </div>
  );
}
