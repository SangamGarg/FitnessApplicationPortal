import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Clipboard,
  FileJson, Image, LoaderCircle, Plus, RefreshCw, Search, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperNutritionManagement.css";

const BASE = "/api/v1/portal/dev/nutrition";
const FOODS = `${BASE}/foods`;
const RECIPES = `${BASE}/recipes`;
const PAGE_SIZE = 20;

const DietaryPreference = {
  ALL: "ALL", VEG: "VEG", NON_VEG: "NON_VEG", VEGAN: "VEGAN", EGGETARIAN: "EGGETARIAN",
} as const;
type DietaryPreference = typeof DietaryPreference[keyof typeof DietaryPreference];
const RecipeDifficulty = { EASY: "EASY", MEDIUM: "MEDIUM", HARD: "HARD" } as const;
type RecipeDifficulty = typeof RecipeDifficulty[keyof typeof RecipeDifficulty];
const DietFitnessGoal = {
  MUSCLE_GAIN: "MUSCLE_GAIN", MAINTENANCE: "MAINTENANCE", CLEAN_BULKING: "CLEAN_BULKING",
  MAINTAIN_WEIGHT: "MAINTAIN_WEIGHT", MILD_WEIGHT_LOSS: "MILD_WEIGHT_LOSS", WEIGHT_LOSS: "WEIGHT_LOSS",
  EXTREME_WEIGHT_LOSS: "EXTREME_WEIGHT_LOSS", MILD_WEIGHT_GAIN: "MILD_WEIGHT_GAIN",
  WEIGHT_GAIN: "WEIGHT_GAIN", EXTREME_WEIGHT_GAIN: "EXTREME_WEIGHT_GAIN",
} as const;
type DietFitnessGoal = typeof DietFitnessGoal[keyof typeof DietFitnessGoal];

interface FoodItemResponse {
  id: string;
  name: string;
  brand: string | null;
  servingLabel: string;
  servingSizeGrams: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  imageUrl: string | null;
  verified: boolean;
  custom: boolean;
}
function canSaveGeneratedRecipe(recipe: RecipeResponse): boolean {
  const validNumber = (value: number) => Number.isFinite(value) && value >= 0;
  return Boolean(recipe.title.trim())
    && Number.isInteger(recipe.prepTimeMinutes) && (recipe.prepTimeMinutes ?? 0) >= 1 && (recipe.prepTimeMinutes ?? 0) <= 600
    && Number.isInteger(recipe.servings) && recipe.servings >= 1 && recipe.servings <= 30
    && [recipe.calories, recipe.protein, recipe.carbohydrates, recipe.fat].every(validNumber)
    && (recipe.fiber == null || validNumber(recipe.fiber))
    && (recipe.sugar == null || validNumber(recipe.sugar))
    && recipe.ingredients.length > 0 && recipe.ingredients.length <= 40
    && recipe.ingredients.every((item) => item.trim().length > 0 && item.trim().length <= 240)
    && recipe.instructions.length > 0 && recipe.instructions.length <= 40
    && recipe.instructions.every((item) => item.trim().length > 0 && item.trim().length <= 1000)
    && (!recipe.imageUrl || Boolean(safeUrl(recipe.imageUrl)));
}
interface FoodRequest {
  name: string;
  brand?: string | null;
  servingLabel: string;
  servingSizeGrams: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
}
interface RecipeResponse {
  id: string;
  title: string;
  description: string | null;
  prepTimeMinutes: number | null;
  difficulty: RecipeDifficulty;
  dietType: DietaryPreference;
  servings: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  imageUrl: string | null;
  ingredients: string[];
  instructions: string[];
  aiGenerated: boolean;
  nutritionDataStatus: string | null;
  nutritionDisclaimer: string | null;
}
interface RecipeRequest {
  title: string;
  description?: string | null;
  prepTimeMinutes: number;
  difficulty: RecipeDifficulty;
  dietType: DietaryPreference;
  servings: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  imageUrl?: string | null;
  ingredients: string[];
  instructions: string[];
}
interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
interface ApiRecord {
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
}
interface RequestResult<T> { record: ApiRecord; data: T | null }

const emptyPage = <T,>(): PageResponse<T> => ({
  content: [], totalElements: 0, totalPages: 0, size: PAGE_SIZE, number: 0,
  first: true, last: true, empty: true,
});
const emptyFood = () => ({
  name: "", brand: "", servingLabel: "", servingSizeGrams: "", calories: "",
  protein: "", carbohydrates: "", fat: "", fiber: "", sugar: "",
});
const emptyRecipe = () => ({
  title: "", description: "", prepTimeMinutes: "", difficulty: "EASY" as RecipeDifficulty,
  dietType: "ALL" as DietaryPreference, servings: "1", calories: "", protein: "",
  carbohydrates: "", fat: "", fiber: "", sugar: "", imageUrl: "",
  ingredients: [""], instructions: [""],
});
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const isNullableNumber = (value: unknown): value is number | null => value === null || typeof value === "number";
const isFood = (value: unknown): value is FoodItemResponse =>
  isObject(value) && typeof value.id === "string"
  && typeof value.name === "string" && isNullableString(value.brand)
  && typeof value.servingLabel === "string" && typeof value.servingSizeGrams === "number"
  && typeof value.calories === "number" && typeof value.protein === "number"
  && typeof value.carbohydrates === "number" && typeof value.fat === "number"
  && isNullableNumber(value.fiber) && isNullableNumber(value.sugar)
  && isNullableString(value.imageUrl) && typeof value.verified === "boolean" && typeof value.custom === "boolean";
const isRecipe = (value: unknown): value is RecipeResponse =>
  isObject(value) && typeof value.id === "string" && typeof value.title === "string"
  && isNullableString(value.description) && isNullableNumber(value.prepTimeMinutes)
  && Object.values(RecipeDifficulty).includes(value.difficulty as RecipeDifficulty)
  && Object.values(DietaryPreference).includes(value.dietType as DietaryPreference)
  && typeof value.servings === "number"
  && typeof value.calories === "number" && typeof value.protein === "number"
  && typeof value.carbohydrates === "number" && typeof value.fat === "number"
  && isNullableNumber(value.fiber) && isNullableNumber(value.sugar) && isNullableString(value.imageUrl)
  && Array.isArray(value.ingredients)
  && value.ingredients.every((item) => typeof item === "string")
  && Array.isArray(value.instructions) && value.instructions.every((item) => typeof item === "string")
  && typeof value.aiGenerated === "boolean" && isNullableString(value.nutritionDataStatus)
  && isNullableString(value.nutritionDisclaimer);

