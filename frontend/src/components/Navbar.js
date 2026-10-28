import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const SUBJECT_LABELS = {
  mathematics: 'Core Mathematics',
  physics: 'Elective Physics',
};

function Navbar() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    if (!user) {
      setSubjects([]);
      return;
    }
    API.get('/subjects/my')
      .then((res) => setSubjects(res.data.subjects))
      .catch(() => {});
  }, [user]);

  const handleSwitch = async (e) => {
    const subject = e.target.value;
    if (subject === user.subject) return;
    try {
      const res = await API.post('/subjects/switch', { subject });
      updateUser(res.data.user);
      // Full reload so every page reloads its data for the new subject
      window.location.href = res.data.user.aptitude_tier ? '/dashboard' : '/diagnostic';
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not switch subject.');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <Link to="/dashboard" style={styles.brand}>PathWise</Link>
      {user && (
        <div style={styles.links}>
        {user.aptitude_tier && (
          <>
            <Link to="/dashboard" style={styles.link}>Dashboard</Link>
            <Link to="/practice" style={styles.link}>Practice</Link>
            <Link to="/summariser" style={styles.link}>Summariser</Link>
          </>
          )}
          {subjects.length > 1 && (
            <select value={user.subject} onChange={handleSwitch} style={styles.select}>
              {subjects.map((s) => (
                <option key={s.subject} value={s.subject}>
                  {SUBJECT_LABELS[s.subject]}{s.aptitude_tier ? '' : ' (diagnostic needed)'}
                </option>
              ))}
            </select>
          )}
          <span style={styles.username}>{user.full_name}</span>
          <button onClick={handleLogout} style={styles.button}>Logout</button>
        </div>
      )}
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    backgroundColor: '#1F4E79',
    color: 'white',
  },
  brand: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '22px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  link: {
    color: '#D6E4F0',
    textDecoration: 'none',
    fontSize: '15px',
  },
  select: {
    backgroundColor: '#2E75B6',
    color: 'white',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  username: {
    color: '#D6E4F0',
    fontSize: '14px',
  },
  button: {
    backgroundColor: '#2E75B6',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  }
};

export default Navbar;