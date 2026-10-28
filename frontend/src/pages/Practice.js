import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { MathText, QuestionDiagram } from '../components/QuestionParts';

const MATHEMATICS_TOPICS = [
  "Number and Numeration", "Fractions and Decimals", "Algebraic Expressions",
  "Linear Equations", "Sets", "Simultaneous Equations", "Quadratic Equations",
  "Indices and Logarithms", "Mensuration", "Plane Geometry", "Geometry",
  "Trigonometry", "Statistics", "Probability", "Vectors", "Calculus"
];

const PHYSICS_TOPICS = [
  "Measurements and Units", "Scalars and Vectors", "Motion", "Forces",
  "Work, Energy and Power", "Pressure", "Waves", "Sound", "Light",
  "Heat and Temperature", "Electricity", "Magnetism",
  "Atomic and Nuclear Physics", "Electronics", "Energy and Society"
];

function Practice() {
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [difficulty, setDifficulty] = useState('');

  const topics = user?.subject === 'mathematics' ? MATHEMATICS_TOPICS : PHYSICS_TOPICS;

  const startSession = async () => {
    if (!selectedTopic) {
      setError('Please select a topic first.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setAnswers({});
    setCurrent(0);

    try {
      const res = await API.get(`/practice/questions/${encodeURIComponent(selectedTopic)}`);
      setQuestions(res.data.questions);
      setDifficulty(res.data.difficulty);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load questions.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      setError('Please answer all questions before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const res = await API.post('/practice/submit-session', {
        topic: selectedTopic,
        answers
      });
      setResult(res.data);
      setQuestions([]);
    } catch (err) {
      setError('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Topic selection screen
  if (!questions.length && !result) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>Practice Session</h2>
          <p style={styles.subtitle}>
            Select a topic to start. Questions will be served at your current difficulty level.
          </p>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.topicGrid}>
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => setSelectedTopic(topic)}
                style={{
                  ...styles.topicBtn,
                  backgroundColor: selectedTopic === topic ? '#1F4E79' : 'white',
                  color: selectedTopic === topic ? 'white' : '#1E293B',
                  borderColor: selectedTopic === topic ? '#1F4E79' : '#CBD5E1',
                }}
              >
                {topic}
              </button>
            ))}
          </div>
          <button
            onClick={startSession}
            disabled={loading || !selectedTopic}
            style={{
              ...styles.startBtn,
              opacity: !selectedTopic ? 0.5 : 1
            }}
          >
            {loading ? 'Loading questions...' : 'Start Session →'}
          </button>
        </div>
      </div>
    );
  }

  // Results screen
  if (result) {
    const { score, adaptive_feedback } = result;
    return (
      <div style={styles.centerContainer}>
        <div style={styles.resultCard}>
          <div style={styles.resultIcon}>
            {score.accuracy >= 75 ? '🌟' : score.accuracy >= 45 ? '💪' : '📖'}
          </div>
          <h2 style={styles.resultTitle}>Session Complete!</h2>
          <p style={styles.topicLabel}>{selectedTopic}</p>

          <div style={styles.scoreRow}>
            <div style={styles.scoreBox}>
              <div style={styles.scoreNum}>{score.accuracy}%</div>
              <div style={styles.scoreLabel}>Accuracy</div>
            </div>
            <div style={styles.scoreBox}>
              <div style={styles.scoreNum}>{score.correct}/{score.total}</div>
              <div style={styles.scoreLabel}>Correct</div>
            </div>
            <div style={styles.scoreBox}>
              <div style={{
                ...styles.scoreNum,
                color: adaptive_feedback.action === 'advanced' ? '#166534' :
                       adaptive_feedback.action === 'remediated' ? '#991B1B' : '#1F4E79'
              }}>
                {adaptive_feedback.new_difficulty?.toUpperCase()}
              </div>
              <div style={styles.scoreLabel}>Next Level</div>
            </div>
          </div>

          <div style={{
            ...styles.feedbackBox,
            backgroundColor: adaptive_feedback.action === 'advanced' ? '#DCFCE7' :
                             adaptive_feedback.action === 'remediated' ? '#FEE2E2' : '#EFF6FF',
            borderColor: adaptive_feedback.action === 'advanced' ? '#166534' :
                         adaptive_feedback.action === 'remediated' ? '#991B1B' : '#2E75B6',
          }}>
            <p style={styles.feedbackMsg}>{adaptive_feedback.message}</p>
          </div>

          {/* Question review */}
          <div style={styles.reviewBox}>
            <h3 style={styles.reviewTitle}>Question Review</h3>
            {result.results.map((r, i) => (
              <div key={r.question_id} style={{
                ...styles.reviewRow,
                backgroundColor: r.is_correct ? '#F0FDF4' : '#FFF5F5'
              }}>
                <span style={styles.reviewIcon}>{r.is_correct ? '✅' : '❌'}</span>
                <div style={styles.reviewContent}>
                  <p style={styles.reviewQuestion}>{<MathText text={r.question_text} />}</p>
                  {!r.is_correct && (
                    <p style={styles.reviewAnswer}>
                      Your answer: <strong>{r.user_answer_text ? <MathText text={r.user_answer_text} /> : 'No answer'}</strong> &nbsp;|&nbsp;
                      Correct: <strong style={{ color: '#166534' }}>{<MathText text={r.correct_answer_text} />}</strong>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.resultActions}>
            <button onClick={() => { setResult(null); setQuestions([]); }} style={styles.retryBtn}>
              Practice Another Topic
            </button>
            <button onClick={startSession} style={styles.againBtn}>
              Same Topic Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz screen
  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div style={styles.container}>
      <div style={styles.quizCard}>
        <div style={styles.quizHeader}>
          <div>
            <h2 style={styles.quizTitle}>{selectedTopic}</h2>
            <span style={styles.difficultyBadge}>{difficulty} level</span>
          </div>
          <div style={styles.quizMeta}>
            <span style={styles.qCount}>Q{current + 1} of {questions.length}</span>
            <span style={styles.answeredLabel}>{Object.keys(answers).length} answered</span>
          </div>
        </div>

        <div style={styles.progressBg}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
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
            onClick={() => setCurrent(current - 1)}
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
                    ? '#1F4E79' : i === current ? '#2E75B6' : '#E2E8F0'
                }}
              />
            ))}
          </div>
          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent(current + 1)} style={styles.nextBtn}>
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} style={styles.submitBtn}>
              {submitting ? 'Submitting...' : 'Submit Session'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '720px', margin: '0 auto', padding: '24px 16px' },
  centerContainer: {
    display: 'flex', justifyContent: 'center',
    padding: '24px 16px', minHeight: '80vh', alignItems: 'flex-start'
  },
  card: {
    backgroundColor: 'white', borderRadius: '10px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)', padding: '32px'
  },
  title: { color: '#1F4E79', margin: '0 0 8px 0', fontSize: '22px' },
  subtitle: { color: '#64748B', margin: '0 0 24px 0', fontSize: '14px' },
  error: {
    backgroundColor: '#FEE2E2', color: '#991B1B',
    padding: '10px 12px', borderRadius: '4px',
    marginBottom: '16px', fontSize: '14px'
  },
  topicGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px', marginBottom: '24px'
  },
  topicBtn: {
    padding: '10px 12px', border: '2px solid',
    borderRadius: '6px', cursor: 'pointer',
    fontSize: '13px', textAlign: 'left', transition: 'all 0.15s'
  },
  startBtn: {
    backgroundColor: '#1F4E79', color: 'white',
    border: 'none', padding: '12px 28px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '15px'
  },
  quizCard: {
    backgroundColor: 'white', borderRadius: '10px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)', padding: '32px'
  },
  quizHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px'
  },
  quizTitle: { color: '#1F4E79', margin: '0 0 6px 0', fontSize: '18px' },
  difficultyBadge: {
    backgroundColor: '#D6E4F0', color: '#1F4E79',
    padding: '3px 10px', borderRadius: '12px',
    fontSize: '12px', textTransform: 'capitalize', fontWeight: '600'
  },
  quizMeta: { textAlign: 'right' },
  qCount: { display: 'block', color: '#1F4E79', fontWeight: '600', fontSize: '14px' },
  answeredLabel: { display: 'block', color: '#64748B', fontSize: '13px' },
  progressBg: {
    backgroundColor: '#E2E8F0', borderRadius: '4px',
    height: '6px', marginBottom: '24px', overflow: 'hidden'
  },
  progressFill: {
    backgroundColor: '#1F4E79', height: '100%',
    borderRadius: '4px', transition: 'width 0.3s'
  },
  questionBox: { marginBottom: '24px' },
  questionText: { color: '#1E293B', fontSize: '16px', lineHeight: '1.6', marginBottom: '16px' },
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
    padding: '32px', maxWidth: '600px', width: '100%'
  },
  resultIcon: { fontSize: '40px', textAlign: 'center', marginBottom: '8px' },
  resultTitle: { color: '#1F4E79', textAlign: 'center', margin: '0 0 4px 0', fontSize: '20px' },
  topicLabel: { color: '#64748B', textAlign: 'center', margin: '0 0 20px 0', fontSize: '14px' },
  scoreRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' },
  scoreBox: {
    backgroundColor: '#F4F8FC', padding: '16px',
    borderRadius: '8px', textAlign: 'center'
  },
  scoreNum: { fontSize: '22px', fontWeight: 'bold', color: '#1F4E79', marginBottom: '4px' },
  scoreLabel: { fontSize: '12px', color: '#64748B' },
  feedbackBox: {
    border: '1px solid', borderRadius: '8px',
    padding: '12px 16px', marginBottom: '20px'
  },
  feedbackMsg: { margin: 0, fontSize: '14px', color: '#1E293B', textAlign: 'center' },
  reviewBox: { marginBottom: '20px' },
  reviewTitle: { color: '#1F4E79', margin: '0 0 12px 0', fontSize: '15px' },
  reviewRow: {
    display: 'flex', gap: '12px', padding: '10px 12px',
    borderRadius: '6px', marginBottom: '8px', alignItems: 'flex-start'
  },
  reviewIcon: { fontSize: '16px', flexShrink: 0, marginTop: '2px' },
  reviewContent: { flex: 1 },
  reviewQuestion: { margin: '0 0 4px 0', fontSize: '13px', color: '#1E293B' },
  reviewAnswer: { margin: 0, fontSize: '12px', color: '#64748B' },
  resultActions: { display: 'flex', gap: '12px', justifyContent: 'center' },
  retryBtn: {
    backgroundColor: 'white', color: '#1F4E79',
    border: '2px solid #1F4E79', padding: '10px 20px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
  againBtn: {
    backgroundColor: '#1F4E79', color: 'white',
    border: 'none', padding: '10px 20px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
};

export default Practice;