import { portalFetch } from "./portalApi";

export type NotificationOutboxStatus = "PENDING" | "PROCESSING" | "RETRY_WAIT" | "SENT" | "NO_DEVICES" | "FAILED";
export interface AppUserForNotification { name: string; email: string }
export interface FcmNotificationRequest { title: string; body: string; imageUrl?: string; data?: Record<string, string> }
export interface BulkFcmNotificationRequest { email: string[]; notification: FcmNotificationRequest }
export interface FcmDeliveryResult { targetedDevices: number; attemptedDevices: number; successCount: number; failureCount: number; removedInvalidTokenCount: number }
export interface PortalNotificationAnalytics { total: number; pending: number; processing: number; retryWait: number; sent: number; noDevices: number; failed: number; deliveryRatePercent: number }
export interface PortalNotificationHistory { notificationId: string; recipientEmail: string; title: string; body: string; deliveryStatus: NotificationOutboxStatus; attemptCount: number; lastError: string | null; createdAt: string; updatedAt: string; readAt: string | null }
export interface NotificationHistoryPage { content: PortalNotificationHistory[]; number?: number; size?: number; totalElements?: number; totalPages?: number; first?: boolean; last?: boolean; empty?: boolean }
export interface NotificationHistoryQueryParams { page: number; size: number; status?: NotificationOutboxStatus }

export class NotificationApiError extends Error {
  status: number | null;
  responseBody: unknown;
  constructor(message: string, status: number | null = null, responseBody?: unknown) { super(message); this.name = "NotificationApiError"; this.status = status; this.responseBody = responseBody; }
}

export let lastNotificationHttpStatus: number | null = null;
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await portalFetch(path, init); }
  catch (error) { throw new NotificationApiError(error instanceof Error ? error.message : "Network request failed."); }
  lastNotificationHttpStatus = response.status;
  const text = await response.text();
  let body: unknown = null;
  if (text) { try { body = JSON.parse(text); } catch { body = text; } }
  if (!response.ok) {
    const detail = typeof body === "object" && body !== null ? (body as Record<string, unknown>).message ?? (body as Record<string, unknown>).detail : body;
    throw new NotificationApiError(typeof detail === "string" ? detail : `Request failed with HTTP ${response.status}.`, response.status, body);
  }
  return body as T;
}

const BASE = "/api/v1/portal/dev/notification";
export const notificationApi = {
  getUsers: () => request<AppUserForNotification[]>(`${BASE}/users`),
  sendToUser: (userEmail: string, notification: FcmNotificationRequest) => request<FcmDeliveryResult>(`${BASE}/user/send?${new URLSearchParams({ userEmail })}`, { method: "POST", body: JSON.stringify(notification) }),
  sendToUsers: (payload: BulkFcmNotificationRequest) => request<FcmDeliveryResult>(`${BASE}/users/bulk`, { method: "POST", body: JSON.stringify(payload) }),
  getAnalytics: () => request<PortalNotificationAnalytics>(`${BASE}/history/analytics`),
  getHistory: (params: NotificationHistoryQueryParams) => {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
    if (params.status) query.set("status", params.status);
    return request<NotificationHistoryPage>(`${BASE}/history?${query}`);
  },
};
