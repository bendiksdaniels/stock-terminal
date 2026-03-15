import React from 'react'

export default function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <div className="spinner-container">
      <div className="spinner" />
      <span className="spinner-text">{text}</span>
    </div>
  )
}
