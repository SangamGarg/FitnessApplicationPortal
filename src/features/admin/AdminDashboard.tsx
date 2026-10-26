import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  BadgeDollarSign,
  Bell,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Coins,
  Dumbbell,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  TicketCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { portalLogout } from "../../lib/portalApi";
import "./AdminDashboard.css";

type AdminSection =
  | "Overview"
  | "User Management"
  | "Workout and Activity Analytics"
  | "MP Coins Economy"
  | "Cashout and Payout Operations"
  | "Coin Store Packs"
  | "Referrals and Rewards"
  | "Challenges and Events"
  | "Anti-Cheat and Fraud Review"
  | "Policy and Help Center"
  | "Notifications"
  | "Audit Logs"
  | "Staff and Access Management"
  | "Platform Settings"
  | "Support Tickets";

type PreviewData = {
  description: string;
  columns: string[];
  rows: string[][];
};

const navigation: { label: AdminSection; group: string; icon: LucideIcon }[] = [
  { label: "Overview", group: "OPERATIONS", icon: LayoutDashboard },
  { label: "User Management", group: "OPERATIONS", icon: Users },
  { label: "Workout and Activity Analytics", group: "OPERATIONS", icon: Activity },
  { label: "Support Tickets", group: "OPERATIONS", icon: TicketCheck },
  { label: "MP Coins Economy", group: "FINANCE", icon: Coins },
  { label: "Cashout and Payout Operations", group: "FINANCE", icon: BadgeDollarSign },
  { label: "Coin Store Packs", group: "FINANCE", icon: ArrowDownUp },
  { label: "Referrals and Rewards", group: "GROWTH", icon: Zap },
  { label: "Challenges and Events", group: "GROWTH", icon: Dumbbell },
  { label: "Anti-Cheat and Fraud Review", group: "TRUST & SAFETY", icon: AlertTriangle },
  { label: "Policy and Help Center", group: "TRUST & SAFETY", icon: BookOpen },
  { label: "Notifications", group: "TRUST & SAFETY", icon: Bell },
  { label: "Audit Logs", group: "GOVERNANCE", icon: FileClock },
  { label: "Staff and Access Management", group: "GOVERNANCE", icon: ShieldCheck },
  { label: "Platform Settings", group: "GOVERNANCE", icon: Settings },
];

