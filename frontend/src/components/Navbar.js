import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <Link to="/dashboard" style={styles.brand}>PathWise</Link>
      {user && (
        <div style={styles.links}>
          <Link to="/dashboard" style={styles.link}>Dashboard</Link>
          <Link to="/practice" style={styles.link}>Practice</Link>
          <Link to="/summariser" style={styles.link}>Summariser</Link>
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