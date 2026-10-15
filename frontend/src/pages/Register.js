import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

function Register() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    subject: 'mathematics'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await API.post('/auth/register', form);
      login(res.data.user, res.data.access_token);
      navigate('/diagnostic');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>PathWise</h1>
        <p style={styles.subtitle}>WAEC Study Tutor</p>
        <h2 style={styles.heading}>Create Account</h2>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Full Name</label>
            <input
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={handleChange}
              style={styles.input}
              placeholder="Enter your full name"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              style={styles.input}
              placeholder="Enter your email"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrapper}>
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                style={styles.passwordInput}
                placeholder="Create a password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Select Subject</label>
            <select
              name="subject"
              value={form.subject}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="mathematics">Core Mathematics</option>
              <option value="physics">Elective Physics</option>
            </select>
          </div>
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p style={styles.footer}>
          Already have an account? <Link to="/login" style={styles.link}>Sign in here</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', backgroundColor: '#F4F8FC',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    backgroundColor: 'white', padding: '40px', borderRadius: '8px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px',
  },
  title: {
    color: '#1F4E79', textAlign: 'center', margin: '0 0 4px 0',
    fontFamily: 'Georgia, serif', fontSize: '28px',
  },
  subtitle: { color: '#64748B', textAlign: 'center', margin: '0 0 24px 0', fontSize: '14px' },
  heading: { color: '#1E293B', margin: '0 0 20px 0', fontSize: '20px' },
  field: { marginBottom: '16px' },
  label: {
    display: 'block', marginBottom: '6px',
    color: '#1E293B', fontSize: '14px', fontWeight: '500',
  },
  input: {
    width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1',
    borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box', outline: 'none',
  },
  passwordWrapper: {
    display: 'flex', alignItems: 'center',
    border: '1px solid #CBD5E1', borderRadius: '4px', overflow: 'hidden',
  },
  passwordInput: {
    flex: 1, padding: '10px 12px', border: 'none',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  },
  eyeBtn: {
    background: 'none', border: 'none', padding: '0 12px',
    cursor: 'pointer', fontSize: '16px', color: '#64748B',
  },
  button: {
    width: '100%', padding: '12px', backgroundColor: '#1F4E79',
    color: 'white', border: 'none', borderRadius: '4px',
    fontSize: '15px', cursor: 'pointer', marginTop: '8px',
  },
  error: {
    backgroundColor: '#FEE2E2', color: '#991B1B',
    padding: '10px 12px', borderRadius: '4px',
    marginBottom: '16px', fontSize: '14px',
  },
  footer: { textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#64748B' },
  link: { color: '#1F4E79', textDecoration: 'none', fontWeight: '500' },
};

export default Register;