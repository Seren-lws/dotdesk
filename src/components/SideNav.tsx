interface NavSection {
  id: string
  icon: string
  label: string
}

const sections: NavSection[] = [
  { id: 'projects', icon: 'P', label: '项目橱窗' },
  { id: 'bookmarks', icon: 'B', label: '收藏夹' },
]

interface SideNavProps {
  activeSection: string
  onNavigate: (id: string) => void
}

export default function SideNav({ activeSection, onNavigate }: SideNavProps) {
  return (
    <nav className="side-nav">
      <div className="nav-logo">dotdesk</div>
      {sections.map((s) => (
        <button
          key={s.id}
          className={`nav-item ${activeSection === s.id ? 'active' : ''}`}
          onClick={() => onNavigate(s.id)}
          aria-label={s.label}
        >
          {s.icon}
          <span className="nav-tooltip">{s.label}</span>
        </button>
      ))}
    </nav>
  )
}
