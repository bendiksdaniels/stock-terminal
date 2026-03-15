import React, { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'

const BADGE_CLASS = {
  customer: 'badge-customer',
  supplier: 'badge-supplier',
  partner: 'badge-partner',
  competitor: 'badge-competitor',
  acquisition: 'badge-acquisition',
  licensee: 'badge-licensee',
}

function getBadgeClass(type) {
  if (!type) return 'badge-default'
  const key = type.toLowerCase()
  for (const k of Object.keys(BADGE_CLASS)) {
    if (key.includes(k)) return BADGE_CLASS[k]
  }
  return 'badge-default'
}

export default function RelationshipsTable({ relationships, loading }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sorted = [...(relationships || [])].sort((a, b) => {
    if (!sortCol) return 0
    const av = (a[sortCol] || '').toString().toLowerCase()
    const bv = (b[sortCol] || '').toString().toLowerCase()
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortArrow = ({ col }) => {
    if (sortCol !== col)
      return (
        <span className="sort-arrow" style={{ opacity: 0.2 }}>
          ↕
        </span>
      )
    return <span className="sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="relationships-panel">
      <div className="panel-title">10-K Relationships Analysis</div>

      {loading ? (
        <LoadingSpinner text="Analyzing 10-K filing..." />
      ) : !relationships || relationships.length === 0 ? (
        <div className="empty-state">No relationships found in 10-K filing</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="row-num">#</th>
                <th onClick={() => handleSort('company')}>
                  Company <SortArrow col="company" />
                </th>
                <th onClick={() => handleSort('relationship')}>
                  Relationship <SortArrow col="relationship" />
                </th>
                <th onClick={() => handleSort('value')}>
                  Contract / Value <SortArrow col="value" />
                </th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((rel, i) => (
                <tr key={i}>
                  <td className="row-num">{i + 1}</td>
                  <td>{rel.company || rel.entity || 'N/A'}</td>
                  <td>
                    <span
                      className={`badge ${getBadgeClass(
                        rel.relationship || rel.type
                      )}`}
                    >
                      {rel.relationship || rel.type || 'Unknown'}
                    </span>
                  </td>
                  <td>{rel.value || rel.contract_value || '—'}</td>
                  <td
                    className="context-cell"
                    title={rel.context || rel.sentence || ''}
                  >
                    {rel.context || rel.sentence || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
