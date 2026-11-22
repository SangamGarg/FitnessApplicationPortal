import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle, CalendarClock, Check, ChevronDown, Clipboard, Clock3,
  FileJson, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, Target,
  Trash2, Trophy, X,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperChallengeManagement.css";

const BASE = "/api/v1/portal/dev/challenge";
const METRICS = [
  "ACTIVITY_COUNT", "ACTIVE_MINUTES", "STEPS", "CALORIES", "GAME_REPS", "GAME_SCORE", "GAME_HOLD_SECONDS",
] as const;
type ChallengeMetric = typeof METRICS[number];
type FormMode = "create" | "update" | "patch";
type Challenge = {
  id: number;
  title: string;
  description: string | null;
  metric: ChallengeMetric;
  targetValue: number;
  activityType: string | null;
  startsAt: string;
  endsAt: string;
  rewardXp: number;
  rewardCoins: number;
  active: boolean;
  createdAt: string;
};
type FullRequest = {
  title: string;
  description: string | null;
  metric: ChallengeMetric;
  targetValue: number;
  activityType: string | null;
  startsAt: string;
  endsAt: string;
  rewardXp: number;
  rewardCoins: number;
};
type PatchRequest = { [Key in keyof FullRequest]?: FullRequest[Key] | null };
type ApiRecord = {
  operation: string;
  method: string;
  endpoint: string;
  timestamp: string;
  durationMs: number;
  status: number | null;
  ok: boolean;
  request: unknown;
  response: unknown;
  error?: string;
};
type Result = { record: ApiRecord; data: unknown };
type FormValues = {
  title: string;
  description: string;
  metric: string;
  targetValue: string;
  activityType: string;
  startsAt: string;
  endsAt: string;
  rewardXp: string;
  rewardCoins: string;
};
type EditableField = keyof FormValues;

const FIELDS: { key: EditableField; label: string; required: boolean; help: string }[] = [
  { key: "title", label: "Title", required: true, help: "Required. Maximum 120 characters." },
  { key: "description", label: "Description", required: false, help: "Optional. Maximum 1000 characters; clear to remove." },
  { key: "metric", label: "Metric", required: true, help: "Select a supported challenge metric." },
  { key: "targetValue", label: "Target value", required: true, help: "Required. Positive whole number." },
  { key: "activityType", label: "Activity type", required: false, help: "Optional. Maximum 40 characters; clear to remove." },
  { key: "startsAt", label: "Starts at", required: true, help: "Required. Local time is converted to UTC for the API." },
  { key: "endsAt", label: "Ends at", required: true, help: "Required. Must be later than start time." },
  { key: "rewardXp", label: "Reward XP", required: true, help: "Required. Whole number from 0 to 100000." },
  { key: "rewardCoins", label: "Reward coins", required: true, help: "Required. Whole number from 0 to 100000." },
];
const emptyValues = (): FormValues => ({
  title: "", description: "", metric: "", targetValue: "", activityType: "",
  startsAt: "", endsAt: "", rewardXp: "0", rewardCoins: "0",
});
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

