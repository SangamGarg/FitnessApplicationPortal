import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  Award,
  Check,
  ChevronDown,
  Clipboard,
  ExternalLink,
  Image,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperBadgeManagement.css";

const BADGES_ENDPOINT = "/api/v1/portal/dev/app-profile/badges";
const CREATE_BADGE_ENDPOINT = "/api/v1/portal/dev/app-profile/add-badges";
const MAX_HISTORY = 12;

export interface BadgeResponseDto {
  id: number;
  name: string;
  description: string;
  imageUrl: string | null;
  category: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  active: boolean;
}

export interface BadgeAddRequestDto {
  name: string;
  description: string;
  imageUrl?: string;
  category?: string;
  criteriaMetadata?: string;
  active: boolean;
}

export interface BadgeUpdateRequestDto {
  name?: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  criteriaMetadata?: string;
}

export interface BadgeStatusRequestDto {
  active: boolean;
}

type BadgeFormValues = {
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  criteriaMetadata: string;
  active: boolean;
};

type OperationRecord = {
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

type BadgeDialog =
  | { kind: "create" }
  | { kind: "edit"; badge: BadgeResponseDto }
  | { kind: "delete"; badge: BadgeResponseDto }
  | null;

type FilterState = "all" | "active" | "inactive" | "unlocked" | "locked";
type SortState = "name-asc" | "name-desc" | "id-asc" | "id-desc" | "recent-unlocked";

const EMPTY_FORM: BadgeFormValues = {
  name: "",
  description: "",
  imageUrl: "",
  category: "",
  criteriaMetadata: "",
  active: true,
};

function isBadge(value: unknown): value is BadgeResponseDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "number"
    && typeof record.name === "string"
    && typeof record.description === "string"
    && (typeof record.imageUrl === "string" || record.imageUrl === null)
    && (typeof record.category === "string" || record.category === null)
    && typeof record.unlocked === "boolean"
    && (typeof record.unlockedAt === "string" || record.unlockedAt === null)
    && typeof record.active === "boolean";
}

function isBadgeList(value: unknown): value is BadgeResponseDto[] {
  return Array.isArray(value) && value.every(isBadge);
}

function safeImageUrl(value: string): string | null {
  if (!value.trim() || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:")
      && !url.username
      && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Not unlocked";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function safeError(value: unknown, fallback: string): string {
  if (typeof value === "string") return value.replace(/(?:\r?\n\s+at\s+[\w.$]+\([^)]*\))+/g, "\n[stack trace omitted]");
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ["detail", "message", "error", "title"]) {
      if (typeof record[key] === "string") return safeError(record[key], fallback);
    }
  }
  return fallback;
}

function parseJson(value: string): string | null {
  if (!value.trim()) return null;
  try {
    JSON.parse(value);
    return null;
  } catch {
    return "Enter valid JSON.";
  }
}

function validateForm(form: BadgeFormValues, mode: "create" | "edit"): Record<string, string> {
  const errors: Record<string, string> = {};
  if (mode === "create" && !form.name.trim()) errors.name = "Name is required.";
  if (form.name.length > 100) errors.name = "Maximum length is 100 characters.";
  if (mode === "create" && !form.description.trim()) errors.description = "Description is required.";
  if (form.description.length > 1000) errors.description = "Maximum length is 1,000 characters.";
  if (form.imageUrl.length > 2048) errors.imageUrl = "Maximum length is 2,048 characters.";
  else if (form.imageUrl.trim() && !safeImageUrl(form.imageUrl.trim())) errors.imageUrl = "Enter a valid HTTP or HTTPS URL.";
  if (form.category.length > 50) errors.category = "Maximum length is 50 characters.";
  if (form.criteriaMetadata.length > 4000) errors.criteriaMetadata = "Maximum length is 4,000 characters.";
  else if (parseJson(form.criteriaMetadata)) errors.criteriaMetadata = "Enter valid JSON.";
  return errors;
}

function formFromBadge(badge: BadgeResponseDto): BadgeFormValues {
  return {
    name: badge.name,
    description: badge.description,
    imageUrl: badge.imageUrl ?? "",
    category: badge.category ?? "",
    criteriaMetadata: "",
    active: badge.active,
  };
}

async function decodeResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return "204 No Content";
  const raw = await response.text();
  if (!raw) return response.ok ? "Empty response body." : "No response body.";
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw.replace(/(?:\r?\n\s+at\s+[\w.$]+\([^)]*\))+/g, "\n[stack trace omitted]");
  }
}

