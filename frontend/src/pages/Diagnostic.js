import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { MathText, QuestionDiagram } from '../components/QuestionParts';

const SUBJECT_LABELS = {
  mathematics: 'Core Mathematics',
  physics: 'Elective Physics',
};

const RETRY_MS = 6000;

const errorText = (err, fallback) => {
  if (!err.response) return 'Cannot reach the server. Check your internet connection.';
  const detail = err.response.data?.detail;
  if (typeof detail === 'string') return detail;
  return detail?.message || fallback;
};

function Diagnostic() {
  const navigate = useNavigate();
  const { user, updateUser, refreshUser, logout } = useAuth();

  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [otherSubject, setOtherSubject] = useState(null);

  // Always holds the newest answers, so saves never send stale data
  const latest = useRef({ attemptId: null, answers: {}, current: 0 });
  const inFlight = useRef(false);
  const dirty = useRef(false);
  const retryTimer = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(retryTimer.current);
    };
  }, []);

  // Saves are sent one at a time; each carries ALL answers, so a lost
  // request costs nothing and out-of-order arrival cannot lose an answer.
  const flush = useCallback(async () => {
    clearTimeout(retryTimer.current);
    if (inFlight.current) {
      dirty.current = true;
      return;
    }
    const snapshot = latest.current;
    if (!snapshot.attemptId) return;

    inFlight.current = true;
    dirty.current = false;
    setSaveStatus('saving');

    try {
      await API.patch('/diagnostic/progress', {
        attempt_id: snapshot.attemptId,
        answers: snapshot.answers,
        current_index: snapshot.current,
      });
      if (mounted.current) setSaveStatus('saved');
    } catch (err) {
      if (err.response?.status === 409) {
        navigate('/dashboard', { replace: true });
      } else if (mounted.current) {
        setSaveStatus('error');
        retryTimer.current = setTimeout(flush, RETRY_MS);
      }
    } finally {
      inFlight.current = false;
      if (dirty.current && mounted.current) flush();
    }
  }, [navigate]);

  // Retry as soon as the connection comes back
  useEffect(() => {
    const onOnline = () => flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush]);

  // Warn before closing the tab while answers are not saved yet
  useEffect(() => {
    if (saveStatus !== 'error') return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveStatus]);

  const startQuiz = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await API.post('/diagnostic/start');
      const data = res.data;
      const saved = data.answers || {};
      const index = Math.min(data.current_index || 0, data.questions.length - 1);

      setAttemptId(data.attempt_id);
      setQuestions(data.questions);
      setAnswers(saved);
      setCurrent(index);
      latest.current = { attemptId: data.attempt_id, answers: saved, current: index };

      if (data.resumed) {
        setBanner(
          `Welcome back! You have answered ${Object.keys(saved).length} of ${data.total} questions. Carry on where you left off.`
        );
      } else if (data.notice) {
        setBanner(data.notice);
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.detail?.code === 'already_completed') {
        navigate('/dashboard', { replace: true });
        return;
      }
      setLoadError(errorText(err, 'Failed to load the diagnostic. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    startQuiz();
  }, [startQuiz]);

  // If the student has another subject already set up, offer a way back to it
  useEffect(() => {
    API.get('/subjects/my')
      .then((res) => {
        const other = res.data.subjects.find(
          (s) => s.aptitude_tier && s.subject !== res.data.active_subject
        );
        setOtherSubject(other ? other.subject : null);
      })
      .catch(() => {});
  }, []);

  const handleAnswer = (questionId, key) => {
    const next = { ...answers, [questionId]: key };
    setAnswers(next);
    latest.current = { ...latest.current, answers: next, current };
    flush();
  };

  const goTo = (index) => {
    setCurrent(index);
    latest.current = { ...latest.current, current: index };
    flush();
  };

  const handleSubmit = async () => {
    const remaining = questions.length - Object.keys(answers).length;
    if (remaining > 0) {
      setError(`Please answer all questions first (${remaining} left).`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await API.post('/diagnostic/submit', { attempt_id: attemptId, answers });
      setResult(res.data);
      refreshUser().catch(() => null);
    } catch (err) {
      if (!err.response) {
        setError('Could not reach the server. Your answers are saved. Check your connection and press Submit again.');
      } else {
        setError(errorText(err, 'Submission failed. Your answers are saved, so please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      const res = await API.post('/subjects/switch', { subject: otherSubject });
      updateUser(res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(errorText(err, 'Could not switch subject.'));
    }
  };

  const handleSaveAndExit = async () => {
    setError('');
    try {
      await API.patch('/diagnostic/progress', {
        attempt_id: latest.current.attemptId,
        answers: latest.current.answers,
        current_index: latest.current.current,
      });
      logout();
      navigate('/login');
    } catch (err) {
      setError('Could not save your progress. Check your connection and try again before leaving.');
    }
  };

  const saveLabel = {
    saving: { text: 'Saving...', color: '#64748B' },
    saved: { text: '✓ Progress saved', color: '#166534' },
    error: { text: '⚠ Not saved yet. Keep this page open, we will retry automatically.', color: '#B45309' },
  }[saveStatus];

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.loadingText}>Preparing your diagnostic quiz...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.center}>
        <div style={styles.errorCard}>
          <p style={styles.errorCardText}>{loadError}</p>
          <button onClick={startQuiz} style={styles.nextBtn}>Try again</button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div style={styles.center}>
        <div style={styles.resultCard}>
          <div style={styles.resultIcon}>🎯</div>
          <h2 style={styles.resultTitle}>Diagnostic Complete!</h2>
          <div style={styles.tierBadge}>{result.aptitude_tier.toUpperCase()}</div>
          <p style={styles.resultScore}>
            You scored <strong>{result.score}%</strong> ({result.correct}/{result.total} correct)
          </p>
          <p style={styles.resultMessage}>{result.message}</p>

          <div style={styles.breakdownBox}>
            <h3 style={styles.breakdownTitle}>Topic Breakdown</h3>
            {Object.entries(result.topic_breakdown).map(([topic, accuracy]) => (
              <div key={topic} style={styles.breakdownRow}>
                <span style={styles.breakdownTopic}>{topic}</span>
                <div style={styles.breakdownBarBg}>
                  <div style={{
                    ...styles.breakdownBarFill,
                    width: `${accuracy}%`,
                    backgroundColor: accuracy >= 75 ? '#166534' : accuracy >= 45 ? '#92400E' : '#991B1B'
                  }} />
                </div>
                <span style={styles.breakdownPct}>{accuracy}%</span>
              </div>
            ))}
          </div>

          <button onClick={() => navigate('/dashboard')} style={styles.continueBtn}>
            Continue to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  if (!questions.length) return null;

  const q = questions[current];
  const answeredCount = Object.keys(answers).length;
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div style={styles.container}>
      {otherSubject && (
        <div style={styles.skipBar}>
          <span>
            Not ready for {SUBJECT_LABELS[user?.subject] || 'this subject'} right now?
          </span>
          <button onClick={handleSkip} style={styles.skipBtn}>
            Go back to {SUBJECT_LABELS[otherSubject]}
          </button>
        </div>
      )}

      <div style={styles.quizCard}>
        <div style={styles.quizHeader}>
          <div>
            <h2 style={styles.quizTitle}>
              Diagnostic Quiz{user?.subject ? ` · ${SUBJECT_LABELS[user.subject]}` : ''}
            </h2>
            <p style={styles.quizSubtitle}>
              This helps us understand your current level and build your personalised study path.
              Your answers save automatically, so you can close this page and come back any time.
            </p>
          </div>
          <div style={styles.quizMeta}>
            <span style={styles.questionCount}>
              Question {current + 1} of {questions.length}
            </span>
            <span style={styles.answeredCount}>{answeredCount} answered</span>
          </div>
        </div>

        {banner && <div style={styles.banner}>{banner}</div>}

        <div style={styles.progressBg}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>

        <div style={styles.saveRow}>
          {saveLabel && (
            <span style={{ ...styles.saveText, color: saveLabel.color }}>{saveLabel.text}</span>
          )}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.questionBox}>
          <div style={styles.questionText}>
            <span style={styles.qNum}>Q{current + 1}.</span>
            <MathText text={q.question_text} />
          </div>
          <QuestionDiagram key={q.id} url={q.diagram_url} alt={q.diagram_alt} />
          <div style={styles.options}>
            {q.options.map((opt, index) => {
              const label = ['A', 'B', 'C', 'D'][index];
              const isSelected = answers[q.id] === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => handleAnswer(q.id, opt.key)}
                  style={{
                    ...styles.option,
                    backgroundColor: isSelected ? '#1F4E79' : 'white',
                    color: isSelected ? 'white' : '#1E293B',
                    borderColor: isSelected ? '#1F4E79' : '#CBD5E1',
                  }}
                >
                  <span style={styles.optionLetter}>{label}.</span>
                  {<MathText text={opt.text} />}
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.navRow}>
          <button
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            style={{ ...styles.navBtn, opacity: current === 0 ? 0.4 : 1 }}
          >
            ← Previous
          </button>

          <div style={styles.dotRow}>
            {questions.map((item, i) => (
              <button
                key={item.id}
                onClick={() => goTo(i)}
                style={{
                  ...styles.dot,
                  backgroundColor: answers[item.id]
                    ? '#1F4E79'
                    : i === current ? '#2E75B6' : '#E2E8F0'
                }}
              />
            ))}
          </div>

          {current < questions.length - 1 ? (
            <button onClick={() => goTo(current + 1)} style={styles.nextBtn}>
              Next →
            </button>
          ) : (
                        <button onClick={handleSubmit} disabled={submitting} style={styles.submitBtn}>
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          )}
        </div>

        <div style={styles.exitRow}>
          <button onClick={handleSaveAndExit} style={styles.exitBtn}>
            Save and finish later
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '720px', margin: '0 auto', padding: '24px 16px' },
  center: {
    display: 'flex', justifyContent: 'center',
    alignItems: 'center', minHeight: '80vh', padding: '24px'
  },
  loadingText: { color: '#64748B', fontSize: '16px' },
  errorCard: {
    backgroundColor: 'white', borderRadius: '10px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)', padding: '32px',
    maxWidth: '420px', textAlign: 'center'
  },
  errorCardText: { color: '#991B1B', fontSize: '14px', margin: '0 0 16px 0', lineHeight: '1.5' },
  skipBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '12px', flexWrap: 'wrap', backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE', borderRadius: '8px',
    padding: '10px 16px', marginBottom: '16px',
    fontSize: '13px', color: '#1E3A5F'
  },
  skipBtn: {
    backgroundColor: 'white', color: '#1F4E79', border: '1px solid #1F4E79',
    padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
  },
  quizCard: {
    backgroundColor: 'white', borderRadius: '10px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)', padding: '32px'
  },
  quizHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px'
  },
  quizTitle: { color: '#1F4E79', margin: '0 0 4px 0', fontSize: '20px' },
  quizSubtitle: { color: '#64748B', margin: 0, fontSize: '13px', lineHeight: '1.5', maxWidth: '440px' },
  quizMeta: { textAlign: 'right' },
  questionCount: { display: 'block', color: '#1F4E79', fontWeight: '600', fontSize: '14px' },
  answeredCount: { display: 'block', color: '#64748B', fontSize: '13px' },
  banner: {
    backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534',
    padding: '10px 14px', borderRadius: '6px', fontSize: '13px',
    marginBottom: '16px', lineHeight: '1.5'
  },
  progressBg: {
    backgroundColor: '#E2E8F0', borderRadius: '4px',
    height: '6px', marginBottom: '8px', overflow: 'hidden'
  },
  progressFill: { backgroundColor: '#1F4E79', height: '100%', borderRadius: '4px', transition: 'width 0.3s' },
  saveRow: { minHeight: '20px', marginBottom: '16px', textAlign: 'right' },
  saveText: { fontSize: '12px' },
  error: {
    backgroundColor: '#FEE2E2', color: '#991B1B',
    padding: '10px 12px', borderRadius: '4px',
    marginBottom: '16px', fontSize: '14px'
  },
  questionBox: { marginBottom: '28px' },
  questionText: { color: '#1E293B', fontSize: '16px', lineHeight: '1.6', marginBottom: '20px' },
  qNum: { color: '#1F4E79', fontWeight: 'bold', marginRight: '8px' },
  options: { display: 'flex', flexDirection: 'column', gap: '10px' },
  option: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 16px', border: '2px solid',
    borderRadius: '6px', cursor: 'pointer',
    fontSize: '14px', textAlign: 'left',
    transition: 'all 0.15s', width: '100%'
  },
  optionLetter: { fontWeight: 'bold', flexShrink: 0, width: '20px' },
  navRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: '12px'
  },
  navBtn: {
    backgroundColor: 'white', color: '#1F4E79',
    border: '2px solid #1F4E79', padding: '10px 20px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
  nextBtn: {
    backgroundColor: '#1F4E79', color: 'white',
    border: 'none', padding: '10px 20px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
  submitBtn: {
    backgroundColor: '#166534', color: 'white',
    border: 'none', padding: '10px 24px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
  dotRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' },
  dot: {
    width: '10px', height: '10px', borderRadius: '50%',
    border: 'none', cursor: 'pointer', padding: 0
  },
  resultCard: {
    backgroundColor: 'white', borderRadius: '10px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
    padding: '40px', maxWidth: '560px', width: '100%', textAlign: 'center'
  },
  resultIcon: { fontSize: '48px', marginBottom: '12px' },
  resultTitle: { color: '#1F4E79', margin: '0 0 16px 0', fontSize: '22px' },
  tierBadge: {
    display: 'inline-block', backgroundColor: '#1F4E79', color: 'white',
    padding: '8px 24px', borderRadius: '20px',
    fontSize: '16px', fontWeight: 'bold', marginBottom: '16px'
  },
  resultScore: { color: '#1E293B', fontSize: '15px', margin: '0 0 8px 0' },
  resultMessage: { color: '#64748B', fontSize: '14px', margin: '0 0 24px 0' },
  breakdownBox: {
    backgroundColor: '#F4F8FC', borderRadius: '8px',
    padding: '16px', marginBottom: '24px', textAlign: 'left'
  },
  breakdownTitle: { color: '#1F4E79', margin: '0 0 12px 0', fontSize: '14px' },
  breakdownRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' },
  breakdownTopic: { fontSize: '12px', color: '#1E293B', width: '160px', flexShrink: 0 },
  breakdownBarBg: {
    flex: 1, backgroundColor: '#E2E8F0',
    borderRadius: '4px', height: '6px', overflow: 'hidden'
  },
  breakdownBarFill: { height: '100%', borderRadius: '4px', transition: 'width 0.3s' },
  breakdownPct: { fontSize: '12px', color: '#64748B', width: '36px', textAlign: 'right' },

  exitRow: { textAlign: 'center', marginTop: '20px' },
  exitBtn: {
    background: 'none', border: 'none', color: '#64748B',
    textDecoration: 'underline', cursor: 'pointer', fontSize: '13px'
  },
  continueBtn: {
    backgroundColor: '#1F4E79', color: 'white',
    border: 'none', padding: '12px 28px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '15px'
  },
};

export default Diagnostic;