function isChallenge(value: unknown): value is Challenge {
  return isObject(value)
    && typeof value.id === "number"
    && typeof value.title === "string"
    && isNullableString(value.description)
    && typeof value.metric === "string"
    && (METRICS as readonly string[]).includes(value.metric)
    && typeof value.targetValue === "number"
    && isNullableString(value.activityType)
    && typeof value.startsAt === "string"
    && typeof value.endsAt === "string"
    && Number.isFinite(new Date(value.startsAt).getTime())
    && Number.isFinite(new Date(value.endsAt).getTime())
    && typeof value.rewardXp === "number"
    && typeof value.rewardCoins === "number"
    && typeof value.active === "boolean"
    && typeof value.createdAt === "string";
}
function normalizeChallenges(value: unknown): Challenge[] | null {
  let candidate = value;
  for (let depth = 0; depth < 3 && isObject(candidate); depth += 1) {
    if (Array.isArray(candidate.content)) { candidate = candidate.content; break; }
    if (Array.isArray(candidate.challenges)) { candidate = candidate.challenges; break; }
    if ("data" in candidate) candidate = candidate.data;
    else if ("result" in candidate) candidate = candidate.result;
    else break;
  }
  return Array.isArray(candidate) && candidate.every(isChallenge) ? candidate : null;
}
async function decode(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}
function apiError(data: unknown, fallback: string): string {
  if (typeof data === "string") return data.split(/\r?\n\s*at\s+/)[0].trim();
  if (isObject(data)) {
    for (const key of ["detail", "message", "error", "title"]) {
      if (typeof data[key] === "string") return String(data[key]).split(/\r?\n\s*at\s+/)[0].trim();
    }
  }
  return fallback;
}
function metricLabel(metric: string): string {
  const labels: Record<string, string> = {
    ACTIVITY_COUNT: "Activity Count", ACTIVE_MINUTES: "Active Minutes", STEPS: "Steps",
    CALORIES: "Calories Burned", GAME_REPS: "Game Repetitions", GAME_SCORE: "Game Score",
    GAME_HOLD_SECONDS: "Game Hold Duration (Seconds)",
  };
  return labels[metric] ?? metric;
}
function toLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function toInstant(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function localDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid date" : date.toLocaleString();
}
function temporalStatus(challenge: Challenge, now: number): "UPCOMING" | "IN_PROGRESS" | "ENDED" {
  const start = new Date(challenge.startsAt).getTime();
  const end = new Date(challenge.endsAt).getTime();
  if (now < start) return "UPCOMING";
  if (now > end) return "ENDED";
  return "IN_PROGRESS";
}
function challengeToForm(challenge?: Challenge): FormValues {
  if (!challenge) return emptyValues();
  return {
    title: challenge.title, description: challenge.description ?? "", metric: challenge.metric,
    targetValue: String(challenge.targetValue), activityType: challenge.activityType ?? "",
    startsAt: toLocalDateTime(challenge.startsAt), endsAt: toLocalDateTime(challenge.endsAt),
    rewardXp: String(challenge.rewardXp), rewardCoins: String(challenge.rewardCoins),
  };
}
function validateField(field: EditableField, values: FormValues): string {
  const value = values[field];
  if (field === "title") {
    if (!value.trim()) return "Title is required.";
    return value.length > 120 ? "Maximum 120 characters." : "";
  }
  if (field === "description") return value.length > 1000 ? "Maximum 1000 characters." : "";
  if (field === "metric") return (METRICS as readonly string[]).includes(value) ? "" : "Select a supported metric.";
  if (field === "targetValue") return !/^[1-9]\d*$/.test(value) ? "Enter a positive whole number." : Number(value) > Number.MAX_SAFE_INTEGER ? "Target value is too large." : "";
  if (field === "activityType") return value.length > 40 ? "Maximum 40 characters." : "";
  if (field === "startsAt" || field === "endsAt") return toInstant(value) ? "" : "Select a valid date and time.";
  if (field === "rewardXp" || field === "rewardCoins") return !/^\d+$/.test(value) || Number(value) > 100000 ? "Enter a whole number from 0 to 100000." : "";
  return "";
}
function valuesToFullRequest(values: FormValues): FullRequest {
  const startsAt = toInstant(values.startsAt);
  const endsAt = toInstant(values.endsAt);
  if (!startsAt || !endsAt) throw new Error("Select valid start and end date/time values.");
  return {
    title: values.title.trim(), description: values.description.trim() || null,
    metric: values.metric as ChallengeMetric, targetValue: Number(values.targetValue),
    activityType: values.activityType.trim() || null, startsAt, endsAt,
    rewardXp: Number(values.rewardXp), rewardCoins: Number(values.rewardCoins),
  };
}
function getBackendFieldErrors(data: unknown): Record<string, string> {
  if (!isObject(data)) return {};
  const result: Record<string, string> = {};
  const errors = isObject(data.errors) ? data.errors : data;
  const fieldMap: Record<string, EditableField> = {
    title: "title", description: "description", metric: "metric", targetValue: "targetValue",
    activityType: "activityType", startsAt: "startsAt", endsAt: "endsAt",
    rewardXp: "rewardXp", rewardCoins: "rewardCoins",
  };
  for (const [serverKey, field] of Object.entries(fieldMap)) {
    const value = errors[serverKey];
    if (typeof value === "string") result[field] = value;
    else if (Array.isArray(value) && typeof value[0] === "string") result[field] = value[0];
  }
  return result;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch { setCopied(false); }
  }
  return <button className="challenge-icon-button" type="button" aria-label={copied ? "Copied" : label} title={copied ? "Copied" : label} onClick={() => void copy()}>{copied ? <Check size={13} /> : <Clipboard size={13} />}</button>;
}

