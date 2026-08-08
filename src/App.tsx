import { useState, useCallback } from 'react'
import SideNav from './components/SideNav'
import ProjectShowcase from './components/ProjectShowcase'
import IdeaBook from './components/IdeaBook'
import MiniCalendar from './components/MiniCalendar'
import Bookmarks from './components/Bookmarks'
import JobOverview from './components/JobOverview'
import HealthTracker from './components/HealthTracker'
import SleepLog from './components/SleepLog'
import BillingTracker from './components/BillingTracker'

export default function App() {
  const [activeSection, setActiveSection] = useState('projects')

  const handleNavigate = useCallback((id: string) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  return (
    <div className="app-layout">
      <SideNav activeSection={activeSection} onNavigate={handleNavigate} />
      <main className="main-content">
        <header className="hero-banner">
          <div className="desk-sign">
            <h1>DOTDESK</h1>
            <p>晚声的私人工作台</p>
          </div>
          <div className="hero-banner-frame">
            <img src="/dotdesk-cats-banner.gif" alt="水边像素工坊里休息的两只黑猫" />
          </div>
        </header>

        <div className="two-col">
          <div className="col-main">
            <ProjectShowcase />
          </div>
          <div className="col-side">
            <IdeaBook />
            <MiniCalendar />
          </div>
        </div>

        <Bookmarks />

        <JobOverview />

        <div className="two-col health-sleep-row">
          <div>
            <HealthTracker />
          </div>
          <div>
            <SleepLog />
          </div>
        </div>

        <BillingTracker />

        <footer className="closing-banner">
          <div className="closing-sign">
            <strong>DOTDESK</strong>
            <span>今天也辛苦啦 · 明天见</span>
          </div>
          <img
            src="/dotdesk-footer.gif"
            alt="雨天窗边的像素植物花园"
          />
        </footer>
      </main>
    </div>
  )
}