function normalizePage<T>(value: unknown, guard: (item: unknown) => item is T, requestedPage: number, requestedSize: number): PageResponse<T> | null {
  let candidate: unknown = value;
  if (isObject(candidate) && "data" in candidate && !Array.isArray(candidate.content)) candidate = candidate.data;
  if (Array.isArray(candidate)) {
    if (!candidate.every(guard)) return null;
    return { content: candidate, totalElements: candidate.length, totalPages: candidate.length ? 1 : 0, size: requestedSize, number: requestedPage, first: true, last: true, empty: candidate.length === 0 };
  }
  if (!isObject(candidate) || !Array.isArray(candidate.content) || !candidate.content.every(guard)) return null;
  const content = candidate.content;
  const number = typeof candidate.number === "number" ? candidate.number : requestedPage;
  const size = typeof candidate.size === "number" ? candidate.size : requestedSize;
  const totalElements = typeof candidate.totalElements === "number" ? candidate.totalElements : content.length;
  const totalPages = typeof candidate.totalPages === "number" ? candidate.totalPages : totalElements ? Math.ceil(totalElements / size) : 0;
  return {
    content, totalElements, totalPages, number, size,
    first: typeof candidate.first === "boolean" ? candidate.first : number === 0,
    last: typeof candidate.last === "boolean" ? candidate.last : number >= Math.max(0, totalPages - 1),
    empty: typeof candidate.empty === "boolean" ? candidate.empty : content.length === 0,
  };
}
async function decode(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}
async function describeRequest(payload: unknown): Promise<unknown> {
  if (!(payload instanceof FormData)) return payload ?? null;
  const requestPart = payload.get("request");
  let request: unknown = requestPart ?? null;
  if (requestPart instanceof Blob) {
    const text = await requestPart.text();
    try { request = JSON.parse(text) as unknown; } catch { request = text; }
  }
  const images = payload.getAll("image").filter((part): part is File => part instanceof File);
  return {
    multipart: true,
    request,
    images: images.map((file) => ({ name: file.name, type: file.type, sizeBytes: file.size })),
  };
}
function errorMessage(data: unknown, fallback: string): string {
  if (typeof data === "string") return data.split(/\r?\n\s*at\s+/)[0].trim();
  if (isObject(data)) {
    for (const key of ["detail", "message", "error", "title"]) {
      if (typeof data[key] === "string") return String(data[key]).split(/\r?\n\s*at\s+/)[0].trim();
    }
  }
  return fallback;
}
function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}
function imageError(file: File | null): string {
  if (!file) return "";
  if (!file.type.startsWith("image/")) return "Choose an image file. The backend validates supported formats.";
  if (file.size === 0) return "The selected file is empty.";
  return "";
}
function numberError(value: string, required: boolean, minimum = 0): string {
  if (!value.trim()) return required ? "This field is required." : "";
  const number = Number(value);
  if (!Number.isFinite(number) || !/^\d{1,8}(\.\d{1,2})?$/.test(value.trim())) return "Use a finite number with up to 8 integer and 2 decimal digits.";
  if (number < minimum) return minimum > 0 ? `Enter a value greater than or equal to ${minimum}.` : "Enter a value greater than or equal to 0.";
  return "";
}
function formatAmount(value: number | null | undefined, unit = "g"): string {
  return value == null ? "—" : `${value} ${unit}`;
}
function humanize(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  }
  return <button type="button" className="nutrition-icon-button" title={copied ? "Copied" : label} aria-label={copied ? "Copied" : label} onClick={() => void copy()}>{copied ? <Check size={14} /> : <Clipboard size={14} />}</button>;
}

function ImagePreview({ src, alt, className = "" }: { src: string | null | undefined; alt: string; className?: string }) {
  const url = safeUrl(src);
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <span className={`nutrition-image-fallback ${className}`} aria-label="Image unavailable"><Image size={18} /></span>;
  return <img className={className} src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function NutritionValues({ item }: { item: Pick<FoodItemResponse, "calories" | "protein" | "carbohydrates" | "fat" | "fiber" | "sugar"> }) {
  return <div className="nutrition-values"><span>{item.calories} <small>kcal</small></span><span>P {formatAmount(item.protein)}</span><span>C {formatAmount(item.carbohydrates)}</span><span>F {formatAmount(item.fat)}</span><span>Fiber {formatAmount(item.fiber)}</span><span>Sugar {formatAmount(item.sugar)}</span></div>;
}

function ApiInspector({ record, history, onClear, loading }: { record: ApiRecord | null; history: ApiRecord[]; onClear: () => void; loading: boolean }) {
  return (
    <section className="nutrition-panel nutrition-inspector">
      <header className="nutrition-panel-heading">
        <div><h2><FileJson size={15} /> API response inspector</h2><p>Actual requests and responses from the configured backend.</p></div>
        <div className="nutrition-inspector-actions">{loading && <span className="nutrition-pending"><LoaderCircle className="nutrition-spin" size={12} />Request in progress</span>}<button type="button" className="nutrition-text-button" onClick={onClear} disabled={!history.length}>Clear history</button></div>
      </header>
      {!record ? <div className="nutrition-inspector-empty">No Nutrition Management requests have been made in this session.</div> : (
        <details open>
          <summary><span className={`nutrition-status-code ${record.ok ? "ok" : record.status == null ? "pending" : "bad"}`}>{record.status == null ? "No HTTP response" : `HTTP ${record.status}`}</span><strong>{record.method}</strong><code>{record.endpoint}</code><ChevronDown size={14} /></summary>
          <div className="nutrition-inspector-meta"><span>{record.operation}</span><span>{new Date(record.timestamp).toLocaleString()}</span><span>{record.durationMs} ms</span></div>
          {record.error && <p className="nutrition-inspector-error">{record.error}</p>}
          <div className="nutrition-json-grid">
            <section><header><strong>Request</strong><CopyButton value={JSON.stringify(record.request, null, 2)} label="Copy request" /></header><pre>{JSON.stringify(record.request, null, 2) ?? "null"}</pre></section>
            <section><header><strong>Response body</strong><CopyButton value={JSON.stringify(record.response, null, 2)} label="Copy response" /></header><pre>{record.response === null ? (record.status === 204 ? "204 No Content" : "Empty response body.") : typeof record.response === "string" ? record.response : JSON.stringify(record.response, null, 2)}</pre></section>
          </div>
        </details>
      )}
      {history.length > 1 && <details className="nutrition-history"><summary>Recent requests ({history.length}) <ChevronDown size={13} /></summary><ol>{history.slice(1).map((item, index) => <li key={`${item.timestamp}-${index}`}><span className={`nutrition-status-code ${item.ok ? "ok" : item.status == null ? "pending" : "bad"}`}>{item.status ?? "—"}</span><b>{item.method}</b><code>{item.endpoint}</code><time>{new Date(item.timestamp).toLocaleTimeString()}</time></li>)}</ol></details>}
    </section>
  );
}

function FoodForm({ initial, onClose, onSaved, run }: { initial: FoodItemResponse | null; onClose: () => void; onSaved: (record: ApiRecord) => void; run: DeveloperNutritionManagementProps["run"] }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name, brand: initial.brand ?? "", servingLabel: initial.servingLabel, servingSizeGrams: String(initial.servingSizeGrams),
    calories: String(initial.calories), protein: String(initial.protein), carbohydrates: String(initial.carbohydrates),
    fat: String(initial.fat), fiber: initial.fiber == null ? "" : String(initial.fiber), sugar: initial.sugar == null ? "" : String(initial.sugar),
  } : emptyFood());
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const previewUrl = useRef<string | null>(null);
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
  function chooseImage(candidate: File | null) {
    const error = imageError(candidate);
    setFileError(error);
    if (error) return;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = candidate ? URL.createObjectURL(candidate) : null;
    setPreview(previewUrl.current ?? "");
    setFile(candidate);
  }
  const fields: { key: keyof typeof form; label: string; required: boolean; max?: number; min?: number; numeric?: boolean }[] = [
    { key: "name", label: "Food name", required: true, max: 160 },
    { key: "brand", label: "Brand", required: false, max: 100 },
    { key: "servingLabel", label: "Serving label", required: true, max: 80 },
    { key: "servingSizeGrams", label: "Serving size (g)", required: true, min: 1, numeric: true },
    { key: "calories", label: "Calories (kcal)", required: true, numeric: true },
    { key: "protein", label: "Protein (g)", required: true, numeric: true },
    { key: "carbohydrates", label: "Carbohydrates (g)", required: true, numeric: true },
    { key: "fat", label: "Fat (g)", required: true, numeric: true },
    { key: "fiber", label: "Fiber (g)", required: false, numeric: true },
    { key: "sugar", label: "Sugar (g)", required: false, numeric: true },
  ];
  function validate() {
    const next: Record<string, string> = {};
    for (const field of fields) {
      const value = form[field.key];
      if (field.numeric) next[field.key] = numberError(value, field.required, field.min ?? 0);
      else if (field.required && !value.trim()) next[field.key] = "This field is required.";
      else if (field.max && value.length > field.max) next[field.key] = `Maximum ${field.max} characters.`;
      if (!next[field.key]) delete next[field.key];
    }
    if (fileError) next.image = fileError;
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate() || busy) return;
    const payload: FoodRequest = {
      name: form.name.trim(), brand: form.brand.trim() || null, servingLabel: form.servingLabel.trim(),
      servingSizeGrams: Number(form.servingSizeGrams), calories: Number(form.calories), protein: Number(form.protein),
      carbohydrates: Number(form.carbohydrates), fat: Number(form.fat),
      ...(form.fiber.trim() ? { fiber: Number(form.fiber) } : {}), ...(form.sugar.trim() ? { sugar: Number(form.sugar) } : {}),
    };
    const body = new FormData();
    body.append("request", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    if (file) body.append("image", file);
    setBusy(true);
    const result = await run(initial ? "Update custom food" : "Create custom food", initial ? "PUT" : "POST", initial ? `${FOODS}/${encodeURIComponent(initial.id)}` : FOODS, body);
    setBusy(false);
    if (result.record.ok) { onSaved(result.record); onClose(); }
  }
  return (
    <div className="nutrition-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form className="nutrition-modal nutrition-form-modal" onSubmit={(event) => void submit(event)} noValidate>
        <header className="nutrition-modal-heading"><div><span className="nutrition-overline">{initial ? "EDIT CUSTOM FOOD" : "FOOD CATALOG"}</span><h2>{initial ? "Edit food" : "Add custom food"}</h2><p>Nutrition fields are validated before submission.</p></div><button type="button" className="nutrition-icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={16} /></button></header>
        {initial?.imageUrl && !file && <p className="nutrition-image-note">The current image is retained unless you replace it. The API contract does not define image removal.</p>}
        <div className="nutrition-form-grid">{fields.map((field) => <label key={field.key} className={`nutrition-field ${field.key === "name" || field.key === "servingLabel" ? "wide" : ""}`}><span>{field.label} {field.required ? "*" : "(optional)"}</span><input type={field.numeric ? "number" : "text"} min={field.numeric ? field.min ?? 0 : undefined} step={field.numeric ? "0.01" : undefined} maxLength={field.max} value={form[field.key]} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} aria-invalid={Boolean(errors[field.key])} /><small>{errors[field.key] || (field.max ? `Maximum ${field.max} characters.` : field.numeric ? "Maximum 8 integer digits and 2 decimal places." : field.required ? "Required." : "Optional.")}</small></label>)}</div>
        <div className="nutrition-image-upload"><div><strong>Food image (optional)</strong><small>Image formats only. Size limits are determined by the backend.</small></div><label className="nutrition-secondary"><Upload size={14} />{file ? "Replace image" : "Choose image"}<input type="file" accept="image/*" onChange={(event) => chooseImage(event.target.files?.[0] ?? null)} /></label>{file && <button type="button" className="nutrition-text-button" onClick={() => chooseImage(null)}>Remove selection</button>}{(preview || (!file && initial?.imageUrl)) && <ImagePreview className="nutrition-form-image" src={preview || initial?.imageUrl} alt="Food preview" />}{fileError && <small className="nutrition-field-error">{fileError}</small>}</div>
        <footer className="nutrition-form-footer"><button type="button" className="nutrition-secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="nutrition-primary" disabled={busy}>{busy && <LoaderCircle className="nutrition-spin" size={14} />}{initial ? "Save changes" : "Create food"}</button></footer>
      </form>
    </div>
  );
}