async function executeBadgeRequest<T>(
  operation: string,
  method: string,
  endpoint: string,
  payload?: unknown,
): Promise<{ record: OperationRecord; data: T | null }> {
  const timestamp = new Date().toISOString();
  const started = performance.now();
  let response: Response | null = null;
  let data: unknown = null;
  let error = "";
  try {
    response = await portalFetch(endpoint, {
      method,
      headers: { Accept: "application/json" },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });
    data = await decodeResponse(response);
    if (!response.ok) error = `HTTP ${response.status}: ${safeError(data, response.statusText || "Request failed.")}`;
  } catch (requestError) {
    error = requestError instanceof Error ? requestError.message : "The request failed before a response was received.";
  }
  const record: OperationRecord = {
    operation,
    method,
    endpoint,
    timestamp,
    durationMs: Math.round(performance.now() - started),
    status: response?.status ?? null,
    ok: Boolean(response?.ok),
    request: payload ?? null,
    response: data,
    ...(error ? { error } : {}),
  };
  return { record, data: data as T | null };
}

function BadgeImage({ url, name, className }: { url: string | null; name: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const safeUrl = url ? safeImageUrl(url) : null;
  if (!safeUrl || safeUrl === failedUrl) {
    return <span className={`badge-image-fallback ${className ?? ""}`} aria-label={`${name} image unavailable`}><Image size={20} /></span>;
  }
  return <img className={className} src={safeUrl} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(safeUrl)} />;
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
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return <button type="button" className="badge-icon-button" aria-label={copied ? `${label} copied` : label} title={copied ? "Copied" : label} onClick={() => void copy()}>{copied ? <Check size={14} /> : <Clipboard size={14} />}</button>;
}

function BadgeForm({
  mode,
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial: BadgeFormValues;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: BadgeFormValues) => void;
}) {
  const [form, setForm] = useState(initial);
  const errors = validateForm(form, mode);
  const initialSnapshot = JSON.stringify(initial);
  const changed = JSON.stringify(form) !== initialSnapshot;
  const setField = <K extends keyof BadgeFormValues>(key: K, value: BadgeFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const shownErrors = (key: string) => errors[key] ?? "";
  const imageUrlError = shownErrors("imageUrl");
  const previewUrl = form.imageUrl.trim() && !imageUrlError ? safeImageUrl(form.imageUrl.trim()) : null;
  const valid = Object.keys(errors).length === 0;
  const hasUpdatePayload = form.name !== initial.name
    || form.description !== initial.description
    || (form.imageUrl !== initial.imageUrl && Boolean(form.imageUrl.trim()))
    || (form.category !== initial.category && Boolean(form.category.trim()))
    || Boolean(form.criteriaMetadata.trim());
  const disabled = busy || !valid || (mode === "edit" && (!changed || !hasUpdatePayload));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid && (mode === "create" || changed)) onSubmit(form);
  }

  return (
    <form className="badge-form" onSubmit={submit} noValidate>
      <label className="badge-field">
        <span>Name {mode === "create" && <b>Required</b>} <small>{form.name.length}/100</small></span>
        <input value={form.name} maxLength={100} onChange={(event) => setField("name", event.target.value)} aria-invalid={Boolean(shownErrors("name"))} />
        <small>{mode === "create" ? "Required · Maximum 100 characters" : "Optional · Maximum 100 characters"}</small>
        {shownErrors("name") && <small className="badge-field-error">{shownErrors("name")}</small>}
      </label>

      <label className="badge-field">
        <span>Description {mode === "create" && <b>Required</b>} <small>{form.description.length}/1,000</small></span>
        <textarea rows={4} value={form.description} maxLength={1000} onChange={(event) => setField("description", event.target.value)} aria-invalid={Boolean(shownErrors("description"))} />
        <small>{mode === "create" ? "Required · Maximum 1,000 characters" : "Optional · Maximum 1,000 characters"}</small>
        {shownErrors("description") && <small className="badge-field-error">{shownErrors("description")}</small>}
      </label>

      <label className="badge-field">
        <span>Image URL <em>Optional</em> <small>{form.imageUrl.length}/2,048</small></span>
        <input type="url" value={form.imageUrl} maxLength={2048} onChange={(event) => setField("imageUrl", event.target.value)} aria-invalid={Boolean(shownErrors("imageUrl"))} />
        <small>Optional · HTTP/HTTPS URL · Maximum 2,048 characters</small>
        {shownErrors("imageUrl") && <small className="badge-field-error">{shownErrors("imageUrl")}</small>}
        {form.imageUrl.trim() && !imageUrlError && !previewUrl && <small className="badge-field-error">Enter a valid HTTP or HTTPS URL.</small>}
        {previewUrl && <span className="badge-form-preview"><BadgeImage url={previewUrl} name="Badge image preview" /><span>Image preview</span></span>}
      </label>

      <label className="badge-field">
        <span>Category <em>Optional</em> <small>{form.category.length}/50</small></span>
        <input value={form.category} maxLength={50} onChange={(event) => setField("category", event.target.value)} />
        <small>Optional · Maximum 50 characters. Category values are accepted as text by the API.</small>
        {shownErrors("category") && <small className="badge-field-error">{shownErrors("category")}</small>}
      </label>

      <label className="badge-field">
        <span>Criteria metadata <em>Optional</em> <small>{form.criteriaMetadata.length}/4,000</small></span>
        <textarea className="badge-json-input" rows={5} value={form.criteriaMetadata} maxLength={4000} onChange={(event) => setField("criteriaMetadata", event.target.value)} spellCheck={false} />
        <small>Optional · Valid JSON required · Maximum 4,000 characters{mode === "edit" ? ". Existing metadata is not included in the badge response; only enter a value to update it." : "."}</small>
        {shownErrors("criteriaMetadata") && <small className="badge-field-error">{shownErrors("criteriaMetadata")}</small>}
      </label>

      {mode === "create" && <label className="badge-toggle-field"><input type="checkbox" checked={form.active} onChange={(event) => setField("active", event.target.checked)} /><span><strong>Active on creation</strong><small>Active status is separate from whether a user has unlocked this badge.</small></span></label>}
      {mode === "edit" && <p className="badge-form-note">Only changed fields are sent. Optional fields cleared in this form are omitted from the update because the API contract does not define clear semantics.</p>}

      <div className="badge-form-actions">
        <button type="button" className="badge-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="badge-primary" disabled={disabled}>{busy ? <LoaderCircle size={15} className="badge-spin" /> : <Check size={15} />}{busy ? "Saving…" : mode === "create" ? "Create badge" : "Save changes"}</button>
      </div>
    </form>
  );
}

