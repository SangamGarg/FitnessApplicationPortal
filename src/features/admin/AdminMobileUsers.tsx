import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Clipboard, LoaderCircle,
  RefreshCw, Search, ShieldAlert, Smartphone, Users, X,
} from "lucide-react";
import {
  getMobileUser, listMobileUsers, MobileUsersApiError, updateMobileUserStatus,
} from "../../lib/mobileUsersApi";
import type {
  MobileAccountStatus, MobileUsersDiagnostic, MobileUsersPage, MobileUserAdminResponseDto,
} from "../../lib/mobileUsersApi";
import "./AdminMobileUsers.css";

const statuses: MobileAccountStatus[] = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];
const emptyPage: MobileUsersPage = { content: [], totalElements: null, totalPages: null, number: 0, size: 20 };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function unwrap(value: unknown): unknown {
  let current = value;
  for (let index = 0; index < 2; index += 1) {
    const record = asRecord(current);
    if (!record || ("content" in record) || ("id" in record)) break;
    if ("data" in record) current = record.data;
    else if ("result" in record) current = record.result;
    else break;
  }
  return current;
}

function parseUser(value: unknown): MobileUserAdminResponseDto | null {
  const record = asRecord(unwrap(value));
  if (!record || typeof record.id !== "string" || typeof record.name !== "string" || typeof record.email !== "string" || !statuses.includes(record.status as MobileAccountStatus)) return null;
  const nullableString = (field: unknown) => typeof field === "string" ? field : null;
  const nullableNumber = (field: unknown) => typeof field === "number" && Number.isFinite(field) ? field : null;
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    gender: nullableString(record.gender),
    age: nullableNumber(record.age),
    profileImageUrl: nullableString(record.profileImageUrl),
    heightCm: nullableNumber(record.heightCm),
    weightKg: nullableNumber(record.weightKg),
    activityLevel: nullableString(record.activityLevel),
    goal: nullableString(record.goal),
    status: record.status as MobileAccountStatus,
  };
}

function parsePage(value: unknown, page: number, size: number): MobileUsersPage {
  const root = asRecord(unwrap(value));

  if (!root || !Array.isArray(root.content)) {
    throw new Error("The mobile user list response did not contain a valid page.");
  }

  // Supports both pagination structures:
  // 1. Spring Page: { content, totalElements, totalPages, number, size }
  // 2. Custom wrapper: { content, page: { totalElements, totalPages, number, size } }

  const pagination = asRecord(root.page) ?? root;

  const records = root.content
    .map(parseUser)
    .filter((user): user is MobileUserAdminResponseDto => user !== null);

  const totalElements =
    typeof pagination.totalElements === "number" &&
    Number.isFinite(pagination.totalElements) &&
    pagination.totalElements >= 0
      ? pagination.totalElements
      : null;

  const totalPages =
    typeof pagination.totalPages === "number" &&
    Number.isFinite(pagination.totalPages) &&
    pagination.totalPages >= 0
      ? pagination.totalPages
      : null;

  return {
    content: records,
    totalElements,
    totalPages,

    number:
      typeof pagination.number === "number" && pagination.number >= 0
        ? Math.floor(pagination.number)
        : page,

    size:
      typeof pagination.size === "number" && pagination.size > 0
        ? Math.min(100, Math.floor(pagination.size))
        : size,

    ...(typeof pagination.first === "boolean"
      ? { first: pagination.first }
      : {}),

    ...(typeof pagination.last === "boolean"
      ? { last: pagination.last }
      : {}),

    ...(typeof pagination.empty === "boolean"
      ? { empty: pagination.empty }
      : {}),
  };
}

