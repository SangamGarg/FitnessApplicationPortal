import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperFollowUsManagement.css";

type FollowUsLink = {
  id: number;
  title: string;
  subtitle: string;
  url: string;
  iconKey: string;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

type FollowUsLinksRequest = {
  title: string;
  subtitle: string;
  iconKey: string;
  url: string;
};

type FollowUsLinksPatchRequest = {
  title?: string;
  subtitle?: string;
  url?: string;
};

type LinkDraft = FollowUsLinksRequest;
type PatchDraft = { title: string; subtitle: string; url: string };
type FollowUsSection = "Current Links" | "Upload Links" | "Patch Link";
type RequestState = {
  method: "GET" | "POST" | "PATCH";
  endpoint: string;
  status: number | null;
  response: string;
  error: string;
  loading: boolean;
  timestamp: string | null;
  duration: number | null;
};

const LINKS_ENDPOINT = "/api/v1/portal/dev/follow-us/get-links";
const UPLOAD_ENDPOINT = "/api/v1/portal/dev/follow-us/upload/links";

const blankLink = (): LinkDraft => ({ title: "", subtitle: "", iconKey: "", url: "" });

const INITIAL_REQUEST: RequestState = {
  method: "GET",
  endpoint: LINKS_ENDPOINT,
  status: null,
  response: "",
  error: "",
  loading: false,
  timestamp: null,
  duration: null,
};

function isFollowUsLink(value: unknown): value is FollowUsLink {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "number"
    && typeof record.title === "string"
    && typeof record.subtitle === "string"
    && typeof record.url === "string"
    && typeof record.iconKey === "string"
    && typeof record.version === "number"
    && (record.createdAt === null || typeof record.createdAt === "string")
    && (record.updatedAt === null || typeof record.updatedAt === "string")
    && (record.updatedBy === null || typeof record.updatedBy === "string");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function validUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateLink(link: LinkDraft, index: number): string[] {
  const errors: string[] = [];
  const label = `Link ${index + 1}`;
  if (!link.title.trim()) errors.push(`${label}: title cannot be blank.`);
  else if (link.title.length > 120) errors.push(`${label}: title cannot exceed 120 characters.`);
  if (!link.subtitle.trim()) errors.push(`${label}: subtitle cannot be blank.`);
  else if (link.subtitle.length > 60) errors.push(`${label}: subtitle cannot exceed 60 characters.`);
  if (!link.iconKey.trim()) errors.push(`${label}: icon key cannot be blank.`);
  if (!link.url.trim()) errors.push(`${label}: URL cannot be blank.`);
  else if (link.url.length > 500) errors.push(`${label}: URL cannot exceed 500 characters.`);
  else if (!validUrl(link.url)) errors.push(`${label}: enter a valid http or https URL.`);
  return errors;
}

async function callFollowUsApi(method: RequestState["method"], endpoint: string, payload?: unknown) {
  const started = performance.now();
  const init: RequestInit = { method, headers: { Accept: "application/json" } };
  if (payload !== undefined) {
    init.headers = { Accept: "application/json", "Content-Type": "application/json" };
    init.body = JSON.stringify(payload);
  }
  const response = await portalFetch(endpoint, init);
  const raw = await response.text();
  let parsed: unknown;
  let body: string;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
      body = JSON.stringify(parsed, null, 2);
    } catch {
      body = raw;
    }
  } else {
    body = response.ok ? "Request completed with an empty response." : "No response body.";
  }
  const errorRecord = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined;
  const detail = errorRecord?.detail ?? errorRecord?.message ?? errorRecord?.error ?? errorRecord?.title;
  return {
    status: response.status,
    body,
    parsed,
    error: response.ok
      ? ""
      : typeof detail === "string" ? `HTTP ${response.status}: ${detail}` : `Request failed with HTTP ${response.status}.`,
    duration: Math.round(performance.now() - started),
    timestamp: new Date().toLocaleString(),
  };
}

