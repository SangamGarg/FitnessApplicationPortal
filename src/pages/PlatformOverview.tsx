import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Cpu, Database, Gauge, RefreshCw, Server, Timer, Waypoints } from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./PlatformOverview.css";

const API_ROOT = "/api/v1/portal/overview";
const POLL_INTERVAL_MS = 15_000;

type LivenessResponse = { status?: string; checkedAt?: string };
type ReadinessResponse = { status?: string; database?: string; databaseLatencyMs?: number; checkedAt?: string };
type ConnectionPool = { name?: string; active?: number; idle?: number; total?: number; maximum?: number; minimumIdle?: number } | null;
type DetailedHealth = {
  status?: string; checkedAt?: string; uptimeMs?: number;
  database?: { status?: string; latencyMs?: number; database?: string; connectionPool?: ConnectionPool } | null;
  jvm?: { usedMemoryBytes?: number; maxMemoryBytes?: number; availableProcessors?: number } | null;
};
type ApiLatency = { measuredAt?: string; requestCount?: number; averageLatencyMs?: number; maximumLatencyMs?: number };
type MonitorData = { live: LivenessResponse | null; ready: ReadinessResponse | null; detail: DetailedHealth | null; latency: ApiLatency | null };
type EndpointKey = keyof MonitorData;
type Diagnostic = { endpoint: string; requestedAt: string; respondedAt?: string; durationMs: number; httpStatus?: number; success: boolean; error?: string; payload?: unknown };
type HealthStatus = "UP" | "DEGRADED" | "DOWN" | "Monitoring unavailable" | "Checking";

const initialData: MonitorData = { live: null, ready: null, detail: null, latency: null };
const endpointPaths: Record<EndpointKey, string> = {
  live: `${API_ROOT}/live`, ready: `${API_ROOT}/ready`, detail: API_ROOT, latency: `${API_ROOT}/api-latency`,
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function pick(source: Record<string, unknown> | null, keys: string[]): Record<string, unknown> | undefined {
  if (!source) return undefined;
  return Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));
}

function diagnosticPayload(key: EndpointKey, value: unknown): unknown {
  const root = asObject(value);
  if (key === "live") return pick(root, ["status", "checkedAt"]);
  if (key === "ready") return pick(root, ["status", "database", "databaseLatencyMs", "checkedAt"]);
  if (key === "latency") return pick(root, ["measuredAt", "requestCount", "averageLatencyMs", "maximumLatencyMs"]);
  if (!root) return undefined;
  const database = asObject(root.database);
  const pool = asObject(database?.connectionPool);
  const jvm = asObject(root.jvm);
  return {
    ...pick(root, ["status", "checkedAt", "uptimeMs"]),
    ...(database ? { database: { ...pick(database, ["status", "latencyMs", "database"]), ...(pool ? { connectionPool: pick(pool, ["name", "active", "idle", "total", "maximum", "minimumIdle"]) } : database.connectionPool === null ? { connectionPool: null } : {}) } } : {}),
    ...(jvm ? { jvm: pick(jvm, ["usedMemoryBytes", "maxMemoryBytes", "availableProcessors"]) } : {}),
  };
}

function validDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | Date | null): string {
  const date = value instanceof Date ? value : validDate(value ?? undefined);
  return date ? date.toLocaleString() : "Not reported";
}

function number(value?: number | null, digits = 0): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
}

function percent(used?: number, maximum?: number): number | null {
  if (!Number.isFinite(used) || !Number.isFinite(maximum) || maximum === undefined || maximum <= 0 || used === undefined) return null;
  return Math.min(100, Math.max(0, used / maximum * 100));
}

