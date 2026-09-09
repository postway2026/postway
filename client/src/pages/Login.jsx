import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={handleSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>Posway</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Do'kon boshqaruv tizimi</div>
        </div>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red)', padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 14 }}>
            {error}
          </div>
        )}
        <div className="form-row">
          <label>Login</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required />
        </div>
        <div className="form-row">
          <label>Parol</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <button className="btn" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Kirilmoqda...' : 'Kirish'}
        </button>
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
          Boshlang'ich: admin / admin123
        </div>
      </form>
    </div>
  );
}
