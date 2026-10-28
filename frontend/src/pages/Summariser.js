import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const SUBJECT_LABELS = {
  mathematics: 'Core Mathematics',
  physics: 'Elective Physics',
};

function Summariser() {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [subject, setSubject] = useState(user?.subject || 'mathematics');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mismatch, setMismatch] = useState(null);
  const [activeTab, setActiveTab] = useState('summarise');

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  const fetchHistory = async () => {
    try {
      const res = await API.get('/summariser/history');
      setHistory(res.data.history);
    } catch (err) {
      setError('Failed to load history.');
    }
  };

  const runSummarise = async (subjectToUse) => {
    if (text.trim().length < 50) {
      setError('Please enter at least 50 characters of study material.');
      return;
    }
    setLoading(true);
    setError('');
    setMismatch(null);
    setResult(null);

    try {
      const res = await API.post('/summariser/summarise', { text, subject: subjectToUse });
      setSubject(subjectToUse);
      setResult(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 422 && detail?.code === 'subject_mismatch') {
        setMismatch(detail);
      } else if (err.response?.status === 503) {
        setError('The AI model is busy right now. Please try again in a minute.');
      } else {
        setError(typeof detail === 'string' ? detail : 'Summarisation failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runSummarise(subject);
  };

  const handleClear = () => {
    setText('');
    setResult(null);
    setError('');
    setMismatch(null);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Note Summariser</h1>
        <p style={styles.subtitle}>
          Paste your study notes or textbook excerpts and get a structured WAEC study guide instantly.
        </p>
      </div>

      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('summarise')}
          style={{
            ...styles.tab,
            backgroundColor: activeTab === 'summarise' ? '#1F4E79' : 'white',
            color: activeTab === 'summarise' ? 'white' : '#64748B',
          }}
        >
          Summarise Notes
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            ...styles.tab,
            backgroundColor: activeTab === 'history' ? '#1F4E79' : 'white',
            color: activeTab === 'history' ? 'white' : '#64748B',
          }}
        >
          Previous Summaries
        </button>
      </div>

      {activeTab === 'summarise' && (
        <div style={styles.card}>
          {error && <div style={styles.error}>{error}</div>}

          {mismatch && (
            <div style={styles.mismatch}>
              <p style={styles.mismatchText}>{mismatch.message}</p>
              {mismatch.detected_subject !== 'other' && (
                <button
                  type="button"
                  onClick={() => runSummarise(mismatch.detected_subject)}
                  disabled={loading}
                  style={styles.mismatchBtn}
                >
                  Summarise as {SUBJECT_LABELS[mismatch.detected_subject]} instead
                </button>
              )}
            </div>
          )}

          {!result ? (
            <form onSubmit={handleSubmit}>
              <div style={styles.field}>
                <label style={styles.label}>Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={styles.select}
                >
                  <option value="mathematics">Core Mathematics</option>
                  <option value="physics">Elective Physics</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  Your Study Material
                  <span style={styles.charCount}>{text.length} / 10,000</span>
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  style={styles.textarea}
                  placeholder="Paste your notes, textbook excerpts, or any study material here..."
                  maxLength={10000}
                  required
                />
              </div>

              <div style={styles.formActions}>
                <button
                  type="submit"
                  disabled={loading || text.trim().length < 50}
                  style={{
                    ...styles.submitBtn,
                    opacity: text.trim().length < 50 ? 0.5 : 1
                  }}
                >
                  {loading ? '✨ Generating study guide...' : '✨ Generate Study Guide'}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div style={styles.resultHeader}>
                <h3 style={styles.resultTitle}>
                  Your WAEC Study Guide · {SUBJECT_LABELS[subject]}
                </h3>
                <button onClick={handleClear} style={styles.clearBtn}>
                  ← New Summary
                </button>
              </div>

              <div style={styles.disclaimer}>⚠️ {result.disclaimer}</div>

              <div style={styles.summaryBox}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={mdComponents}
                >
                  {result.summary}
                </ReactMarkdown>
              </div>

              <button onClick={handleClear} style={styles.newBtn}>
                Summarise Another Topic
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div style={styles.card}>
          <h3 style={styles.historyTitle}>Previous Summaries</h3>
          {history.length === 0 ? (
            <p style={styles.emptyText}>No summaries yet. Generate your first one above.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} style={styles.historyItem}>
                <div style={styles.historyMeta}>
                  <span style={styles.historyDate}>
                    {new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <p style={styles.historyPreview}>{item.original_text}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: '800px', margin: '0 auto', padding: '24px 16px' },
  header: { marginBottom: '24px' },
  title: { color: '#1F4E79', margin: '0 0 8px 0', fontSize: '24px' },
  subtitle: { color: '#64748B', margin: 0, fontSize: '14px' },
  tabs: {
    display: 'flex', gap: '8px', marginBottom: '20px',
    backgroundColor: '#F4F8FC', padding: '4px',
    borderRadius: '8px', width: 'fit-content'
  },
  tab: {
    padding: '8px 20px', border: 'none', borderRadius: '6px',
    cursor: 'pointer', fontSize: '14px', transition: 'all 0.15s'
  },
  card: {
    backgroundColor: 'white', borderRadius: '10px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)', padding: '28px'
  },
  error: {
    backgroundColor: '#FEE2E2', color: '#991B1B',
    padding: '10px 12px', borderRadius: '4px',
    marginBottom: '16px', fontSize: '14px'
  },
  mismatch: {
    backgroundColor: '#FFF7ED', border: '1px solid #FDBA74',
    padding: '14px 16px', borderRadius: '6px', marginBottom: '16px'
  },
  mismatchText: { color: '#92400E', fontSize: '14px', margin: '0 0 10px 0', lineHeight: '1.5' },
  mismatchBtn: {
    backgroundColor: '#1F4E79', color: 'white', border: 'none',
    padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
  },
  field: { marginBottom: '20px' },
  label: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '8px',
    color: '#1E293B', fontSize: '14px', fontWeight: '500'
  },
  charCount: { color: '#94A3B8', fontSize: '12px', fontWeight: 'normal' },
  select: {
    width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1',
    borderRadius: '4px', fontSize: '14px', outline: 'none'
  },
  textarea: {
    width: '100%', minHeight: '200px', padding: '12px',
    border: '1px solid #CBD5E1', borderRadius: '6px',
    fontSize: '14px', lineHeight: '1.6', resize: 'vertical',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
  },
  formActions: { display: 'flex', justifyContent: 'flex-end' },
  submitBtn: {
    backgroundColor: '#1F4E79', color: 'white',
    border: 'none', padding: '12px 24px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '15px'
  },
  resultHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap'
  },
  resultTitle: { color: '#1F4E79', margin: 0, fontSize: '17px' },
  clearBtn: {
    backgroundColor: 'white', color: '#1F4E79',
    border: '1px solid #1F4E79', padding: '8px 14px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
  },
  disclaimer: {
    backgroundColor: '#FFF7ED', color: '#92400E',
    padding: '10px 14px', borderRadius: '6px',
    fontSize: '13px', marginBottom: '20px', lineHeight: '1.5'
  },
  summaryBox: {
    backgroundColor: '#F8FAFC', borderRadius: '8px',
    padding: '20px', marginBottom: '20px',
    border: '1px solid #E2E8F0', overflowX: 'auto'
  },
  mdHeading: {
    color: '#1F4E79', fontSize: '16px',
    margin: '20px 0 8px 0', fontFamily: 'Georgia, serif'
  },
  mdSubheading: {
    color: '#2E75B6', fontSize: '14px',
    margin: '16px 0 6px 0', fontWeight: '600'
  },
  mdPara: { color: '#1E293B', fontSize: '14px', lineHeight: '1.7', margin: '6px 0' },
  mdList: { margin: '6px 0', paddingLeft: '22px' },
  mdItem: { color: '#1E293B', fontSize: '14px', lineHeight: '1.7', margin: '3px 0' },
  divider: { border: 'none', borderTop: '1px solid #E2E8F0', margin: '16px 0' },
  newBtn: {
    backgroundColor: '#1F4E79', color: 'white',
    border: 'none', padding: '12px 24px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
  historyTitle: { color: '#1F4E79', margin: '0 0 16px 0', fontSize: '17px' },
  emptyText: { color: '#94A3B8', fontSize: '14px', textAlign: 'center', padding: '20px 0' },
  historyItem: {
    padding: '14px', borderRadius: '6px',
    border: '1px solid #E2E8F0', marginBottom: '12px',
    backgroundColor: '#F8FAFC'
  },
  historyMeta: { marginBottom: '6px' },
  historyDate: { color: '#64748B', fontSize: '12px' },
  historyPreview: {
    color: '#1E293B', fontSize: '13px',
    margin: 0, lineHeight: '1.5',
    display: '-webkit-box', WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical', overflow: 'hidden'
  },
};

// Styles for the Markdown elements inside the study guide
const mdComponents = {
  h1: ({ node, ...props }) => <h3 style={styles.mdHeading} {...props} />,
  h2: ({ node, ...props }) => <h3 style={styles.mdHeading} {...props} />,
  h3: ({ node, ...props }) => <h4 style={styles.mdSubheading} {...props} />,
  h4: ({ node, ...props }) => <h4 style={styles.mdSubheading} {...props} />,
  p: ({ node, ...props }) => <p style={styles.mdPara} {...props} />,
  ul: ({ node, ...props }) => <ul style={styles.mdList} {...props} />,
  ol: ({ node, ...props }) => <ol style={styles.mdList} {...props} />,
  li: ({ node, ...props }) => <li style={styles.mdItem} {...props} />,
  hr: () => <hr style={styles.divider} />,
};

export default Summariser;