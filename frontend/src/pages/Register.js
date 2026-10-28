import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const RULES = [
  { key: 'length', text: 'At least 8 characters' },
  { key: 'uppercase', text: 'One uppercase letter (A-Z)' },
  { key: 'number', text: 'One number (0-9)' },
  { key: 'special', text: 'One special character (! @ # $ % ...)' },
];

const getChecks = (password) => ({
  length: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  number: /\d/.test(password),
  special: /[^A-Za-z0-9]/.test(password),
});

const getStrength = (checks, password) => {
  if (!password) return { label: '', color: '#CBD5E1', percent: 0 };
  const met = Object.values(checks).filter(Boolean).length;
  if (met <= 2) return { label: 'Weak', color: '#991B1B', percent: 33 };
  if (met === 3) return { label: 'Medium', color: '#B45309', percent: 66 };
  return { label: 'Strong', color: '#166534', percent: 100 };
};

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

  const checks = getChecks(form.password);
  const strength = getStrength(checks, form.password);
  const isStrong = Object.values(checks).every(Boolean);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isStrong) {
      setError('Please choose a stronger password before continuing.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await API.post('/auth/register', form);
      login(res.data.user, res.data.access_token);
      navigate('/diagnostic');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg.replace(/^Value error, /, '')).join(' '));
      } else {
        setError(detail || 'Registration failed. Please try again.');
      }
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

            {form.password && (
              <div style={styles.strengthBox}>
                <div style={styles.strengthBarBg}>
                  <div
                    style={{
                      ...styles.strengthBarFill,
                      width: `${strength.percent}%`,
                      backgroundColor: strength.color
                    }}
                  />
                </div>
                <div style={{ ...styles.strengthLabel, color: strength.color }}>
                  {strength.label}
                </div>
                <ul style={styles.rulesList}>
                  {RULES.map((rule) => (
                    <li
                      key={rule.key}
                      style={{
                        ...styles.rule,
                        color: checks[rule.key] ? '#166534' : '#64748B'
                      }}
                    >
                      {checks[rule.key] ? '✓' : '○'} {rule.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: isStrong ? 1 : 0.5,
              cursor: isStrong ? 'pointer' : 'not-allowed'
            }}
            disabled={loading || !isStrong}
          >
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
  strengthBox: { marginTop: '10px' },
  strengthBarBg: {
    backgroundColor: '#E2E8F0', borderRadius: '4px',
    height: '6px', overflow: 'hidden',
  },
  strengthBarFill: { height: '100%', borderRadius: '4px', transition: 'width 0.2s' },
  strengthLabel: { fontSize: '13px', fontWeight: '600', margin: '6px 0' },
  rulesList: { listStyle: 'none', margin: 0, padding: 0 },
  rule: { fontSize: '12px', marginBottom: '3px' },
  button: {
    width: '100%', padding: '12px', backgroundColor: '#1F4E79',
    color: 'white', border: 'none', borderRadius: '4px',
    fontSize: '15px', marginTop: '8px',
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