import { useState } from "react";
import DeveloperDashboard from "./pages/DeveloperDashboard";
import PortalAuthPage from "./pages/PortalAuthPage";
import DeveloperManagement from "./pages/DeveloperManagement";
import {
  Activity,
  Bell,
  ChevronDown,
  Code2,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import './portalLogout.css'

const navigation = [
  { label: 'Overview', group: 'MAIN', icon: LayoutDashboard },
  { label: 'Users', group: 'MAIN', icon: Users },
  { label: 'Developers', group: 'MAIN', icon: Users },
  { label: 'Workouts & Games', group: 'MAIN', icon: Dumbbell },
  { label: 'Developer Tools', group: 'DEVELOPMENT', icon: Code2 },
  { label: 'API Health', group: 'DEVELOPMENT', icon: Activity },
  { label: 'Settings', group: 'SYSTEM', icon: Settings },
]

const activityData = [
  { day: 'Mon', users: 320, sessions: 240 },
  { day: 'Tue', users: 390, sessions: 290 },
  { day: 'Wed', users: 350, sessions: 270 },
  { day: 'Thu', users: 470, sessions: 340 },
  { day: 'Fri', users: 430, sessions: 310 },
  { day: 'Sat', users: 560, sessions: 420 },
  { day: 'Sun', users: 620, sessions: 460 },
]

const metrics = [
  { label: 'Total users', value: '2,480', change: '+12.5%', icon: Users, tone: 'purple' },
  { label: 'Active today', value: '684', change: '+8.2%', icon: Activity, tone: 'blue' },
  { label: 'Workouts completed', value: '1,286', change: '+16.4%', icon: Dumbbell, tone: 'orange' },
  { label: 'Game sessions', value: '892', change: '+6.8%', icon: Zap, tone: 'green' },
]

function Dashboard() {
  const [activePage, setActivePage] = useState('Overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchText, setSearchText] = useState('')

  const isDeveloperPage = ['Developer Tools', 'API Health'].includes(activePage)

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon"><Activity size={23} /></div>
          <div>
            <div className="brand-name">Fitness<span>OS</span></div>
            <div className="brand-caption">MANAGEMENT PORTAL</div>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="workspace">
          <div className="workspace-avatar">F</div>
          <div className="workspace-info">
            <strong>Fitness Platform</strong>
            <span>Workspace</span>
          </div>
          <ChevronDown size={16} className="muted-icon" />
        </div>

        {['MAIN', 'DEVELOPMENT', 'SYSTEM'].map((group) => (
          <div className="nav-group" key={group}>
            <div className="nav-heading">{group}</div>
            {navigation.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  className={`nav-item ${activePage === item.label ? 'nav-item-active' : ''}`}
                  onClick={() => {
                    setActivePage(item.label)
                    setSidebarOpen(false)
                  }}
                >
                  <Icon size={19} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {item.label === 'API Health' && <span className="nav-dot" />}
                </button>
              )
            })}
          </div>
        ))}

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><ShieldCheck size={19} /></div>
            <strong>Platform security</strong>
            <p>Role-based access will be configured in the backend.</p>
          </div>
          <div className="profile">
            <div className="profile-avatar">A</div>
            <div className="profile-info">
              <strong>{sessionStorage.getItem("portalName") || "Portal user"}</strong>
              <span>{sessionStorage.getItem("portalRole") || "Portal"}</span>
            </div>
            <ChevronDown size={16} className="muted-icon" />
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumbs">Portal <span>/</span> <strong>{activePage}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search portal..."
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button notification-button" aria-label="Notifications">
              <Bell size={19} />
              <span />
            </button>
            <div className="topbar-divider" />
            <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={() => { sessionStorage.clear(); window.location.reload(); }}><LogOut size={17} /></button>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">{isDeveloperPage ? 'DEVELOPER CONSOLE' : activePage === 'Developers' ? 'ACCESS MANAGEMENT' : 'PLATFORM OVERVIEW'}</div>
              <h1>{activePage === 'Overview' ? 'Dashboard overview' : activePage}</h1>
              <p>
                {activePage === 'Overview'
                  ? 'Here’s what’s happening with your fitness platform today.'
                  : `Manage and monitor ${activePage.toLowerCase()} from your portal.`}
              </p>
            </div>
            <div className="welcome-actions">
              <span className="date-chip">● Demo environment</span>
              <button className="primary-button" onClick={() => setActivePage('Developer Tools')}>
                <Code2 size={17} /> Developer tools
              </button>
            </div>
          </div>

          {activePage === 'Overview' ? (
            <>
              <div className="metrics-grid">
                {metrics.map((metric) => {
                  const Icon = metric.icon
                  return (
                    <article className="metric-card" key={metric.label}>
                      <div className="metric-top">
                        <span className={`metric-icon ${metric.tone}`}><Icon size={20} /></span>
                        <span className="metric-change">{metric.change}</span>
                      </div>
                      <div className="metric-value">{metric.value}</div>
                      <div className="metric-label">{metric.label}</div>
                      <div className="metric-footer">Compared with last week</div>
                    </article>
                  )
                })}
              </div>

              <div className="content-grid">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Platform activity</h2>
                      <p>User activity over the last 7 days</p>
                    </div>
                    <select aria-label="Chart period" defaultValue="7">
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                    </select>
                  </div>
                  <div className="chart-legend">
                    <span><i className="legend-dot users-dot" /> Active users</span>
                    <span><i className="legend-dot sessions-dot" /> Sessions</span>
                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activityData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#7957E8" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#7957E8" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#32B8A0" stopOpacity={0.14} />
                            <stop offset="100%" stopColor="#32B8A0" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#EDF0F5" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8A91A2', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8A91A2', fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="users" name="Active users" stroke="#7957E8" strokeWidth={2.5} fill="url(#usersGradient)" />
                        <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#32B8A0" strokeWidth={2.5} fill="url(#sessionsGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="panel status-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>System status</h2>
                      <p>Service monitoring</p>
                    </div>
                    <span className="status-pill status-pending">Not connected</span>
                  </div>
                  <div className="service-row">
                    <div className="service-icon backend-icon"><Activity size={18} /></div>
                    <div className="service-info"><strong>Spring Boot API</strong><span>localhost:8081</span></div>
                    <span className="service-indicator pending" />
                  </div>
                  <div className="service-row">
                    <div className="service-icon database-icon"><Settings size={18} /></div>
                    <div className="service-info"><strong>PostgreSQL</strong><span>appfitness</span></div>
                    <span className="service-indicator pending" />
                  </div>
                  <div className="service-row">
                    <div className="service-icon portal-icon"><Code2 size={18} /></div>
                    <div className="service-info"><strong>Web portal</strong><span>Vite development server</span></div>
                    <span className="service-indicator online" />
                  </div>
                  <div className="status-note">
                    <ShieldCheck size={18} />
                    <span>Live backend health checks will be added after API integration.</span>
                  </div>
                </section>
              </div>

              <section className="panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent platform activity</h2>
                    <p>A preview of the events we can display when connected to your backend.</p>
                  </div>
                  <button className="text-button" onClick={() => setActivePage('Developer Tools')}>Explore tools →</button>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>EVENT</th><th>AREA</th><th>STATUS</th><th>WHEN</th></tr></thead>
                    <tbody>
                      <tr><td><span className="event-icon purple"><Users size={16} /></span> User management</td><td>Admin</td><td><span className="table-status neutral">Demo data</span></td><td>Sample</td></tr>
                      <tr><td><span className="event-icon blue"><Code2 size={16} /></span> API integration</td><td>Developer</td><td><span className="table-status pending">Pending</span></td><td>Not started</td></tr>
                      <tr><td><span className="event-icon green"><ShieldCheck size={16} /></span> Portal security</td><td>Security</td><td><span className="table-status pending">Pending</span></td><td>Not started</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : activePage === 'Developers' ? (
            <DeveloperManagement />
          ) : (
            <section className="panel placeholder-panel">
              <div className="placeholder-icon"><Code2 size={28} /></div>
              <h2>{activePage}</h2>
              <p>
                This section is ready for the next implementation step. We’ll connect it to your
                existing Spring Boot APIs after confirming the backend routes and permissions.
              </p>
              <button className="primary-button" onClick={() => setActivePage('Overview')}>
                <LayoutDashboard size={17} /> Back to overview
              </button>
            </section>
          )}

          <footer className="page-footer">
            <span>FitnessOS Portal · Development preview</span>
            <span>Frontend and backend integration pending</span>
          </footer>
        </div>
      </main>
    </div>
  )
}


export default function App() {
  const [authenticated, setAuthenticated] = useState(() => !new URLSearchParams(window.location.search).has("token") && Boolean(sessionStorage.getItem("portalToken")));
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "DEVELOPER">(() =>
    sessionStorage.getItem("portalRole") === "DEVELOPER" ? "DEVELOPER" : "ADMIN"
  );

  if (!authenticated) {
    return <PortalAuthPage onAuthenticated={(role) => { setSelectedRole(role); setAuthenticated(true); }} />;
  }
  if (selectedRole === "DEVELOPER") return <><button className="portal-dev-logout" onClick={() => { sessionStorage.clear(); window.location.reload(); }}><LogOut size={15} /> Sign out</button><DeveloperDashboard /></>;
  return <Dashboard />;
}
