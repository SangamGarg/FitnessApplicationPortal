export type PortalRole = "ADMIN" | "DEVELOPER";

type PortalSession = {
  accessToken: string;
  expiresIn?: number;
  role?: PortalRole;
  roleId?: number;
  name?: string;
  email?: string;
};

function clearPortalSession() {
  sessionStorage.removeItem("portalToken");
  sessionStorage.removeItem("portalRole");
  sessionStorage.removeItem("portalEmail");
  sessionStorage.removeItem("portalName");
}

function saveSession(session: PortalSession) {
  if (!session.accessToken) throw new Error("The server did not return an access token.");
  sessionStorage.setItem("portalToken", session.accessToken);
  if (session.role) sessionStorage.setItem("portalRole", session.role);
  if (session.email) sessionStorage.setItem("portalEmail", session.email);
  if (session.name) sessionStorage.setItem("portalName", session.name);
}

let refreshInFlight: Promise<string | null> | null = null;

export async function refreshPortalAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const response = await fetch("/api/portal/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        clearPortalSession();
        return null;
      }
      const session = (await response.json()) as PortalSession;
      saveSession(session);
      return session.accessToken;
    } catch {
      // A failed refresh means the client cannot establish a fresh authenticated session.
      clearPortalSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function portalFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const perform = (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(input, { ...init, headers, credentials: "same-origin" });
  };

  let accessToken = sessionStorage.getItem("portalToken") || "";
  if (!accessToken) {
    const refreshed = await refreshPortalAccessToken();
    if (!refreshed) return new Response(JSON.stringify({ message: "Your portal session expired. Sign in again." }), { status: 401, headers: { "Content-Type": "application/json" } });
    accessToken = refreshed;
  }

  const response = await perform(accessToken);
  if (response.status !== 401) return response;

  const refreshed = await refreshPortalAccessToken();
  if (!refreshed) return response;
  return perform(refreshed);
}

export async function portalLogout(): Promise<void> {
  try {
    await fetch("/api/portal/auth/logout", { method: "POST", credentials: "same-origin" });
  } finally {
    clearPortalSession();
  }
}
