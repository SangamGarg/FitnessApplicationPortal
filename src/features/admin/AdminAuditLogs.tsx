import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Check, Clipboard, Clock3, Copy, FileSearch, RefreshCw, RotateCcw, Search, Shield, X } from "lucide-react";
import { getAuditEvents, type AuditEvent, type AuditFilters, type AuditPage } from "./auditApi";
import "./AdminAuditLogs.css";

const PAGE_SIZE = 20;
const DEFAULT_SORT = "createdAt,desc";
const EMPTY_FILTERS: AuditFilters = { actorEmail: "", action: "", resourceType: "", resourceId: "", from: "", to: "" };

function displayValue(value: string | null | undefined) {
  return value?.trim() || "—";
}

function formatTimestamp(value: string | null) {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid timestamp" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

function toInstant(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2500);
    }
  }
  return <button className="audit-copy-button" type="button" onClick={() => void copy()} aria-label={copied ? `${label} copied` : `Copy ${label}`} title={failed ? "Clipboard access unavailable" : copied ? "Copied" : `Copy ${label}`}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>;
}

function EventDetails({ event, onClose }: { event: AuditEvent; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const fields: [string, string][] = [
    ["Event ID", String(event.id)], ["Actor", displayValue(event.actorEmail)], ["Action", displayValue(event.action)],
    ["Resource type", displayValue(event.resourceType)], ["Resource ID", displayValue(event.resourceId)],
    ["Timestamp", formatTimestamp(event.createdAt)], ["Details", displayValue(event.details)],
  ];
  return <div className="audit-dialog-backdrop" role="presentation" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose(); }}>
    <section className="audit-details-dialog" role="dialog" aria-modal="true" aria-labelledby="audit-details-title">
      <div className="audit-details-heading"><div><span className="audit-eyebrow">EVENT RECORD</span><h2 id="audit-details-title">Audit event details</h2><p>Review the complete information returned for this event.</p></div><button type="button" className="audit-close-button" onClick={onClose} aria-label="Close event details"><X size={19} /></button></div>
      <dl className="audit-detail-list">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === "Details" ? <pre>{value}</pre> : <span>{value}</span>}{value !== "—" && value !== "Timestamp unavailable" && value !== "Invalid timestamp" && <CopyButton value={value} label={label.toLowerCase()} />}</dd></div>)}</dl>
    </section>
  </div>;
}