type DeveloperNutritionManagementProps = {
  run: (operation: string, method: string, endpoint: string, payload?: unknown) => Promise<RequestResult<unknown>>;
};

function RecipeForm({ initial, onClose, onSaved, run }: { initial: RecipeResponse | null; onClose: () => void; onSaved: (record: ApiRecord) => void; run: DeveloperNutritionManagementProps["run"] }) {
  const [form, setForm] = useState(() => initial ? {
    title: initial.title, description: initial.description ?? "", prepTimeMinutes: String(initial.prepTimeMinutes ?? ""),
    difficulty: initial.difficulty, dietType: initial.dietType, servings: String(initial.servings), calories: String(initial.calories),
    protein: String(initial.protein), carbohydrates: String(initial.carbohydrates), fat: String(initial.fat),
    fiber: initial.fiber == null ? "" : String(initial.fiber), sugar: initial.sugar == null ? "" : String(initial.sugar),
    imageUrl: initial.imageUrl ?? "", ingredients: [...initial.ingredients], instructions: [...initial.instructions],
  } : emptyRecipe());
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const previewUrl = useRef<string | null>(null);
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
  function chooseImage(candidate: File | null) {
    const error = imageError(candidate);
    setFileError(error);
    if (error) return;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = candidate ? URL.createObjectURL(candidate) : null;
    setPreview(previewUrl.current ?? "");
    setFile(candidate);
  }
  function validate() {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = "Required.";
    else if (form.title.length > 180) next.title = "Maximum 180 characters.";
    if (form.description.length > 1000) next.description = "Maximum 1000 characters.";
    const prep = Number(form.prepTimeMinutes);
    if (!form.prepTimeMinutes || !Number.isInteger(prep) || prep < 1 || prep > 600) next.prepTimeMinutes = "Enter a whole number between 1 and 600 minutes.";
    const servings = Number(form.servings);
    if (!Number.isInteger(servings) || servings < 1 || servings > 30) next.servings = "Enter a whole number between 1 and 30.";
    for (const key of ["calories", "protein", "carbohydrates", "fat", "fiber", "sugar"] as const) {
      const error = numberError(form[key], key !== "fiber" && key !== "sugar");
      if (error) next[key] = error;
    }
    if (form.imageUrl.length > 2048) next.imageUrl = "Maximum 2048 characters.";
    else if (form.imageUrl && !safeUrl(form.imageUrl)) next.imageUrl = "Enter a valid HTTP or HTTPS image URL.";
    if (form.ingredients.length < 1 || form.ingredients.length > 40) next.ingredients = "Add between 1 and 40 ingredients.";
    else if (form.ingredients.some((item) => !item.trim() || item.trim().length > 240)) next.ingredients = "Each ingredient is required and must be 240 characters or fewer.";
    if (form.instructions.length < 1 || form.instructions.length > 40) next.instructions = "Add between 1 and 40 instructions.";
    else if (form.instructions.some((item) => !item.trim() || item.trim().length > 1000)) next.instructions = "Each instruction is required and must be 1000 characters or fewer.";
    if (fileError) next.image = fileError;
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate() || busy) return;
    const payload: RecipeRequest = {
      title: form.title.trim(), description: form.description.trim() || null, prepTimeMinutes: Number(form.prepTimeMinutes),
      difficulty: form.difficulty, dietType: form.dietType, servings: Number(form.servings), calories: Number(form.calories),
      protein: Number(form.protein), carbohydrates: Number(form.carbohydrates), fat: Number(form.fat),
      ...(form.fiber.trim() ? { fiber: Number(form.fiber) } : {}), ...(form.sugar.trim() ? { sugar: Number(form.sugar) } : {}),
      ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
      ingredients: form.ingredients.map((item) => item.trim()), instructions: form.instructions.map((item) => item.trim()),
    };
    const body = new FormData();
    body.append("request", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    if (file) body.append("image", file);
    setBusy(true);
    const result = await run(initial ? "Update recipe" : "Create recipe", initial ? "PUT" : "POST", initial ? `${RECIPES}/${encodeURIComponent(initial.id)}` : RECIPES, body);
    setBusy(false);
    if (result.record.ok) { onSaved(result.record); onClose(); }
  }
  const scalarFields: { key: "title" | "description" | "prepTimeMinutes" | "servings" | "calories" | "protein" | "carbohydrates" | "fat" | "fiber" | "sugar" | "imageUrl"; label: string; numeric?: boolean; optional?: boolean; max?: number }[] = [
    { key: "title", label: "Title", max: 180 }, { key: "description", label: "Description (optional)", max: 1000 },
    { key: "prepTimeMinutes", label: "Prep time (minutes)", numeric: true }, { key: "servings", label: "Servings", numeric: true },
    { key: "calories", label: "Calories (kcal)", numeric: true }, { key: "protein", label: "Protein (g)", numeric: true },
    { key: "carbohydrates", label: "Carbohydrates (g)", numeric: true }, { key: "fat", label: "Fat (g)", numeric: true },
    { key: "fiber", label: "Fiber (g, optional)", numeric: true, optional: true }, { key: "sugar", label: "Sugar (g, optional)", numeric: true, optional: true },
    { key: "imageUrl", label: "Image URL (optional)", max: 2048 },
  ];
  return (
    <div className="nutrition-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form className="nutrition-modal nutrition-form-modal nutrition-recipe-modal" onSubmit={(event) => void submit(event)} noValidate>
        <header className="nutrition-modal-heading"><div><span className="nutrition-overline">{initial ? "EDIT RECIPE" : "RECIPE CATALOG"}</span><h2>{initial ? "Edit recipe" : "Add recipe"}</h2><p>{initial ? "Leaving the image URL blank does not request image removal; upload an image or enter a URL to replace it." : "Recipe image is optional."}</p></div><button type="button" className="nutrition-icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={16} /></button></header>
        <div className="nutrition-form-grid">{scalarFields.map((field) => <label key={field.key} className={`nutrition-field ${field.key === "title" || field.key === "description" || field.key === "imageUrl" ? "wide" : ""}`}><span>{field.label} {field.key !== "description" && field.key !== "imageUrl" && field.key !== "fiber" && field.key !== "sugar" ? "*" : ""}</span><input type={field.numeric ? "number" : "text"} min={field.numeric ? 0 : undefined} max={field.key === "prepTimeMinutes" ? 600 : field.key === "servings" ? 30 : undefined} step={field.numeric ? "0.01" : undefined} maxLength={field.max} value={form[field.key]} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} aria-invalid={Boolean(errors[field.key])} /><small>{errors[field.key] || (field.max ? `Maximum ${field.max} characters.` : field.key === "prepTimeMinutes" ? "1–600 minutes." : field.key === "servings" ? "1–30 servings." : field.numeric ? "Maximum 8 integer digits and 2 decimal places." : "Optional.")}</small></label>)}
          <label className="nutrition-field"><span>Difficulty *</span><select value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value as RecipeDifficulty }))}>{Object.values(RecipeDifficulty).map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select><small>{errors.difficulty || "Required."}</small></label>
          <label className="nutrition-field"><span>Dietary preference *</span><select value={form.dietType} onChange={(event) => setForm((current) => ({ ...current, dietType: event.target.value as DietaryPreference }))}>{Object.values(DietaryPreference).map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select><small>{errors.dietType || "Required."}</small></label>
        </div>
        <div className="nutrition-list-editors">
          <section><header><strong>Ingredients *</strong><button type="button" className="nutrition-small-button" disabled={form.ingredients.length >= 40} onClick={() => setForm((current) => ({ ...current, ingredients: [...current.ingredients, ""] }))}><Plus size={13} /> Add</button></header>{form.ingredients.map((item, index) => <div className="nutrition-list-row" key={`ingredient-${index}`}><span>{index + 1}</span><input value={item} maxLength={240} aria-label={`Ingredient ${index + 1}`} onChange={(event) => setForm((current) => ({ ...current, ingredients: current.ingredients.map((value, row) => row === index ? event.target.value : value) }))} /><button type="button" className="nutrition-icon-button" aria-label={`Remove ingredient ${index + 1}`} disabled={form.ingredients.length <= 1} onClick={() => setForm((current) => ({ ...current, ingredients: current.ingredients.filter((_, row) => row !== index) }))}><Trash2 size={13} /></button></div>)}<small className="nutrition-editor-error">{errors.ingredients || "1–40 items; maximum 240 characters each."}</small></section>
          <section><header><strong>Instructions *</strong><button type="button" className="nutrition-small-button" disabled={form.instructions.length >= 40} onClick={() => setForm((current) => ({ ...current, instructions: [...current.instructions, ""] }))}><Plus size={13} /> Add</button></header>{form.instructions.map((item, index) => <div className="nutrition-list-row" key={`instruction-${index}`}><span>{index + 1}</span><textarea value={item} maxLength={1000} aria-label={`Instruction ${index + 1}`} onChange={(event) => setForm((current) => ({ ...current, instructions: current.instructions.map((value, row) => row === index ? event.target.value : value) }))} /><button type="button" className="nutrition-icon-button" aria-label={`Remove instruction ${index + 1}`} disabled={form.instructions.length <= 1} onClick={() => setForm((current) => ({ ...current, instructions: current.instructions.filter((_, row) => row !== index) }))}><Trash2 size={13} /></button></div>)}<small className="nutrition-editor-error">{errors.instructions || "1–40 items; maximum 1000 characters each."}</small></section>
        </div>
        <div className="nutrition-image-upload"><div><strong>Recipe image (optional)</strong><small>Image formats only. No undocumented file-size limit is imposed by the UI.</small></div><label className="nutrition-secondary"><Upload size={14} />Choose image<input type="file" accept="image/*" onChange={(event) => chooseImage(event.target.files?.[0] ?? null)} /></label>{file && <button type="button" className="nutrition-text-button" onClick={() => chooseImage(null)}>Remove selection</button>}{(preview || (!file && form.imageUrl)) && <ImagePreview className="nutrition-form-image" src={preview || form.imageUrl} alt="Recipe preview" />}{fileError && <small className="nutrition-field-error">{fileError}</small>}<small className="nutrition-field-error">{errors.image}</small></div>
        <footer className="nutrition-form-footer"><button type="button" className="nutrition-secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="nutrition-primary" disabled={busy}>{busy && <LoaderCircle className="nutrition-spin" size={14} />}{initial ? "Save changes" : "Create recipe"}</button></footer>
      </form>
    </div>
  );
}