function ChallengeForm({ mode, challenge, run, onClose, onSaved }: {
  mode: FormMode;
  challenge: Challenge | null;
  run: (operation: string, method: string, endpoint: string, payload?: unknown) => Promise<Result>;
  onClose: () => void;
  onSaved: (record: ApiRecord) => void;
}) {
  const [values, setValues] = useState(() => challengeToForm(challenge ?? undefined));
  const [selected, setSelected] = useState<Set<EditableField>>(() => new Set(FIELDS.map((field) => field.key)));
  const [touched, setTouched] = useState<Set<EditableField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [backendErrors, setBackendErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const isPatch = mode === "patch";

  function update(field: EditableField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setBackendErrors((current) => ({ ...current, [field]: "" }));
  }
  function effectiveError(field: EditableField): string {
    const backend = backendErrors[field];
    if (backend) return backend;
    if (isPatch && !selected.has(field)) return "";
    if (!submitted && !touched.has(field)) return "";
    const ownError = validateField(field, values);
    if (ownError) return ownError;
    if (field === "startsAt" || field === "endsAt") {
      const start = toInstant(values.startsAt);
      const end = toInstant(values.endsAt);
      if (start && end && new Date(end).getTime() <= new Date(start).getTime()) return "End time must be later than start time.";
    }
    return "";
  }
  function validate(): boolean {
    setSubmitted(true);
    const activeFields = isPatch ? [...selected] : FIELDS.map((field) => field.key);
    const nextBackendErrors = { ...backendErrors };
    const invalid = activeFields.some((field) => {
      const fieldError = validateField(field, values);
      if (fieldError) return true;
      if ((field === "startsAt" || field === "endsAt") && values.startsAt && values.endsAt) {
        const start = toInstant(values.startsAt);
        const end = toInstant(values.endsAt);
        return Boolean(start && end && new Date(end).getTime() <= new Date(start).getTime());
      }
      return false;
    });
    if (isPatch && activeFields.length === 0) {
      setBackendErrors(nextBackendErrors);
      return false;
    }
    setBackendErrors(nextBackendErrors);
    return !invalid;
  }
  const patchPreview = useMemo(() => {
    const payload: PatchRequest = {};
    for (const field of selected) {
      if (field === "title") payload.title = values.title.trim();
      else if (field === "description") payload.description = values.description.trim() || null;
      else if (field === "metric") payload.metric = values.metric as ChallengeMetric;
      else if (field === "targetValue") payload.targetValue = Number(values.targetValue);
      else if (field === "activityType") payload.activityType = values.activityType.trim() || null;
      else if (field === "startsAt") payload.startsAt = toInstant(values.startsAt);
      else if (field === "endsAt") payload.endsAt = toInstant(values.endsAt);
      else if (field === "rewardXp") payload.rewardXp = Number(values.rewardXp);
      else if (field === "rewardCoins") payload.rewardCoins = Number(values.rewardCoins);
    }
    return payload;
  }, [selected, values]);
  function toggleField(field: EditableField) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !validate()) return;
    if (isPatch && selected.size === 0) return;
    setBusy(true);
    setBackendErrors({});
    let result: Result;
    if (mode === "create") {
      result = await run("Create challenge", "POST", `${BASE}/create`, valuesToFullRequest(values));
    } else if (mode === "update" && challenge) {
      result = await run("Full update challenge", "PUT", `${BASE}/${challenge.id}`, valuesToFullRequest(values));
    } else if (mode === "patch" && challenge) {
      result = await run("Partially update challenge", "PATCH", `${BASE}/${challenge.id}`, patchPreview);
    } else {
      setBusy(false);
      return;
    }
    setBusy(false);
    if (result.record.ok) {
      onSaved(result.record);
      onClose();
    } else {
      const fieldErrors = getBackendFieldErrors(result.data);
      setBackendErrors(fieldErrors);
      setSubmitted(true);
    }
  }
  const title = mode === "create" ? "Create challenge" : mode === "update" ? "Full update" : "Partial update";
  return (
    <div className="challenge-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form className="challenge-modal challenge-form-modal" onSubmit={(event) => void submit(event)} noValidate>
        <header className="challenge-modal-heading">
          <div><span className="challenge-overline">{isPatch ? "PATCH · SELECTED FIELDS ONLY" : mode === "update" ? "PUT · COMPLETE CONFIGURATION" : "POST · NEW CHALLENGE"}</span><h2>{title}</h2><p>{isPatch ? "Choose exactly which properties to send. Unselected properties are omitted." : "All configuration fields will be validated and submitted."}</p></div>
          <button type="button" className="challenge-icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={15} /></button>
        </header>
        <div className="challenge-fields">
          {FIELDS.map((field) => {
            const error = effectiveError(field.key);
            return (
              <div className={`challenge-field ${field.key === "title" || field.key === "description" ? "wide" : ""} ${error ? "invalid" : ""}`} key={field.key}>
                <div className="challenge-field-label">
                  {isPatch && <input type="checkbox" checked={selected.has(field.key)} disabled={busy} aria-label={`Include ${field.label} in patch`} onChange={() => toggleField(field.key)} />}
                  <label htmlFor={`challenge-${field.key}`}>{field.label} {field.required && !isPatch ? "*" : isPatch && selected.has(field.key) ? "· selected" : !field.required ? "(optional)" : ""}</label>
                  {field.key === "title" && <span>{values.title.length}/120</span>}
                  {field.key === "description" && <span>{values.description.length}/1000</span>}
                  {field.key === "activityType" && <span>{values.activityType.length}/40</span>}
                </div>
                {field.key === "description" ? (
                  <textarea id={`challenge-${field.key}`} maxLength={1000} value={values.description} disabled={busy || (isPatch && !selected.has(field.key))} onChange={(event) => update(field.key, event.target.value)} onBlur={() => setTouched((current) => new Set(current).add(field.key))} placeholder="Describe the challenge" />
                ) : field.key === "metric" ? (
                  <select id={`challenge-${field.key}`} value={values.metric} disabled={busy || (isPatch && !selected.has(field.key))} onChange={(event) => update(field.key, event.target.value)} onBlur={() => setTouched((current) => new Set(current).add(field.key))}>
                    <option value="">Select a metric</option>{METRICS.map((metric) => <option value={metric} key={metric}>{metricLabel(metric)}</option>)}
                  </select>
                ) : (
                  <input
                    id={`challenge-${field.key}`}
                    type={field.key === "startsAt" || field.key === "endsAt" ? "datetime-local" : field.key === "targetValue" || field.key === "rewardXp" || field.key === "rewardCoins" ? "number" : "text"}
                    min={field.key === "targetValue" ? 1 : field.key === "rewardXp" || field.key === "rewardCoins" ? 0 : undefined}
                    max={field.key === "rewardXp" || field.key === "rewardCoins" ? 100000 : undefined}
                    step={field.key === "targetValue" || field.key === "rewardXp" || field.key === "rewardCoins" ? 1 : undefined}
                    maxLength={field.key === "title" ? 120 : field.key === "activityType" ? 40 : undefined}
                    value={values[field.key]}
                    disabled={busy || (isPatch && !selected.has(field.key))}
                    onChange={(event) => update(field.key, event.target.value)}
                    onBlur={() => setTouched((current) => new Set(current).add(field.key))}
                    placeholder={field.key === "activityType" ? "Optional activity type" : undefined}
                  />
                )}
                <small className={error ? "challenge-field-error" : ""}>{error || field.help}</small>
              </div>
            );
          })}
        </div>
        {isPatch && <section className="challenge-patch-preview"><header><strong>PATCH payload preview</strong><span>Only selected fields will be submitted</span><CopyButton value={JSON.stringify(patchPreview, null, 2)} label="Copy PATCH payload" /></header><pre>{JSON.stringify(patchPreview, null, 2)}</pre></section>}
        <footer className="challenge-form-footer"><button type="button" className="challenge-secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="challenge-primary" disabled={busy || (isPatch && selected.size === 0)}>{busy && <LoaderCircle className="challenge-spin" size={14} />}{isPatch ? "Send PATCH" : mode === "update" ? "Save full update" : "Create challenge"}</button></footer>
      </form>
    </div>
  );
}

