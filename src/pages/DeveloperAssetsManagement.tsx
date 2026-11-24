import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Clipboard,
  ExternalLink,
  FileImage,
  Image,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperAssetsManagement.css";

const ASSETS_ENDPOINT = "/api/v1/portal/dev/assets";
const ASSET_CATEGORIES = [
  "APP_BRANDING",
  "SYSTEM_MAINTENANCE",
  "ONBOARDING",
  "AUTH_AND_SECURITY",
  "ERROR_STATE",
  "EMPTY_STATE",
  "ACTIVITY_TRACKING",
  "FITNESS_CALCULATORS",
  "DIET_AND_RECIPES",
  "CHALLENGES_AND_REWARDS",
  "PROGRESS_REPORTS",
  "NOTIFICATION",
  "EMAIL_TEMPLATES",
  "COMMUNICATION_CHAT",
  "ABOUT_US",
  "FEEDBACK_AND_SUPPORT",
  "COMMON_BADGES",
] as const;

type AssetCategory = (typeof ASSET_CATEGORIES)[number];
type AssetKeyDefinition = {
  assetKey: string;
  title: string;
  category: AssetCategory;
  altText: string | null;
  description: string | null;
  uploaded: boolean;
  imageUrl: string | null;
  enabled: boolean;
};
type MediaAsset = {
  assetKey: string;
  title: string;
  imageUrl: string;
  altText: string | null;
  category: AssetCategory;
  description: string | null;
  updatedAt: string;
  isActive: boolean;
};
type CatalogDraft = {
  id: number;
  assetKey: string;
  title: string;
  category: AssetCategory | "";
  altText: string;
  description: string;
};
type AssetDefinitionRequest = {
  assetKey: string;
  title: string;
  category: AssetCategory;
  altText?: string | null;
  description?: string | null;
};
type ApiInspection = {
  method: string;
  endpoint: string;
  request: unknown;
  timestamp: string;
  durationMs: number;
  status: number | null;
  statusText?: string;
  ok: boolean;
  response: unknown;
  error?: string;
};
type ApiResult = Omit<ApiInspection, "request">;
type DialogState =
  | { kind: "register" }
  | { kind: "batch" }
  | { kind: "upload" }
  | { kind: "replace"; asset: AssetKeyDefinition }
  | { kind: "metadata"; asset: AssetKeyDefinition }
  | { kind: "delete-image"; asset: AssetKeyDefinition }
  | { kind: "delete-key"; asset: AssetKeyDefinition }
  | null;
type PageTab = "Asset Library" | "Asset Catalog";
type StatusFilter = "all" | "uploaded" | "pending";
type EnabledFilter = "all" | "enabled" | "disabled";
type ActiveFilter = "all" | "active" | "inactive";

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  APP_BRANDING: "App Branding",
  SYSTEM_MAINTENANCE: "System Maintenance",
  ONBOARDING: "Onboarding",
  AUTH_AND_SECURITY: "Authentication & Security",
  ERROR_STATE: "Error State",
  EMPTY_STATE: "Empty State",
  ACTIVITY_TRACKING: "Activity Tracking",
  FITNESS_CALCULATORS: "Fitness Calculators",
  DIET_AND_RECIPES: "Diet & Recipes",
  CHALLENGES_AND_REWARDS: "Challenges & Rewards",
  PROGRESS_REPORTS: "Progress Reports",
  NOTIFICATION: "Notification",
  EMAIL_TEMPLATES: "Email Templates",
  COMMUNICATION_CHAT: "Communication & Chat",
  ABOUT_US: "About Us",
  FEEDBACK_AND_SUPPORT: "Feedback & Support",
  COMMON_BADGES: "Common Badges",
};

const blankDraft = (id: number): CatalogDraft => ({
  id,
  assetKey: "",
  title: "",
  category: "",
  altText: "",
  description: "",
});

function isCategory(value: unknown): value is AssetCategory {
  return typeof value === "string" && ASSET_CATEGORIES.includes(value as AssetCategory);
}

function isCategoryArray(value: unknown): value is AssetCategory[] {
  return Array.isArray(value) && value.every(isCategory);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAssetKeyDefinition(value: unknown): value is AssetKeyDefinition {
  if (!isRecord(value)) return false;
  return typeof value.assetKey === "string"
    && typeof value.title === "string"
    && isCategory(value.category)
    && (typeof value.altText === "string" || value.altText === null)
    && (typeof value.description === "string" || value.description === null)
    && typeof value.uploaded === "boolean"
    && (typeof value.imageUrl === "string" || value.imageUrl === null)
    && typeof value.enabled === "boolean";
}

function isAssetKeyDefinitionArray(value: unknown): value is AssetKeyDefinition[] {
  return Array.isArray(value) && value.every(isAssetKeyDefinition);
}

function isMediaAsset(value: unknown): value is MediaAsset {
  if (!isRecord(value)) return false;
  return typeof value.assetKey === "string"
    && typeof value.title === "string"
    && typeof value.imageUrl === "string"
    && (typeof value.altText === "string" || value.altText === null)
    && isCategory(value.category)
    && (typeof value.description === "string" || value.description === null)
    && typeof value.updatedAt === "string"
    && typeof value.isActive === "boolean";
}

function formatCategory(category: AssetCategory): string {
  return CATEGORY_LABELS[category];
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return redactStackTrace(value);
  if (isRecord(value)) {
    for (const key of ["detail", "message", "error", "title"]) {
      if (typeof value[key] === "string" && value[key]) return redactStackTrace(value[key] as string);
    }
  }
  return fallback;
}

function redactStackTrace(text: string): string {
  return text.replace(/(?:\r?\n\s+at\s+[\w.$]+\([^)]*\))+/g, "\n[backend stack trace redacted]");
}

function sanitizeInspectorValue(value: unknown): unknown {
  if (typeof value === "string") return redactStackTrace(value);
  if (Array.isArray(value)) return value.map(sanitizeInspectorValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/^(?:stack|stacktrace|trace|traceback)$/i.test(key))
      .map(([key, item]) => [key, sanitizeInspectorValue(item)]),
  );
}

function toDefinitionRequest(draft: CatalogDraft): AssetDefinitionRequest {
  return {
    assetKey: draft.assetKey.trim(),
    title: draft.title.trim(),
    category: draft.category as AssetCategory,
    ...(draft.altText.trim() ? { altText: draft.altText.trim() } : {}),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
  };
}

function validateDefinition(draft: CatalogDraft, categories: AssetCategory[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.assetKey.trim()) errors.assetKey = "Asset key is required.";
  else if (draft.assetKey.length > 100) errors.assetKey = "Maximum length is 100 characters.";
  else if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(draft.assetKey)) errors.assetKey = "Use lowercase letters, numbers, and single underscores.";
  if (!draft.title.trim()) errors.title = "Title is required.";
  else if (draft.title.length > 150) errors.title = "Maximum length is 150 characters.";
  if (!draft.category || !categories.includes(draft.category)) errors.category = "Choose a category returned by the categories API.";
  if (draft.altText.length > 255) errors.altText = "Maximum length is 255 characters.";
  return errors;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function AssetImage({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  const safeUrl = safeHttpUrl(src);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!safeUrl || failedUrl === safeUrl) {
    return <span className={`asset-image-fallback ${className ?? ""}`} aria-label="Image preview unavailable"><Image size={20} /></span>;
  }
  return <img className={className} src={safeUrl} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(safeUrl)} />;
}