function label(value?: string | null): string {
  if (!value) return "Not provided";
  return value.toLowerCase().split(/[_\s]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "U";
}

function safeImageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

function allowedStatuses(current: MobileAccountStatus): MobileAccountStatus[] {
  if (current === "ACTIVE") return ["SUSPENDED", "DEACTIVATED"];
  if (current === "SUSPENDED") return ["ACTIVE", "DEACTIVATED"];
  return ["ACTIVE", "SUSPENDED"];
}

function describeChange(status: MobileAccountStatus): string {
  if (status === "SUSPENDED") return "This may temporarily restrict the user from accessing the mobile application.";
  if (status === "DEACTIVATED") return "This will deactivate the user's mobile account and may prevent application access.";
  return "This will reactivate the user's mobile account if the backend permits the transition.";
}

function ProfileAvatar({ user, large = false }: { user: Pick<MobileUserAdminResponseDto, "name" | "profileImageUrl">; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const image = safeImageUrl(user.profileImageUrl);
  return <span className={`mobile-user-avatar ${large ? "large" : ""}`}>{image && !failed ? <img src={image} alt="" onError={() => setFailed(true)} /> : <span aria-hidden="true">{initials(user.name)}</span>}</span>;
}

function statusClass(status: MobileAccountStatus): string { return `mobile-status ${status.toLowerCase()}`; }

export default function AdminMobileUsers() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MobileAccountStatus>("ACTIVE");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [pageData, setPageData] = useState<MobileUsersPage>(emptyPage);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedUser, setSelectedUser] = useState<MobileUserAdminResponseDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<MobileUserAdminResponseDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<MobileAccountStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [diagnostics, setDiagnostics] = useState<MobileUsersDiagnostic[]>([]);
  const listSequence = useRef(0);
  const listController = useRef<AbortController | null>(null);
  const detailController = useRef<AbortController | null>(null);
  const statusController = useRef<AbortController | null>(null);

  const recordDiagnostic = useCallback((diagnostic: MobileUsersDiagnostic) => {
    setDiagnostics((current) => [diagnostic, ...current].slice(0, 12));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      listController.current?.abort();
      const controller = new AbortController();
      listController.current = controller;
      const sequence = ++listSequence.current;
      setLoading(true);
      setListError("");
      void listMobileUsers({ query, status, page: pageIndex, size: pageSize }, controller.signal)
        .then((result) => {
          recordDiagnostic(result.diagnostic);
          if (sequence !== listSequence.current || controller.signal.aborted) return;
          const parsed = parsePage(result.data, pageIndex, pageSize);
          setPageData(parsed);
          if (parsed.totalPages !== null && parsed.totalPages > 0 && pageIndex >= parsed.totalPages) setPageIndex(parsed.totalPages - 1);
        })
        .catch((error: unknown) => {
          if (error instanceof MobileUsersApiError) {
            if (!error.aborted) recordDiagnostic(error.diagnostic);
            if (!error.aborted && sequence === listSequence.current) setListError(error.message);
      } else if (sequence === listSequence.current) setListError(error instanceof Error ? error.message : "Could not load mobile users. Try again.");
        })
        .finally(() => {
          if (sequence === listSequence.current) setLoading(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      listSequence.current += 1;
      listController.current?.abort();
    };
  }, [query, status, pageIndex, pageSize, refreshKey, recordDiagnostic]);

  useEffect(() => () => {
    listController.current?.abort();
    detailController.current?.abort();
    statusController.current?.abort();
  }, []);

  const loadDetails = useCallback(async (user: MobileUserAdminResponseDto) => {
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    setSelectedUser(user);
    setDetailOpen(true);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const result = await getMobileUser(user.id, controller.signal);
      recordDiagnostic(result.diagnostic);
      if (controller.signal.aborted) return;
      const parsed = parseUser(result.data);
      if (!parsed) throw new Error("The user details response did not contain the expected user information.");
      setDetail(parsed);
    } catch (error) {
      if (error instanceof MobileUsersApiError) {
        if (!error.aborted) { recordDiagnostic(error.diagnostic); setDetailError(error.message); }
      } else if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : "Could not load user details.");
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  }, [recordDiagnostic]);

  function openStatusConfirmation(user: MobileUserAdminResponseDto, next: MobileAccountStatus) {
    setSelectedUser(user);
    setActionError("");
    setPendingStatus(next);
  }

  async function confirmStatusChange() {
    if (!selectedUser || !pendingStatus || statusBusy) return;
    const user = selectedUser;
    const nextStatus = pendingStatus;
    statusController.current?.abort();
    const controller = new AbortController();
    statusController.current = controller;
    setStatusBusy(true);
    setActionError("");
    try {
      const result = await updateMobileUserStatus(user.id, nextStatus, controller.signal);
      recordDiagnostic(result.diagnostic);
      let updatedUser = parseUser(result.data);
      if (!updatedUser) {
        const detailResult = await getMobileUser(user.id, controller.signal);
        recordDiagnostic(detailResult.diagnostic);
        updatedUser = parseUser(detailResult.data);
      }
      if (!updatedUser) throw new Error("The status request succeeded, but the updated user details could not be confirmed. Refresh the list before retrying.");
      setPageData((current) => ({ ...current, content: current.content.map((item) => item.id === updatedUser!.id ? updatedUser! : item) }));
      setDetail((current) => current?.id === updatedUser!.id ? updatedUser : current);
      setSelectedUser((current) => current?.id === updatedUser!.id ? updatedUser : current);
      setPendingStatus(null);
      setNotice(`${updatedUser.name}'s account status is now ${label(updatedUser.status)}.`);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      if (error instanceof MobileUsersApiError) {
        if (!error.aborted) { recordDiagnostic(error.diagnostic); setActionError(error.message); }
      } else if (!controller.signal.aborted) setActionError(error instanceof Error ? error.message : "Could not update the account status.");
    } finally {
      if (!controller.signal.aborted) setStatusBusy(false);
    }
  }

  async function copyUserId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  function clearFilters() {
    setQuery("");
    setStatus("ACTIVE");
    setPageIndex(0);
  }

  const totalPages = pageData.totalPages;
  const hasPrevious = pageData.first ?? pageIndex <= 0;
  const hasNext = pageData.last ?? (totalPages !== null ? pageIndex < totalPages - 1 : pageData.content.length >= pageSize);

  return <div className="admin-mobile-users">
    <div className="admin-mobile-users-heading">
      <div><div className="admin-eyebrow">ACCOUNT OPERATIONS</div><h1>Mobile App Users</h1><p>Registered mobile application accounts.</p></div>
      <div className="mobile-users-heading-actions"><span className="mobile-users-total"><Users size={16} />{pageData.totalElements === null ? "Total unavailable" : `${pageData.totalElements.toLocaleString()} ${query.trim() || status !== "ACTIVE" ? "matching users" : "active users"}`}</span><button className="mobile-users-button secondary" onClick={() => setRefreshKey((current) => current + 1)} disabled={loading}><RefreshCw size={15} className={loading ? "mobile-users-spin" : ""} />Refresh</button></div>
    </div>

    {notice && <div className="mobile-users-notice" role="status"><Check size={16} />{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={15} /></button></div>}
    {listError && <div className="mobile-users-error" role="alert"><AlertCircle size={17} /><span>{listError}{pageData.content.length > 0 ? " Previously loaded results are still shown." : ""}</span><button className="mobile-users-button secondary" onClick={() => setRefreshKey((current) => current + 1)}>Retry</button></div>}

    <section className="admin-panel mobile-users-panel">
      <div className="mobile-users-toolbar">
        <label className="mobile-users-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPageIndex(0); }} placeholder="Search mobile users" aria-label="Search mobile users" /><button type="button" onClick={() => { setQuery(""); setPageIndex(0); }} disabled={!query} aria-label="Clear search"><X size={14} /></button></label>
        <label className="mobile-users-filter"><span>Status</span><select aria-label="Filter by account status" value={status} onChange={(event) => { const next = event.target.value; if (statuses.includes(next as MobileAccountStatus)) setStatus(next as MobileAccountStatus); setPageIndex(0); }}>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
        <button className="mobile-users-button subtle" onClick={clearFilters} disabled={!query && status === "ACTIVE"}><X size={14} />Clear filters</button>
        <small className="mobile-users-helper">Search users using the supported backend search criteria.</small>
      </div>

      <div className="mobile-users-table-wrap"><table className="admin-table mobile-users-table"><thead><tr><th>User</th><th>Status</th><th>Age</th><th>Gender</th><th>Fitness goal</th><th>Activity level</th><th>Actions</th></tr></thead><tbody>
        {loading ? Array.from({ length: 5 }, (_, index) => <tr className="mobile-users-skeleton-row" key={`loading-${index}`}><td colSpan={7}><span /></td></tr>) : pageData.content.length ? pageData.content.map((user) => <tr key={user.id}><td><div className="mobile-users-identity"><ProfileAvatar key={user.id} user={user} /><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td><td><span className={statusClass(user.status)}>{label(user.status)}</span></td><td>{user.age ?? "—"}</td><td>{label(user.gender)}</td><td>{label(user.goal)}</td><td>{label(user.activityLevel)}</td><td><div className="mobile-users-row-actions"><button className="mobile-users-button subtle" onClick={() => void loadDetails(user)}>View</button><label className="mobile-users-action-select"><span className="sr-only">Change status for {user.name}</span><select aria-label={`Change status for ${user.name}`} value="" onChange={(event) => { const next = event.target.value; if (statuses.includes(next as MobileAccountStatus) && next !== user.status) openStatusConfirmation(user, next as MobileAccountStatus); }}><option value="" disabled>Manage</option>{allowedStatuses(user.status).map((next) => <option value={next} key={next}>{label(next)}</option>)}</select><ChevronDown size={12} /></label></div></td></tr>) : <tr><td className="mobile-users-empty" colSpan={7}><span className="mobile-users-empty-icon"><Smartphone size={21} /></span><strong>{listError ? "Users could not be loaded" : query || status !== "ACTIVE" ? "No matching users" : "No active users yet"}</strong><small>{listError ? "Retry the request to load the current user list." : query || status !== "ACTIVE" ? "Try adjusting your search or selecting another status." : "Registered active accounts will appear here."}</small></td></tr>}
      </tbody></table></div>

      <footer className="mobile-users-pagination"><span>{pageData.totalElements !== null ? `${pageData.totalElements.toLocaleString()} total records` : `Page ${pageIndex + 1}`}{totalPages !== null ? ` · ${totalPages} ${totalPages === 1 ? "page" : "pages"}` : ""}</span><label>Rows<select value={pageSize} onChange={(event) => { setPageSize(Math.min(100, Math.max(1, Number(event.target.value)))); setPageIndex(0); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label><span className="mobile-users-page-label">Page {pageData.number + 1}{totalPages !== null ? ` of ${Math.max(1, totalPages)}` : ""}</span><div><button className="mobile-users-button secondary" aria-label="Previous page" disabled={loading || hasPrevious || pageIndex <= 0} onClick={() => setPageIndex((current) => Math.max(0, current - 1))}><ArrowLeft size={14} />Previous</button><button className="mobile-users-button secondary" aria-label="Next page" disabled={loading || hasNext} onClick={() => setPageIndex((current) => current + 1)}>Next<ArrowRight size={14} /></button></div></footer>
    </section>

    <details className="admin-panel mobile-users-diagnostics"><summary>API request diagnostics <span>{diagnostics.length ? `${diagnostics.length} recent operations` : "No requests yet"}</span></summary><div className="mobile-users-diagnostic-list">{diagnostics.length ? diagnostics.map((item, index) => <article key={`${item.requestedAt}-${index}`}><header><code>{item.method} {item.endpoint}</code><span className={item.success ? "success" : "failure"}>{item.success ? "Successful" : "Failed"}{item.httpStatus ? ` · HTTP ${item.httpStatus}` : ""}</span></header><p>Requested {new Date(item.requestedAt).toLocaleString()}{item.respondedAt ? ` · Response ${new Date(item.respondedAt).toLocaleString()}` : ""} · {item.durationMs.toLocaleString()} ms</p>{item.requestParameters && <pre><strong>Parameters</strong>{JSON.stringify(item.requestParameters, null, 2)}</pre>}{item.requestPayload !== undefined && item.requestPayload !== null && <pre><strong>Request payload</strong>{JSON.stringify(item.requestPayload, null, 2)}</pre>}{item.responsePayload !== undefined && <pre><strong>Response payload</strong>{JSON.stringify(item.responsePayload, null, 2)}</pre>}{item.error && <small>{item.error}</small>}</article>) : <div className="mobile-users-diagnostics-empty">The list request diagnostics will appear here after loading.</div>}</div></details>

    {selectedUser && detailOpen && <div className="mobile-users-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { detailController.current?.abort(); setDetailOpen(false); setSelectedUser(null); setDetail(null); setDetailError(""); } }}><aside className="mobile-users-drawer" role="dialog" aria-modal="true" aria-labelledby="mobile-user-detail-title"><header className="mobile-users-drawer-header"><div><div className="admin-eyebrow">MOBILE ACCOUNT</div><h2 id="mobile-user-detail-title">User details</h2></div><button className="mobile-users-icon-button" aria-label="Close user details" onClick={() => { detailController.current?.abort(); setDetailOpen(false); setSelectedUser(null); setDetail(null); setDetailError(""); }}><X size={17} /></button></header>
      {detailLoading ? <div className="mobile-users-detail-loading"><LoaderCircle size={20} className="mobile-users-spin" />Loading user details…</div> : detailError ? <div className="mobile-users-detail-error" role="alert"><AlertCircle size={18} /><p>{detailError}</p><button className="mobile-users-button secondary" onClick={() => void loadDetails(selectedUser)}>Retry details</button></div> : detail ? <><div className="mobile-users-profile"><ProfileAvatar user={detail} large /><div><h3>{detail.name}</h3><span>{detail.email}</span><span className={statusClass(detail.status)}>{label(detail.status)}</span></div></div><div className="mobile-users-id"><span>User ID</span><code>{detail.id}</code><button className="mobile-users-icon-button" aria-label="Copy user ID" title="Copy user ID" onClick={() => void copyUserId(detail.id)}>{copied ? <Check size={15} /> : <Clipboard size={15} />}</button><small>{copied ? "Copied" : "Copy ID"}</small></div><section className="mobile-users-detail-section"><h3>Fitness profile</h3><dl><div><dt>Gender</dt><dd>{label(detail.gender)}</dd></div><div><dt>Age</dt><dd>{detail.age === null ? "Not provided" : `${detail.age} years`}</dd></div><div><dt>Height</dt><dd>{detail.heightCm === null ? "Not provided" : `${detail.heightCm.toLocaleString()} cm`}</dd></div><div><dt>Weight</dt><dd>{detail.weightKg === null ? "Not provided" : `${detail.weightKg.toLocaleString()} kg`}</dd></div><div><dt>Activity level</dt><dd>{label(detail.activityLevel)}</dd></div><div><dt>Fitness goal</dt><dd>{label(detail.goal)}</dd></div></dl></section><section className="mobile-users-detail-section"><h3>Account management</h3><p>Current status: <span className={statusClass(detail.status)}>{label(detail.status)}</span></p><div className="mobile-users-detail-actions">{allowedStatuses(detail.status).map((next) => <button key={next} className={`mobile-users-button ${next === "DEACTIVATED" ? "danger" : "secondary"}`} onClick={() => openStatusConfirmation(detail, next)}>{label(next)}</button>)}</div></section></> : null}
      <details className="mobile-users-detail-diagnostics"><summary>User detail request diagnostics</summary>{[...diagnostics].find((item) => item.method === "GET" && item.endpoint.endsWith(`/${encodeURIComponent(selectedUser.id)}`)) ? <pre>{JSON.stringify([...diagnostics].find((item) => item.method === "GET" && item.endpoint.endsWith(`/${encodeURIComponent(selectedUser.id)}`)), null, 2)}</pre> : <small>Open the details endpoint diagnostics in API request diagnostics.</small>}</details>
    </aside></div>}

    {pendingStatus && selectedUser && <div className="mobile-users-overlay confirmation" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !statusBusy) setPendingStatus(null); }}><section className="mobile-users-confirm" role="dialog" aria-modal="true" aria-labelledby="mobile-status-confirm-title"><span className="mobile-users-confirm-icon"><ShieldAlert size={20} /></span><button className="mobile-users-icon-button mobile-users-confirm-close" aria-label="Close confirmation" disabled={statusBusy} onClick={() => setPendingStatus(null)}><X size={16} /></button><h2 id="mobile-status-confirm-title">Confirm account status change</h2><p>You are about to <strong>{pendingStatus === "ACTIVE" ? "activate" : pendingStatus === "SUSPENDED" ? "suspend" : "deactivate"}</strong> this user's mobile account.</p><div className="mobile-users-confirm-user"><strong>{selectedUser.name}</strong><span>{selectedUser.email}</span><small>Current status: {label(selectedUser.status)} · New status: {label(pendingStatus)}</small></div><div className="mobile-users-confirm-explanation">{describeChange(pendingStatus)} The backend will enforce the permitted status transition.</div>{actionError && <div className="mobile-users-inline-error" role="alert"><AlertCircle size={14} />{actionError}</div>}<footer><button className="mobile-users-button secondary" disabled={statusBusy} onClick={() => setPendingStatus(null)}>Cancel</button><button className={`mobile-users-button ${pendingStatus === "DEACTIVATED" ? "danger" : "primary"}`} disabled={statusBusy} onClick={() => void confirmStatusChange()}>{statusBusy && <LoaderCircle size={14} className="mobile-users-spin" />}{statusBusy ? "Updating…" : `Confirm ${label(pendingStatus).toLowerCase()}`}</button></footer></section></div>}
  </div>;
}
