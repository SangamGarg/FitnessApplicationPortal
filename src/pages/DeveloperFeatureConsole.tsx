import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Code2, LoaderCircle, Play, RotateCcw, ShieldAlert } from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperFeatureConsole.css";

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Feature = "Exercise" | "Calculator" | "App information" | "Feedback" | "Notifications" | "Email";
type Operation = {
  id: string; feature: Feature; label: string; method: Method; path: string;
  description: string; pathHelp?: string; queryHelp?: string; body?: unknown;
};

const operations: Operation[] = [
  { id: "exercise-category-create", feature: "Exercise", label: "Create category", method: "POST", path: "/api/v1/dev/exercise/upload/category", description: "Create a category and optionally include nested levels, subcategories and exercises.", body: { name: "Strength", imageUrl: "https://example.com/strength.png", levels: [] } },
  { id: "exercise-category-update", feature: "Exercise", label: "Update category", method: "PATCH", path: "/api/v1/dev/exercise/patch/category", description: "Patch a category using the category DTO. Confirm backend update semantics before use.", body: { name: "Strength", imageUrl: "https://example.com/strength.png", levels: [] } },
  { id: "exercise-category-delete", feature: "Exercise", label: "Delete category", method: "DELETE", path: "/api/v1/dev/exercise/delete/category", description: "Delete a category by its name.", queryHelp: "name=Strength" },
  { id: "exercise-level-create", feature: "Exercise", label: "Create level", method: "POST", path: "/api/v1/dev/exercise/upload/level/{categoryId}", description: "Create a level for a category.", pathHelp: "categoryId", body: { level: "Beginner", subCategories: [] } },
  { id: "exercise-level-update", feature: "Exercise", label: "Update level", method: "PATCH", path: "/api/v1/dev/exercise/patch/level/{categoryId}", description: "Patch a level for a category.", pathHelp: "categoryId", body: { level: "Beginner", subCategories: [] } },
  { id: "exercise-level-delete", feature: "Exercise", label: "Delete level", method: "DELETE", path: "/api/v1/dev/exercise/delete/level/{categoryId}", description: "Delete a level by category ID and level name.", pathHelp: "categoryId", queryHelp: "level=Beginner" },
  { id: "exercise-subcategory-create", feature: "Exercise", label: "Create subcategory", method: "POST", path: "/api/v1/dev/exercise/upload/subcategory/{levelId}", description: "Create a subcategory for a level.", pathHelp: "levelId", body: { name: "Arms", imageUrl: "https://example.com/arms.png", exercises: [] } },
  { id: "exercise-subcategory-update", feature: "Exercise", label: "Update subcategory", method: "PATCH", path: "/api/v1/dev/exercise/patch/subcategory/{levelId}", description: "Patch a subcategory for a level.", pathHelp: "levelId", body: { name: "Arms", imageUrl: "https://example.com/arms.png", exercises: [] } },
  { id: "exercise-subcategory-delete", feature: "Exercise", label: "Delete subcategory", method: "DELETE", path: "/api/v1/dev/exercise/delete/subcategory/{levelId}", description: "Delete a subcategory by level ID and name.", pathHelp: "levelId", queryHelp: "subCategory=Arms" },
  { id: "exercise-exercise-create", feature: "Exercise", label: "Create exercise", method: "POST", path: "/api/v1/dev/exercise/upload/exercise/{subCategoryId}", description: "Create an exercise under a subcategory.", pathHelp: "subCategoryId", body: { name: "Push-up", description: "A bodyweight exercise", videoUrl: "https://example.com/pushup.mp4", imageUrl: "https://example.com/pushup.png", durationInSeconds: 60, repetitions: 12, sets: 3, category: "Strength", muscleGroups: ["Chest"], equipment: "None", difficulty: "Beginner", benefits: ["Strength"], instructions: ["Start in plank", "Lower your body", "Push up"], tips: ["Keep your core tight"], caloriesBurned: 8 } },
  { id: "exercise-exercise-update", feature: "Exercise", label: "Update exercise", method: "PATCH", path: "/api/v1/dev/exercise/patch/exercise/{subCategoryId}", description: "Patch an exercise under a subcategory.", pathHelp: "subCategoryId", body: { name: "Push-up", description: "A bodyweight exercise", videoUrl: "https://example.com/pushup.mp4", imageUrl: "https://example.com/pushup.png", durationInSeconds: 60, repetitions: 12, sets: 3, category: "Strength", muscleGroups: ["Chest"], equipment: "None", difficulty: "Beginner", benefits: ["Strength"], instructions: ["Start in plank", "Lower your body", "Push up"], tips: ["Keep your core tight"], caloriesBurned: 8 } },
  { id: "exercise-exercise-delete", feature: "Exercise", label: "Delete exercise", method: "DELETE", path: "/api/v1/dev/exercise/delete/exercise/{subCategoryId}", description: "Delete an exercise by subcategory ID and exercise name.", pathHelp: "subCategoryId", queryHelp: "exerciseName=Push-up" },
  { id: "food-upload", feature: "Calculator", label: "Upload food calories (batch)", method: "POST", path: "/api/v1/dev/calculator/upload-calories-in-food", description: "Upload one or more food nutrition records as an array.", body: [{ name: "Oats", calories: 389, servingSizeG: 100, proteinG: 16.9, carbohydratesTotalG: 66.3, fiberG: 10.6, fatSaturatedG: 1.2, fatTotalG: 6.9, cholesterolMg: 0, sugarG: 0.9, sodiumMg: 2, potassiumMg: 429, imageUrl: "https://example.com/oats.png" }] },
  { id: "food-patch", feature: "Calculator", label: "Update food calories", method: "PATCH", path: "/api/v1/dev/calculator/patch-calories-in-food", description: "Patch a food nutrition record. The DTO has no ID field; confirm how the backend identifies the record.", body: { name: "Oats", calories: 389, servingSizeG: 100, proteinG: 16.9, carbohydratesTotalG: 66.3, fiberG: 10.6, fatSaturatedG: 1.2, fatTotalG: 6.9, cholesterolMg: 0, sugarG: 0.9, sodiumMg: 2, potassiumMg: 429, imageUrl: "https://example.com/oats.png" } },
  { id: "burn-upload", feature: "Calculator", label: "Upload calories burned (batch)", method: "POST", path: "/api/v1/dev/calculator/upload-burned-calories", description: "Upload MET-based activity records as an array.", body: [{ name: "Walking", metValue: 3.5, imageUrl: "https://example.com/walking.png" }] },
  { id: "burn-patch", feature: "Calculator", label: "Update calories burned", method: "PATCH", path: "/api/v1/dev/calculator/patch-burned-calories", description: "Patch a MET-based activity record. The DTO has no ID field; confirm how the backend identifies the record.", body: { name: "Walking", metValue: 3.5, imageUrl: "https://example.com/walking.png" } },
  { id: "about-upload", feature: "App information", label: "Create About Us", method: "POST", path: "/api/v1/dev/app-info/upload/about", description: "Create About Us content.", body: { content: "About our fitness app", lastUpdatedBy: "developer" } },
  { id: "about-patch", feature: "App information", label: "Update About Us", method: "PATCH", path: "/api/v1/dev/app-info/patch/about", description: "Update About Us content.", body: { content: "Updated About Us content", lastUpdatedBy: "developer" } },
  { id: "privacy-upload", feature: "App information", label: "Create Privacy Policy", method: "POST", path: "/api/v1/dev/app-info/upload/privacy-policy", description: "Create Privacy Policy content.", body: { content: "Privacy policy content", lastUpdatedBy: "developer" } },
  { id: "privacy-patch", feature: "App information", label: "Update Privacy Policy", method: "PATCH", path: "/api/v1/dev/app-info/patch/privacy-policy", description: "Update Privacy Policy content.", body: { content: "Updated privacy policy content", lastUpdatedBy: "developer" } },
  { id: "terms-upload", feature: "App information", label: "Create Terms and Conditions", method: "POST", path: "/api/v1/dev/app-info/upload/terms-condition", description: "Create Terms and Conditions content.", body: { content: "Terms and conditions content", lastUpdatedBy: "developer" } },
  { id: "terms-patch", feature: "App information", label: "Update Terms and Conditions", method: "PATCH", path: "/api/v1/dev/app-info/patch/terms-condition", description: "Update Terms and Conditions content.", body: { content: "Updated terms and conditions content", lastUpdatedBy: "developer" } },
  { id: "links-upload", feature: "App information", label: "Create app links (batch)", method: "POST", path: "/api/v1/dev/app-info/upload/app-links", description: "Upload app links as a JSON array.", body: [{ title: "Play Store", url: "https://play.google.com/" }] },
  { id: "links-patch", feature: "App information", label: "Update app link", method: "PATCH", path: "/api/v1/dev/app-info/patch/app-links", description: "Patch an app link. The DTO has no ID field; confirm how the backend identifies it.", body: { title: "Play Store", url: "https://play.google.com/" } },
  { id: "faqs-upload", feature: "App information", label: "Create FAQs (batch)", method: "POST", path: "/api/v1/dev/app-info/upload/app-faqs", description: "Upload FAQs as a JSON array.", body: [{ question: "How do I start?", answer: "Open the workout section." }] },
  { id: "faqs-patch", feature: "App information", label: "Update FAQ", method: "PATCH", path: "/api/v1/dev/app-info/patch/app-faqs/{id}", description: "Update an FAQ by ID.", pathHelp: "id", body: { question: "How do I start?", answer: "Open the workout section." } },
  { id: "feedback-all", feature: "Feedback", label: "Get all feedback", method: "GET", path: "/api/v1/dev/feedback/all", description: "Retrieve all feedback entries." },
  { id: "feedback-search", feature: "Feedback", label: "Search feedback by name", method: "GET", path: "/api/v1/dev/feedback", description: "Find feedback using the required name query parameter.", queryHelp: "name=Jane" },
  { id: "feedback-delete", feature: "Feedback", label: "Delete feedback", method: "DELETE", path: "/api/v1/dev/feedback/{id}", description: "Delete a feedback entry by ID.", pathHelp: "id" },
  { id: "notification-one", feature: "Notifications", label: "Send device notification", method: "POST", path: "/api/v1/dev/notification/send", description: "Send a notification to a single device. Payload fields depend on SendNotificationRequestDto.", body: { token: "DEVICE_FCM_TOKEN", title: "Fitness update", body: "Your new workout is ready" } },
  { id: "notification-batch", feature: "Notifications", label: "Send batch notification", method: "POST", path: "/api/v1/dev/notification/send-batch", description: "Send a batch notification. Payload fields depend on SendBatchNotificationRequestDto.", body: { tokens: ["DEVICE_FCM_TOKEN_1", "DEVICE_FCM_TOKEN_2"], title: "Fitness update", body: "Your new workout is ready" } },
  { id: "email-one", feature: "Email", label: "Email one user", method: "POST", path: "/api/v1/dev/email/send-email-one-user", description: "Send an HTML email to one user. The backend requires name, email, subject, body, and htmlBody.", body: { name: "Alex", email: "user@example.com", subject: "Fitness update", body: "Hello from the Fitness team.", htmlBody: "<html><body><p>Hello from the Fitness team.</p></body></html>" } },
  { id: "email-many", feature: "Email", label: "Email multiple users", method: "POST", path: "/api/v1/dev/email/send-email-more-user", description: "Send an HTML email to the supplied recipient list.", body: { emails: ["user1@example.com", "user2@example.com"], subject: "Fitness update", body: "Hello from the Fitness team.", htmlBody: "<html><body><p>Hello from the Fitness team.</p></body></html>" } },
  { id: "email-all", feature: "Email", label: "Email all users", method: "POST", path: "/api/v1/dev/email/send-email-all-user", description: "The supplied backend currently sends to the emails list in the request; this does not automatically query every registered user.", body: { emails: ["user1@example.com", "user2@example.com"], subject: "Fitness update", body: "Hello from the Fitness team.", htmlBody: "<html><body><p>Hello from the Fitness team.</p></body></html>" } },
];