export default function DeveloperNutritionManagement() {
  const [tab, setTab] = useState<"foods" | "recipes" | "generator">("foods");
  const [foodPage, setFoodPage] = useState(() => emptyPage<FoodItemResponse>());
  const [recipePage, setRecipePage] = useState(() => emptyPage<RecipeResponse>());
  const [foodQuery, setFoodQuery] = useState("");
  const [recipeQuery, setRecipeQuery] = useState("");
  const [dietFilter, setDietFilter] = useState("");
  const [foodDebounced, setFoodDebounced] = useState("");
  const [recipeDebounced, setRecipeDebounced] = useState("");
  const [foodPageIndex, setFoodPageIndex] = useState(0);
  const [recipePageIndex, setRecipePageIndex] = useState(0);
  const [foodLoading, setFoodLoading] = useState(false);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [foodError, setFoodError] = useState("");
  const [recipeError, setRecipeError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [inspector, setInspector] = useState<ApiRecord | null>(null);
  const [history, setHistory] = useState<ApiRecord[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [foodDialog, setFoodDialog] = useState<FoodItemResponse | true | false>(false);
  const [recipeDialog, setRecipeDialog] = useState<RecipeResponse | true | false>(false);
  const [confirmFood, setConfirmFood] = useState<FoodItemResponse | null>(null);
  const [confirmRecipe, setConfirmRecipe] = useState<RecipeResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [recipeDetail, setRecipeDetail] = useState<RecipeResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [aiIngredients, setAiIngredients] = useState([""]);
  const [aiDiet, setAiDiet] = useState("");
  const [aiGoal, setAiGoal] = useState("");
  const [aiTime, setAiTime] = useState("");
  const [aiCount, setAiCount] = useState("");
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [generated, setGenerated] = useState<RecipeResponse[]>([]);
  const [expandedGenerated, setExpandedGenerated] = useState<string | null>(null);
  const [savingGenerated, setSavingGenerated] = useState<string | null>(null);
  const mounted = useRef(true);
  const foodSequence = useRef(0);
  const recipeSequence = useRef(0);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const execute = useCallback(async <T,>(operation: string, method: string, endpoint: string, payload?: unknown): Promise<RequestResult<T>> => {
    const started = performance.now();
    const timestamp = new Date().toISOString();
    if (mounted.current) setPendingRequests((count) => count + 1);
    let response: Response | null = null;
    let data: unknown = null;
    let error = "";
    let requestDetails: unknown = payload ?? null;
    try {
      requestDetails = await describeRequest(payload);
      const multipart = payload instanceof FormData;
      response = await portalFetch(endpoint, {
        method,
        headers: payload === undefined ? { Accept: "application/json" } : multipart ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
        ...(payload !== undefined ? { body: multipart ? payload : JSON.stringify(payload) } : {}),
      });
      data = await decode(response);
      if (!response.ok) error = `HTTP ${response.status}: ${errorMessage(data, response.statusText || "Request failed.")}`;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "The request failed before an HTTP response was received.";
    }
    const record: ApiRecord = {
      operation, method, endpoint, timestamp, durationMs: Math.round(performance.now() - started),
      status: response?.status ?? null, ok: Boolean(response?.ok),
      request: requestDetails,
      response: data,
      ...(error ? { error } : {}),
    };
    if (mounted.current) {
      setInspector(record);
      setHistory((current) => [record, ...current].slice(0, 20));
      setPendingRequests((count) => Math.max(0, count - 1));
      if (!record.ok) setNotice({ ok: false, message: record.error || "Request failed." });
    }
    return { record, data: data as T | null };
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { setFoodDebounced(foodQuery.trim()); setFoodPageIndex(0); }, 300); return () => window.clearTimeout(timer); }, [foodQuery]);
  useEffect(() => { const timer = window.setTimeout(() => { setRecipeDebounced(recipeQuery.trim()); setRecipePageIndex(0); }, 300); return () => window.clearTimeout(timer); }, [recipeQuery]);

  const loadFoods = useCallback(async (page: number, query: string) => {
    const id = ++foodSequence.current;
    setFoodLoading(true); setFoodError("");
    const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    if (query) params.set("query", query);
    const endpoint = `${FOODS}?${params}`;
    const result = await execute<unknown>("Search foods", "GET", endpoint);
    if (!mounted.current || id !== foodSequence.current) return;
    setFoodLoading(false);
    if (!result.record.ok) { setFoodError(result.record.error || "Unable to load food catalog."); setFoodPage(emptyPage()); return; }
    const normalized = normalizePage(result.data, isFood, page, PAGE_SIZE);
    if (!normalized) { setFoodError("The food catalog response did not match the expected page format."); setFoodPage(emptyPage()); return; }
    setFoodPage(normalized);
  }, [execute]);
  const loadRecipes = useCallback(async (page: number, query: string, diet: string) => {
    const id = ++recipeSequence.current;
    setRecipeLoading(true); setRecipeError("");
    const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    if (query) params.set("query", query);
    if (diet) params.set("dietaryPreference", diet);
    const endpoint = `${RECIPES}?${params}`;
    const result = await execute<unknown>("Search recipes", "GET", endpoint);
    if (!mounted.current || id !== recipeSequence.current) return;
    setRecipeLoading(false);
    if (!result.record.ok) { setRecipeError(result.record.error || "Unable to load recipes."); setRecipePage(emptyPage()); return; }
    const normalized = normalizePage(result.data, isRecipe, page, PAGE_SIZE);
    if (!normalized) { setRecipeError("The recipe catalog response did not match the expected page format."); setRecipePage(emptyPage()); return; }
    setRecipePage(normalized);
  }, [execute]);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (tab === "foods") void loadFoods(foodPageIndex, foodDebounced); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, foodPageIndex, foodDebounced, loadFoods, refreshKey]);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (tab === "recipes") void loadRecipes(recipePageIndex, recipeDebounced, dietFilter); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, recipePageIndex, recipeDebounced, dietFilter, loadRecipes, refreshKey]);

  async function refreshCurrent() {
    setRefreshKey((value) => value + 1);
    if (tab === "generator") setGenerated((current) => current);
  }
  async function openRecipe(recipe: RecipeResponse) {
    setRecipeDetail(recipe); setDetailLoading(true);
    const result = await execute<unknown>("Get recipe details", "GET", `${RECIPES}/${encodeURIComponent(recipe.id)}`);
    setDetailLoading(false);
    if (!result.record.ok) return;
    if (isRecipe(result.data)) setRecipeDetail(result.data);
    else setNotice({ ok: false, message: "Recipe details response did not match the expected recipe format." });
  }
  async function deleteItem(kind: "food" | "recipe") {
    const item = kind === "food" ? confirmFood : confirmRecipe;
    if (!item || deleting) return;
    setDeleting(true);
    const endpoint = kind === "food" ? `${FOODS}/${encodeURIComponent(item.id)}` : `${RECIPES}/${encodeURIComponent(item.id)}`;
    const result = await execute(kind === "food" ? "Delete custom food" : "Delete recipe", "DELETE", endpoint);
    setDeleting(false);
    if (result.record.ok) {
      setNotice({ ok: true, message: `${kind === "food" ? "Food" : "Recipe"} deleted (HTTP ${result.record.status}).` });
      if (kind === "food") { setConfirmFood(null); void loadFoods(foodPageIndex, foodDebounced); }
      else { setConfirmRecipe(null); setRecipeDetail(null); void loadRecipes(recipePageIndex, recipeDebounced, dietFilter); }
    }
  }
  function validateAi(): boolean {
    const clean = aiIngredients.map((value) => value.trim());
    const next: Record<string, string> = {};
    if (clean.length < 1 || clean.length > 40) next.ingredients = "Add between 1 and 40 ingredients.";
    else if (clean.some((value) => !value || value.length > 100)) next.ingredients = "Each ingredient is required and must be 100 characters or fewer.";
    else if (new Set(clean.map((value) => value.toLocaleLowerCase())).size !== clean.length) next.ingredients = "Remove duplicate ingredients.";
    if (aiTime && (!Number.isInteger(Number(aiTime)) || Number(aiTime) < 1 || Number(aiTime) > 240)) next.maxPrepTimeMinutes = "Enter a whole number between 1 and 240.";
    if (aiCount && (!Number.isInteger(Number(aiCount)) || Number(aiCount) < 1 || Number(aiCount) > 10)) next.recipeCount = "Enter a whole number between 1 and 10.";
    setAiErrors(next);
    return Object.keys(next).length === 0;
  }
  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!validateAi() || aiLoading) return;
    const payload = {
      ingredients: aiIngredients.map((value) => value.trim()),
      ...(aiDiet ? { dietaryPreference: aiDiet as DietaryPreference } : {}),
      ...(aiGoal ? { fitnessGoal: aiGoal as DietFitnessGoal } : {}),
      ...(aiTime ? { maxPrepTimeMinutes: Number(aiTime) } : {}),
      ...(aiCount ? { recipeCount: Number(aiCount) } : {}),
    };
    setAiLoading(true); setGenerated([]);
    const result = await execute<unknown>("Generate AI recipes", "POST", `${RECIPES}/generate`, payload);
    setAiLoading(false);
    if (!result.record.ok) return;
    if (!Array.isArray(result.data) || !result.data.every(isRecipe)) {
      setNotice({ ok: false, message: "The recipe generator response was not a recipe list." });
      return;
    }
    setGenerated(result.data);
    setNotice({ ok: true, message: `${result.data.length} recipe${result.data.length === 1 ? "" : "s"} returned by the backend.` });
  }
  async function saveGenerated(recipe: RecipeResponse) {
    if (savingGenerated || !canSaveGeneratedRecipe(recipe) || recipe.prepTimeMinutes == null) return;
    setSavingGenerated(recipe.id);
    const payload: RecipeRequest = {
      title: recipe.title, description: recipe.description, prepTimeMinutes: recipe.prepTimeMinutes,
      difficulty: recipe.difficulty, dietType: recipe.dietType, servings: recipe.servings, calories: recipe.calories,
      protein: recipe.protein, carbohydrates: recipe.carbohydrates, fat: recipe.fat,
      ...(recipe.fiber == null ? {} : { fiber: recipe.fiber }), ...(recipe.sugar == null ? {} : { sugar: recipe.sugar }),
      ...(recipe.imageUrl ? { imageUrl: recipe.imageUrl } : {}),
      ingredients: recipe.ingredients, instructions: recipe.instructions,
    };
    const body = new FormData();
    body.append("request", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    const result = await execute<unknown>("Save generated recipe to catalog", "POST", RECIPES, body);
    setSavingGenerated(null);
    if (result.record.ok) {
      setNotice({ ok: true, message: `Recipe saved to catalog (HTTP ${result.record.status}).` });
      setRecipePageIndex(0); setRecipeQuery(""); setRecipeDebounced(""); setTab("recipes");
    }
  }
  const title = useMemo(() => tab === "foods" ? "Food Catalog" : tab === "recipes" ? "Recipe Management" : "AI Recipe Generator", [tab]);

  return (
    <div className="dev-content nutrition-management">
      <div className="nutrition-page-heading">
        <div><h1>{title}</h1><p>Manage food nutrition, recipe records, and AI-generated recipes through live backend APIs.</p></div>
        <div className="nutrition-page-actions">
          {tab === "foods" && <button type="button" className="nutrition-primary" onClick={() => setFoodDialog(true)}><Plus size={14} /> Add food</button>}
          {tab === "recipes" && <button type="button" className="nutrition-primary" onClick={() => setRecipeDialog(true)}><Plus size={14} /> Add recipe</button>}
          {tab !== "generator" && <button type="button" className="nutrition-secondary" onClick={() => void refreshCurrent()} disabled={foodLoading || recipeLoading}><RefreshCw size={14} /> Refresh</button>}
        </div>
      </div>
      <nav className="nutrition-tabs" aria-label="Nutrition management sections">
        <button type="button" className={tab === "foods" ? "active" : ""} onClick={() => setTab("foods")}><Image size={15} /> Foods</button>
        <button type="button" className={tab === "recipes" ? "active" : ""} onClick={() => setTab("recipes")}><FileJson size={15} /> Recipes</button>
        <button type="button" className={tab === "generator" ? "active" : ""} onClick={() => setTab("generator")}><Sparkles size={15} /> AI Recipe Generator</button>
      </nav>
      {notice && <div className={`nutrition-notice ${notice.ok ? "success" : "error"}`} role="status"><span>{notice.ok ? <Check size={15} /> : <AlertCircle size={15} />}{notice.message}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={14} /></button></div>}

      {tab === "foods" && <>
        <div className="nutrition-toolbar"><label className="nutrition-search"><Search size={15} /><input value={foodQuery} onChange={(event) => setFoodQuery(event.target.value)} placeholder="Search foods by name or brand" /><button type="button" aria-label="Clear food search" onClick={() => setFoodQuery("")} disabled={!foodQuery}><X size={14} /></button></label><span className="nutrition-total">{foodLoading ? "Loading…" : foodError ? "Unavailable" : `${foodPage.totalElements} records`}</span></div>
        <section className="nutrition-panel">
          <header className="nutrition-panel-heading"><div><h2>Food catalog</h2><p>Backend catalog results and serving-level nutrition.</p></div><span className="nutrition-page-state">{foodLoading ? "Loading…" : `Page ${foodPage.number + 1} of ${Math.max(1, foodPage.totalPages)}`}</span></header>
          {foodError ? <div className="nutrition-state error"><AlertCircle size={21} /><strong>Unable to load foods</strong><span>{foodError}</span><button type="button" className="nutrition-secondary" onClick={() => void loadFoods(foodPageIndex, foodDebounced)}><RefreshCw size={14} /> Retry</button></div>
            : foodLoading && foodPage.empty ? <div className="nutrition-state"><LoaderCircle className="nutrition-spin" size={20} />Loading food catalog…</div>
              : foodPage.empty ? <div className="nutrition-state"><Image size={23} /><strong>No foods found</strong><span>{foodDebounced ? "No catalog entries match this search." : "The backend food catalog is empty."}</span></div>
                : <div className="nutrition-table-wrap"><table className="nutrition-table"><thead><tr><th>Food</th><th>Serving</th><th>Nutrition per serving</th><th>Source</th><th>Actions</th></tr></thead><tbody>{foodPage.content.map((food) => <tr key={food.id}><td><div className="nutrition-food-cell"><ImagePreview src={food.imageUrl} alt={food.name} className="nutrition-table-image" /><span><strong>{food.name}</strong><small>{food.brand || "No brand"}</small></span></div></td><td>{food.servingLabel}<small>{food.servingSizeGrams} g</small></td><td><NutritionValues item={food} /></td><td><span className={`nutrition-badge ${food.verified ? "verified" : ""}`}>{food.verified ? "Verified" : "Unverified"}</span> <span className="nutrition-badge">{food.custom ? "Custom" : "Catalog"}</span></td><td><div className="nutrition-row-actions"><button type="button" className="nutrition-small-button" disabled={!food.custom} title={food.custom ? "Edit custom food" : "Only custom foods can be edited"} onClick={() => setFoodDialog(food)}>Edit</button><button type="button" className="nutrition-icon-button danger" disabled={!food.custom} aria-label={`Delete ${food.name}`} title={food.custom ? "Delete food" : "Only custom foods can be deleted"} onClick={() => setConfirmFood(food)}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>}
          <footer className="nutrition-pagination"><span>{foodPage.totalElements} results</span><div><button type="button" className="nutrition-icon-button" aria-label="Previous food page" disabled={foodPage.first || foodLoading} onClick={() => setFoodPageIndex((page) => Math.max(0, page - 1))}><ArrowLeft size={14} /></button><button type="button" className="nutrition-icon-button" aria-label="Next food page" disabled={foodPage.last || foodLoading} onClick={() => setFoodPageIndex((page) => page + 1)}><ArrowRight size={14} /></button></div></footer>
        </section>
      </>}

      {tab === "recipes" && <>
        <div className="nutrition-toolbar"><label className="nutrition-search"><Search size={15} /><input value={recipeQuery} onChange={(event) => setRecipeQuery(event.target.value)} placeholder="Search recipes by title" /><button type="button" aria-label="Clear recipe search" onClick={() => setRecipeQuery("")} disabled={!recipeQuery}><X size={14} /></button></label><label className="nutrition-select-filter"><span>Diet</span><select value={dietFilter} onChange={(event) => { setDietFilter(event.target.value); setRecipePageIndex(0); }}><option value="">All preferences</option>{Object.values(DietaryPreference).map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select></label><span className="nutrition-total">{recipeLoading ? "Loading…" : recipeError ? "Unavailable" : `${recipePage.totalElements} records`}</span></div>
        <div className={`nutrition-recipe-layout ${recipeDetail ? "with-detail" : ""}`}>
          <section className="nutrition-panel">
            <header className="nutrition-panel-heading"><div><h2>Recipe catalog</h2><p>Backend recipes, dietary preference and nutrition status.</p></div><span className="nutrition-page-state">{recipeLoading ? "Loading…" : `Page ${recipePage.number + 1} of ${Math.max(1, recipePage.totalPages)}`}</span></header>
            {recipeError ? <div className="nutrition-state error"><AlertCircle size={21} /><strong>Unable to load recipes</strong><span>{recipeError}</span><button type="button" className="nutrition-secondary" onClick={() => void loadRecipes(recipePageIndex, recipeDebounced, dietFilter)}><RefreshCw size={14} /> Retry</button></div>
              : recipeLoading && recipePage.empty ? <div className="nutrition-state"><LoaderCircle className="nutrition-spin" size={20} />Loading recipes…</div>
                : recipePage.empty ? <div className="nutrition-state"><FileJson size={23} /><strong>No recipes found</strong><span>{recipeDebounced || dietFilter ? "No recipes match the current filters." : "The backend recipe catalog is empty."}</span></div>
                  : <div className="nutrition-recipe-list">{recipePage.content.map((recipe) => <article className="nutrition-recipe-row" key={recipe.id}><button type="button" className="nutrition-recipe-select" onClick={() => void openRecipe(recipe)}><ImagePreview src={recipe.imageUrl} alt={recipe.title} className="nutrition-recipe-thumb" /><span className="nutrition-recipe-summary"><strong>{recipe.title}</strong><small>{recipe.description || "No description."}</small><span className="nutrition-badges"><i>{humanize(recipe.dietType)}</i><i>{humanize(recipe.difficulty)}</i>{recipe.aiGenerated && <i className="ai">AI generated</i>}</span><span className="nutrition-recipe-macros">{recipe.calories} kcal · P {recipe.protein} g · C {recipe.carbohydrates} g · F {recipe.fat} g</span></span></button><div className="nutrition-row-actions"><button type="button" className="nutrition-small-button" onClick={() => { setRecipeDialog(recipe); }}>Edit</button><button type="button" className="nutrition-icon-button danger" aria-label={`Delete ${recipe.title}`} onClick={() => setConfirmRecipe(recipe)}><Trash2 size={14} /></button></div></article>)}</div>}
            <footer className="nutrition-pagination"><span>{recipePage.totalElements} results</span><div><button type="button" className="nutrition-icon-button" aria-label="Previous recipe page" disabled={recipePage.first || recipeLoading} onClick={() => setRecipePageIndex((page) => Math.max(0, page - 1))}><ArrowLeft size={14} /></button><button type="button" className="nutrition-icon-button" aria-label="Next recipe page" disabled={recipePage.last || recipeLoading} onClick={() => setRecipePageIndex((page) => page + 1)}><ArrowRight size={14} /></button></div></footer>
          </section>
          {recipeDetail && <aside className="nutrition-panel nutrition-recipe-detail"><header className="nutrition-panel-heading"><div><h2>Recipe details</h2><p>{detailLoading ? "Refreshing from backend…" : "Full backend recipe response."}</p></div><button type="button" className="nutrition-icon-button" aria-label="Close recipe details" onClick={() => setRecipeDetail(null)}><X size={14} /></button></header><div className="nutrition-detail-body"><ImagePreview src={recipeDetail.imageUrl} alt={recipeDetail.title} className="nutrition-detail-image" /><h3>{recipeDetail.title}</h3><p>{recipeDetail.description || "No description."}</p><div className="nutrition-detail-badges"><span>{humanize(recipeDetail.dietType)}</span><span>{humanize(recipeDetail.difficulty)}</span>{recipeDetail.aiGenerated && <span>AI generated</span>}</div><div className="nutrition-detail-metrics"><span><b>{recipeDetail.prepTimeMinutes ?? "—"}</b><small>minutes</small></span><span><b>{recipeDetail.servings}</b><small>servings</small></span><span><b>{recipeDetail.calories}</b><small>kcal</small></span><span><b>{recipeDetail.protein} g</b><small>protein</small></span><span><b>{recipeDetail.carbohydrates} g</b><small>carbs</small></span><span><b>{recipeDetail.fat} g</b><small>fat</small></span><span><b>{formatAmount(recipeDetail.fiber)}</b><small>fiber</small></span><span><b>{formatAmount(recipeDetail.sugar)}</b><small>sugar</small></span></div>{recipeDetail.nutritionDataStatus && <p className="nutrition-disclaimer"><strong>Nutrition status:</strong> {recipeDetail.nutritionDataStatus}</p>}{recipeDetail.nutritionDisclaimer && <p className="nutrition-disclaimer">{recipeDetail.nutritionDisclaimer}</p>}<section className="nutrition-detail-list"><h4>Ingredients</h4><ul>{recipeDetail.ingredients.map((ingredient, index) => <li key={`${index}-${ingredient}`}>{ingredient}</li>)}</ul></section><section className="nutrition-detail-list"><h4>Instructions</h4><ol>{recipeDetail.instructions.map((instruction, index) => <li key={`${index}-${instruction}`}>{instruction}</li>)}</ol></section><button type="button" className="nutrition-secondary full" onClick={() => setRecipeDialog(recipeDetail)}>Edit recipe</button></div></aside>}
        </div>
      </>}

      {tab === "generator" && <>
        <div className="nutrition-ai-intro"><span><Sparkles size={19} /></span><div><strong>Generate recipes with the backend</strong><p>Returned recipes and nutrition details are displayed as received. No mock recipes are used.</p></div></div>
        <form className="nutrition-panel nutrition-ai-form" onSubmit={(event) => void generate(event)} noValidate>
          <header className="nutrition-panel-heading"><div><h2>Generation preferences</h2><p>Choose ingredients and optional limits.</p></div></header>
          <section className="nutrition-ai-ingredients"><header><strong>Ingredients *</strong><button type="button" className="nutrition-small-button" disabled={aiIngredients.length >= 40} onClick={() => setAiIngredients((values) => [...values, ""])}><Plus size={13} /> Add ingredient</button></header>{aiIngredients.map((ingredient, index) => <div className="nutrition-list-row" key={`ai-${index}`}><span>{index + 1}</span><input value={ingredient} maxLength={100} aria-label={`Ingredient ${index + 1}`} placeholder="e.g. oats" onChange={(event) => setAiIngredients((values) => values.map((value, row) => row === index ? event.target.value : value))} /><button type="button" className="nutrition-icon-button" aria-label={`Remove ingredient ${index + 1}`} disabled={aiIngredients.length <= 1} onClick={() => setAiIngredients((values) => values.filter((_, row) => row !== index))}><Trash2 size={13} /></button></div>)}<small className="nutrition-editor-error">{aiErrors.ingredients || "Enter 1–40 unique ingredients, up to 100 characters each."}</small></section>
          <div className="nutrition-form-grid nutrition-ai-options">
            <label className="nutrition-field"><span>Dietary preference (optional)</span><select value={aiDiet} onChange={(event) => setAiDiet(event.target.value)}><option value="">No preference</option>{Object.values(DietaryPreference).map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select><small>Submitted using the selected API enum.</small></label>
            <label className="nutrition-field"><span>Fitness goal (optional)</span><select value={aiGoal} onChange={(event) => setAiGoal(event.target.value)}><option value="">No goal</option>{Object.values(DietFitnessGoal).map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select><small>Submitted using the selected API enum.</small></label>
            <label className="nutrition-field"><span>Maximum prep time (minutes, optional)</span><input type="number" min={1} max={240} step={1} value={aiTime} onChange={(event) => setAiTime(event.target.value)} /><small>{aiErrors.maxPrepTimeMinutes || "1–240 minutes."}</small></label>
            <label className="nutrition-field"><span>Recipe count (optional)</span><input type="number" min={1} max={10} step={1} value={aiCount} onChange={(event) => setAiCount(event.target.value)} /><small>{aiErrors.recipeCount || "1–10 recipes."}</small></label>
          </div>
          <footer className="nutrition-form-footer"><button type="button" className="nutrition-secondary" onClick={() => { setGenerated([]); setAiIngredients([""]); setAiDiet(""); setAiGoal(""); setAiTime(""); setAiCount(""); setAiErrors({}); }}>Clear</button><button type="submit" className="nutrition-primary" disabled={aiLoading}>{aiLoading ? <LoaderCircle className="nutrition-spin" size={14} /> : <Sparkles size={14} />}{aiLoading ? "Generating…" : "Generate recipes"}</button></footer>
        </form>
        <section className="nutrition-generated"><header><div><h2>Generated results</h2><p>{generated.length ? `${generated.length} recipes from the latest successful response.` : "Recipes returned by the API will appear here."}</p></div>{generated.length > 0 && <button type="button" className="nutrition-text-button" onClick={() => setGenerated([])}>Clear results</button>}</header>
          {aiLoading ? <div className="nutrition-state"><LoaderCircle className="nutrition-spin" size={20} />Waiting for the recipe generation response…</div>
            : !generated.length ? <div className="nutrition-state compact">No generated recipes to display.</div>
                : <div className="nutrition-generated-grid">{generated.map((recipe) => <article className="nutrition-panel nutrition-generated-card" key={recipe.id}><ImagePreview src={recipe.imageUrl} alt={recipe.title} className="nutrition-generated-image" /><div className="nutrition-generated-content"><div className="nutrition-generated-title"><div><h3>{recipe.title}</h3><div className="nutrition-badges"><i>{humanize(recipe.dietType)}</i><i>{humanize(recipe.difficulty)}</i>{recipe.aiGenerated && <i className="ai">AI generated</i>}</div></div><CopyButton value={JSON.stringify(recipe, null, 2)} label="Copy generated recipe" /></div><p>{recipe.description || "No description returned."}</p><NutritionValues item={recipe} /><div className="nutrition-generated-meta"><span>{recipe.prepTimeMinutes == null ? "Prep time unavailable" : `${recipe.prepTimeMinutes} min`}</span><span>{recipe.servings} servings</span>{recipe.nutritionDataStatus && <span>{recipe.nutritionDataStatus}</span>}</div>{recipe.nutritionDisclaimer && <p className="nutrition-disclaimer">{recipe.nutritionDisclaimer}</p>}<button type="button" className="nutrition-text-button" onClick={() => setExpandedGenerated((current) => current === recipe.id ? null : recipe.id)}>{expandedGenerated === recipe.id ? "Hide details" : "Ingredients and instructions"} <ChevronDown size={13} /></button>{expandedGenerated === recipe.id && <div className="nutrition-generated-detail"><h4>Ingredients</h4><ul>{recipe.ingredients.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul><h4>Instructions</h4><ol>{recipe.instructions.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol></div>}<div className="nutrition-generated-actions"><button type="button" className="nutrition-secondary" onClick={() => { setRecipeDetail(recipe); setTab("recipes"); }}>View details</button><button type="button" className="nutrition-primary" disabled={Boolean(savingGenerated) || !canSaveGeneratedRecipe(recipe)} title={canSaveGeneratedRecipe(recipe) ? "Save recipe to catalog" : "This response is missing required catalog fields or contains invalid values."} onClick={() => void saveGenerated(recipe)}>{savingGenerated === recipe.id ? <LoaderCircle className="nutrition-spin" size={13} /> : <Plus size={13} />} Save to catalog</button></div>{!canSaveGeneratedRecipe(recipe) && <small className="nutrition-field-error">Cannot save: required recipe fields are missing or outside catalog limits.</small>}</div></article>)}</div>}
        </section>
      </>}

      <ApiInspector record={inspector} history={history} onClear={() => { setInspector(null); setHistory([]); }} loading={pendingRequests > 0} />

      {foodDialog !== false && <FoodForm initial={foodDialog === true ? null : foodDialog} run={execute} onClose={() => setFoodDialog(false)} onSaved={(record) => { setNotice({ ok: true, message: `Food saved successfully (HTTP ${record.status}).` }); void loadFoods(foodPageIndex, foodDebounced); }} />}
      {recipeDialog !== false && <RecipeForm initial={recipeDialog === true ? null : recipeDialog} run={execute} onClose={() => setRecipeDialog(false)} onSaved={(record) => { setNotice({ ok: true, message: `Recipe saved successfully (HTTP ${record.status}).` }); void loadRecipes(recipePageIndex, recipeDebounced, dietFilter); }} />}
      {(confirmFood || confirmRecipe) && <div className="nutrition-modal-backdrop" role="presentation"><section className="nutrition-modal nutrition-confirm"><button type="button" className="nutrition-icon-button nutrition-modal-close" aria-label="Close confirmation" disabled={deleting} onClick={() => { setConfirmFood(null); setConfirmRecipe(null); }}><X size={15} /></button><span className="nutrition-confirm-icon"><Trash2 size={19} /></span><h2>Delete {confirmFood ? "food" : "recipe"}?</h2><p>This permanently deletes <strong>{confirmFood?.name ?? confirmRecipe?.title}</strong>. This action cannot be undone.</p><footer><button type="button" className="nutrition-secondary" disabled={deleting} onClick={() => { setConfirmFood(null); setConfirmRecipe(null); }}>Cancel</button><button type="button" className="nutrition-danger" disabled={deleting} onClick={() => void deleteItem(confirmFood ? "food" : "recipe")}>{deleting && <LoaderCircle className="nutrition-spin" size={14} />}Delete</button></footer></section></div>}
    </div>
  );
}
