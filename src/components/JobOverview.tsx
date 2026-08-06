export default function JobOverview() {
  return (
    <section id="job" className="section">
      <h2 className="section-title">
        <span
          className="section-icon"
          style={{
            borderColor: 'var(--color-peach-border)',
            color: 'var(--color-peach-text)',
            background: 'var(--color-peach-light)',
          }}
        >
          J
        </span>
        转职之旅
      </h2>

      <div className="job-card pixel-card peach">
        <div className="job-header">
          <div>
            <p className="card-title">目标：AI 行业</p>
            <p className="card-desc">从医疗中介跨行到 AI，用作品说话</p>
          </div>
          <span className="card-tag status-building">探索中</span>
        </div>

        <div className="job-stats">
          <div className="job-stat">
            <span className="job-stat-num">5+</span>
            <span className="job-stat-label">个人项目</span>
          </div>
          <div className="job-stat">
            <span className="job-stat-num">6/10</span>
            <span className="job-stat-label">正式退职</span>
          </div>
        </div>

        <a
          className="job-link"
          href="https://career-ship.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
        >
          {'>'} 前往转职之船查看详情
        </a>
      </div>
    </section>
  )
}
