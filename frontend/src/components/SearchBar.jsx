import { useState, useRef, useEffect } from 'react'

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetch('/api/search?q=' + encodeURIComponent(query))
        .then(r => r.json())
        .then(data => {
          setSuggestions(Array.isArray(data) ? data : [])
          setShowSuggestions(true)
          setActiveSuggestion(-1)
        })
        .catch(() => setSuggestions([]))
    }, 300)
  }, [query])

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (ticker) => {
    setQuery(ticker)
    setShowSuggestions(false)
    setSuggestions([])
    onSearch(ticker)
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        onSearch(query.trim().toUpperCase())
        setShowSuggestions(false)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeSuggestion >= 0) {
        handleSelect(suggestions[activeSuggestion].ticker)
      } else if (query.trim()) {
        onSearch(query.trim().toUpperCase())
        setShowSuggestions(false)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestion(-1)
    }
  }

  return (
    <div className="search-wrapper" ref={wrapperRef}>
      <div className="search-bar">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search ticker or company name (e.g. Apple, NVDA)..."
          value={query}
          onChange={e => { setQuery(e.target.value); setShowSuggestions(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          autoComplete="off"
          spellCheck="false"
        />
        <button
          className={'search-btn ' + (loading ? 'loading' : '')}
          onClick={() => { if (query.trim()) { onSearch(query.trim().toUpperCase()); setShowSuggestions(false) } }}
          disabled={loading}
        >
          {loading ? '...' : 'SEARCH'}
        </button>
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((s, i) => (
            <li
              key={s.ticker}
              className={'suggestion-item ' + (i === activeSuggestion ? 'active' : '')}
              onMouseDown={() => handleSelect(s.ticker)}
              onMouseEnter={() => setActiveSuggestion(i)}
            >
              <span className="suggestion-ticker">{s.ticker}</span>
              <span className="suggestion-name">{s.name}</span>
              <span className="suggestion-exchange">{s.exchange}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
