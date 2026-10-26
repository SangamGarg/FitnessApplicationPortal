import { useEffect, useState } from "react";
import AdminDashboard from "./features/admin/AdminDashboard";
import { portalLogout, portalFetch, refreshPortalAccessToken } from "./lib/portalApi";
import PortalAuthPage from "./pages/PortalAuthPage";
import DeveloperDashboard from "./pages/DeveloperDashboard";
import { LogOut } from "lucide-react";
import "./portalLogout.css";

type PortalRole = "ADMIN" | "DEVELOPER";
type PortalIdentity = { email?: string; role?: string };

export default function App() {
  const setupLink = new URLSearchParams(window.location.search).has("token");
  const [authenticated, setAuthenticated] = useState(
    () => !setupLink && Boolean(sessionStorage.getItem("portalToken")),
  );
  const [checkingSession, setCheckingSession] = useState(() => !setupLink);
  const [selectedRole, setSelectedRole] = useState<PortalRole>(() =>
    sessionStorage.getItem("portalRole") === "DEVELOPER" ? "DEVELOPER" : "ADMIN",
  );

  useEffect(() => {
    const savedToken = sessionStorage.getItem("portalToken");
    if (setupLink) return;

    let active = true;
    const bootstrap = savedToken
      ? portalFetch("/api/portal/auth/me", { headers: { Accept: "application/json" } })
      : refreshPortalAccessToken().then((newToken) =>
          newToken
            ? portalFetch("/api/portal/auth/me", { headers: { Accept: "application/json" } })
            : new Response(JSON.stringify({ message: "No active session" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
              }),
        );

    bootstrap
      .then(async (response) => {
        if (!response.ok) throw new Error("Portal session is invalid or expired.");
        return (await response.json()) as PortalIdentity;
      })
      .then((identity) => {
        if (!active) return;
        if (identity.role !== "ADMIN" && identity.role !== "DEVELOPER") {
          throw new Error("The server returned an unsupported portal role.");
        }
        sessionStorage.setItem("portalRole", identity.role);
        if (identity.email) sessionStorage.setItem("portalEmail", identity.email);
        setSelectedRole(identity.role);
        setAuthenticated(true);
      })
      .catch(() => {
        if (!active) return;
        sessionStorage.removeItem("portalToken");
        sessionStorage.removeItem("portalRole");
        sessionStorage.removeItem("portalEmail");
        sessionStorage.removeItem("portalName");
        setAuthenticated(false);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [setupLink]);

  if (checkingSession) {
    return (
      <main className="portal-session-check">
        Verifying portal session…
      </main>
    );
  }

  if (!authenticated) {
    return (
      <PortalAuthPage
        onAuthenticated={(role) => {
          setSelectedRole(role);
          setAuthenticated(true);
        }}
      />
    );
  }

  if (selectedRole === "DEVELOPER") {
    return (
      <>
        <button
          className="portal-dev-logout"
          onClick={() => {
            void portalLogout().finally(() => {
              window.location.href = "/";
            });
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
        <DeveloperDashboard />
      </>
    );
  }

  return <AdminDashboard />;
}
