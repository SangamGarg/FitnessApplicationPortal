import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, Check, CircleHelp, Clipboard, Clock3, Download, FileText, RefreshCw, Search, Server, Terminal, X } from "lucide-react";
import { getAvailableLogs, getLogs, LogsApiError, type LogFileResponse, type LogSource, type TimedResponse } from "../lib/developerLogsApi";
import "./DeveloperLogsPage.css";

const SOURCES: { id: LogSource; label: string }[] = [
  { id: "application", label: "Application" },
  { id: "errors", label: "Errors" },
  { id: "access", label: "Access" },
];
const LINE_OPTIONS = [50, 100, 200, 500, 1000, 2000];
const AUTO_OPTIONS = [0, 5, 10, 30, 60];
type Severity = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL" | "Unknown";
type LogEntry = { text: string; severity: Severity };
type RequestMeta = { endpoint: string; status: number | null; durationMs: number; requestedAt: Date; error?: string };

function severityOf(line: string): Severity {
  const match = line.match(/\b(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\b/i);
  return (match?.[1]?.toUpperCase() as Severity | undefined) ?? "Unknown";
}

function statusLabel(status: number | null): string {
  if (status === null) return "No response";
  const labels: Record<number, string> = { 200: "OK", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 500: "Internal Server Error", 503: "Service Unavailable" };
  return `${status} ${labels[status] ?? "Response"}`;
}

function HighlightedLine({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(<mark key={`${index}-${cursor}`}>{text.slice(index, index + query.length)}</mark>);
    cursor = index + query.length;
    index = lower.indexOf(needle, cursor);
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export default function DeveloperLogsPage() {
  const [available, setAvailable] = useState<string[] | null>(null);
  const [sourceError, setSourceError] = useState("");
  const [sourceLoading, setSourceLoading] = useState(true);
  const [source, setSource] = useState<LogSource | null>(null);
  const [requestInput, setRequestInput] = useState("");
  const [requestId, setRequestId] = useState("");
  const [lineCount, setLineCount] = useState(200);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("All");
  const [wrap, setWrap] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(0);
  const [data, setData] = useState<LogFileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<RequestMeta | null>(null);
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null);
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const refreshAvailable = useCallback(async () => {
    setSourceLoading(true);
    setSourceError("");
    try {
      const result = await getAvailableLogs();
      const normalized = result.data.map((item) => item.toLowerCase());
      setAvailable(normalized);
      setSource((current) => current && normalized.includes(current) ? current : SOURCES.find((item) => normalized.includes(item.id))?.id ?? null);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Could not load available log sources.");
      setAvailable(null);
    } finally {
      setSourceLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshAvailable(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshAvailable]);

  const fetchCurrent = useCallback(async (target: LogSource, count: number, id: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    activeController.current?.abort();
    activeController.current = controller;
    setLoading(true);
    setNotice("");
    try {
      const result: TimedResponse<LogFileResponse> = await getLogs(target, count, id, controller.signal);
      if (sequence !== requestSequence.current) return;
      setData(result.data);
      setMeta({ endpoint: result.endpoint, status: result.status, durationMs: result.durationMs, requestedAt: result.requestedAt });
      setLastSuccess(new Date());
    } catch (error) {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      if (error instanceof LogsApiError) {
        setMeta({ endpoint: error.endpoint, status: error.status, durationMs: error.durationMs, requestedAt: error.requestedAt, error: error.message });
      }
      setNotice(error instanceof Error ? error.message : "Could not retrieve logs.");
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        inFlight.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (!source || !available?.includes(source)) return;
    const timer = window.setTimeout(() => {
      setData(null);
      void fetchCurrent(source, lineCount, requestId);
    }, 0);
    return () => { window.clearTimeout(timer); activeController.current?.abort(); requestSequence.current += 1; inFlight.current = false; };
  }, [source, available, lineCount, requestId, fetchCurrent]);

  useEffect(() => {
    if (!autoRefresh || !source) return;
    const timer = window.setInterval(() => {
      if (!inFlight.current) void fetchCurrent(source, lineCount, requestId);
    }, autoRefresh * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, source, lineCount, requestId, fetchCurrent]);

  const entries = useMemo<LogEntry[]>(() => {
    const result: LogEntry[] = [];
    let previousSeverity: Severity = "Unknown";
    for (const text of data?.lines ?? []) {
      const found = severityOf(text);
      if (found !== "Unknown") previousSeverity = found;
      result.push({ text, severity: found === "Unknown" && /^\s+/.test(text) ? previousSeverity : found });
    }
    return result;
  }, [data]);

  const filtered = useMemo(() => entries.filter((entry) => {
    const matchesLevel = level === "All" || entry.severity === level;
    const matchesSearch = !search || entry.text.toLowerCase().includes(search.toLowerCase());
    return matchesLevel && matchesSearch;
  }), [entries, level, search]);
  const availableCount = available?.length ?? 0;

  function applyRequestId() {
    setRequestId(requestInput.trim());
  }
  function clearRequestId() {
    setRequestInput("");
    setRequestId("");
  }
  async function copyLogs() {
    try {
      await navigator.clipboard.writeText(filtered.map((entry) => entry.text).join("\n"));
      setNotice(`Copied ${filtered.length} visible lines from this fetched snapshot.`);
    } catch {
      setNotice("Clipboard access failed. Check browser permissions and try again.");
    }
  }
  function downloadLogs() {
    const safeBase = Array.from(data?.fileName || `${source ?? "logs"}.log`)
      .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
      .join("").replace(/[<>:"/\\|?*]/g, "_").replace(/\.+$/g, "").slice(0, 120) || "logs.log";
    const blob = new Blob([`${data?.lines.join("\n") ?? ""}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeBase.toLowerCase().endsWith(".log") || safeBase.toLowerCase().endsWith(".txt") ? safeBase : `${safeBase}.log`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Downloaded the fetched server snapshot, including lines hidden by client-side filters.");
  }

  return (
    <div className="dev-content logs-page">
      <div className="dev-page-heading logs-heading">
        <div><h1>Logs</h1><p>Monitor application activity, errors and access logs.</p></div>
        <div className="logs-heading-actions">
          <span className={`logs-source-summary ${availableCount ? "is-ready" : ""}`}><span />{sourceLoading ? "Checking sources" : `${availableCount} source${availableCount === 1 ? "" : "s"} available`}</span>
          <span className="logs-last-refresh"><Clock3 size={14} />{lastSuccess ? `Updated ${lastSuccess.toLocaleTimeString()}` : "Not refreshed yet"}</span>
          <button className="logs-button primary" onClick={() => source && void fetchCurrent(source, lineCount, requestId)} disabled={!source || loading}><RefreshCw size={15} className={loading ? "logs-spin" : ""} />Refresh</button>
        </div>
      </div>

      <section className="logs-trace-panel" aria-label="Trace logs by request ID">
        <div className="logs-trace-content">
          <label htmlFor="logs-request-id">Request ID</label>
          <div className="logs-trace-input-row"><input id="logs-request-id" value={requestInput} onChange={(event) => setRequestInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyRequestId(); }} placeholder="Enter a request ID" /><button className="logs-button primary" onClick={applyRequestId}><Search size={15} />Trace request</button>{requestId && <button className="logs-button secondary" onClick={clearRequestId}><X size={15} />Clear</button>}</div>
          <p>Filter server logs by request ID to trace a specific request across available log sources.</p>
          {requestId && <span className="logs-applied-id"><Check size={13} />Server-side filter applied: <code>{requestId}</code></span>}
        </div>
      </section>

      {sourceError && <div className="logs-alert error"><AlertCircle size={17} /><span>{sourceError}</span><button onClick={() => void refreshAvailable()}>Retry</button></div>}

      <div className="logs-source-tabs" role="tablist" aria-label="Log sources">
        {SOURCES.map((item) => {
          const isAvailable = Boolean(available?.includes(item.id));
          return <button role="tab" aria-selected={source === item.id} key={item.id} className={`logs-source-tab ${source === item.id ? "active" : ""} ${!isAvailable ? "unavailable" : ""}`} onClick={() => isAvailable && setSource(item.id)} disabled={!isAvailable || sourceLoading}><span className="logs-tab-icon">{item.id === "application" ? <Terminal size={17} /> : item.id === "errors" ? <AlertCircle size={17} /> : <Server size={17} />}</span><span className="logs-tab-copy"><strong>{item.label} logs</strong><small>{sourceLoading ? "Checking availability" : isAvailable ? "Available" : "Unavailable"}</small></span><span className={`logs-status-dot ${isAvailable ? "online" : "offline"}`} /></button>;
        })}
        <button className="logs-refresh-sources" onClick={() => void refreshAvailable()} disabled={sourceLoading} aria-label="Refresh available log sources" title="Refresh available log sources"><RefreshCw size={15} className={sourceLoading ? "logs-spin" : ""} /></button>
      </div>

      {available && available.length === 0 && <div className="logs-empty-panel"><FileText size={25} /><strong>No log sources are available</strong><p>The server did not report any available log files.</p><button className="logs-button secondary" onClick={() => void refreshAvailable()}>Retry source check</button></div>}

      {source && available?.includes(source) && <>
        <section className="logs-controls" aria-label="Log controls">
          <div className="logs-control-group"><label htmlFor="logs-line-count">Lines</label><select id="logs-line-count" value={lineCount} onChange={(event) => setLineCount(Number(event.target.value))}>{LINE_OPTIONS.map((value) => <option key={value} value={value}>{value.toLocaleString()}</option>)}</select></div>
          <div className="logs-control-search"><Search size={15} /><input aria-label="Search loaded log lines" placeholder="Search loaded logs…" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</div>
          <div className="logs-control-group"><label htmlFor="logs-level">Severity</label><select id="logs-level" value={level} onChange={(event) => setLevel(event.target.value)}>{["All", "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL", "Unknown"].map((value) => <option key={value}>{value}</option>)}</select></div>
          <label className="logs-toggle"><input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} /><span />Wrap lines</label>
          <div className="logs-control-group logs-auto-group"><label htmlFor="logs-auto">Auto-refresh</label><select id="logs-auto" value={autoRefresh} onChange={(event) => setAutoRefresh(Number(event.target.value))}>{AUTO_OPTIONS.map((value) => <option key={value} value={value}>{value ? `${value} sec` : "Off"}</option>)}</select></div>
          <span className="logs-control-spacer" />
          <button className="logs-button secondary" onClick={() => void copyLogs()} disabled={!data?.lines.length}><Clipboard size={15} />Copy logs</button>
          <button className="logs-button secondary" onClick={downloadLogs} disabled={!data?.lines.length}><Download size={15} />Download</button>
        </section>
        <p className="logs-control-hint">Most recent {lineCount.toLocaleString()} lines are fetched from the server.</p>

        <div className="logs-viewer-heading"><div><Terminal size={16} /><strong>{data?.fileName || `${source}.log`}</strong><span>{loading ? "Fetching…" : `${filtered.length.toLocaleString()} visible / ${entries.length.toLocaleString()} returned`}</span></div></div>
        {notice && <div className="logs-notice"><CircleHelp size={15} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={14} /></button></div>}
        {notice.includes("Could not retrieve") || (meta?.error && !data) ? <div className="logs-alert error"><AlertCircle size={17} /><div><strong>Log request failed</strong><p>{meta?.error ?? notice}</p><button onClick={() => void fetchCurrent(source, lineCount, requestId)}>Retry request</button></div></div> : null}
        {data && !data.available ? <div className="logs-empty-panel"><AlertCircle size={25} /><strong>This log file is unavailable</strong><p>The server cannot provide the {source} log source right now. Retry to check again.</p><button className="logs-button secondary" onClick={() => void fetchCurrent(source, lineCount, requestId)}>Retry</button></div> : data?.available && entries.length === 0 ? <div className="logs-empty-panel"><FileText size={25} /><strong>{requestId ? "No log entries found for this Request ID in this log source." : "No log entries returned"}</strong><p>{requestId ? "The server returned no matching entries for this source." : "The log file is available, but contains no returned entries."}</p></div> : data?.available && filtered.length === 0 ? <div className="logs-empty-panel compact"><Search size={22} /><strong>No lines match these filters</strong><p>Try another search term or reset the severity filter.</p></div> : <div className={`logs-terminal ${wrap ? "wrap-lines" : ""}`} aria-label="Log output" aria-live="polite">{filtered.map((entry, index) => <div className="logs-line" key={`${index}-${entry.text}`}><span className="logs-line-number">{index + 1}</span><span className={`logs-severity ${entry.severity.toLowerCase()}`}>{entry.severity === "Unknown" ? "·" : entry.severity}</span><code><HighlightedLine text={entry.text} query={search} /></code></div>)}{loading && !data && <div className="logs-loading"><RefreshCw size={17} className="logs-spin" />Retrieving logs from server…</div>}</div>}

        <section className="logs-metadata" aria-label="Log response metadata"><div className="logs-metadata-title"><Activity size={16} /><strong>Request details</strong></div><div className="logs-metadata-grid"><div><span>Endpoint</span><code>{meta?.endpoint ?? "—"}</code></div><div><span>HTTP status</span><strong className={meta?.error ? "bad" : "good"}>{meta ? statusLabel(meta.status) : "Waiting"}</strong></div><div><span>Duration</span><strong>{meta ? `${Math.round(meta.durationMs)} ms` : "—"}</strong></div><div><span>Requested at</span><strong>{meta?.requestedAt.toLocaleTimeString() ?? "—"}</strong></div><div><span>Request ID</span><strong>{requestId || "None"}</strong></div><div><span>Requested / returned</span><strong>{data ? `${data.requestedLines || lineCount} / ${data.returnedLines}` : `— / —`}</strong></div><div><span>Source availability</span><strong>{data ? data.available ? "Available" : "Unavailable" : available?.includes(source) ? "Available" : "—"}</strong></div><div><span>Visible after filters</span><strong>{filtered.length.toLocaleString()}</strong></div></div>{meta?.error && <p className="logs-meta-error">{meta.error}</p>}</section>
      </>}
      {sourceLoading && <div className="logs-initial-loading"><RefreshCw size={17} className="logs-spin" />Loading available log sources…</div>}
    </div>
  );
}
