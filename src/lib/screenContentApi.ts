import { portalFetch } from "./portalApi";

export const APP_SCREEN_CONTENT_ENDPOINT = "/api/v1/portal/dev/screen-content";

export interface AppScreenContentUpsertRequestDto {
  screenKey: string;
  title: string;
  subTitle: string | null;
  description: string | null;
  active: boolean | null;
}

export interface AppScreenContentStatusRequestDto { active: boolean }

export interface AppScreenContentResponseDto {
  id: number;
  screenKey: string;
  title: string;
  subTitle: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export class ScreenContentApiError extends Error {
  readonly status: number | null;
  readonly responseBody: unknown;
  constructor(message: string, status: number | null, responseBody: unknown) {
    super(message);
    this.name = "ScreenContentApiError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

export type ScreenContentResult<T> = { data: T; status: number };

async function request<T>(path: string, init: RequestInit = {}): Promise<ScreenContentResult<T>> {
  let response: Response;
  try {
    response = await portalFetch(path, { headers: { Accept: "application/json", ...Object.fromEntries(new Headers(init.headers)) }, ...init });
  } catch (error) {
    throw new ScreenContentApiError(error instanceof Error ? error.message : "Could not reach the screen content service.", null, null);
  }
  const raw = await response.text();
  let body: unknown = null;
  if (raw) { try { body = JSON.parse(raw) as unknown; } catch { body = raw; } }
  if (!response.ok) {
    const fields = body && typeof body === "object" ? body as Record<string, unknown> : null;
    const message = [fields?.message, fields?.detail, fields?.error].find((value): value is string => typeof value === "string");
    const fallback = response.status === 403 ? "Your account does not have permission to manage screen content."
      : response.status === 404 ? "This screen content record could not be found. It may have been removed."
      : response.status === 409 ? "A screen content record already uses this Screen Key."
      : response.status >= 500 ? "The screen content service is temporarily unavailable. Try again shortly."
      : `The request failed with HTTP ${response.status}.`;
    throw new ScreenContentApiError(message ?? fallback, response.status, body);
  }
  return { data: body as T, status: response.status };
}

export const screenContentApi = {
  getAll: () => request<AppScreenContentResponseDto[]>(APP_SCREEN_CONTENT_ENDPOINT),
  getById: (id: number) => request<AppScreenContentResponseDto>(`${APP_SCREEN_CONTENT_ENDPOINT}/${id}`),
  create: (dto: AppScreenContentUpsertRequestDto) => request<AppScreenContentResponseDto>(APP_SCREEN_CONTENT_ENDPOINT, { method: "POST", body: JSON.stringify(dto) }),
  update: (id: number, dto: AppScreenContentUpsertRequestDto) => request<AppScreenContentResponseDto>(`${APP_SCREEN_CONTENT_ENDPOINT}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  delete: (id: number) => request<void>(`${APP_SCREEN_CONTENT_ENDPOINT}/${id}`, { method: "DELETE" }),
  updateStatus: (id: number, dto: AppScreenContentStatusRequestDto) => request<AppScreenContentResponseDto>(`${APP_SCREEN_CONTENT_ENDPOINT}/${id}/status`, { method: "PATCH", body: JSON.stringify(dto) }),
};
