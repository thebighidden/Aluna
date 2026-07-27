import Link from 'next/link';

const metrics = [
  { label: 'Images generated', value: '12,840', change: '+18.4%', icon: '✦' },
  { label: 'Active campaigns', value: '284', change: '+9.2%', icon: '▦' },
  { label: 'Avg. generation time', value: '8.4s', change: '−1.6s', icon: '◷' },
  { label: 'Estimated spend', value: '$501.32', change: '+6.1%', icon: '$' },
];

const runs = [
  {
    product: 'Maison Élan Serum',
    category: 'Cosmetics',
    scene: 'Soft Studio',
    images: 4,
    status: 'Done',
    cost: '$0.16',
    time: '8.2s',
  },
  {
    product: 'Aster Running Shoe',
    category: 'Clothing',
    scene: 'Modern Street',
    images: 6,
    status: 'Generating',
    cost: '$0.24',
    time: '—',
  },
  {
    product: 'Noma Pendant',
    category: 'Jewelry',
    scene: 'Velvet Gallery',
    images: 4,
    status: 'Done',
    cost: '$0.16',
    time: '9.1s',
  },
  {
    product: 'Fold Task Chair',
    category: 'Furniture',
    scene: 'Architectural Loft',
    images: 3,
    status: 'Done',
    cost: '$0.12',
    time: '11.4s',
  },
  {
    product: 'Orbit Headphones',
    category: 'Electronics',
    scene: 'Precision Tech',
    images: 4,
    status: 'Queued',
    cost: '—',
    time: '—',
  },
];

export default function AdminPage() {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand admin-brand" href="/">
          <span className="brand-mark">A</span>
          <span>Aluna</span>
          <span className="brand-badge">Admin</span>
        </Link>
        <p className="admin-nav-label">Workspace</p>
        <nav className="nav-list" aria-label="Admin navigation">
          <Link className="nav-item nav-item-active" href="/admin">
            <span className="nav-icon">⌁</span>Overview
          </Link>
          <Link className="nav-item" href="/studio">
            <span className="nav-icon">✦</span>Studio
          </Link>
          <button className="nav-item" type="button">
            <span className="nav-icon">▦</span>Generations
          </button>
          <button className="nav-item" type="button">
            <span className="nav-icon">◉</span>Users
          </button>
          <button className="nav-item" type="button">
            <span className="nav-icon">◇</span>Storage
          </button>
        </nav>
        <p className="admin-nav-label">System</p>
        <nav className="nav-list">
          <button className="nav-item" type="button">
            <span className="nav-icon">⚙</span>Settings
          </button>
          <button className="nav-item" type="button">
            <span className="nav-icon">≋</span>API health
          </button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="admin-user">
          <span>AM</span>
          <div>
            <strong>Alex Morgan</strong>
            <small>Workspace owner</small>
          </div>
          <i>•••</i>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p>Operations</p>
            <h1>Good morning, Alex.</h1>
          </div>
          <div className="admin-top-actions">
            <button type="button" aria-label="Search">
              ⌕
            </button>
            <button type="button" aria-label="Notifications">
              ◌
            </button>
            <Link href="/studio">✦ New generation</Link>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-overview-heading">
            <div>
              <h2>Workspace overview</h2>
              <p>Performance across all product-photo generation activity.</p>
            </div>
            <button type="button">
              Last 30 days <span>⌄</span>
            </button>
          </div>

          <section className="metric-grid">
            {metrics.map((metric) => (
              <article className="metric-card" key={metric.label}>
                <div>
                  <span>{metric.icon}</span>
                  <small>{metric.change}</small>
                </div>
                <p>{metric.label}</p>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </section>

          <section className="admin-grid">
            <article className="analytics-card">
              <div className="card-heading">
                <div>
                  <span>Generation volume</span>
                  <strong>Images created</strong>
                </div>
                <div className="legend">
                  <i /> This period <i /> Previous
                </div>
              </div>
              <div className="chart-total">
                <strong>12.8k</strong>
                <span>+18.4% vs previous period</span>
              </div>
              <div className="bar-chart" aria-label="Generation volume chart">
                {[42, 55, 48, 68, 61, 84, 76, 92, 72, 88, 95, 86].map((height, index) => (
                  <div className="bar-pair" key={index}>
                    <i style={{ height: `${Math.max(20, height - 19)}%` }} />
                    <span style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
              <div className="chart-labels">
                <span>Jul 1</span>
                <span>Jul 8</span>
                <span>Jul 15</span>
                <span>Jul 22</span>
                <span>Jul 30</span>
              </div>
            </article>

            <article className="queue-card">
              <div className="card-heading">
                <div>
                  <span>Live system</span>
                  <strong>Queue health</strong>
                </div>
                <span className="healthy-pill">
                  <i /> Healthy
                </span>
              </div>
              <div className="queue-ring">
                <strong>7</strong>
                <span>active jobs</span>
              </div>
              <div className="queue-stats">
                <div>
                  <i className="dot-generating" />
                  <span>Generating</span>
                  <strong>4</strong>
                </div>
                <div>
                  <i className="dot-queued" />
                  <span>Queued</span>
                  <strong>3</strong>
                </div>
                <div>
                  <i className="dot-failed" />
                  <span>Failed today</span>
                  <strong>1</strong>
                </div>
              </div>
              <div className="worker-row">
                <span>Workers online</span>
                <strong>2 / 2</strong>
              </div>
            </article>
          </section>

          <section className="runs-card">
            <div className="runs-heading">
              <div>
                <span>Activity</span>
                <h2>Recent generations</h2>
              </div>
              <button type="button">
                View all <span>→</span>
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Scene</th>
                    <th>Images</th>
                    <th>Status</th>
                    <th>Cost</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, index) => (
                    <tr key={run.product}>
                      <td>
                        <span className={`product-thumb thumb-${index + 1}`}>
                          <i />
                        </span>
                        <strong>{run.product}</strong>
                      </td>
                      <td>{run.category}</td>
                      <td>{run.scene}</td>
                      <td>{run.images}</td>
                      <td>
                        <span className={`run-status status-${run.status.toLowerCase()}`}>
                          <i />
                          {run.status}
                        </span>
                      </td>
                      <td>{run.cost}</td>
                      <td>{run.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
