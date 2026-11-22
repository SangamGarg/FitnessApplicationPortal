import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Clipboard, Dumbbell,
  Edit3, ExternalLink, FileJson, LoaderCircle, Plus, RefreshCw, Search,
  Trash2, Upload, X,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperExerciseManagement.css";

const EXERCISE_BASE = "/api/v1/portal/dev/exercise";
const CATALOG_ENDPOINT = `${EXERCISE_BASE}/catalog`;
const WORKOUTS_ENDPOINT = `${EXERCISE_BASE}/workout-plans`;

type ExerciseDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
type ExerciseType = "STRENGTH" | "CARDIO" | "MOBILITY" | "FLEXIBILITY" | "PLYOMETRIC";
type MediaType = "IMAGE" | "GIF" | "VIDEO";

interface MediaItem {
  id: number;
  type: MediaType;
  url: string;
  thumbnailUrl: string | null;
  sortOrder: number;
  primary: boolean;
}
interface CategoryItem { categoryKey: string; name: string }
interface SubCategoryItem { subCategoryKey: string; name: string }
interface LevelItem { levelKey: string; name: string; sortOrder: number }
interface ExerciseDetailItem { setup: string | null; benefits: string | null; safetyNotes: string | null; commonMistakes: string | null }
interface ExerciseMuscleList { role: string; muscleGroup: { muscleKey: string; name: string } }
export interface ExerciseMuscleGroup {
  id: number;
  muscleKey: string;
  name: string;
}
export interface CreateExerciseMuscleGroupRequest {
  muscleKey: string;
  name: string;
}
export interface UpdateExerciseMuscleGroupRequest {
  muscleKey?: string;
  name?: string;
}
export interface ExerciseResponseDto {
  id: number;
  exerciseKey: string;
  name: string;
  description: string | null;
  instructionsJson: string | null;
  difficulty: ExerciseDifficulty;
  exerciseType: ExerciseType;
  movementPattern: string | null;
  equipment: string;
  unilateral: boolean;
  supportsAiTracking: boolean;
  trackingConfigJson: string | null;
  published: boolean;
  media: MediaItem[];
  exerciseMuscles: ExerciseMuscleList[];
  category: CategoryItem | null;
  subCategory: SubCategoryItem | null;
  level: LevelItem | null;
  detail: ExerciseDetailItem | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkoutPlanExerciseResponse {
  exerciseId: number;
  exerciseKey: string;
  exerciseName: string;
  sortOrder: number;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetDurationSeconds: number | null;
  restSeconds: number | null;
  targetWeightKg: number | null;
  notes: string | null;
}
interface WorkoutDayResponse {
  id: number | null;
  dayNumber: number;
  name: string;
  restDay: boolean;
  exercises: WorkoutPlanExerciseResponse[];
}
export interface WorkoutPlanResponseDto {
  id: number;
  planKey: string;
  name: string;
  description: string | null;
  goal: string;
  difficulty: string;
  durationWeeks: number;
  daysPerWeek: number;
  estimatedSessionMinutes: number | null;
  equipmentRequirementsJson: string | null;
  published: boolean;
  version: number;
  days: WorkoutDayResponse[];
  createdAt: string;
  updatedAt: string;
}

interface ExerciseUpsertRequestDto {
  exerciseKey: string;
  name: string;
  description?: string | null;
  instructionsJson?: string | null;
  difficulty: ExerciseDifficulty;
  exerciseType: ExerciseType;
  movementPattern?: string | null;
  equipment: string;
  unilateral: boolean;
  supportsAiTracking: boolean;
  trackingConfigJson?: string | null;
  muscles?: { muscleKey: string; role: string }[] | null;
  clearMedia: boolean;
  category?: { categoryKey: string; name: string } | null;
  subCategory?: { subCategoryKey: string; name: string } | null;
  detail?: ExerciseDetailItem | null;
  clearClassification: boolean;
  clearDetail: boolean;
}

interface WorkoutPlanExerciseRequest {
  exerciseId: number;
  sortOrder: number;
  targetSets: number;
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  targetDurationSeconds?: number | null;
  restSeconds?: number | null;
  targetWeightKg?: number | null;
  notes?: string | null;
}
interface WorkoutDayRequest { dayNumber: number; name: string; restDay: boolean; exercises?: WorkoutPlanExerciseRequest[] }
interface WorkoutPlanUpsertRequestDto {
  planKey: string;
  name: string;
  description?: string | null;
  goal: string;
  difficulty: string;
  durationWeeks: number;
  daysPerWeek: number;
  estimatedSessionMinutes?: number | null;
  equipmentRequirementsJson?: string | null;
  days: WorkoutDayRequest[];
}

interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

type InspectorRecord = {
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

const emptyExercisePage: SpringPage<ExerciseResponseDto> = {
  content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, first: true, last: true, empty: true,
};
const emptyWorkoutPage: SpringPage<WorkoutPlanResponseDto> = {
  content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, first: true, last: true, empty: true,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isExercise(value: unknown): value is ExerciseResponseDto {
  if (!isObject(value)) return false;
  return typeof value.id === "number"
    && typeof value.exerciseKey === "string"
    && typeof value.name === "string";
}
function isMuscleGroup(value: unknown): value is ExerciseMuscleGroup {
  return isObject(value)
    && typeof value.id === "number"
    && typeof value.muscleKey === "string"
    && typeof value.name === "string";
}
function safeMediaUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
function isWorkout(value: unknown): value is WorkoutPlanResponseDto {
  return isObject(value)
    && typeof value.id === "number"
    && typeof value.planKey === "string"
    && typeof value.name === "string";
}

function normalizeSpringPage<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T,
  requestedPage: number,
  requestedSize: number,
): SpringPage<T> | null {
  if (Array.isArray(value)) {
    if (!value.every(itemGuard)) return null;
    const totalElements = value.length;
    const totalPages = totalElements ? 1 : 0;
    return {
      content: value,
      totalElements,
      totalPages,
      number: 0,
      size: requestedSize,
      first: true,
      last: true,
      empty: totalElements === 0,
    };
  }
  if (!isObject(value)) return null;

  const candidateContainers: unknown[] = [value];
  for (const key of ["data", "result", "page", "items", "records", "exercises", "workoutPlans"]) {
    const nested = value[key];
    if (isObject(nested) || Array.isArray(nested)) candidateContainers.push(nested);
  }

  for (const candidate of candidateContainers) {
    if (Array.isArray(candidate)) {
      if (!candidate.every(itemGuard)) continue;
      const totalElements = candidate.length;
      return {
        content: candidate,
        totalElements,
        totalPages: totalElements ? 1 : 0,
        number: 0,
        size: requestedSize,
        first: true,
        last: true,
        empty: totalElements === 0,
      };
    }
    if (!isObject(candidate)) continue;
    if (!Array.isArray(candidate.content)) continue;
    if (!candidate.content.every(itemGuard)) continue;

    const content = candidate.content;
    const numberValue = typeof candidate.number === "number" ? candidate.number : requestedPage;
    const sizeValue = typeof candidate.size === "number" ? candidate.size : requestedSize;
    const totalElements = typeof candidate.totalElements === "number"
      ? candidate.totalElements
      : content.length;
    const totalPages = typeof candidate.totalPages === "number"
      ? candidate.totalPages
      : totalElements === 0
        ? 0
        : Math.max(1, Math.ceil(totalElements / sizeValue));

    return {
      content,
      totalElements,
      totalPages,
      number: numberValue,
      size: sizeValue,
      first: typeof candidate.first === "boolean" ? candidate.first : numberValue <= 0,
      last: typeof candidate.last === "boolean" ? candidate.last : numberValue >= totalPages - 1,
      empty: typeof candidate.empty === "boolean" ? candidate.empty : content.length === 0,
    };
  }
  return null;
}

async function decodeResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return "204 No Content";
  const text = await response.text();
  if (!text) return "Empty response body.";
  try { return JSON.parse(text) as unknown; } catch { return text; }
}
function backendError(data: unknown, fallback: string): string {
  if (typeof data === "string") return data.split(/\r?\n\s*at\s+/)[0].trim();
  if (isObject(data)) {
    for (const key of ["detail", "message", "error", "title"]) {
      if (typeof data[key] === "string") return String(data[key]).split(/\r?\n\s*at\s+/)[0].trim();
    }
  }
  return fallback;
}
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function validJson(value: string): boolean {
  if (!value.trim()) return true;
  try { JSON.parse(value); return true; } catch { return false; }
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
  return <button type="button" className="exercise-icon-button" title={copied ? "Copied" : label} aria-label={copied ? "Copied" : label} onClick={() => void copy()}>{copied ? <Check size={13} /> : <Clipboard size={13} />}</button>;
}

function ExerciseMediaPreview({ media, exerciseName }: { media: MediaItem[]; exerciseName: string }) {
  const imageMedia = [...media]
    .filter((item) => item.type === "IMAGE" || item.type === "GIF")
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.sortOrder - b.sortOrder);
  const [failedIds, setFailedIds] = useState<number[]>([]);
  const visibleMedia = imageMedia.find((item) => !failedIds.includes(item.id) && safeMediaUrl(item.url));

  if (!imageMedia.length) {
    return <div className="exercise-media-empty">No image media is available for this exercise.</div>;
  }
  if (!visibleMedia) {
    return <div className="exercise-media-empty">Exercise image could not be loaded from the returned media URL.</div>;
  }

  const imageUrl = safeMediaUrl(visibleMedia.url);
  if (!imageUrl) return null;
  return (
    <figure className="exercise-media-preview">
      <img
        src={imageUrl}
        alt={`${exerciseName} exercise`}
        onError={() => setFailedIds((current) => [...current, visibleMedia.id])}
      />
      <figcaption>
        <span>{visibleMedia.primary ? "Primary media" : "Exercise media"} · {visibleMedia.type}</span>
        <a href={imageUrl} target="_blank" rel="noopener noreferrer" aria-label="Open exercise image in new tab">
          Open image <ExternalLink size={12} />
        </a>
      </figcaption>
    </figure>
  );
}

type ExerciseFormValues = {
  exerciseKey: string;
  name: string;
  description: string;
  instructionsJson: string;
  difficulty: ExerciseDifficulty;
  exerciseType: ExerciseType;
  movementPattern: string;
  equipment: string;
  unilateral: boolean;
  supportsAiTracking: boolean;
  trackingConfigJson: string;
  muscles: { muscleKey: string; role: string }[];
  categoryKey: string;
  categoryName: string;
  subCategoryKey: string;
  subCategoryName: string;
  setup: string;
  benefits: string;
  safetyNotes: string;
  commonMistakes: string;
  clearMedia: boolean;
  clearClassification: boolean;
  clearDetail: boolean;
};

function exerciseToForm(exercise?: ExerciseResponseDto): ExerciseFormValues {
  return exercise ? {
    exerciseKey: exercise.exerciseKey,
    name: exercise.name,
    description: exercise.description ?? "",
    instructionsJson: exercise.instructionsJson ?? "",
    difficulty: exercise.difficulty,
    exerciseType: exercise.exerciseType,
    movementPattern: exercise.movementPattern ?? "",
    equipment: exercise.equipment,
    unilateral: exercise.unilateral,
    supportsAiTracking: exercise.supportsAiTracking,
    trackingConfigJson: exercise.trackingConfigJson ?? "",
    muscles: exercise.exerciseMuscles.map((item) => ({ muscleKey: item.muscleGroup.muscleKey, role: item.role })),
    categoryKey: exercise.category?.categoryKey ?? "",
    categoryName: exercise.category?.name ?? "",
    subCategoryKey: exercise.subCategory?.subCategoryKey ?? "",
    subCategoryName: exercise.subCategory?.name ?? "",
    setup: exercise.detail?.setup ?? "",
    benefits: exercise.detail?.benefits ?? "",
    safetyNotes: exercise.detail?.safetyNotes ?? "",
    commonMistakes: exercise.detail?.commonMistakes ?? "",
    clearMedia: false,
    clearClassification: false,
    clearDetail: false,
  } : {
    exerciseKey: "", name: "", description: "", instructionsJson: "", difficulty: "BEGINNER",
    exerciseType: "STRENGTH", movementPattern: "", equipment: "", unilateral: false,
    supportsAiTracking: false, trackingConfigJson: "", muscles: [],
    categoryKey: "", categoryName: "", subCategoryKey: "", subCategoryName: "",
    setup: "", benefits: "", safetyNotes: "", commonMistakes: "",
    clearMedia: false, clearClassification: false, clearDetail: false,
  };
}