function memory(value?: number): string {
  if (!Number.isFinite(value) || value === undefined || value < 0) return "—";
  const gb = value / (1024 ** 3);
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(value / (1024 ** 2)).toFixed(0)} MB`;
}

function uptime(value?: number): string {
  if (!Number.isFinite(value) || value === undefined || value < 0) return "—";
  let seconds = Math.floor(value / 1000);
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function statusText(value?: string): string { return value?.trim() ? value.toUpperCase() : "Unknown"; }
function statusTone(value?: string): "up" | "degraded" | "down" | "unknown" {
  const status = statusText(value);
  return status === "UP" ? "up" : status === "DEGRADED" ? "degraded" : status === "DOWN" ? "down" : "unknown";
}

function overallStatus(data: MonitorData, hasMonitoringFailure: boolean): HealthStatus {
  if (hasMonitoringFailure) return "DOWN";
  const statuses = [data.detail?.status, data.ready?.status, data.live?.status, data.ready?.database, data.detail?.database?.status].filter(Boolean).map((status) => status!.toUpperCase());
  if (!statuses.length) return hasMonitoringFailure ? "Monitoring unavailable" : "Checking";
  if (statuses.includes("DOWN")) return "DOWN";
  if (statuses.includes("DEGRADED")) return "DEGRADED";
  if (statuses.includes("UP")) return "UP";
  return hasMonitoringFailure ? "Monitoring unavailable" : "Checking";
}

async function readResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return null;
  try { return await response.json() as unknown; } catch { return null; }
}

function Metric({ title, value, detail, icon: Icon, tone = "neutral" }: { title: string; value: string; detail: string; icon: typeof Activity; tone?: string }) {
  return <article className="overview-metric"><div className="overview-metric-head"><span>{title}</span><span className={`overview-icon ${tone}`}><Icon size={17} /></span></div><strong>{value}</strong><small>{detail}</small></article>;
}

function Progress({ value, tone = "normal" }: { value: number | null; tone?: string }) {
  return <div className={`overview-progress ${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? 0} aria-label="Resource utilization"><span style={{ width: `${value ?? 0}%` }} /></div>;
}

