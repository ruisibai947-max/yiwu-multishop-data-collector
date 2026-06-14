import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import { getSystemStatus, setSystemPaused } from './api/client'
import { JobDetailPage } from './pages/JobDetailPage'
import { JobsPage } from './pages/JobsPage'
import { ManualArtifactPage } from './pages/ManualArtifactPage'
import { ManualRunPage } from './pages/ManualRunPage'
import { ShopsPage } from './pages/ShopsPage'
import './App.css'

const navigation = [
  { to: '/shops', code: '01', label: '店铺与账号' },
  { to: '/jobs', code: '02', label: '采集任务' },
  { to: '/manual-run', code: '03', label: '手动采集' },
  { to: '/manual-artifact', code: '04', label: '人工报表' },
]

function Shell() {
  const [paused, setPaused] = useState(false)
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    void getSystemStatus().then((status) => setPaused(status.jobPickupPaused))
  }, [])

  async function togglePickup() {
    setChanging(true)
    try {
      const status = await setSystemPaused(!paused)
      setPaused(status.jobPickupPaused)
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">YW</div>
          <div>
            <strong>经营数据中枢</strong>
            <span>LOCAL OPS CONSOLE</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="主导航">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span className="nav-code">{item.code}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="signal-dot" />
          <div>
            <strong>本地服务在线</strong>
            <span>127.0.0.1:4310</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">YIWU / MULTI-SHOP AUTOMATION</span>
            <strong>{paused ? '新任务已暂停领取' : '采集系统运行中'}</strong>
          </div>
          <button
            className={paused ? 'control-button resume' : 'control-button pause'}
            type="button"
            disabled={changing}
            onClick={() => void togglePickup()}
          >
            {changing ? '处理中' : paused ? '恢复任务领取' : '暂停新任务'}
          </button>
        </header>
        <div className="page-stage">
          <Routes>
            <Route path="/shops" element={<ShopsPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/manual-run" element={<ManualRunPage />} />
            <Route path="/manual-artifact" element={<ManualArtifactPage />} />
            <Route path="*" element={<Navigate to="/jobs" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
