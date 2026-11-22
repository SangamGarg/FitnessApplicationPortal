import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  LoaderCircle,
  RefreshCw,
  Search,
  Trash2,
  UserRoundSearch,
  X,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperFeedbackManagement.css";

type FeedbackDetailsDto = {
  id: number;
  feedback: string;
  name: string;
  email: string;
  userId: string;
  createdAt: string;
};

type FeedbackPage = {
  content: FeedbackDetailsDto[];
  number: number;
  size: number;
  totalElements: number | null;
  totalPages: number | null;
};

type InspectorState = {
  method: "GET" | "DELETE";
  endpoint: string;
  status: number | null;
  response: string;
  error: string;
  loading: boolean;
};

const EMPTY_PAGE: FeedbackPage = {
  content: [],
  number: 0,
  size: 20,
  totalElements: null,
  totalPages: null,
};

const INITIAL_INSPECTOR: InspectorState = {
  method: "GET",
  endpoint: "/api/v1/portal/dev/feedback?page=0&size=20",
  status: null,
  response: "",
  error: "",
  loading: false,
};

function isFeedback(value: unknown): value is FeedbackDetailsDto {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "number"
    && typeof record.feedback === "string"
    && typeof record.name === "string"
    && typeof record.email === "string"
    && typeof record.userId === "string"
    && typeof record.createdAt === "string";
}

function readPage(value: unknown, fallbackPage: number, fallbackSize: number): FeedbackPage {
  if (!value || typeof value !== "object") throw new Error("The feedback response was not a page object.");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.content) || !record.content.every(isFeedback)) {
    throw new Error("The feedback response did not contain a valid content list.");
  }
  return {
    content: record.content,
    number: typeof record.number === "number" ? record.number : fallbackPage,
    size: typeof record.size === "number" ? record.size : fallbackSize,
    totalElements: typeof record.totalElements === "number" ? record.totalElements : null,
    totalPages: typeof record.totalPages === "number" ? record.totalPages : null,
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

async function feedbackRequest(method: "GET" | "DELETE", endpoint: string) {
  const response = await portalFetch(endpoint, {
    method,
    headers: { Accept: "application/json" },
  });
  const raw = await response.text();
  let parsed: unknown;
  let responseBody: string;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
      responseBody = JSON.stringify(parsed, null, 2);
    } catch {
      responseBody = raw;
    }
  } else if (response.status === 204) {
    responseBody = "204 No Content";
  } else if (response.ok) {
    responseBody = "Request completed with an empty response.";
  } else {
    responseBody = "No response body.";
  }
  const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined;
  const detail = record?.detail ?? record?.message ?? record?.error ?? record?.title;
  return {
    status: response.status,
    response: responseBody,
    error: response.ok
      ? ""
      : typeof detail === "string" ? `HTTP ${response.status}: ${detail}` : `Request failed with HTTP ${response.status}.`,
    parsed,
  };
}

function CopyFeedbackButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  async function copy() {
    setCopied(false);
    setError("");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Unable to copy value.");
    }
  }

  return (
    <span className="feedback-copy-wrap">
      <button type="button" className="feedback-icon-button" aria-label={label} title={label} onClick={() => void copy()}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {copied && <span className="feedback-copy-status" role="status">Copied</span>}
      {error && <span className="feedback-copy-error" role="status">{error}</span>}
    </span>
  );
}

function FeedbackInspector({ state }: { state: InspectorState }) {
  return (
    <section className="feedback-panel feedback-inspector">
      <div className="feedback-panel-heading">
        <div><h2>API Inspector</h2><p>Latest Feedback API request and actual response.</p></div>
        {state.loading && <LoaderCircle size={17} className="feedback-spin" aria-label="Request loading" />}
      </div>
      <div className="feedback-inspector-endpoint">
        <span className={`feedback-method ${state.method.toLowerCase()}`}>{state.method}</span>
        <code>{state.endpoint}</code>
      </div>
      {state.status !== null && <div className={`feedback-http-status ${state.error ? "error" : "success"}`}>HTTP {state.status}</div>}
      {state.error && <div className="feedback-error"><AlertCircle size={16} />{state.error}</div>}
      {state.response && <pre className="feedback-response">{state.response}</pre>}
      {!state.loading && state.status === null && !state.error && !state.response && <p className="feedback-inspector-empty">No request made yet.</p>}
    </section>
  );
}