function CopyControl({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  async function copy() {
    setCopied(false);
    setCopyError("");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : "Unable to copy value.");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopyError(""), 2500);
    }
  }

  return (
    <button className={`follow-copy ${copyError ? "copy-failed" : ""}`} type="button" onClick={() => void copy()} aria-label={copied ? `${label} copied` : copyError ? `${label} failed` : label} title={copyError || (copied ? "Copied" : label)}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied && <span role="status">Copied</span>}
      {copyError && <span role="status">Copy failed</span>}
    </button>
  );
}

function Inspector({ request, payload }: { request: RequestState; payload?: unknown }) {
  const requestJson = payload === undefined ? "" : JSON.stringify(payload, null, 2);
  return (
    <section className="follow-panel follow-inspector">
      <header className="follow-panel-heading">
        <div><h2>API Inspector</h2><p>Inspect the actual request and server response.</p></div>
        {request.loading && <LoaderCircle size={17} className="follow-spin" />}
      </header>
      <div className="follow-endpoint">
        <span className={`follow-method ${request.method.toLowerCase()}`}>{request.method}</span>
        <code>{request.endpoint}</code>
      </div>
      {payload !== undefined && (
        <div className="follow-code-block">
          <div><strong>Request body</strong><CopyControl value={requestJson} label="Copy request body" /></div>
          <pre>{requestJson}</pre>
        </div>
      )}
      {request.status !== null && <div className={`follow-status ${request.error ? "error" : "success"}`}>HTTP {request.status}</div>}
      {request.error && <div className="follow-error"><AlertCircle size={16} />{request.error}</div>}
      {request.response && (
        <div className="follow-code-block">
          <div><strong>Response body</strong><CopyControl value={request.response} label="Copy response body" /></div>
          <pre>{request.response}</pre>
        </div>
      )}
      {(request.timestamp || request.duration !== null) && (
        <div className="follow-request-meta">
          {request.timestamp && <span>Last executed: {request.timestamp}</span>}
          {request.duration !== null && <span>{request.duration} ms</span>}
        </div>
      )}
      {!request.status && !request.loading && !request.error && !request.response && <p className="follow-inspector-empty">No request has been made yet.</p>}
    </section>
  );
}

