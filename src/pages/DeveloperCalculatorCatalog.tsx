import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, AlertCircle, Check, ChevronLeft, ChevronRight, Eye, FileJson, LoaderCircle, Plus, RefreshCw, Search, SlidersHorizontal, Star, Trash2, X } from "lucide-react";
import {
  ANALYTICS_BASE_ENDPOINT, CALCULATOR_CATALOG_ENDPOINT, type CatalogApiActivity, type CalculatorCatalogItemResponseDto,
  type CalculatorCatalogRequestDto, isCatalogItem, requestCatalogApi,
} from "../lib/calculatorCatalogApi";
import "./DeveloperCalculatorCatalog.css";

type CatalogForm = Omit<CalculatorCatalogRequestDto, "requiredInputs" | "displayOrder" | "requiresSavedData"> & {
  requiredInputs: string[]; inputDraft: string; displayOrder: string; requiresSavedData: "true" | "false" | "null";
};
const blankForm = (): CatalogForm => ({ key: "", name: "", category: "", description: "", requiredInputs: [], inputDraft: "", unit: "", requiresSavedData: "false", popular: false, displayOrder: "" });
const fromItem = (item: CalculatorCatalogItemResponseDto): CatalogForm => ({ ...item, inputDraft: "", requiresSavedData: item.requiresSavedData == null ? "null" : String(item.requiresSavedData) as "true" | "false", displayOrder: item.displayOrder == null ? "" : String(item.displayOrder) });
type FormErrors = Partial<Record<"key" | "name" | "category" | "description" | "requiredInputs" | "unit" | "displayOrder", string>>;
const PAGE_SIZE = 12;

function validate(form: CatalogForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.key.trim()) errors.key = "Key is required.";
  else if (/\s/.test(form.key.trim())) errors.key = "Keys cannot contain whitespace. Use a stable identifier.";
  if (!form.name.trim()) errors.name = "Name is required.";
  if (!form.category.trim()) errors.category = "Category is required.";
  if (!form.description.trim()) errors.description = "Description is required.";
  if (form.requiredInputs.some((entry) => !entry.trim())) errors.requiredInputs = "Remove blank inputs.";
  if (new Set(form.requiredInputs.map((entry) => entry.trim().toLowerCase())).size !== form.requiredInputs.length) errors.requiredInputs = "Required inputs must be unique.";
  if (!form.unit.trim()) errors.unit = "Unit is required.";
  if (form.displayOrder.trim() && !Number.isInteger(Number(form.displayOrder))) errors.displayOrder = "Enter a whole number or leave blank.";
  return errors;
}

function safeJson(value: unknown) { return JSON.stringify(value, null, 2) ?? "No response body."; }

