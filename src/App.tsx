import { useState, useCallback } from 'react'
import SideNav from './components/SideNav'
import ProjectShowcase from './components/ProjectShowcase'
import Bookmarks from './components/Bookmarks'

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
          <h1 className="page-title">
            <span className="pixel-star" /> 晚声的点阵桌 <span className="pixel-star" />
          </h1>
          <p className="page-subtitle">dotdesk</p>
        </header>

        <ProjectShowcase />
        <Bookmarks />
      </main>
    </div>
  )
}