function TextInput({
  label, value, maxLength, helper, required = false, type = "text", error, onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  helper: string;
  required?: boolean;
  type?: "text" | "url";
  error?: string;
  onChange: (value: string) => void;
}) {
  const inputId = `follow-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className="follow-field" htmlFor={inputId}>
      {label}{required && <span aria-hidden="true"> *</span>}
      <input id={inputId} type={type} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={`${inputId}-help ${inputId}-count`} />
      <span className={`follow-helper ${error ? "invalid" : ""}`} id={`${inputId}-help`}>{error || helper}</span>
      <span className="follow-count" id={`${inputId}-count`}>{value.length}/{maxLength}</span>
    </label>
  );
}

function LinksTable({
  links, loading, error, selectedId, onRefresh, onSelect, onEdit,
}: {
  links: FollowUsLink[];
  loading: boolean;
  error: string;
  selectedId: number | null;
  onRefresh: () => void;
  onSelect: (link: FollowUsLink) => void;
  onEdit: (link: FollowUsLink) => void;
}) {
  return (
    <section className="follow-panel follow-links-panel">
      <header className="follow-panel-heading">
        <div><h2>Current Links</h2><p>{loading ? "Loading configured links…" : `${links.length} links returned by the API.`}</p></div>
        <button className="follow-secondary" type="button" disabled={loading} onClick={onRefresh}><RefreshCw size={14} />Refresh</button>
      </header>
      {loading ? (
        <div className="follow-state"><LoaderCircle size={20} className="follow-spin" />Loading Follow Us links…</div>
      ) : error ? (
        <div className="follow-state-error"><AlertCircle size={17} /><div><strong>Unable to load Follow Us links</strong><p>{error}</p><button className="follow-secondary" type="button" onClick={onRefresh}>Retry</button></div></div>
      ) : links.length === 0 ? (
        <div className="follow-state"><strong>No Follow Us links configured</strong><span>Links returned by the backend will appear here.</span></div>
      ) : (
        <div className="follow-table-wrap">
          <table className="follow-table">
            <thead><tr><th>ID</th><th>Title</th><th>Subtitle</th><th>Icon key</th><th>URL</th><th>Version</th><th>Actions</th></tr></thead>
            <tbody>{links.map((link) => (
              <tr key={link.id} className={selectedId === link.id ? "selected" : ""} onClick={() => onSelect(link)}>
                <td>#{link.id}</td>
                <td><strong>{link.title}</strong></td>
                <td>{link.subtitle}</td>
                <td><code>{link.iconKey}</code></td>
                <td className="follow-url-cell"><a href={link.url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>{link.url}<ExternalLink size={12} /></a></td>
                <td><span className="follow-version">v{link.version}</span></td>
                <td>
                  <div className="follow-row-actions" onClick={(event) => event.stopPropagation()}>
                    <CopyControl value={link.url} label={`Copy URL for ${link.title}`} />
                    <button className="follow-secondary" type="button" onClick={() => onEdit(link)}>Edit</button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
          <div className="follow-mobile-list">{links.map((link) => (
            <article key={link.id} className="follow-mobile-card">
              <div><strong>{link.title}</strong><span className="follow-version">v{link.version}</span></div>
              <p>{link.subtitle}</p><code>{link.iconKey}</code>
              <a href={link.url} target="_blank" rel="noopener noreferrer">{link.url} <ExternalLink size={12} /></a>
              <div className="follow-row-actions">
                <CopyControl value={link.url} label={`Copy URL for ${link.title}`} />
                <button className="follow-secondary" type="button" onClick={() => onEdit(link)}>Edit</button>
                <button className="follow-secondary" type="button" onClick={() => onSelect(link)}><ChevronDown size={14} />Audit details</button>
              </div>
            </article>
          ))}</div>
        </div>
      )}
    </section>
  );
}

export default function DeveloperFollowUsManagement() {
  const [section, setSection] = useState<FollowUsSection>("Current Links");
  const [links, setLinks] = useState<FollowUsLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState("");
  const [selectedLink, setSelectedLink] = useState<FollowUsLink | null>(null);
  const [drafts, setDrafts] = useState<LinkDraft[]>([blankLink()]);
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [patchDraft, setPatchDraft] = useState<PatchDraft>({ title: "", subtitle: "", url: "" });
  const [patchError, setPatchError] = useState("");
  const [patchBusy, setPatchBusy] = useState(false);
  const [request, setRequest] = useState<RequestState>(INITIAL_REQUEST);
  const [payloadPreview, setPayloadPreview] = useState<unknown>();
  const latestListRequest = useRef(0);

  const loadLinks = useCallback(async (updateInspector = true) => {
    const requestId = ++latestListRequest.current;
    setLinksLoading(true);
    setLinksError("");
    if (updateInspector) {
      setRequest((current) => ({ ...current, method: "GET", endpoint: LINKS_ENDPOINT, status: null, response: "", error: "", loading: true, timestamp: null, duration: null }));
      setPayloadPreview(undefined);
    }
    try {
      const result = await callFollowUsApi("GET", LINKS_ENDPOINT);
      if (requestId !== latestListRequest.current) return;
      if (updateInspector) {
        setRequest({ method: "GET", endpoint: LINKS_ENDPOINT, status: result.status, response: result.body, error: result.error, loading: false, timestamp: result.timestamp, duration: result.duration });
      }
      if (result.error) {
        setLinksError(result.error);
        setLinks([]);
        return;
      }
      if (!Array.isArray(result.parsed) || !result.parsed.every(isFollowUsLink)) {
        const message = "The Follow Us API returned a response that does not match the expected link list.";
        setLinksError(message);
        if (updateInspector) setRequest((current) => ({ ...current, error: message }));
        setLinks([]);
        return;
      }
      const nextLinks = result.parsed as FollowUsLink[];
      setLinks(nextLinks);
      setSelectedLink((current) => current ? nextLinks.find((link) => link.id === current.id) ?? null : null);
    } catch (error) {
      if (requestId !== latestListRequest.current) return;
      const message = error instanceof Error ? error.message : "Unable to load Follow Us links.";
      setLinksError(message);
      setLinks([]);
      if (updateInspector) {
        setRequest({ method: "GET", endpoint: LINKS_ENDPOINT, status: null, response: "", error: message, loading: false, timestamp: new Date().toLocaleString(), duration: null });
      }
    } finally {
      if (requestId === latestListRequest.current) setLinksLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load server-owned link data when the management page mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLinks();
  }, [loadLinks]);

  const uploadPayload = useMemo((): FollowUsLinksRequest[] => drafts.map(({ title, subtitle, iconKey, url }) => ({ title, subtitle, iconKey, url })), [drafts]);
  const patchPayload = useMemo((): FollowUsLinksPatchRequest => {
    if (!selectedLink) return {};
    const patch: FollowUsLinksPatchRequest = {};
    if (patchDraft.title !== selectedLink.title) patch.title = patchDraft.title;
    if (patchDraft.subtitle !== selectedLink.subtitle) patch.subtitle = patchDraft.subtitle;
    if (patchDraft.url !== selectedLink.url) patch.url = patchDraft.url;
    return patch;
  }, [patchDraft, selectedLink]);
  const inspectedPayload = request.method === "GET"
    ? undefined
    : payloadPreview ?? (request.method === "POST" ? uploadPayload : selectedLink ? patchPayload : undefined);

  function chooseLink(link: FollowUsLink) {
    setSelectedLink(link);
    setPatchDraft({ title: link.title, subtitle: link.subtitle, url: link.url });
    setPatchError("");
  }

  function editLink(link: FollowUsLink) {
    chooseLink(link);
    setSection("Patch Link");
  }

  async function submitUploads() {
    const errors = drafts.flatMap((link, index) => validateLink(link, index));
    setDraftErrors(errors);
    if (!drafts.length) {
      setDraftErrors(["Add at least one link before submitting."]);
      return;
    }
    if (errors.length || uploadBusy) return;
    setUploadBusy(true);
    const endpoint = UPLOAD_ENDPOINT;
    setPayloadPreview(uploadPayload);
    setRequest((current) => ({ ...current, method: "POST", endpoint, status: null, response: "", error: "", loading: true, timestamp: null, duration: null }));
    try {
      const result = await callFollowUsApi("POST", endpoint, uploadPayload);
      setRequest({ method: "POST", endpoint, status: result.status, response: result.body, error: result.error, loading: false, timestamp: result.timestamp, duration: result.duration });
      if (!result.error) {
        setDrafts([blankLink()]);
        setDraftErrors([]);
        await loadLinks(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload Follow Us links.";
      setRequest({ method: "POST", endpoint, status: null, response: "", error: message, loading: false, timestamp: new Date().toLocaleString(), duration: null });
    } finally {
      setUploadBusy(false);
    }
  }

  async function submitPatch() {
    if (!selectedLink || patchBusy) return;
    const errors: string[] = [];
    if (patchDraft.title.length > 120) errors.push("Title cannot exceed 120 characters.");
    if (patchDraft.subtitle.length > 60) errors.push("Subtitle cannot exceed 60 characters.");
    if (patchDraft.url.length > 500) errors.push("URL cannot exceed 500 characters.");
    else if (patchDraft.url.trim() && !validUrl(patchDraft.url)) errors.push("Enter a valid http or https URL.");
    if (!Object.keys(patchPayload).length) errors.push("Change at least one field before patching.");
    setPatchError(errors.join(" "));
    if (errors.length) return;
    const endpoint = `/api/v1/portal/dev/follow-us/links/${selectedLink.id}`;
    setPatchBusy(true);
    setPayloadPreview(patchPayload);
    setRequest((current) => ({ ...current, method: "PATCH", endpoint, status: null, response: "", error: "", loading: true, timestamp: null, duration: null }));
    try {
      const result = await callFollowUsApi("PATCH", endpoint, patchPayload);
      setRequest({ method: "PATCH", endpoint, status: result.status, response: result.body, error: result.error, loading: false, timestamp: result.timestamp, duration: result.duration });
      if (!result.error) await loadLinks(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the Follow Us link.";
      setRequest({ method: "PATCH", endpoint, status: null, response: "", error: message, loading: false, timestamp: new Date().toLocaleString(), duration: null });
    } finally {
      setPatchBusy(false);
    }
  }

  function resetPatch() {
    if (!selectedLink) return;
    setPatchDraft({ title: selectedLink.title, subtitle: selectedLink.subtitle, url: selectedLink.url });
    setPatchError("");
  }

  return (
    <div className="dev-content follow-us-management">
      <div className="dev-page-heading">
        <div><h1>App Follow Us Management</h1><p>Manage social media and external links displayed in the Fitness application.</p></div>
      </div>

      <nav className="follow-tabs" aria-label="Follow Us management sections">
        {(["Current Links", "Upload Links", "Patch Link"] as FollowUsSection[]).map((item) => (
          <button key={item} className={section === item ? "active" : ""} onClick={() => { setSection(item); setPayloadPreview(undefined); }}>{item}</button>
        ))}
      </nav>

      {section === "Current Links" && (
        <div className="follow-layout">
          <div>
            <LinksTable links={links} loading={linksLoading} error={linksError} selectedId={selectedLink?.id ?? null} onRefresh={() => void loadLinks()} onSelect={chooseLink} onEdit={editLink} />
            {selectedLink && (
              <section className="follow-panel follow-audit-panel">
                <header className="follow-panel-heading"><div><h2>Link details and audit history</h2><p>Complete metadata returned for link #{selectedLink.id}.</p></div><ChevronDown size={16} /></header>
                <dl className="follow-audit-grid">
                  <div><dt>ID</dt><dd>{selectedLink.id}</dd></div>
                  <div><dt>Title</dt><dd>{selectedLink.title}</dd></div>
                  <div><dt>Subtitle</dt><dd>{selectedLink.subtitle}</dd></div>
                  <div><dt>Icon key</dt><dd>{selectedLink.iconKey}</dd></div>
                  <div><dt>URL</dt><dd>{selectedLink.url}</dd></div>
                  <div><dt>Version</dt><dd>v{selectedLink.version}</dd></div>
                  <div><dt>Created</dt><dd>{formatDate(selectedLink.createdAt)}</dd></div>
                  <div><dt>Last updated</dt><dd>{formatDate(selectedLink.updatedAt)}</dd></div>
                  <div><dt>Updated by</dt><dd>{selectedLink.updatedBy || "—"}</dd></div>
                </dl>
                <button className="follow-secondary" type="button" onClick={() => editLink(selectedLink)}>Edit this link</button>
              </section>
            )}
          </div>
          <Inspector request={request} payload={inspectedPayload} />
        </div>
      )}

      {section === "Upload Links" && (
        <div className="follow-layout">
          <section className="follow-panel follow-form-panel">
            <header className="follow-panel-heading"><div><h2>Upload Follow Us links</h2><p>Submit one or more links in a single request.</p></div></header>
            {drafts.map((draft, index) => (
              <article className="follow-link-draft" key={index}>
                <header><strong>Link {index + 1}</strong>{drafts.length > 1 && <button className="follow-remove" type="button" onClick={() => setDrafts((current) => current.filter((_, currentIndex) => currentIndex !== index))}><Trash2 size={14} />Remove</button>}</header>
                <div className="follow-field-grid">
                  <TextInput label="Title" value={draft.title} maxLength={120} required helper="Required. Maximum 120 characters." error={draftErrors.find((error) => error.startsWith(`Link ${index + 1}: title`))} onChange={(value) => setDrafts((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, title: value } : item))} />
                  <TextInput label="Subtitle" value={draft.subtitle} maxLength={60} required helper="Required. Maximum 60 characters." error={draftErrors.find((error) => error.startsWith(`Link ${index + 1}: subtitle`))} onChange={(value) => setDrafts((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, subtitle: value } : item))} />
                  <label className="follow-field" htmlFor={`follow-icon-${index}`}>Icon key <span aria-hidden="true">*</span>
                    <input id={`follow-icon-${index}`} value={draft.iconKey} onChange={(event) => setDrafts((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, iconKey: event.target.value } : item))} aria-describedby={`follow-icon-help-${index}`} />
                    <span className={`follow-helper ${draftErrors.some((error) => error === `Link ${index + 1}: icon key cannot be blank.`) ? "invalid" : ""}`} id={`follow-icon-help-${index}`}>{draftErrors.find((error) => error === `Link ${index + 1}: icon key cannot be blank.`) || "Enter a valid icon key supported by the backend. The backend enum values are not available in this workspace."}</span>
                  </label>
                  <TextInput label="URL" value={draft.url} maxLength={500} required type="url" helper="Required. Enter a valid URL. Maximum 500 characters." error={draftErrors.find((error) => error.startsWith(`Link ${index + 1}: URL`))} onChange={(value) => setDrafts((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, url: value } : item))} />
                </div>
              </article>
            ))}
            {draftErrors.some((error) => !error.startsWith("Link ")) && <div className="follow-error"><AlertCircle size={15} />{draftErrors.filter((error) => !error.startsWith("Link ")).join(" ")}</div>}
            <div className="follow-form-actions">
              <button className="follow-secondary" type="button" onClick={() => setDrafts((current) => [...current, blankLink()])}><Plus size={15} />Add another link</button>
              <button className="follow-primary" type="button" disabled={uploadBusy} onClick={() => void submitUploads()}>{uploadBusy ? <LoaderCircle size={15} className="follow-spin" /> : <Send size={15} />}{uploadBusy ? "Uploading…" : "Upload links"}</button>
            </div>
          </section>
          <Inspector request={request} payload={inspectedPayload} />
        </div>
      )}

      {section === "Patch Link" && (
        <div className="follow-layout">
          <section className="follow-panel follow-form-panel">
            <header className="follow-panel-heading"><div><h2>Patch an existing link</h2><p>Choose a link loaded from the backend, then update only changed fields.</p></div></header>
            <label className="follow-field" htmlFor="follow-link-select">Select link
              <select id="follow-link-select" value={selectedLink?.id ?? ""} onChange={(event) => {
                const link = links.find((item) => item.id === Number(event.target.value));
                if (link) chooseLink(link);
                else setSelectedLink(null);
              }}>
                <option value="">Select a link from current links</option>
                {links.map((link) => <option key={link.id} value={link.id}>#{link.id} · {link.title}</option>)}
              </select>
              <span className="follow-helper">Choose a link returned by the current links endpoint. <button className="follow-inline-button" type="button" onClick={() => void loadLinks()}>Refresh links</button></span>
            </label>
            {!links.length && !linksLoading && <div className="follow-empty-inline">{linksError ? `Unable to load links: ${linksError}` : "No links are available to update."}</div>}
            {selectedLink && (
              <>
                <div className="follow-selected-link"><strong>Updating #{selectedLink.id}: {selectedLink.title}</strong><span>Version v{selectedLink.version} · Last updated {formatDate(selectedLink.updatedAt)}{selectedLink.updatedBy ? ` by ${selectedLink.updatedBy}` : ""}</span></div>
                <div className="follow-field-grid">
                  <TextInput label="Title" value={patchDraft.title} maxLength={120} helper="Optional. Maximum 120 characters." onChange={(value) => setPatchDraft((current) => ({ ...current, title: value }))} />
                  <TextInput label="Subtitle" value={patchDraft.subtitle} maxLength={60} helper="Optional. Maximum 60 characters." onChange={(value) => setPatchDraft((current) => ({ ...current, subtitle: value }))} />
                  <TextInput label="URL" value={patchDraft.url} maxLength={500} type="url" helper="Optional. Must be a valid URL. Maximum 500 characters." error={patchDraft.url.trim() && !validUrl(patchDraft.url) ? "Enter a valid http or https URL." : undefined} onChange={(value) => setPatchDraft((current) => ({ ...current, url: value }))} />
                </div>
                {patchError && <div className="follow-error"><AlertCircle size={15} />{patchError}</div>}
                <div className="follow-form-actions">
                  <button className="follow-secondary" type="button" onClick={resetPatch}>Reset changes</button>
                  <button className="follow-primary" type="button" disabled={patchBusy} onClick={() => void submitPatch()}>{patchBusy ? <LoaderCircle size={15} className="follow-spin" /> : <Send size={15} />}{patchBusy ? "Updating…" : "Patch link"}</button>
                </div>
              </>
            )}
          </section>
          <Inspector request={request} payload={inspectedPayload} />
        </div>
      )}
    </div>
  );
}