export default function DeveloperCalculatorCatalog() {
  const [items, setItems] = useState<CalculatorCatalogItemResponseDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<CatalogApiActivity[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [popular, setPopular] = useState("all");
  const [savedData, setSavedData] = useState("all");
  const [sort, setSort] = useState("order");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<"create" | "edit" | "delete" | "details" | null>(null);
  const [selected, setSelected] = useState<CalculatorCatalogItemResponseDto | null>(null);
  const [form, setForm] = useState<CatalogForm>(blankForm);
  const [touched, setTouched] = useState<Partial<Record<keyof FormErrors, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [inspected, setInspected] = useState<CatalogApiActivity | null>(null);

  const run = useCallback(async (method: string, endpoint: string, payload?: unknown) => {
    const result = await requestCatalogApi(method, endpoint, payload);
    setActivity((current) => [result.activity, ...current].slice(0, 30));
    return result;
  }, []);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    const result = await run("GET", CALCULATOR_CATALOG_ENDPOINT);
    if (!result.ok) { setError(result.error || "Unable to load calculator catalog."); if (!refresh) setItems(null); }
    else if (!Array.isArray(result.data) || !result.data.every(isCatalogItem)) {
      setError("The catalog response did not match the expected calculator item format.");
      if (!refresh) setItems(null);
    } else setItems(result.data);
    setLoading(false);
  }, [run]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const categories = useMemo(() => [...new Set((items ?? []).map((item) => item.category))].sort((a, b) => a.localeCompare(b)), [items]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...(items ?? [])].filter((item) =>
      (!needle || `${item.name} ${item.key} ${item.category} ${item.description} ${item.requiredInputs.join(" ")}`.toLowerCase().includes(needle))
      && (category === "all" || item.category === category)
      && (popular === "all" || String(item.popular) === popular)
      && (savedData === "all" || String(item.requiresSavedData) === savedData),
    ).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "category" ? a.category.localeCompare(b.category) || a.name.localeCompare(b.name) : (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER));
  }, [items, query, category, popular, savedData, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const openCreate = () => { setSelected(null); setForm(blankForm()); setTouched({}); setFormError(""); setDialog("create"); };
  const openEdit = (item: CalculatorCatalogItemResponseDto) => { setSelected(item); setForm(fromItem(item)); setTouched({}); setFormError(""); setDialog("edit"); };
  const update = <K extends keyof CatalogForm>(key: K, value: CatalogForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const addInput = () => {
    const value = form.inputDraft.trim();
    if (!value || form.requiredInputs.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    update("requiredInputs", [...form.requiredInputs, value]);
    update("inputDraft", "");
  };
  const currentErrors = validate(form);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched({ key: true, name: true, category: true, description: true, requiredInputs: true, unit: true, displayOrder: true });
    if (Object.keys(currentErrors).length) return;
    if (busy) return;
    setBusy(true); setFormError("");
    const payload: CalculatorCatalogRequestDto = {
      key: form.key.trim(), name: form.name.trim(), category: form.category.trim(), description: form.description.trim(),
      requiredInputs: form.requiredInputs.map((value) => value.trim()), unit: form.unit.trim(),
      requiresSavedData: form.requiresSavedData === "null" ? null : form.requiresSavedData === "true",
      popular: form.popular, displayOrder: form.displayOrder.trim() ? Number(form.displayOrder) : null,
    };
    const endpoint = dialog === "create" ? CALCULATOR_CATALOG_ENDPOINT : `${ANALYTICS_BASE_ENDPOINT}/${encodeURIComponent(selected?.key ?? payload.key)}`;
    const result = await run(dialog === "create" ? "POST" : "PATCH", endpoint, payload);
    if (result.ok) {
      const message = result.data && typeof result.data === "object" && "message" in result.data && typeof result.data.message === "string" ? result.data.message : `Request completed with HTTP ${result.status}.`;
      setNotice({ ok: true, text: message }); setDialog(null); setForm(blankForm()); await load(true);
    } else setFormError(result.error || "The request failed. Review the API activity for details.");
    setBusy(false);
  }

  async function remove() {
    if (!selected || busy) return;
    setBusy(true); setFormError("");
    const result = await run("DELETE", `${ANALYTICS_BASE_ENDPOINT}/${encodeURIComponent(selected.key)}`);
    if (result.ok) {
      const message = result.data && typeof result.data === "object" && "message" in result.data && typeof result.data.message === "string" ? result.data.message : `Request completed with HTTP ${result.status}.`;
      setNotice({ ok: true, text: message }); setDialog(null); setSelected(null); await load(true);
    } else setFormError(result.error || "Unable to delete this catalog item.");
    setBusy(false);
  }

  const fieldError = (name: keyof FormErrors) => touched[name] ? currentErrors[name] : undefined;
  const inputRow = (item: CalculatorCatalogItemResponseDto) => <tr key={item.key}>
    <td><strong>{item.name}</strong><small className="calc-subcell">{item.description || "No description"}</small></td>
    <td><code>{item.key}</code></td><td>{item.category}</td><td>{item.unit || "—"}</td>
    <td><div className="calc-chips">{item.requiredInputs.length ? item.requiredInputs.map((input) => <span key={input}>{input}</span>) : <span className="calc-muted">None</span>}</div></td>
    <td><span className={`calc-pill ${item.requiresSavedData ? "is-on" : ""}`}>{item.requiresSavedData == null ? "Unknown" : item.requiresSavedData ? "Required" : "No"}</span></td>
    <td>{item.popular ? <span className="calc-popular"><Star size={13} fill="currentColor" /> Popular</span> : <span className="calc-muted">No</span>}</td>
    <td>{item.displayOrder ?? "—"}</td><td><div className="calc-actions"><button title="View details" aria-label={`View ${item.name}`} onClick={() => { setSelected(item); setDialog("details"); }}><Eye size={14} /></button><button title="Edit" aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)}>Edit</button><button className="danger" title="Delete" aria-label={`Delete ${item.name}`} onClick={() => { setSelected(item); setFormError(""); setDialog("delete"); }}><Trash2 size={14} /></button></div></td>
  </tr>;

  return <div className="dev-content calculator-catalog">
    <header className="dev-page-heading calc-heading"><div><span className="calc-kicker"><Activity size={13} /> ANALYTICS MANAGEMENT</span><h1>Calculator Catalog</h1><p>Manage calculator definitions available to the application through the live analytics API.</p></div><div className="calc-heading-actions"><button className="calc-secondary" type="button" onClick={() => void load(true)} disabled={loading}><RefreshCw size={14} className={loading ? "calc-spin" : ""} /> Refresh</button><button className="calc-primary" type="button" onClick={openCreate}><Plus size={15} /> Add Calculator</button></div></header>
    {notice && <div className={`calc-notice ${notice.ok ? "success" : "error"}`} role="status"><Check size={15} />{notice.text}<button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={14} /></button></div>}
    <section className="calc-stats"><article><span>Total calculators</span><strong>{items === null ? "—" : items.length}</strong></article><article><span>Popular</span><strong>{items === null ? "—" : items.filter((item) => item.popular).length}</strong></article><article><span>Categories</span><strong>{items === null ? "—" : categories.length}</strong></article></section>
    <section className="calc-panel"><header className="calc-panel-heading"><div><h2>Catalog entries</h2><p>Search and filter the current backend catalog.</p></div><span>{loading ? "Loading…" : items === null ? "Unavailable" : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}</span></header>
      <div className="calc-toolbar"><label className="calc-search"><Search size={15} /><input aria-label="Search catalog" placeholder="Search name, key, category…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="calc-select"><SlidersHorizontal size={14} /><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><select aria-label="Filter popular calculators" value={popular} onChange={(event) => setPopular(event.target.value)}><option value="all">All popularity</option><option value="true">Popular</option><option value="false">Not popular</option></select><select aria-label="Filter saved data requirement" value={savedData} onChange={(event) => setSavedData(event.target.value)}><option value="all">All saved-data</option><option value="true">Saved data required</option><option value="false">No saved data</option></select><select aria-label="Sort catalog" value={sort} onChange={(event) => setSort(event.target.value)}><option value="order">Display order</option><option value="name">Name</option><option value="category">Category</option></select></div>
      {error ? <div className="calc-state calc-error"><AlertCircle size={22} /><strong>Unable to load calculator catalog</strong><span>{error}</span><button className="calc-secondary" onClick={() => void load()}><RefreshCw size={13} /> Retry</button></div>
        : loading && items === null ? <div className="calc-state" role="status"><LoaderCircle size={20} className="calc-spin" />Loading calculator catalog…</div>
          : filtered.length === 0 ? <div className="calc-state"><FileJson size={23} /><strong>{items?.length ? "No matching calculators" : "Catalog is empty"}</strong><span>{items?.length ? "Adjust your search or filters to see results." : "The backend returned no calculator catalog entries."}</span>{!items?.length && <button className="calc-primary" onClick={openCreate}><Plus size={13} /> Add Calculator</button>}</div>
            : <><div className="calc-table-wrap"><table className="calc-table"><thead><tr><th>Name</th><th>Key</th><th>Category</th><th>Unit</th><th>Required inputs</th><th>Saved data</th><th>Popular</th><th>Order</th><th>Actions</th></tr></thead><tbody>{visible.map(inputRow)}</tbody></table></div><footer className="calc-pagination"><span>Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span><div><button aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={15} /></button><span>Page {currentPage + 1} of {pages}</span><button aria-label="Next page" disabled={currentPage + 1 >= pages} onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}><ChevronRight size={15} /></button></div></footer></>}
    </section>
    <section className="calc-panel calc-activity"><header className="calc-panel-heading"><div><h2>API activity</h2><p>Actual requests made during this workspace session.</p></div><span>{activity.length} request{activity.length === 1 ? "" : "s"}</span></header>{activity.length === 0 ? <div className="calc-activity-empty">No API requests recorded yet.</div> : <div className="calc-activity-list">{activity.map((record) => <article key={record.id}><span className={`calc-method ${record.method.toLowerCase()}`}>{record.method}</span><code>{record.endpoint}</code><span className={record.ok ? "calc-status-ok" : "calc-status-error"}>{record.status ?? "Network error"}</span><span>{record.durationMs} ms</span><time>{new Date(record.timestamp).toLocaleTimeString()}</time><button onClick={() => setInspected(record)}>Inspect</button></article>)}</div>}</section>

    {dialog && <div className="calc-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDialog(null); }}><section className="calc-dialog" role="dialog" aria-modal="true" aria-labelledby="calc-dialog-title"><header><div><h2 id="calc-dialog-title">{dialog === "create" ? "Add calculator" : dialog === "edit" ? "Edit calculator" : dialog === "delete" ? "Delete calculator?" : "Calculator details"}</h2><p>{dialog === "delete" ? "This removes the item from the backend catalog." : "Catalog configuration is sent directly to the analytics API."}</p></div><button aria-label="Close" disabled={busy} onClick={() => setDialog(null)}><X size={16} /></button></header>
      {(dialog === "create" || dialog === "edit") && <form onSubmit={(event) => void submit(event)} noValidate><div className="calc-form-grid">
        <label className="calc-field"><span>Key</span><input value={form.key} onChange={(event) => update("key", event.target.value)} onBlur={() => setTouched((value) => ({ ...value, key: true }))} aria-invalid={Boolean(fieldError("key"))} /><small>Required. Use a stable identifier without whitespace.</small>{fieldError("key") && <b>{fieldError("key")}</b>}</label>
        <label className="calc-field"><span>Name</span><input value={form.name} onChange={(event) => update("name", event.target.value)} onBlur={() => setTouched((value) => ({ ...value, name: true }))} aria-invalid={Boolean(fieldError("name"))} /><small>Required. Human-readable calculator name.</small>{fieldError("name") && <b>{fieldError("name")}</b>}</label>
        <label className="calc-field"><span>Category</span><input value={form.category} onChange={(event) => update("category", event.target.value)} onBlur={() => setTouched((value) => ({ ...value, category: true }))} aria-invalid={Boolean(fieldError("category"))} /><small>Required. Use the category shown in the app.</small>{fieldError("category") && <b>{fieldError("category")}</b>}</label>
        <label className="calc-field"><span>Unit</span><input value={form.unit} onChange={(event) => update("unit", event.target.value)} onBlur={() => setTouched((value) => ({ ...value, unit: true }))} aria-invalid={Boolean(fieldError("unit"))} /><small>Required. The result unit presented to users.</small>{fieldError("unit") && <b>{fieldError("unit")}</b>}</label>
        <label className="calc-field calc-field-wide"><span>Description</span><textarea value={form.description} onChange={(event) => update("description", event.target.value)} onBlur={() => setTouched((value) => ({ ...value, description: true }))} aria-invalid={Boolean(fieldError("description"))} rows={3} /><small>Required. Describe what the calculator computes.</small>{fieldError("description") && <b>{fieldError("description")}</b>}</label>
        <div className="calc-field calc-field-wide"><span>Required inputs</span><div className="calc-input-entry"><input aria-label="Required input" value={form.inputDraft} placeholder="Add input name" onChange={(event) => update("inputDraft", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addInput(); } }} /><button type="button" onClick={addInput}><Plus size={14} /> Add</button></div><div className="calc-chips">{form.requiredInputs.map((input, index) => <span key={`${input}-${index}`}>{input}<button aria-label={`Remove ${input}`} type="button" onClick={() => update("requiredInputs", form.requiredInputs.filter((_, itemIndex) => itemIndex !== index))}><X size={12} /></button></span>)}</div><small>Add fields individually. Entries are trimmed and duplicates are ignored.</small>{fieldError("requiredInputs") && <b>{fieldError("requiredInputs")}</b>}</div>
        <label className="calc-field"><span>Requires saved data</span><select value={form.requiresSavedData} onChange={(event) => update("requiresSavedData", event.target.value as CatalogForm["requiresSavedData"])}><option value="false">No</option><option value="true">Yes</option><option value="null">Not specified</option></select><small>Whether the calculator needs user data already stored by the app.</small></label>
        <label className="calc-field"><span>Display order</span><input type="number" step="1" value={form.displayOrder} onChange={(event) => update("displayOrder", event.target.value)} onBlur={() => setTouched((value) => ({ ...value, displayOrder: true }))} aria-invalid={Boolean(fieldError("displayOrder"))} /><small>Whole number or blank to let the backend determine order.</small>{fieldError("displayOrder") && <b>{fieldError("displayOrder")}</b>}</label>
        <label className="calc-checkbox"><input type="checkbox" checked={form.popular} onChange={(event) => update("popular", event.target.checked)} /><span><strong>Popular calculator</strong><small>Mark this calculator as popular in the application.</small></span></label>
      </div>{formError && <div className="calc-inline-error"><AlertCircle size={14} />{formError}</div>}<footer><button type="button" className="calc-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className="calc-primary" disabled={busy}>{busy ? <LoaderCircle className="calc-spin" size={14} /> : <Check size={14} />}{busy ? "Saving…" : dialog === "create" ? "Create calculator" : "Save changes"}</button></footer></form>}
      {dialog === "delete" && selected && <div className="calc-confirm"><strong>{selected.name}</strong><code>{selected.key}</code><p>This action cannot be undone. The backend will confirm whether this entry can be removed.</p>{formError && <div className="calc-inline-error"><AlertCircle size={14} />{formError}</div>}<footer><button className="calc-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className="calc-danger" disabled={busy} onClick={() => void remove()}>{busy ? <LoaderCircle className="calc-spin" size={14} /> : <Trash2 size={14} />}{busy ? "Deleting…" : "Delete calculator"}</button></footer></div>}
      {dialog === "details" && selected && <div className="calc-detail-grid">{([["Name", selected.name], ["Key", selected.key], ["Category", selected.category], ["Unit", selected.unit || "—"], ["Description", selected.description || "—"], ["Required inputs", selected.requiredInputs.join(", ") || "None"], ["Requires saved data", selected.requiresSavedData == null ? "Not specified" : selected.requiresSavedData ? "Yes" : "No"], ["Popular", selected.popular ? "Yes" : "No"], ["Display order", selected.displayOrder ?? "Not specified"]] as const).map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}<footer><button className="calc-secondary" onClick={() => setDialog(null)}>Close</button><button className="calc-primary" onClick={() => openEdit(selected)}>Edit calculator</button></footer></div>}
    </section></div>}
    {inspected && <div className="calc-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInspected(null); }}><section className="calc-dialog calc-inspector" role="dialog" aria-modal="true" aria-labelledby="calc-inspector-title"><header><div><h2 id="calc-inspector-title">API request details</h2><p>{inspected.method} {inspected.endpoint}</p></div><button aria-label="Close" onClick={() => setInspected(null)}><X size={16} /></button></header><div className="calc-inspector-meta"><span>HTTP status <strong>{inspected.status ?? "No response"}</strong></span><span>Duration <strong>{inspected.durationMs} ms</strong></span><span>Timestamp <strong>{new Date(inspected.timestamp).toLocaleString()}</strong></span><span>Result <strong>{inspected.ok ? "Success" : "Failed"}</strong></span></div>{inspected.error && <div className="calc-inline-error"><AlertCircle size={14} />{inspected.error}</div>}<label>Request body<pre>{safeJson(inspected.request)}</pre></label><label>Response body<pre>{safeJson(inspected.response)}</pre></label></section></div>}
  </div>;
}
