import { useState, useEffect } from 'react'

export default function NotesPanel({ ticker }) {
  const key = ticker ? `st_notes_${ticker}` : null
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(true)

  useEffect(() => {
    if (!key) return
    setText(localStorage.getItem(key) || '')
    setSaved(true)
  }, [key])

  const handleChange = (e) => {
    setText(e.target.value)
    setSaved(false)
  }

  const handleSave = () => {
    if (!key) return
    localStorage.setItem(key, text)
    setSaved(true)
  }

  if (!ticker) return (
    <div style={{ padding: 20, color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
      Search for a stock to add notes.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 12px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1 }}>
          {ticker}
        </div>
        <button onClick={handleSave} style={{
          background: saved ? 'transparent' : 'var(--accent)',
          border: '1px solid ' + (saved ? 'var(--border)' : 'var(--accent)'),
          color: saved ? 'var(--muted)' : '#000',
          borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 700,
          transition: 'all 0.15s',
        }}>{saved ? 'SAVED' : 'SAVE'}</button>
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={handleSave}
        placeholder={`Notes for ${ticker}...\n\nThesis:\n\nKey metrics:\n- \n`}
        style={{
          width: '100%', boxSizing: 'border-box',
          resize: 'none', background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--white2)', fontSize: 12, lineHeight: 1.8,
          padding: '10px 12px', outline: 'none', fontFamily: 'inherit',
          height: 'calc(100vh - 320px)', minHeight: 200,
        }}
      />
    </div>
  )
}
