import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studyPath, setStudyPath] = useState(null);
  const [progress, setProgress] = useState(null);
  const [pathForm, setPathForm] = useState({ exam_date: '', daily_hours: 2 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [pathRes, progressRes] = await Promise.all([
        API.get('/studypath/my-path').catch(() => null),
        API.get('/practice/progress').catch(() => null),
      ]);
      if (pathRes) setStudyPath(pathRes.data);
      if (progressRes) setProgress(progressRes.data);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePath = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError('');
    try {
      const res = await API.post('/studypath/generate', {
        exam_date: pathForm.exam_date,
        daily_hours: parseFloat(pathForm.daily_hours),
      });
      setStudyPath(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate study path.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div style={styles.loading}>Loading your dashboard...</div>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.welcome}>Welcome back, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p style={styles.subtext}>
            Subject: <strong>{user?.subject === 'mathematics' ? 'Core Mathematics' : 'Elective Physics'}</strong>
            &nbsp;·&nbsp;
            Level: <strong style={styles.tier}>{user?.aptitude_tier?.toUpperCase() || 'Not assessed'}</strong>
          </p>
        </div>
        <button onClick={() => navigate('/practice')} style={styles.practiceBtn}>
          Start Practice Session →
        </button>
      </div>

      {/* Progress Summary */}
      {progress && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{progress.summary.average_accuracy}%</div>
            <div style={styles.statLabel}>Average Accuracy</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{progress.summary.exam_readiness_percentage}%</div>
            <div style={styles.statLabel}>Exam Readiness</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{progress.summary.total_sessions}</div>
            <div style={styles.statLabel}>Sessions Completed</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{progress.topic_performance?.length || 0}</div>
            <div style={styles.statLabel}>Topics Practised</div>
          </div>
        </div>
      )}

      {/* Study Path */}
      {!studyPath ? (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Generate Your Study Path</h2>
          <p style={styles.cardSubtext}>
            Enter your WAEC exam date and daily study availability to get a personalised study plan.
          </p>
          {error && <div style={styles.error}>{error}</div>}
          <form onSubmit={handleGeneratePath} style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.field}>
                <label style={styles.label}>WAEC Exam Date</label>
                <input
                  type="date"
                  value={pathForm.exam_date}
                  onChange={(e) => setPathForm({ ...pathForm, exam_date: e.target.value })}
                  style={styles.input}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Daily Study Hours</label>
                <select
                  value={pathForm.daily_hours}
                  onChange={(e) => setPathForm({ ...pathForm, daily_hours: e.target.value })}
                  style={styles.input}
                >
                  <option value="1">1 hour</option>
                  <option value="1.5">1.5 hours</option>
                  <option value="2">2 hours</option>
                  <option value="3">3 hours</option>
                  <option value="4">4 hours</option>
                </select>
              </div>
            </div>
            <button type="submit" style={styles.generateBtn} disabled={generating}>
              {generating ? 'Generating...' : 'Generate My Study Path'}
            </button>
          </form>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Your Study Path</h2>
            <span style={styles.progressBadge}>
              {studyPath.progress?.percentage || 0}% Complete
            </span>
          </div>
          <p style={styles.cardSubtext}>
            Exam date: <strong>{studyPath.study_path?.exam_date}</strong>
            &nbsp;·&nbsp;
            {studyPath.study_path?.daily_hours} hours/day
          </p>

          {/* Progress Bar */}
          <div style={styles.progressBarBg}>
            <div
              style={{
                ...styles.progressBarFill,
                width: `${studyPath.progress?.percentage || 0}%`
              }}
            />
          </div>

          {/* Milestones */}
          <div style={styles.milestones}>
            {studyPath.milestones?.slice(0, 8).map((m, i) => (
              <div key={m.id} style={{
                ...styles.milestone,
                backgroundColor: m.is_completed ? '#DCFCE7' : '#F4F8FC',
                borderLeft: m.is_completed ? '4px solid #166534' : '4px solid #CBD5E1'
              }}>
                <div style={styles.milestoneLeft}>
                  <span style={styles.milestoneNum}>{m.order_index}</span>
                  <span style={styles.milestoneTopic}>{m.topic}</span>
                </div>
                <span style={styles.milestoneDate}>{m.target_date}</span>
              </div>
            ))}
            {studyPath.milestones?.length > 8 && (
              <p style={styles.moreTopics}>
                + {studyPath.milestones.length - 8} more topics in your path
              </p>
            )}
          </div>
        </div>
      )}

      {/* Topic Performance */}
      {progress?.topic_performance?.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Topic Performance</h2>
          <div style={styles.topicGrid}>
            {progress.topic_performance.map((t) => (
              <div key={t.id} style={styles.topicCard}>
                <div style={styles.topicName}>{t.topic}</div>
                <div style={styles.topicStats}>
                  <span style={{
                    ...styles.accuracy,
                    color: t.average_accuracy >= 75 ? '#166534' : t.average_accuracy >= 45 ? '#92400E' : '#991B1B'
                  }}>
                    {t.average_accuracy}%
                  </span>
                  <span style={styles.difficulty}>{t.current_difficulty}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={styles.actionsRow}>
        <div style={styles.actionCard} onClick={() => navigate('/practice')}>
          <div style={styles.actionIcon}>📝</div>
          <div style={styles.actionTitle}>Practice Questions</div>
          <div style={styles.actionText}>Adaptive WAEC past paper questions</div>
        </div>
        <div style={styles.actionCard} onClick={() => navigate('/summariser')}>
          <div style={styles.actionIcon}>📚</div>
          <div style={styles.actionTitle}>Note Summariser</div>
          <div style={styles.actionText}>Turn your notes into a WAEC study guide</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '900px', margin: '0 auto', padding: '24px 16px' },
  loading: { textAlign: 'center', padding: '60px', color: '#64748B', fontSize: '16px' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '24px', flexWrap: 'wrap', gap: '12px'
  },
  welcome: { color: '#1F4E79', margin: '0 0 6px 0', fontSize: '24px' },
  subtext: { color: '#64748B', margin: 0, fontSize: '14px' },
  tier: { color: '#2E75B6', textTransform: 'capitalize' },
  practiceBtn: {
    backgroundColor: '#1F4E79', color: 'white', border: 'none',
    padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  statCard: {
    backgroundColor: 'white', padding: '20px', borderRadius: '8px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center'
  },
  statNum: { fontSize: '28px', fontWeight: 'bold', color: '#1F4E79', marginBottom: '4px' },
  statLabel: { fontSize: '12px', color: '#64748B' },
  card: {
    backgroundColor: 'white', padding: '24px', borderRadius: '8px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '24px'
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  cardTitle: { color: '#1F4E79', margin: '0 0 8px 0', fontSize: '18px' },
  cardSubtext: { color: '#64748B', fontSize: '14px', margin: '0 0 16px 0' },
  progressBadge: {
    backgroundColor: '#D6E4F0', color: '#1F4E79',
    padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600'
  },
  progressBarBg: {
    backgroundColor: '#E2E8F0', borderRadius: '4px',
    height: '8px', marginBottom: '20px', overflow: 'hidden'
  },
  progressBarFill: { backgroundColor: '#1F4E79', height: '100%', borderRadius: '4px', transition: 'width 0.3s' },
  milestones: { display: 'flex', flexDirection: 'column', gap: '8px' },
  milestone: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', borderRadius: '6px'
  },
  milestoneLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  milestoneNum: {
    backgroundColor: '#1F4E79', color: 'white',
    width: '24px', height: '24px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: 'bold', flexShrink: 0
  },
  milestoneTopic: { color: '#1E293B', fontSize: '14px' },
  milestoneDate: { color: '#64748B', fontSize: '13px' },
  moreTopics: { color: '#64748B', fontSize: '13px', textAlign: 'center', margin: '8px 0 0 0' },
  form: { marginTop: '16px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  field: {},
  label: { display: 'block', marginBottom: '6px', color: '#1E293B', fontSize: '14px', fontWeight: '500' },
  input: {
    width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1',
    borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box'
  },
  generateBtn: {
    backgroundColor: '#1F4E79', color: 'white', border: 'none',
    padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
  error: {
    backgroundColor: '#FEE2E2', color: '#991B1B',
    padding: '10px 12px', borderRadius: '4px', marginBottom: '16px', fontSize: '14px'
  },
  topicGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' },
  topicCard: {
    backgroundColor: '#F4F8FC', padding: '12px', borderRadius: '6px',
    border: '1px solid #E2E8F0'
  },
  topicName: { fontSize: '13px', color: '#1E293B', marginBottom: '8px', fontWeight: '500' },
  topicStats: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  accuracy: { fontSize: '16px', fontWeight: 'bold' },
  difficulty: {
    fontSize: '11px', backgroundColor: '#D6E4F0', color: '#1F4E79',
    padding: '2px 8px', borderRadius: '10px', textTransform: 'capitalize'
  },
  actionsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  actionCard: {
    backgroundColor: 'white', padding: '20px', borderRadius: '8px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer',
    textAlign: 'center', transition: 'transform 0.1s'
  },
  actionIcon: { fontSize: '32px', marginBottom: '8px' },
  actionTitle: { color: '#1F4E79', fontWeight: '600', fontSize: '15px', marginBottom: '4px' },
  actionText: { color: '#64748B', fontSize: '13px' },
};

export default Dashboard;