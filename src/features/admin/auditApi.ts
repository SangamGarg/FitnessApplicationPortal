import { portalFetch } from "../../lib/portalApi";

const AUDIT_EVENTS_ENDPOINT = "/api/v1/portal/admin/audit/events";

export interface AuditEvent {
  id: number | string;
  actorEmail: string | null;
  action: string | null;
  resourceType: string | null;
  resourceId: string | null;
  details: string | null;
  createdAt: string | null;
}

export interface AuditPage {
  content: AuditEvent[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
}

export interface AuditFilters {
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  from: string;
  to: string;
}

export interface AuditQuery {
  filters: AuditFilters;
  page: number;
  size: number;
  sort: string;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePage(body: Record<string, unknown>, query: AuditQuery): AuditPage {
  const content = body.content as AuditEvent[];
  const size = finiteNumber(body.size, query.size);
  const number = finiteNumber(body.number, query.page);
  const totalElements = Math.max(0, finiteNumber(body.totalElements, content.length));
  // Derive pagination from the total count and returned page size. Some API
  // responses have stale `totalPages`/`last` metadata while still reporting all
  // records in `totalElements`, which can hide the final page in the UI.
  const totalPages = Math.ceil(totalElements / Math.max(size, 1));
  const numberOfElements = finiteNumber(body.numberOfElements, content.length);
  return {
    content,
    totalElements,
    totalPages,
    size,
    number,
    numberOfElements,
    first: number === 0,
    last: totalPages === 0 || number >= totalPages - 1,
    empty: typeof body.empty === "boolean" ? body.empty : content.length === 0,
  };
}

function friendlyError(status: number, body: unknown): string {
  if (status === 401) return "Your portal session has expired. Sign in again to view audit events.";
  if (status === 403) return "Your account does not have permission to view audit events.";
  if (status === 404) return "The audit events endpoint is unavailable.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status >= 500) return "The audit service is temporarily unavailable. Try again shortly.";
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
    return body.message;
  }
  return `Could not retrieve audit events (HTTP ${status}).`;
}

export async function getAuditEvents(query: AuditQuery, signal?: AbortSignal): Promise<AuditPage> {
  const parameters = new URLSearchParams();
  Object.entries(query.filters).forEach(([key, value]) => {
    const trimmed = value.trim();
    if (trimmed) parameters.set(key, trimmed);
  });
  parameters.set("page", String(Math.max(0, Math.floor(query.page))));
  parameters.set("size", String(Math.max(1, Math.min(100, Math.floor(query.size)))));
  parameters.set("sort", query.sort);

  let response: Response;
  try {
    response = await portalFetch(`${AUDIT_EVENTS_ENDPOINT}?${parameters.toString()}`, {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Could not reach the audit service. Check your connection and try again.", { cause: error });
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(friendlyError(response.status, body));
  if (!body || typeof body !== "object" || !Array.isArray((body as AuditPage).content)) {
    throw new Error("The audit service returned an unexpected response.");
  }
  return normalizePage(body as Record<string, unknown>, query);
}
