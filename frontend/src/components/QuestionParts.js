import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Renders text with LaTeX maths ($...$), inline
export function MathText({ text }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{ p: ({ node, ...props }) => <span {...props} /> }}
    >
      {text || ''}
    </ReactMarkdown>
  );
}

// Shows the diagram; if it fails to load, says so instead of leaving a blank gap
export function QuestionDiagram({ url, alt }) {
  const [failed, setFailed] = useState(false);
  if (!url) return null;

  if (failed) {
    return (
      <div style={styles.failed}>
        The diagram for this question could not be loaded.
        {alt ? ` It shows: ${alt}` : ''}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt || 'Diagram for this question'}
      onError={() => setFailed(true)}
      style={styles.image}
    />
  );
}

const styles = {
  image: {
    display: 'block', maxWidth: '100%', maxHeight: '320px',
    margin: '0 auto 16px', backgroundColor: 'white',
    border: '1px solid #E2E8F0', borderRadius: '6px',
  },
  failed: {
    backgroundColor: '#FFF7ED', color: '#92400E', border: '1px solid #FDBA74',
    borderRadius: '6px', padding: '10px 14px', fontSize: '13px',
    marginBottom: '16px', lineHeight: '1.5',
  },
};