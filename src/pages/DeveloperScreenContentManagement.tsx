import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, Check, Clipboard, Eye, FileJson2, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { APP_SCREEN_CONTENT_ENDPOINT, screenContentApi, ScreenContentApiError, type AppScreenContentResponseDto, type AppScreenContentUpsertRequestDto } from "../lib/screenContentApi";
import "./DeveloperScreenContentManagement.css";

type Draft = { screenKey: string; title: string; subTitle: string; description: string; active: boolean };
type ActivityItem = { method: string; endpoint: string; status: number | null; duration: number; request: unknown; response: unknown; error?: string };
const blankDraft = (): Draft => ({ screenKey: "", title: "", subTitle: "", description: "", active: true });
const errorMessage = (e: unknown) => e instanceof Error ? e.message : "The request could not be completed.";
const date = (value: string) => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(); };

export default function DeveloperScreenContentManagement() {
  const [records, setRecords] = useState<AppScreenContentResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [editor, setEditor] = useState<{ id?: number } | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppScreenContentResponseDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyStatus, setBusyStatus] = useState<number | null>(null);
  const [detail, setDetail] = useState<AppScreenContentResponseDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activity, setActivity] = useState<ActivityItem | null>(null);

  const run = useCallback(async <T,>(method: string, endpoint: string, request: unknown, action: () => Promise<{ data: T; status: number }>): Promise<T> => {
    const started = performance.now();
    try {
      const result = await action();
      setActivity({ method, endpoint, status: result.status, duration: Math.round(performance.now() - started), request, response: result.data });
      return result.data;
    } catch (cause) {
      const err = cause instanceof ScreenContentApiError ? cause : null;
      setActivity({ method, endpoint, status: err?.status ?? null, duration: Math.round(performance.now() - started), request, response: err?.responseBody ?? null, error: errorMessage(cause) });
      throw cause;
    }
  }, []);

  const load = useCallback(async (track = true) => {
    setLoading(true); setPageError("");
    try {
      const data = track
        ? await run("GET", APP_SCREEN_CONTENT_ENDPOINT, null, screenContentApi.getAll)
        : (await screenContentApi.getAll()).data;
      if (!Array.isArray(data)) throw new Error("The screen content API returned an unexpected response; expected a list.");
      setRecords(data);
    } catch (cause) { setPageError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [run]);
  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => ({ total: records.length, active: records.filter((item) => item.active).length, inactive: records.filter((item) => !item.active).length }), [records]);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return records.filter((item) => (!term || `${item.id} ${item.screenKey} ${item.title} ${item.subTitle ?? ""} ${item.description ?? ""}`.toLocaleLowerCase().includes(term)) && (filter === "All" || (filter === "Active" ? item.active : !item.active)))
      .sort((a, b) => a.screenKey.localeCompare(b.screenKey));
  }, [records, query, filter]);

  const openCreate = () => { setDraft(blankDraft()); setFieldErrors({}); setPageError(""); setEditor({}); };
  const openEdit = async (record: AppScreenContentResponseDto) => {
    setSaving(true); setPageError("");
    try {
      const fresh = await run("GET", `${APP_SCREEN_CONTENT_ENDPOINT}/${record.id}`, { id: record.id }, () => screenContentApi.getById(record.id));
      setDraft({ screenKey: fresh.screenKey, title: fresh.title, subTitle: fresh.subTitle ?? "", description: fresh.description ?? "", active: fresh.active });
      setFieldErrors({}); setEditor({ id: fresh.id });
    } catch (cause) { setPageError(errorMessage(cause)); }
    finally { setSaving(false); }
  };
  const patch = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft((previous) => ({ ...previous, [key]: value })); setFieldErrors((previous) => ({ ...previous, [key]: "" })); };
  const validate = () => {
    const errors: Record<string, string> = {};
    if (!draft.screenKey.trim()) errors.screenKey = "Screen Key is required.";
    if (draft.screenKey.trim().length > 100) errors.screenKey = "Maximum length is 100 characters.";
    if (!draft.title.trim()) errors.title = "Title is required.";
    if (draft.title.trim().length > 150) errors.title = "Maximum length is 150 characters.";
    if (draft.subTitle.length > 250) errors.subTitle = "Maximum length is 250 characters.";
    if (draft.description.length > 1000) errors.description = "Maximum length is 1000 characters.";
    setFieldErrors(errors); return Object.keys(errors).length === 0;
  };
  const save = async () => {
    if (!editor || saving || !validate()) return;
    const dto: AppScreenContentUpsertRequestDto = { screenKey: draft.screenKey.trim().toUpperCase(), title: draft.title.trim(), subTitle: draft.subTitle.trim() || null, description: draft.description.trim() || null, active: draft.active };
    setSaving(true); setPageError("");
    try {
      if (editor.id === undefined) await run("POST", APP_SCREEN_CONTENT_ENDPOINT, dto, () => screenContentApi.create(dto));
      else await run("PUT", `${APP_SCREEN_CONTENT_ENDPOINT}/${editor.id}`, dto, () => screenContentApi.update(editor.id!, dto));
      setEditor(null); setNotice(editor.id === undefined ? "Screen content created." : "Screen content updated."); await load(false);
    } catch (cause) { setPageError(errorMessage(cause)); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!deleteTarget || deleting) return;
    const record = deleteTarget; setDeleting(true); setPageError("");
    try { await run("DELETE", `${APP_SCREEN_CONTENT_ENDPOINT}/${record.id}`, { id: record.id }, () => screenContentApi.delete(record.id)); setDeleteTarget(null); setNotice("Screen content deleted."); await load(false); }
    catch (cause) { setPageError(errorMessage(cause)); }
    finally { setDeleting(false); }
  };
  const changeStatus = async (record: AppScreenContentResponseDto) => {
    if (busyStatus !== null) return;
    const dto = { active: !record.active }; setBusyStatus(record.id); setPageError("");
    try { await run("PATCH", `${APP_SCREEN_CONTENT_ENDPOINT}/${record.id}/status`, dto, () => screenContentApi.updateStatus(record.id, dto)); setNotice(`Screen content ${dto.active ? "activated" : "deactivated"}.`); await load(false); }
    catch (cause) { setPageError(errorMessage(cause)); }
    finally { setBusyStatus(null); }
  };
  const openDetail = async (record: AppScreenContentResponseDto) => {
    setDetail(null); setDetailLoading(true); setPageError("");
    try { setDetail(await run("GET", `${APP_SCREEN_CONTENT_ENDPOINT}/${record.id}`, { id: record.id }, () => screenContentApi.getById(record.id))); }
    catch (cause) { setPageError(errorMessage(cause)); }
    finally { setDetailLoading(false); }
  };
  const copy = async (value: unknown) => { try { await navigator.clipboard.writeText(JSON.stringify(value, null, 2)); setNotice("JSON copied to clipboard."); } catch { setNotice("Clipboard access is unavailable in this browser context."); } };

  return <main className="screen-content-page">
    <header className="sc-heading"><div><span className="sc-eyebrow"><Activity size={14}/> DEVELOPER WORKSPACE</span><h1>App Screen Content Management</h1><p>Manage the live titles and supporting copy shown across the fitness app.</p></div><div className="sc-heading-actions"><button className="sc-button secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "sc-spin" : ""}/> Refresh</button><button className="sc-button primary" onClick={openCreate}><Plus size={17}/> Create content</button></div></header>
    <section className="sc-metrics" aria-label="Screen content summary"><Metric label="Total records" value={metrics.total}/><Metric label="Active" value={metrics.active} tone="green"/><Metric label="Inactive" value={metrics.inactive} tone="muted"/></section>
    {pageError && <div className="sc-alert" role="alert"><AlertCircle size={18}/><span>{pageError}</span><button onClick={() => void load()}>Retry</button></div>}
    {notice && <div className="sc-notice" role="status"><Check size={16}/>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15}/></button></div>}
    <section className="sc-panel"><div className="sc-toolbar"><div><h2>Screen content</h2><p>Records are loaded from the authenticated developer API.</p></div><div className="sc-controls"><label className="sc-search"><Search size={16}/><input aria-label="Search screen content" placeholder="Search key, title or copy" value={query} onChange={(e) => setQuery(e.target.value)}/></label><select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></div></div>
      {loading ? <div className="sc-loading"><LoaderCircle className="sc-spin"/> Loading screen content…</div> : visible.length === 0 ? <div className="sc-empty"><FileJson2 size={30}/><strong>{records.length === 0 ? "No screen content yet" : "No matching records"}</strong><span>{records.length === 0 ? "Create the first entry to configure copy in the app." : "Adjust the search or status filter."}</span>{records.length === 0 && <button className="sc-button primary" onClick={openCreate}><Plus size={16}/> Create content</button>}</div> : <div className="sc-table-wrap"><table className="sc-table"><thead><tr><th>ID</th><th>Screen key</th><th>Content</th><th>Status</th><th>Updated</th><th><span className="sc-sr-only">Actions</span></th></tr></thead><tbody>{visible.map((record) => <tr key={record.id}><td className="sc-id">#{record.id}</td><td><code>{record.screenKey}</code></td><td className="sc-content-cell"><strong>{record.title}</strong><span>{record.subTitle || record.description || "No supporting copy"}</span></td><td><button className={`sc-status ${record.active ? "active" : "inactive"}`} onClick={() => void changeStatus(record)} disabled={busyStatus !== null} aria-label={`${record.active ? "Deactivate" : "Activate"} ${record.screenKey}`}>{busyStatus === record.id && <LoaderCircle size={12} className="sc-spin"/>}{record.active ? "Active" : "Inactive"}</button></td><td className="sc-date">{date(record.updatedAt)}</td><td><div className="sc-row-actions"><button aria-label={`View ${record.screenKey}`} title="View details" onClick={() => void openDetail(record)}><Eye size={16}/></button><button aria-label={`Edit ${record.screenKey}`} title="Edit" onClick={() => void openEdit(record)}><Pencil size={16}/></button><button className="danger" aria-label={`Delete ${record.screenKey}`} title="Delete" onClick={() => setDeleteTarget(record)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>}
    </section>
    {activity && <details className="sc-activity"><summary><FileJson2 size={16}/> Latest API operation <span className={`sc-state ${activity.error ? "failed" : "success"}`}>{activity.error ? "Failed" : "Success"}</span><small>{activity.method} · HTTP {activity.status ?? "No response"} · {activity.duration} ms</small></summary><div className="sc-activity-body"><div><strong>{activity.method}</strong> <code>{activity.endpoint}</code></div>{activity.request !== null && <JsonBlock label="Request" value={activity.request} copy={() => void copy(activity.request)}/>}<JsonBlock label="Response" value={activity.response} copy={() => void copy(activity.response)}/>{activity.error && <p className="sc-activity-error">{activity.error}</p>}</div></details>}

    {editor && <div className="sc-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setEditor(null); }}><section className="sc-dialog" role="dialog" aria-modal="true" aria-labelledby="sc-editor-title"><header><div><span className="sc-eyebrow">SCREEN CONTENT</span><h2 id="sc-editor-title">{editor.id === undefined ? "Create content" : `Edit record #${editor.id}`}</h2><p>Changes are submitted to the screen content API.</p></div><button className="sc-close" aria-label="Close form" disabled={saving} onClick={() => setEditor(null)}><X/></button></header><div className="sc-form-body">
      <Field label="Screen Key" name="screenKey" value={draft.screenKey} max={100} error={fieldErrors.screenKey} help="Unique app screen identifier, such as GAME_HOME. It is submitted in uppercase." change={(v) => patch("screenKey", v)}/>
      <Field label="Title" name="title" value={draft.title} max={150} error={fieldErrors.title} help="Main heading displayed on the screen." change={(v) => patch("title", v)}/>
      <Field label="Subtitle" name="subTitle" value={draft.subTitle} max={250} error={fieldErrors.subTitle} help="Secondary heading displayed below the title." change={(v) => patch("subTitle", v)}/>
      <div className="sc-field"><div className="sc-label-line"><label htmlFor="sc-description">Description</label><span>{draft.description.length}/1000</span></div><textarea id="sc-description" rows={4} maxLength={1000} value={draft.description} onChange={(e) => patch("description", e.target.value)}/><small>Additional contextual text displayed on the screen.</small><span className="sc-validation" role="alert">{fieldErrors.description ?? " "}</span></div>
      <label className="sc-toggle"><span><strong>Active</strong><small>{draft.active ? "This content can be served to the app." : "This content will not be served to the app."}</small></span><input type="checkbox" checked={draft.active} onChange={(e) => patch("active", e.target.checked)}/></label>
      <footer><button className="sc-button secondary" disabled={saving} onClick={() => setEditor(null)}>Cancel</button><button className="sc-button primary" disabled={saving} onClick={() => void save()}>{saving && <LoaderCircle size={15} className="sc-spin"/>}{editor.id === undefined ? "Create content" : "Save changes"}</button></footer>
    </div></section></div>}
    {deleteTarget && <div className="sc-overlay"><section className="sc-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sc-delete-title"><h2 id="sc-delete-title">Delete screen content?</h2><p>Delete <strong>{deleteTarget.title}</strong> for <code>{deleteTarget.screenKey}</code> (#{deleteTarget.id})? This action is permanent.</p><footer><button className="sc-button secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="sc-button danger-button" disabled={deleting} onClick={() => void remove()}>{deleting && <LoaderCircle size={15} className="sc-spin"/>}<Trash2 size={15}/> Delete</button></footer></section></div>}
    {(detail || detailLoading) && <div className="sc-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null); }}><section className="sc-dialog sc-detail" role="dialog" aria-modal="true" aria-labelledby="sc-detail-title"><header><div><span className="sc-eyebrow">LIVE API RESPONSE</span><h2 id="sc-detail-title">{detail ? `Screen content #${detail.id}` : "Loading details"}</h2><p>GET {APP_SCREEN_CONTENT_ENDPOINT}/{detail?.id ?? "…"}</p></div><button className="sc-close" aria-label="Close details" onClick={() => setDetail(null)}><X/></button></header>{detailLoading ? <div className="sc-loading"><LoaderCircle className="sc-spin"/> Loading record…</div> : detail && <div className="sc-form-body"><dl className="sc-details">{Object.entries(detail).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value ?? "null")}</dd></div>)}</dl><JsonBlock label="Response JSON" value={detail} copy={() => void copy(detail)}/></div>}</section></div>}
  </main>;
}

function Metric({ label, value, tone = "" }: { label: string; value: number; tone?: string }) { return <article className={`sc-metric ${tone}`}><span>{label}</span><strong>{value}</strong></article>; }
function Field({ label, name, value, max, error, help, change }: { label: string; name: string; value: string; max: number; error?: string; help: string; change: (value: string) => void }) { return <div className="sc-field"><div className="sc-label-line"><label htmlFor={`sc-${name}`}>{label}</label><span>{value.length}/{max}</span></div><input id={`sc-${name}`} value={value} maxLength={max} onChange={(e) => change(e.target.value)}/><small>{help}</small><span className="sc-validation" role="alert">{error ?? " "}</span></div>; }
function JsonBlock({ label, value, copy }: { label: string; value: unknown; copy: () => void }) { return <details className="sc-json"><summary>{label}<button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); copy(); }}><Clipboard size={14}/> Copy JSON</button></summary><pre>{value === null ? "No response body" : JSON.stringify(value, null, 2)}</pre></details>; }