export default function AdminAuditLogs() {
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [dateError, setDateError] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [result, setResult] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // The request lifecycle is external work; mark it pending before awaiting its result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    getAuditEvents({ filters, page: pageIndex, size: pageSize, sort }, controller.signal)
      .then((page) => {
        setResult(page);
        setLastUpdated(new Date());
        if (page.totalPages > 0 && pageIndex >= page.totalPages) setPageIndex(page.totalPages - 1);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setResult(null);
        setError(requestError instanceof Error ? requestError.message : "Could not retrieve audit events.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, pageIndex, pageSize, sort, reloadKey]);

  const rows = result?.content ?? [];
  const dateRangeInvalid = useMemo(() => {
    if (!draft.from || !draft.to) return false;
    const from = new Date(draft.from).getTime();
    const to = new Date(draft.to).getTime();
    return Number.isNaN(from) || Number.isNaN(to) || from > to;
  }, [draft.from, draft.to]);
  const hasFilters = Object.values(filters).some((value) => value.trim());

  function updateDraft(field: keyof AuditFilters, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (dateError) setDateError("");
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dateRangeInvalid) {
      setDateError("From must be earlier than or equal to To.");
      return;
    }
    setDateError("");
    setPageIndex(0);
    setFilters({ ...draft, from: toInstant(draft.from), to: toInstant(draft.to), actorEmail: draft.actorEmail.trim(), action: draft.action.trim(), resourceType: draft.resourceType.trim(), resourceId: draft.resourceId.trim() });
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setDateError("");
    setPageIndex(0);
    setPageSize(PAGE_SIZE);
    setSort(DEFAULT_SORT);
    if (!hasFilters && pageIndex === 0 && pageSize === PAGE_SIZE && sort === DEFAULT_SORT) return;
    setFilters(EMPTY_FILTERS);
  }

  function changeSort() {
    setPageIndex(0);
    setSort((current) => current === "createdAt,desc" ? "createdAt,asc" : "createdAt,desc");
  }

  const totalPages = result ? Math.ceil(result.totalElements / pageSize) : 0;
  const pageNumber = pageIndex + 1;
  const firstRow = result && result.numberOfElements ? pageIndex * pageSize + 1 : 0;
  const lastRow = result ? Math.min(pageIndex * pageSize + result.numberOfElements, result.totalElements) : 0;
  const hasPreviousPage = pageIndex > 0;
  const hasNextPage = result !== null && pageIndex + 1 < totalPages;

  return <div className="audit-page">
    <div className="audit-heading"><div><h1>Audit Logs</h1><p>Monitor and investigate administrative and application activity.</p></div><div className="audit-heading-actions"><div className="audit-updated">{lastUpdated ? <>Updated {new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(lastUpdated)}</> : "Live audit events"}</div><button type="button" className="audit-button audit-button-primary" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}><RefreshCw size={15} className={loading ? "audit-spin" : ""} />Refresh</button></div></div>

    <section className="audit-summary" aria-label="Audit event results summary"><div className="audit-summary-icon"><Shield size={19} /></div><div><strong>{loading ? "Loading audit events…" : result ? `${result.totalElements.toLocaleString()} total events` : "Audit event results"}</strong><span>{loading ? "Fetching the requested page from the audit service" : result ? `Showing ${firstRow}–${lastRow} · page ${pageNumber}${totalPages ? ` of ${totalPages}` : ""}` : "Results are provided by the secured admin audit API."}</span></div><div className="audit-summary-latest"><Clock3 size={15} /><span>{rows.length ? `Latest on page: ${formatTimestamp(rows[0].createdAt)}` : "No event timestamp available"}</span></div></section>

    <form className="audit-filter-panel" onSubmit={applyFilters} noValidate>
      <div className="audit-filter-heading"><div><h2>Filter events</h2><p>Combine filters, then apply them to search server-side.</p></div><Search size={17} /></div>
      <div className="audit-filter-grid">
        <label className="audit-field"><span>Actor Email</span><input type="text" value={draft.actorEmail} onChange={(event) => updateDraft("actorEmail", event.target.value)} placeholder="Search by email" /><small>Filter events by the email address of the actor.</small></label>
        <label className="audit-field"><span>Action</span><input type="text" value={draft.action} onChange={(event) => updateDraft("action", event.target.value)} placeholder="Search recorded action" /><small>Search audit events by the recorded action.</small></label>
        <label className="audit-field"><span>Resource Type</span><input type="text" value={draft.resourceType} onChange={(event) => updateDraft("resourceType", event.target.value)} placeholder="e.g. USER" /><small>Filter by the type of resource affected.</small></label>
        <label className="audit-field"><span>Resource ID</span><input type="text" value={draft.resourceId} onChange={(event) => updateDraft("resourceId", event.target.value)} placeholder="Enter a resource identifier" /><small>Find events associated with a resource identifier.</small></label>
        <label className="audit-field"><span>From</span><input type="datetime-local" value={draft.from} onChange={(event) => updateDraft("from", event.target.value)} aria-invalid={Boolean(dateError && dateRangeInvalid)} /><small>Show events recorded on or after this date and time.</small></label>
        <label className="audit-field"><span>To</span><input type="datetime-local" value={draft.to} onChange={(event) => updateDraft("to", event.target.value)} aria-invalid={Boolean(dateError && dateRangeInvalid)} /><small>Show events recorded on or before this date and time.</small></label>
      </div>
      {dateError && <p className="audit-validation" role="alert">{dateError}</p>}
      <div className="audit-filter-actions"><span>Times are sent as ISO-8601 instants using your local timezone offset.</span><div><button type="button" className="audit-button" onClick={clearFilters}><RotateCcw size={15} />Clear filters</button><button type="submit" className="audit-button audit-button-primary"><Search size={15} />Apply filters</button></div></div>
    </form>

    <section className="audit-table-panel" aria-label="Audit events">
      <div className="audit-table-heading"><div><h2>Event activity</h2><p>{loading ? "Retrieving records…" : `${result?.numberOfElements ?? 0} ${result?.numberOfElements === 1 ? "event" : "events"} on this page`}</p></div></div>
      {error ? <div className="audit-state audit-error"><AlertCircle size={24} /><strong>Audit events could not be loaded</strong><p>{error}</p><button type="button" className="audit-button audit-button-primary" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw size={14} />Retry</button></div> : loading ? <div className="audit-loading" aria-label="Loading audit events"><span /><span /><span /><span /><span /><span /></div> : rows.length === 0 ? <div className="audit-state"><FileSearch size={27} /><strong>No audit events found</strong><p>{hasFilters ? "No events match the applied filters. Try adjusting or clearing them." : "No audit events are currently available."}</p>{hasFilters && <button type="button" className="audit-button" onClick={clearFilters}>Clear filters</button>}</div> : <>
        <div className="audit-table-scroll"><table className="audit-table"><thead><tr><th>Event ID</th><th>Actor</th><th>Action</th><th>Resource Type</th><th>Resource ID</th><th><button type="button" className="audit-sort-button" onClick={changeSort}>Timestamp {sort === "createdAt,desc" ? <ArrowDown size={13} /> : <ArrowUp size={13} />}</button></th><th>Details</th></tr></thead><tbody>
          {rows.map((event) => <tr key={String(event.id)}><td><span className="audit-id" title={String(event.id)}>{event.id}</span><CopyButton value={String(event.id)} label="event ID" /></td><td><span className="audit-actor" title={event.actorEmail || "Unknown actor"}>{event.actorEmail?.trim() || "Unknown actor"}</span></td><td><span className="audit-action-badge">{displayValue(event.action)}</span></td><td>{displayValue(event.resourceType)}</td><td><span className="audit-resource-id" title={event.resourceId || undefined}>{displayValue(event.resourceId)}</span>{event.resourceId && <CopyButton value={event.resourceId} label="resource ID" />}</td><td><time dateTime={event.createdAt || undefined} title={event.createdAt || undefined}>{formatTimestamp(event.createdAt)}</time></td><td><button type="button" className="audit-details-button" onClick={() => setSelected(event)}><Clipboard size={14} />View details</button></td></tr>)}
        </tbody></table></div>
        <div className="audit-pagination"><span>{result?.totalElements.toLocaleString() ?? 0} total · {firstRow}–{lastRow}</span><div><label>Rows per page <select value={pageSize} aria-label="Rows per page" onChange={(event) => { setPageSize(Number(event.target.value)); setPageIndex(0); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><button type="button" className="audit-page-button" onClick={() => setPageIndex((index) => Math.max(0, index - 1))} disabled={!hasPreviousPage}>Previous</button><span>Page {pageNumber}{totalPages ? ` of ${totalPages}` : ""}</span><button type="button" className="audit-page-button" onClick={() => setPageIndex((index) => index + 1)} disabled={!hasNextPage}>Next</button></div></div>
      </>}
    </section>
    {selected && <EventDetails event={selected} onClose={() => setSelected(null)} />}
  </div>;
}