function ApiInspector({ record, history, pending, onClear, onSelect }: { record: ApiRecord | null; history: ApiRecord[]; pending: boolean; onClear: () => void; onSelect: (record: ApiRecord) => void }) {
  return (
    <section className="challenge-panel challenge-inspector">
      <header className="challenge-panel-heading"><div><h2><FileJson size={15} /> API request inspector</h2><p>Actual challenge API requests, status codes, and response bodies.</p></div><div className="challenge-inspector-actions">{pending && <span className="challenge-pending"><LoaderCircle className="challenge-spin" size={12} />Request pending</span>}<button type="button" className="challenge-text-button" disabled={!history.length} onClick={onClear}>Clear history</button></div></header>
      {!record ? <div className="challenge-inspector-empty">No challenge API requests in this session.</div> : (
        <details open>
          <summary><span className={`challenge-http ${record.ok ? "ok" : record.status == null ? "pending" : "bad"}`}>{record.status == null ? "Network error" : `HTTP ${record.status}`}</span><b>{record.method}</b><code>{record.endpoint}</code><ChevronDown size={14} /></summary>
          <div className="challenge-request-meta"><span>{record.operation}</span><span>{new Date(record.timestamp).toLocaleString()}</span><span>{record.durationMs} ms</span><CopyButton value={record.endpoint} label="Copy endpoint" /></div>
          {record.error && <p className="challenge-api-error">{record.error}</p>}
          <div className="challenge-json-grid">
            <section><header><b>Request payload</b><CopyButton value={JSON.stringify(record.request, null, 2)} label="Copy request" /></header><pre>{record.request == null ? "No request body." : JSON.stringify(record.request, null, 2)}</pre></section>
            <section><header><b>Response body</b><CopyButton value={record.response == null ? record.status === 204 ? "204 No Content" : "null" : JSON.stringify(record.response, null, 2)} label="Copy response" /></header><pre>{record.response == null ? record.status === 204 ? "204 No Content" : "Empty response body." : typeof record.response === "string" ? record.response : JSON.stringify(record.response, null, 2)}</pre></section>
          </div>
        </details>
      )}
      {history.length > 1 && <details className="challenge-history"><summary>Recent requests ({history.length}) <ChevronDown size={13} /></summary><ol>{history.slice(1).map((item, index) => <li key={`${item.timestamp}-${index}`}><button type="button" className="challenge-history-row" onClick={() => onSelect(item)}><span className={`challenge-http ${item.ok ? "ok" : item.status == null ? "pending" : "bad"}`}>{item.status ?? "—"}</span><b>{item.method}</b><code>{item.endpoint}</code><time>{new Date(item.timestamp).toLocaleTimeString()}</time></button></li>)}</ol></details>}
    </section>
  );
}

