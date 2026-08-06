import { useState, useCallback } from 'react'
import SideNav from './components/SideNav'
import ProjectShowcase from './components/ProjectShowcase'
import IdeaBook from './components/IdeaBook'
import MiniCalendar from './components/MiniCalendar'
import Bookmarks from './components/Bookmarks'

const decoColors = [
  'var(--color-rose-border)',
  'var(--color-sky-border)',
  'var(--color-sage-border)',
  'var(--color-lavender-border)',
  'var(--color-butter-border)',
  'var(--color-mint-border)',
  'var(--color-peach-border)',
]

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
        <header className="page-header">
          <h1 className="page-title">晚声的点阵桌</h1>
          <p className="page-subtitle">dotdesk</p>
          <div className="header-deco">
            {decoColors.map((c, i) => (
              <span
                key={i}
                className="header-deco-dot"
                style={{ background: c }}
              />
            ))}
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
      </main>
    </div>
  )
}
