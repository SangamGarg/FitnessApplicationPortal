import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle, Check, ChevronDown, Clipboard, Clock3, FileJson, Image as ImageIcon,
  LoaderCircle, Plus, RefreshCw, Search, Trash2, Upload, Video, X,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperGameManagement.css";

const BASE = "/api/v1/portal/dev/gamification/games";
const GAME_TYPES = [
  "SQUAT_CHALLENGE", "PUSH_UP_CHALLENGE", "JUMPING_JACK_CHALLENGE",
  "LUNGE_CHALLENGE", "PLANK_CHALLENGE", "POSITION_HOLD_CHALLENGE",
] as const;
const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const DURATION_UNITS = ["SECOND", "MINUTE"] as const;
type GameType = typeof GAME_TYPES[number];
type GameLevel = typeof LEVELS[number];
type DurationUnit = typeof DURATION_UNITS[number];
type Game = {
  id: number;
  gameType: GameType;
  title: string;
  subTitle: string | null;
  description: string;
  imageUrl: string | null;
  level: GameLevel;
  totalRepsRequired: number | null;
  durationValue: number;
  durationUnit: DurationUnit;
  paid: boolean;
  entryFeeCoins: number;
  rewardCoins: number;
  rewardXp: number;
  maxRepsPerMinute: number;
  releasedAt: string | null;
  displayOrder: number;
  active: boolean;
  gifUrl: string | null;
  videoUrl: string | null;
  rules: string[];
  tips: string[];
  createdAt: string;
};
type GameRequest = {
  gameType?: GameType;
  title?: string;
  subTitle?: string | null;
  description?: string;
  level?: GameLevel;
  totalRepsRequired?: number | null;
  durationValue?: number;
  durationUnit?: DurationUnit;
  paid?: boolean;
  entryFeeCoins?: number;
  rewardCoins?: number;
  rewardXp?: number;
  maxRepsPerMinute?: number;
  releasedAt?: string | null;
  displayOrder?: number;
  rules?: string[];
  tips?: string[];
};
type ApiRecord = {
  operation: string;
  method: string;
  endpoint: string;
  timestamp: string;
  durationMs: number;
  status: number | null;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseContentType?: string | null;
  ok: boolean;
  request: unknown;
  response: unknown;
  error?: string;
};
type Result = { record: ApiRecord; data: unknown };
type GameForm = {
  gameType: string; title: string; subTitle: string; description: string; level: string;
  totalRepsRequired: string; durationValue: string; durationUnit: string; paid: boolean;
  entryFeeCoins: string; rewardCoins: string; rewardXp: string; maxRepsPerMinute: string;
  releasedAt: string; displayOrder: string; rules: string[]; tips: string[];
};
type GameField = keyof Omit<GameForm, "rules" | "tips">;
type SelectedField = GameField | "rules" | "tips";
type MediaKey = "image" | "gif" | "video";
type MediaFiles = Record<MediaKey, File | null>;
type FieldInfo = { key: GameField; label: string; help: string; required?: boolean; kind?: "number" | "date" | "select" | "textarea" };
const FIELDS: FieldInfo[] = [
  { key: "gameType", label: "Game type", required: true, help: "Select one supported game type.", kind: "select" },
  { key: "title", label: "Title", required: true, help: "Required. Maximum 120 characters." },
  { key: "subTitle", label: "Subtitle", help: "Optional. Maximum 200 characters." },
  { key: "description", label: "Description", required: true, help: "Required. Maximum 1000 characters.", kind: "textarea" },
  { key: "level", label: "Difficulty level", required: true, help: "Select the game level.", kind: "select" },
  { key: "totalRepsRequired", label: "Total reps required", help: "Optional. Leave blank for null.", kind: "number" },
  { key: "durationValue", label: "Duration value", required: true, help: "Required. Whole number of at least 1.", kind: "number" },
  { key: "durationUnit", label: "Duration unit", required: true, help: "Backend enum: SECOND or MINUTE.", kind: "select" },
  { key: "paid", label: "Paid game", help: "When enabled, entry fee applies." },
  { key: "entryFeeCoins", label: "Entry fee (coins)", help: "Non-negative whole number.", kind: "number" },
  { key: "rewardCoins", label: "Reward coins", help: "Non-negative whole number.", kind: "number" },
  { key: "rewardXp", label: "Reward XP", help: "Non-negative whole number.", kind: "number" },
  { key: "maxRepsPerMinute", label: "Max reps per minute", required: true, help: "Non-negative whole number.", kind: "number" },
  { key: "releasedAt", label: "Release date and time", help: "Optional local date/time; sent as a UTC Instant.", kind: "date" },
  { key: "displayOrder", label: "Display order", help: "Non-negative whole number.", kind: "number" },
];
const freshForm = (): GameForm => ({
  gameType: "", title: "", subTitle: "", description: "", level: "",
  totalRepsRequired: "", durationValue: "1", durationUnit: "MINUTE", paid: false,
  entryFeeCoins: "0", rewardCoins: "0", rewardXp: "0", maxRepsPerMinute: "0",
  releasedAt: "", displayOrder: "0", rules: [], tips: [],
});
const emptyMedia = (): MediaFiles => ({ image: null, gif: null, video: null });
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const nullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

