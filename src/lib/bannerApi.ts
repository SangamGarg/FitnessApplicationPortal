import { portalFetch } from "./portalApi";

export const PORTAL_BASE_ENDPOINT = "/api/v1/portal";
export const PORTAL_DEV_BASE_ENDPOINT = `${PORTAL_BASE_ENDPOINT}/dev`;
export const PORTAL_DEV_DASHBOARD_ENDPOINT = `${PORTAL_DEV_BASE_ENDPOINT}/dashboard`;
export const BANNER_BASE_ENDPOINT = `${PORTAL_DEV_DASHBOARD_ENDPOINT}/banners`;

export type BannerActionType = "NONE" | "EXERCISE" | "WORKOUT_PLAN" | "WORKOUT" | "NUTRITION" | "RECIPE" | "GAME" | "CHALLENGE" | "WEB_URL" | "DEEPLINK";
export interface AppBannerResponseDto {
  id: number; bannerKey: string; title: string; subTitle: string | null; description: string | null;
  imageUrl: string; mobileImageUrl: string | null; actionLabel: string | null; actionType: BannerActionType;
  actionValue: string | null; displayOrder: number; dismissible: boolean; active: boolean;
  startAt: string | null; endAt: string | null; trackingEnabled: boolean;
}
export interface BannerUpsertRequestDto {
  bannerKey: string; title: string; subTitle?: string | null; description?: string | null;
  actionType: BannerActionType; actionValue?: string | null; actionLabel?: string | null;
  displayOrder: number; active: boolean; startAt?: string | null; endAt?: string | null;
  dismissible: boolean; trackingEnabled: boolean;
}
export interface BannerStatusRequestDto { active: boolean }
export interface BannerReorderRequestDto { items: { id: number; displayOrder: number }[] }

export class BannerApiError extends Error {
  readonly status: number | null;
  readonly responseBody: unknown;
  constructor(message: string, status: number | null, responseBody: unknown = null) {
    super(message); this.name = "BannerApiError"; this.status = status; this.responseBody = responseBody;
  }
}
export let lastBannerHttpStatus: number | null = null;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await portalFetch(path, init); }
  catch (error) { lastBannerHttpStatus = null; throw new BannerApiError(error instanceof Error ? error.message : "Network request failed.", null); }
  lastBannerHttpStatus = response.status;
  const text = await response.text();
  let body: unknown = null;
  if (text) { try { body = JSON.parse(text); } catch { body = text; } }
  if (!response.ok) {
    const obj = typeof body === "object" && body !== null ? body as Record<string, unknown> : null;
    const detail = obj?.message ?? obj?.detail ?? obj?.error ?? body;
    throw new BannerApiError(typeof detail === "string" ? detail : `Request failed with HTTP ${response.status}.`, response.status, body);
  }
  return body as T;
}

function multipart(requestDto: BannerUpsertRequestDto, image?: File | null, mobileImage?: File | null) {
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify(requestDto)], { type: "application/json" }));
  if (image) form.append("image", image);
  if (mobileImage) form.append("mobileImage", mobileImage);
  return form;
}

export const bannerApi = {
  getAll: () => request<AppBannerResponseDto[]>(BANNER_BASE_ENDPOINT),
  getById: (id: number) => request<AppBannerResponseDto>(`${BANNER_BASE_ENDPOINT}/${id}`),
  create: (dto: BannerUpsertRequestDto, image: File, mobileImage?: File | null) => request<AppBannerResponseDto>(BANNER_BASE_ENDPOINT, { method: "POST", body: multipart(dto, image, mobileImage) }),
  update: (id: number, dto: BannerUpsertRequestDto, image?: File | null, mobileImage?: File | null) => request<AppBannerResponseDto>(`${BANNER_BASE_ENDPOINT}/${id}`, { method: "PUT", body: multipart(dto, image, mobileImage) }),
  delete: (id: number) => request<void>(`${BANNER_BASE_ENDPOINT}/${id}`, { method: "DELETE" }),
  updateStatus: (id: number, dto: BannerStatusRequestDto) => request<AppBannerResponseDto>(`${BANNER_BASE_ENDPOINT}/${id}/status`, { method: "PATCH", body: JSON.stringify(dto) }),
  reorder: (dto: BannerReorderRequestDto) => request<void>(`${BANNER_BASE_ENDPOINT}/reorder`, { method: "PUT", body: JSON.stringify(dto) }),
};
