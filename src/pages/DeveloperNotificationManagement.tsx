import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, BellRing, Check, ChevronLeft, ChevronRight, Clipboard, Clock3, Image, LoaderCircle, RefreshCw, Search, Send, ShieldAlert, Users, X } from "lucide-react";
import { lastNotificationHttpStatus, notificationApi, NotificationApiError, type AppUserForNotification, type BulkFcmNotificationRequest, type FcmDeliveryResult, type FcmNotificationRequest, type NotificationOutboxStatus, type PortalNotificationAnalytics, type PortalNotificationHistory } from "../lib/notificationApi";
import "./DeveloperNotificationManagement.css";

type Inspector = { method: string; endpoint: string; request: unknown; status: number | null; duration: number; response: unknown; error?: string; at: string };
const statuses: NotificationOutboxStatus[] = ["PENDING", "PROCESSING", "RETRY_WAIT", "SENT", "NO_DEVICES", "FAILED"];
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : "—";

export default function DeveloperNotificationManagement() {
  const [tab, setTab] = useState<"Overview" | "Send Notification" | "Notification History">("Overview");
  const [analytics, setAnalytics] = useState<PortalNotificationAnalytics | null>(null);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [users, setUsers] = useState<AppUserForNotification[]>([]);
  const [usersBusy, setUsersBusy] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [dataRows, setDataRows] = useState<Array<{ key: string; value: string }>>([]);
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [delivery, setDelivery] = useState<FcmDeliveryResult | null>(null);
  const [history, setHistory] = useState<PortalNotificationHistory[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [status, setStatus] = useState<"" | NotificationOutboxStatus>("");
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [detail, setDetail] = useState<PortalNotificationHistory | null>(null);
  const [inspector, setInspector] = useState<Inspector | null>(null);

  const runRequest = useCallback(async <T,>(method: string, endpoint: string, request: unknown, action: () => Promise<T>): Promise<T> => {
    const start = performance.now(); const at = new Date().toISOString();
    try {
      const response = await action();
      setInspector({ method, endpoint, request, status: lastNotificationHttpStatus, duration: Math.round(performance.now() - start), response, at });
      return response;
    } catch (error) {
      const apiError = error instanceof NotificationApiError ? error : new NotificationApiError(error instanceof Error ? error.message : "Unexpected error.");
      setInspector({ method, endpoint, request, status: apiError.status, duration: Math.round(performance.now() - start), response: apiError.responseBody, error: apiError.message, at });
      throw apiError;
    }
  }, []);

  const loadAnalytics = useCallback(async () => { setAnalyticsBusy(true); setAnalyticsError(""); try { const data = await runRequest("GET", "/api/v1/portal/dev/notification/history/analytics", null, notificationApi.getAnalytics); setAnalytics(data); } catch (error) { setAnalyticsError(error instanceof Error ? error.message : "Could not load analytics."); } finally { setAnalyticsBusy(false); } }, [runRequest]);
  const loadUsers = useCallback(async () => { setUsersBusy(true); setUsersError(""); try { const data = await runRequest("GET", "/api/v1/portal/dev/notification/users", null, notificationApi.getUsers); setUsers(Array.isArray(data) ? data.filter((u) => u && typeof u.email === "string") : []); } catch (error) { setUsersError(error instanceof Error ? error.message : "Could not load app users."); } finally { setUsersBusy(false); } }, [runRequest]);
  const loadHistory = useCallback(async () => { setHistoryBusy(true); setHistoryError(""); try { const query = { page: Math.max(0, page), size: Math.max(1, size), ...(status ? { status } : {}) }; const result = await runRequest("GET", "/api/v1/portal/dev/notification/history", query, () => notificationApi.getHistory(query)); setHistory(Array.isArray(result.content) ? result.content : []); setTotalElements(result.totalElements ?? 0); setTotalPages(result.totalPages ?? 0); } catch (error) { setHistoryError(error instanceof Error ? error.message : "Could not load notification history."); } finally { setHistoryBusy(false); } }, [page, size, status, runRequest]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadAnalytics(); void loadUsers(); }, 0); return () => window.clearTimeout(timer); }, [loadAnalytics, loadUsers]);
  useEffect(() => { if (tab !== "Notification History") return; const timer = window.setTimeout(() => void loadHistory(), 0); return () => window.clearTimeout(timer); }, [tab, loadHistory]);

  const filteredUsers = useMemo(() => { const q = search.trim().toLowerCase(); return users.filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q)); }, [users, search]);
  const selectedUsers = useMemo(() => { const emails = new Set(selected); return users.filter((user) => emails.has(user.email)); }, [selected, users]);
  const toggle = (email: string) => setSelected((current) => current.includes(email) ? current.filter((item) => item !== email) : [...current, email]);
  const validImage = (() => { if (!imageUrl.trim() || imageUrl.length > 2048) return false; try { return ["http:", "https:"].includes(new URL(imageUrl.trim()).protocol); } catch { return false; } })();
  const payloadResult = (): { payload?: FcmNotificationRequest; error?: string } => {
    const cleanTitle = title.trim(); const cleanBody = body.trim();
    if (!cleanTitle) return { error: "Title is required." }; if (cleanTitle.length > 200) return { error: "Title must be at most 200 characters." };
    if (!cleanBody) return { error: "Message body is required." }; if (cleanBody.length > 2000) return { error: "Message body must be at most 2000 characters." };
    if (imageUrl.trim() && !validImage) return { error: "Image URL must be a valid HTTP or HTTPS URL (maximum 2048 characters)." };
    if (dataRows.length > 50) return { error: "Custom data supports at most 50 entries." };
    const data: Record<string, string> = {};
    for (const row of dataRows) { const key = row.key.trim(); if (!key) return { error: "Data keys cannot be empty." }; if (key.length > 128) return { error: "Data keys must be at most 128 characters." }; if (!row.value) return { error: `Value for “${key}” cannot be empty.` }; if (row.value.length > 2048) return { error: `Value for “${key}” must be at most 2048 characters.` }; if (Object.hasOwn(data, key)) return { error: `Duplicate data key: ${key}.` }; data[key] = row.value; }
    return { payload: { title: cleanTitle, body: cleanBody, ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}), ...(dataRows.length ? { data } : {}) } };
  };
  const sendNotification = async (bulk: boolean) => {
    const built = payloadResult(); if (built.error) { setFormError(built.error); setConfirmBulk(false); return; }
    if (selected.length < 1) { setFormError("Select at least one app user from the directory."); setConfirmBulk(false); return; }
    if (selectedUsers.length !== selected.length) { setFormError("One or more selected recipients are no longer in the loaded directory. Reload users and select again."); setConfirmBulk(false); return; }
    setSending(true); setFormError(""); setDelivery(null);
    const recipient = selectedUsers[0]; const bulkBody: BulkFcmNotificationRequest = { email: selectedUsers.map((u) => u.email), notification: built.payload! };
    try { const result = await runRequest("POST", bulk ? "/api/v1/portal/dev/notification/users/bulk" : `/api/v1/portal/dev/notification/user/send?userEmail=${encodeURIComponent(recipient.email)}`, bulk ? bulkBody : built.payload, () => bulk ? notificationApi.sendToUsers(bulkBody) : notificationApi.sendToUser(recipient.email, built.payload!)); setDelivery(result); setConfirmBulk(false); void loadAnalytics(); }
    catch (error) { setFormError(error instanceof Error ? error.message : "Notification request failed."); setConfirmBulk(false); }
    finally { setSending(false); }
  };
  const addDataRow = () => { if (dataRows.length < 50) setDataRows((rows) => [...rows, { key: "", value: "" }]); };
  const copy = (value: string) => { void navigator.clipboard?.writeText(value); };
  const pageCount = analytics ? [analytics.pending, analytics.processing, analytics.retryWait, analytics.noDevices].reduce((a, b) => a + b, 0) : 0;
  const metrics = analytics ? [{ label: "Total notifications", value: analytics.total, icon: BellRing, tone: "orange" }, { label: "Sent", value: analytics.sent, icon: Check, tone: "green" }, { label: "Failed", value: analytics.failed, icon: AlertCircle, tone: "red" }, { label: "Delivery rate", value: `${analytics.deliveryRatePercent}%`, icon: Activity, tone: "cyan" }] : [];

  return <div className="notification-page">
    <header className="notification-heading"><div><h1>Notification Management</h1><p>Compose, deliver, and inspect push notifications sent to app users.</p></div><div className="notification-live"><span />Authenticated portal API</div></header>
    <nav className="notification-tabs" aria-label="Notification management sections">{(["Overview", "Send Notification", "Notification History"] as const).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>

    {tab === "Overview" && <section className="notification-section"><div className="notification-section-head"><div><h2>Delivery overview</h2><p>Live totals reported by the notification service.</p></div><button className="notification-button subtle" onClick={() => void loadAnalytics()} disabled={analyticsBusy}><RefreshCw size={15} className={analyticsBusy ? "spin" : ""}/> Refresh</button></div>
      {analyticsBusy && !analytics && <div className="notification-metrics">{Array.from({ length: 4 }, (_, i) => <div className="notification-skeleton" key={i}/>)}</div>}
      {analyticsError && <div className="notification-alert error"><AlertCircle size={18}/><span>{analyticsError}</span><button onClick={() => void loadAnalytics()}>Retry</button></div>}
      {analytics && <><div className="notification-metrics">{metrics.map(({ label, value, icon: Icon, tone }) => <article className="notification-metric" key={label}><span className={`notification-metric-icon ${tone}`}><Icon size={17}/></span><span>{label}</span><strong>{value}</strong></article>)}</div><div className="notification-panel pipeline"><div className="notification-section-head"><div><h3>Delivery pipeline</h3><p>Current notification states returned by the backend.</p></div><span>{analytics.total} total</span></div><div className="pipeline-grid">{([["Pending", analytics.pending, "neutral"], ["Processing", analytics.processing, "blue"], ["Retry waiting", analytics.retryWait, "amber"], ["No devices", analytics.noDevices, "neutral"], ["Failed", analytics.failed, "red"], ["Sent", analytics.sent, "green"]] as const).map(([label, value, tone]) => <div className="pipeline-item" key={label}><span className={`status-dot ${tone}`}/><span>{label}</span><strong>{value}</strong></div>)}</div><div className="pipeline-bar" aria-label={`${pageCount} notifications in pending, processing, retry waiting, or no-device states`}><span style={{ width: analytics.total ? `${Math.min(100, pageCount / analytics.total * 100)}%` : "0%" }}/></div></div></>}
      {!analyticsBusy && !analyticsError && !analytics && <div className="notification-empty">No analytics data returned yet.</div>}
    </section>}

    {tab === "Send Notification" && <div className="notification-layout"><section className="notification-panel compose-panel"><div className="notification-section-head"><div><h2>Compose notification</h2><p>Choose recipients from the live app user directory.</p></div><Users size={19}/></div>
      <div className="recipient-tools"><label className="notification-search"><Search size={16}/><input aria-label="Search app users" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)}/></label><button className="notification-button subtle" onClick={() => void loadUsers()} disabled={usersBusy}><RefreshCw size={14}/>{usersBusy ? "Loading" : "Reload users"}</button></div>
      {usersBusy && users.length === 0 && <div className="inline-loading"><LoaderCircle className="spin" size={17}/> Loading app user directory…</div>}
      {usersError && <div className="notification-alert error compact"><span>{usersError}</span><button onClick={() => void loadUsers()}>Retry</button></div>}
      {!usersBusy && !usersError && users.length === 0 && <div className="notification-empty compact">No app users returned by the directory.</div>}
      {users.length > 0 && <><div className="recipient-actions"><span>{filteredUsers.length} users</span><button onClick={() => setSelected((old) => [...new Set([...old, ...filteredUsers.map((u) => u.email)])])}>Select filtered</button><button onClick={() => setSelected([])}>Clear selection</button></div><div className="user-list">{filteredUsers.map((user) => <label className="user-option" key={user.email}><input type="checkbox" checked={selected.includes(user.email)} onChange={() => toggle(user.email)}/><span className="user-initial">{user.name?.trim().charAt(0)?.toUpperCase() || "U"}</span><span className="user-identity"><strong>{user.name || "Unnamed user"}</strong><small>{user.email}</small></span></label>)}{filteredUsers.length === 0 && <div className="user-list-empty">No users match this search.</div>}</div></>}
      <div className="selected-summary"><strong>{selectedUsers.length} selected</strong>{selectedUsers.length > 0 && <div className="recipient-chips">{selectedUsers.map((u) => <button key={u.email} title={`Remove ${u.email}`} onClick={() => toggle(u.email)}>{u.name || u.email}<X size={12}/></button>)}</div>}</div>
      <div className="form-grid"><label className="notification-field full"><span>Notification title</span><input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A concise title"/><small>{title.length}/200 characters</small></label><label className="notification-field full"><span>Message body</span><textarea maxLength={2000} rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the notification message"/><small>{body.length}/2000 characters</small></label>
        <label className="notification-field full"><span>Image URL <em>Optional</em></span><input maxLength={2048} value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImageFailed(false); }} placeholder="https://example.com/image.jpg"/>{imageUrl && !validImage && <small className="field-error">Enter a valid HTTP(S) URL (up to 2048 characters).</small>}{validImage && <div className="image-preview"><Image size={16}/>{imageFailed ? <span>Image preview unavailable.</span> : <img src={imageUrl} alt="Notification image preview" onError={() => setImageFailed(true)} onLoad={() => setImageFailed(false)}/>}</div>}</label>
      </div>
      <div className="data-editor"><div className="notification-section-head"><div><h3>Custom data</h3><p>String values only. Do not include secrets or personal data.</p></div><button className="notification-button subtle" onClick={addDataRow} disabled={dataRows.length >= 50}>+ Add field</button></div>{dataRows.map((row, index) => <div className="data-row" key={index}><input aria-label={`Data key ${index + 1}`} maxLength={128} placeholder="Key" value={row.key} onChange={(e) => setDataRows((rows) => rows.map((r, i) => i === index ? { ...r, key: e.target.value } : r))}/><input aria-label={`Data value ${index + 1}`} maxLength={2048} placeholder="String value" value={row.value} onChange={(e) => setDataRows((rows) => rows.map((r, i) => i === index ? { ...r, value: e.target.value } : r))}/><button aria-label="Remove data field" onClick={() => setDataRows((rows) => rows.filter((_, i) => i !== index))}><X size={15}/></button></div>)}<pre className="json-preview">{JSON.stringify(Object.fromEntries(dataRows.map((r) => [r.key, r.value])), null, 2)}</pre></div>
      {formError && <div className="notification-alert error compact"><AlertCircle size={16}/>{formError}</div>}
      <div className="send-actions"><button className="notification-button primary" onClick={() => selectedUsers.length > 1 ? setConfirmBulk(true) : void sendNotification(false)} disabled={sending || usersBusy || selectedUsers.length === 0}><Send size={16}/>{sending ? "Sending…" : selectedUsers.length > 1 ? `Review bulk send (${selectedUsers.length})` : "Send notification"}</button><span>Preview request below before submission.</span></div>
      <div className="request-preview"><strong>Request preview</strong><pre>{JSON.stringify(selectedUsers.length > 1 ? { email: selectedUsers.map((u) => u.email), notification: payloadResult().payload ?? { title: title.trim(), body: body.trim() } } : payloadResult().payload ?? { title: title.trim(), body: body.trim() }, null, 2)}</pre></div>
      {delivery && <div className="delivery-result"><div className="result-title"><Check size={17}/> Backend delivery result</div><div className="delivery-grid">{[["Targeted devices", delivery.targetedDevices], ["Attempted", delivery.attemptedDevices], ["Successful", delivery.successCount], ["Failed", delivery.failureCount], ["Invalid tokens removed", delivery.removedInvalidTokenCount], ["Attempt success rate", `${delivery.attemptedDevices ? (delivery.successCount / delivery.attemptedDevices * 100).toFixed(1) : "0.0"}%`]].map(([l, v]) => <div key={l}><small>{l}</small><strong>{v}</strong></div>)}</div><small>Attempt success rate reflects device attempts and does not guarantee notification visibility.</small></div>}
    </section>
      {confirmBulk && <div className="modal-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-title"><button className="dialog-close" aria-label="Close confirmation" onClick={() => setConfirmBulk(false)}><X size={18}/></button><span className="dialog-icon"><ShieldAlert size={20}/></span><h2 id="bulk-title">Confirm bulk notification</h2><p>This notification will be sent to <strong>{selectedUsers.length} selected app users</strong>.</p><div className="confirm-content"><strong>{title.trim()}</strong><p>{body.trim()}</p>{imageUrl.trim() && <small>{imageUrl.trim()}</small>}<pre>{JSON.stringify(Object.fromEntries(dataRows.map((r) => [r.key, r.value])), null, 2)}</pre></div><div className="dialog-actions"><button className="notification-button subtle" onClick={() => setConfirmBulk(false)}>Review again</button><button className="notification-button primary" disabled={sending} onClick={() => void sendNotification(true)}>{sending ? "Sending…" : `Send to ${selectedUsers.length} users`}</button></div></section></div>}
    </div>}

    {tab === "Notification History" && <section className="notification-panel history-panel"><div className="notification-section-head"><div><h2>Notification history</h2><p>{totalElements} records · newest first</p></div><button className="notification-button subtle" onClick={() => void loadHistory()} disabled={historyBusy}><RefreshCw size={15} className={historyBusy ? "spin" : ""}/> Refresh</button></div><div className="history-tools"><label>Status filter<select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(0); }}><option value="">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label><label>Page size<select value={size} onChange={(e) => { setSize(Math.max(1, Number(e.target.value))); setPage(0); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label></div>
      {historyError && <div className="notification-alert error"><AlertCircle size={18}/><span>{historyError}</span><button onClick={() => void loadHistory()}>Retry</button></div>}
      <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Notification / recipient</th><th>Message</th><th>Status</th><th>Attempts</th><th>Created</th><th>Actions</th></tr></thead><tbody>{historyBusy ? <tr><td colSpan={6} className="table-message"><LoaderCircle className="spin" size={18}/> Loading history…</td></tr> : history.length === 0 ? <tr><td colSpan={6} className="table-message">No notification history for this query.</td></tr> : history.map((item) => <tr key={item.notificationId}><td><button className="link-button" onClick={() => copy(item.notificationId)} title="Copy notification ID"><code>{item.notificationId.slice(0, 8)}…</code><Clipboard size={12}/></button><span className="recipient-email">{item.recipientEmail} <button aria-label="Copy recipient email" onClick={() => copy(item.recipientEmail)}><Clipboard size={12}/></button></span><strong>{item.title}</strong></td><td className="message-cell">{item.body}</td><td><span className={`status-badge ${item.deliveryStatus.toLowerCase()}`}>{item.deliveryStatus.replace("_", " ")}</span></td><td>{item.attemptCount}</td><td>{formatDate(item.createdAt)}</td><td><button className="notification-button tiny" onClick={() => setDetail(item)}>Details</button></td></tr>)}</tbody></table></div>
      <div className="history-pagination"><span>Page {page + 1} of {totalPages} · {totalElements} records</span><div><button className="notification-button subtle" disabled={page <= 0 || historyBusy} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft size={15}/> Previous</button><button className="notification-button subtle" disabled={page + 1 >= totalPages || historyBusy} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight size={15}/></button></div></div>
    </section>}

    <section className="notification-panel inspector-panel"><div className="notification-section-head"><div><h2><Activity size={17}/> API request &amp; response</h2><p>Most recent notification API operation, including actual HTTP status and duration.</p></div>{inspector && <button className="notification-button subtle" onClick={() => setInspector(null)}>Clear</button>}</div>{inspector ? <div className="inspector-grid"><div className="inspector-box"><div><strong>Request</strong><button onClick={() => copy(JSON.stringify(inspector.request, null, 2))}><Clipboard size={13}/> Copy</button></div><p><code>{inspector.method}</code> {inspector.endpoint}</p><pre>{JSON.stringify(inspector.request, null, 2) ?? "No request body"}</pre><small>{formatDate(inspector.at)}</small></div><div className="inspector-box"><div><strong>Response</strong><span className={inspector.error ? "http-error" : "http-success"}>{inspector.status === null ? "No HTTP response" : `HTTP ${inspector.status}`}</span><small>{inspector.duration} ms</small><button onClick={() => copy(JSON.stringify(inspector.response, null, 2))}><Clipboard size={13}/> Copy</button></div>{inspector.error && <p className="inspector-error">{inspector.error}</p>}<pre>{JSON.stringify(inspector.response, null, 2) ?? "No response body"}</pre></div></div> : <div className="inspector-empty"><Clock3 size={17}/> API details appear here after an operation.</div>}</section>
    {detail && <div className="modal-backdrop" role="presentation"><section className="confirm-dialog details-dialog" role="dialog" aria-modal="true" aria-labelledby="history-detail-title"><button className="dialog-close" aria-label="Close details" onClick={() => setDetail(null)}><X size={18}/></button><h2 id="history-detail-title">Notification details</h2><div className="detail-list">{[["Notification ID", detail.notificationId], ["Recipient email", detail.recipientEmail], ["Title", detail.title], ["Body", detail.body], ["Delivery status", detail.deliveryStatus], ["Attempt count", detail.attemptCount], ["Last error", detail.lastError || "—"], ["Created at", formatDate(detail.createdAt)], ["Updated at", formatDate(detail.updatedAt)], ["Read at", formatDate(detail.readAt)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section></div>}
  </div>;
}
