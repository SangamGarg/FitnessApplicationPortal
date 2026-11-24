import { portalFetch } from "./portalApi";

export const DEVELOPER_LOGS_ENDPOINT = "/api/v1/portal/dev/logs";

export type LogSource = "application" | "errors" | "access";

export interface LogFileResponse {
  type: string;
  fileName: string;
  lines: string[];
  returnedLines: number;
  requestedLines: number;
  available: boolean;
}

export interface TimedResponse<T> {
  data: T;
  status: number;
  durationMs: number;
  requestedAt: Date;
  endpoint: string;
}

export class LogsApiError extends Error {
  readonly status: number | null;
  readonly durationMs: number;
  readonly requestedAt: Date;
  readonly endpoint: string;

  constructor(
    message: string,
    status: number | null,
    durationMs: number,
    requestedAt: Date,
    endpoint: string,
  ) {
    super(message);
    this.status = status;
    this.durationMs = durationMs;
    this.requestedAt = requestedAt;
    this.endpoint = endpoint;
    this.name = "LogsApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseLogFileResponse(value: unknown): LogFileResponse {
  if (!isRecord(value) || !Array.isArray(value.lines) || !value.lines.every((line) => typeof line === "string")) {
    throw new Error("The server returned an invalid log response.");
  }
  return {
    type: typeof value.type === "string" ? value.type : "",
    fileName: typeof value.fileName === "string" ? value.fileName : "",
    lines: value.lines,
    returnedLines: typeof value.returnedLines === "number" ? value.returnedLines : value.lines.length,
    requestedLines: typeof value.requestedLines === "number" ? value.requestedLines : 0,
    available: value.available === true,
  };
}

async function get<T>(endpoint: string, signal?: AbortSignal): Promise<TimedResponse<T>> {
  const requestedAt = new Date();
  const started = performance.now();
  let response: Response;
  try {
    response = await portalFetch(endpoint, { method: "GET", headers: { Accept: "application/json" }, signal });
  } catch (error) {
    throw new LogsApiError(error instanceof Error ? error.message : "Network request failed.", null, performance.now() - started, requestedAt, endpoint);
  }
  const durationMs = performance.now() - started;
  if (!response.ok) {
    let message = `Request failed with HTTP ${response.status}.`;
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && typeof body.message === "string") message = body.message;
    } catch { /* Keep the HTTP status message when the body is not JSON. */ }
    throw new LogsApiError(message, response.status, durationMs, requestedAt, endpoint);
  }
  try {
    return { data: (await response.json()) as T, status: response.status, durationMs, requestedAt, endpoint };
  } catch {
    throw new LogsApiError("The server returned an invalid response.", response.status, durationMs, requestedAt, endpoint);
  }
}

export async function getAvailableLogs(signal?: AbortSignal): Promise<TimedResponse<string[]>> {
  const result = await get<unknown>(DEVELOPER_LOGS_ENDPOINT, signal);
  if (!Array.isArray(result.data) || !result.data.every((source) => typeof source === "string")) {
    throw new LogsApiError("The server returned an invalid available logs response.", result.status, result.durationMs, result.requestedAt, result.endpoint);
  }
  return { ...result, data: result.data };
}

export async function getLogs(
  source: LogSource,
  lines: number,
  requestId: string,
  signal?: AbortSignal,
): Promise<TimedResponse<LogFileResponse>> {
  const query = new URLSearchParams({ lines: String(lines) });
  if (requestId.trim()) query.set("requestId", requestId.trim());
  const endpoint = `${DEVELOPER_LOGS_ENDPOINT}/${source}?${query.toString()}`;
  const result = await get<unknown>(endpoint, signal);
  try {
    return { ...result, data: parseLogFileResponse(result.data) };
  } catch (error) {
    throw new LogsApiError(error instanceof Error ? error.message : "The server returned an invalid log response.", result.status, result.durationMs, result.requestedAt, endpoint);
  }
}