const previewData: Partial<Record<AdminSection, PreviewData>> = {
  "User Management": {
    description: "Sample records for layout review only. User data is not connected.",
    columns: ["User", "Account status", "MP Coins", "Last active"],
    rows: [
      ["MP-DEMO-1042 · Alex Morgan", "Active", "Not available", "Not connected"],
      ["MP-DEMO-1088 · Jordan Lee", "Under review", "Not available", "Not connected"],
      ["MP-DEMO-1120 · Sam Taylor", "Restricted", "Not available", "Not connected"],
    ],
  },
  "MP Coins Economy": {
    description: "Example ledger rows only. No balances are calculated or changed here.",
    columns: ["Transaction", "Type", "Direction", "Amount", "Status"],
    rows: [
      ["DEMO-TXN-2001", "Challenge reward", "Credit", "120 MP", "Example"],
      ["DEMO-TXN-2002", "Cashout reservation", "Reserve", "500 MP", "Example"],
      ["DEMO-TXN-2003", "Admin adjustment", "Debit", "Not available", "Not supported"],
    ],
  },
  "Cashout and Payout Operations": {
    description: "Illustrative requests only. Reviews here never contact a payment provider or move money.",
    columns: ["Request", "User", "Coins requested", "Net amount", "Status"],
    rows: [
      ["DEMO-CO-0142", "MP-DEMO-1042", "2,500 MP", "Not configured", "Pending review"],
      ["DEMO-CO-0143", "MP-DEMO-1088", "1,000 MP", "Not configured", "Compliance review"],
    ],
  },
  "Coin Store Packs": {
    description: "Example product configurations. Store billing and purchase verification are not connected.",
    columns: ["Product key", "Coins", "Price", "Store status", "Publication"],
    rows: [
      ["demo_starter_pack", "250 + bonus not set", "Not configured", "Not connected", "Draft"],
      ["demo_boost_pack", "1,500 + bonus not set", "Not configured", "Not connected", "Draft"],
    ],
  },
  "Referrals and Rewards": {
    description: "Sample records only. No referral attribution or rewards are connected.",
    columns: ["Referral", "Inviter", "Invitee", "Reward status", "Conversion"],
    rows: [
      ["DEMO-REF-001", "MP-DEMO-1042", "Not connected", "Unverified", "Unavailable"],
      ["DEMO-REF-002", "MP-DEMO-1088", "Not connected", "Unverified", "Unavailable"],
    ],
  },
  "Challenges and Events": {
    description: "Preview entries only. Challenge participation and results are not connected.",
    columns: ["Challenge", "State", "Participants", "Completion", "Schedule"],
    rows: [
      ["7-day movement streak", "Draft", "Unavailable", "Unavailable", "Not configured"],
      ["Boss Battle weekend", "Draft", "Unavailable", "Unavailable", "Not configured"],
    ],
  },
  "Anti-Cheat and Fraud Review": {
    description: "Illustrative review queue. Signals are not connected and never trigger automatic bans.",
    columns: ["Case", "User", "Signal", "Confidence", "Decision"],
    rows: [
      ["DEMO-RISK-001", "MP-DEMO-1088", "Emulator signal", "Low", "Human review required"],
      ["DEMO-RISK-002", "MP-DEMO-1120", "Repetition anomaly", "Unverified", "Human review required"],
    ],
  },
  "Policy and Help Center": {
    description: "Sample policy entries. Published policies and version history are not connected.",
    columns: ["Article", "Version", "Status", "Updated", "Owner"],
    rows: [
      ["Cashout policy", "Not available", "Draft", "Not connected", "Unassigned"],
      ["Community guidelines", "Not available", "Draft", "Not connected", "Unassigned"],
    ],
  },
  Notifications: {
    description: "Preview drafts only. Sending is disabled until a verified notification service is connected.",
    columns: ["Notification", "Audience", "Status", "Scheduled", "Delivery"],
    rows: [
      ["Workout reminder", "Not configured", "Draft", "Not scheduled", "Not connected"],
      ["Challenge announcement", "Not configured", "Draft", "Not scheduled", "Not connected"],
    ],
  },
  "Audit Logs": {
    description: "Audit events are unavailable until the backend audit log is integrated.",
    columns: ["Event", "Actor", "Action", "Reason", "Timestamp"],
    rows: [],
  },
  "Staff and Access Management": {
    description: "Example roles only. Changes to staff access are not available in this portal preview.",
    columns: ["Staff member", "Role", "Workspace", "Status", "Last active"],
    rows: [
      ["Portal Admin", "ADMIN", "Admin", "Preview only", "Not connected"],
      ["Portal Developer", "DEVELOPER", "Developer", "Preview only", "Not connected"],
    ],
  },
  "Platform Settings": {
    description: "Configuration values are not loaded from a backend and cannot be saved.",
    columns: ["Setting", "Current value", "Source", "Status"],
    rows: [
      ["Cashout conversion rate", "Unavailable", "Backend required", "Not configured"],
      ["Minimum cashout threshold", "Unavailable", "Backend required", "Not configured"],
      ["Coin expiry policy", "Unavailable", "Backend required", "Not configured"],
    ],
  },
  "Workout and Activity Analytics": {
    description: "No production analytics are available. This page intentionally does not invent metrics.",
    columns: ["Metric", "Value", "Source", "Availability"],
    rows: [
      ["Daily active users", "Unavailable", "Backend analytics required", "Not connected"],
      ["Workout completion rate", "Unavailable", "Backend analytics required", "Not connected"],
      ["Game participation", "Unavailable", "Backend analytics required", "Not connected"],
    ],
  },
  "Support Tickets": {
    description: "Ticket records and replies require a connected support service.",
    columns: ["Ticket", "Requester", "Topic", "Priority", "Status"],
    rows: [],
  },
};