export default function PlatformOverview() {
  const [data, setData] = useState<MonitorData>(initialData);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [busy, setBusy] = useState(false);
  const [hasMonitoringFailure, setHasMonitoringFailure] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const activeRequests = useRef(new Set<AbortController>());

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const results = await Promise.all((Object.keys(endpointPaths) as EndpointKey[]).map(async (key) => {
      const endpoint = endpointPaths[key];
      const requested = new Date();
      const started = performance.now();
      const controller = new AbortController();
      activeRequests.current.add(controller);
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await portalFetch(endpoint, { method: "GET", signal: controller.signal, headers: { Accept: "application/json" } });
        const payload = await readResponse(response);
        const diagnostic: Diagnostic = { endpoint, requestedAt: requested.toISOString(), respondedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started), httpStatus: response.status, success: response.ok, ...(diagnosticPayload(key, payload) ? { payload: diagnosticPayload(key, payload) } : {}), ...(!response.ok && response.status !== 503 ? { error: "The monitoring endpoint did not return a successful response." } : {}) };
        if (!response.ok && response.status !== 503) return { key, diagnostic, value: null, usable: false };
        return { key, diagnostic, value: payload, usable: true };
      } catch {
        return { key, diagnostic: { endpoint, requestedAt: requested.toISOString(), durationMs: Math.round(performance.now() - started), success: false, error: "The monitoring request could not be completed." } satisfies Diagnostic, value: null, usable: false };
      } finally { window.clearTimeout(timeout); activeRequests.current.delete(controller); }
    }));

    if (!mounted.current) { inFlight.current = false; return; }
    const merged = { ...initialData } as MonitorData;
    let hasFailure = false;
    const nextDiagnostics = results.map(({ key, diagnostic, value, usable }) => {
      if (usable) merged[key] = value as never;
      if (!usable || !diagnostic.success) hasFailure = true;
      return diagnostic;
    });
    setData((previous) => ({ ...previous, ...Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== null)) }));
    setDiagnostics(nextDiagnostics);
    setHasMonitoringFailure(hasFailure);
    if (results.some((result) => result.usable)) setLastSuccessAt(new Date());
    setNextRefreshAt(new Date(Date.now() + POLL_INTERVAL_MS));
    setBusy(false);
    inFlight.current = false;
  }, []);

  useEffect(() => {
    const requests = activeRequests.current;
    mounted.current = true;
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const intervalId = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      window.clearTimeout(initialRefresh);
      window.clearInterval(intervalId);
      requests.forEach((controller) => controller.abort());
      requests.clear();
    };
  }, [refresh]);

  const overall = overallStatus(data, hasMonitoringFailure);
  const jvm = data.detail?.jvm;
  const pool = data.detail?.database?.connectionPool;
  const memoryUsed = percent(jvm?.usedMemoryBytes, jvm?.maxMemoryBytes);
  const poolUse = percent(pool?.active, pool?.maximum);
  const memoryTone = memoryUsed === null ? "normal" : memoryUsed > 85 ? "critical" : memoryUsed >= 70 ? "warning" : "normal";
  const poolTone = poolUse !== null && poolUse >= 85 ? "warning" : "normal";
  const databaseStatus = data.detail?.database?.status ?? data.ready?.database;
  const appStatus = data.detail?.status ?? data.ready?.status ?? data.live?.status;
  const allUnavailable = !data.live && !data.ready && !data.detail && !data.latency && hasMonitoringFailure;

  return <div className="dev-content developer-overview">
    <div className="dev-page-heading overview-heading"><div><h1>Platform Overview</h1></div><div className="overview-actions"><span className={`overview-overall ${statusTone(overall)}`}><i />{overall}</span><button className="dev-secondary-button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={15} className={busy ? "overview-spin" : ""} />{busy ? "Refreshing" : "Refresh"}</button></div></div>
    <div className={`overview-refresh-note ${allUnavailable ? "error" : ""}`}><span>{allUnavailable ? "Monitoring unavailable. Check your connection or try again." : `Auto refresh every 15 seconds · Last successful refresh: ${lastSuccessAt ? formatDate(lastSuccessAt) : "Waiting for response"}`}</span><span className="overview-next-refresh">{busy ? "Updating…" : `Next refresh: ${formatDate(nextRefreshAt)}`}</span></div>
    {hasMonitoringFailure && !allUnavailable && <div className="overview-stale-note" role="status">One or more monitoring requests failed. Confirmed values are retained and the request details are available below.</div>}
    <section className="overview-status-panel" aria-label="Application health summary"><div className="overview-section-title"><div><span className="dev-overline">SYSTEM HEALTH</span><h2>Application status</h2></div><span className={`overview-state ${statusTone(overall)}`}>{overall}</span></div>{hasMonitoringFailure && <p className="overview-health-message">Overall health is DOWN API requests did not return a successful response.</p>}<div className="overview-health-grid"><div><small>Application liveness</small><strong className={`text-${statusTone(data.live?.status)}`}>{statusText(data.live?.status)}</strong><span>Checked {formatDate(data.live?.checkedAt)}</span></div><div><small>Application readiness</small><strong className={`text-${statusTone(data.ready?.status)}`}>{statusText(data.ready?.status)}</strong><span>HTTP {diagnostics.find((item) => item.endpoint === endpointPaths.ready)?.httpStatus ?? "—"} · Checked {formatDate(data.ready?.checkedAt)}</span></div><div><small>Database connectivity</small><strong className={`text-${statusTone(databaseStatus)}`}>{statusText(databaseStatus)}</strong><span>{data.ready?.databaseLatencyMs !== undefined ? `${number(data.ready.databaseLatencyMs, 2)} ms readiness check` : "Readiness latency unavailable"}</span></div></div></section>
    <section className="overview-metric-grid" aria-label="Monitoring metrics">
      <Metric title="Application status" value={statusText(appStatus)} detail="Detailed health response" icon={Server} tone={statusTone(appStatus)} />
      <Metric title="Database status" value={statusText(databaseStatus)} detail={data.detail?.database?.database ?? "Database type unavailable"} icon={Database} tone={statusTone(databaseStatus)} />
      <Metric title="Database latency" value={data.detail?.database?.latencyMs !== undefined ? `${number(data.detail.database.latencyMs, 2)} ms` : data.ready?.databaseLatencyMs !== undefined ? `${number(data.ready.databaseLatencyMs, 2)} ms` : "—"} detail="Latest database check" icon={Gauge} />
      <Metric title="Application uptime" value={uptime(data.detail?.uptimeMs)} detail="Since this process started" icon={Timer} />
      <Metric title="JVM memory" value={memory(jvm?.usedMemoryBytes)} detail={`of ${memory(jvm?.maxMemoryBytes)} maximum`} icon={Activity} tone={memoryTone} />
      <Metric title="API average latency" value={data.latency?.averageLatencyMs !== undefined ? `${number(data.latency.averageLatencyMs, 2)} ms` : "—"} detail="Reported API average" icon={Gauge} />
      <Metric title="API maximum latency" value={data.latency?.maximumLatencyMs !== undefined ? `${number(data.latency.maximumLatencyMs, 2)} ms` : "—"} detail="Reported maximum" icon={Waypoints} />
      <Metric title="API requests" value={number(data.latency?.requestCount)} detail="Requests processed" icon={Activity} />
    </section>
    <div className="overview-detail-grid">
      <section className="dev-panel overview-panel"><div className="overview-section-title"><div><span className="dev-overline">DATABASE</span><h2>Connection pool</h2></div><Database size={18} /></div><p className="overview-panel-copy">{data.detail?.database?.database ?? "Database details unavailable"} · {data.detail?.database?.status ? statusText(data.detail.database.status) : "Status unavailable"} · {data.detail?.database?.latencyMs !== undefined ? `${number(data.detail.database.latencyMs, 2)} ms check` : "Latency unavailable"} · Checked {formatDate(data.detail?.checkedAt ?? data.ready?.checkedAt)}</p>{pool ? <><div className="overview-pool-name">{pool.name ?? "Connection pool"}</div><div className="overview-bars-label"><span>Active connection utilization</span><strong>{poolUse === null ? "Unavailable" : `${poolUse.toFixed(1)}%`}</strong></div><Progress value={poolUse} tone={poolTone} /><div className="overview-pool-stats"><span><i className="active-dot" />Active<strong>{number(pool.active)}</strong></span><span><i className="idle-dot" />Idle<strong>{number(pool.idle)}</strong></span><span>Total<strong>{number(pool.total)}</strong></span><span>Maximum<strong>{number(pool.maximum)}</strong></span><span>Minimum idle<strong>{number(pool.minimumIdle)}</strong></span></div></> : <div className="overview-empty">Connection pool information is unavailable from the backend.</div>}</section>
      <section className="dev-panel overview-panel"><div className="overview-section-title"><div><span className="dev-overline">JAVA RUNTIME</span><h2>JVM resources</h2></div><Cpu size={18} /></div><p className="overview-panel-copy">Resource values reported by the backend process.</p><div className="overview-bars-label"><span>Memory utilization</span><strong className={`text-${memoryTone}`}>{memoryUsed === null ? "Unavailable" : `${memoryUsed.toFixed(1)}%`}</strong></div><Progress value={memoryUsed} tone={memoryTone} /><div className="overview-memory-values"><span>Used<strong>{memory(jvm?.usedMemoryBytes)}</strong></span><span>Maximum<strong>{memory(jvm?.maxMemoryBytes)}</strong></span></div><div className="overview-cpu"><Cpu size={16} /><span>Available processors</span><strong>{number(jvm?.availableProcessors)}</strong></div><div className="overview-thresholds">Normal &lt; 70% · Warning 70–85% · Critical &gt; 85%</div></section>
      <section className="dev-panel overview-panel overview-api-panel"><div className="overview-section-title"><div><span className="dev-overline">API PERFORMANCE</span><h2>Request latency</h2></div><Gauge size={18} /></div><div className="overview-api-stats"><div><small>Requests processed</small><strong>{number(data.latency?.requestCount)}</strong></div><div><small>Average latency</small><strong>{data.latency?.averageLatencyMs !== undefined ? `${number(data.latency.averageLatencyMs, 2)} ms` : "—"}</strong></div><div><small>Maximum latency</small><strong>{data.latency?.maximumLatencyMs !== undefined ? `${number(data.latency.maximumLatencyMs, 2)} ms` : "—"}</strong></div></div><div className="overview-measured">Metrics measured {formatDate(data.latency?.measuredAt)}</div></section>
    </div>
    <details className="dev-panel overview-diagnostics"><summary>Monitoring request diagnostics <span>{diagnostics.length} endpoints · most recent poll</span></summary><div className="overview-diagnostics-list">{diagnostics.map((item) => <article key={item.endpoint}><div className="overview-diagnostic-head"><code>GET {item.endpoint}</code><span className={item.success ? "text-up" : "text-down"}>{item.success ? "Successful" : "Failed"}{item.httpStatus ? ` · HTTP ${item.httpStatus}` : ""}</span></div><div className="overview-diagnostic-meta">Requested {formatDate(item.requestedAt)}{item.respondedAt ? ` · Response ${formatDate(item.respondedAt)}` : ""} · {number(item.durationMs)} ms</div>{item.error && <p className="overview-diagnostic-error">{item.error}</p>}{item.payload !== undefined && item.payload !== null && <pre>{JSON.stringify(item.payload, null, 2)}</pre>}</article>)}</div></details>
  </div>;
}