function isGame(value: unknown): value is Game {
  return isObject(value)
    && typeof value.id === "number"
    && (GAME_TYPES as readonly unknown[]).includes(value.gameType)
    && typeof value.title === "string"
    && nullableString(value.subTitle)
    && typeof value.description === "string"
    && nullableString(value.imageUrl)
    && (LEVELS as readonly unknown[]).includes(value.level)
    && (value.totalRepsRequired === null || typeof value.totalRepsRequired === "number")
    && typeof value.durationValue === "number"
    && (DURATION_UNITS as readonly unknown[]).includes(value.durationUnit)
    && typeof value.paid === "boolean"
    && typeof value.entryFeeCoins === "number"
    && typeof value.rewardCoins === "number"
    && typeof value.rewardXp === "number"
    && typeof value.maxRepsPerMinute === "number"
    && nullableString(value.releasedAt)
    && typeof value.displayOrder === "number"
    && typeof value.active === "boolean"
    && nullableString(value.gifUrl)
    && nullableString(value.videoUrl)
    && Array.isArray(value.rules) && value.rules.every((item) => typeof item === "string")
    && Array.isArray(value.tips) && value.tips.every((item) => typeof item === "string")
    && typeof value.createdAt === "string";
}
function normalizeGames(value: unknown): Game[] | null {
  let candidate = value;
  for (let depth = 0; depth < 3 && isObject(candidate); depth += 1) {
    if (Array.isArray(candidate)) break;
    if (Array.isArray(candidate.content)) { candidate = candidate.content; break; }
    if (Array.isArray(candidate.games)) { candidate = candidate.games; break; }
    if ("data" in candidate) candidate = candidate.data;
    else if ("result" in candidate) candidate = candidate.result;
    else break;
  }
  return Array.isArray(candidate) && candidate.every(isGame) ? candidate : null;
}
async function decode(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}
function errorText(data: unknown, fallback: string): string {
  if (typeof data === "string") return data.split(/\r?\n\s*at\s+/)[0].trim();
  if (isObject(data)) for (const key of ["detail", "message", "error", "title"]) {
    if (typeof data[key] === "string") return String(data[key]).split(/\r?\n\s*at\s+/)[0].trim();
  }
  return fallback;
}
function humanize(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function toLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function toInstant(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function localDate(value: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid date";
}
function gameForm(game?: Game): GameForm {
  if (!game) return freshForm();
  return {
    gameType: game.gameType, title: game.title, subTitle: game.subTitle ?? "", description: game.description,
    level: game.level, totalRepsRequired: game.totalRepsRequired == null ? "" : String(game.totalRepsRequired),
    durationValue: String(game.durationValue), durationUnit: game.durationUnit, paid: game.paid,
    entryFeeCoins: String(game.entryFeeCoins), rewardCoins: String(game.rewardCoins), rewardXp: String(game.rewardXp),
    maxRepsPerMinute: String(game.maxRepsPerMinute), releasedAt: toLocal(game.releasedAt),
    displayOrder: String(game.displayOrder), rules: [...game.rules], tips: [...game.tips],
  };
}
function validateGameField(field: GameField, form: GameForm): string {
  if (field === "paid") return "";
  const value = form[field];
  if (field === "gameType") return (GAME_TYPES as readonly string[]).includes(value) ? "" : "Select a valid game type.";
  if (field === "level") return (LEVELS as readonly string[]).includes(value) ? "" : "Select a valid difficulty level.";
  if (field === "durationUnit") return (DURATION_UNITS as readonly string[]).includes(value) ? "" : "Select SECOND or MINUTE.";
  if (field === "title") return !value.trim() ? "Title is required." : value.length > 120 ? "Maximum 120 characters." : "";
  if (field === "subTitle") return value.length > 200 ? "Maximum 200 characters." : "";
  if (field === "description") return !value.trim() ? "Description is required." : value.length > 1000 ? "Maximum 1000 characters." : "";
  if (field === "totalRepsRequired") return value && (!/^[1-9]\d*$/.test(value) || Number(value) > Number.MAX_SAFE_INTEGER) ? "Enter a positive whole number or leave blank." : "";
  if (field === "durationValue") return !/^[1-9]\d*$/.test(value) ? "Enter a whole number greater than or equal to 1." : "";
  if (["entryFeeCoins", "rewardCoins", "rewardXp", "maxRepsPerMinute", "displayOrder"].includes(field)) {
    return !/^\d+$/.test(value) ? "Enter a non-negative whole number." : Number(value) > Number.MAX_SAFE_INTEGER ? "Value is too large." : "";
  }
  if (field === "releasedAt") return value && !toInstant(value) ? "Select a valid date and time." : "";
  return "";
}
function fullRequest(form: GameForm): GameRequest {
  return {
    gameType: form.gameType as GameType,
    title: form.title.trim(),
    subTitle: form.subTitle.trim() || undefined,
    description: form.description.trim(),
    level: form.level as GameLevel,
    totalRepsRequired: form.totalRepsRequired.trim() ? Number(form.totalRepsRequired) : null,
    durationValue: Number(form.durationValue),
    durationUnit: form.durationUnit as DurationUnit,
    paid: form.paid,
    entryFeeCoins: Number(form.entryFeeCoins),
    rewardCoins: Number(form.rewardCoins),
    rewardXp: Number(form.rewardXp),
    maxRepsPerMinute: Number(form.maxRepsPerMinute),
    releasedAt: toInstant(form.releasedAt),
    displayOrder: Number(form.displayOrder),
    rules: form.rules.map((item) => item.trim()).filter(Boolean),
    tips: form.tips.map((item) => item.trim()).filter(Boolean),
  };
}
function toPatch(form: GameForm, selected: Set<SelectedField>, gameType: GameType): GameRequest {
  const payload: GameRequest = {};
  for (const field of selected) {
    if (field === "gameType") payload.gameType = gameType;
    else if (field === "title") payload.title = form.title.trim();
    else if (field === "subTitle") payload.subTitle = form.subTitle.trim();
    else if (field === "description") payload.description = form.description.trim();
    else if (field === "level") payload.level = form.level as GameLevel;
    else if (field === "totalRepsRequired") payload.totalRepsRequired = form.totalRepsRequired.trim() ? Number(form.totalRepsRequired) : null;
    else if (field === "durationValue") payload.durationValue = Number(form.durationValue);
    else if (field === "durationUnit") payload.durationUnit = form.durationUnit as DurationUnit;
    else if (field === "paid") payload.paid = form.paid;
    else if (field === "entryFeeCoins") payload.entryFeeCoins = Number(form.entryFeeCoins);
    else if (field === "rewardCoins") payload.rewardCoins = Number(form.rewardCoins);
    else if (field === "rewardXp") payload.rewardXp = Number(form.rewardXp);
    else if (field === "maxRepsPerMinute") payload.maxRepsPerMinute = Number(form.maxRepsPerMinute);
    else if (field === "releasedAt") payload.releasedAt = toInstant(form.releasedAt);
    else if (field === "displayOrder") payload.displayOrder = Number(form.displayOrder);
  }
  if (selected.has("rules")) payload.rules = form.rules.map((item) => item.trim()).filter(Boolean);
  if (selected.has("tips")) payload.tips = form.tips.map((item) => item.trim()).filter(Boolean);
  return payload;
}
function sizeLabel(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function mediaFileError(key: MediaKey, file: File | null): string {
  if (!file) return "";
  if (file.size === 0) return "Selected file is empty.";
  if (key === "image" && !file.type.startsWith("image/")) return "Choose an image file.";
  if (key === "gif" && file.type !== "image/gif" && !file.name.toLowerCase().endsWith(".gif")) return "Choose a GIF file.";
  if (key === "video" && !file.type.startsWith("video/")) return "Choose a video file.";
  return "";
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); if (timer.current !== null) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setCopied(false), 1400); }
    catch { setCopied(false); }
  }
  return <button type="button" className="game-icon-button" aria-label={copied ? "Copied" : label} title={copied ? "Copied" : label} onClick={() => void copy()}>{copied ? <Check size={13} /> : <Clipboard size={13} />}</button>;
}
function SafeMedia({ src, kind, alt }: { src: string | null; kind: "image" | "gif" | "video"; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="game-media-fallback"><ImageIcon size={18} />Unavailable</span>;
  let validUrl = "";
  try { const url = new URL(src, window.location.origin); if (url.protocol === "http:" || url.protocol === "https:") validUrl = url.href; } catch { /* Invalid API media URL */ }
  if (!validUrl) return <span className="game-media-fallback"><ImageIcon size={18} />Unavailable</span>;
  if (kind === "video") return <video src={validUrl} controls preload="metadata" onError={() => setFailed(true)} aria-label={alt} />;
  return <img src={validUrl} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function MediaInput({ kind, file, existingUrl, onChange, error }: {
  kind: MediaKey;
  file: File | null;
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const objectUrl = useRef<string | null>(null);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  function choose(candidate: File | null) {
    const message = mediaFileError(kind, candidate);
    setSelectionError(message);
    if (message) {
      onChange(null);
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = candidate ? URL.createObjectURL(candidate) : null;
    setPreviewUrl(objectUrl.current ?? "");
    onChange(candidate);
  }
  const accept = kind === "image" ? "image/*" : kind === "gif" ? "image/gif,.gif" : "video/*";
  return (
    <div className={`game-media-input ${error ? "invalid" : ""}`}>
      <header><span>{kind === "image" ? <ImageIcon size={14} /> : kind === "gif" ? <ImageIcon size={14} /> : <Video size={14} />}{kind === "image" ? "Image" : kind === "gif" ? "GIF" : "Video"} {existingUrl && !file ? "· existing media retained" : ""}</span><small>{file ? `${file.name} · ${sizeLabel(file.size)}` : kind === "image" || kind === "gif" || kind === "video" ? "Required for create" : "Optional replacement"}</small></header>
      <div className="game-media-preview">{file ? kind === "video" ? <video src={previewUrl} controls preload="metadata" /> : <img src={previewUrl} alt={`${kind} upload preview`} /> : existingUrl ? <SafeMedia src={existingUrl} kind={kind} alt={`Existing ${kind}`} /> : <span className="game-media-fallback"><Upload size={16} />No {kind} selected</span>}</div>
      <div className="game-media-buttons"><label className="game-secondary">{file ? "Replace" : existingUrl ? "Replace media" : "Select file"}<input type="file" accept={accept} onChange={(event) => { choose(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} /></label>{file && <button type="button" className="game-text-button" onClick={() => choose(null)}>Remove selection</button>}</div>
      <small className={`game-field-message ${error || selectionError ? "error" : ""}`}>{error || selectionError || (kind === "gif" ? "GIF files only. No undocumented size limit is enforced." : kind === "image" ? "Image files only. No undocumented size limit is enforced." : "Video files only. No undocumented size limit is enforced.")}</small>
    </div>
  );
}

function GameForm({ game, run, onClose, onSaved }: {
  game: Game | null;
  run: (operation: string, method: string, endpoint: string, payload?: unknown) => Promise<Result>;
  onClose: () => void;
  onSaved: (record: ApiRecord) => void;
}) {
  const editing = Boolean(game);
  const [form, setForm] = useState(() => gameForm(game ?? undefined));
  const [files, setFiles] = useState<MediaFiles>(emptyMedia);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [partial, setPartial] = useState(false);
  const [selected, setSelected] = useState<Set<SelectedField>>(() => new Set());
  const [showPreview, setShowPreview] = useState(false);
  const allFieldKeys = FIELDS.map((field) => field.key);
  const payload = useMemo(() => partial && game ? toPatch(form, selected, game.gameType) : fullRequest(form), [partial, form, selected, game]);
  function update(field: GameField, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }
  function fieldError(field: GameField): string {
    if (partial && !selected.has(field)) return "";
    if (!submitted && !touched.has(field)) return "";
    return errors[field] || validateGameField(field, form);
  }
  function validate(): boolean {
    setSubmitted(true);
    const next: Record<string, string> = {};
    const keys: SelectedField[] = partial ? [...selected] : allFieldKeys;
    for (const field of keys) {
      if (field === "rules" || field === "tips") {
        const values = form[field];
        if (values.some((value) => !value.trim())) next[field] = `Remove blank ${field} entries or fill them in.`;
        continue;
      }
      const error = validateGameField(field, form);
      if (error) next[field] = error;
    }
    if (!editing) {
      (["image", "gif", "video"] as const).forEach((key) => {
        const error = mediaFileError(key, files[key]);
        if (error) next[key] = error;
        else if (!files[key]) next[key] = `${key.toUpperCase()} file is required.`;
      });
    } else {
      (["image", "gif", "video"] as const).forEach((key) => {
        const error = mediaFileError(key, files[key]);
        if (error) next[key] = error;
      });
    }
    const rules = form.rules.map((value) => value.trim());
    const tips = form.tips.map((value) => value.trim());
    if ((!partial || selected.has("rules")) && rules.some((value) => !value)) next.rules = "Remove blank rule entries or fill them in.";
    if ((!partial || selected.has("tips")) && tips.some((value) => !value)) next.tips = "Remove blank tip entries or fill them in.";
    setErrors(next);
    return Object.keys(next).length === 0 && (!partial || selected.size > 0);
  }
  function toggleField(field: SelectedField) {
    setSelected((current) => { const next = new Set(current); if (next.has(field)) next.delete(field); else next.add(field); return next; });
  }
  function setMedia(key: MediaKey, file: File | null) {
    setFiles((current) => ({ ...current, [key]: file }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }
  function updateList(key: "rules" | "tips", index: number, value: string) {
    setForm((current) => ({ ...current, [key]: current[key].map((entry, row) => row === index ? value : entry) }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }
  function addList(key: "rules" | "tips") {
    setForm((current) => ({ ...current, [key]: [...current[key], ""] }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }
  function removeList(key: "rules" | "tips", index: number) {
    setForm((current) => ({ ...current, [key]: current[key].filter((_, row) => row !== index) }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    const body = new FormData();
    const request = partial && game ? toPatch(form, selected, game.gameType) : fullRequest(form);
    body.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
    (["image", "gif", "video"] as const).forEach((key) => { if (files[key]) body.append(key, files[key] as File); });
    const endpoint = editing ? `${BASE}/${encodeURIComponent(game?.gameType ?? "")}` : BASE;
    const result = await run(editing ? partial ? "Patch game" : "Update game" : "Create game", editing ? "PATCH" : "POST", endpoint, body);
    setBusy(false);
    if (result.record.ok) {
      onSaved(result.record);
      onClose();
    } else {
      const data = isObject(result.data) && isObject(result.data.errors) ? result.data.errors : result.data;
      if (isObject(data)) {
        const next: Record<string, string> = {};
        FIELDS.forEach((field) => {
          const value = data[field.key];
          if (typeof value === "string") next[field.key] = value;
        });
        setErrors(next);
        setSubmitted(true);
      }
    }
  }
  function changeField(field: GameField, value: string | boolean) {
    update(field, value);
  }
  return (
    <div className="game-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form className="game-modal game-form-modal" onSubmit={(event) => void submit(event)} noValidate>
        <header className="game-modal-header"><div><span className="game-overline">{editing ? partial ? "PATCH · SELECTED CHANGES" : "PATCH · GAME CONFIGURATION" : "POST · MULTIPART UPLOAD"}</span><h2>{editing ? partial ? `Edit ${game?.title} selectively` : `Edit ${game?.title}` : "Create game"}</h2><p>{editing ? "Media parts are optional; unchanged media is retained." : "Request JSON, image, GIF, and video are required by the create contract."}</p></div><button type="button" className="game-icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={15} /></button></header>
        {editing && <div className="game-edit-mode"><button type="button" className={!partial ? "selected" : ""} disabled={busy} onClick={() => setPartial(false)}>Edit game</button><button type="button" className={partial ? "selected" : ""} disabled={busy} onClick={() => { setSelected(new Set()); setPartial(true); }}>Partial update</button><span>Game Type is the identity key and cannot be changed while editing.</span></div>}
        <div className="game-fields">
          {FIELDS.map((field) => {
            const error = fieldError(field.key);
            return <div key={field.key} className={`game-field ${field.key === "title" || field.key === "description" ? "wide" : ""} ${error ? "invalid" : ""}`}>
              <div className="game-field-label">
                {partial && editing && <input type="checkbox" checked={selected.has(field.key)} disabled={busy || field.key === "gameType"} aria-label={`Include ${field.label} in patch`} onChange={() => toggleField(field.key)} />}
                <label htmlFor={`game-${field.key}`}>{field.label}{field.required && !partial ? " *" : ""}</label>
                {field.key === "title" && <span>{form.title.length}/120</span>}
                {field.key === "subTitle" && <span>{form.subTitle.length}/200</span>}
                {field.key === "description" && <span>{form.description.length}/1000</span>}
              </div>
              {field.key === "paid" ? <label className="game-paid-toggle"><input id={`game-${field.key}`} type="checkbox" checked={form.paid} disabled={busy || (partial && !selected.has(field.key))} onChange={(event) => changeField(field.key, event.target.checked)} /><span>Entry fee applies</span></label>
                : field.kind === "select" ? <select id={`game-${field.key}`} value={form[field.key]} disabled={busy || (editing && field.key === "gameType") || (partial && !selected.has(field.key))} onChange={(event) => changeField(field.key, event.target.value)} onBlur={() => setTouched((current) => new Set(current).add(field.key))}>
                  <option value="">Select {field.label.toLowerCase()}</option>{(field.key === "gameType" ? GAME_TYPES : field.key === "level" ? LEVELS : DURATION_UNITS).map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
                </select>
                : field.kind === "textarea" ? <textarea id={`game-${field.key}`} maxLength={1000} value={form.description} disabled={busy || (partial && !selected.has(field.key))} onChange={(event) => changeField(field.key, event.target.value)} onBlur={() => setTouched((current) => new Set(current).add(field.key))} />
                  : <input id={`game-${field.key}`} type={field.kind === "number" ? "number" : field.kind === "date" ? "datetime-local" : "text"} min={field.key === "durationValue" ? 1 : field.kind === "number" ? 0 : undefined} step={field.kind === "number" ? 1 : undefined} maxLength={field.key === "title" ? 120 : field.key === "subTitle" ? 200 : undefined} value={form[field.key]} disabled={busy || (partial && !selected.has(field.key))} onChange={(event) => changeField(field.key, event.target.value)} onBlur={() => setTouched((current) => new Set(current).add(field.key))} />}
              <small className={error ? "game-field-error" : ""}>{error || field.help}</small>
            </div>;
          })}
        </div>
        <div className="game-dynamic-lists">
          {(["rules", "tips"] as const).map((key) => <section key={key} className={partial && !selected.has(key) ? "disabled" : ""}>
            <header><strong>{humanize(key)}</strong>{partial && <label><input type="checkbox" checked={selected.has(key)} disabled={busy} onChange={() => toggleField(key)} /> Include in PATCH</label>}<button type="button" className="game-small-button" disabled={busy || (partial && !selected.has(key))} onClick={() => addList(key)}><Plus size={12} /> Add</button></header>
            {!form[key].length && <small className="game-helper">No {key} provided.</small>}
            {form[key].map((value, index) => <div className="game-list-row" key={`${key}-${index}`}><span>{index + 1}</span><input value={value} disabled={busy || (partial && !selected.has(key))} aria-label={`${humanize(key)} ${index + 1}`} onChange={(event) => updateList(key, index, event.target.value)} /><button type="button" className="game-icon-button danger" disabled={busy || (partial && !selected.has(key))} aria-label={`Remove ${key} ${index + 1}`} onClick={() => removeList(key, index)}><Trash2 size={12} /></button></div>)}
            {errors[key] && submitted && <small className="game-field-error">{errors[key]}</small>}
          </section>)}
        </div>
        <div className="game-media-grid">
          <MediaInput kind="image" file={files.image} existingUrl={game?.imageUrl} onChange={(file) => setMedia("image", file)} error={errors.image} />
          <MediaInput kind="gif" file={files.gif} existingUrl={game?.gifUrl} onChange={(file) => setMedia("gif", file)} error={errors.gif} />
          <MediaInput kind="video" file={files.video} existingUrl={game?.videoUrl} onChange={(file) => setMedia("video", file)} error={errors.video} />
        </div>
        <section className="game-payload-preview"><header><strong>{partial ? "PATCH request preview" : "Request payload preview"}</strong><button type="button" className="game-text-button" onClick={() => setShowPreview((open) => !open)}>{showPreview ? "Hide" : "Show"} JSON <ChevronDown size={12} /></button></header>{showPreview && <><CopyButton value={JSON.stringify(payload, null, 2)} label="Copy request JSON" /><pre>{JSON.stringify(payload, null, 2)}</pre><div className="game-preview-files"><strong>Multipart files</strong>{(["image", "gif", "video"] as const).map((key) => <span key={key}>{key}: {files[key] ? `${files[key]?.name} · ${sizeLabel(files[key]?.size ?? 0)}` : editing ? "unchanged" : "not selected"}</span>)}</div></>}</section>
        <footer className="game-form-footer"><button type="button" className="game-secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="game-primary" disabled={busy || (partial && selected.size === 0)}>{busy && <LoaderCircle className="game-spin" size={13} />}{editing ? partial ? "Send PATCH" : "Save changes" : "Create game"}</button></footer>
      </form>
    </div>
  );
}

function ApiInspector({ record, history, pending, onClear, onSelect }: {
  record: ApiRecord | null; history: ApiRecord[]; pending: boolean; onClear: () => void; onSelect: (record: ApiRecord) => void;
}) {
  return <section className="game-panel game-inspector">
    <header className="game-panel-header"><div><h2><FileJson size={14} /> Game API inspector</h2><p>Actual game requests and backend responses for this session.</p></div><div className="game-inspector-actions">{pending && <span><LoaderCircle className="game-spin" size={11} /> Pending</span>}<button type="button" className="game-text-button" disabled={!history.length} onClick={onClear}>Clear history</button></div></header>
    {!record ? <div className="game-inspector-empty">No game API operations recorded.</div> : <details open>
      <summary><span className={`game-http ${record.ok ? "ok" : record.status == null ? "pending" : "bad"}`}>{record.status == null ? "Network error" : `HTTP ${record.status}`}</span><b>{record.method}</b><code>{record.endpoint}</code><ChevronDown size={13} /></summary>
      <div className="game-inspector-meta"><span>{record.operation}</span><span>{new Date(record.timestamp).toLocaleString()}</span><span>{record.durationMs} ms</span><CopyButton value={record.endpoint} label="Copy endpoint" /></div>
      {record.error && <p className="game-api-error">{record.error}</p>}
      <details className="game-transport-details"><summary>Transport metadata <ChevronDown size={11} /></summary><div><span>Request headers (sensitive headers omitted)</span><pre>{JSON.stringify(record.requestHeaders ?? {}, null, 2)}</pre><span>Response status text: {record.statusText || "Not available"}</span><span>Response content type: {record.responseContentType || "Not provided"}</span><span>Response headers (safe subset)</span><pre>{JSON.stringify(record.responseHeaders ?? {}, null, 2)}</pre></div></details>
      <div className="game-json-panes"><section><header><b>Request</b><CopyButton value={JSON.stringify(record.request, null, 2)} label="Copy request" /></header><pre>{record.request == null ? "No request body." : JSON.stringify(record.request, null, 2)}</pre></section><section><header><b>Response</b><CopyButton value={record.response == null ? record.status === 204 ? "204 No Content" : "null" : JSON.stringify(record.response, null, 2)} label="Copy response" /></header><pre>{record.response == null ? record.status === 204 ? "204 No Content" : "Empty response body." : typeof record.response === "string" ? record.response : JSON.stringify(record.response, null, 2)}</pre></section></div>
    </details>}
    {history.length > 1 && <details className="game-history"><summary>Recent requests ({history.length}) <ChevronDown size={12} /></summary><ol>{history.slice(1).map((item, index) => <li key={`${item.timestamp}-${index}`}><button type="button" onClick={() => onSelect(item)}><span className={`game-http ${item.ok ? "ok" : item.status == null ? "pending" : "bad"}`}>{item.status ?? "—"}</span><b>{item.method}</b><code>{item.endpoint}</code><time>{new Date(item.timestamp).toLocaleTimeString()}</time></button></li>)}</ol></details>}
  </section>;
}

export default function DeveloperGameManagement() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState<Game | true | false>(false);
  const [details, setDetails] = useState<Game | null>(null);
  const [deleting, setDeleting] = useState<Game | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Game | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [inspector, setInspector] = useState<ApiRecord | null>(null);
  const [history, setHistory] = useState<ApiRecord[]>([]);
  const [pending, setPending] = useState(0);
  const mounted = useRef(true);
  const loadId = useRef(0);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 250); return () => window.clearTimeout(timer); }, [search]);

  const run = useCallback(async (operation: string, method: string, endpoint: string, payload?: unknown): Promise<Result> => {
    const timestamp = new Date().toISOString();
    const started = performance.now();
    if (mounted.current) setPending((count) => count + 1);
    let response: Response | null = null;
    let data: unknown = null;
    let error = "";
    let requestBody: unknown = payload ?? null;
    const isMultipart = payload instanceof FormData;
    const requestHeaders = {
      Accept: "application/json",
      ...(payload === undefined ? {} : { "Content-Type": isMultipart ? "multipart/form-data (boundary generated by browser)" : "application/json" }),
    };
    let responseHeaders: Record<string, string> = {};
    let responseContentType: string | null = null;
    try {
      if (payload instanceof FormData) {
        const part = payload.get("request");
        let json: unknown = null;
        if (part instanceof Blob) {
          const text = await part.text();
          try { json = JSON.parse(text) as unknown; } catch { json = text; }
        }
        requestBody = {
          request: json,
          files: (["image", "gif", "video"] as const).flatMap((field) => {
            const file = payload.get(field);
            return file instanceof File ? [{ field, name: file.name, type: file.type, sizeBytes: file.size }] : [];
          }),
        };
      }
      response = await portalFetch(endpoint, {
        method,
        headers: payload === undefined ? { Accept: "application/json" } : { Accept: "application/json", ...(isMultipart ? {} : { "Content-Type": "application/json" }) },
        ...(payload !== undefined ? { body: isMultipart ? payload : JSON.stringify(payload) } : {}),
      });
      data = await decode(response);
      if (!response.ok) error = `HTTP ${response.status}: ${errorText(data, response.statusText || "Request failed.")}`;
      const safeResponseHeaders: Record<string, string> = {};
      for (const header of ["content-type", "cache-control", "date", "etag", "last-modified", "x-request-id"]) {
        const value = response.headers.get(header);
        if (value) safeResponseHeaders[header] = value;
      }
      responseHeaders = safeResponseHeaders;
      responseContentType = response.headers.get("content-type");
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "The request failed before an HTTP response was received.";
    }
    const record: ApiRecord = {
      operation, method, endpoint, timestamp, durationMs: Math.round(performance.now() - started),
      status: response?.status ?? null, ok: Boolean(response?.ok), request: requestBody, response: data,
      statusText: response?.statusText || "",
      requestHeaders,
      responseHeaders: response ? responseHeaders : {},
      responseContentType,
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

  const loadGames = useCallback(async () => {
    const requestId = ++loadId.current;
    setLoading(true);
    setLoadError("");
    const result = await run("Get games", "GET", BASE);
    if (!mounted.current || requestId !== loadId.current) return;
    setLoading(false);
    if (!result.record.ok) { setGames([]); setLoadError(result.record.error || "Unable to load games."); return; }
    const list = normalizeGames(result.data);
    if (!list) { setGames([]); setLoadError("The games response did not match the expected game list."); return; }
    setGames(list);
    setDetails((current) => current ? list.find((game) => game.gameType === current.gameType) ?? current : null);
  }, [run]);
  useEffect(() => { const timer = window.setTimeout(() => void loadGames(), 0); return () => window.clearTimeout(timer); }, [loadGames, refresh]);
  const filtered = useMemo(() => {
    const needle = query.toLocaleLowerCase();
    return games.filter((game) => (!needle || [game.title, game.subTitle ?? "", game.description, game.gameType].some((value) => value.toLocaleLowerCase().includes(needle))))
      .filter((game) => !statusFilter || String(game.active) === statusFilter)
      .filter((game) => !levelFilter || game.level === levelFilter)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));
  }, [games, query, statusFilter, levelFilter]);

  async function saved(record: ApiRecord) {
    setNotice({ ok: true, text: `${record.operation} succeeded (HTTP ${record.status}).` });
    await loadGames();
  }
  async function toggleStatus(game: Game) {
    if (statusBusy) return;
    setStatusBusy(game.gameType);
    const active = !game.active;
    const endpoint = `${BASE}/${encodeURIComponent(game.gameType)}/status?active=${active}`;
    const result = await run(active ? "Activate game" : "Update game status", "PATCH", endpoint);
    setStatusBusy(null);
    if (result.record.ok) {
      setNotice({ ok: true, text: `${game.title} ${active ? "activated" : "deactivated"} (HTTP ${result.record.status}).` });
      await loadGames();
    }
  }
  async function deactivate() {
    if (!deactivateTarget || deactivateBusy) return;
    setDeactivateBusy(true);
    const game = deactivateTarget;
    const result = await run("Deactivate game", "PATCH", `${BASE}/${encodeURIComponent(game.gameType)}/deactivate`);
    setDeactivateBusy(false);
    if (result.record.ok) {
      setDeactivateTarget(null);
      setNotice({ ok: true, text: `${game.title} deactivated (HTTP ${result.record.status}).` });
      await loadGames();
    }
  }
  async function deleteGame() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    const game = deleting;
    const result = await run("Delete game", "DELETE", `${BASE}/${encodeURIComponent(game.gameType)}`);
    setDeleteBusy(false);
    if (result.record.ok) {
      setDeleting(null);
      if (details?.gameType === game.gameType) setDetails(null);
      setNotice({ ok: true, text: `${game.title} deleted (HTTP ${result.record.status}).` });
      await loadGames();
    }
  }
  function openEdit(game: Game) { setModal(game); }
  const selectedGame = modal === true ? null : modal || null;

  return <div className="game-management">
    <header className="game-page-heading"><div><span className="game-kicker">GAMIFICATION / GAMES CATALOG</span><h2>Games</h2><p>Manage game configuration, required media, availability, and rewards through the backend API.</p></div><div className="game-page-actions"><button type="button" className="game-secondary" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={13} /> Refresh</button><button type="button" className="game-primary" onClick={() => setModal(true)}><Plus size={13} /> Create game</button></div></header>
    {notice && <div className={`game-notice ${notice.ok ? "success" : "error"}`} role="status"><span>{notice.ok ? <Check size={14} /> : <AlertCircle size={14} />}{notice.text}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={13} /></button></div>}
    <section className="game-panel">
      <header className="game-panel-header"><div><h3>Game catalog</h3><p>Games returned by the authenticated gamification API.</p></div><span className="game-count">{loading ? "Loading…" : loadError ? "Unavailable" : `${filtered.length} / ${games.length}`}</span></header>
      <div className="game-toolbar"><label className="game-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, subtitle, description or type" /><button type="button" disabled={!search} aria-label="Clear search" onClick={() => setSearch("")}><X size={13} /></button></label><label className="game-filter"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></label><label className="game-filter"><span>Level</span><select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option value="">All levels</option>{LEVELS.map((level) => <option key={level} value={level}>{humanize(level)}</option>)}</select></label></div>
      {loadError ? <div className="game-state error"><AlertCircle size={20} /><strong>Unable to load games</strong><span>{loadError}</span><button type="button" className="game-secondary" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={13} /> Retry</button></div>
        : loading && !games.length ? <div className="game-state"><LoaderCircle className="game-spin" size={18} />Loading games…</div>
          : !games.length ? <div className="game-state"><ImageIcon size={22} /><strong>No games found</strong><span>The backend returned an empty games catalog.</span><button type="button" className="game-primary" onClick={() => setModal(true)}><Plus size={13} /> Create a game</button></div>
            : !filtered.length ? <div className="game-state"><Search size={21} /><strong>No matching games</strong><span>Change the search or filters to see available games.</span></div>
              : <div className="game-table-wrap"><table className="game-table"><thead><tr><th>Game</th><th>Level</th><th>Duration</th><th>Rewards / fee</th><th>Release / order</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((game) => <tr key={game.gameType}><td><button type="button" className="game-title" onClick={() => setDetails(game)}><SafeMedia src={game.imageUrl} kind="image" alt={`${game.title} cover`} /><span><b>{game.title}</b><small>{game.subTitle || humanize(game.gameType)}</small></span></button></td><td>{humanize(game.level)}<small>{game.totalRepsRequired == null ? "No rep target" : `${game.totalRepsRequired} reps`}</small></td><td>{game.durationValue} {game.durationUnit.toLowerCase()}{game.durationValue !== 1 ? "s" : ""}<small>Max {game.maxRepsPerMinute} reps/min</small></td><td><span className="game-reward">{game.rewardCoins} coins · {game.rewardXp} XP</span><small>{game.paid ? `${game.entryFeeCoins} coin entry` : "Free entry"}</small></td><td>{localDate(game.releasedAt)}<small>Order {game.displayOrder}</small></td><td><span className={`game-status ${game.active ? "active" : "inactive"}`}>{game.active ? "Active" : "Inactive"}</span></td><td><div className="game-actions"><button type="button" className="game-action" onClick={() => setDetails(game)}>View</button><button type="button" className="game-action" onClick={() => openEdit(game)}>Edit</button><button type="button" className="game-action" disabled={statusBusy !== null} onClick={() => void toggleStatus(game)}>{statusBusy === game.gameType ? <LoaderCircle className="game-spin" size={12} /> : game.active ? "Set inactive" : "Set active"}</button><button type="button" className="game-action danger" disabled={deactivateBusy || !game.active} title="Use dedicated deactivate endpoint" onClick={() => setDeactivateTarget(game)}>Deactivate API</button><button type="button" className="game-icon-button danger" aria-label={`Delete ${game.title}`} onClick={() => setDeleting(game)}><Trash2 size={12} /></button></div></td></tr>)}</tbody></table></div>}
    </section>
    <ApiInspector record={inspector} history={history} pending={pending > 0} onClear={() => { setInspector(null); setHistory([]); }} onSelect={setInspector} />

    {modal !== false && <GameForm game={selectedGame} run={run} onClose={() => setModal(false)} onSaved={(record) => void saved(record)} />}
    {details && <div className="game-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}><aside className="game-modal game-detail-modal"><header className="game-modal-header"><div><span className="game-overline">GAME DETAILS · ID {details.id} · {details.gameType}</span><h2>{details.title}</h2><p>{details.subTitle || "No subtitle"} · {humanize(details.level)}</p></div><button type="button" className="game-icon-button" aria-label="Close details" onClick={() => setDetails(null)}><X size={14} /></button></header><div className="game-detail-content"><div className="game-detail-media">{details.imageUrl && <div><b>Image</b><SafeMedia src={details.imageUrl} kind="image" alt={`${details.title} image`} /></div>}{details.gifUrl && <div><b>GIF</b><SafeMedia src={details.gifUrl} kind="gif" alt={`${details.title} GIF`} /></div>}{details.videoUrl && <div><b>Video</b><SafeMedia src={details.videoUrl} kind="video" alt={`${details.title} video`} /></div>}</div><p>{details.description}</p><dl><div><dt>Duration</dt><dd>{details.durationValue} {details.durationUnit.toLowerCase()}{details.durationValue !== 1 ? "s" : ""}</dd></div><div><dt>Total reps</dt><dd>{details.totalRepsRequired ?? "—"}</dd></div><div><dt>Paid / entry</dt><dd>{details.paid ? `Paid · ${details.entryFeeCoins} coins` : "Free"}</dd></div><div><dt>Rewards</dt><dd>{details.rewardCoins} coins · {details.rewardXp} XP</dd></div><div><dt>Max reps/minute</dt><dd>{details.maxRepsPerMinute}</dd></div><div><dt>Release date</dt><dd>{localDate(details.releasedAt)}</dd></div><div><dt>Display order</dt><dd>{details.displayOrder}</dd></div><div><dt>Created</dt><dd>{localDate(details.createdAt)}</dd></div><div><dt>Status</dt><dd>{details.active ? "Active" : "Inactive"}</dd></div></dl>{details.rules.length > 0 && <section><h4>Rules</h4><ol>{details.rules.map((rule, index) => <li key={`${index}-${rule}`}>{rule}</li>)}</ol></section>}{details.tips.length > 0 && <section><h4>Tips</h4><ul>{details.tips.map((tip, index) => <li key={`${index}-${tip}`}>{tip}</li>)}</ul></section>}<footer><button type="button" className="game-secondary" onClick={() => { setDetails(null); openEdit(details); }}>Edit game</button><button type="button" className="game-primary" disabled={statusBusy !== null} onClick={() => void toggleStatus(details)}>{statusBusy === details.gameType && <LoaderCircle className="game-spin" size={12} />}{details.active ? "Deactivate" : "Activate"}</button><button type="button" className="game-danger" onClick={() => { setDetails(null); setDeleting(details); }}>Delete game</button></footer></div></aside></div>}
    {deleting && <div className="game-backdrop" role="presentation"><section className="game-modal game-confirm"><button type="button" className="game-icon-button game-close" aria-label="Close delete confirmation" disabled={deleteBusy} onClick={() => setDeleting(null)}><X size={13} /></button><span className="game-confirm-icon"><Trash2 size={18} /></span><h3>Delete game?</h3><p>Delete <strong>{deleting.title}</strong> ({deleting.gameType})? This action cannot be undone.</p><footer><button type="button" className="game-secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="game-danger" disabled={deleteBusy} onClick={() => void deleteGame()}>{deleteBusy && <LoaderCircle className="game-spin" size={12} />}Delete</button></footer></section></div>}
    {deactivateTarget && <div className="game-backdrop" role="presentation"><section className="game-modal game-confirm"><button type="button" className="game-icon-button game-close" aria-label="Close deactivation confirmation" disabled={deactivateBusy} onClick={() => setDeactivateTarget(null)}><X size={13} /></button><span className="game-confirm-icon"><Clock3 size={18} /></span><h3>Deactivate game?</h3><p>This uses the dedicated deactivate endpoint for <strong>{deactivateTarget.title}</strong>. This is separate from changing active status.</p><footer><button type="button" className="game-secondary" disabled={deactivateBusy} onClick={() => setDeactivateTarget(null)}>Cancel</button><button type="button" className="game-danger" disabled={deactivateBusy} onClick={() => void deactivate()}>{deactivateBusy && <LoaderCircle className="game-spin" size={12} />}Deactivate game</button></footer></section></div>}
  </div>;
}