function FeedbackTable({
  rows, loading, onSelect, onDelete,
}: {
  rows: FeedbackDetailsDto[];
  loading: boolean;
  onSelect: (item: FeedbackDetailsDto) => void;
  onDelete: (item: FeedbackDetailsDto) => void;
}) {
  if (loading) {
    return <div className="feedback-loading"><LoaderCircle size={20} className="feedback-spin" />Loading feedback…</div>;
  }
  if (!rows.length) {
    return <div className="feedback-empty"><strong>No feedback found</strong><p>Feedback records returned by the API will appear here.</p></div>;
  }
  return (
    <div className="feedback-table-wrap">
      <table className="feedback-table">
        <thead><tr><th>ID</th><th>Feedback</th><th>User</th><th>Submitted</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td><button className="feedback-link" onClick={() => onSelect(item)}>#{item.id}</button></td>
              <td><button className="feedback-content-link" onClick={() => onSelect(item)}>{item.feedback}</button></td>
              <td>
                <strong>{item.name}</strong>
                <span>{item.email}</span>
                <span className="feedback-user-id">ID: {item.userId}</span>
              </td>
              <td>{formatDate(item.createdAt)}</td>
              <td>
                <div className="feedback-row-actions">
                  <button className="feedback-secondary" onClick={() => onSelect(item)}>Details</button>
                  <button className="feedback-delete-button" aria-label={`Delete feedback ${item.id}`} title="Delete feedback" onClick={() => onDelete(item)}><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="feedback-mobile-list">
        {rows.map((item) => (
          <article className="feedback-mobile-card" key={item.id}>
            <div className="feedback-mobile-card-head"><button className="feedback-link" onClick={() => onSelect(item)}>Feedback #{item.id}</button><button className="feedback-delete-button" aria-label={`Delete feedback ${item.id}`} onClick={() => onDelete(item)}><Trash2 size={15} /></button></div>
            <p>{item.feedback}</p><strong>{item.name}</strong><span>{item.email}</span><small>{formatDate(item.createdAt)}</small>
            <button className="feedback-secondary" onClick={() => onSelect(item)}>View details</button>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function DeveloperFeedbackManagement() {
  const [section, setSection] = useState<"all" | "user">("all");
  const [allPage, setAllPage] = useState<FeedbackPage>(EMPTY_PAGE);
  const [userPage, setUserPage] = useState<FeedbackPage>(EMPTY_PAGE);
  const [pageSize, setPageSize] = useState(20);
  const [userIdInput, setUserIdInput] = useState("");
  const [searchedUserId, setSearchedUserId] = useState("");
  const [validation, setValidation] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<FeedbackDetailsDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [inspector, setInspector] = useState<InspectorState>(INITIAL_INSPECTOR);
  const [deleteBusy, setDeleteBusy] = useState<number | null>(null);
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const allPageRef = useRef(allPage);
  const userPageRef = useRef(userPage);
  const pageSizeRef = useRef(pageSize);
  const searchedUserRef = useRef(searchedUserId);

  allPageRef.current = allPage;
  userPageRef.current = userPage;
  pageSizeRef.current = pageSize;
  searchedUserRef.current = searchedUserId;

  async function loadList(target: "all" | "user", page: number, size: number, requestedUserId = searchedUserRef.current) {
    if (target === "user" && !requestedUserId.trim()) return;
    const requestId = ++listRequestId.current;
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    const endpoint = target === "all"
      ? `/api/v1/portal/dev/feedback?${params.toString()}`
      : `/api/v1/portal/dev/feedback/user/${encodeURIComponent(requestedUserId)}?${params.toString()}`;
    setListLoading(true);
    setInspector({ method: "GET", endpoint, status: null, response: "", error: "", loading: true });

    try {
      const result = await feedbackRequest("GET", endpoint);
      if (requestId !== listRequestId.current) return;
      setInspector({ method: "GET", endpoint, status: result.status, response: result.response, error: result.error, loading: false });
      if (result.error) {
        if (target === "all") setAllPage({ ...EMPTY_PAGE, number: page, size });
        else setUserPage({ ...EMPTY_PAGE, number: page, size });
      } else {
        try {
          const parsed = readPage(result.parsed, page, size);
          if (target === "all") setAllPage(parsed);
          else setUserPage(parsed);
        } catch (parseError) {
          if (target === "all") setAllPage({ ...EMPTY_PAGE, number: page, size });
          else setUserPage({ ...EMPTY_PAGE, number: page, size });
          setInspector((current) => ({ ...current, error: parseError instanceof Error ? parseError.message : "Invalid paginated response." }));
        }
      }
    } catch (requestError) {
      if (requestId !== listRequestId.current) return;
      const message = requestError instanceof Error ? requestError.message : "Unable to load feedback.";
      setInspector({ method: "GET", endpoint, status: null, response: "", error: message, loading: false });
      if (target === "all") setAllPage({ ...EMPTY_PAGE, number: page, size });
      else setUserPage({ ...EMPTY_PAGE, number: page, size });
    } finally {
      if (requestId === listRequestId.current) setListLoading(false);
    }
  }

  useEffect(() => {
    void loadList("all", 0, pageSize);
    // Load the initial page once when the module opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeSection(next: "all" | "user") {
    setSection(next);
    setDetailId(null);
    setDetail(null);
    setDetailError("");
    if (next === "all") {
      setUserIdInput("");
      setSearchedUserId("");
      setValidation("");
      void loadList("all", allPageRef.current.number, pageSizeRef.current);
    }
  }

  function searchUser() {
    if (!userIdInput.trim()) {
      setValidation("User ID cannot be blank.");
      return;
    }
    setValidation("");
    const userId = userIdInput.trim();
    setSearchedUserId(userId);
    void loadList("user", 0, pageSize, userId);
  }

  function clearUserSearch() {
    listRequestId.current += 1;
    setUserIdInput("");
    setSearchedUserId("");
    setUserPage(EMPTY_PAGE);
    setValidation("");
    setListLoading(false);
    setInspector(INITIAL_INSPECTOR);
  }

  async function selectFeedback(item: FeedbackDetailsDto) {
    const requestId = ++detailRequestId.current;
    const endpoint = `/api/v1/portal/dev/feedback/${item.id}`;
    setDetailId(item.id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    setInspector({ method: "GET", endpoint, status: null, response: "", error: "", loading: true });
    try {
      const result = await feedbackRequest("GET", endpoint);
      if (requestId !== detailRequestId.current) return;
      setInspector({ method: "GET", endpoint, status: result.status, response: result.response, error: result.error, loading: false });
      if (result.error) setDetailError(result.error);
      else if (isFeedback(result.parsed)) setDetail(result.parsed);
      else setDetailError("The feedback details response did not match the expected DTO.");
    } catch (requestError) {
      if (requestId !== detailRequestId.current) return;
      const message = requestError instanceof Error ? requestError.message : "Unable to load feedback details.";
      setDetailError(message);
      setInspector({ method: "GET", endpoint, status: null, response: "", error: message, loading: false });
    } finally {
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  }

  async function deleteFeedback(item: FeedbackDetailsDto) {
    if (!window.confirm(`Permanently delete feedback #${item.id}? This action cannot be undone.`)) return;
    if (deleteBusy !== null) return;
    const endpoint = `/api/v1/portal/dev/feedback/${item.id}`;
    setDeleteBusy(item.id);
    setInspector({ method: "DELETE", endpoint, status: null, response: "", error: "", loading: true });
    try {
      const result = await feedbackRequest("DELETE", endpoint);
      setInspector({ method: "DELETE", endpoint, status: result.status, response: result.response, error: result.error, loading: false });
      if (result.error) return;

      if (detail?.id === item.id) {
        setDetailId(null);
        setDetail(null);
        setDetailError("");
      }
      const currentList = section === "all" ? allPageRef.current : userPageRef.current;
      const nextRows = currentList.content.filter((feedback) => feedback.id !== item.id);
      if (!nextRows.length && currentList.number > 0) {
        const targetPage = currentList.number - 1;
        if (section === "all") {
          await loadList("all", targetPage, pageSizeRef.current);
        } else if (searchedUserRef.current) {
          await loadList("user", targetPage, pageSizeRef.current);
        }
      } else {
        const nextPage = { ...currentList, content: nextRows, totalElements: currentList.totalElements === null ? null : Math.max(0, currentList.totalElements - 1) };
        if (section === "all") setAllPage(nextPage);
        else setUserPage(nextPage);
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to delete feedback.";
      setInspector({ method: "DELETE", endpoint, status: null, response: "", error: message, loading: false });
    } finally {
      setDeleteBusy(null);
    }
  }

  async function refreshCurrent() {
    if (section === "all") {
      await loadList("all", allPageRef.current.number, pageSize);
    } else if (searchedUserId) {
      await loadList("user", userPageRef.current.number, pageSize, searchedUserId);
    }
  }

  async function setSizeAndLoad(value: number) {
    setPageSize(value);
    if (section === "all") await loadList("all", 0, value);
    else if (searchedUserId) await loadList("user", 0, value, searchedUserId);
  }

  const activePage = section === "all" ? allPage : userPage;
  const hasUserResults = section !== "user" || Boolean(searchedUserId);

  function paginate(direction: -1 | 1) {
    const nextPage = activePage.number + direction;
    if (nextPage < 0 || (activePage.totalPages !== null && nextPage >= activePage.totalPages)) return;
    if (section === "all") void loadList("all", nextPage, pageSize);
    else if (searchedUserId) void loadList("user", nextPage, pageSize, searchedUserId);
  }

  return (
    <div className="dev-content feedback-management">
      <div className="dev-page-heading">
        <div><div className="dev-overline">USER SUPPORT</div><h1>Feedback Management</h1><p>Browse, inspect, and manage feedback submitted through the application.</p></div>
      </div>
      <div className="feedback-section-tabs" role="tablist" aria-label="Feedback sections">
        <button className={section === "all" ? "active" : ""} onClick={() => changeSection("all")}>All Feedback</button>
        <button className={section === "user" ? "active" : ""} onClick={() => changeSection("user")}><UserRoundSearch size={15} /> User Feedback Lookup</button>
      </div>

      {section === "user" && (
        <section className="feedback-panel feedback-user-search">
          <label className="feedback-search-field">User ID
            <input value={userIdInput} onChange={(event) => { setUserIdInput(event.target.value); setValidation(""); }} onKeyDown={(event) => { if (event.key === "Enter") searchUser(); }} placeholder="Enter a user ID" />
            <span className={validation ? "feedback-help invalid" : "feedback-help"}>{validation || "Required. Enter the exact user ID to retrieve associated feedback."}</span>
          </label>
          <div className="feedback-search-actions">
            <button className="feedback-primary" onClick={searchUser}><Search size={15} />Search user feedback</button>
            <button className="feedback-secondary" onClick={clearUserSearch}><X size={15} />Clear</button>
          </div>
        </section>
      )}

      <div className="feedback-workspace-grid">
        <section className="feedback-panel feedback-list-panel">
          <div className="feedback-list-toolbar">
            <div><h2>{section === "all" ? "All Feedback" : searchedUserId ? `Feedback from ${searchedUserId}` : "User Feedback"}</h2><p>{activePage.totalElements !== null ? `${activePage.totalElements} total records` : "Paginated records from the Feedback API."}</p></div>
            <div className="feedback-list-controls">
              <select aria-label="Page size" value={pageSize} onChange={(event) => void setSizeAndLoad(Number(event.target.value))}>
                {[20, 50, 100].map((size) => <option key={size} value={size}>{size} per page</option>)}
              </select>
              <button className="feedback-secondary" disabled={listLoading || !hasUserResults} onClick={() => void refreshCurrent()}><RefreshCw size={14} />Refresh</button>
            </div>
          </div>
          {hasUserResults ? (
            <>
              <FeedbackTable rows={activePage.content} loading={listLoading} onSelect={(item) => void selectFeedback(item)} onDelete={(item) => void deleteFeedback(item)} />
              <div className="feedback-pagination">
                <span>Page {activePage.number + 1}{activePage.totalPages !== null ? ` of ${Math.max(activePage.totalPages, 1)}` : ""}</span>
                <div>
                  <button className="feedback-secondary" disabled={listLoading || activePage.number <= 0} onClick={() => paginate(-1)}><ChevronLeft size={15} />Previous</button>
                  <button className="feedback-secondary" disabled={listLoading || (activePage.totalPages !== null ? activePage.number >= activePage.totalPages - 1 : activePage.content.length < pageSize)} onClick={() => paginate(1)}>Next<ChevronRight size={15} /></button>
                </div>
              </div>
            </>
          ) : <div className="feedback-empty"><strong>Search for a user</strong><p>Enter a user ID above to retrieve feedback.</p></div>}
        </section>

        <aside className="feedback-side-column">
          {detailId !== null && (
            <section className="feedback-panel feedback-detail-panel">
              <div className="feedback-panel-heading"><div><h2>Feedback details</h2><p>Full record loaded from the details endpoint.</p></div><button className="feedback-icon-button" aria-label="Close feedback details" onClick={() => { detailRequestId.current += 1; setDetailId(null); setDetail(null); setDetailError(""); }}><X size={16} /></button></div>
              {detailLoading ? <div className="feedback-loading compact"><LoaderCircle size={18} className="feedback-spin" />Loading feedback details…</div> : detail ? (
                <>
                  <p className="feedback-detail-text">{detail.feedback}</p>
                  <dl className="feedback-detail-fields">
                    <div><dt>Feedback ID</dt><dd>{detail.id}<CopyFeedbackButton value={String(detail.id)} label="Copy feedback ID" /></dd></div>
                    <div><dt>Name</dt><dd>{detail.name}</dd></div>
                    <div><dt>Email</dt><dd>{detail.email}<CopyFeedbackButton value={detail.email} label="Copy email" /></dd></div>
                    <div><dt>User ID</dt><dd>{detail.userId}<CopyFeedbackButton value={detail.userId} label="Copy user ID" /></dd></div>
                    <div><dt>Submitted</dt><dd>{formatDate(detail.createdAt)}</dd></div>
                  </dl>
                  <div className="feedback-detail-actions">
                    <CopyFeedbackButton value={detail.feedback} label="Copy feedback text" />
                    <button className="feedback-delete-button" disabled={deleteBusy === detail.id} onClick={() => void deleteFeedback(detail)}>{deleteBusy === detail.id ? <LoaderCircle size={15} className="feedback-spin" /> : <Trash2 size={15} />}Delete feedback</button>
                  </div>
                </>
              ) : detailError ? <div className="feedback-error"><AlertCircle size={16} />{detailError}</div> : null}
            </section>
          )}
          <FeedbackInspector state={inspector} />
        </aside>
      </div>
      {deleteBusy !== null && <div className="feedback-delete-progress"><LoaderCircle size={15} className="feedback-spin" />Deleting feedback #{deleteBusy}…</div>}
    </div>
  );
}
