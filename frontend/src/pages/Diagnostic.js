import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

function Diagnostic() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await API.get('/diagnostic/questions');
      setQuestions(res.data.questions);
    } catch (err) {
      setError('Failed to load questions. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleNext = () => {
    if (current < questions.length - 1) setCurrent(current + 1);
  };

  const handlePrev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      setError('Please answer all questions before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await API.post('/diagnostic/submit', { answers });
      setResult(res.data);
    } catch (err) {
      setError('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={styles.center}>
      <p style={styles.loadingText}>Loading your diagnostic quiz...</p>
    </div>
  );

  if (result) return (
    <div style={styles.center}>
      <div style={styles.resultCard}>
        <div style={styles.resultIcon}>🎯</div>
        <h2 style={styles.resultTitle}>Diagnostic Complete!</h2>
        <div style={styles.tierBadge}>
          {result.aptitude_tier.toUpperCase()}
        </div>
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

        <button
          onClick={() => navigate('/dashboard')}
          style={styles.continueBtn}
        >
          Continue to Dashboard →
        </button>
      </div>
    </div>
  );

  const q = questions[current];
  const answeredCount = Object.keys(answers).length;
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div style={styles.container}>
      <div style={styles.quizCard}>
        {/* Header */}
        <div style={styles.quizHeader}>
          <div>
            <h2 style={styles.quizTitle}>Diagnostic Quiz</h2>
            <p style={styles.quizSubtitle}>
              This helps us understand your current level and build your personalised study path.
            </p>
          </div>
          <div style={styles.quizMeta}>
            <span style={styles.questionCount}>
              Question {current + 1} of {questions.length}
            </span>
            <span style={styles.answeredCount}>
              {answeredCount} answered
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={styles.progressBg}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* Question */}
        <div style={styles.questionBox}>
          <p style={styles.questionText}>
            <span style={styles.qNum}>Q{current + 1}.</span> {q.question_text}
          </p>
          <div style={styles.options}>
            {['A', 'B', 'C', 'D'].map((letter) => {
              const optionKey = `option_${letter.toLowerCase()}`;
              const isSelected = answers[q.id] === letter;
              return (
                <button
                  key={letter}
                  onClick={() => handleAnswer(q.id, letter)}
                  style={{
                    ...styles.option,
                    backgroundColor: isSelected ? '#1F4E79' : 'white',
                    color: isSelected ? 'white' : '#1E293B',
                    borderColor: isSelected ? '#1F4E79' : '#CBD5E1',
                  }}
                >
                  <span style={styles.optionLetter}>{letter}.</span>
                  {q[optionKey]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div style={styles.navRow}>
          <button
            onClick={handlePrev}
            disabled={current === 0}
            style={{ ...styles.navBtn, opacity: current === 0 ? 0.4 : 1 }}
          >
            ← Previous
          </button>

          <div style={styles.dotRow}>
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  ...styles.dot,
                  backgroundColor: answers[questions[i]?.id]
                    ? '#1F4E79'
                    : i === current ? '#2E75B6' : '#E2E8F0'
                }}
              />
            ))}
          </div>

          {current < questions.length - 1 ? (
            <button onClick={handleNext} style={styles.nextBtn}>
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={styles.submitBtn}
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '720px', margin: '0 auto', padding: '24px 16px'
  },
  center: {
    display: 'flex', justifyContent: 'center',
    alignItems: 'center', minHeight: '80vh', padding: '24px'
  },
  loadingText: { color: '#64748B', fontSize: '16px' },
  quizCard: {
    backgroundColor: 'white', borderRadius: '10px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)', padding: '32px'
  },
  quizHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px'
  },
  quizTitle: { color: '#1F4E79', margin: '0 0 4px 0', fontSize: '20px' },
  quizSubtitle: { color: '#64748B', margin: 0, fontSize: '13px' },
  quizMeta: { textAlign: 'right' },
  questionCount: {
    display: 'block', color: '#1F4E79',
    fontWeight: '600', fontSize: '14px'
  },
  answeredCount: { display: 'block', color: '#64748B', fontSize: '13px' },
  progressBg: {
    backgroundColor: '#E2E8F0', borderRadius: '4px',
    height: '6px', marginBottom: '28px', overflow: 'hidden'
  },
  progressFill: {
    backgroundColor: '#1F4E79', height: '100%',
    borderRadius: '4px', transition: 'width 0.3s'
  },
  error: {
    backgroundColor: '#FEE2E2', color: '#991B1B',
    padding: '10px 12px', borderRadius: '4px',
    marginBottom: '16px', fontSize: '14px'
  },
  questionBox: { marginBottom: '28px' },
  questionText: {
    color: '#1E293B', fontSize: '16px',
    lineHeight: '1.6', marginBottom: '20px'
  },
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
  breakdownRow: {
    display: 'flex', alignItems: 'center',
    gap: '10px', marginBottom: '8px'
  },
  breakdownTopic: { fontSize: '12px', color: '#1E293B', width: '160px', flexShrink: 0 },
  breakdownBarBg: {
    flex: 1, backgroundColor: '#E2E8F0',
    borderRadius: '4px', height: '6px', overflow: 'hidden'
  },
  breakdownBarFill: { height: '100%', borderRadius: '4px', transition: 'width 0.3s' },
  breakdownPct: { fontSize: '12px', color: '#64748B', width: '36px', textAlign: 'right' },
  continueBtn: {
    backgroundColor: '#1F4E79', color: 'white',
    border: 'none', padding: '12px 28px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '15px'
  },
};

export default Diagnostic;