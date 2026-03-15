import React, { useState } from 'react'
import Financials from './Financials'
import FundamentalsChart from './FundamentalsChart'
import FullFinancials from './FullFinancials'
import BusinessRelationships from './BusinessRelationships'
import InsiderTrades from './InsiderTrades'
import GovContracts from './GovContracts'
import OptionsVolume from './OptionsVolume'
import EarningsOdds from './EarningsOdds'
import EarningsCalendar from './EarningsCalendar'
import AccountingFlags from './AccountingFlags'
import MarketSimulation from './MarketSimulation'
import CongressTrades from './CongressTrades'
import UnusualOptions from './UnusualOptions'
import AnalystRatings from './AnalystRatings'
import InstitutionalHoldings from './InstitutionalHoldings'
import DividendHistory from './DividendHistory'
import PeerComparison from './PeerComparison'
import ShortSqueezeScore from './ShortSqueezeScore'

const TAB_GROUPS = [
  {
    key: 'fundamentals',
    label: 'FUNDAMENTALS',
    tabs: [
      { key: 'financials',    label: 'KEY METRICS' },
      { key: 'statements',    label: 'STATEMENTS' },
      { key: 'peers',         label: 'PEER COMPARISON' },
      { key: 'dividends',     label: 'DIVIDENDS' },
      { key: 'relationships', label: 'RELATIONSHIPS' },
    ],
  },
  {
    key: 'market',
    label: 'MARKET',
    tabs: [
      { key: 'options',   label: 'OPTIONS' },
      { key: 'unusual',   label: 'UNUSUAL OPTIONS' },
      { key: 'squeeze',   label: 'SHORT SQUEEZE' },
      { key: 'contracts', label: 'GOV CONTRACTS' },
    ],
  },
  {
    key: 'intelligence',
    label: 'INTELLIGENCE',
    tabs: [
      { key: 'insider',    label: 'INSIDER TRADES' },
      { key: 'congress',   label: 'CONGRESS TRADES' },
      { key: 'accounting', label: 'ACCOUNTING FLAGS' },
      { key: 'simulation', label: 'AI SIMULATION' },
    ],
  },
  {
    key: 'data',
    label: 'DATA',
    tabs: [
      { key: 'analyst',      label: 'ANALYST RATINGS' },
      { key: 'institutions', label: 'INSTITUTIONS' },
      { key: 'odds',         label: 'EARNINGS ODDS' },
      { key: 'calendar',     label: 'EARNINGS CALENDAR' },
    ],
  },
]

export default function DashboardTabs({ ticker, stockData }) {
  const [activeGroup, setActiveGroup] = useState('fundamentals')
  const [activeTab, setActiveTab]     = useState('financials')
  const [visited, setVisited]         = useState(new Set(['financials']))

  const activateGroup = (groupKey) => {
    setActiveGroup(groupKey)
    const group = TAB_GROUPS.find(g => g.key === groupKey)
    const first = group?.tabs[0]?.key
    if (first) {
      setActiveTab(first)
      setVisited(prev => new Set([...prev, first]))
    }
  }

  const activateTab = (key) => {
    setActiveTab(key)
    setVisited(prev => new Set([...prev, key]))
  }

  if (!ticker) return null

  const currentGroup = TAB_GROUPS.find(g => g.key === activeGroup)

  return (
    <div className="dashboard-tabs">
      {/* Group row */}
      <div className="tab-group-row">
        {TAB_GROUPS.map(g => (
          <button
            key={g.key}
            type="button"
            className={`tab-group-btn ${activeGroup === g.key ? 'active' : ''}`}
            onClick={() => activateGroup(g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Tab row — only current group's tabs */}
      <div className="tab-items-row">
        {currentGroup?.tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`fin-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => activateTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── FUNDAMENTALS ── */}
      <div style={{ display: activeTab === 'financials' ? 'block' : 'none' }}>
        <Financials data={stockData} />
        <FundamentalsChart ticker={ticker} />
      </div>
      <div style={{ display: activeTab === 'statements' ? 'block' : 'none' }}>
        {visited.has('statements') && <FullFinancials ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'peers' ? 'block' : 'none' }}>
        {visited.has('peers') && <PeerComparison ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'dividends' ? 'block' : 'none' }}>
        {visited.has('dividends') && <DividendHistory ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'relationships' ? 'block' : 'none' }}>
        {visited.has('relationships') && <BusinessRelationships ticker={ticker} />}
      </div>

      {/* ── MARKET ── */}
      <div style={{ display: activeTab === 'options' ? 'block' : 'none' }}>
        {visited.has('options') && <OptionsVolume ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'unusual' ? 'block' : 'none' }}>
        {visited.has('unusual') && <UnusualOptions ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'squeeze' ? 'block' : 'none' }}>
        {visited.has('squeeze') && <ShortSqueezeScore ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'contracts' ? 'block' : 'none' }}>
        {visited.has('contracts') && <GovContracts ticker={ticker} stockData={stockData} />}
      </div>

      {/* ── INTELLIGENCE ── */}
      <div style={{ display: activeTab === 'insider' ? 'block' : 'none' }}>
        {visited.has('insider') && <InsiderTrades ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'congress' ? 'block' : 'none' }}>
        {visited.has('congress') && <CongressTrades ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'accounting' ? 'block' : 'none' }}>
        {visited.has('accounting') && <AccountingFlags ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'simulation' ? 'block' : 'none' }}>
        {visited.has('simulation') && <MarketSimulation ticker={ticker} stockData={stockData} />}
      </div>

      {/* ── DATA ── */}
      <div style={{ display: activeTab === 'analyst' ? 'block' : 'none' }}>
        {visited.has('analyst') && <AnalystRatings ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'institutions' ? 'block' : 'none' }}>
        {visited.has('institutions') && <InstitutionalHoldings ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'odds' ? 'block' : 'none' }}>
        {visited.has('odds') && <EarningsOdds ticker={ticker} />}
      </div>
      <div style={{ display: activeTab === 'calendar' ? 'block' : 'none' }}>
        {visited.has('calendar') && <EarningsCalendar ticker={ticker} />}
      </div>
    </div>
  )
}
