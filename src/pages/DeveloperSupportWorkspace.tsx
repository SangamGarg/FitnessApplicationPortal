import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  LoaderCircle,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperSupportWorkspace.css";

type SupportTab = "App Information" | "FAQ Management" | "Ticket Management";
type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type TicketCategory =
  | "ACCOUNT" | "PAYMENT" | "WORKOUT" | "TECHNICAL" | "NOTIFICATION"
  | "GOOGLE_FIT_SYNC" | "CALORIE_TRACKER" | "WORKOUT_ACTIVITY"
  | "BILLING_SUBSCRIPTION" | "ACCOUNT_PROFILE" | "BUG_REPORT"
  | "FEATURE_SUGGESTION" | "OTHER";

type Ticket = {
  ticketNumber: string;
  userId?: string;
  userEmail?: string;
  category?: TicketCategory;
  subject?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  diagnosticInfo?: unknown;
  attachmentUrls?: string[];
  resolutionNotes?: string;
  assignedToEmail?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TicketMessage = {
  id: number;
  actorEmail: string;
  message: string;
  internalNote: boolean;
  createdAt: string;
};

type ApiResult = { status: number | null; body: string; error: string };

const categoryLabels: Record<TicketCategory, string> = {
  ACCOUNT: "Account & Login",
  PAYMENT: "Payment & Subscription",
  WORKOUT: "Workout & Exercise",
  TECHNICAL: "Technical Issue",
  NOTIFICATION: "Notifications",
  GOOGLE_FIT_SYNC: "Sensor sync, step counter, bluetooth",
  CALORIE_TRACKER: "Food photo scan, incorrect macro calculation",
  WORKOUT_ACTIVITY: "Timer issue, calories burned metric",
  BILLING_SUBSCRIPTION: "Payment failure, upgrade, refund",
  ACCOUNT_PROFILE: "Login, OTP, ML face verification",
  BUG_REPORT: "App crash, UI glitch",
  FEATURE_SUGGESTION: "Feedback, general ideas",
  OTHER: "Other",
};

const statusTabs: Array<{ value: TicketStatus | ""; label: string }> = [
  { value: "", label: "All Tickets" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const categories = Object.keys(categoryLabels) as TicketCategory[];

async function apiRequest(method: string, path: string, body?: unknown): Promise<ApiResult> {
  try {
    const init: RequestInit = { method, headers: { Accept: "application/json" } };
    if (body !== undefined) {
      init.headers = { Accept: "application/json", "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const response = await portalFetch(path, init);
    const raw = await response.text();
    let formatted = raw;
    let data: unknown;
    if (raw) {
      try {
        data = JSON.parse(raw);
        formatted = JSON.stringify(data, null, 2);
      } catch {
        formatted = raw;
      }
    } else {
      formatted = response.ok ? "Request completed with an empty response." : "No response body.";
    }
    if (!response.ok) {
      const record = data && typeof data === "object" ? data as Record<string, unknown> : undefined;
      const detail = record?.detail ?? record?.message ?? record?.error ?? record?.title;
      return {
        status: response.status,
        body: formatted,
        error: typeof detail === "string"
          ? `HTTP ${response.status}: ${detail}`
          : `Request failed with HTTP ${response.status}.`,
      };
    }
    return { status: response.status, body: formatted, error: "" };
  } catch (error) {
    return { status: null, body: "", error: error instanceof Error ? error.message : "Network request failed." };
  }
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [feedback, setFeedback] = useState<"copied" | "error" | "">("");
  const [rippleKey, setRippleKey] = useState(0);
  const feedbackTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
  }, []);

  async function copy() {
    setRippleKey((current) => current + 1);
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);

    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(value);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }

    feedbackTimer.current = window.setTimeout(() => setFeedback(""), 1700);
  }

  return (
    <button
      type="button"
      className={`support-copy-button ${feedback ? `feedback-${feedback}` : ""}`}
      onClick={() => void copy()}
      aria-label={feedback === "copied" ? `${label} copied` : feedback === "error" ? `${label} failed` : label}
      title={label}
    >
      {label === "Copy endpoint" ? <Copy size={14} /> : <><Copy size={13} /> Copy</>}
      {feedback && <span className="support-copy-popup" role="status">{feedback === "copied" ? "Copied" : "Copy failed"}</span>}
      {rippleKey > 0 && <span key={rippleKey} className="support-copy-ripple" aria-hidden="true" />}
    </button>
  );
}

function JsonInspector({ endpoint, method, request, result }: {
  endpoint: string;
  method: string;
  request?: unknown;
  result: ApiResult;
}) {
  const requestJson = request === undefined ? "" : JSON.stringify(request, null, 2);
  return (
    <div className="support-inspector">
      <div className="support-inspector-head">
        <span className={`support-method ${method.toLowerCase()}`}>{method}</span>
        <code>{endpoint}</code>
        <CopyButton value={endpoint} label="Copy endpoint" />
      </div>
      {requestJson && (
        <div className="support-inspector-block">
          <div><strong>Request JSON</strong><CopyButton value={requestJson} label="Copy request JSON" /></div>
          <pre>{requestJson}</pre>
        </div>
      )}
      {result.status !== null && (
        <div className={`support-response-status ${result.error ? "failure" : "success"}`}>
          {result.error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          HTTP {result.status}
        </div>
      )}
      {result.error && <div className="support-error"><AlertCircle size={16} />{result.error}</div>}
      {result.body && (
        <div className="support-inspector-block">
          <div><strong>Response JSON</strong><CopyButton value={result.body} label="Copy response JSON" /></div>
          <pre>{result.body}</pre>
        </div>
      )}
    </div>
  );
}

function ContentEditor({
  title, endpoint, method, result, setResult,
}: { title: string; endpoint: string; method: "POST" | "PATCH"; result: ApiResult; setResult: (value: ApiResult) => void }) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState("");
  const request = { content };

  async function submit() {
    if (!content.trim()) {
      setValidation(`${title} content cannot be blank.`);
      return;
    }
    setValidation("");
    setBusy(true);
    setResult(await apiRequest(method, endpoint, request));
    setBusy(false);
  }

  return (
    <div className="support-editor-grid">
      <section className="support-panel">
        <div className="support-panel-heading"><div><h2>{method === "POST" ? "Create" : "Update"} {title}</h2><p>{method === "POST" ? "Upload" : "Patch"} content using the Support API.</p></div></div>
        <label className="support-field">{title}
          <textarea rows={14} value={content} onChange={(event) => setContent(event.target.value)} placeholder={`Enter ${title.toLowerCase()} content...`} />
          <span className={validation ? "support-helper support-invalid" : "support-helper"}>{validation || "Required. The content must not be blank."}</span>
        </label>
        <div className="support-character-count">{content.length.toLocaleString()} characters</div>
        <div className="support-preview">
          <strong>Preview</strong>
          <div>{content.trim() ? content : "No content entered."}</div>
        </div>
        <button className="support-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? <LoaderCircle size={15} className="support-spin" /> : <Send size={15} />}
          {busy ? "Submitting…" : `${method === "POST" ? "Upload" : "Patch"} content`}
        </button>
      </section>
      <JsonInspector endpoint={endpoint} method={method} request={request} result={result} />
    </div>
  );
}

function AppInformation() {
  const [operation, setOperation] = useState("About Us");
  const [result, setResult] = useState<ApiResult>({ status: null, body: "", error: "" });
  const [getInfoBusy, setGetInfoBusy] = useState(false);
  const getInfoRequestId = useRef(0);
  const getInfoEndpoint = "/api/v1/portal/dev/support/info-portal";
  const operationMap: Record<string, { endpoint: string; method: "POST" | "PATCH" }> = {
    "About Us": { endpoint: "/api/v1/portal/dev/support/upload/about", method: "POST" },
    "Update About Us": { endpoint: "/api/v1/portal/dev/support/patch/about", method: "PATCH" },
    "Privacy Policy": { endpoint: "/api/v1/portal/dev/support/upload/privacy-policy", method: "POST" },
    "Update Privacy Policy": { endpoint: "/api/v1/portal/dev/support/patch/privacy-policy", method: "PATCH" },
    "Terms & Conditions": { endpoint: "/api/v1/portal/dev/support/upload/terms-condition", method: "POST" },
    "Update Terms & Conditions": { endpoint: "/api/v1/portal/dev/support/patch/terms-condition", method: "PATCH" },
  };
  const selected = operationMap[operation];

  async function chooseOperation(label: string) {
    setOperation(label);
    setResult({ status: null, body: "", error: "" });
    const requestId = ++getInfoRequestId.current;
    if (label !== "Get App Info") {
      setGetInfoBusy(false);
      return;
    }

    setGetInfoBusy(true);
    const response = await apiRequest("GET", getInfoEndpoint);
    if (requestId === getInfoRequestId.current) {
      setResult(response);
      setGetInfoBusy(false);
    }
  }

  async function refreshAppInfo() {
    const requestId = ++getInfoRequestId.current;
    setGetInfoBusy(true);
    setResult({ status: null, body: "", error: "" });
    const response = await apiRequest("GET", getInfoEndpoint);
    if (requestId === getInfoRequestId.current) {
      setResult(response);
      setGetInfoBusy(false);
    }
  }

  return (
    <div>
      <div className="support-subtabs" role="tablist">
        {Object.entries(operationMap).map(([label]) => (
          <button key={label} className={operation === label ? "active" : ""} onClick={() => void chooseOperation(label)}>
            {label === "About Us" ? "Create About Us" : label === "Privacy Policy" ? "Create Privacy Policy" : label === "Terms & Conditions" ? "Create Terms and Conditions" : label}
          </button>
        ))}
        <button className={operation === "Get App Info" ? "active" : ""} onClick={() => void chooseOperation("Get App Info")}>Get App Info</button>
      </div>
      {operation === "Get App Info" ? (
        <div className="support-editor-grid">
          <section className="support-panel support-app-info-panel">
            <div className="support-panel-heading"><div><h2>Get App Info</h2><p>Retrieve the current About Us, Terms &amp; Conditions, and Privacy Policy records.</p></div></div>
            <div className="support-info-fields">
              <span>GET</span>
              <code>{getInfoEndpoint}</code>
            </div>
            <p className="support-helper">The response displays the actual content, timestamps, version, and updated-by values returned by the server. Missing records remain null if that is what the API returns.</p>
            <button className="support-primary" disabled={getInfoBusy} onClick={() => void refreshAppInfo()}>
              {getInfoBusy ? <LoaderCircle size={15} className="support-spin" /> : <RefreshCw size={15} />}
              {getInfoBusy ? "Loading app info…" : "Refresh app info"}
            </button>
          </section>
          <JsonInspector endpoint={getInfoEndpoint} method="GET" result={result} />
        </div>
      ) : (
        <>
          <ContentEditor key={operation} title={operation} endpoint={selected.endpoint} method={selected.method} result={result} setResult={setResult} />
          <div className="support-update-links">
            <strong>Update endpoint</strong>
            <code>{operation === "About Us" || operation === "Update About Us" ? "/api/v1/portal/dev/support/patch/about" : operation === "Privacy Policy" || operation === "Update Privacy Policy" ? "/api/v1/portal/dev/support/patch/privacy-policy" : "/api/v1/portal/dev/support/patch/terms-condition"}</code>
          </div>
        </>
      )}
    </div>
  );
}

type FaqDraft = { question: string; answer: string; categoryKey: string; sortOrder: number; popular: boolean; active: boolean };

type PortalFaq = {
  id: number;
  categoryId: number;
  categoryKey: string;
  categoryName: string;
  question: string;
  answer: string;
  popular: boolean;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
  updatedBy: string;
};

function FaqManagement() {
  const [tab, setTab] = useState<"Upload" | "Edit" | "Category" | "Get">("Upload");
  const [result, setResult] = useState<ApiResult>({ status: null, body: "", error: "" });
  const [faqList, setFaqList] = useState<PortalFaq[]>([]);
  const [getFaqBusy, setGetFaqBusy] = useState(false);
  const faqRequestId = useRef(0);
  const [faqs, setFaqs] = useState<FaqDraft[]>([{ question: "", answer: "", categoryKey: "", sortOrder: 0, popular: false, active: true }]);
  const [faqId, setFaqId] = useState("");
  const [faqPatch, setFaqPatch] = useState({ question: "", answer: "", categoryKey: "", sortOrder: "", popular: "", active: "" });
  const [category, setCategory] = useState({ categoryKey: "", name: "", description: "", iconKey: "", active: true, sortOrder: 0 });
  const [validation, setValidation] = useState("");
  const [busy, setBusy] = useState(false);

  async function getFaqs() {
    const requestId = ++faqRequestId.current;
    setGetFaqBusy(true);
    setResult({ status: null, body: "", error: "" });
    const response = await apiRequest("GET", "/api/v1/portal/dev/support/get-faqs");
    if (requestId !== faqRequestId.current) return;
    setResult(response);
    if (response.error) {
      setFaqList([]);
    } else {
      try {
        const parsed: unknown = JSON.parse(response.body);
        if (!Array.isArray(parsed)) throw new Error("Expected an FAQ list.");
        setFaqList(parsed as PortalFaq[]);
      } catch {
        setFaqList([]);
        setResult({ ...response, error: "The FAQ response was not a valid JSON array." });
      }
    }
    setGetFaqBusy(false);
  }

  function chooseFaqTab(nextTab: "Upload" | "Edit" | "Category" | "Get") {
    setTab(nextTab);
    setValidation("");
    setResult({ status: null, body: "", error: "" });
    if (nextTab === "Get") void getFaqs();
  }

  function updateFaq(index: number, field: keyof FaqDraft, value: string | number | boolean) {
    setFaqs((current) => current.map((faq, itemIndex) => itemIndex === index ? { ...faq, [field]: value } : faq));
  }

  async function submitFaqs() {
    if (!faqs.length) { setValidation("Add at least one FAQ."); return; }
    const invalid = faqs.find((faq) => !faq.question.trim() || !faq.answer.trim() || !faq.categoryKey.trim());
    if (invalid) { setValidation("Each FAQ requires a question, answer, and category key."); return; }
    setValidation("");
    setBusy(true);
    setResult(await apiRequest("POST", "/api/v1/portal/dev/support/upload/faqs", faqs));
    setBusy(false);
  }

  async function submitFaqPatch() {
    if (!faqId.trim()) { setValidation("FAQ ID is required."); return; }
    const body: Record<string, unknown> = {};
    if (faqPatch.question) body.question = faqPatch.question;
    if (faqPatch.answer) body.answer = faqPatch.answer;
    if (faqPatch.categoryKey) body.categoryKey = faqPatch.categoryKey;
    if (faqPatch.sortOrder !== "") body.sortOrder = Number(faqPatch.sortOrder);
    if (faqPatch.popular !== "") body.popular = faqPatch.popular === "true";
    if (faqPatch.active !== "") body.active = faqPatch.active === "true";
    if (typeof body.question === "string" && (body.question.length < 1 || body.question.length > 500)) { setValidation("Question must contain 1–500 characters."); return; }
    if (typeof body.answer === "string" && (body.answer.length < 1 || body.answer.length > 10000)) { setValidation("Answer must contain 1–10000 characters."); return; }
    if (typeof body.sortOrder === "number" && body.sortOrder < 0) { setValidation("Sort order cannot be negative."); return; }
    setValidation("");
    setBusy(true);
    setResult(await apiRequest("PATCH", `/api/v1/portal/dev/support/patch/faqs/${encodeURIComponent(faqId)}`, body));
    setBusy(false);
  }

  async function submitCategory() {
    if (!category.categoryKey.trim() || !category.name.trim()) { setValidation("Category key and name are required."); return; }
    if (category.categoryKey.length > 60 || category.name.length > 100 || category.description.length > 300 || category.iconKey.length > 60 || category.sortOrder < 0) {
      setValidation("One or more category fields exceed its validation limit.");
      return;
    }
    setValidation("");
    setBusy(true);
    setResult(await apiRequest("POST", "/api/v1/portal/dev/support/upload/faqs/category", category));
    setBusy(false);
  }

  return (
    <div>
      <div className="support-subtabs">
        {(["Upload", "Edit", "Category", "Get"] as const).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => chooseFaqTab(item)}>{item === "Upload" ? "FAQ List / Upload" : item === "Edit" ? "Edit FAQ" : item === "Category" ? "FAQ Categories" : "Get FAQs"}</button>)}
      </div>
      {tab === "Get" && (
        <div className="support-faq-results">
          <section className="support-panel support-faq-results-panel">
            <div className="support-panel-heading">
              <div><h2>FAQs</h2><p>{getFaqBusy ? "Fetching FAQs…" : `${faqList.length} FAQs returned by the API.`}</p></div>
              <button className="support-secondary" disabled={getFaqBusy} onClick={() => void getFaqs()}>
                {getFaqBusy ? <LoaderCircle size={14} className="support-spin" /> : <RefreshCw size={14} />}
                Refresh
              </button>
            </div>
            {getFaqBusy ? (
              <div className="support-loading"><LoaderCircle size={18} className="support-spin" />Loading FAQs…</div>
            ) : result.error ? (
              <div className="support-error"><AlertCircle size={16} />{result.error}</div>
            ) : faqList.length === 0 ? (
              <div className="support-empty"><strong>No FAQs found</strong><p>The API returned an empty FAQ list.</p></div>
            ) : (
              <div className="support-faq-results-list">
                {faqList.map((faq) => (
                  <article className="support-faq-result-card" key={faq.id}>
                    <div className="support-faq-result-meta">
                      <strong>{faq.categoryName || faq.categoryKey}</strong>
                      <span>#{faq.id}</span>
                      {faq.popular && <span className="support-faq-flag">Popular</span>}
                      <span className={faq.active ? "support-faq-active" : "support-faq-inactive"}>{faq.active ? "Active" : "Inactive"}</span>
                    </div>
                    <h3>{faq.question}</h3>
                    <p>{faq.answer}</p>
                    <small>Order {faq.sortOrder} · Updated {faq.updatedAt ? new Date(faq.updatedAt).toLocaleString() : "—"}{faq.updatedBy ? ` · ${faq.updatedBy}` : ""}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
          <JsonInspector endpoint="/api/v1/portal/dev/support/get-faqs" method="GET" result={result} />
        </div>
      )}
      {tab === "Upload" && (
        <div className="support-editor-grid">
          <section className="support-panel">
            <div className="support-faq-list">
              {faqs.map((faq, index) => (
                <div className="support-faq-card" key={index}>
                  <div className="support-faq-card-head"><strong>FAQ {index + 1}</strong><button type="button" onClick={() => setFaqs((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /> Remove</button></div>
                  <label className="support-field">Question<input value={faq.question} maxLength={500} onChange={(event) => updateFaq(index, "question", event.target.value)} /><span className="support-helper">Required. 1–500 characters.</span></label>
                  <label className="support-field">Answer<textarea rows={4} value={faq.answer} maxLength={10000} onChange={(event) => updateFaq(index, "answer", event.target.value)} /><span className="support-helper">Required. 1–10000 characters.</span></label>
                  <div className="support-field-grid">
                    <label className="support-field">Category key<input value={faq.categoryKey} onChange={(event) => updateFaq(index, "categoryKey", event.target.value)} /><span className="support-helper">Required category key, for example WORKOUT.</span></label>
                    <label className="support-field">Sort order<input type="number" min={0} value={faq.sortOrder} onChange={(event) => updateFaq(index, "sortOrder", Number(event.target.value))} /><span className="support-helper">Non-negative display order.</span></label>
                  </div>
                  <div className="support-toggle-row"><label><input type="checkbox" checked={faq.popular} onChange={(event) => updateFaq(index, "popular", event.target.checked)} /> Popular</label><label><input type="checkbox" checked={faq.active} onChange={(event) => updateFaq(index, "active", event.target.checked)} /> Active</label></div>
                </div>
              ))}
            </div>
            {validation && <div className="support-error"><AlertCircle size={15} />{validation}</div>}
            <div className="support-actions">
              <button className="support-secondary" onClick={() => setFaqs((current) => [...current, { question: "", answer: "", categoryKey: "", sortOrder: current.length, popular: false, active: true }])}>Add FAQ</button>
              <button className="support-primary" disabled={busy || !faqs.length} onClick={() => void submitFaqs()}>{busy ? <LoaderCircle size={15} className="support-spin" /> : <Send size={15} />}Upload FAQs</button>
            </div>
          </section>
          <JsonInspector endpoint="/api/v1/portal/dev/support/upload/faqs" method="POST" request={faqs} result={result} />
        </div>
      )}
      {tab === "Edit" && (
        <div className="support-editor-grid">
          <section className="support-panel">
            <label className="support-field">FAQ ID<input value={faqId} onChange={(event) => setFaqId(event.target.value)} /><span className="support-helper">Required numeric ID in the endpoint path.</span></label>
            <label className="support-field">Question<input value={faqPatch.question} maxLength={500} onChange={(event) => setFaqPatch({ ...faqPatch, question: event.target.value })} /><span className="support-helper">Optional. 1–500 characters when supplied.</span></label>
            <label className="support-field">Answer<textarea rows={5} value={faqPatch.answer} maxLength={10000} onChange={(event) => setFaqPatch({ ...faqPatch, answer: event.target.value })} /><span className="support-helper">Optional. 1–10000 characters when supplied.</span></label>
            <div className="support-field-grid">
              <label className="support-field">Category key<input value={faqPatch.categoryKey} onChange={(event) => setFaqPatch({ ...faqPatch, categoryKey: event.target.value })} /><span className="support-helper">Optional category key.</span></label>
              <label className="support-field">Sort order<input type="number" min={0} value={faqPatch.sortOrder} onChange={(event) => setFaqPatch({ ...faqPatch, sortOrder: event.target.value })} /><span className="support-helper">Optional and cannot be negative.</span></label>
            </div>
            <div className="support-field-grid">
              <label className="support-field">Popular<select value={faqPatch.popular} onChange={(event) => setFaqPatch({ ...faqPatch, popular: event.target.value })}><option value="">Omit</option><option value="true">True</option><option value="false">False</option></select><span className="support-helper">Only send the selected value.</span></label>
              <label className="support-field">Active<select value={faqPatch.active} onChange={(event) => setFaqPatch({ ...faqPatch, active: event.target.value })}><option value="">Omit</option><option value="true">True</option><option value="false">False</option></select><span className="support-helper">Only send the selected value.</span></label>
            </div>
            {validation && <div className="support-error"><AlertCircle size={15} />{validation}</div>}
            <button className="support-primary" disabled={busy} onClick={() => void submitFaqPatch()}>{busy ? <LoaderCircle size={15} className="support-spin" /> : <Send size={15} />}Patch FAQ</button>
          </section>
          <JsonInspector endpoint={`/api/v1/portal/dev/support/patch/faqs/${faqId || "{id}"}`} method="PATCH" request={(() => {
            const body: Record<string, unknown> = {};
            if (faqPatch.question) body.question = faqPatch.question;
            if (faqPatch.answer) body.answer = faqPatch.answer;
            if (faqPatch.categoryKey) body.categoryKey = faqPatch.categoryKey;
            if (faqPatch.sortOrder !== "") body.sortOrder = Number(faqPatch.sortOrder);
            if (faqPatch.popular !== "") body.popular = faqPatch.popular === "true";
            if (faqPatch.active !== "") body.active = faqPatch.active === "true";
            return body;
          })()} result={result} />
        </div>
      )}
      {tab === "Category" && (
        <div className="support-editor-grid">
          <section className="support-panel">
            <div className="support-field-grid">
              <label className="support-field">Category key<input value={category.categoryKey} maxLength={60} onChange={(event) => setCategory({ ...category, categoryKey: event.target.value })} /><span className="support-helper">Required. Maximum 60 characters.</span></label>
              <label className="support-field">Name<input value={category.name} maxLength={100} onChange={(event) => setCategory({ ...category, name: event.target.value })} /><span className="support-helper">Required. Maximum 100 characters.</span></label>
            </div>
            <label className="support-field">Description<textarea rows={4} value={category.description} maxLength={300} onChange={(event) => setCategory({ ...category, description: event.target.value })} /><span className="support-helper">Optional. Maximum 300 characters.</span></label>
            <div className="support-field-grid">
              <label className="support-field">Icon key<input value={category.iconKey} maxLength={60} onChange={(event) => setCategory({ ...category, iconKey: event.target.value })} /><span className="support-helper">Optional. Maximum 60 characters.</span></label>
              <label className="support-field">Sort order<input type="number" min={0} value={category.sortOrder} onChange={(event) => setCategory({ ...category, sortOrder: Number(event.target.value) })} /><span className="support-helper">Non-negative display order.</span></label>
            </div>
            <label className="support-toggle-row"><input type="checkbox" checked={category.active} onChange={(event) => setCategory({ ...category, active: event.target.checked })} /> Active category</label>
            {validation && <div className="support-error"><AlertCircle size={15} />{validation}</div>}
            <button className="support-primary" disabled={busy} onClick={() => void submitCategory()}>{busy ? <LoaderCircle size={15} className="support-spin" /> : <Send size={15} />}Create category</button>
          </section>
          <JsonInspector endpoint="/api/v1/portal/dev/support/upload/faqs/category" method="POST" request={category} result={result} />
        </div>
      )}
    </div>
  );
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function TicketManagement() {
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedNumber, setSelectedNumber] = useState("");
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageResult, setMessageResult] = useState<ApiResult>({ status: null, body: "", error: "" });
  const [update, setUpdate] = useState({ status: "", priority: "", assignedToEmail: "", resolutionNotes: "" });
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateResult, setUpdateResult] = useState<ApiResult>({ status: null, body: "", error: "" });
  const searchInitialized = useRef(false);

  async function loadTickets(nextPage = page) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (query.trim()) params.set("query", query.trim());
    params.set("page", String(nextPage));
    params.set("size", String(size));
    const result = await apiRequest("GET", `/api/v1/portal/dev/support/tickets?${params.toString()}`);
    if (result.error) {
      setError(result.error);
      setTickets([]);
      setTotalPages(0);
      setTotalElements(null);
    } else {
      try {
        const parsed = result.body ? JSON.parse(result.body) as unknown : null;
        if (parsed && typeof parsed === "object") {
          const record = parsed as Record<string, unknown>;
          const content = safeArray(record.content);
          setTickets(content as Ticket[]);
          setTotalPages(typeof record.totalPages === "number" ? record.totalPages : 0);
          setTotalElements(typeof record.totalElements === "number" ? record.totalElements : null);
          setPage(typeof record.number === "number" ? record.number : nextPage);
        } else {
          setTickets([]);
          setTotalPages(0);
          setTotalElements(null);
        }
      } catch {
        setTickets([]);
        setError("The ticket list response could not be parsed.");
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    setPage(0);
    void loadTickets(0);
    // Status, category, and page size changes must reset and reload from page zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category, size]);

  useEffect(() => {
    if (!searchInitialized.current) {
      searchInitialized.current = true;
      return;
    }
    const timeout = window.setTimeout(() => {
      setPage(0);
      void loadTickets(0);
    }, 350);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function openTicket(ticketNumber: string) {
    setSelectedNumber(ticketNumber);
    setDetailLoading(true);
    setDetail(null);
    setMessages([]);
    setUpdate({ status: "", priority: "", assignedToEmail: "", resolutionNotes: "" });
    setUpdateResult({ status: null, body: "", error: "" });
    setMessageResult({ status: null, body: "", error: "" });
    const encoded = encodeURIComponent(ticketNumber);
    const [detailResult, messageResult] = await Promise.all([
      apiRequest("GET", `/api/v1/portal/dev/support/tickets/${encoded}`),
      apiRequest("GET", `/api/v1/portal/dev/support/tickets/${encoded}/messages`),
    ]);
    if (!detailResult.error && detailResult.body) {
      try { setDetail(JSON.parse(detailResult.body) as Ticket); } catch { setDetail(null); }
    }
    if (!messageResult.error && messageResult.body) {
      try {
        const parsed = JSON.parse(messageResult.body) as unknown;
        setMessages(Array.isArray(parsed) ? parsed as TicketMessage[] : []);
      } catch { setMessages([]); }
    }
    setDetailLoading(false);
  }

  async function refreshTicketDetails() {
    if (!selectedNumber) return;
    await openTicket(selectedNumber);
    setLoading(true);
    await loadTickets(page);
    setLoading(false);
  }

  async function addMessage() {
    if (!selectedNumber || !messageText.trim()) return;
    setMessageBusy(true);
    const request = { message: messageText, internalNote };
    const result = await apiRequest("POST", `/api/v1/portal/dev/support/tickets/${encodeURIComponent(selectedNumber)}/messages`, request);
    setMessageResult(result);
    if (!result.error) {
      setMessageText("");
      const messageResult = await apiRequest("GET", `/api/v1/portal/dev/support/tickets/${encodeURIComponent(selectedNumber)}/messages`);
      if (!messageResult.error && messageResult.body) {
        try { setMessages(JSON.parse(messageResult.body) as TicketMessage[]); } catch { /* keep existing timeline */ }
      }
    }
    setMessageBusy(false);
  }

  async function submitUpdate() {
    if (!selectedNumber) return;
    const body: Record<string, unknown> = {};
    if (update.status) body.status = update.status;
    if (update.priority) body.priority = update.priority;
    if (update.assignedToEmail) body.assignedToEmail = update.assignedToEmail;
    if (update.resolutionNotes) body.resolutionNotes = update.resolutionNotes;
    if (update.assignedToEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(update.assignedToEmail) || update.assignedToEmail.length > 254)) {
      setUpdateResult({ status: null, body: "", error: "Enter a valid email address of 254 characters or fewer." });
      return;
    }
    if (update.resolutionNotes.length > 5000) {
      setUpdateResult({ status: null, body: "", error: "Resolution notes cannot exceed 5000 characters." });
      return;
    }
    setUpdateBusy(true);
    const result = await apiRequest("PATCH", `/api/v1/portal/dev/support/tickets/${encodeURIComponent(selectedNumber)}/status`, body);
    setUpdateResult(result);
    setUpdateBusy(false);
    if (!result.error) await refreshTicketDetails();
  }

  const updateRequest = useMemo(() => {
    const body: Record<string, unknown> = {};
    if (update.status) body.status = update.status;
    if (update.priority) body.priority = update.priority;
    if (update.assignedToEmail) body.assignedToEmail = update.assignedToEmail;
    if (update.resolutionNotes) body.resolutionNotes = update.resolutionNotes;
    return body;
  }, [update]);

  return (
    <div className="support-ticket-layout">
      <section className="support-panel support-ticket-list-panel">
        <div className="support-ticket-toolbar">
          <label className="support-search"><Search size={15} /><input value={query} placeholder="Search tickets" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setPage(0); void loadTickets(0); } }} /></label>
          <select value={category} onChange={(event) => { setCategory(event.target.value as TicketCategory | ""); setPage(0); }}>
            <option value="">All Categories</option>
            {categories.map((item) => <option key={item} value={item}>{item} — {categoryLabels[item]}</option>)}
          </select>
          <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
            {[20, 50, 100].map((item) => <option key={item} value={item}>{item} / page</option>)}
          </select>
          <button className="support-secondary" disabled={loading} onClick={() => void loadTickets(page)}><RefreshCw size={14} /> Refresh</button>
        </div>
        <div className="support-status-tabs">
          {statusTabs.map((item) => <button key={item.label} className={status === item.value ? "active" : ""} onClick={() => { setStatus(item.value); setPage(0); }}>{item.label}</button>)}
        </div>
        {loading ? (
          <div className="support-loading"><LoaderCircle size={18} className="support-spin" />Loading tickets…</div>
        ) : error ? (
          <div className="support-error"><AlertCircle size={16} />{error}</div>
        ) : tickets.length === 0 ? (
          <div className="support-empty"><strong>No tickets found</strong><p>The selected status, category, or search returned no records.</p></div>
        ) : (
          <div className="support-ticket-table-wrap">
            <table className="support-ticket-table">
              <thead><tr><th>Ticket</th><th>Subject</th><th>Status</th><th>Priority</th><th>Category</th><th>Updated</th></tr></thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.ticketNumber} className={selectedNumber === ticket.ticketNumber ? "selected" : ""} onClick={() => void openTicket(ticket.ticketNumber)}>
                    <td><strong>{ticket.ticketNumber}</strong><small>{ticket.userEmail || "—"}</small></td>
                    <td>{ticket.subject || "—"}</td>
                    <td><span className={`support-badge status-${ticket.status?.toLowerCase()}`}>{ticket.status?.replace("_", " ") || "—"}</span></td>
                    <td><span className={`support-badge priority-${ticket.priority?.toLowerCase()}`}>{ticket.priority || "—"}</span></td>
                    <td>{ticket.category ? categoryLabels[ticket.category] : "—"}</td>
                    <td>{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="support-pagination">
          <span>{totalElements !== null ? `${totalElements} total` : "Page " + (page + 1)}{totalPages ? ` · ${totalPages} pages` : ""}</span>
          <div>
            <button className="support-secondary" disabled={loading || page <= 0} onClick={() => { const next = Math.max(0, page - 1); setPage(next); void loadTickets(next); }}><ChevronLeft size={14} />Previous</button>
            <span>Page {page + 1}</span>
            <button className="support-secondary" disabled={loading || (totalPages > 0 ? page >= totalPages - 1 : tickets.length < size)} onClick={() => { const next = page + 1; setPage(next); void loadTickets(next); }}>Next<ChevronRight size={14} /></button>
          </div>
        </div>
      </section>

      {selectedNumber && (
        <aside className="support-panel support-ticket-detail">
          <div className="support-detail-head"><div><span>Ticket</span><strong>{selectedNumber}</strong></div><button type="button" onClick={() => setSelectedNumber("")} title="Close details"><X size={16} /></button></div>
          {detailLoading ? <div className="support-loading"><LoaderCircle size={16} className="support-spin" />Loading details…</div> : detail ? (
            <>
              <div className="support-detail-summary">
                <h3>{detail.subject || "Untitled ticket"}</h3>
                <p>{detail.description || "No description returned."}</p>
                <dl>
                  <div><dt>User</dt><dd>{detail.userEmail || "—"}</dd></div>
                  <div><dt>Category</dt><dd>{detail.category ? categoryLabels[detail.category] : "—"}</dd></div>
                  <div><dt>Status</dt><dd>{detail.status || "—"}</dd></div>
                  <div><dt>Priority</dt><dd>{detail.priority || "—"}</dd></div>
                  <div><dt>Assigned to</dt><dd>{detail.assignedToEmail || "—"}</dd></div>
                  <div><dt>Created</dt><dd>{detail.createdAt ? new Date(detail.createdAt).toLocaleString() : "—"}</dd></div>
                  <div><dt>Updated</dt><dd>{detail.updatedAt ? new Date(detail.updatedAt).toLocaleString() : "—"}</dd></div>
                </dl>
              </div>
              {detail.diagnosticInfo != null && <div className="support-detail-block"><strong>Diagnostic information</strong><pre>{JSON.stringify(detail.diagnosticInfo, null, 2)}</pre></div>}
              {detail.attachmentUrls?.length ? <div className="support-detail-block"><strong>Attachments</strong>{detail.attachmentUrls.map((url, index) => /^https?:\/\//i.test(url) ? <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer">Attachment {index + 1}</a> : <span key={`${url}-${index}`}>{url}</span>)}</div> : null}
              {detail.resolutionNotes && <div className="support-detail-block"><strong>Resolution notes</strong><p>{detail.resolutionNotes}</p></div>}

              <div className="support-detail-section">
                <h3>Update ticket</h3>
                <div className="support-field-grid">
                  <label className="support-field">Status<select value={update.status} onChange={(event) => setUpdate({ ...update, status: event.target.value })}><option value="">Omit</option>{statusTabs.slice(1).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><span className="support-helper">Only send a selected status.</span></label>
                  <label className="support-field">Priority<select value={update.priority} onChange={(event) => setUpdate({ ...update, priority: event.target.value })}><option value="">Omit</option>{(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as TicketPriority[]).map((item) => <option key={item} value={item}>{item}</option>)}</select><span className="support-helper">Only send a selected priority.</span></label>
                </div>
                <label className="support-field">Assigned to email<input type="email" value={update.assignedToEmail} maxLength={254} onChange={(event) => setUpdate({ ...update, assignedToEmail: event.target.value })} /><span className="support-helper">Optional. Valid email, maximum 254 characters.</span></label>
                <label className="support-field">Resolution notes<textarea rows={4} value={update.resolutionNotes} maxLength={5000} onChange={(event) => setUpdate({ ...update, resolutionNotes: event.target.value })} /><span className="support-helper">Optional. Maximum 5000 characters.</span></label>
                <button className="support-primary" disabled={updateBusy} onClick={() => void submitUpdate()}>{updateBusy ? <LoaderCircle size={15} className="support-spin" /> : <Send size={15} />}Update ticket</button>
                <JsonInspector endpoint={`/api/v1/portal/dev/support/tickets/${selectedNumber}/status`} method="PATCH" request={updateRequest} result={updateResult} />
              </div>

              <div className="support-detail-section">
                <h3>Messages</h3>
                <div className="support-message-timeline">
                  {messages.length ? messages.map((item) => (
                    <article key={item.id} className={item.internalNote ? "internal" : ""}>
                      <strong>{item.actorEmail}</strong>{item.internalNote && <span>Internal note</span>}<time>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</time><p>{item.message}</p>
                    </article>
                  )) : <div className="support-empty compact"><strong>No messages</strong></div>}
                </div>
                <label className="support-field">Message<textarea rows={4} value={messageText} maxLength={5000} onChange={(event) => setMessageText(event.target.value)} /><span className={messageText.trim() ? "support-helper" : "support-helper support-invalid"}>{messageText.trim() ? "Maximum 5000 characters." : "Required. Message cannot be blank."}</span></label>
                <label className="support-toggle-row"><input type="checkbox" checked={internalNote} onChange={(event) => setInternalNote(event.target.checked)} /> Internal note</label>
                <button className="support-primary" disabled={messageBusy || !messageText.trim()} onClick={() => void addMessage()}>{messageBusy ? <LoaderCircle size={15} className="support-spin" /> : <Send size={15} />}{messageBusy ? "Sending…" : "Send message"}</button>
                <JsonInspector endpoint={`/api/v1/portal/dev/support/tickets/${selectedNumber}/messages`} method="POST" request={{ message: messageText, internalNote }} result={messageResult} />
              </div>
            </>
          ) : <div className="support-empty compact"><strong>Ticket details unavailable</strong><p>The details endpoint did not return a readable ticket.</p></div>}
        </aside>
      )}
    </div>
  );
}

export default function DeveloperSupportWorkspace() {
  const [tab, setTab] = useState<SupportTab>("App Information");
  return (
    <div className="dev-content support-workspace">
      <div className="dev-page-heading">
        <div><h1>Support Center</h1><p>Manage app information, FAQs, and support tickets through authenticated backend APIs.</p></div>
      </div>
      <nav className="support-tabs" aria-label="Support sections">
        {(["App Information", "FAQ Management", "Ticket Management"] as SupportTab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>
        ))}
      </nav>
      {tab === "App Information" && <AppInformation />}
      {tab === "FAQ Management" && <FaqManagement />}
      {tab === "Ticket Management" && <TicketManagement />}
    </div>
  );
}
