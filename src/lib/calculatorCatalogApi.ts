import { portalFetch } from "./portalApi";

export const ANALYTICS_BASE_ENDPOINT = "/api/v1/portal/dev/analytics";
export const CALCULATOR_CATALOG_ENDPOINT = `${ANALYTICS_BASE_ENDPOINT}/catalog`;

export interface CalculatorCatalogItemResponseDto {
  key: string;
  name: string;
  category: string;
  description: string;
  requiredInputs: string[];
  unit: string;
  requiresSavedData: boolean | null;
  popular: boolean;
  displayOrder: number | null;
}

export interface CalculatorCatalogRequestDto {
  key: string;
  name: string;
  category: string;
  description: string;
  requiredInputs: string[];
  unit: string;
  requiresSavedData: boolean | null;
  popular: boolean;
  displayOrder: number | null;
}

export interface CalculatorCatalogResponseDto {
  status: string;
  statusCode: number;
  message: string;
  timestamp: string;
}

export interface CatalogApiActivity {
  id: number;
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

export function isCatalogItem(value: unknown): value is CalculatorCatalogItemResponseDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.key === "string" && typeof item.name === "string"
    && typeof item.category === "string" && typeof item.description === "string"
    && Array.isArray(item.requiredInputs) && item.requiredInputs.every((input) => typeof input === "string")
    && typeof item.unit === "string" && (typeof item.requiresSavedData === "boolean" || item.requiresSavedData === null)
    && typeof item.popular === "boolean" && (typeof item.displayOrder === "number" || item.displayOrder === null);
}

export async function requestCatalogApi(method: string, endpoint: string, payload?: unknown) {
  const started = performance.now();
  const timestamp = new Date().toISOString();
  let response: Response | null = null;
  let body: unknown = null;
  let error: string | undefined;
  try {
    response = await portalFetch(endpoint, {
      method,
      headers: { Accept: "application/json" },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });
    const raw = await response.text();
    if (raw) {
      try { body = JSON.parse(raw) as unknown; }
      catch { body = raw; }
    }
    if (!response.ok) {
      const candidate = body && typeof body === "object" ? body as Record<string, unknown> : null;
      const message = candidate && [candidate.message, candidate.detail, candidate.error].find((value) => typeof value === "string");
      error = `HTTP ${response.status}: ${message ?? response.statusText ?? "Request failed"}`;
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "The request failed before a response was received.";
  }
  const activity: CatalogApiActivity = {
    id: Date.now() + Math.random(), method, endpoint, timestamp,
    durationMs: Math.round(performance.now() - started), status: response?.status ?? null,
    ok: Boolean(response?.ok), request: payload ?? null, response: body, ...(error ? { error } : {}),
  };
  return { activity, data: body, status: response?.status ?? null, ok: Boolean(response?.ok), error };
}