function temporalLabel(status: ReturnType<typeof temporalStatus>): string {
  return status === "IN_PROGRESS" ? "In progress" : status === "UPCOMING" ? "Upcoming" : "Ended";
}

export default function DeveloperChallengeManagement() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [metricFilter, setMetricFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [temporalFilter, setTemporalFilter] = useState("");
  const [sort, setSort] = useState<"startsAt" | "endsAt" | "title" | "createdAt">("startsAt");
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState<{ mode: FormMode; challenge: Challenge | null } | null>(null);
  const [details, setDetails] = useState<Challenge | null>(null);
  const [deleting, setDeleting] = useState<Challenge | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [inspector, setInspector] = useState<ApiRecord | null>(null);
  const [history, setHistory] = useState<ApiRecord[]>([]);
  const [pending, setPending] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true);
  const loadSequence = useRef(0);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const run = useCallback(async (operation: string, method: string, endpoint: string, payload?: unknown): Promise<Result> => {
    const started = performance.now();
    const timestamp = new Date().toISOString();
    if (mounted.current) setPending((count) => count + 1);
    let response: Response | null = null;
    let data: unknown = null;
    let error = "";
    try {
      response = await portalFetch(endpoint, {
        method,
        headers: payload === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
      });
      data = await decode(response);
      if (!response.ok) error = `HTTP ${response.status}: ${apiError(data, response.statusText || "Request failed.")}`;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "The request failed before an HTTP response was received.";
    }
    const record: ApiRecord = {
      operation, method, endpoint, timestamp, durationMs: Math.round(performance.now() - started),
      status: response?.status ?? null, ok: Boolean(response?.ok), request: payload ?? null, response: data,
      ...(error ? { error } : {}),
    };
    if (mounted.current) {
      setInspector(record);
      setHistory((current) => [record, ...current].slice(0, 20));
      setPending((count) => Math.max(0, count - 1));
      if (!record.ok) setNotice({ ok: false, text: record.error || "Request failed." });
    }
    return { record, data };
  }, []);

  const loadChallenges = useCallback(async () => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    setLoadError("");
    const result = await run("Get challenges", "GET", `${BASE}/get`);
    if (!mounted.current || requestId !== loadSequence.current) return;
    setLoading(false);
    if (!result.record.ok) {
      setChallenges([]);
      setLoadError(result.record.error || "Unable to load challenges.");
      return;
    }
    const normalized = normalizeChallenges(result.data);
    if (!normalized) {
      setChallenges([]);
      setLoadError("The challenge response did not match the expected challenge list.");
      return;
    }
    setChallenges(normalized);
    setDetails((current) => current ? normalized.find((item) => item.id === current.id) ?? current : null);
  }, [run]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadChallenges(), 0);
    return () => window.clearTimeout(timer);
  }, [loadChallenges, refresh]);

  async function reload() {
    setRefresh((value) => value + 1);
  }
  async function afterSave(record: ApiRecord) {
    setNotice({ ok: true, text: `${record.operation} succeeded (HTTP ${record.status}).` });
    await loadChallenges();
  }
  async function changeStatus(challenge: Challenge) {
    if (statusBusy !== null) return;
    setStatusBusy(challenge.id);
    const active = !challenge.active;
    const result = await run(active ? "Activate challenge" : "Deactivate challenge", "PATCH", `${BASE}/${challenge.id}/status`, { active });
    setStatusBusy(null);
    if (result.record.ok) {
      setNotice({ ok: true, text: `${challenge.title} ${active ? "activated" : "deactivated"} (HTTP ${result.record.status}).` });
      await loadChallenges();
    }
  }
  async function deleteChallenge() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    const challenge = deleting;
    const result = await run("Delete challenge", "DELETE", `${BASE}/${challenge.id}`);
    setDeleteBusy(false);
    if (result.record.ok) {
      setDeleting(null);
      if (details?.id === challenge.id) setDetails(null);
      setNotice({ ok: true, text: `${challenge.title} deleted (HTTP ${result.record.status}).` });
      await loadChallenges();
    }
  }

  const activityOptions = useMemo(() => [...new Set(challenges.map((challenge) => challenge.activityType).filter((value): value is string => Boolean(value)))].sort(), [challenges]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return challenges
      .filter((challenge) => !query || challenge.title.toLocaleLowerCase().includes(query) || (challenge.description ?? "").toLocaleLowerCase().includes(query))
      .filter((challenge) => !activeFilter || String(challenge.active) === activeFilter)
      .filter((challenge) => !metricFilter || challenge.metric === metricFilter)
      .filter((challenge) => !activityFilter || challenge.activityType === activityFilter)
      .filter((challenge) => !temporalFilter || temporalStatus(challenge, now) === temporalFilter)
      .sort((left, right) => sort === "title"
        ? left.title.localeCompare(right.title)
        : new Date(left[sort]).getTime() - new Date(right[sort]).getTime());
  }, [challenges, search, activeFilter, metricFilter, activityFilter, temporalFilter, sort, now]);
  const stats = useMemo(() => ({
    total: challenges.length,
    active: challenges.filter((challenge) => challenge.active).length,
    inactive: challenges.filter((challenge) => !challenge.active).length,
    upcoming: challenges.filter((challenge) => temporalStatus(challenge, now) === "UPCOMING").length,
    ended: challenges.filter((challenge) => temporalStatus(challenge, now) === "ENDED").length,
  }), [challenges, now]);

  return (
    <div className="dev-content challenge-management">
      <header className="challenge-page-heading">
        <div><div className="dev-overline">GAMES / CHALLENGE CONFIGURATION</div><h1>Games &amp; Challenges</h1><p>Create fitness challenges, configure targets and rewards, and control publication status through live APIs.</p></div>
        <div className="challenge-page-actions"><button type="button" className="challenge-secondary" disabled={loading} onClick={() => void reload()}><RefreshCw size={14} /> Refresh</button><button type="button" className="challenge-primary" onClick={() => setModal({ mode: "create", challenge: null })}><Plus size={14} /> Create challenge</button></div>
      </header>
      {notice && <div className={`challenge-notice ${notice.ok ? "success" : "error"}`} role="status"><span>{notice.ok ? <Check size={14} /> : <AlertCircle size={14} />}{notice.text}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={14} /></button></div>}
      <section className="challenge-stat-grid" aria-label="Challenge statistics">
        <article><span><Trophy size={15} /></span><small>Total challenges</small><strong>{loading && !inspector ? "…" : stats.total}</strong></article>
        <article><span className="green"><ShieldCheck size={15} /></span><small>Active</small><strong>{stats.active}</strong></article>
        <article><span className="muted"><X size={15} /></span><small>Inactive</small><strong>{stats.inactive}</strong></article>
        <article><span className="blue"><CalendarClock size={15} /></span><small>Upcoming</small><strong>{stats.upcoming}</strong></article>
        <article><span className="amber"><Clock3 size={15} /></span><small>Ended</small><strong>{stats.ended}</strong></article>
      </section>
      <section className="challenge-panel">
        <header className="challenge-panel-heading"><div><h2><Target size={15} /> Challenge catalog</h2><p>Challenge activity and timeline are shown separately.</p></div><span className="challenge-count">{loading ? "Loading…" : loadError ? "Unavailable" : `${filtered.length} / ${challenges.length}`}</span></header>
        <div className="challenge-toolbar">
          <label className="challenge-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or description" /><button type="button" aria-label="Clear search" disabled={!search} onClick={() => setSearch("")}><X size={13} /></button></label>
          <label className="challenge-filter"><span>Active</span><select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
          <label className="challenge-filter"><span>Metric</span><select value={metricFilter} onChange={(event) => setMetricFilter(event.target.value)}><option value="">All metrics</option>{METRICS.map((metric) => <option value={metric} key={metric}>{metricLabel(metric)}</option>)}</select></label>
          <label className="challenge-filter"><span>Activity type</span><select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}><option value="">All types</option>{activityOptions.map((activity) => <option value={activity} key={activity}>{activity}</option>)}</select></label>
          <label className="challenge-filter"><span>Timeline</span><select value={temporalFilter} onChange={(event) => setTemporalFilter(event.target.value)}><option value="">All</option><option value="UPCOMING">Upcoming</option><option value="IN_PROGRESS">In progress</option><option value="ENDED">Ended</option></select></label>
          <label className="challenge-filter"><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="startsAt">Start date</option><option value="endsAt">End date</option><option value="createdAt">Created date</option><option value="title">Title</option></select></label>
        </div>
        {loadError ? <div className="challenge-state error"><AlertCircle size={21} /><strong>Unable to load challenges</strong><span>{loadError}</span><button type="button" className="challenge-secondary" onClick={() => void reload()}><RefreshCw size={13} /> Retry</button></div>
          : loading && !challenges.length ? <div className="challenge-state"><LoaderCircle className="challenge-spin" size={19} />Loading challenges…</div>
            : !challenges.length ? <div className="challenge-state"><Trophy size={24} /><strong>No challenges yet</strong><span>The backend returned an empty challenge list.</span><button type="button" className="challenge-primary" onClick={() => setModal({ mode: "create", challenge: null })}><Plus size={13} /> Create challenge</button></div>
              : !filtered.length ? <div className="challenge-state"><Search size={22} /><strong>No matching challenges</strong><span>Adjust search or filters to see backend records.</span></div>
                : <div className="challenge-table-wrap"><table className="challenge-table"><thead><tr><th>Challenge</th><th>Metric / target</th><th>Activity</th><th>Schedule</th><th>Rewards</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((challenge) => {
                  const temporal = temporalStatus(challenge, now);
                  return <tr key={challenge.id}><td><button type="button" className="challenge-title-button" onClick={() => setDetails(challenge)}><strong>{challenge.title}</strong><small>ID {challenge.id} · {challenge.description || "No description"}</small></button></td><td><strong>{metricLabel(challenge.metric)}</strong><small>Target: {challenge.targetValue.toLocaleString()}</small></td><td>{challenge.activityType || "—"}</td><td><span>{localDate(challenge.startsAt)}</span><small>to {localDate(challenge.endsAt)}</small></td><td><span className="challenge-reward">{challenge.rewardXp.toLocaleString()} XP</span><small>{challenge.rewardCoins.toLocaleString()} coins</small></td><td><div className="challenge-status-stack"><span className={`challenge-state-badge ${challenge.active ? "active" : "inactive"}`}>{challenge.active ? "Active" : "Inactive"}</span><span className={`challenge-time-badge ${temporal.toLowerCase()}`}>{temporalLabel(temporal)}</span></div></td><td><div className="challenge-row-actions"><button type="button" className="challenge-small-button" onClick={() => setDetails(challenge)}>View</button><button type="button" className="challenge-icon-button" aria-label={`Edit ${challenge.title}`} title="Full update (PUT)" onClick={() => setModal({ mode: "update", challenge })}>Edit</button><button type="button" className="challenge-icon-button" aria-label={`Partially edit ${challenge.title}`} title="Partial update (PATCH)" onClick={() => setModal({ mode: "patch", challenge })}>PATCH</button><button type="button" className="challenge-icon-button" disabled={statusBusy !== null} aria-label={`${challenge.active ? "Deactivate" : "Activate"} ${challenge.title}`} title={`${challenge.active ? "Deactivate" : "Activate"} using status endpoint`} onClick={() => void changeStatus(challenge)}>{statusBusy === challenge.id ? <LoaderCircle className="challenge-spin" size={13} /> : challenge.active ? "Deactivate" : "Activate"}</button><button type="button" className="challenge-icon-button danger" aria-label={`Delete ${challenge.title}`} onClick={() => setDeleting(challenge)}><Trash2 size={13} /></button></div></td></tr>;
                })}</tbody></table></div>}
      </section>
      <ApiInspector record={inspector} history={history} pending={pending > 0} onClear={() => { setInspector(null); setHistory([]); }} onSelect={setInspector} />

      {modal && <ChallengeForm mode={modal.mode} challenge={modal.challenge} run={run} onClose={() => setModal(null)} onSaved={(record) => void afterSave(record)} />}
      {details && <div className="challenge-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}><aside className="challenge-modal challenge-detail-modal"><header className="challenge-modal-heading"><div><span className="challenge-overline">CHALLENGE DETAILS · ID {details.id}</span><h2>{details.title}</h2><p>{details.description || "No description provided."}</p></div><button type="button" className="challenge-icon-button" aria-label="Close challenge details" onClick={() => setDetails(null)}><X size={15} /></button></header><div className="challenge-detail-content"><div className="challenge-detail-badges"><span className={`challenge-state-badge ${details.active ? "active" : "inactive"}`}>{details.active ? "Active" : "Inactive"}</span><span className={`challenge-time-badge ${temporalStatus(details, now).toLowerCase()}`}>{temporalLabel(temporalStatus(details, now))}</span></div><dl><div><dt>Metric</dt><dd>{metricLabel(details.metric)}</dd></div><div><dt>Target</dt><dd>{details.targetValue.toLocaleString()}</dd></div><div><dt>Activity type</dt><dd>{details.activityType || "—"}</dd></div><div><dt>Starts</dt><dd>{localDate(details.startsAt)}</dd></div><div><dt>Ends</dt><dd>{localDate(details.endsAt)}</dd></div><div><dt>Reward XP</dt><dd>{details.rewardXp.toLocaleString()}</dd></div><div><dt>Reward coins</dt><dd>{details.rewardCoins.toLocaleString()}</dd></div><div><dt>Created</dt><dd>{localDate(details.createdAt)}</dd></div></dl><footer><button type="button" className="challenge-secondary" onClick={() => { setDetails(null); setModal({ mode: "patch", challenge: details }); }}>Partial edit</button><button type="button" className="challenge-secondary" onClick={() => { setDetails(null); setModal({ mode: "update", challenge: details }); }}>Full edit</button><button type="button" className="challenge-primary" disabled={statusBusy !== null} onClick={() => void changeStatus(details)}>{statusBusy === details.id && <LoaderCircle className="challenge-spin" size={13} />}{details.active ? "Deactivate" : "Activate"}</button></footer></div></aside></div>}
      {deleting && <div className="challenge-backdrop" role="presentation"><section className="challenge-modal challenge-confirm"><button type="button" className="challenge-icon-button challenge-close" aria-label="Close delete confirmation" disabled={deleteBusy} onClick={() => setDeleting(null)}><X size={14} /></button><span className="challenge-confirm-icon"><Trash2 size={18} /></span><h2>Delete challenge?</h2><p>This permanently deletes <strong>{deleting.title}</strong> (ID {deleting.id}). This cannot be undone.</p><footer><button type="button" className="challenge-secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="challenge-danger" disabled={deleteBusy} onClick={() => void deleteChallenge()}>{deleteBusy && <LoaderCircle className="challenge-spin" size={13} />}Delete challenge</button></footer></section></div>}
    </div>
  );
}
