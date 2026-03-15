import { useState, useEffect, useCallback } from 'react'

export default function NewsModal({ article, onClose }) {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch article content — pass full_text from RSS if available
  useEffect(() => {
    if (!article?.url) return
    setLoading(true)
    setContent(null)
    setError(null)
    const params = new URLSearchParams({ url: article.url })
    if (article.full_text) params.set('full_text', article.full_text)
    fetch(`/api/article?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error || !d.paragraphs?.length) {
          setError(d.error || 'Could not load full article.')
        } else {
          setContent(d)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to fetch article.')
        setLoading(false)
      })
  }, [article?.url])

  // Close on Escape
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  if (!article) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-meta">
            {article.publisher && <span className="modal-publisher">{article.publisher}</span>}
            {article.date && <span className="modal-date">{article.date}</span>}
          </div>
          <button className="modal-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Article title */}
        <div className="modal-title">{content?.title || article.title}</div>

        {/* Summary always shown */}
        {article.summary && (
          <div className="modal-summary">{article.summary}</div>
        )}

        {/* Body */}
        <div className="modal-body">
          {loading && (
            <div className="modal-loading">
              <div className="loading-spinner-sm" />
              <span>Loading article...</span>
            </div>
          )}

          {error && (
            <div className="modal-error">
              <p>{error}</p>
              {article.summary && (
                <p className="modal-paragraph" style={{ marginTop: 16 }}>{article.summary}</p>
              )}
              <a className="modal-ext-link" href={article.url} target="_blank" rel="noopener noreferrer">
                Open original article →
              </a>
            </div>
          )}

          {content && content.paragraphs.map((p, i) => {
            if (p.type === 'heading') {
              return <h3 key={i} className="modal-heading">{p.text}</h3>
            }
            if (p.type === 'quote') {
              return <blockquote key={i} className="modal-quote">{p.text}</blockquote>
            }
            if (p.type === 'bullet') {
              return <div key={i} className="modal-bullet">· {p.text}</div>
            }
            return <p key={i} className="modal-paragraph">{p.text}</p>
          })}

          {content && (
            <div className="modal-footer">
              <a className="modal-ext-link" href={article.url} target="_blank" rel="noopener noreferrer">
                Read original article →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