const features: Feature[] = ["Exercise", "Calculator", "App information", "Feedback", "Notifications", "Email"];
const defaultBody = (operation: Operation) => JSON.stringify(operation.body ?? {}, null, 2);

export default function DeveloperFeatureConsole() {
  const [feature, setFeature] = useState<Feature>("Exercise");
  const [operationId, setOperationId] = useState(operations[0].id);
  const [pathValues, setPathValues] = useState("");
  const [queryValues, setQueryValues] = useState("");
  const [bodyText, setBodyText] = useState(defaultBody(operations[0]));
  const [busy, setBusy] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [errorText, setErrorText] = useState("");

  const featureOperations = useMemo(() => operations.filter((op) => op.feature === feature), [feature]);
  const selected = operations.find((op) => op.id === operationId) ?? featureOperations[0] ?? operations[0];
  const pathKeys = (selected.path.match(/\{([^}]+)\}/g) ?? []).map((value) => value.slice(1, -1));

  function chooseFeature(next: Feature) {
    setFeature(next);
    const nextOp = operations.find((op) => op.feature === next)!;
    setOperationId(nextOp.id);
    setPathValues(""); setQueryValues(""); setBodyText(defaultBody(nextOp));
    setResponseText(""); setResponseStatus(null); setErrorText("");
  }

  function chooseOperation(id: string) {
    const nextOp = operations.find((op) => op.id === id)!;
    setOperationId(id); setPathValues(""); setQueryValues(""); setBodyText(defaultBody(nextOp));
    setResponseText(""); setResponseStatus(null); setErrorText("");
  }

  function parseQuery(input: string) {
    const params = new URLSearchParams();
    input.split("&").map((part) => part.trim()).filter(Boolean).forEach((part) => {
      const separator = part.indexOf("=");
      if (separator < 0) params.set(part, "");
      else params.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
    });
    return params.toString();
  }

  async function execute() {
    setBusy(true); setErrorText(""); setResponseText(""); setResponseStatus(null);
    try {
      const values = pathKeys.length ? pathValues.split(",").map((value) => value.trim()) : [];
      if (pathKeys.length && values.some((value) => !value)) throw new Error(`Enter a value for each path parameter: ${pathKeys.join(", ")}`);
      if (values.length !== pathKeys.length) throw new Error(`Expected ${pathKeys.length} path parameter value(s): ${pathKeys.join(", ") || "none"}`);
      let urlPath = selected.path;
      pathKeys.forEach((key, index) => { urlPath = urlPath.replace(`{${key}}`, encodeURIComponent(values[index])); });
      const query = parseQuery(queryValues);
      if (query) urlPath += `?${query}`;
      const init: RequestInit = { method: selected.method, headers: { Accept: "application/json" } };
      if (!["GET", "DELETE"].includes(selected.method)) {
        let body: unknown;
        try { body = JSON.parse(bodyText); } catch { throw new Error("Request body is not valid JSON."); }
        init.body = JSON.stringify(body);
        (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      }
      const response = await portalFetch(urlPath, init);
      const raw = await response.text();
      let formatted = raw;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
        formatted = JSON.stringify(parsed, null, 2);
      } catch { /* response can be plain text */ }
      setResponseStatus(response.status);
      setResponseText(formatted || (response.ok ? "Request completed with an empty response." : "No response body."));
      if (!response.ok) {
        const data = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined;
        const detail = data ? (data.detail ?? data.message ?? data.error ?? data.title) : undefined;
        if (response.status === 401) {
          setErrorText(typeof detail === "string" ? `Authentication failed: ${detail}` : "Authentication failed (401). Your portal access token may be expired or invalid. Sign out, sign in again, and retry. If it persists, inspect backend JWT-filter logs.");
        } else if (response.status === 403) {
          setErrorText(typeof detail === "string" ? `Forbidden: ${detail}` : "Forbidden (403). Your portal account may not have the ADMIN or DEVELOPER role required for this endpoint.");
        } else {
          setErrorText(typeof detail === "string" ? `Request failed (HTTP ${response.status}): ${detail}` : `Request failed with HTTP ${response.status}. See the response body below.`);
        }
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Request failed.");
    } finally { setBusy(false); }
  }

  return <div className="dev-content dev-feature-content">
    <div className="dev-page-heading"><div><div className="dev-overline">FITNESS APP OPERATIONS</div><h1>Developer tools</h1><p>Manage fitness content and run the developer APIs provided by the backend.</p></div></div>
    <div className="dev-feature-warning"><ShieldAlert size={18} /><div><strong>Live backend actions</strong><p>Requests are sent using your portal session. Create, patch, delete, notification, and email actions may change production data or contact real users. Confirm the selected endpoint and payload before running it.</p></div></div>
    <div className="dev-feature-layout">
      <aside className="dev-panel dev-feature-sidebar"><div className="dev-feature-section-title">TOOLS</div>{features.map((item) => <button key={item} className={`dev-feature-nav ${feature === item ? "active" : ""}`} onClick={() => chooseFeature(item)}>{item}<ChevronDown size={14} /></button>)}</aside>
      <section className="dev-panel dev-feature-workspace">
        <div className="dev-feature-heading"><div><h2>{feature}</h2><p>{featureOperations.length} backend operations mapped from the supplied controller definitions.</p></div><span className="dev-feature-count">{featureOperations.length} endpoints</span></div>
        <label className="dev-feature-label">Operation<select value={selected.id} onChange={(event) => chooseOperation(event.target.value)}>{featureOperations.map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}</select></label>
        <div className="dev-feature-endpoint"><span className={`dev-method ${selected.method.toLowerCase()}`}>{selected.method}</span><code>{selected.path}</code></div>
        <p className="dev-feature-description">{selected.description}</p>
        {pathKeys.length > 0 && <label className="dev-feature-label">Path parameters <span className="dev-feature-hint">Enter values in order: {pathKeys.join(", ")}</span><input value={pathValues} onChange={(event) => setPathValues(event.target.value)} placeholder={pathKeys.join(", ")} /></label>}
        {selected.queryHelp && <label className="dev-feature-label">Query parameters <span className="dev-feature-hint">Format: key=value&amp;key2=value2</span><input value={queryValues} onChange={(event) => setQueryValues(event.target.value)} placeholder={selected.queryHelp} /></label>}
        {!selected.queryHelp && selected.feature === "Exercise" && selected.method === "DELETE" && <label className="dev-feature-label">Query parameters<input value={queryValues} onChange={(event) => setQueryValues(event.target.value)} placeholder="key=value" /></label>}
        {!(["GET", "DELETE"].includes(selected.method)) && <label className="dev-feature-label">JSON request body<textarea className="dev-feature-json" spellCheck={false} value={bodyText} onChange={(event) => setBodyText(event.target.value)} rows={16} /></label>}
        <div className="dev-feature-actions"><button className="dev-feature-run" disabled={busy} onClick={() => void execute()}>{busy ? <LoaderCircle size={16} className="dev-feature-spin" /> : <Play size={15} />} {busy ? "Sending request…" : "Run request"}</button><button className="dev-secondary-button" disabled={busy} onClick={() => { setBodyText(defaultBody(selected)); setPathValues(""); setQueryValues(""); setResponseText(""); setResponseStatus(null); setErrorText(""); }}><RotateCcw size={15} /> Reset</button></div>
        {errorText && <div className="dev-feature-error"><AlertCircle size={17} /><span>{errorText}</span></div>}
        {responseStatus !== null && <div className={`dev-feature-response-head ${responseStatus >= 200 && responseStatus < 300 ? "success" : "failure"}`}>{responseStatus >= 200 && responseStatus < 300 ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />} HTTP {responseStatus}</div>}
        {responseText && <pre className="dev-feature-response">{responseText}</pre>}
      </section>
    </div>
    <p className="dev-feature-footnote"><Code2 size={14} /> The supplied backend ZIP does not include a list/read endpoint for every content type. This console exposes only the controller operations present in that ZIP; request examples for notification and email may need their field names aligned with the DTO definitions in your full backend project.</p>
  </div>;
}