const unavailableMetrics = [
  { label: "Registered users", icon: Users },
  { label: "Workouts today", icon: Dumbbell },
  { label: "Pending cashouts", icon: BadgeDollarSign },
  { label: "MP Coins outstanding", icon: Coins },
  { label: "Open support tickets", icon: CircleHelp },
  { label: "Active challenges", icon: Zap },
];

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<AdminSection>("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedRow, setSelectedRow] = useState<string[] | null>(null);
  const [reason, setReason] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [showReasonDialog, setShowReasonDialog] = useState(false);

  const data = previewData[activeSection];
  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((row) => {
      const matchesSearch = row.join(" ").toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "All" ||
        row.some((cell) => cell.toLowerCase().includes(statusFilter.toLowerCase()));
      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  function chooseSection(section: AdminSection) {
    setActiveSection(section);
    setSidebarOpen(false);
    setSearch("");
    setStatusFilter("All");
    setSelectedRow(null);
    setActionNotice("");
  }

  function previewSensitiveAction() {
    setReason("");
    setShowReasonDialog(true);
  }

  function submitPreviewAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim().length < 10) return;
    setShowReasonDialog(false);
    setActionNotice("Demo only: no backend request was sent and no account, balance, or payout was changed.");
  }

  const sensitive = [
    "User Management",
    "MP Coins Economy",
    "Cashout and Payout Operations",
    "Anti-Cheat and Fraud Review",
    "Staff and Access Management",
  ].includes(activeSection);

  return (
    <div className="admin-portal">
      {sidebarOpen && (
        <button className="admin-mobile-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="admin-brand">
          <span className="admin-brand-mark"><Activity size={21} /></span>
          <span><strong>MusclePlay</strong><small>MANAGEMENT PORTAL</small></span>
          <button className="admin-close-nav" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="admin-workspace"><span className="admin-workspace-avatar">M</span><span><strong>MusclePlay</strong><small>Admin workspace</small></span><ShieldCheck size={16} /></div>
        <nav className="admin-nav" aria-label="Admin workspace navigation">
          {Array.from(new Set(navigation.map((item) => item.group))).map((group) => (
            <div className="admin-nav-group" key={group}>
              <div className="admin-nav-heading">{group}</div>
              {navigation.filter((item) => item.group === group).map(({ label, icon: Icon }) => (
                <button key={label} className={`admin-nav-item ${activeSection === label ? "active" : ""}`} onClick={() => chooseSection(label)}>
                  <Icon size={17} /><span>{label}</span>{activeSection === label && <ChevronRight size={15} />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-security-note"><ShieldCheck size={17} /><span><strong>Protected workspace</strong><small>Server-side permissions are required for every privileged action.</small></span></div>
          <div className="admin-profile"><span className="admin-profile-avatar">{(sessionStorage.getItem("portalName") || "A").slice(0, 1).toUpperCase()}</span><span><strong>{sessionStorage.getItem("portalName") || "Portal user"}</strong><small>{sessionStorage.getItem("portalRole") || "Portal"}</small></span></div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="admin-breadcrumb"><span>MusclePlay</span><span>/</span><strong>{activeSection}</strong></div>
          <div className="admin-top-actions">
            <label className="admin-global-search"><Search size={16} /><input placeholder="Search this page" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search this page" /></label>
            <button className="admin-icon-button" aria-label="Notifications" title="Notifications are not connected"><Bell size={18} /></button>
            <button className="admin-icon-button" aria-label="Sign out" title="Sign out" onClick={() => { void portalLogout().finally(() => { window.location.href = "/"; }); }}><LogOut size={17} /></button>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-demo-banner"><span className="admin-demo-dot" /><strong>Portal preview</strong><span>Demo fixtures only · Admin data and operational actions are not connected</span></div>

          {activeSection === "Overview" ? (
            <>
              <div className="admin-page-heading">
                <div><div className="admin-eyebrow">ADMIN WORKSPACE</div><h1>Platform overview</h1><p>Operational metrics appear here when a trusted backend data source is connected.</p></div>
                <span className="admin-environment-pill"><span /> Demo environment</span>
              </div>
              <section className="admin-metric-grid" aria-label="Platform metrics">
                {unavailableMetrics.map(({ label, icon: Icon }) => (
                  <article className="admin-metric-card" key={label}><span className="admin-metric-icon"><Icon size={18} /></span><span className="admin-metric-label">{label}</span><strong>Unavailable</strong><small>Waiting for verified backend data</small></article>
                ))}
              </section>
              <div className="admin-overview-grid">
                <section className="admin-panel admin-analytics-panel"><div className="admin-section-title"><div><h2>Business analytics</h2><p>Activity, retention, game, coin and referral trends</p></div><span className="admin-status-tag">Not connected</span></div><div className="admin-empty-chart"><Activity size={23} /><strong>No analytics data available</strong><span>Charts will appear when real event and ledger data is integrated.</span></div></section>
                <section className="admin-panel admin-quick-panel"><div className="admin-section-title"><div><h2>Quick actions</h2><p>Jump to an operations workspace</p></div></div><div className="admin-quick-actions">
                  {[
                    ["Review support tickets", "Support Tickets", TicketCheck],
                    ["Review cashout requests", "Cashout and Payout Operations", BadgeDollarSign],
                    ["Investigate flagged users", "Anti-Cheat and Fraud Review", AlertTriangle],
                    ["Manage challenges", "Challenges and Events", Dumbbell],
                  ].map(([label, section, Icon]) => {
                    const ActionIcon = Icon as LucideIcon;
                    return <button key={label as string} onClick={() => chooseSection(section as AdminSection)}><ActionIcon size={17} /><span>{label as string}</span><ChevronRight size={15} /></button>;
                  })}
                </div></section>
              </div>
              <section className="admin-panel admin-integrity-note"><ShieldCheck size={19} /><div><strong>Financial and safety actions are not enabled</strong><p>This portal preview does not modify user accounts, coin balances, payment requests, or risk decisions. Sensitive changes require backend authorization, a reason, and an auditable server-side record.</p></div></section>
            </>
          ) : (
            <>
              <div className="admin-page-heading">
                <div><div className="admin-eyebrow">ADMIN OPERATIONS</div><h1>{activeSection}</h1><p>{data?.description || "This workspace is waiting for its backend integration."}</p></div>
                <span className="admin-status-tag">Preview only</span>
              </div>
              {actionNotice && <div className="admin-action-notice" role="status"><ShieldCheck size={17} />{actionNotice}<button onClick={() => setActionNotice("")} aria-label="Dismiss notice"><X size={15} /></button></div>}
              <section className="admin-panel admin-data-panel">
                <div className="admin-data-toolbar">
                  <div><h2>{activeSection}</h2><p>{rows.length} preview {rows.length === 1 ? "record" : "records"} · Not live data</p></div>
                  <label className="admin-filter"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Pending</option><option>Review</option><option>Active</option><option>Draft</option></select></label>
                </div>
                <div className="admin-table-scroll"><table className="admin-table"><thead><tr>{(data?.columns ?? ["Information", "Status"]).map((column) => <th key={column}>{column}</th>)}<th aria-label="Details" /></tr></thead><tbody>
                  {rows.length ? rows.map((row) => <tr key={row[0]} onClick={() => setSelectedRow(row)}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{cell}</td>)}<td><button className="admin-view-button" onClick={(event) => { event.stopPropagation(); setSelectedRow(row); }}>View</button></td></tr>) : <tr><td className="admin-table-empty" colSpan={(data?.columns.length ?? 2) + 1}><strong>{data?.rows.length ? "No matching preview records" : "No records available"}</strong><span>{data?.rows.length ? "Try changing your search or status filter." : "Real records will appear after the appropriate backend service is connected."}</span></td></tr>}
                </tbody></table></div>
                <div className="admin-table-footnote"><ShieldCheck size={15} /><span>Demo preview only. No operational data, financial values, or backend audit events are represented.</span></div>
              </section>
              {selectedRow && <aside className="admin-detail-card"><div className="admin-detail-heading"><div><span className="admin-eyebrow">RECORD PREVIEW</span><h2>{selectedRow[0]}</h2></div><button className="admin-icon-button" aria-label="Close details" onClick={() => setSelectedRow(null)}><X size={17} /></button></div><dl>{(data?.columns ?? []).map((column, index) => <div key={column}><dt>{column}</dt><dd>{selectedRow[index] || "Unavailable"}</dd></div>)}</dl><div className="admin-detail-warning"><AlertTriangle size={16} /><span>This is a fixture for UI review, not a real user or request.</span></div>{sensitive && <button className="admin-reason-button" onClick={previewSensitiveAction}>Preview protected action</button>}</aside>}
            </>
          )}
          <footer className="admin-footer"><span>MusclePlay Management Portal</span><span>Frontend preview · Backend integration pending</span></footer>
        </div>
      </main>

      {showReasonDialog && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowReasonDialog(false); }}><section className="admin-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="reason-dialog-title"><button className="admin-dialog-close" onClick={() => setShowReasonDialog(false)} aria-label="Close dialog"><X size={18} /></button><span className="admin-dialog-icon"><ShieldCheck size={20} /></span><h2 id="reason-dialog-title">Protected action preview</h2><p>Enter a reason to preview the required review flow. This does not submit an action to the backend.</p><form onSubmit={submitPreviewAction}><label htmlFor="admin-action-reason">Reason <span>Required · at least 10 characters</span></label><textarea id="admin-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} required placeholder="Describe the evidence and reason for review" /><div className="admin-dialog-actions"><button type="button" className="admin-cancel-button" onClick={() => setShowReasonDialog(false)}>Cancel</button><button type="submit" className="admin-confirm-button" disabled={reason.trim().length < 10}>Preview only</button></div></form></section></div>}
    </div>
  );
}