function ExerciseForm({
  exercise, busy, muscleGroups, muscleGroupsLoading, muscleGroupsError,
  onRefreshMuscleGroups, onCreateMuscleGroup, onCancel, onSubmit,
}: {
  exercise?: ExerciseResponseDto;
  busy: boolean;
  muscleGroups: ExerciseMuscleGroup[];
  muscleGroupsLoading: boolean;
  muscleGroupsError: string;
  onRefreshMuscleGroups: () => void;
  onCreateMuscleGroup: (request: CreateExerciseMuscleGroupRequest) => Promise<ExerciseMuscleGroup | null>;
  onCancel: () => void;
  onSubmit: (dto: ExerciseUpsertRequestDto, files: File[]) => void;
}) {
  const [form, setForm] = useState(() => exerciseToForm(exercise));
  const [submitted, setSubmitted] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateBusy, setQuickCreateBusy] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState("");
  const [quickMuscleKey, setQuickMuscleKey] = useState("");
  const [quickMuscleName, setQuickMuscleName] = useState("");
  const set = <K extends keyof ExerciseFormValues>(key: K, value: ExerciseFormValues[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const errors: Record<string, string> = {};
  if (!form.exerciseKey.trim()) errors.exerciseKey = "Exercise key is required.";
  else if (form.exerciseKey.length > 80) errors.exerciseKey = "Maximum 80 characters.";
  if (!form.name.trim()) errors.name = "Exercise name is required.";
  else if (form.name.length > 150) errors.name = "Maximum 150 characters.";
  if (form.description.length > 10000) errors.description = "Maximum 10,000 characters.";
  if (form.instructionsJson.length > 20000) errors.instructionsJson = "Maximum 20,000 characters.";
  else if (!validJson(form.instructionsJson)) errors.instructionsJson = "Enter valid JSON.";
  if (form.movementPattern.length > 40) errors.movementPattern = "Maximum 40 characters.";
  if (!form.equipment.trim()) errors.equipment = "Equipment is required.";
  else if (form.equipment.length > 40) errors.equipment = "Maximum 40 characters.";
  if (form.trackingConfigJson.length > 20000) errors.trackingConfigJson = "Maximum 20,000 characters.";
  else if (!validJson(form.trackingConfigJson)) errors.trackingConfigJson = "Enter valid JSON.";
  if (form.muscles.length > 20) errors.muscles = "Maximum 20 muscle assignments.";
  form.muscles.forEach((item, index) => {
    if (!item.muscleKey.trim()) errors[`muscleKey-${index}`] = "Muscle key is required.";
    else if (item.muscleKey.length > 80) errors[`muscleKey-${index}`] = "Maximum 80 characters.";
    if (!item.role) errors[`role-${index}`] = "Role is required.";
    else if (!["PRIMARY", "SECONDARY"].includes(item.role)) errors[`role-${index}`] = "Choose PRIMARY or SECONDARY.";
    if (item.muscleKey && form.muscles.some((other, otherIndex) => otherIndex !== index && other.muscleKey === item.muscleKey)) {
      errors[`muscleKey-${index}`] = "A muscle group can only be assigned once.";
    }
    if (item.role === "PRIMARY" && form.muscles.some((other, otherIndex) => otherIndex !== index && other.role === "PRIMARY")) {
      errors[`role-${index}`] = "Only one PRIMARY muscle assignment is allowed.";
    }
  });
  if ((form.categoryKey || form.categoryName) && (!form.categoryKey.trim() || !form.categoryName.trim())) {
    errors.category = "Category key and name are both required.";
  }
  if ((form.subCategoryKey || form.subCategoryName) && (!form.subCategoryKey.trim() || !form.subCategoryName.trim())) {
    errors.subCategory = "Subcategory key and name are both required.";
  }
  if (Object.values([form.setup, form.benefits, form.safetyNotes, form.commonMistakes]).some((value) => value.length > 10000)) {
    errors.detail = "Each detail field must be 10,000 characters or fewer.";
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const category = form.categoryKey.trim() || form.categoryName.trim()
      ? { categoryKey: form.categoryKey.trim(), name: form.categoryName.trim() } : null;
    const subCategory = form.subCategoryKey.trim() || form.subCategoryName.trim()
      ? { subCategoryKey: form.subCategoryKey.trim(), name: form.subCategoryName.trim() } : null;
    const detail = form.setup || form.benefits || form.safetyNotes || form.commonMistakes
      ? { setup: form.setup || null, benefits: form.benefits || null, safetyNotes: form.safetyNotes || null, commonMistakes: form.commonMistakes || null }
      : null;
    const dto: ExerciseUpsertRequestDto = {
      exerciseKey: form.exerciseKey.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      instructionsJson: form.instructionsJson.trim() || null,
      difficulty: form.difficulty,
      exerciseType: form.exerciseType,
      movementPattern: form.movementPattern.trim() || null,
      equipment: form.equipment.trim(),
      unilateral: form.unilateral,
      supportsAiTracking: form.supportsAiTracking,
      trackingConfigJson: form.trackingConfigJson.trim() || null,
      muscles: form.muscles.length ? form.muscles : null,
      clearMedia: form.clearMedia,
      category,
      subCategory,
      detail,
      clearClassification: form.clearClassification,
      clearDetail: form.clearDetail,
    };
    onSubmit(dto, files);
  }

  const err = (key: string) => submitted ? errors[key] : undefined;
  const disabled = busy || (submitted && Object.keys(errors).length > 0);
  return (
    <form className="exercise-form" onSubmit={submit} noValidate>
      <div className="exercise-form-grid">
        <section>
          <h3>Basic information</h3>
          <label><span>Exercise key <small>{form.exerciseKey.length}/80</small></span><input value={form.exerciseKey} maxLength={80} onChange={(e) => set("exerciseKey", e.target.value)} /><small>Required. Maximum 80 characters.</small>{err("exerciseKey") && <b className="exercise-field-error">{err("exerciseKey")}</b>}</label>
          <label><span>Exercise name <small>{form.name.length}/150</small></span><input value={form.name} maxLength={150} onChange={(e) => set("name", e.target.value)} /><small>Required. Maximum 150 characters.</small>{err("name") && <b className="exercise-field-error">{err("name")}</b>}</label>
          <label><span>Description <small>{form.description.length}/10,000</small></span><textarea rows={4} value={form.description} maxLength={10000} onChange={(e) => set("description", e.target.value)} /><small>Optional. Maximum 10,000 characters.</small>{err("description") && <b className="exercise-field-error">{err("description")}</b>}</label>
          <div className="exercise-form-two">
            <label><span>Difficulty</span><select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value as ExerciseDifficulty)}><option>BEGINNER</option><option>INTERMEDIATE</option><option>ADVANCED</option></select><small>Supported exercise difficulty.</small></label>
            <label><span>Exercise type</span><select value={form.exerciseType} onChange={(e) => set("exerciseType", e.target.value as ExerciseType)}><option>STRENGTH</option><option>CARDIO</option><option>MOBILITY</option><option>FLEXIBILITY</option><option>PLYOMETRIC</option></select><small>Supported exercise type.</small></label>
          </div>
          <label><span>Movement pattern <small>{form.movementPattern.length}/40</small></span><input value={form.movementPattern} maxLength={40} onChange={(e) => set("movementPattern", e.target.value)} /><small>Optional. Maximum 40 characters.</small>{err("movementPattern") && <b className="exercise-field-error">{err("movementPattern")}</b>}</label>
          <label><span>Equipment <small>{form.equipment.length}/40</small></span><input value={form.equipment} maxLength={40} onChange={(e) => set("equipment", e.target.value)} /><small>Required. Maximum 40 characters.</small>{err("equipment") && <b className="exercise-field-error">{err("equipment")}</b>}</label>
          <div className="exercise-toggle-row">
            <label><input type="checkbox" checked={form.unilateral} onChange={(e) => set("unilateral", e.target.checked)} /><span><strong>Unilateral exercise</strong><small>Requires separate left/right execution.</small></span></label>
            <label><input type="checkbox" checked={form.supportsAiTracking} onChange={(e) => set("supportsAiTracking", e.target.checked)} /><span><strong>Supports AI tracking</strong><small>Enable AI tracking configuration.</small></span></label>
          </div>
        </section>

        <section>
          <h3>JSON and classification</h3>
          <label><span>Instructions JSON <small>{form.instructionsJson.length}/20,000</small></span><textarea className="exercise-json" rows={6} value={form.instructionsJson} onChange={(e) => set("instructionsJson", e.target.value)} spellCheck={false} /><small>Optional JSON string. Maximum 20,000 characters.</small>{err("instructionsJson") && <b className="exercise-field-error">{err("instructionsJson")}</b>}</label>
          <label><span>AI tracking configuration <small>{form.trackingConfigJson.length}/20,000</small></span><textarea className="exercise-json" rows={6} value={form.trackingConfigJson} onChange={(e) => set("trackingConfigJson", e.target.value)} spellCheck={false} /><small>Optional JSON string. Maximum 20,000 characters.</small>{err("trackingConfigJson") && <b className="exercise-field-error">{err("trackingConfigJson")}</b>}</label>
          <div className="exercise-form-two">
            <label><span>Category key</span><input value={form.categoryKey} maxLength={80} onChange={(e) => set("categoryKey", e.target.value)} /><small>Optional. Maximum 80 characters.</small></label>
            <label><span>Category name</span><input value={form.categoryName} maxLength={100} onChange={(e) => set("categoryName", e.target.value)} /><small>Required with category key.</small></label>
          </div>
          {err("category") && <b className="exercise-field-error">{err("category")}</b>}
          <div className="exercise-form-two">
            <label><span>Subcategory key</span><input value={form.subCategoryKey} maxLength={80} onChange={(e) => set("subCategoryKey", e.target.value)} /><small>Optional. Maximum 80 characters.</small></label>
            <label><span>Subcategory name</span><input value={form.subCategoryName} maxLength={100} onChange={(e) => set("subCategoryName", e.target.value)} /><small>Required with subcategory key.</small></label>
          </div>
          {err("subCategory") && <b className="exercise-field-error">{err("subCategory")}</b>}
          {exercise?.level && <div className="exercise-existing-level"><span>Existing level</span><strong>{exercise.level.name}</strong><small>{exercise.level.levelKey} · Sort order {exercise.level.sortOrder}</small></div>}
        </section>

        <section className="exercise-form-full">
          <div className="exercise-section-heading"><div><h3>Muscle assignments</h3><p className="exercise-form-section-help">Select from backend-managed muscle groups. Each group can be assigned once; only one assignment may be PRIMARY.</p></div><div className="exercise-section-actions"><button type="button" className="exercise-secondary" onClick={onRefreshMuscleGroups} disabled={muscleGroupsLoading}><RefreshCw size={13} className={muscleGroupsLoading ? "exercise-spin" : ""} /> Refresh</button><button type="button" className="exercise-secondary" disabled={form.muscles.length >= 20 || muscleGroupsLoading || !muscleGroups.length} onClick={() => set("muscles", [...form.muscles, { muscleKey: "", role: "SECONDARY" }])}><Plus size={13} /> Add Muscle</button></div></div>
          {muscleGroupsLoading && <div className="exercise-muscle-state"><LoaderCircle size={14} className="exercise-spin" /> Loading muscle groups…</div>}
          {muscleGroupsError && <div className="exercise-muscle-error"><AlertCircle size={13} /><span>{muscleGroupsError}</span><button type="button" className="exercise-text-button" onClick={onRefreshMuscleGroups}>Retry</button></div>}
          {!muscleGroupsLoading && !muscleGroupsError && muscleGroups.length === 0 && <div className="exercise-muscle-state"><span>No muscle groups are available.</span><button type="button" className="exercise-text-button" onClick={() => setQuickCreateOpen(true)}>Create a muscle group</button></div>}
          {err("muscles") && <b className="exercise-field-error">{err("muscles")}</b>}
          <div className="exercise-muscle-list">
            {form.muscles.length === 0 && <p className="exercise-helper-empty">No muscle assignments. Add a row and select a muscle group from the backend list.</p>}
            {form.muscles.map((item, index) => (
              <div className="exercise-muscle-row" key={index}>
                <label><span>Muscle group</span><select value={item.muscleKey} disabled={muscleGroupsLoading || !muscleGroups.length} onChange={(e) => set("muscles", form.muscles.map((muscle, i) => i === index ? { ...muscle, muscleKey: e.target.value } : muscle))}><option value="">Select muscle group</option>{item.muscleKey && !muscleGroups.some((group) => group.muscleKey === item.muscleKey) && <option value={item.muscleKey}>{item.muscleKey} (no longer available)</option>}{muscleGroups.map((group) => <option key={group.id} value={group.muscleKey} disabled={form.muscles.some((other, otherIndex) => otherIndex !== index && other.muscleKey === group.muscleKey)}>{group.name} — {group.muscleKey}</option>)}</select><small>{muscleGroupsLoading ? "Loading available muscle groups…" : "Required. Select a backend muscle group."}</small>{err(`muscleKey-${index}`) && <b className="exercise-field-error">{err(`muscleKey-${index}`)}</b>}{item.muscleKey && !muscleGroups.some((group) => group.muscleKey === item.muscleKey) && <b className="exercise-field-warning">This existing muscle key is no longer in the muscle group list; it is preserved until you change or remove it.</b>}</label>
                <label><span>Role</span><select value={item.role} onChange={(e) => set("muscles", form.muscles.map((muscle, i) => i === index ? { ...muscle, role: e.target.value } : muscle))}><option value="">Select role</option><option value="PRIMARY" disabled={form.muscles.some((other, otherIndex) => otherIndex !== index && other.role === "PRIMARY")}>PRIMARY</option><option value="SECONDARY">SECONDARY</option></select><small>Required. Only one PRIMARY assignment is allowed.</small>{err(`role-${index}`) && <b className="exercise-field-error">{err(`role-${index}`)}</b>}</label>
                <button type="button" className="exercise-icon-button exercise-danger-icon" aria-label="Remove muscle assignment" onClick={() => set("muscles", form.muscles.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          {quickCreateOpen && createPortal(<div className="exercise-inline-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !quickCreateBusy) setQuickCreateOpen(false); }}><section className="exercise-inline-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-muscle-title"><header><div><h4 id="quick-muscle-title">Create muscle group</h4><p>Save a muscle group without closing or clearing this exercise form.</p></div><button type="button" className="exercise-icon-button" aria-label="Close dialog" disabled={quickCreateBusy} onClick={() => setQuickCreateOpen(false)}><X size={14} /></button></header><label><span>Muscle key</span><input value={quickMuscleKey} maxLength={80} onChange={(event) => setQuickMuscleKey(event.target.value)} /><small>Required. Maximum 80 characters.</small></label><label><span>Muscle name</span><input value={quickMuscleName} maxLength={100} onChange={(event) => setQuickMuscleName(event.target.value)} /><small>Required. Maximum 100 characters.</small></label>{quickCreateError && <div className="exercise-inline-error"><AlertCircle size={13} />{quickCreateError}</div>}<footer><button type="button" className="exercise-secondary" disabled={quickCreateBusy} onClick={() => setQuickCreateOpen(false)}>Cancel</button><button type="button" className="exercise-primary" disabled={quickCreateBusy || !quickMuscleKey.trim() || !quickMuscleName.trim()} onClick={async () => { const muscleKey = quickMuscleKey.trim(); const name = quickMuscleName.trim(); if (!muscleKey || muscleKey.length > 80 || !name || name.length > 100) { setQuickCreateError("Enter a key (up to 80 characters) and name (up to 100 characters)."); return; } setQuickCreateBusy(true); setQuickCreateError(""); const created = await onCreateMuscleGroup({ muscleKey, name }); setQuickCreateBusy(false); if (created) { const emptyIndex = form.muscles.findIndex((entry) => !entry.muscleKey); if (emptyIndex >= 0) set("muscles", form.muscles.map((entry, i) => i === emptyIndex ? { ...entry, muscleKey: created.muscleKey } : entry)); else if (form.muscles.length < 20) set("muscles", [...form.muscles, { muscleKey: created.muscleKey, role: "SECONDARY" }]); setQuickMuscleKey(""); setQuickMuscleName(""); setQuickCreateOpen(false); } else setQuickCreateError("Muscle group could not be created. Review the API operation and try again."); }}><Plus size={13} />{quickCreateBusy ? "Creating…" : "Create and use"}</button></footer></section></div>, document.body)}
        </section>

        <section className="exercise-form-full">
          <h3>Exercise details</h3>
          <div className="exercise-form-two">
            <label><span>Setup <small>{form.setup.length}/10,000</small></span><textarea rows={4} value={form.setup} maxLength={10000} onChange={(e) => set("setup", e.target.value)} /><small>Optional. Maximum 10,000 characters.</small></label>
            <label><span>Benefits <small>{form.benefits.length}/10,000</small></span><textarea rows={4} value={form.benefits} maxLength={10000} onChange={(e) => set("benefits", e.target.value)} /><small>Optional. Maximum 10,000 characters.</small></label>
            <label><span>Safety notes <small>{form.safetyNotes.length}/10,000</small></span><textarea rows={4} value={form.safetyNotes} maxLength={10000} onChange={(e) => set("safetyNotes", e.target.value)} /><small>Optional. Maximum 10,000 characters.</small></label>
            <label><span>Common mistakes <small>{form.commonMistakes.length}/10,000</small></span><textarea rows={4} value={form.commonMistakes} maxLength={10000} onChange={(e) => set("commonMistakes", e.target.value)} /><small>Optional. Maximum 10,000 characters.</small></label>
          </div>
          {err("detail") && <b className="exercise-field-error">{err("detail")}</b>}
        </section>

        <section className="exercise-form-full">
          <h3>Media</h3>
          {exercise?.media.length ? <div className="exercise-existing-media">{exercise.media.map((item) => <div key={item.id}><span>{item.type}</span><strong>{item.primary ? "Primary" : "Sort " + item.sortOrder}</strong><small>{item.url}</small></div>)}</div> : <p className="exercise-helper-empty">No existing media returned by the API.</p>}
          <label className="exercise-file-picker"><Upload size={18} /><span><strong>Select media files</strong><small>Images, GIFs and videos supported by the backend. The browser does not enforce undocumented limits.</small></span><input type="file" multiple accept="image/*,video/*,.gif" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></label>
          {files.length > 0 && <div className="exercise-selected-files">{files.map((file, index) => <div key={`${file.name}-${index}`}><strong>{file.name}</strong><small>{file.type || "Unknown type"} · {Math.max(1, Math.round(file.size / 1024))} KB</small><button type="button" className="exercise-icon-button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}><X size={13} /></button></div>)}</div>}
          {exercise && <div className="exercise-clear-options"><label><input type="checkbox" checked={form.clearMedia} onChange={(e) => set("clearMedia", e.target.checked)} /><span><strong>Clear existing media</strong><small>Send clearMedia=true. This is a destructive update action.</small></span></label><label><input type="checkbox" checked={form.clearClassification} onChange={(e) => set("clearClassification", e.target.checked)} /><span><strong>Clear classification</strong><small>Send clearClassification=true.</small></span></label><label><input type="checkbox" checked={form.clearDetail} onChange={(e) => set("clearDetail", e.target.checked)} /><span><strong>Clear exercise detail</strong><small>Send clearDetail=true.</small></span></label></div>}
        </section>
      </div>
      <footer className="exercise-form-footer"><button type="button" className="exercise-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="exercise-primary" disabled={disabled}>{busy ? <LoaderCircle size={14} className="exercise-spin" /> : <Check size={14} />}{busy ? "Saving…" : exercise ? "Save exercise" : "Create exercise"}</button></footer>
    </form>
  );
}

type WorkoutDayForm = WorkoutDayRequest;
type WorkoutFormValues = {
  planKey: string;
  name: string;
  description: string;
  goal: string;
  difficulty: string;
  durationWeeks: number;
  daysPerWeek: number;
  estimatedSessionMinutes: number;
  equipmentRequirementsJson: string;
  days: WorkoutDayForm[];
};

function workoutToForm(plan?: WorkoutPlanResponseDto): WorkoutFormValues {
  return plan ? {
    planKey: plan.planKey,
    name: plan.name,
    description: plan.description ?? "",
    goal: plan.goal,
    difficulty: plan.difficulty,
    durationWeeks: plan.durationWeeks,
    daysPerWeek: plan.daysPerWeek,
    estimatedSessionMinutes: plan.estimatedSessionMinutes ?? 0,
    equipmentRequirementsJson: plan.equipmentRequirementsJson ?? "",
    days: plan.days.map((day) => ({
      dayNumber: day.dayNumber,
      name: day.name,
      restDay: day.restDay,
      exercises: day.exercises.map((item) => ({
        exerciseId: item.exerciseId,
        sortOrder: item.sortOrder,
        targetSets: item.targetSets,
        targetRepsMin: item.targetRepsMin,
        targetRepsMax: item.targetRepsMax,
        targetDurationSeconds: item.targetDurationSeconds,
        restSeconds: item.restSeconds,
        targetWeightKg: item.targetWeightKg,
        notes: item.notes,
      })),
    })),
  } : {
    planKey: "", name: "", description: "", goal: "", difficulty: "", durationWeeks: 1,
    daysPerWeek: 1, estimatedSessionMinutes: 0, equipmentRequirementsJson: "", days: [],
  };
}

function WorkoutForm({
  plan, exercises, busy, onCancel, onSubmit,
}: {
  plan?: WorkoutPlanResponseDto;
  exercises: ExerciseResponseDto[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (dto: WorkoutPlanUpsertRequestDto) => void;
}) {
  const [form, setForm] = useState(() => workoutToForm(plan));
  const [submitted, setSubmitted] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const set = <K extends keyof WorkoutFormValues>(key: K, value: WorkoutFormValues[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const errors: Record<string, string> = {};
  if (!form.planKey.trim()) errors.planKey = "Plan key is required.";
  else if (form.planKey.length > 80) errors.planKey = "Maximum 80 characters.";
  if (!form.name.trim()) errors.name = "Plan name is required.";
  else if (form.name.length > 150) errors.name = "Maximum 150 characters.";
  if (form.description.length > 10000) errors.description = "Maximum 10,000 characters.";
  if (!form.goal.trim()) errors.goal = "Goal is required.";
  else if (form.goal.length > 30) errors.goal = "Maximum 30 characters.";
  if (!form.difficulty.trim()) errors.difficulty = "Difficulty is required.";
  else if (form.difficulty.length > 20) errors.difficulty = "Maximum 20 characters.";
  if (!Number.isInteger(form.durationWeeks) || form.durationWeeks < 1 || form.durationWeeks > 52) errors.durationWeeks = "Must be between 1 and 52 weeks.";
  if (!Number.isInteger(form.daysPerWeek) || form.daysPerWeek < 1 || form.daysPerWeek > 7) errors.daysPerWeek = "Must be between 1 and 7.";
  if (form.estimatedSessionMinutes && (!Number.isInteger(form.estimatedSessionMinutes) || form.estimatedSessionMinutes < 1 || form.estimatedSessionMinutes > 600)) errors.estimatedSessionMinutes = "Must be between 1 and 600 minutes.";
  if (form.equipmentRequirementsJson.length > 5000) errors.equipmentRequirementsJson = "Maximum 5,000 characters.";
  else if (!validJson(form.equipmentRequirementsJson)) errors.equipmentRequirementsJson = "Enter valid JSON.";
  if (!form.days.length) errors.days = "Add at least one workout day.";

  const dayNumbers = new Set<number>();
  form.days.forEach((day, dayIndex) => {
    if (dayNumbers.has(day.dayNumber)) errors[`dayNumber-${dayIndex}`] = "Day numbers must be unique.";
    dayNumbers.add(day.dayNumber);
    if (!day.name.trim()) errors[`dayName-${dayIndex}`] = "Day name is required.";
    else if (day.name.length > 100) errors[`dayName-${dayIndex}`] = "Maximum 100 characters.";
    if ((day.exercises?.length ?? 0) > 7) errors[`dayExercises-${dayIndex}`] = "Maximum 7 exercises per day.";
    day.exercises?.forEach((item, itemIndex) => {
      if (!item.exerciseId || item.exerciseId < 1) errors[`exerciseId-${dayIndex}-${itemIndex}`] = "Select an exercise.";
      if (item.sortOrder < 0) errors[`exerciseSort-${dayIndex}-${itemIndex}`] = "Sort order must be 0 or greater.";
      if (!Number.isInteger(item.targetSets) || item.targetSets < 1 || item.targetSets > 100) errors[`exerciseSets-${dayIndex}-${itemIndex}`] = "Sets must be between 1 and 100.";
      if (item.targetRepsMin != null && item.targetRepsMin < 1) errors[`exerciseReps-${dayIndex}-${itemIndex}`] = "Minimum reps must be at least 1.";
      if (item.targetRepsMax != null && item.targetRepsMax < 1) errors[`exerciseReps-${dayIndex}-${itemIndex}`] = "Maximum reps must be at least 1.";
      if (item.targetRepsMin != null && item.targetRepsMax != null && item.targetRepsMin > item.targetRepsMax) errors[`exerciseReps-${dayIndex}-${itemIndex}`] = "Minimum reps cannot exceed maximum reps.";
      if (item.targetDurationSeconds != null && item.targetDurationSeconds < 1) errors[`exerciseDuration-${dayIndex}-${itemIndex}`] = "Duration must be at least 1 second.";
      if (item.restSeconds != null && (item.restSeconds < 0 || item.restSeconds > 3600)) errors[`exerciseRest-${dayIndex}-${itemIndex}`] = "Rest must be between 0 and 3600 seconds.";
      if (item.targetWeightKg != null && item.targetWeightKg < 0) errors[`exerciseWeight-${dayIndex}-${itemIndex}`] = "Weight cannot be negative.";
      if ((item.notes?.length ?? 0) > 2000) errors[`exerciseNotes-${dayIndex}-${itemIndex}`] = "Maximum 2,000 characters.";
    });
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    onSubmit({
      planKey: form.planKey.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      goal: form.goal.trim(),
      difficulty: form.difficulty.trim(),
      durationWeeks: form.durationWeeks,
      daysPerWeek: form.daysPerWeek,
      estimatedSessionMinutes: form.estimatedSessionMinutes || null,
      equipmentRequirementsJson: form.equipmentRequirementsJson.trim() || null,
      days: form.days.map((day) => ({
        dayNumber: day.dayNumber,
        name: day.name.trim(),
        restDay: day.restDay,
        exercises: day.restDay ? [] : (day.exercises ?? []).map((item, index) => ({
          ...item,
          sortOrder: item.sortOrder ?? index,
          notes: item.notes?.trim() || null,
        })),
      })),
    });
  }

  function addDay() {
    const nextNumber = form.days.length ? Math.max(...form.days.map((day) => day.dayNumber)) + 1 : 1;
    set("days", [...form.days, { dayNumber: nextNumber, name: `Day ${nextNumber}`, restDay: false, exercises: [] }]);
  }
  function updateDay(dayIndex: number, patch: Partial<WorkoutDayForm>) {
    set("days", form.days.map((day, index) => index === dayIndex ? { ...day, ...patch } : day));
  }
  function updateExercise(dayIndex: number, exerciseIndex: number, patch: Partial<WorkoutPlanExerciseRequest>) {
    set("days", form.days.map((day, index) => index === dayIndex
      ? { ...day, exercises: day.exercises?.map((item, i) => i === exerciseIndex ? { ...item, ...patch } : item) ?? [] }
      : day));
  }
  function addExercise(dayIndex: number, exercise: ExerciseResponseDto) {
    const day = form.days[dayIndex];
    if ((day.exercises?.length ?? 0) >= 7) return;
    updateDay(dayIndex, { exercises: [...(day.exercises ?? []), {
      exerciseId: exercise.id, sortOrder: day.exercises?.length ?? 0, targetSets: 3,
    }] });
    setPickerDay(null);
  }
  const err = (key: string) => submitted ? errors[key] : undefined;
  const filteredPickerExercises = exercises.filter((exercise) => {
    const query = exerciseSearch.trim().toLowerCase();
    return !query || `${exercise.name} ${exercise.exerciseKey} ${exercise.id}`.toLowerCase().includes(query);
  });

  return (
    <form className="exercise-form workout-form" onSubmit={submit} noValidate>
      <div className="exercise-form-grid">
        <section>
          <h3>Plan information</h3>
          <label><span>Plan key <small>{form.planKey.length}/80</small></span><input value={form.planKey} maxLength={80} onChange={(e) => set("planKey", e.target.value)} /><small>Required. Maximum 80 characters.</small>{err("planKey") && <b className="exercise-field-error">{err("planKey")}</b>}</label>
          <label><span>Plan name <small>{form.name.length}/150</small></span><input value={form.name} maxLength={150} onChange={(e) => set("name", e.target.value)} /><small>Required. Maximum 150 characters.</small>{err("name") && <b className="exercise-field-error">{err("name")}</b>}</label>
          <label><span>Description <small>{form.description.length}/10,000</small></span><textarea rows={4} value={form.description} maxLength={10000} onChange={(e) => set("description", e.target.value)} /><small>Optional. Maximum 10,000 characters.</small>{err("description") && <b className="exercise-field-error">{err("description")}</b>}</label>
          <div className="exercise-form-two">
            <label><span>Goal</span><input value={form.goal} maxLength={30} onChange={(e) => set("goal", e.target.value)} /><small>Required. Maximum 30 characters.</small>{err("goal") && <b className="exercise-field-error">{err("goal")}</b>}</label>
            <label><span>Difficulty</span><input value={form.difficulty} maxLength={20} onChange={(e) => set("difficulty", e.target.value)} /><small>Required. Maximum 20 characters.</small>{err("difficulty") && <b className="exercise-field-error">{err("difficulty")}</b>}</label>
          </div>
          <div className="exercise-form-three">
            <label><span>Duration</span><input type="number" min={1} max={52} value={form.durationWeeks} onChange={(e) => set("durationWeeks", Number(e.target.value))} /><small>1–52 weeks.</small>{err("durationWeeks") && <b className="exercise-field-error">{err("durationWeeks")}</b>}</label>
            <label><span>Days per week</span><input type="number" min={1} max={7} value={form.daysPerWeek} onChange={(e) => set("daysPerWeek", Number(e.target.value))} /><small>1–7 days.</small>{err("daysPerWeek") && <b className="exercise-field-error">{err("daysPerWeek")}</b>}</label>
            <label><span>Session minutes</span><input type="number" min={1} max={600} value={form.estimatedSessionMinutes || ""} onChange={(e) => set("estimatedSessionMinutes", Number(e.target.value))} /><small>Optional. 1–600.</small>{err("estimatedSessionMinutes") && <b className="exercise-field-error">{err("estimatedSessionMinutes")}</b>}</label>
          </div>
          <label><span>Equipment requirements JSON <small>{form.equipmentRequirementsJson.length}/5,000</small></span><textarea className="exercise-json" rows={6} value={form.equipmentRequirementsJson} onChange={(e) => set("equipmentRequirementsJson", e.target.value)} /><small>Optional JSON string. Maximum 5,000 characters.</small>{err("equipmentRequirementsJson") && <b className="exercise-field-error">{err("equipmentRequirementsJson")}</b>}</label>
        </section>

        <section className="exercise-form-full workout-builder">
          <div className="exercise-section-heading"><h3>Workout schedule</h3><button type="button" className="exercise-secondary" onClick={addDay}><Plus size={13} /> Add day</button></div>
          {err("days") && <b className="exercise-field-error">{err("days")}</b>}
          {form.days.length === 0 && <p className="exercise-helper-empty">No workout days yet. Add a day to configure the real schedule.</p>}
          <div className="exercise-day-list">
            {form.days.map((day, dayIndex) => (
              <article className="exercise-day-card" key={dayIndex}>
                <header>
                  <label><span>Day number</span><input type="number" min={1} value={day.dayNumber} onChange={(e) => updateDay(dayIndex, { dayNumber: Number(e.target.value) })} />{err(`dayNumber-${dayIndex}`) && <b className="exercise-field-error">{err(`dayNumber-${dayIndex}`)}</b>}</label>
                  <label><span>Day name</span><input value={day.name} maxLength={100} onChange={(e) => updateDay(dayIndex, { name: e.target.value })} />{err(`dayName-${dayIndex}`) && <b className="exercise-field-error">{err(`dayName-${dayIndex}`)}</b>}</label>
                  <label className="exercise-rest-toggle"><input type="checkbox" checked={day.restDay} onChange={(e) => updateDay(dayIndex, { restDay: e.target.checked })} /><span><strong>Rest day</strong><small>Hide workout assignments.</small></span></label>
                  <button type="button" className="exercise-icon-button exercise-danger-icon" aria-label={`Remove ${day.name}`} onClick={() => set("days", form.days.filter((_, i) => i !== dayIndex))}><Trash2 size={14} /></button>
                </header>
                {day.restDay ? <p className="exercise-rest-state">Rest day · Exercise assignments are not submitted.</p> : (
                  <>
                    <div className="exercise-day-exercises">
                      {(day.exercises ?? []).map((item, exerciseIndex) => {
                        const exercise = exercises.find((entry) => entry.id === item.exerciseId);
                        return (
                          <div className="exercise-plan-exercise" key={exerciseIndex}>
                            <div className="exercise-plan-exercise-name"><strong>{exercise?.name ?? `Exercise ID ${item.exerciseId}`}</strong><small>{exercise?.exerciseKey ?? "Selected from catalog"}</small></div>
                            <label><span>Sets</span><input type="number" min={1} max={100} value={item.targetSets} onChange={(e) => updateExercise(dayIndex, exerciseIndex, { targetSets: Number(e.target.value) })} /></label>
                            <label><span>Min reps</span><input type="number" min={1} value={item.targetRepsMin ?? ""} onChange={(e) => updateExercise(dayIndex, exerciseIndex, { targetRepsMin: e.target.value ? Number(e.target.value) : null })} /></label>
                            <label><span>Max reps</span><input type="number" min={1} value={item.targetRepsMax ?? ""} onChange={(e) => updateExercise(dayIndex, exerciseIndex, { targetRepsMax: e.target.value ? Number(e.target.value) : null })} /></label>
                            <label><span>Duration sec</span><input type="number" min={1} value={item.targetDurationSeconds ?? ""} onChange={(e) => updateExercise(dayIndex, exerciseIndex, { targetDurationSeconds: e.target.value ? Number(e.target.value) : null })} /></label>
                            <label><span>Rest sec</span><input type="number" min={0} max={3600} value={item.restSeconds ?? ""} onChange={(e) => updateExercise(dayIndex, exerciseIndex, { restSeconds: e.target.value ? Number(e.target.value) : null })} /></label>
                            <label><span>Weight kg</span><input type="number" min={0} step="0.1" value={item.targetWeightKg ?? ""} onChange={(e) => updateExercise(dayIndex, exerciseIndex, { targetWeightKg: e.target.value ? Number(e.target.value) : null })} /></label>
                            <label><span>Sort order</span><input type="number" min={0} value={item.sortOrder} onChange={(e) => updateExercise(dayIndex, exerciseIndex, { sortOrder: Number(e.target.value) })} /></label>
                            <label className="exercise-plan-notes"><span>Notes <small>{item.notes?.length ?? 0}/2,000</small></span><textarea rows={2} value={item.notes ?? ""} maxLength={2000} onChange={(e) => updateExercise(dayIndex, exerciseIndex, { notes: e.target.value || null })} /></label>
                            <button type="button" className="exercise-icon-button exercise-danger-icon" aria-label="Remove exercise" onClick={() => updateDay(dayIndex, { exercises: (day.exercises ?? []).filter((_, i) => i !== exerciseIndex) })}><Trash2 size={14} /></button>
                            {err(`exerciseReps-${dayIndex}-${exerciseIndex}`) && <b className="exercise-field-error exercise-plan-error">{err(`exerciseReps-${dayIndex}-${exerciseIndex}`)}</b>}
                          </div>
                        );
                      })}
                    </div>
                    {err(`dayExercises-${dayIndex}`) && <b className="exercise-field-error">{err(`dayExercises-${dayIndex}`)}</b>}
                    <button type="button" className="exercise-secondary" disabled={(day.exercises?.length ?? 0) >= 7} onClick={() => setPickerDay(pickerDay === dayIndex ? null : dayIndex)}><Plus size={13} /> Add exercise</button>
                    {pickerDay === dayIndex && <div className="exercise-picker">
                      <label className="exercise-search"><Search size={14} /><input value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Search real exercise catalog" /></label>
                      <div className="exercise-picker-results">{filteredPickerExercises.map((exercise) => <button type="button" key={exercise.id} onClick={() => addExercise(dayIndex, exercise)}><strong>{exercise.name}</strong><small>{exercise.exerciseKey} · {exercise.difficulty} · {exercise.equipment}</small></button>)}</div>
                      {!filteredPickerExercises.length && <p>No exercises found in the catalog response.</p>}
                    </div>}
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
      <footer className="exercise-form-footer"><button type="button" className="exercise-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="exercise-primary" disabled={busy}>{busy ? <LoaderCircle size={14} className="exercise-spin" /> : <Check size={14} />}{busy ? "Saving…" : plan ? "Save plan" : "Create plan"}</button></footer>
    </form>
  );
}

function muscleGroupList(value: unknown): ExerciseMuscleGroup[] | null {
  const candidate = isObject(value) ? (value.data ?? value.muscleGroups ?? value.content) : value;
  return Array.isArray(candidate) && candidate.every(isMuscleGroup) ? candidate : null;
}

function MuscleGroupsManager({
  groups, loading, error, onRefresh, onCreate, onUpdate, onDelete,
}: {
  groups: ExerciseMuscleGroup[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onCreate: (request: CreateExerciseMuscleGroupRequest) => Promise<ExerciseMuscleGroup | null>;
  onUpdate: (id: number, request: UpdateExerciseMuscleGroupRequest) => Promise<boolean>;
  onDelete: (group: ExerciseMuscleGroup) => Promise<boolean>;
}) {
  const [dialog, setDialog] = useState<"create" | "edit" | "delete" | null>(null);
  const [selected, setSelected] = useState<ExerciseMuscleGroup | null>(null);
  const [muscleKey, setMuscleKey] = useState("");
  const [name, setName] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const keyError = keyTouched && (!muscleKey.trim() ? "Muscle key is required." : muscleKey.length > 80 ? "Maximum 80 characters." : "");
  const nameError = nameTouched && (!name.trim() ? "Muscle name is required." : name.length > 100 ? "Maximum 100 characters." : "");
  function openCreate() {
    setSelected(null);
    setMuscleKey("");
    setName("");
    setFormError("");
    setKeyTouched(false);
    setNameTouched(false);
    setDialog("create");
  }
  function openEdit(group: ExerciseMuscleGroup) {
    setSelected(group);
    setMuscleKey(group.muscleKey);
    setName(group.name);
    setFormError("");
    setKeyTouched(false);
    setNameTouched(false);
    setDialog("edit");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setKeyTouched(true);
    setNameTouched(true);
    const trimmedKey = muscleKey.trim();
    const trimmedName = name.trim();
    if (!trimmedKey || trimmedKey.length > 80 || !trimmedName || trimmedName.length > 100) return;
    setBusy(true);
    setFormError("");
    if (dialog === "create") {
      const created = await onCreate({ muscleKey: trimmedKey, name: trimmedName });
      setBusy(false);
      if (created) setDialog(null);
      else setFormError("Could not create muscle group. Check the API Inspector for the backend response.");
      return;
    }
    if (dialog === "edit" && selected) {
      const request: UpdateExerciseMuscleGroupRequest = {};
      if (trimmedKey !== selected.muscleKey) request.muscleKey = trimmedKey;
      if (trimmedName !== selected.name) request.name = trimmedName;
      if (!Object.keys(request).length) {
        setBusy(false);
        setDialog(null);
        return;
      }
      const succeeded = await onUpdate(selected.id, request);
      setBusy(false);
      if (succeeded) setDialog(null);
      else setFormError("Could not update muscle group. Check the API Inspector for the backend response.");
    }
  }

  return (
    <section className="exercise-panel muscle-groups-panel">
      <div className="exercise-panel-heading"><div><h2>Muscle Groups</h2><p>Manage backend muscle groups used by exercise assignments.</p></div><div className="exercise-muscle-manager-actions"><button type="button" className="exercise-secondary" disabled={loading} onClick={onRefresh}><RefreshCw size={13} className={loading ? "exercise-spin" : ""} /> Refresh</button><button type="button" className="exercise-primary" onClick={openCreate}><Plus size={14} /> Add Muscle Group</button></div></div>
      {error ? <div className="exercise-state exercise-error-state"><AlertCircle size={20} /><strong>Unable to load muscle groups</strong><span>{error}</span><button type="button" className="exercise-secondary" onClick={onRefresh}><RefreshCw size={13} /> Retry</button></div>
        : loading ? <div className="muscle-group-skeletons" role="status" aria-label="Loading muscle groups">{Array.from({ length: 4 }, (_, index) => <div className="muscle-group-skeleton-row" key={index}><span /><span /><span /><span /></div>)}</div>
          : groups.length === 0 ? <div className="exercise-state"><Dumbbell size={21} /><strong>No muscle groups found</strong><span>Create muscle groups here to make them available in exercise assignments.</span><button type="button" className="exercise-primary" onClick={openCreate}><Plus size={13} /> Add Muscle Group</button></div>
            : <div className="exercise-table-wrap"><table className="exercise-table muscle-group-table"><thead><tr><th>ID</th><th>Muscle key</th><th>Muscle name</th><th>Actions</th></tr></thead><tbody>{groups.map((group) => <tr key={group.id}><td>{group.id}</td><td><code>{group.muscleKey}</code></td><td>{group.name}</td><td><div className="exercise-row-actions"><button type="button" className="exercise-small-button" onClick={() => openEdit(group)}><Edit3 size={12} /> Edit</button><button type="button" className="exercise-icon-button exercise-danger-icon" aria-label={`Delete ${group.name}`} title="Delete muscle group" onClick={() => { setSelected(group); setDialog("delete"); }}><Trash2 size={13} /></button></div></td></tr>)}</tbody></table><div className="exercise-mobile-muscle-list">{groups.map((group) => <article key={group.id}><span>ID {group.id}</span><strong>{group.name}</strong><code>{group.muscleKey}</code><div className="exercise-row-actions"><button type="button" className="exercise-small-button" onClick={() => openEdit(group)}><Edit3 size={12} /> Edit</button><button type="button" className="exercise-icon-button exercise-danger-icon" aria-label={`Delete ${group.name}`} onClick={() => { setSelected(group); setDialog("delete"); }}><Trash2 size={13} /></button></div></article>)}</div></div>}

      {dialog && createPortal(<div className="exercise-inline-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setDialog(null); }}><section className="exercise-inline-dialog" role="dialog" aria-modal="true" aria-labelledby="muscle-dialog-title"><header><div><h4 id="muscle-dialog-title">{dialog === "create" ? "Add muscle group" : dialog === "edit" ? "Edit muscle group" : "Delete muscle group?"}</h4><p>{dialog === "delete" ? "Deletion may be blocked while exercises reference this group." : "This group will be available for exercise muscle assignments."}</p></div><button type="button" className="exercise-icon-button" aria-label="Close dialog" disabled={busy} onClick={() => setDialog(null)}><X size={14} /></button></header>
        {dialog !== "delete" ? <form onSubmit={(event) => void submit(event)} noValidate><label><span>Muscle key <small>{muscleKey.length}/80</small></span><input value={muscleKey} maxLength={80} onBlur={() => setKeyTouched(true)} onChange={(event) => setMuscleKey(event.target.value)} aria-invalid={Boolean(keyError)} /><small>Required. Maximum 80 characters.</small>{keyError && <b className="exercise-field-error">{keyError}</b>}</label><label><span>Muscle name <small>{name.length}/100</small></span><input value={name} maxLength={100} onBlur={() => setNameTouched(true)} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(nameError)} /><small>Required. Maximum 100 characters.</small>{nameError && <b className="exercise-field-error">{nameError}</b>}</label>{formError && <div className="exercise-inline-error"><AlertCircle size={13} />{formError}</div>}<footer><button type="button" className="exercise-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="exercise-primary" disabled={busy}>{busy ? <LoaderCircle size={13} className="exercise-spin" /> : <Check size={13} />}{busy ? "Saving…" : dialog === "create" ? "Create group" : "Save changes"}</button></footer></form> : selected && <div className="exercise-muscle-delete-confirm"><strong>{selected.name}</strong><code>{selected.muscleKey}</code><p>This muscle group may be referenced by exercises. Deleting will not automatically remove or alter exercise assignments, and the backend may reject this operation while references exist.</p>{formError && <div className="exercise-inline-error"><AlertCircle size={13} />{formError}</div>}<footer><button type="button" className="exercise-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button type="button" className="exercise-danger" disabled={busy} onClick={async () => { setBusy(true); setFormError(""); const deleted = await onDelete(selected); setBusy(false); if (deleted) setDialog(null); else setFormError("Could not delete this muscle group. It may still be referenced by an exercise; review the API Inspector for details."); }}>{busy ? <LoaderCircle size={13} className="exercise-spin" /> : <Trash2 size={13} />}{busy ? "Deleting…" : "Delete group"}</button></footer></div>}
      </section></div>, document.body)}
    </section>
  );
}

export default function DeveloperExerciseManagement() {
  const [tab, setTab] = useState<"exercises" | "workouts" | "muscles">("exercises");
  const [exercisePage, setExercisePage] = useState(emptyExercisePage);
  const [workoutPage, setWorkoutPage] = useState(emptyWorkoutPage);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [exerciseError, setExerciseError] = useState("");
  const [workoutError, setWorkoutError] = useState("");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [exerciseType, setExerciseType] = useState("");
  const [published, setPublished] = useState("");
  const [exercisePageIndex, setExercisePageIndex] = useState(0);
  const [exercisePageSize, setExercisePageSize] = useState(20);
  const [workoutSearch, setWorkoutSearch] = useState("");
  const [workoutGoal, setWorkoutGoal] = useState("");
  const [workoutDifficulty, setWorkoutDifficulty] = useState("");
  const [workoutPublished, setWorkoutPublished] = useState("");
  const [workoutPageIndex, setWorkoutPageIndex] = useState(0);
  const [workoutPageSize, setWorkoutPageSize] = useState(20);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseResponseDto | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPlanResponseDto | null>(null);
  const [dialog, setDialog] = useState<"exercise-create" | "exercise-edit" | "exercise-delete" | "workout-create" | "workout-edit" | "workout-delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [inspector, setInspector] = useState<InspectorRecord | null>(null);
  const [history, setHistory] = useState<InspectorRecord[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<ExerciseMuscleGroup[]>([]);
  const [muscleGroupsLoading, setMuscleGroupsLoading] = useState(false);
  const [muscleGroupsError, setMuscleGroupsError] = useState("");
  const mounted = useRef(true);
  const exerciseRequest = useRef(0);
  const workoutRequest = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function execute<T = unknown>(
    operation: string,
    method: string,
    endpoint: string,
    payload?: unknown,
  ): Promise<{ record: InspectorRecord; data: T | null }> {
    const started = performance.now();
    const timestamp = new Date().toISOString();
    let response: Response | null = null;
    let data: unknown = null;
    let error = "";
    try {
      response = await portalFetch(endpoint, {
        method,
        headers: payload instanceof FormData ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
        ...(payload !== undefined ? { body: payload instanceof FormData ? payload : JSON.stringify(payload) } : {}),
      });
      data = await decodeResponse(response);
      if (!response.ok) error = `HTTP ${response.status}: ${backendError(data, response.statusText || "Request failed.")}`;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "The request failed before a response was received.";
    }
    const record: InspectorRecord = {
      operation,
      method,
      endpoint,
      timestamp,
      durationMs: Math.round(performance.now() - started),
      status: response?.status ?? null,
      ok: Boolean(response?.ok),
      request: payload instanceof FormData ? { multipart: true, parts: ["request JSON", "optional media files"] } : (payload ?? null),
      response: data,
      ...(error ? { error } : {}),
    };
    if (mounted.current) {
      setInspector(record);
      setHistory((current) => [record, ...current].slice(0, 15));
    }
    return { record, data: data as T | null };
  }

  async function loadExercises(page = exercisePageIndex, size = exercisePageSize) {
    const id = ++exerciseRequest.current;
    setExerciseLoading(true);
    setExerciseError("");
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (search.trim()) params.set("query", search.trim());
    if (difficulty) params.set("difficulty", difficulty);
    if (exerciseType) params.set("type", exerciseType);
    if (published) params.set("published", published);
    const endpoint = `${CATALOG_ENDPOINT}?${params}`;
    const { record, data } = await execute<unknown>("Get exercise catalog", "GET", endpoint);
    if (!mounted.current || id !== exerciseRequest.current) return;
    setExerciseLoading(false);
    if (!record.ok) {
      setExerciseError(record.error || "Unable to load exercises.");
      setExercisePage(emptyExercisePage);
      return;
    }
    const normalizedPage = normalizeSpringPage(data, isExercise, page, size);
    if (!normalizedPage) {
      setExerciseError("The exercise catalog response did not match a Spring page.");
      setExercisePage(emptyExercisePage);
      return;
    }
    setExercisePage(normalizedPage);
  }

  async function loadWorkouts(page = workoutPageIndex, size = workoutPageSize) {
    const id = ++workoutRequest.current;
    setWorkoutLoading(true);
    setWorkoutError("");
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (workoutSearch.trim()) params.set("query", workoutSearch.trim());
    if (workoutGoal.trim()) params.set("goal", workoutGoal.trim());
    if (workoutDifficulty.trim()) params.set("difficulty", workoutDifficulty.trim());
    if (workoutPublished) params.set("published", workoutPublished);
    const endpoint = `${WORKOUTS_ENDPOINT}?${params}`;
    const { record, data } = await execute<unknown>("Get workout plans", "GET", endpoint);
    if (!mounted.current || id !== workoutRequest.current) return;
    setWorkoutLoading(false);
    if (!record.ok) {
      setWorkoutError(record.error || "Unable to load workout plans.");
      setWorkoutPage(emptyWorkoutPage);
      return;
    }
    const normalizedPage = normalizeSpringPage(data, isWorkout, page, size);
    if (!normalizedPage) {
      setWorkoutError("The workout plan response did not match a Spring page.");
      setWorkoutPage(emptyWorkoutPage);
      return;
    }
    setWorkoutPage(normalizedPage);
  }

  async function loadMuscleGroups() {
    if (muscleGroupsLoading) return;
    setMuscleGroupsLoading(true);
    setMuscleGroupsError("");
    const { record, data } = await execute<unknown>(
      "Get muscle groups",
      "GET",
      `${EXERCISE_BASE}/muscle-groups`,
    );
    if (!mounted.current) return;
    setMuscleGroupsLoading(false);
    if (!record.ok) {
      setMuscleGroupsError(record.error || "Unable to load muscle groups.");
      return;
    }
    const groups = muscleGroupList(data);
    if (!groups) {
      setMuscleGroupsError("The muscle group response did not contain a valid list.");
      return;
    }
    setMuscleGroups(groups);
  }

  async function createMuscleGroup(request: CreateExerciseMuscleGroupRequest): Promise<ExerciseMuscleGroup | null> {
    const { record, data } = await execute<unknown>(
      "Create muscle group",
      "POST",
      `${EXERCISE_BASE}/muscle-groups`,
      request,
    );
    if (!record.ok || !isMuscleGroup(data)) {
      setNotice({ kind: "error", text: record.error || `Muscle group create response was not valid (HTTP ${record.status ?? "unknown"}).` });
      return null;
    }
    setMuscleGroups((current) => [...current.filter((group) => group.id !== data.id), data].sort((a, b) => a.name.localeCompare(b.name)));
    setMuscleGroupsError("");
    setNotice({ kind: "success", text: `Muscle group "${data.name}" created.` });
    return data;
  }

  async function updateMuscleGroup(id: number, request: UpdateExerciseMuscleGroupRequest): Promise<boolean> {
    const { record, data } = await execute<unknown>(
      "Update muscle group",
      "PATCH",
      `${EXERCISE_BASE}/muscle-groups/${id}`,
      request,
    );
    if (!record.ok || !isMuscleGroup(data)) {
      setNotice({ kind: "error", text: record.error || `Muscle group update response was not valid (HTTP ${record.status ?? "unknown"}).` });
      return false;
    }
    setMuscleGroups((current) => current.map((group) => group.id === id ? data : group).sort((a, b) => a.name.localeCompare(b.name)));
    setNotice({ kind: "success", text: `Muscle group "${data.name}" updated.` });
    return true;
  }

  async function deleteMuscleGroup(group: ExerciseMuscleGroup): Promise<boolean> {
    const { record } = await execute(
      "Delete muscle group",
      "DELETE",
      `${EXERCISE_BASE}/muscle-groups/${group.id}`,
    );
    if (!record.ok || record.status !== 204) {
      const message = record.error || `Muscle group deletion returned HTTP ${record.status ?? "unknown"}; expected 204 No Content.`;
      setNotice({ kind: "error", text: message });
      return false;
    }
    setMuscleGroups((current) => current.filter((entry) => entry.id !== group.id));
    setNotice({ kind: "success", text: `Muscle group "${group.name}" deleted.` });
    return true;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setExercisePageIndex(0);
      void loadExercises(0, exercisePageSize);
    }, search ? 350 : 0);
    return () => window.clearTimeout(timer);
    // Search and list filters are intentionally server-backed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, difficulty, exerciseType, published, exercisePageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setWorkoutPageIndex(0);
      void loadWorkouts(0, workoutPageSize);
    }, workoutSearch ? 350 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutSearch, workoutGoal, workoutDifficulty, workoutPublished, workoutPageSize]);

  useEffect(() => {
    void Promise.resolve().then(() => { if (mounted.current) void loadMuscleGroups(); });
    // Load groups once on workspace mount; refresh is user initiated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openExerciseDetails(exercise: ExerciseResponseDto) {
    setSelectedExercise(exercise);
    setSelectedWorkout(null);
    const { record, data } = await execute<unknown>("Get exercise details", "GET", `${CATALOG_ENDPOINT}/${exercise.id}`);
    if (record.ok && isExercise(data)) setSelectedExercise(data);
  }
  async function openWorkoutDetails(plan: WorkoutPlanResponseDto) {
    setSelectedWorkout(plan);
    setSelectedExercise(null);
    const { record, data } = await execute<unknown>("Get workout plan details", "GET", `${WORKOUTS_ENDPOINT}/${plan.id}`);
    if (record.ok && isWorkout(data)) setSelectedWorkout(data);
  }

  async function saveExercise(dto: ExerciseUpsertRequestDto, files: File[]) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const formData = new FormData();
    formData.append("request", new Blob([JSON.stringify(dto)], { type: "application/json" }));
    files.forEach((file) => formData.append("media", file));
    const isEdit = dialog === "exercise-edit";
    const id = selectedExercise?.id;
    const endpoint = isEdit && id ? `${CATALOG_ENDPOINT}/${id}` : CATALOG_ENDPOINT;
    const { record, data } = await execute<unknown>(isEdit ? "Update exercise" : "Create exercise", isEdit ? "PUT" : "POST", endpoint, formData);
    setBusy(false);
    if (!record.ok) {
      setNotice({ kind: "error", text: record.error || "Exercise operation failed." });
      return;
    }
    if (!isExercise(data)) {
      setNotice({ kind: "error", text: `The operation returned HTTP ${record.status}, but the response did not match ExerciseResponseDto.` });
      await loadExercises();
      return;
    }
    setDialog(null);
    setSelectedExercise(data);
    setNotice({ kind: "success", text: `Exercise "${data.name}" ${isEdit ? "updated" : "created"} (HTTP ${record.status}).` });
    await loadExercises();
  }

  async function deleteExercise(exercise: ExerciseResponseDto) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const { record } = await execute("Delete exercise", "DELETE", `${CATALOG_ENDPOINT}/${exercise.id}`);
    setBusy(false);
    if (!record.ok) {
      setNotice({ kind: "error", text: record.error || "Exercise deletion failed." });
      return;
    }
    if (record.status !== 204) {
      setNotice({ kind: "error", text: `Delete returned HTTP ${record.status ?? "unknown"}; expected 204 No Content.` });
      return;
    }
    setDialog(null);
    setSelectedExercise(null);
    setNotice({ kind: "success", text: `Exercise "${exercise.name}" deleted (204 No Content).` });
    await loadExercises();
  }

  async function toggleExercisePublication(exercise: ExerciseResponseDto) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const publishedValue = !exercise.published;
    const endpoint = `${CATALOG_ENDPOINT}/${exercise.id}/publication?published=${publishedValue}`;
    const { record, data } = await execute<unknown>("Update exercise publication", "PATCH", endpoint);
    setBusy(false);
    if (!record.ok) {
      setNotice({ kind: "error", text: record.error || "Exercise publication update failed." });
      return;
    }
    if (!isExercise(data)) {
      setNotice({ kind: "error", text: `Publication returned HTTP ${record.status}, but the response did not match ExerciseResponseDto.` });
      await loadExercises();
      return;
    }
    setSelectedExercise(data);
    setNotice({ kind: "success", text: `Exercise "${data.name}" ${data.published ? "published" : "unpublished"}.` });
    await loadExercises();
  }

  async function saveWorkout(dto: WorkoutPlanUpsertRequestDto) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const isEdit = dialog === "workout-edit";
    const id = selectedWorkout?.id;
    const endpoint = isEdit && id ? `${WORKOUTS_ENDPOINT}/${id}` : WORKOUTS_ENDPOINT;
    const { record, data } = await execute<unknown>(isEdit ? "Update workout plan" : "Create workout plan", isEdit ? "PUT" : "POST", endpoint, dto);
    setBusy(false);
    if (!record.ok) {
      setNotice({ kind: "error", text: record.error || "Workout plan operation failed." });
      return;
    }
    if (!isWorkout(data)) {
      setNotice({ kind: "error", text: `The operation returned HTTP ${record.status}, but the response did not match WorkoutPlanResponseDto.` });
      await loadWorkouts();
      return;
    }
    setDialog(null);
    setSelectedWorkout(data);
    setNotice({ kind: "success", text: `Workout plan "${data.name}" ${isEdit ? "updated" : "created"} (HTTP ${record.status}).` });
    await loadWorkouts();
  }

  async function deleteWorkout(plan: WorkoutPlanResponseDto) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const { record } = await execute("Delete workout plan", "DELETE", `${WORKOUTS_ENDPOINT}/${plan.id}`);
    setBusy(false);
    if (!record.ok) {
      setNotice({ kind: "error", text: record.error || "Workout plan deletion failed." });
      return;
    }
    if (record.status !== 204) {
      setNotice({ kind: "error", text: `Delete returned HTTP ${record.status ?? "unknown"}; expected 204 No Content.` });
      return;
    }
    setDialog(null);
    setSelectedWorkout(null);
    setNotice({ kind: "success", text: `Workout plan "${plan.name}" deleted (204 No Content).` });
    await loadWorkouts();
  }

  async function toggleWorkoutPublication(plan: WorkoutPlanResponseDto) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const publishedValue = !plan.published;
    const { record, data } = await execute<unknown>("Update workout plan publication", "PATCH", `${WORKOUTS_ENDPOINT}/${plan.id}/publication?published=${publishedValue}`);
    setBusy(false);
    if (!record.ok) {
      setNotice({ kind: "error", text: record.error || "Workout plan publication update failed." });
      return;
    }
    if (!isWorkout(data)) {
      setNotice({ kind: "error", text: `Publication returned HTTP ${record.status}, but the response did not match WorkoutPlanResponseDto.` });
      await loadWorkouts();
      return;
    }
    setSelectedWorkout(data);
    setNotice({ kind: "success", text: `Workout plan "${data.name}" ${data.published ? "published" : "unpublished"}.` });
    await loadWorkouts();
  }

  function resetExerciseFilters() {
    setSearch("");
    setDifficulty("");
    setExerciseType("");
    setPublished("");
    setExercisePageIndex(0);
  }
  function resetWorkoutFilters() {
    setWorkoutSearch("");
    setWorkoutGoal("");
    setWorkoutDifficulty("");
    setWorkoutPublished("");
    setWorkoutPageIndex(0);
  }

  return (
    <div className="dev-content exercise-management">
      <div className="dev-page-heading exercise-page-heading">
        <div><div className="dev-overline">FITNESS CMS / EXERCISE MANAGEMENT</div><h1>Exercise Management</h1><p>Manage exercise catalog records and workout plans using live backend APIs.</p></div>
        <div className="exercise-page-actions">
          <button type="button" className="exercise-secondary" onClick={() => tab === "exercises" ? void loadExercises(exercisePageIndex, exercisePageSize) : tab === "workouts" ? void loadWorkouts(workoutPageIndex, workoutPageSize) : void loadMuscleGroups()}><RefreshCw size={14} /> Refresh</button>
          {tab !== "muscles" && <button type="button" className="exercise-primary" onClick={() => setDialog(tab === "exercises" ? "exercise-create" : "workout-create")}><Plus size={15} /> {tab === "exercises" ? "Create exercise" : "Create workout plan"}</button>}
        </div>
      </div>

      {notice && <div className={`exercise-notice ${notice.kind}`} role="status"><AlertCircle size={15} /><span>{notice.text}</span><button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}><X size={14} /></button></div>}

      <div className="exercise-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "exercises"} className={tab === "exercises" ? "active" : ""} onClick={() => { setTab("exercises"); setSelectedWorkout(null); }}><Dumbbell size={15} /> Exercise Catalog</button>
        <button type="button" role="tab" aria-selected={tab === "workouts"} className={tab === "workouts" ? "active" : ""} onClick={() => { setTab("workouts"); setSelectedExercise(null); }}>Workout Plans</button>
        <button type="button" role="tab" aria-selected={tab === "muscles"} className={tab === "muscles" ? "active" : ""} onClick={() => { setTab("muscles"); setSelectedExercise(null); setSelectedWorkout(null); if (muscleGroupsError) void loadMuscleGroups(); }}>Muscle Groups</button>
      </div>

      {tab === "exercises" ? (
        <>
          <div className="exercise-toolbar">
            <label className="exercise-search"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercise name or key" /></label>
            <label className="exercise-filter"><span>Difficulty</span><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="">All difficulties</option><option>BEGINNER</option><option>INTERMEDIATE</option><option>ADVANCED</option></select></label>
            <label className="exercise-filter"><span>Type</span><select value={exerciseType} onChange={(e) => setExerciseType(e.target.value)}><option value="">All types</option><option>STRENGTH</option><option>CARDIO</option><option>MOBILITY</option><option>FLEXIBILITY</option><option>PLYOMETRIC</option></select></label>
            <label className="exercise-filter"><span>Publication</span><select value={published} onChange={(e) => setPublished(e.target.value)}><option value="">All statuses</option><option value="true">Published</option><option value="false">Unpublished</option></select></label>
            <button type="button" className="exercise-text-button" onClick={resetExerciseFilters}>Reset filters</button>
          </div>
          <div className="exercise-main-grid">
            <section className="exercise-panel">
              <div className="exercise-panel-heading"><div><h2>Exercise catalog</h2><p>Records returned by the backend exercise catalog.</p></div><span className="exercise-result-count">{exerciseLoading ? "Loading…" : `${exercisePage.totalElements} records`}</span></div>
              {exerciseError ? <div className="exercise-state exercise-error-state"><AlertCircle size={20} /><strong>Unable to load exercises</strong><span>{exerciseError}</span><button type="button" className="exercise-secondary" onClick={() => void loadExercises()}><RefreshCw size={13} /> Retry</button></div>
                : exerciseLoading ? <div className="exercise-state"><LoaderCircle size={19} className="exercise-spin" />Loading exercises…</div>
                  : exercisePage.content.length === 0 ? <div className="exercise-state"><Dumbbell size={21} /><strong>No exercises found</strong><span>The backend returned an empty exercise catalog.</span></div>
                    : <div className="exercise-table-wrap"><table className="exercise-table"><thead><tr><th>Exercise</th><th>Difficulty</th><th>Type</th><th>Equipment</th><th>Classification</th><th>Status</th><th>Actions</th></tr></thead><tbody>{exercisePage.content.map((exercise) => <tr key={exercise.id} className={selectedExercise?.id === exercise.id ? "selected" : ""}>
                      <td><button type="button" className="exercise-name-button" onClick={() => void openExerciseDetails(exercise)}><span><strong>{exercise.name}</strong><small>{exercise.exerciseKey} · ID {exercise.id}</small></span></button></td>
                      <td>{exercise.difficulty}</td><td>{exercise.exerciseType}</td><td>{exercise.equipment}</td><td>{exercise.category?.name || "—"}{exercise.subCategory ? ` / ${exercise.subCategory.name}` : ""}</td>
                      <td><span className={`exercise-status ${exercise.published ? "positive" : "muted"}`}>{exercise.published ? "Published" : "Unpublished"}</span></td>
                      <td><div className="exercise-row-actions"><button type="button" className="exercise-small-button" onClick={() => void openExerciseDetails(exercise)}>Details</button><button type="button" className="exercise-icon-button" aria-label={`Edit ${exercise.name}`} onClick={() => { setSelectedExercise(exercise); setDialog("exercise-edit"); }}><Edit3 size={13} /></button><button type="button" className="exercise-icon-button" aria-label={exercise.published ? "Unpublish exercise" : "Publish exercise"} onClick={() => void toggleExercisePublication(exercise)}>{exercise.published ? "On" : "Off"}</button><button type="button" className="exercise-icon-button exercise-danger-icon" aria-label={`Delete ${exercise.name}`} onClick={() => { setSelectedExercise(exercise); setDialog("exercise-delete"); }}><Trash2 size={13} /></button></div></td>
                    </tr>)}</tbody></table></div>}
              <div className="exercise-pagination"><span>Page {exercisePage.number + 1} of {Math.max(1, exercisePage.totalPages)}</span><label>Rows<select value={exercisePageSize} onChange={(e) => { setExercisePageSize(Number(e.target.value)); setExercisePageIndex(0); }}><option>20</option><option>50</option><option>100</option></select></label><div><button type="button" className="exercise-icon-button" disabled={exercisePage.first || exerciseLoading} onClick={() => { const next = Math.max(0, exercisePageIndex - 1); setExercisePageIndex(next); void loadExercises(next, exercisePageSize); }}><ArrowLeft size={14} /></button><button type="button" className="exercise-icon-button" disabled={exercisePage.last || exerciseLoading} onClick={() => { const next = exercisePageIndex + 1; setExercisePageIndex(next); void loadExercises(next, exercisePageSize); }}><ArrowRight size={14} /></button></div></div>
            </section>
            {selectedExercise && <aside className="exercise-panel exercise-detail-panel"><div className="exercise-panel-heading"><div><h2>Exercise details</h2><p>API-backed record.</p></div><button type="button" className="exercise-icon-button" aria-label="Close details" onClick={() => setSelectedExercise(null)}><X size={14} /></button></div><div className="exercise-detail-content"><ExerciseMediaPreview media={selectedExercise.media ?? []} exerciseName={selectedExercise.name} /><h3>{selectedExercise.name}</h3><p>{selectedExercise.description || "No description."}</p><dl><div><dt>Key</dt><dd>{selectedExercise.exerciseKey}</dd></div><div><dt>Difficulty</dt><dd>{selectedExercise.difficulty}</dd></div><div><dt>Type</dt><dd>{selectedExercise.exerciseType}</dd></div><div><dt>Equipment</dt><dd>{selectedExercise.equipment}</dd></div><div><dt>Movement</dt><dd>{selectedExercise.movementPattern || "—"}</dd></div><div><dt>AI tracking</dt><dd>{selectedExercise.supportsAiTracking ? "Enabled" : "Disabled"}</dd></div><div><dt>Level</dt><dd>{selectedExercise.level ? `${selectedExercise.level.name} (${selectedExercise.level.levelKey})` : "—"}</dd></div><div><dt>Updated</dt><dd>{formatDate(selectedExercise.updatedAt)}</dd></div></dl>{selectedExercise.detail && <div className="exercise-detail-copy"><strong>Setup</strong><p>{selectedExercise.detail.setup || "—"}</p><strong>Benefits</strong><p>{selectedExercise.detail.benefits || "—"}</p><strong>Safety notes</strong><p>{selectedExercise.detail.safetyNotes || "—"}</p><strong>Common mistakes</strong><p>{selectedExercise.detail.commonMistakes || "—"}</p></div>}<details className="exercise-json-details"><summary><span><FileJson size={13} /> Raw exercise response</span><ChevronDown size={13} /></summary><pre>{JSON.stringify(selectedExercise, null, 2)}</pre><CopyButton value={JSON.stringify(selectedExercise, null, 2)} label="Copy exercise JSON" /></details></div></aside>}
          </div>
        </>
      ) : tab === "workouts" ? (
        <>
          <div className="exercise-toolbar">
            <label className="exercise-search"><Search size={14} /><input value={workoutSearch} onChange={(e) => setWorkoutSearch(e.target.value)} placeholder="Search workout plan" /></label>
            <label className="exercise-filter"><span>Goal</span><input value={workoutGoal} onChange={(e) => setWorkoutGoal(e.target.value)} placeholder="Goal text" /></label>
            <label className="exercise-filter"><span>Difficulty</span><input value={workoutDifficulty} onChange={(e) => setWorkoutDifficulty(e.target.value)} placeholder="Difficulty text" /></label>
            <label className="exercise-filter"><span>Publication</span><select value={workoutPublished} onChange={(e) => setWorkoutPublished(e.target.value)}><option value="">All statuses</option><option value="true">Published</option><option value="false">Unpublished</option></select></label>
            <button type="button" className="exercise-text-button" onClick={resetWorkoutFilters}>Reset filters</button>
          </div>
          <div className="exercise-main-grid">
            <section className="exercise-panel">
              <div className="exercise-panel-heading"><div><h2>Workout plans</h2><p>Records returned by the workout plan API.</p></div><span className="exercise-result-count">{workoutLoading ? "Loading…" : `${workoutPage.totalElements} records`}</span></div>
              {workoutError ? <div className="exercise-state exercise-error-state"><AlertCircle size={20} /><strong>Unable to load workout plans</strong><span>{workoutError}</span><button type="button" className="exercise-secondary" onClick={() => void loadWorkouts()}><RefreshCw size={13} /> Retry</button></div>
                : workoutLoading ? <div className="exercise-state"><LoaderCircle size={19} className="exercise-spin" />Loading workout plans…</div>
                  : workoutPage.content.length === 0 ? <div className="exercise-state"><Dumbbell size={21} /><strong>No workout plans found</strong><span>The backend returned an empty workout plan list.</span></div>
                    : <div className="exercise-table-wrap"><table className="exercise-table"><thead><tr><th>Plan</th><th>Goal</th><th>Difficulty</th><th>Duration</th><th>Days</th><th>Status</th><th>Actions</th></tr></thead><tbody>{workoutPage.content.map((plan) => <tr key={plan.id} className={selectedWorkout?.id === plan.id ? "selected" : ""}>
                      <td><button type="button" className="exercise-name-button" onClick={() => void openWorkoutDetails(plan)}><span><strong>{plan.name}</strong><small>{plan.planKey} · v{plan.version}</small></span></button></td><td>{plan.goal}</td><td>{plan.difficulty}</td><td>{plan.durationWeeks} weeks</td><td>{plan.daysPerWeek}/week</td><td><span className={`exercise-status ${plan.published ? "positive" : "muted"}`}>{plan.published ? "Published" : "Unpublished"}</span></td>
                      <td><div className="exercise-row-actions"><button type="button" className="exercise-small-button" onClick={() => void openWorkoutDetails(plan)}>Details</button><button type="button" className="exercise-icon-button" aria-label={`Edit ${plan.name}`} onClick={() => { setSelectedWorkout(plan); setDialog("workout-edit"); }}><Edit3 size={13} /></button><button type="button" className="exercise-icon-button" aria-label={plan.published ? "Unpublish plan" : "Publish plan"} onClick={() => void toggleWorkoutPublication(plan)}>{plan.published ? "On" : "Off"}</button><button type="button" className="exercise-icon-button exercise-danger-icon" aria-label={`Delete ${plan.name}`} onClick={() => { setSelectedWorkout(plan); setDialog("workout-delete"); }}><Trash2 size={13} /></button></div></td>
                    </tr>)}</tbody></table></div>}
              <div className="exercise-pagination"><span>Page {workoutPage.number + 1} of {Math.max(1, workoutPage.totalPages)}</span><label>Rows<select value={workoutPageSize} onChange={(e) => { setWorkoutPageSize(Number(e.target.value)); setWorkoutPageIndex(0); }}><option>20</option><option>50</option><option>100</option></select></label><div><button type="button" className="exercise-icon-button" disabled={workoutPage.first || workoutLoading} onClick={() => { const next = Math.max(0, workoutPageIndex - 1); setWorkoutPageIndex(next); void loadWorkouts(next, workoutPageSize); }}><ArrowLeft size={14} /></button><button type="button" className="exercise-icon-button" disabled={workoutPage.last || workoutLoading} onClick={() => { const next = workoutPageIndex + 1; setWorkoutPageIndex(next); void loadWorkouts(next, workoutPageSize); }}><ArrowRight size={14} /></button></div></div>
            </section>
            {selectedWorkout && <aside className="exercise-panel exercise-detail-panel"><div className="exercise-panel-heading"><div><h2>Workout plan details</h2><p>API-backed schedule.</p></div><button type="button" className="exercise-icon-button" aria-label="Close details" onClick={() => setSelectedWorkout(null)}><X size={14} /></button></div><div className="exercise-detail-content"><h3>{selectedWorkout.name}</h3><p>{selectedWorkout.description || "No description."}</p><dl><div><dt>Key</dt><dd>{selectedWorkout.planKey}</dd></div><div><dt>Goal</dt><dd>{selectedWorkout.goal}</dd></div><div><dt>Difficulty</dt><dd>{selectedWorkout.difficulty}</dd></div><div><dt>Duration</dt><dd>{selectedWorkout.durationWeeks} weeks</dd></div><div><dt>Frequency</dt><dd>{selectedWorkout.daysPerWeek} days/week</dd></div><div><dt>Session</dt><dd>{selectedWorkout.estimatedSessionMinutes ? `${selectedWorkout.estimatedSessionMinutes} minutes` : "—"}</dd></div><div><dt>Version</dt><dd>{selectedWorkout.version}</dd></div><div><dt>Status</dt><dd>{selectedWorkout.published ? "Published" : "Unpublished"}</dd></div></dl><div className="exercise-workout-days">{selectedWorkout.days.map((day) => <article key={`${day.dayNumber}-${day.id ?? day.name}`}><header><strong>Day {day.dayNumber} · {day.name}</strong><span>{day.restDay ? "Rest day" : `${day.exercises.length} exercises`}</span></header>{!day.restDay && day.exercises.map((item) => <div key={`${day.dayNumber}-${item.exerciseId}-${item.sortOrder}`}><strong>{item.exerciseName}</strong><small>{item.exerciseKey} · Sets {item.targetSets}{item.targetRepsMin != null ? ` · Reps ${item.targetRepsMin}${item.targetRepsMax != null ? `–${item.targetRepsMax}` : "+"}` : ""}{item.targetDurationSeconds != null ? ` · ${item.targetDurationSeconds}s` : ""}{item.restSeconds != null ? ` · Rest ${item.restSeconds}s` : ""}{item.targetWeightKg != null ? ` · ${item.targetWeightKg}kg` : ""}</small>{item.notes && <p>{item.notes}</p>}</div>)}</article>)}</div><details className="exercise-json-details"><summary><span><FileJson size={13} /> Raw workout response</span><ChevronDown size={13} /></summary><pre>{JSON.stringify(selectedWorkout, null, 2)}</pre><CopyButton value={JSON.stringify(selectedWorkout, null, 2)} label="Copy workout JSON" /></details></div></aside>}
          </div>
        </>
      ) : (
        <MuscleGroupsManager
          groups={muscleGroups}
          loading={muscleGroupsLoading}
          error={muscleGroupsError}
          onRefresh={() => void loadMuscleGroups()}
          onCreate={createMuscleGroup}
          onUpdate={updateMuscleGroup}
          onDelete={deleteMuscleGroup}
        />
      )}

      <section className="exercise-panel exercise-inspector">
        <div className="exercise-panel-heading"><div><h2>API Inspector</h2><p>Latest actual Exercise Management request and response.</p></div>{inspector && <span className={`exercise-status ${inspector.ok ? "positive" : "negative"}`}>{inspector.status == null ? "No response" : `HTTP ${inspector.status}`}</span>}</div>
        {!inspector ? <p className="exercise-inspector-empty">No API request yet.</p> : <><div className="exercise-inspector-meta"><span><strong>{inspector.method}</strong> {inspector.endpoint}</span><small>{new Date(inspector.timestamp).toLocaleString()} · {inspector.durationMs} ms</small></div>{inspector.error && <div className="exercise-inline-error"><AlertCircle size={14} />{inspector.error}</div>}<div className="exercise-inspector-json"><details open><summary>Request</summary><pre>{typeof inspector.request === "string" ? inspector.request : JSON.stringify(inspector.request, null, 2)}</pre></details><details open><summary>Actual response</summary><pre>{typeof inspector.response === "string" ? inspector.response : JSON.stringify(inspector.response, null, 2)}</pre></details></div><div className="exercise-history">{history.map((item, index) => <button type="button" key={`${item.timestamp}-${index}`} onClick={() => setInspector(item)}><strong>{item.operation}</strong><small>{item.method} · HTTP {item.status ?? "none"} · {item.durationMs} ms</small></button>)}</div></>}
      </section>

      {dialog && <div className="exercise-dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target && !busy) setDialog(null); }}>
        <section className="exercise-dialog" role="dialog" aria-modal="true" aria-labelledby="exercise-dialog-title">
          <header><div><h2 id="exercise-dialog-title">{dialog === "exercise-create" ? "Create exercise" : dialog === "exercise-edit" ? "Edit exercise" : dialog === "exercise-delete" ? "Delete exercise?" : dialog === "workout-create" ? "Create workout plan" : dialog === "workout-edit" ? "Edit workout plan" : "Delete workout plan?"}</h2><p>{dialog.includes("delete") ? "This action requires confirmation." : "Changes are submitted directly to the backend."}</p></div><button type="button" className="exercise-icon-button" disabled={busy} aria-label="Close dialog" onClick={() => setDialog(null)}><X size={15} /></button></header>
          {(dialog === "exercise-create" || dialog === "exercise-edit") && <ExerciseForm exercise={dialog === "exercise-edit" ? selectedExercise ?? undefined : undefined} busy={busy} muscleGroups={muscleGroups} muscleGroupsLoading={muscleGroupsLoading} muscleGroupsError={muscleGroupsError} onRefreshMuscleGroups={() => void loadMuscleGroups()} onCreateMuscleGroup={createMuscleGroup} onCancel={() => setDialog(null)} onSubmit={(dto, files) => void saveExercise(dto, files)} />}
          {(dialog === "workout-create" || dialog === "workout-edit") && <WorkoutForm plan={dialog === "workout-edit" ? selectedWorkout ?? undefined : undefined} exercises={exercisePage.content} busy={busy} onCancel={() => setDialog(null)} onSubmit={(dto) => void saveWorkout(dto)} />}
          {dialog === "exercise-delete" && selectedExercise && <div className="exercise-confirm"><Dumbbell size={24} /><div><strong>{selectedExercise.name}</strong><span>Exercise ID {selectedExercise.id} · {selectedExercise.exerciseKey}</span><p>Delete this exercise from the backend catalog? This cannot be undone.</p></div><footer><button type="button" className="exercise-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button type="button" className="exercise-danger" disabled={busy} onClick={() => void deleteExercise(selectedExercise)}><Trash2 size={13} /> Delete exercise</button></footer></div>}
          {dialog === "workout-delete" && selectedWorkout && <div className="exercise-confirm"><Dumbbell size={24} /><div><strong>{selectedWorkout.name}</strong><span>Plan ID {selectedWorkout.id} · {selectedWorkout.planKey}</span><p>Delete this workout plan from the backend? This cannot be undone.</p></div><footer><button type="button" className="exercise-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button type="button" className="exercise-danger" disabled={busy} onClick={() => void deleteWorkout(selectedWorkout)}><Trash2 size={13} /> Delete plan</button></footer></div>}
        </section>
      </div>}
    </div>
  );
}
