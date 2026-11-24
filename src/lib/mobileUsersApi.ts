import { portalFetch } from "./portalApi";

export type MobileAccountStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export interface MobileUserAdminResponseDto {
  id: string;
  email: string;
  name: string;
  gender: string | null;
  age: number | null;
  profileImageUrl: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  goal: string | null;
  status: MobileAccountStatus;
}

export interface MobileUsersPage {
  content: MobileUserAdminResponseDto[];
  totalElements: number | null;
  totalPages: number | null;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
}

export interface MobileUsersQuery {
  query: string;
  status: MobileAccountStatus | "";
  page: number;
  size: number;
}

export interface MobileUsersDiagnostic {
  endpoint: string;
  method: "GET" | "PATCH";
  requestParameters?: Record<string, string | number>;
  requestPayload?: unknown;
  requestedAt: string;
  respondedAt?: string;
  durationMs: number;
  httpStatus?: number;
  success: boolean;
  responsePayload?: unknown;
  error?: string;
}

export interface MobileUsersResult<T> {
  data: T;
  diagnostic: MobileUsersDiagnostic;
}

export class MobileUsersApiError extends Error {
  diagnostic: MobileUsersDiagnostic;
  aborted: boolean;

  constructor(message: string, diagnostic: MobileUsersDiagnostic, aborted = false) {
    super(message);
    this.name = "MobileUsersApiError";
    this.diagnostic = diagnostic;
    this.aborted = aborted;
  }
}

const BASE = "/api/v1/portal/admin/mobile-users";

function sanitizePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitizePayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/(token|authorization|password|secret|stack|trace|credential|header|profileImageUrl)/i.test(key))
      .map(([key, item]) => [key, sanitizePayload(item)]));
  }
  if (typeof value === "string" && /(exception|stack trace|\bat\s+[\w.$]+\()/i.test(value)) return "[redacted]";
  if (typeof value === "string" && value.length > 1000) return `${value.slice(0, 1000)}…`;
  return value;
}

function friendlyError(body: unknown, status: number): string {
  if (status === 401) return "Your portal session expired. Sign in again.";
  if (status === 403) return "Admin permission is required for this action.";
  if (status === 404) return "The requested mobile user could not be found.";
  const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const candidate = record?.detail ?? record?.message;
  if (typeof candidate === "string" && candidate.trim() && candidate.length <= 240 && !/(exception|stack trace|\bat\s+[\w.$]+\()/i.test(candidate)) return candidate.trim();
  if (status >= 500) return "The mobile user service is temporarily unavailable. Try again shortly.";
  return `The request could not be completed (HTTP ${status}). Review the inputs and try again.`;
}

async function request<T>(
  endpoint: string,
  method: "GET" | "PATCH",
  options: { signal?: AbortSignal; parameters?: Record<string, string | number>; payload?: unknown } = {},
): Promise<MobileUsersResult<T>> {
  const requestedAt = new Date().toISOString();
  const started = performance.now();
  const requestController = new AbortController();
  const callerAbort = () => requestController.abort();
  options.signal?.addEventListener("abort", callerAbort, { once: true });
  let timedOut = false;
  const timeoutId = window.setTimeout(() => { timedOut = true; requestController.abort(); }, 20_000);
  const diagnosticBase = {
    endpoint,
    method,
    ...(options.parameters ? { requestParameters: options.parameters } : {}),
    ...(options.payload !== undefined ? { requestPayload: options.payload } : {}),
    requestedAt,
  } as const;

  try {
    const response = await portalFetch(endpoint, {
      method,
      signal: requestController.signal,
      headers: { Accept: "application/json", ...(options.payload !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(options.payload !== undefined ? { body: JSON.stringify(options.payload) } : {}),
    });
    const body = response.status === 204 ? null : await response.json().catch(() => null) as unknown;
    const diagnostic: MobileUsersDiagnostic = {
      ...diagnosticBase,
      respondedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started),
      httpStatus: response.status,
      success: response.ok,
      ...(body !== null ? { responsePayload: sanitizePayload(body) } : {}),
      ...(!response.ok ? { error: friendlyError(body, response.status) } : {}),
    };
    if (!response.ok) throw new MobileUsersApiError(friendlyError(body, response.status), diagnostic);
    return { data: body as T, diagnostic };
  } catch (error) {
    if (error instanceof MobileUsersApiError) throw error;
    const aborted = options.signal?.aborted || (!timedOut && (requestController.signal.aborted || (error instanceof DOMException && error.name === "AbortError")));
    const message = timedOut ? "The mobile user request timed out. Try again." : aborted ? "Request cancelled." : "Could not reach the mobile user service. Check your connection and try again.";
    const diagnostic: MobileUsersDiagnostic = {
      ...diagnosticBase,
      durationMs: Math.round(performance.now() - started),
      success: false,
      error: message,
    };
    throw new MobileUsersApiError(message, diagnostic, Boolean(aborted));
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", callerAbort);
  }
}

export function listMobileUsers(query: MobileUsersQuery, signal?: AbortSignal) {
  const parameters = {
    ...(query.query.trim() ? { query: query.query.trim() } : {}),
    ...(query.status ? { status: query.status } : {}),
    page: Math.max(0, Math.floor(query.page)),
    size: Math.max(1, Math.min(100, Math.floor(query.size))),
  };
  const search = new URLSearchParams(Object.entries(parameters).map(([key, value]) => [key, String(value)]));
  return request<unknown>(`${BASE}?${search.toString()}`, "GET", { signal, parameters });
}

export function getMobileUser(id: string, signal?: AbortSignal) {
  return request<unknown>(`${BASE}/${encodeURIComponent(id.trim())}`, "GET", { signal });
}

export function updateMobileUserStatus(id: string, status: MobileAccountStatus, signal?: AbortSignal) {
  return request<unknown>(`${BASE}/${encodeURIComponent(id.trim())}/status`, "PATCH", { signal, payload: { status } });
}
