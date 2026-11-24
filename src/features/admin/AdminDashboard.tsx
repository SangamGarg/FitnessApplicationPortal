import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  BadgeDollarSign,
  Bell,
  ChevronRight,
  Coins,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { portalLogout } from "../../lib/portalApi";
import PlatformOverview from "../../pages/PlatformOverview";
import DeveloperManagement from "../../pages/DeveloperManagement";
import AdminMobileUsers from "./AdminMobileUsers";
import AdminAuditLogs from "./AdminAuditLogs";
import "./AdminDashboard.css";

type AdminSection =
  | "Platform Overview"
  | "Mobile Users"
  | "MP Coins Economy"
  | "Cashout and Payout Operations"
  | "Coin Store Packs"
  | "Developers"
  | "Audit Logs"
  | "Platform Settings"

type PreviewData = {
  description: string;
  columns: string[];
  rows: string[][];
};

const navigation: { label: AdminSection; icon: LucideIcon }[] = [
  { label: "Platform Overview", icon: LayoutDashboard },
  { label: "Audit Logs", icon: History },
  { label: "Mobile Users", icon: Smartphone },
  { label: "Developers", icon: Users },
  { label: "MP Coins Economy", icon: Coins },
  { label: "Cashout and Payout Operations", icon: BadgeDollarSign },
  { label: "Coin Store Packs", icon: ArrowDownUp },
];

const previewData: Partial<Record<AdminSection, PreviewData>> = {
  "MP Coins Economy": {
    description: "Example ledger rows only. No balances are calculated or changed here.",
    columns: ["Transaction", "Type", "Direction", "Amount", "Status"],
    rows: [
      ["DEMO-TXN-2001", "Activity reward", "Credit", "120 MP", "Example"],
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
  "Platform Settings": {
    description: "Configuration values are not loaded from a backend and cannot be saved.",
    columns: ["Setting", "Current value", "Source", "Status"],
    rows: [
      ["Cashout conversion rate", "Unavailable", "Backend required", "Not configured"],
      ["Minimum cashout threshold", "Unavailable", "Backend required", "Not configured"],
      ["Coin expiry policy", "Unavailable", "Backend required", "Not configured"],
    ],
  },
};

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<AdminSection>("Platform Overview");
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
    "MP Coins Economy",
    "Cashout and Payout Operations",
  ].includes(activeSection);

  return (
    <div className="admin-portal">
      {sidebarOpen && (
        <button className="admin-mobile-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="admin-brand">
          <span className="admin-brand-mark"><Activity size={21} /></span>
          <span><strong>MusclePlay</strong><small>Admin Portal</small></span>
          <button className="admin-close-nav" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        {/* <div className="admin-workspace"><span><small>Admin Options</small></span></div> */}
        <nav className="admin-nav" aria-label="Admin workspace navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`admin-nav-item ${activeSection === label ? "active" : ""}`} onClick={() => chooseSection(label)}>
              <Icon size={17} /><span>{label}</span>{activeSection === label && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          {/* <div className="admin-security-note"><ShieldCheck size={17} /><span><strong>Protected workspace</strong><small>Server-side permissions are required for every privileged action.</small></span></div> */}
          {/* <div className="admin-profile"><span className="admin-profile-avatar">{(sessionStorage.getItem("portalName") || "A").slice(0, 1).toUpperCase()}</span><span><strong>{sessionStorage.getItem("portalName") || "Portal user"}</strong><small>{sessionStorage.getItem("portalRole") || "Portal"}</small></span></div> */}
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="admin-breadcrumb"><span>MusclePlay</span><span>/</span><strong>{activeSection}</strong></div>
          <div className="admin-top-actions">
            {activeSection !== "Mobile Users" && activeSection !== "Audit Logs" && <label className="admin-global-search"><Search size={16} /><input placeholder="Search this page" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search this page" /></label>}
            <button className="admin-icon-button" aria-label="Notifications" title="Notifications are not connected"><Bell size={18} /></button>
            <button className={`admin-icon-button ${activeSection === "Platform Settings" ? "is-active" : ""}`} aria-label="Platform Settings" title="Platform Settings" aria-current={activeSection === "Platform Settings" ? "page" : undefined} onClick={() => chooseSection("Platform Settings")}><Settings size={18} /></button>
            <span className="admin-profile-avatar">{(sessionStorage.getItem("portalName")?.trim().charAt(0) || "A").toUpperCase()}</span>
            <span className="admin-user-copy"><strong>{sessionStorage.getItem("portalName") || sessionStorage.getItem("portalEmail") || "Portal user"}</strong></span>
            <button className="portal-dev-logout" onClick={() => { void portalLogout().finally(() => { window.location.href = "/"; }); }}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </header>

        <div className="admin-content">

          {activeSection === "Platform Overview" ? (
            <PlatformOverview />
          ) : activeSection === "Developers" ? (
            <DeveloperManagement />
          ) : activeSection === "Mobile Users" ? (
            <AdminMobileUsers />
          ) : activeSection === "Audit Logs" ? (
            <AdminAuditLogs />
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
          <footer className="admin-footer"><span>MusclePlay Management Portal</span><span>{activeSection === "Mobile Users" ? "Mobile account data provided by the admin API" : "Frontend preview · Backend integration pending"}</span></footer>
        </div>
      </main>

      {showReasonDialog && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowReasonDialog(false); }}><section className="admin-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="reason-dialog-title"><button className="admin-dialog-close" onClick={() => setShowReasonDialog(false)} aria-label="Close dialog"><X size={18} /></button><span className="admin-dialog-icon"><ShieldCheck size={20} /></span><h2 id="reason-dialog-title">Protected action preview</h2><p>Enter a reason to preview the required review flow. This does not submit an action to the backend.</p><form onSubmit={submitPreviewAction}><label htmlFor="admin-action-reason">Reason <span>Required · at least 10 characters</span></label><textarea id="admin-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} required placeholder="Describe the evidence and reason for review" /><div className="admin-dialog-actions"><button type="button" className="admin-cancel-button" onClick={() => setShowReasonDialog(false)}>Cancel</button><button type="submit" className="admin-confirm-button" disabled={reason.trim().length < 10}>Preview only</button></div></form></section></div>}
    </div>
  );
}
