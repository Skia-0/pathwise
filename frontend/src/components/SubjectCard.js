import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const SUBJECT_LABELS = {
  mathematics: 'Core Mathematics',
  physics: 'Elective Physics',
};

function SubjectCard() {
  const { user, updateUser } = useAuth();
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get('/subjects/my')
      .then((res) => setInfo(res.data))
      .catch(() => {});
  }, [user]);

  // Nothing to show once the student has both subjects
  if (!info || info.available_to_add.length === 0) return null;

  const toAdd = info.available_to_add[0];

  const handleAdd = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await API.post('/subjects/add', { subject: toAdd });
      updateUser(res.data.user);
      window.location.href = '/diagnostic';
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not add this subject.');
      setBusy(false);
    }
  };

  return (
    <div style={styles.card}>
      <div>
        <h3 style={styles.title}>Also studying {SUBJECT_LABELS[toAdd]}?</h3>
        <p style={styles.text}>
          Add it to your account. It gets its own diagnostic quiz, study path and progress,
          separate from {SUBJECT_LABELS[user.subject]}.
        </p>
        {error && <p style={styles.error}>{error}</p>}
      </div>
      <button onClick={handleAdd} disabled={busy} style={styles.button}>
        {busy ? 'Adding...' : `Add ${SUBJECT_LABELS[toAdd]}`}
      </button>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
    borderRadius: '8px', padding: '16px 20px', marginBottom: '24px',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '16px', flexWrap: 'wrap'
  },
  title: { color: '#1F4E79', margin: '0 0 4px 0', fontSize: '15px' },
  text: { color: '#475569', margin: 0, fontSize: '13px', lineHeight: '1.5' },
  error: { color: '#991B1B', margin: '8px 0 0 0', fontSize: '13px' },
  button: {
    backgroundColor: '#1F4E79', color: 'white', border: 'none',
    padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
};

export default SubjectCard;