export default function DeveloperBadgeManagement() {
  const [badges, setBadges] = useState<BadgeResponseDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterState>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState<SortState>("name-asc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BadgeResponseDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [dialog, setDialog] = useState<BadgeDialog>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [inspector, setInspector] = useState<OperationRecord | null>(null);
  const [history, setHistory] = useState<OperationRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function request<T = unknown>(
    operation: string,
    method: string,
    endpoint: string,
    payload?: unknown,
  ): Promise<{ record: OperationRecord; data: T | null }> {
    const result = await executeBadgeRequest<T>(operation, method, endpoint, payload);
    if (mountedRef.current) {
      setInspector(result.record);
      setHistory((current) => [result.record, ...current].slice(0, MAX_HISTORY));
    }
    return result;
  }

  const getAllBadges = () => request<unknown>("Get all badges", "GET", BADGES_ENDPOINT);
  const getBadgeDetails = (badgeId: number) => request<unknown>("Get badge details", "GET", `${BADGES_ENDPOINT}/${badgeId}`);
  const addBadge = (payload: BadgeAddRequestDto) => request<unknown>("Add badge", "POST", CREATE_BADGE_ENDPOINT, payload);
  const updateBadgeMetadata = (badgeId: number, payload: BadgeUpdateRequestDto) => request<unknown>("Update badge metadata", "PATCH", `${BADGES_ENDPOINT}/${badgeId}`, payload);
  const updateBadgeStatus = (badgeId: number, payload: BadgeStatusRequestDto) => request<unknown>("Update badge status", "PATCH", `${BADGES_ENDPOINT}/${badgeId}/status`, payload);
  const removeBadge = (badgeId: number) => request("Delete badge", "DELETE", `${BADGES_ENDPOINT}/${badgeId}`);

  async function loadBadges(showLoading = true) {
    const requestId = ++listRequestId.current;
    if (showLoading) setLoading(true);
    setLoadError("");
    const { record, data } = await getAllBadges();
    if (!mountedRef.current || requestId !== listRequestId.current) return;
    if (!record.ok) {
      setLoadError(record.error || "Unable to load badges.");
      setLoading(false);
      return;
    }
    if (!isBadgeList(data)) {
      setLoadError("The badge list response did not match the expected DTO.");
      setBadges(null);
      setLoading(false);
      return;
    }
    setBadges(data);
    setLoading(false);
    setSelectedId((current) => current !== null && !data.some((badge) => badge.id === current) ? null : current);
    setDetail((current) => current ? data.find((badge) => badge.id === current.id) ?? current : current);
  }

  useEffect(() => {
    void Promise.resolve().then(() => { if (mountedRef.current) void loadBadges(); });
    // Load only once when this workspace is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetails(badge: BadgeResponseDto) {
    const requestId = ++detailRequestId.current;
    setSelectedId(badge.id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    const { record, data } = await getBadgeDetails(badge.id);
    if (!mountedRef.current || requestId !== detailRequestId.current) return;
    if (!record.ok) setDetailError(record.error || "Unable to load badge details.");
    else if (!isBadge(data) || data.id !== badge.id) setDetailError("Badge details response did not match the requested badge.");
    else setDetail(data);
    setDetailLoading(false);
  }

  const categories = useMemo(() => [...new Set((badges ?? []).map((badge) => badge.category).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [badges]);
  const filteredBadges = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const rows = (badges ?? []).filter((badge) => {
      if (query && ![badge.name, String(badge.id), badge.description, badge.category ?? ""].some((value) => value.toLocaleLowerCase().includes(query))) return false;
      if (filter === "active" && !badge.active) return false;
      if (filter === "inactive" && badge.active) return false;
      if (filter === "unlocked" && !badge.unlocked) return false;
      if (filter === "locked" && badge.unlocked) return false;
      return !(categoryFilter && badge.category !== categoryFilter);
    });
    return rows.sort((a, b) => {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      if (sort === "id-asc") return a.id - b.id;
      if (sort === "id-desc") return b.id - a.id;
      const aTime = a.unlockedAt ? Date.parse(a.unlockedAt) : Number.NEGATIVE_INFINITY;
      const bTime = b.unlockedAt ? Date.parse(b.unlockedAt) : Number.NEGATIVE_INFINITY;
      return bTime - aTime;
    });
  }, [badges, categoryFilter, filter, search, sort]);

  const stats = useMemo(() => ({
    total: badges?.length ?? 0,
    active: badges?.filter((badge) => badge.active).length ?? 0,
    inactive: badges?.filter((badge) => !badge.active).length ?? 0,
    unlocked: badges?.filter((badge) => badge.unlocked).length ?? 0,
  }), [badges]);

  function openCreate() {
    setNotice(null);
    setDialog({ kind: "create" });
  }

  function openEdit(badge: BadgeResponseDto) {
    setNotice(null);
    setDialog({ kind: "edit", badge });
  }

  async function createBadge(values: BadgeFormValues) {
    if (busyRef.current) return;
    busyRef.current = true;
    setFormBusy(true);
    setNotice(null);
    const payload: BadgeAddRequestDto = {
      name: values.name.trim(),
      description: values.description.trim(),
      active: values.active,
      ...(values.imageUrl.trim() ? { imageUrl: values.imageUrl.trim() } : {}),
      ...(values.category.trim() ? { category: values.category.trim() } : {}),
      ...(values.criteriaMetadata.trim() ? { criteriaMetadata: values.criteriaMetadata } : {}),
    };
    try {
      const { record, data } = await addBadge(payload);
      if (!record.ok) {
        setNotice({ kind: "error", message: record.error || "Badge creation failed." });
        return;
      }
      if (!isBadge(data)) {
        setNotice({ kind: "error", message: `Badge creation succeeded with HTTP ${record.status}, but the response did not match BadgeResponseDto. Refresh the list before retrying.` });
        await loadBadges(false);
        return;
      }
      setDialog(null);
      setNotice({ kind: "success", message: `Create request completed with HTTP ${record.status}.` });
      await loadBadges(false);
    } finally {
      busyRef.current = false;
      setFormBusy(false);
    }
  }

  async function updateBadge(badge: BadgeResponseDto, values: BadgeFormValues) {
    if (busyRef.current) return;
    busyRef.current = true;
    setFormBusy(true);
    setNotice(null);
    const original = formFromBadge(badge);
    const payload: BadgeUpdateRequestDto = {
      ...(values.name !== original.name ? { name: values.name.trim() } : {}),
      ...(values.description !== original.description ? { description: values.description.trim() } : {}),
      ...(values.imageUrl !== original.imageUrl && values.imageUrl.trim() ? { imageUrl: values.imageUrl.trim() } : {}),
      ...(values.category !== original.category && values.category.trim() ? { category: values.category.trim() } : {}),
      ...(values.criteriaMetadata.trim() ? { criteriaMetadata: values.criteriaMetadata } : {}),
    };
    if (!Object.keys(payload).length) {
      setNotice({ kind: "error", message: "No non-empty changed fields are available to update." });
      busyRef.current = false;
      setFormBusy(false);
      return;
    }
    try {
      const { record, data } = await updateBadgeMetadata(badge.id, payload);
      if (!record.ok) {
        setNotice({ kind: "error", message: record.error || "Badge update failed." });
        return;
      }
      if (!isBadge(data) || data.id !== badge.id) {
        setNotice({ kind: "error", message: `Badge update succeeded with HTTP ${record.status}, but the response did not match BadgeResponseDto. Refresh the list to verify the current values.` });
        await loadBadges(false);
        return;
      }
      setDialog(null);
      setNotice({ kind: "success", message: `Badge "${data.name}" updated (HTTP ${record.status}).` });
      await loadBadges(false);
    } finally {
      busyRef.current = false;
      setFormBusy(false);
    }
  }

  async function toggleActive(badge: BadgeResponseDto) {
    if (busyRef.current || statusBusyId !== null) return;
    const next = !badge.active;
    if (!next && !window.confirm(`Disable badge "${badge.name}" (ID ${badge.id})? This does not change its unlocked status.`)) return;
    busyRef.current = true;
    setStatusBusyId(badge.id);
    setNotice(null);
    try {
      const { record, data } = await updateBadgeStatus(badge.id, { active: next });
      if (!record.ok) {
        setNotice({ kind: "error", message: record.error || "Badge status update failed." });
        return;
      }
      if (!isBadge(data) || data.id !== badge.id) {
        setNotice({ kind: "error", message: `Status update returned HTTP ${record.status}, but the response did not match BadgeResponseDto.` });
        await loadBadges(false);
        return;
      }
      setBadges((current) => current?.map((item) => item.id === badge.id ? data : item) ?? current);
      setDetail((current) => current?.id === badge.id ? data : current);
      setNotice({ kind: "success", message: `Badge "${data.name}" is now ${data.active ? "active" : "inactive"}.` });
    } finally {
      busyRef.current = false;
      setStatusBusyId(null);
    }
  }

  async function deleteBadge(badge: BadgeResponseDto) {
    if (busyRef.current) return;
    busyRef.current = true;
    setDeleteBusy(true);
    setNotice(null);
    try {
      const { record } = await removeBadge(badge.id);
      if (!record.ok) {
        setNotice({ kind: "error", message: record.error || "Badge deletion failed." });
        return;
      }
      if (record.status !== 204) {
        setNotice({ kind: "error", message: `Delete returned HTTP ${record.status ?? "unknown"}; expected 204 No Content.` });
        return;
      }
      setDialog(null);
      setSelectedId(null);
      setDetail(null);
      setNotice({ kind: "success", message: `Badge "${badge.name}" deleted (204 No Content).` });
      await loadBadges(false);
    } finally {
      busyRef.current = false;
      setDeleteBusy(false);
    }
  }

  function closeDialog() {
    if (formBusy || deleteBusy) return;
    setDialog(null);
  }

  const selectedBadge = selectedId === null ? null : badges?.find((badge) => badge.id === selectedId) ?? null;

  return (
    <div className="dev-content badge-management">
      <div className="dev-page-heading badge-page-heading">
        <div><h1>Badge Management</h1><p>Manage badge definitions, visibility, unlock information, and metadata for the app profile.</p></div>
        <div className="badge-page-actions">
          <button type="button" className="badge-secondary" onClick={() => void loadBadges()} disabled={loading}><RefreshCw size={15} className={loading ? "badge-spin" : ""} /> Refresh</button>
          <button type="button" className="badge-primary" onClick={openCreate}><Plus size={16} /> Create Badge</button>
        </div>
      </div>

      {notice && <div className={`badge-notice ${notice.kind}`} role="status"><AlertCircle size={16} /><span>{notice.message}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15} /></button></div>}

      <div className="badge-stats">
        <article><span>Total badges</span><strong>{loading && badges === null ? "—" : stats.total}</strong><Award size={17} /></article>
        <article><span>Active</span><strong>{loading && badges === null ? "—" : stats.active}</strong><ToggleRight size={17} /></article>
        <article><span>Inactive</span><strong>{loading && badges === null ? "—" : stats.inactive}</strong><ToggleLeft size={17} /></article>
        <article><span>Unlocked</span><strong>{loading && badges === null ? "—" : stats.unlocked}</strong><Check size={17} /></article>
      </div>

      <div className="badge-workspace-grid">
        <section className="badge-panel badge-list-panel">
          <div className="badge-list-toolbar">
            <div><h2>Badges</h2><p>{badges === null ? "Waiting for the badge API." : `${filteredBadges.length} of ${badges.length} badges`}</p></div>
            <div className="badge-list-actions"><label className="badge-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, description" /></label></div>
          </div>
          <div className="badge-filters">
            <label><span>Status</span><select value={filter} onChange={(event) => setFilter(event.target.value as FilterState)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="unlocked">Unlocked</option><option value="locked">Locked</option></select></label>
            <label><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as SortState)}><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="id-asc">ID ascending</option><option value="id-desc">ID descending</option><option value="recent-unlocked">Recently unlocked</option></select></label>
            {(search || categoryFilter || filter !== "all") && <button type="button" className="badge-text-button" onClick={() => { setSearch(""); setCategoryFilter(""); setFilter("all"); }}>Clear filters</button>}
          </div>
          {loading && badges === null ? (
            <div className="badge-state"><LoaderCircle size={20} className="badge-spin" /> Loading badges…</div>
          ) : loadError ? (
            <div className="badge-state badge-state-error"><AlertCircle size={21} /><strong>Could not load badges</strong><span>{loadError}</span><button type="button" className="badge-secondary" onClick={() => void loadBadges()}><RefreshCw size={14} /> Retry</button></div>
          ) : badges?.length === 0 ? (
            <div className="badge-state"><Award size={25} /><strong>No badges available</strong><span>Create the first badge to add it to the app profile.</span><button type="button" className="badge-primary" onClick={openCreate}><Plus size={14} /> Create Badge</button></div>
          ) : filteredBadges.length === 0 ? (
            <div className="badge-state"><Search size={22} /><strong>No matching badges</strong><span>Try changing the search term or filters.</span><button type="button" className="badge-secondary" onClick={() => { setSearch(""); setCategoryFilter(""); setFilter("all"); }}>Clear search and filters</button></div>
          ) : (
            <div className="badge-table-wrap">
              <table className="badge-table">
                <thead><tr><th>Badge</th><th>Description</th><th>Category</th><th>Status</th><th>Unlocked</th><th>Unlocked at</th><th>Actions</th></tr></thead>
                <tbody>{filteredBadges.map((badge) => <tr key={badge.id} className={selectedId === badge.id ? "selected" : ""}>
                  <td><button type="button" className="badge-name-button" onClick={() => void openDetails(badge)}><BadgeImage url={badge.imageUrl} name={badge.name} /><span><strong>{badge.name}</strong><small>ID: {badge.id}</small></span></button></td>
                  <td className="badge-description">{badge.description}</td>
                  <td>{badge.category || "—"}</td>
                  <td><span className={`badge-status ${badge.active ? "active" : "inactive"}`}>{badge.active ? "Active" : "Inactive"}</span></td>
                  <td><span className={`badge-status ${badge.unlocked ? "unlocked" : "locked"}`}>{badge.unlocked ? "Unlocked" : "Locked"}</span></td>
                  <td>{formatDate(badge.unlockedAt)}</td>
                  <td><div className="badge-row-actions">
                    <button type="button" className="badge-small-button" onClick={() => void openDetails(badge)}>Details</button>
                    <button type="button" className="badge-icon-button" aria-label={`Edit ${badge.name}`} title="Edit badge" onClick={() => openEdit(badge)}><Pencil size={14} /></button>
                    <button type="button" className="badge-icon-button" aria-label={badge.active ? `Disable ${badge.name}` : `Enable ${badge.name}`} title={badge.active ? "Disable badge" : "Enable badge"} disabled={statusBusyId === badge.id} onClick={() => void toggleActive(badge)}>{badge.active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}</button>
                    <button type="button" className="badge-icon-button danger" aria-label={`Delete ${badge.name}`} title="Delete badge" onClick={() => setDialog({ kind: "delete", badge })}><Trash2 size={14} /></button>
                  </div></td>
                </tr>)}</tbody>
              </table>
              <div className="badge-mobile-list">{filteredBadges.map((badge) => <article className="badge-mobile-card" key={badge.id}>
                <div className="badge-mobile-head"><button type="button" className="badge-name-button" onClick={() => void openDetails(badge)}><BadgeImage url={badge.imageUrl} name={badge.name} /><span><strong>{badge.name}</strong><small>ID: {badge.id}</small></span></button><button type="button" className="badge-icon-button danger" aria-label={`Delete ${badge.name}`} onClick={() => setDialog({ kind: "delete", badge })}><Trash2 size={14} /></button></div>
                <p>{badge.description}</p><div className="badge-mobile-status"><span className={`badge-status ${badge.active ? "active" : "inactive"}`}>{badge.active ? "Active" : "Inactive"}</span><span className={`badge-status ${badge.unlocked ? "unlocked" : "locked"}`}>{badge.unlocked ? "Unlocked" : "Locked"}</span><span>{badge.category || "Uncategorized"}</span></div>
                <small>Unlocked at: {formatDate(badge.unlockedAt)}</small>
                <div><button type="button" className="badge-small-button" onClick={() => void openDetails(badge)}>Details</button><button type="button" className="badge-small-button" onClick={() => openEdit(badge)}>Edit</button><button type="button" className="badge-small-button" disabled={statusBusyId === badge.id} onClick={() => void toggleActive(badge)}>{badge.active ? "Disable" : "Enable"}</button></div>
              </article>)}</div>
            </div>
          )}
        </section>

        <aside className="badge-side-column">
          <section className="badge-panel badge-detail-panel">
            <div className="badge-panel-heading"><div><h2>Badge details</h2><p>Fetches the selected badge directly from the API.</p></div>{selectedBadge && <button type="button" className="badge-icon-button" aria-label="Close badge details" onClick={() => { setSelectedId(null); setDetail(null); setDetailError(""); }}><X size={15} /></button>}</div>
            {!selectedId ? <div className="badge-detail-empty"><Award size={21} /><span>Select a badge to view its current details.</span></div>
              : detailLoading ? <div className="badge-detail-empty"><LoaderCircle size={19} className="badge-spin" /><span>Loading badge details…</span></div>
                : detailError ? <div className="badge-detail-empty badge-state-error"><AlertCircle size={18} /><span>{detailError}</span><button className="badge-small-button" type="button" onClick={() => selectedBadge && void openDetails(selectedBadge)}>Retry</button></div>
                  : detail ? <div className="badge-detail-content">
                    <BadgeImage className="badge-detail-image" url={detail.imageUrl} name={detail.name} />
                    <dl>
                      <div><dt>ID</dt><dd>{detail.id}</dd></div><div><dt>Name</dt><dd>{detail.name}</dd></div><div><dt>Description</dt><dd>{detail.description || "—"}</dd></div>
                      <div><dt>Category</dt><dd>{detail.category || "—"}</dd></div><div><dt>Active</dt><dd><span className={`badge-status ${detail.active ? "active" : "inactive"}`}>{detail.active ? "Active" : "Inactive"}</span></dd></div>
                      <div><dt>Unlocked</dt><dd><span className={`badge-status ${detail.unlocked ? "unlocked" : "locked"}`}>{detail.unlocked ? "Unlocked" : "Locked"}</span></dd></div>
                      <div><dt>Unlocked at</dt><dd>{formatDate(detail.unlockedAt)}</dd></div>
                      <div><dt>Image URL</dt><dd>{detail.imageUrl ? <span className="badge-image-url">{detail.imageUrl}<CopyButton value={detail.imageUrl} label="Copy image URL" /><a href={safeImageUrl(detail.imageUrl) ?? undefined} target="_blank" rel="noopener noreferrer" aria-label="Open badge image"><ExternalLink size={13} /></a></span> : "Not set"}</dd></div>
                    </dl>
                    <div className="badge-detail-actions"><button type="button" className="badge-secondary" onClick={() => openEdit(detail)}><Pencil size={14} /> Edit</button><button type="button" className="badge-secondary" disabled={statusBusyId === detail.id} onClick={() => void toggleActive(detail)}>{detail.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}{detail.active ? "Disable" : "Enable"}</button><button type="button" className="badge-danger" onClick={() => setDialog({ kind: "delete", badge: detail })}><Trash2 size={14} /> Delete</button></div>
                    <details className="badge-raw-response" open><summary>Raw badge response <ChevronDown size={14} /></summary><pre>{JSON.stringify(detail, null, 2)}</pre><CopyButton value={JSON.stringify(detail, null, 2)} label="Copy badge response JSON" /></details>
                  </div> : null}
          </section>

          <section className="badge-panel badge-inspector">
            <div className="badge-panel-heading"><div><h2>API Inspector</h2><p>Latest real badge API operation.</p></div>{inspector && <span className={`badge-status ${inspector.ok ? "active" : "inactive"}`}>{inspector.status === null ? "Network error" : `HTTP ${inspector.status}`}</span>}</div>
            {!inspector ? <p className="badge-inspector-empty">No API request yet.</p> : <>
              <div className="badge-inspector-meta"><span><strong>{inspector.method}</strong> {inspector.endpoint}</span><small>{new Date(inspector.timestamp).toLocaleString()} · {inspector.durationMs} ms</small></div>
              {inspector.error && <div className="badge-inline-error"><AlertCircle size={14} />{inspector.error}</div>}
              <div className="badge-inspector-json">
                <details open><summary>Request {inspector.request === null ? "(none)" : ""}</summary><pre>{JSON.stringify(inspector.request, null, 2)}</pre>{inspector.request !== null && <CopyButton value={JSON.stringify(inspector.request, null, 2)} label="Copy request JSON" />}</details>
                <details open><summary>Actual response</summary><pre>{typeof inspector.response === "string" ? inspector.response : JSON.stringify(inspector.response, null, 2)}</pre><CopyButton value={typeof inspector.response === "string" ? inspector.response : JSON.stringify(inspector.response, null, 2)} label="Copy response JSON" /></details>
              </div>
            </>}
            <button type="button" className="badge-text-button badge-history-toggle" onClick={() => setShowHistory((current) => !current)}>{showHistory ? "Hide" : "Show"} execution history ({history.length})</button>
            {showHistory && <div className="badge-history-list">{history.length ? history.map((entry, index) => <button type="button" key={`${entry.timestamp}-${index}`} onClick={() => setInspector(entry)}><span><strong>{entry.operation}</strong><small>{entry.method} · {new Date(entry.timestamp).toLocaleTimeString()}</small></span><span className={`badge-status ${entry.ok ? "active" : "inactive"}`}>{entry.status === null ? "No response" : entry.status}</span></button>) : <p>No executions yet.</p>}</div>}
          </section>
        </aside>
      </div>

      {dialog && <div className="badge-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeDialog(); }}>
        <section className="badge-dialog" role="dialog" aria-modal="true" aria-labelledby="badge-dialog-title">
          <header><div><h2 id="badge-dialog-title">{dialog.kind === "create" ? "Create badge" : dialog.kind === "edit" ? "Edit badge" : "Delete badge?"}</h2><p>{dialog.kind === "create" ? "Create a badge definition in App Profile." : dialog.kind === "edit" ? `Badge ID ${dialog.badge.id} · edit metadata only.` : "This permanently removes the badge definition."}</p></div><button type="button" className="badge-icon-button" aria-label="Close dialog" disabled={formBusy || deleteBusy} onClick={closeDialog}><X size={16} /></button></header>
          {dialog.kind === "create" && <BadgeForm key="create" mode="create" initial={EMPTY_FORM} busy={formBusy} onCancel={closeDialog} onSubmit={(values) => void createBadge(values)} />}
          {dialog.kind === "edit" && <BadgeForm key={`edit-${dialog.badge.id}`} mode="edit" initial={formFromBadge(dialog.badge)} busy={formBusy} onCancel={closeDialog} onSubmit={(values) => void updateBadge(dialog.badge, values)} />}
          {dialog.kind === "delete" && <div className="badge-delete-confirm"><BadgeImage url={dialog.badge.imageUrl} name={dialog.badge.name} /><div><strong>{dialog.badge.name}</strong><span>Badge ID: {dialog.badge.id}</span><p>Deleting this badge cannot be undone. Its active and unlocked state will no longer be available.</p></div><footer><button type="button" className="badge-secondary" disabled={deleteBusy} onClick={closeDialog}>Cancel</button><button type="button" className="badge-danger" disabled={deleteBusy} onClick={() => void deleteBadge(dialog.badge)}>{deleteBusy ? <LoaderCircle size={15} className="badge-spin" /> : <Trash2 size={14} />}{deleteBusy ? "Deleting…" : "Delete badge"}</button></footer></div>}
        </section>
      </div>}
    </div>
  );
}