function ImageFilePicker({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const previewUrl = file && preview?.file === file ? preview.url : null;
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  function choose(candidate: File | null) {
    setError("");
    if (!candidate) {
      setPreview(null);
      onChange(null);
      return;
    }
    if (!candidate.type.startsWith("image/")) {
      setError("Select an image file. This is a frontend safety check; the backend remains authoritative for accepted formats.");
      return;
    }
    if (candidate.size === 0) {
      setError("The selected file is empty.");
      return;
    }
    setPreview({ file: candidate, url: URL.createObjectURL(candidate) });
    onChange(candidate);
  }

  return (
    <div className={`asset-file-picker ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0] ?? null); }}>
      {!file ? (
        <label className="asset-file-empty">
          <Upload size={23} />
          <strong>Drop an image here or browse</strong>
          <span>Image files only. File size and supported formats are validated by the backend.</span>
          <input type="file" accept="image/*" onChange={(event) => choose(event.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <div className="asset-file-selected">
          {previewUrl && <img src={previewUrl} alt="Selected image preview" />}
          <div className="asset-file-meta">
            <strong title={file.name}>{file.name}</strong>
            <span>{formatFileSize(file.size)} · {file.type || "MIME type unavailable"}</span>
            <div>
              <label className="asset-secondary asset-file-replace">Replace file<input type="file" accept="image/*" onChange={(event) => choose(event.target.files?.[0] ?? null)} /></label>
              <button type="button" className="asset-text-button" onClick={() => choose(null)}><X size={14} /> Remove</button>
            </div>
          </div>
        </div>
      )}
      {error && <span className="asset-field-error">{error}</span>}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const timeout = useRef<number | null>(null);
  useEffect(() => () => { if (timeout.current !== null) window.clearTimeout(timeout.current); }, []);
  async function copy() {
    setCopied(false);
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timeout.current !== null) window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
      if (timeout.current !== null) window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setCopyError(false), 2200);
    }
  }
  return <button type="button" className={`asset-icon-button ${copyError ? "copy-error" : ""}`} onClick={() => void copy()} aria-label={copied ? `${label} copied` : copyError ? `${label} failed` : label} title={copyError ? "Clipboard access failed" : copied ? "Copied" : label}>{copied ? <Check size={14} /> : copyError ? <AlertCircle size={14} /> : <Clipboard size={14} />}</button>;
}

export default function DeveloperAssetsManagement() {
  const [activeTab, setActiveTab] = useState<PageTab>("Asset Library");
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [catalog, setCatalog] = useState<AssetKeyDefinition[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [uploadFilter, setUploadFilter] = useState<StatusFilter>("all");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [mediaByKey, setMediaByKey] = useState<Record<string, MediaAsset>>({});
  const [selectedAsset, setSelectedAsset] = useState<AssetKeyDefinition | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busyAction, setBusyAction] = useState("");
  const [inspection, setInspection] = useState<ApiInspection | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [registerDraft, setRegisterDraft] = useState<CatalogDraft>(() => blankDraft(1));
  const [batchDrafts, setBatchDrafts] = useState<CatalogDraft[]>(() => [blankDraft(1)]);
  const [nextDraftId, setNextDraftId] = useState(2);
  const [uploadKey, setUploadKey] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<AssetCategory | "">("");
  const [uploadAltText, setUploadAltText] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTitleOverride, setUploadTitleOverride] = useState(false);
  const [uploadCategoryOverride, setUploadCategoryOverride] = useState(false);
  const [uploadAltTextOverride, setUploadAltTextOverride] = useState(false);
  const [uploadDescriptionOverride, setUploadDescriptionOverride] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [metadataDraft, setMetadataDraft] = useState({ title: "", altText: "", category: "" as AssetCategory | "", description: "" });
  const [showDefinitionErrors, setShowDefinitionErrors] = useState(false);
  const mountRef = useRef(true);
  const modalRequestRef = useRef(false);
  const catalogRequestRef = useRef(0);

  useEffect(() => {
    mountRef.current = true;
    return () => { mountRef.current = false; };
  }, []);

  const runRequest = useCallback(async (method: string, endpoint: string, payload?: unknown, signal?: AbortSignal, recordInspection = true): Promise<ApiResult> => {
    const timestamp = new Date().toISOString();
    const started = performance.now();
    let response: Response | null = null;
    let responseBody: unknown = null;
    let failure = "";
    try {
      const init: RequestInit = { method, headers: { Accept: "application/json" }, signal };
      if (payload instanceof FormData) {
        init.body = payload;
      } else if (payload !== undefined) {
        init.headers = { Accept: "application/json", "Content-Type": "application/json" };
        init.body = JSON.stringify(payload);
      }
      response = await portalFetch(endpoint, init);
      responseBody = await parseResponseBody(response);
      if (!response.ok) failure = `HTTP ${response.status}: ${errorMessage(responseBody, response.statusText || "Request failed.")}`;
    } catch (error) {
      failure = error instanceof Error ? error.message : "The request failed before a response was received.";
    }
    const result: ApiResult = {
      method,
      endpoint,
      timestamp,
      durationMs: Math.round(performance.now() - started),
      status: response?.status ?? null,
      statusText: response?.statusText,
      ok: Boolean(response?.ok),
      response: responseBody,
      ...(failure ? { error: failure } : {}),
    };
    if (mountRef.current && !signal?.aborted && recordInspection) {
      setInspection({
        ...result,
        response: sanitizeInspectorValue(result.response),
        request: sanitizeInspectorValue(payload instanceof FormData ? Object.fromEntries([...payload.entries()].map(([key, value]) => [key, value instanceof File ? { fileName: value.name, size: value.size, type: value.type } : value])) : payload ?? null),
      });
      if (failure) setNotice({ kind: "error", message: failure });
    }
    return result;
  }, []);

  const loadCategories = useCallback(async (signal?: AbortSignal) => {
    setCategoriesLoading(true);
    setCategoriesError("");
    const result = await runRequest("GET", `${ASSETS_ENDPOINT}/categories`, undefined, signal);
    if (!mountRef.current || signal?.aborted) return;
    if (!result.ok) {
      setCategoriesError(result.error || "Unable to load asset categories.");
      setCategoriesLoading(false);
      return;
    }
    if (!isCategoryArray(result.response)) {
      setCategoriesError("The categories response did not match the backend category enum.");
      setCategoriesLoading(false);
      return;
    }
    setCategories(result.response);
    setCategoriesLoading(false);
  }, [runRequest]);

  const loadCatalog = useCallback(async (category: string, signal?: AbortSignal, recordInspection = true) => {
    const requestId = ++catalogRequestRef.current;
    setCatalogLoading(true);
    setCatalogError("");
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    const result = await runRequest("GET", `${ASSETS_ENDPOINT}/keys${query}`, undefined, signal, recordInspection);
    if (!mountRef.current || signal?.aborted || requestId !== catalogRequestRef.current) return;
    if (!result.ok) {
      setCatalogError(result.error || "Unable to load asset catalog.");
      setCatalogLoading(false);
      return;
    }
    if (!isAssetKeyDefinitionArray(result.response)) {
      setCatalogError("The catalog response did not match the asset key response contract.");
      setCatalogLoading(false);
      return;
    }
    const fetchedCatalog = result.response;
    setCatalog(fetchedCatalog);
    setSelectedAsset((current) => current ? fetchedCatalog.find((item) => item.assetKey === current.assetKey) ?? null : null);
    setCatalogLoading(false);
  }, [runRequest]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      void loadCategories(controller.signal);
      void loadCatalog("", controller.signal);
    });
    return () => controller.abort();
  }, [loadCategories, loadCatalog]);

  const visibleCatalog = useMemo(() => {
    if (!catalog) return [];
    const term = search.trim().toLocaleLowerCase();
    return catalog.filter((asset) => {
      if (term && ![asset.assetKey, asset.title, asset.category, asset.altText ?? "", asset.description ?? ""].some((value) => value.toLocaleLowerCase().includes(term))) return false;
      if (uploadFilter === "uploaded" && !asset.uploaded) return false;
      if (uploadFilter === "pending" && asset.uploaded) return false;
      if (enabledFilter === "enabled" && !asset.enabled) return false;
      if (enabledFilter === "disabled" && asset.enabled) return false;
      if (activeFilter !== "all") {
        const media = mediaByKey[asset.assetKey];
        if (!media || media.isActive !== (activeFilter === "active")) return false;
      }
      return true;
    });
  }, [activeFilter, catalog, enabledFilter, mediaByKey, search, uploadFilter]);

  const mediaCount = useMemo(
    () => (catalog ?? []).filter((item) => mediaByKey[item.assetKey]).length,
    [catalog, mediaByKey],
  );
  const statistics = useMemo(() => {
    const values = catalog ?? [];
    return {
      loaded: values.length,
      uploaded: values.filter((item) => item.uploaded).length,
      pending: values.filter((item) => !item.uploaded).length,
      enabled: values.filter((item) => item.enabled).length,
      disabled: values.filter((item) => !item.enabled).length,
      active: values.filter((item) => mediaByKey[item.assetKey]?.isActive).length,
      inactive: values.filter((item) => mediaByKey[item.assetKey] && !mediaByKey[item.assetKey].isActive).length,
    };
  }, [catalog, mediaByKey]);

  function changeCategory(value: string) {
    setCategoryFilter(value);
    setActiveFilter("all");
    void loadCatalog(value);
  }

  function refreshAll() {
    setNotice(null);
    void loadCategories();
    void loadCatalog(categoryFilter);
  }

  function closeDialog() {
    if (busyAction) return;
    setDialog(null);
    setUploadFile(null);
    setReplaceFile(null);
  }

  function openUpload(asset?: AssetKeyDefinition) {
    if (asset?.uploaded) {
      setReplaceFile(null);
      setDialog({ kind: "replace", asset });
      return;
    }
    setUploadKey(asset?.assetKey ?? "");
    setUploadTitle(asset?.title ?? "");
    setUploadCategory(asset?.category ?? "");
    setUploadAltText(asset?.altText ?? "");
    setUploadDescription(asset?.description ?? "");
    setUploadTitleOverride(false);
    setUploadCategoryOverride(false);
    setUploadAltTextOverride(false);
    setUploadDescriptionOverride(false);
    setUploadFile(null);
    setDialog({ kind: "upload" });
  }

  function openMetadata(asset: AssetKeyDefinition) {
    setMetadataDraft({
      title: asset.title,
      altText: asset.altText ?? "",
      category: asset.category,
      description: asset.description ?? "",
    });
    setDialog({ kind: "metadata", asset });
  }

  function setMediaResult(result: ApiResult, key: string) {
    if (result.ok && isMediaAsset(result.response)) {
      const media = result.response;
      setMediaByKey((current) => ({ ...current, [key]: media }));
    }
  }

  async function submitRegistration() {
    if (modalRequestRef.current || dialog?.kind !== "register") return;
    setShowDefinitionErrors(true);
    const errors = validateDefinition(registerDraft, categories);
    if (Object.keys(errors).length) {
      setNotice({ kind: "error", message: Object.values(errors)[0] });
      return;
    }
    modalRequestRef.current = true;
    setBusyAction("register");
    setNotice(null);
    try {
      const payload = toDefinitionRequest(registerDraft);
      const result = await runRequest("POST", `${ASSETS_ENDPOINT}/keys`, payload);
      if (!result.ok) return;
      setNotice({ kind: "success", message: isAssetKeyDefinition(result.response)
        ? `Catalog key "${result.response.assetKey}" registered (HTTP ${result.status}).`
        : `Registration completed with HTTP ${result.status}; the response body did not match the catalog definition format.` });
      setDialog(null);
      await loadCatalog(categoryFilter, undefined, false);
    } finally {
      modalRequestRef.current = false;
      setBusyAction("");
    }
  }

  async function submitBatch() {
    if (modalRequestRef.current || dialog?.kind !== "batch") return;
    setShowDefinitionErrors(true);
    if (batchDrafts.length < 1 || batchDrafts.length > 100) {
      setNotice({ kind: "error", message: "Batch registration requires between 1 and 100 definitions." });
      return;
    }
    for (let index = 0; index < batchDrafts.length; index += 1) {
      const errors = validateDefinition(batchDrafts[index], categories);
      if (Object.keys(errors).length) {
        setNotice({ kind: "error", message: `Definition ${index + 1}: ${Object.values(errors)[0]}` });
        return;
      }
    }
    modalRequestRef.current = true;
    setBusyAction("batch");
    setNotice(null);
    try {
      const payload = batchDrafts.map(toDefinitionRequest);
      const result = await runRequest("POST", `${ASSETS_ENDPOINT}/keys/batch`, payload);
      if (!result.ok) return;
      setNotice({ kind: "success", message: isAssetKeyDefinitionArray(result.response)
        ? `The backend returned ${result.response.length} registered catalog definition(s).`
        : `Batch registration completed with HTTP ${result.status}; the response body did not match the catalog definition list format.` });
      setDialog(null);
      await loadCatalog(categoryFilter, undefined, false);
    } finally {
      modalRequestRef.current = false;
      setBusyAction("");
    }
  }

  async function submitUpload() {
    if (modalRequestRef.current || dialog?.kind !== "upload") return;
    if (!uploadKey) {
      setNotice({ kind: "error", message: "Select an existing catalog key before uploading." });
      return;
    }
    if (!uploadFile) {
      setNotice({ kind: "error", message: "Choose an image file before uploading." });
      return;
    }
    if ((uploadTitleOverride && uploadTitle.length > 150) || (uploadAltTextOverride && uploadAltText.length > 255)) {
      setNotice({ kind: "error", message: "Title must be 150 characters or fewer and alt text must be 255 characters or fewer." });
      return;
    }
    modalRequestRef.current = true;
    setBusyAction("upload");
    setNotice(null);
    try {
      const form = new FormData();
      form.append("assetKey", uploadKey);
      if (uploadTitleOverride && uploadTitle.trim()) form.append("title", uploadTitle.trim());
      if (uploadCategoryOverride && uploadCategory) form.append("category", uploadCategory);
      if (uploadAltTextOverride && uploadAltText.trim()) form.append("altText", uploadAltText.trim());
      if (uploadDescriptionOverride && uploadDescription.trim()) form.append("description", uploadDescription.trim());
      form.append("file", uploadFile);
      const result = await runRequest("POST", `${ASSETS_ENDPOINT}/upload`, form);
      if (!result.ok) return;
      if (isMediaAsset(result.response) && result.response.assetKey === uploadKey) {
        setMediaResult(result, uploadKey);
        setNotice({ kind: "success", message: `The backend returned uploaded asset "${result.response.assetKey}".` });
      } else {
        setMediaByKey((current) => {
          const next = { ...current };
          delete next[uploadKey];
          return next;
        });
        setNotice({ kind: "success", message: `Upload completed with HTTP ${result.status}; media status is not available in the returned response and the catalog is being refreshed.` });
      }
      setDialog(null);
      setUploadFile(null);
      await loadCatalog(categoryFilter, undefined, false);
    } finally {
      modalRequestRef.current = false;
      setBusyAction("");
    }
  }

  async function submitReplacement(asset: AssetKeyDefinition) {
    if (modalRequestRef.current || !replaceFile) {
      if (!replaceFile) setNotice({ kind: "error", message: "Choose an image file before replacing the current image." });
      return;
    }
    modalRequestRef.current = true;
    setBusyAction(`replace:${asset.assetKey}`);
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", replaceFile);
      const result = await runRequest("PATCH", `${ASSETS_ENDPOINT}/${encodeURIComponent(asset.assetKey)}/image`, form);
      if (!result.ok) return;
      if (isMediaAsset(result.response) && result.response.assetKey === asset.assetKey) {
        setMediaResult(result, asset.assetKey);
        setNotice({ kind: "success", message: `The image for "${result.response.assetKey}" was replaced.` });
      } else {
        setMediaByKey((current) => {
          const next = { ...current };
          delete next[asset.assetKey];
          return next;
        });
        setNotice({ kind: "success", message: `Image replacement completed with HTTP ${result.status}; media status is not available in the returned response.` });
      }
      setDialog(null);
      setReplaceFile(null);
      await loadCatalog(categoryFilter, undefined, false);
    } finally {
      modalRequestRef.current = false;
      setBusyAction("");
    }
  }

  async function submitMetadata(asset: AssetKeyDefinition) {
    if (modalRequestRef.current) return;
    if (metadataDraft.altText.length > 255) {
      setNotice({ kind: "error", message: "Alt text must be 255 characters or fewer." });
      return;
    }
    const payload: Record<string, string | null> = {};
    if (metadataDraft.title !== asset.title) payload.title = metadataDraft.title.trim() || null;
    if (metadataDraft.altText !== (asset.altText ?? "")) payload.altText = metadataDraft.altText.trim() || null;
    if (metadataDraft.category !== asset.category) payload.category = metadataDraft.category || null;
    if (metadataDraft.description !== (asset.description ?? "")) payload.description = metadataDraft.description.trim() || null;
    if (!Object.keys(payload).length) {
      setNotice({ kind: "error", message: "Change at least one metadata field before submitting." });
      return;
    }
    modalRequestRef.current = true;
    setBusyAction(`metadata:${asset.assetKey}`);
    setNotice(null);
    try {
      const result = await runRequest("PATCH", `${ASSETS_ENDPOINT}/${encodeURIComponent(asset.assetKey)}/metadata`, payload);
      if (!result.ok) return;
      if (isAssetKeyDefinition(result.response) && result.response.assetKey === asset.assetKey) {
        setNotice({ kind: "success", message: `Metadata for "${result.response.assetKey}" was updated.` });
      } else if (isMediaAsset(result.response) && result.response.assetKey === asset.assetKey) {
        setMediaResult(result, asset.assetKey);
        setNotice({ kind: "success", message: `Metadata for "${result.response.assetKey}" was updated.` });
      } else {
        setMediaByKey((current) => {
          const next = { ...current };
          delete next[asset.assetKey];
          return next;
        });
        setNotice({ kind: "success", message: `Metadata update completed with HTTP ${result.status}; the response body did not match a known asset DTO.` });
      }
      setDialog(null);
      await loadCatalog(categoryFilter, undefined, false);
    } finally {
      modalRequestRef.current = false;
      setBusyAction("");
    }
  }

  async function toggleActive(asset: AssetKeyDefinition) {
    const media = mediaByKey[asset.assetKey];
    if (!media) return;
    await setActiveStatus(asset, !media.isActive);
  }

  async function setActiveStatus(asset: AssetKeyDefinition, next: boolean) {
    const media = mediaByKey[asset.assetKey];
    if (!asset.uploaded || modalRequestRef.current || busyAction || media?.isActive === next) return;
    if (!next && !window.confirm(`Deactivate uploaded asset "${asset.assetKey}"?`)) return;
    modalRequestRef.current = true;
    setBusyAction(`active:${asset.assetKey}`);
    setNotice(null);
    const endpoint = `${ASSETS_ENDPOINT}/${encodeURIComponent(asset.assetKey)}/status?isActive=${String(next)}`;
    try {
      const result = await runRequest("PATCH", endpoint);
      if (result.ok && isMediaAsset(result.response) && result.response.assetKey === asset.assetKey) {
        setMediaResult(result, asset.assetKey);
        setNotice({ kind: "success", message: `Backend reports "${asset.assetKey}" as ${result.response.isActive ? "active" : "inactive"}.` });
      } else if (result.ok) {
        setMediaByKey((current) => {
          const next = { ...current };
          delete next[asset.assetKey];
          return next;
        });
        setNotice({ kind: "success", message: `Status update completed with HTTP ${result.status}, but the response did not include the current media status.` });
      }
    } finally {
      modalRequestRef.current = false;
      setBusyAction("");
    }
  }

  async function toggleEnabled(asset: AssetKeyDefinition) {
    if (modalRequestRef.current || busyAction) return;
    const next = !asset.enabled;
    if (!next && !window.confirm(`Disable catalog key "${asset.assetKey}"? This does not change uploaded image active status.`)) return;
    modalRequestRef.current = true;
    setBusyAction(`enabled:${asset.assetKey}`);
    setNotice(null);
    const endpoint = `${ASSETS_ENDPOINT}/keys/${encodeURIComponent(asset.assetKey)}/status?enabled=${String(next)}`;
    try {
      const result = await runRequest("PATCH", endpoint);
      if (result.ok && isAssetKeyDefinition(result.response) && result.response.assetKey === asset.assetKey) {
        setNotice({ kind: "success", message: `Backend reports "${asset.assetKey}" as ${result.response.enabled ? "enabled" : "disabled"}.` });
        await loadCatalog(categoryFilter, undefined, false);
      } else if (result.ok) {
        setNotice({ kind: "success", message: `Status update completed with HTTP ${result.status}; refreshing catalog for the actual enabled state.` });
        await loadCatalog(categoryFilter, undefined, false);
      }
    } finally {
      modalRequestRef.current = false;
      setBusyAction("");
    }
  }

  async function deleteImage(asset: AssetKeyDefinition) {
    if (modalRequestRef.current || dialog?.kind !== "delete-image") return;
    modalRequestRef.current = true;
    setBusyAction(`delete-image:${asset.assetKey}`);
    setNotice(null);
    try {
      const result = await runRequest("DELETE", `${ASSETS_ENDPOINT}/${encodeURIComponent(asset.assetKey)}/image`);
      if (!result.ok) return;
      if (isMediaAsset(result.response) && result.response.assetKey === asset.assetKey) setMediaResult(result, asset.assetKey);
      else setMediaByKey((current) => {
        const next = { ...current };
        delete next[asset.assetKey];
        return next;
      });
      setActiveFilter("all");
      setNotice({ kind: "success", message: `The image deletion endpoint returned HTTP ${result.status}. The catalog definition remains; catalog state is being refreshed.` });
      setDialog(null);
      await loadCatalog(categoryFilter, undefined, false);
    } finally {
      modalRequestRef.current = false;
      setBusyAction("");
    }
  }

  async function deleteCatalogKey(asset: AssetKeyDefinition) {
    if (modalRequestRef.current || dialog?.kind !== "delete-key") return;
    modalRequestRef.current = true;
    setBusyAction(`delete-key:${asset.assetKey}`);
    setNotice(null);
    try {
      const result = await runRequest("DELETE", `${ASSETS_ENDPOINT}/keys/${encodeURIComponent(asset.assetKey)}`);
      if (!result.ok) return;
      if (result.status !== 204) {
        setNotice({ kind: "error", message: `Catalog delete returned HTTP ${result.status ?? "unknown"}; expected 204 No Content.` });
        return;
      }
      setMediaByKey((current) => {
        const next = { ...current };
        delete next[asset.assetKey];
        return next;
      });
      setNotice({ kind: "success", message: `Catalog definition "${asset.assetKey}" was deleted (204 No Content).` });
      setDialog(null);
      if (selectedAsset?.assetKey === asset.assetKey) setSelectedAsset(null);
      await loadCatalog(categoryFilter, undefined, false);
    } finally {
      modalRequestRef.current = false;
      setBusyAction("");
    }
  }

  function updateDraft(id: number, field: keyof Omit<CatalogDraft, "id">, value: string) {
    setBatchDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, [field]: value } as CatalogDraft : draft));
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("");
    setUploadFilter("all");
    setEnabledFilter("all");
    setActiveFilter("all");
    void loadCatalog("");
  }

  const selectedMedia = selectedAsset ? mediaByKey[selectedAsset.assetKey] : undefined;
  const categoryControlsDisabled = categoriesLoading || categories.length === 0;

  return (
    <div className="dev-content assets-management">
      <header className="dev-page-heading assets-page-heading">
        <div>
          <h1>Assets Management</h1>
          <p>Manage catalog definitions and uploaded application media through the authenticated assets API.</p>
        </div>
        <button type="button" className="asset-secondary" onClick={refreshAll} disabled={catalogLoading || categoriesLoading}><RefreshCw size={15} className={catalogLoading || categoriesLoading ? "asset-spin" : ""} /> Refresh</button>
      </header>

      <div className="asset-summary-grid">
        <article><span>Catalog keys in result</span><strong>{catalog === null ? "—" : statistics.loaded}</strong></article>
        <article><span>Uploaded images</span><strong>{catalog === null ? "—" : statistics.uploaded}</strong></article>
        <article><span>Pending uploads</span><strong>{catalog === null ? "—" : statistics.pending}</strong></article>
        <article><span>Catalog enabled</span><strong>{catalog === null ? "—" : statistics.enabled}</strong></article>
        <article><span>Catalog disabled</span><strong>{catalog === null ? "—" : statistics.disabled}</strong></article>
        <article><span>Known active / inactive</span><strong>{mediaCount ? `${statistics.active} / ${statistics.inactive}` : "Not loaded"}</strong></article>
      </div>
      <p className="asset-stat-note">Counts use the current catalog API result{categoryFilter ? " for the selected category" : ""}. Active/inactive counts include only media responses received during this page session; the catalog list does not include that field.</p>

      <div className="asset-tabs" role="tablist" aria-label="Asset management areas">
        {(["Asset Library", "Asset Catalog"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </div>

      <div className="asset-toolbar">
        <label className="asset-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search key, title, category, alt text, description" /></label>
        <label className="asset-filter"><span>Category</span><select value={categoryFilter} disabled={categoryControlsDisabled} onChange={(event) => changeCategory(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{formatCategory(category)}</option>)}</select></label>
        {activeTab === "Asset Library" ? (
          <>
            <label className="asset-filter"><span>Upload</span><select value={uploadFilter} onChange={(event) => setUploadFilter(event.target.value as StatusFilter)}><option value="all">All</option><option value="uploaded">Uploaded</option><option value="pending">Pending upload</option></select></label>
            <label className="asset-filter"><span>Catalog</span><select value={enabledFilter} onChange={(event) => setEnabledFilter(event.target.value as EnabledFilter)}><option value="all">All</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
            {mediaCount > 0 && <label className="asset-filter"><span>Image active</span><select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
          </>
        ) : null}
        <button type="button" className="asset-text-button asset-clear-filters" onClick={clearFilters}>Clear filters</button>
        <div className="asset-toolbar-actions">
          <button type="button" className="asset-secondary" onClick={() => { setRegisterDraft(blankDraft(1)); setShowDefinitionErrors(false); setDialog({ kind: "register" }); }} disabled={categoryControlsDisabled}><Plus size={15} /> Register key</button>
          <button type="button" className="asset-primary" onClick={() => { setBatchDrafts([blankDraft(1)]); setNextDraftId(2); setShowDefinitionErrors(false); setDialog({ kind: "batch" }); }} disabled={categoryControlsDisabled}><Plus size={15} /> Batch register</button>
          <button type="button" className="asset-secondary" onClick={() => openUpload()} disabled={!catalog?.some((asset) => !asset.uploaded)}><Upload size={15} /> Upload asset</button>
        </div>
      </div>

      {categoriesError && <div className="asset-error-banner"><AlertCircle size={16} /><span>{categoriesError}</span><button type="button" onClick={() => void loadCategories()}>Retry</button></div>}
      {catalogError && <div className="asset-error-banner"><AlertCircle size={16} /><span>{catalogError}</span><button type="button" onClick={() => void loadCatalog(categoryFilter)}>Retry</button></div>}
      {notice && <div className={`asset-notice ${notice.kind}`} role="status"><AlertCircle size={16} /><span>{notice.message}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15} /></button></div>}

      <div className={`asset-main-grid ${selectedAsset ? "with-details" : ""}`}>
        <section className="asset-panel asset-list-panel">
          <div className="asset-panel-heading">
            <div><h2>{activeTab}</h2><p>{activeTab === "Asset Library" ? "Catalog definitions and image details from the live catalog API." : "Create, enable, update and remove catalog definitions."}</p></div>
            <span className="asset-result-count">{catalog === null ? "—" : `${visibleCatalog.length} shown`}</span>
          </div>
          {catalogLoading ? (
            <div className="asset-state"><LoaderCircle size={20} className="asset-spin" /> Loading asset catalog…</div>
          ) : catalogError ? (
            <div className="asset-state asset-state-error"><AlertCircle size={20} /><strong>Catalog unavailable</strong><span>Retry the request to load actual asset data.</span><button type="button" className="asset-secondary" onClick={() => void loadCatalog(categoryFilter)}><RefreshCw size={14} /> Retry</button></div>
          ) : !visibleCatalog.length ? (
            <div className="asset-state"><FileImage size={22} /><strong>{catalog?.length ? "No matching assets" : "No catalog keys returned"}</strong><span>{catalog?.length ? "Adjust search or filters to see catalog results." : "Register a catalog key to begin. No placeholder records are displayed."}</span></div>
          ) : (
            <div className="asset-table-wrap">
              <table className="asset-table">
                <thead><tr><th>Image</th><th>Asset key / title</th><th>Category</th>{activeTab === "Asset Catalog" && <><th>Alt text</th><th>Description</th></>}<th>Upload</th><th>Catalog</th>{activeTab === "Asset Library" && mediaCount > 0 && <><th>Image active</th><th>Updated</th></>}<th>Image URL</th><th>Actions</th></tr></thead>
                <tbody>
                  {visibleCatalog.map((asset) => {
                    const media = mediaByKey[asset.assetKey];
                    return <tr key={asset.assetKey} className={selectedAsset?.assetKey === asset.assetKey ? "selected" : ""} onClick={() => setSelectedAsset(asset)}>
                      <td><AssetImage className="asset-table-image" src={asset.uploaded ? asset.imageUrl : null} alt={asset.altText || asset.title} /></td>
                      <td><button type="button" className="asset-key-link" onClick={(event) => { event.stopPropagation(); setSelectedAsset(asset); }}>{asset.assetKey}</button><strong className="asset-title">{asset.title}</strong></td>
                      <td><span className="asset-category-chip">{formatCategory(asset.category)}</span></td>
                      {activeTab === "Asset Catalog" && <><td className="asset-description-cell">{asset.altText || "—"}</td><td className="asset-description-cell">{asset.description || "—"}</td></>}
                      <td><span className={`asset-status ${asset.uploaded ? "positive" : "muted"}`}>{asset.uploaded ? "Uploaded" : "Pending upload"}</span></td>
                      <td><span className={`asset-status ${asset.enabled ? "positive" : "muted"}`}>{asset.enabled ? "Enabled" : "Disabled"}</span></td>
                      {activeTab === "Asset Library" && mediaCount > 0 && <><td>{media ? <span className={`asset-status ${media.isActive ? "positive" : "negative"}`}>{media.isActive ? "Active" : "Inactive"}</span> : <span className="asset-unavailable">Not returned</span>}</td><td>{media ? formatDate(media.updatedAt) : "—"}</td></>}
                      <td>{asset.imageUrl && asset.uploaded && safeHttpUrl(asset.imageUrl) ? <span className="asset-url-cell"><a href={safeHttpUrl(asset.imageUrl) ?? undefined} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} title={asset.imageUrl}>{asset.imageUrl}</a><CopyButton value={asset.imageUrl} label="Copy image URL" /></span> : <span className="asset-unavailable">No image URL</span>}</td>
                      <td onClick={(event) => event.stopPropagation()}><div className="asset-row-actions">
                        <button type="button" className="asset-icon-button" title="View details" aria-label={`View ${asset.assetKey} details`} onClick={() => setSelectedAsset(asset)}><Search size={14} /></button>
                        <button type="button" className="asset-icon-button" title={asset.uploaded ? "Replace image" : "Upload image"} aria-label={asset.uploaded ? `Replace ${asset.assetKey} image` : `Upload ${asset.assetKey} image`} onClick={() => asset.uploaded ? (setReplaceFile(null), setDialog({ kind: "replace", asset })) : openUpload(asset)}><Upload size={14} /></button>
                        {activeTab === "Asset Catalog" && <button type="button" className="asset-icon-button" title="Edit metadata" aria-label={`Edit ${asset.assetKey} metadata`} onClick={() => openMetadata(asset)}><Pencil size={14} /></button>}
                      </div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedAsset && (
          <aside className="asset-panel asset-details-panel">
            <div className="asset-panel-heading">
              <div><h2>Asset details</h2><p>Catalog definition and uploaded media are shown separately.</p></div>
              <button type="button" className="asset-icon-button" aria-label="Close asset details" onClick={() => setSelectedAsset(null)}><X size={16} /></button>
            </div>
            <div className="asset-detail-image"><AssetImage src={selectedAsset.uploaded ? selectedAsset.imageUrl : null} alt={selectedAsset.altText || selectedAsset.title} />{selectedAsset.imageUrl && safeHttpUrl(selectedAsset.imageUrl) && <a href={safeHttpUrl(selectedAsset.imageUrl) ?? undefined} target="_blank" rel="noopener noreferrer">Open image <ExternalLink size={13} /></a>}</div>
            <dl className="asset-detail-list">
              <div><dt>Asset key</dt><dd><code>{selectedAsset.assetKey}</code><CopyButton value={selectedAsset.assetKey} label="Copy asset key" /></dd></div>
              <div><dt>Title</dt><dd>{selectedAsset.title}</dd></div>
              <div><dt>Category</dt><dd>{formatCategory(selectedAsset.category)}</dd></div>
              <div><dt>Alt text</dt><dd>{selectedAsset.altText || "Not set"}</dd></div>
              <div><dt>Description</dt><dd>{selectedAsset.description || "Not set"}</dd></div>
              <div><dt>Image upload</dt><dd>{selectedAsset.uploaded ? "Uploaded" : "Pending upload"}</dd></div>
              <div><dt>Catalog status</dt><dd>{selectedAsset.enabled ? "Enabled" : "Disabled"}</dd></div>
              <div><dt>Image active</dt><dd>{selectedMedia ? selectedMedia.isActive ? "Active" : "Inactive" : "Unavailable: no media response in this session"}</dd></div>
              <div><dt>Image URL</dt><dd>{selectedAsset.imageUrl || "Not available"}{selectedAsset.imageUrl && <CopyButton value={selectedAsset.imageUrl} label="Copy image URL" />}</dd></div>
              {selectedMedia && <div><dt>Media updated</dt><dd>{formatDate(selectedMedia.updatedAt)}</dd></div>}
            </dl>
            <div className="asset-detail-actions">
              <button type="button" className="asset-secondary" onClick={() => openUpload(selectedAsset)}><Upload size={14} /> Upload / replace</button>
              <button type="button" className="asset-secondary" onClick={() => openMetadata(selectedAsset)}><Pencil size={14} /> Edit metadata</button>
              {selectedMedia && <button type="button" className="asset-secondary" disabled={busyAction === `active:${selectedAsset.assetKey}`} onClick={() => void toggleActive(selectedAsset)}>{selectedMedia.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}{selectedMedia.isActive ? "Deactivate image" : "Activate image"}</button>}
              {selectedAsset.uploaded && !selectedMedia && <><button type="button" className="asset-secondary" disabled={Boolean(busyAction)} onClick={() => void setActiveStatus(selectedAsset, true)}><ToggleRight size={14} /> Set image active</button><button type="button" className="asset-secondary" disabled={Boolean(busyAction)} onClick={() => void setActiveStatus(selectedAsset, false)}><ToggleLeft size={14} /> Set image inactive</button></>}
              <button type="button" className="asset-danger" disabled={!selectedAsset.uploaded} onClick={() => setDialog({ kind: "delete-image", asset: selectedAsset })}><Trash2 size={14} /> Delete image only</button>
              <button type="button" className="asset-secondary" onClick={() => void toggleEnabled(selectedAsset)} disabled={busyAction === `enabled:${selectedAsset.assetKey}`}>{selectedAsset.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}{selectedAsset.enabled ? "Disable catalog key" : "Enable catalog key"}</button>
              <button type="button" className="asset-danger" onClick={() => setDialog({ kind: "delete-key", asset: selectedAsset })}><Trash2 size={14} /> Delete catalog key</button>
            </div>
            <details className="asset-detail-json"><summary>Show catalog definition JSON</summary><pre>{JSON.stringify(selectedAsset, null, 2)}</pre><CopyButton value={JSON.stringify(selectedAsset, null, 2)} label="Copy catalog JSON" /></details>
            {selectedMedia && <details className="asset-detail-json"><summary>Show actual media response JSON</summary><pre>{JSON.stringify(selectedMedia, null, 2)}</pre><CopyButton value={JSON.stringify(selectedMedia, null, 2)} label="Copy media JSON" /></details>}
          </aside>
        )}
      </div>

      <section className="asset-panel asset-inspector">
        <div className="asset-panel-heading">
          <div><h2>API request / response inspector</h2><p>Latest real assets API request. Multipart files are represented by file metadata, never binary content.</p></div>
          {inspection && <span className={`asset-status ${inspection.ok ? "positive" : "negative"}`}>{inspection.status === null ? "Network error" : `HTTP ${inspection.status}`}</span>}
        </div>
        {!inspection ? <div className="asset-state compact">Waiting for the categories and catalog requests…</div> : (
          <div className="asset-inspection-content">
            <div className="asset-inspection-meta"><span><strong>{inspection.method}</strong> {inspection.endpoint}</span><span>{formatDate(inspection.timestamp)}</span><span>{inspection.durationMs} ms</span></div>
            {inspection.error && <div className="asset-error-banner"><AlertCircle size={15} />{inspection.error}</div>}
            <div className="asset-inspection-columns">
              <details open><summary>Request details</summary><pre>{JSON.stringify(inspection.request, null, 2)}</pre><CopyButton value={JSON.stringify(inspection.request, null, 2)} label="Copy request preview" /></details>
              <details open><summary>Actual response body</summary><pre>{inspection.response === null ? inspection.status === 204 ? "204 No Content" : "Empty response body" : typeof inspection.response === "string" ? inspection.response : JSON.stringify(inspection.response, null, 2)}</pre><CopyButton value={inspection.response === null ? "" : typeof inspection.response === "string" ? inspection.response : JSON.stringify(inspection.response, null, 2)} label="Copy response" /></details>
            </div>
          </div>
        )}
      </section>

      {dialog && (
        <div className="asset-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className="asset-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-dialog-title">
            <header><div><h2 id="asset-dialog-title">{dialog.kind === "register" ? "Register catalog key" : dialog.kind === "batch" ? "Batch register keys" : dialog.kind === "upload" ? "Upload asset image" : dialog.kind === "replace" ? "Replace existing image" : dialog.kind === "metadata" ? "Edit asset metadata" : dialog.kind === "delete-image" ? "Delete uploaded image" : "Delete catalog definition"}</h2><p>{dialog.kind === "delete-image" ? "This removes the image only. The catalog key remains registered." : dialog.kind === "delete-key" ? "This removes the catalog definition. It does not guarantee that an uploaded image is removed from storage." : "Values are sent to the authenticated assets API."}</p></div><button type="button" className="asset-icon-button" aria-label="Close dialog" disabled={Boolean(busyAction)} onClick={closeDialog}><X size={16} /></button></header>

            {dialog.kind === "register" && <div className="asset-dialog-content">
              <DefinitionFields draft={registerDraft} categories={categories} loadingCategories={categoriesLoading} showErrors={showDefinitionErrors} onChange={(field, value) => setRegisterDraft((current) => ({ ...current, [field]: value }))} />
              <details className="asset-payload-preview"><summary>Request payload preview</summary><pre>{JSON.stringify(toDefinitionRequest(registerDraft), null, 2)}</pre><CopyButton value={JSON.stringify(toDefinitionRequest(registerDraft), null, 2)} label="Copy registration payload" /></details>
              <DialogFooter busy={busyAction === "register"} onCancel={closeDialog} onSubmit={() => void submitRegistration()} submitLabel="Register key" />
            </div>}

            {dialog.kind === "batch" && <div className="asset-dialog-content">
              <p className="asset-dialog-helper">Add 1–100 definitions. Each row is validated before submitting. {batchDrafts.length}/100 entries.</p>
              {batchDrafts.length >= 90 && <div className="asset-warning"><AlertCircle size={15} /> Approaching the 100-definition batch limit.</div>}
              <div className="asset-batch-rows">
                {batchDrafts.map((draft, index) => <article className="asset-batch-row" key={draft.id}>
                  <header><strong>Definition {index + 1}</strong><button type="button" className="asset-text-button" disabled={batchDrafts.length <= 1} onClick={() => setBatchDrafts((current) => current.filter((entry) => entry.id !== draft.id))}><Trash2 size={14} /> Remove</button></header>
                  <DefinitionFields draft={draft} categories={categories} loadingCategories={categoriesLoading} showErrors={showDefinitionErrors} onChange={(field, value) => updateDraft(draft.id, field, value)} compact />
                </article>)}
              </div>
              <div className="asset-batch-actions"><button type="button" className="asset-secondary" disabled={batchDrafts.length >= 100} onClick={() => { setBatchDrafts((current) => [...current, blankDraft(nextDraftId)]); setNextDraftId((value) => value + 1); }}><Plus size={14} /> Add row</button><button type="button" className="asset-text-button" disabled={batchDrafts.length === 0} onClick={() => { if (window.confirm("Clear all batch definitions?")) setBatchDrafts([]); }}><Trash2 size={14} /> Clear all</button></div>
              <details className="asset-payload-preview"><summary>Live JSON payload preview</summary><pre>{JSON.stringify(batchDrafts.map(toDefinitionRequest), null, 2)}</pre><CopyButton value={JSON.stringify(batchDrafts.map(toDefinitionRequest), null, 2)} label="Copy batch payload" /></details>
              <DialogFooter busy={busyAction === "batch"} onCancel={closeDialog} onSubmit={() => void submitBatch()} submitLabel="Register batch" disabled={batchDrafts.length < 1 || batchDrafts.length > 100} />
            </div>}

            {dialog.kind === "upload" && <div className="asset-dialog-content">
              <label className="asset-field"><span>Catalog asset key <b>Required</b></span><select value={uploadKey} onChange={(event) => { const asset = catalog?.find((item) => item.assetKey === event.target.value); setUploadKey(event.target.value); setUploadTitle(asset?.title ?? ""); setUploadCategory(asset?.category ?? ""); setUploadAltText(asset?.altText ?? ""); setUploadDescription(asset?.description ?? ""); setUploadTitleOverride(false); setUploadCategoryOverride(false); setUploadAltTextOverride(false); setUploadDescriptionOverride(false); }}><option value="">Choose a pending catalog key</option>{(catalog ?? []).filter((asset) => !asset.uploaded).map((asset) => <option key={asset.assetKey} value={asset.assetKey}>{asset.assetKey} — {asset.title} · {formatCategory(asset.category)} · Pending · {asset.enabled ? "Enabled" : "Disabled"}</option>)}</select><small>Select a pending key. Existing images must use Replace; leave overrides blank to use catalog metadata.</small></label>
              {uploadKey && (() => { const asset = catalog?.find((item) => item.assetKey === uploadKey); return asset ? <div className="asset-selected-key-info"><AssetImage src={asset.imageUrl} alt={asset.altText || asset.title} /><div><strong>{asset.assetKey}</strong><span>{asset.title} · {formatCategory(asset.category)}</span><span>Upload: {asset.uploaded ? "Uploaded" : "Pending"} · Catalog: {asset.enabled ? "Enabled" : "Disabled"}</span>{asset.imageUrl && <code>{asset.imageUrl}</code>}</div></div> : null; })()}
              <div className="asset-field"><span>Title <em>Catalog value / optional override</em><small>{uploadTitle.length}/150</small></span><input value={uploadTitle} maxLength={150} disabled={!uploadTitleOverride} onChange={(event) => setUploadTitle(event.target.value)} /><span className="asset-override-toggle"><input type="checkbox" checked={uploadTitleOverride} onChange={(event) => setUploadTitleOverride(event.target.checked)} /> Send title override</span></div>
              <div className="asset-field"><span>Category <em>Catalog value / optional override</em></span><select value={uploadCategory} disabled={!uploadCategoryOverride} onChange={(event) => setUploadCategory(event.target.value as AssetCategory | "")}>{categories.map((category) => <option key={category} value={category}>{formatCategory(category)}</option>)}</select><span className="asset-override-toggle"><input type="checkbox" checked={uploadCategoryOverride} onChange={(event) => setUploadCategoryOverride(event.target.checked)} /> Send category override</span></div>
              <div className="asset-field"><span>Alt text <em>Catalog value / optional override</em><small>{uploadAltText.length}/255</small></span><input value={uploadAltText} maxLength={255} disabled={!uploadAltTextOverride} onChange={(event) => setUploadAltText(event.target.value)} /><span className="asset-override-toggle"><input type="checkbox" checked={uploadAltTextOverride} onChange={(event) => setUploadAltTextOverride(event.target.checked)} /> Send alt text override</span></div>
              <div className="asset-field"><span>Description <em>Catalog value / optional override</em></span><textarea rows={2} value={uploadDescription} disabled={!uploadDescriptionOverride} onChange={(event) => setUploadDescription(event.target.value)} /><span className="asset-override-toggle"><input type="checkbox" checked={uploadDescriptionOverride} onChange={(event) => setUploadDescriptionOverride(event.target.checked)} /> Send description override</span></div>
              <div className="asset-field"><span>Image file <b>Required</b></span><ImageFilePicker file={uploadFile} onChange={setUploadFile} /></div>
              <details className="asset-payload-preview"><summary>Multipart request preview</summary><pre>{JSON.stringify({ fields: { assetKey: uploadKey, ...(uploadTitleOverride && uploadTitle.trim() ? { title: uploadTitle.trim() } : {}), ...(uploadCategoryOverride && uploadCategory ? { category: uploadCategory } : {}), ...(uploadAltTextOverride && uploadAltText.trim() ? { altText: uploadAltText.trim() } : {}), ...(uploadDescriptionOverride && uploadDescription.trim() ? { description: uploadDescription.trim() } : {}) }, file: uploadFile ? { name: uploadFile.name, size: uploadFile.size, type: uploadFile.type } : null }, null, 2)}</pre></details>
              <DialogFooter busy={busyAction === "upload"} onCancel={closeDialog} onSubmit={() => void submitUpload()} submitLabel="Upload image" disabled={!uploadKey || !uploadFile} />
            </div>}

            {dialog.kind === "replace" && <div className="asset-dialog-content">
              <div className="asset-replace-warning"><ShieldAlert size={17} /><div><strong>This will replace the image for {dialog.asset.assetKey}</strong><span>The catalog definition and key remain unchanged.</span></div></div>
              <div className="asset-selected-key-info"><AssetImage src={dialog.asset.imageUrl} alt={dialog.asset.altText || dialog.asset.title} /><div><strong>{dialog.asset.assetKey}</strong><span>{dialog.asset.title} · {formatCategory(dialog.asset.category)}</span><span>Current catalog URL: {dialog.asset.imageUrl || "Not available"}</span><span>Image active: {mediaByKey[dialog.asset.assetKey] ? mediaByKey[dialog.asset.assetKey].isActive ? "Active" : "Inactive" : "Not provided by catalog API"}</span></div></div>
              <div className="asset-field"><span>New image file <b>Required</b></span><ImageFilePicker file={replaceFile} onChange={setReplaceFile} /></div>
              <details className="asset-payload-preview"><summary>Multipart request preview</summary><pre>{JSON.stringify({ method: "PATCH", endpoint: `${ASSETS_ENDPOINT}/${dialog.asset.assetKey}/image`, file: replaceFile ? { name: replaceFile.name, size: replaceFile.size, type: replaceFile.type } : null }, null, 2)}</pre></details>
              <DialogFooter busy={busyAction === `replace:${dialog.asset.assetKey}`} onCancel={closeDialog} onSubmit={() => void submitReplacement(dialog.asset)} submitLabel="Replace image" disabled={!replaceFile} />
            </div>}

            {dialog.kind === "metadata" && <div className="asset-dialog-content">
              <p className="asset-dialog-helper">Asset key: <code>{dialog.asset.assetKey}</code>. Only changed metadata fields are included in this PATCH request.</p>
              <label className="asset-field"><span>Title <em>Optional</em></span><input value={metadataDraft.title} onChange={(event) => setMetadataDraft((current) => ({ ...current, title: event.target.value }))} /></label>
              <label className="asset-field"><span>Alt text <em>Optional</em><small>{metadataDraft.altText.length}/255</small></span><input value={metadataDraft.altText} maxLength={255} onChange={(event) => setMetadataDraft((current) => ({ ...current, altText: event.target.value }))} /><small>Maximum 255 characters.</small></label>
              <label className="asset-field"><span>Category <em>Optional</em></span><select value={metadataDraft.category} onChange={(event) => setMetadataDraft((current) => ({ ...current, category: event.target.value as AssetCategory | "" }))}><option value="">Clear category</option>{categories.map((category) => <option key={category} value={category}>{formatCategory(category)}</option>)}</select></label>
              <label className="asset-field"><span>Description <em>Optional</em></span><textarea rows={3} value={metadataDraft.description} onChange={(event) => setMetadataDraft((current) => ({ ...current, description: event.target.value }))} /></label>
              <details className="asset-payload-preview" open><summary>PATCH request payload preview</summary><pre>{JSON.stringify({ ...(metadataDraft.title !== dialog.asset.title ? { title: metadataDraft.title.trim() || null } : {}), ...(metadataDraft.altText !== (dialog.asset.altText ?? "") ? { altText: metadataDraft.altText.trim() || null } : {}), ...(metadataDraft.category !== dialog.asset.category ? { category: metadataDraft.category || null } : {}), ...(metadataDraft.description !== (dialog.asset.description ?? "") ? { description: metadataDraft.description.trim() || null } : {}) }, null, 2)}</pre></details>
              <DialogFooter busy={busyAction === `metadata:${dialog.asset.assetKey}`} onCancel={closeDialog} onSubmit={() => void submitMetadata(dialog.asset)} submitLabel="Update metadata" />
            </div>}

            {dialog.kind === "delete-image" && <div className="asset-dialog-content">
              <div className="asset-delete-confirm"><AssetImage src={dialog.asset.imageUrl} alt={dialog.asset.altText || dialog.asset.title} /><div><strong>{dialog.asset.assetKey}</strong><span>{dialog.asset.title} · {dialog.asset.imageUrl || "No image URL"}</span><b>The image will be removed; the catalog key remains registered.</b></div></div>
              <DialogFooter busy={busyAction === `delete-image:${dialog.asset.assetKey}`} onCancel={closeDialog} onSubmit={() => void deleteImage(dialog.asset)} submitLabel="Delete image" danger />
            </div>}

            {dialog.kind === "delete-key" && <div className="asset-dialog-content">
              <div className="asset-delete-confirm"><AssetImage src={dialog.asset.imageUrl} alt={dialog.asset.altText || dialog.asset.title} /><div><strong>{dialog.asset.assetKey}</strong><span>{dialog.asset.title} · {formatCategory(dialog.asset.category)}</span><b>This deletes the catalog definition, not necessarily its stored image. The backend may reject deletion if an image is associated.</b></div></div>
              <DialogFooter busy={busyAction === `delete-key:${dialog.asset.assetKey}`} onCancel={closeDialog} onSubmit={() => void deleteCatalogKey(dialog.asset)} submitLabel="Delete catalog key" danger />
            </div>}
          </section>
        </div>
      )}
    </div>
  );
}

function DefinitionFields({
  draft,
  categories,
  loadingCategories,
  showErrors,
  onChange,
  compact = false,
}: {
  draft: CatalogDraft;
  categories: AssetCategory[];
  loadingCategories: boolean;
  showErrors: boolean;
  onChange: (field: keyof Omit<CatalogDraft, "id">, value: string) => void;
  compact?: boolean;
}) {
  const errors = validateDefinition(draft, categories);
  return <div className={`asset-definition-fields ${compact ? "compact" : ""}`}>
    <label className="asset-field"><span>Asset key <b>Required</b><small>{draft.assetKey.length}/100</small></span><input value={draft.assetKey} maxLength={100} onChange={(event) => onChange("assetKey", event.target.value)} placeholder="onboarding_welcome_image" aria-invalid={Boolean(errors.assetKey && (showErrors || draft.assetKey))} /><small>Lowercase letters, numbers, and single underscores; no leading/trailing underscore or consecutive underscores.</small>{errors.assetKey && (showErrors || draft.assetKey) && <small className="asset-field-error">{errors.assetKey}</small>}</label>
    <label className="asset-field asset-title-field"><span>Title <b>Required</b><small>{draft.title.length}/150</small></span><input className="asset-title-input" value={draft.title} maxLength={150} onChange={(event) => onChange("title", event.target.value)} aria-invalid={Boolean(errors.title && (showErrors || draft.title))} />{errors.title && (showErrors || draft.title) && <small className="asset-field-error">{errors.title}</small>}</label>
    <label className="asset-field"><span>Category <b>Required</b></span><select value={draft.category} disabled={loadingCategories} onChange={(event) => onChange("category", event.target.value)}><option value="">{loadingCategories ? "Loading categories…" : "Select category"}</option>{categories.map((category) => <option key={category} value={category}>{formatCategory(category)}</option>)}</select>{errors.category && (showErrors || draft.category) && <small className="asset-field-error">{errors.category}</small>}</label>
    <label className="asset-field"><span>Alt text <em>Optional</em><small>{draft.altText.length}/255</small></span><input value={draft.altText} maxLength={255} onChange={(event) => onChange("altText", event.target.value)} aria-invalid={Boolean(errors.altText)} />{errors.altText && <small className="asset-field-error">{errors.altText}</small>}</label>
    <label className="asset-field full"><span>Description <em>Optional</em></span><textarea rows={compact ? 2 : 3} value={draft.description} onChange={(event) => onChange("description", event.target.value)} /></label>
  </div>;
}

function DialogFooter({
  busy,
  onCancel,
  onSubmit,
  submitLabel,
  disabled = false,
  danger = false,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return <footer className="asset-dialog-footer">
    <button type="button" className="asset-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
    <button type="button" className={danger ? "asset-danger" : "asset-primary"} disabled={busy || disabled} onClick={onSubmit}>{busy ? <LoaderCircle size={15} className="asset-spin" /> : danger ? <Trash2 size={14} /> : <Check size={14} />}{busy ? "Working…" : submitLabel}</button>
  </footer>;
}
