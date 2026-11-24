import { useEffect, useState } from "react";
import {
    Activity,
    ArrowUpRight,
    Award,
    Bell,
    Code2,
    CircleHelp,
    FileCode2,
    Settings,
    Database,
    Dumbbell,
    FileImage,
    Gamepad2,
    LayoutDashboard,
    LifeBuoy,
    Link2,
    LogOut,
    Mail,
    MessageSquareText,
    BellRing,
    Search,
    ShieldCheck,
    Utensils,
    XCircle,
} from "lucide-react";
import "./DeveloperDashboard.css";
import DeveloperFeedbackManagement from "./DeveloperFeedbackManagement";
import DeveloperFollowUsManagement from "./DeveloperFollowUsManagement";
import DeveloperEmailManagement from "./DeveloperEmailManagement";
import DeveloperNotificationManagement from "./DeveloperNotificationManagement";
import DeveloperAssetsManagement from "./DeveloperAssetsManagement";
import DeveloperBadgeManagement from "./DeveloperBadgeManagement";
import DeveloperSupportWorkspace from "./DeveloperSupportWorkspace";
import DeveloperExerciseManagement from "./DeveloperExerciseManagement";
import DeveloperNutritionManagement from "./DeveloperNutritionManagement";
import DeveloperGamificationManagement from "./DeveloperGamificationManagement";
import { portalLogout } from "../lib/portalApi";
import PlatformOverview from "./PlatformOverview";
import DeveloperLogsPage from "./DeveloperLogsPage";

type DeveloperSection =
    | "Overview"
    | "API Explorer"
    | "Logs"
    | "Settings"
    | "Exercise Management"
    | "Nutrition Management"
    | "Analytics Management"
    | "Games and Challenges Builder"
    | "Assets Management"
    | "Support Center"
    | "Feedback Management"
    | "App Follow Us"
    | "Email Management"
    | "Notification Management"
    | "Badge Management";

const navigation: {
    label: DeveloperSection;
    icon: typeof LayoutDashboard;
    displayLabel?: string;
}[] = [
        { label: "Overview", displayLabel: "Platform Overview", icon: LayoutDashboard },
                { label: "Logs", icon: FileCode2 },
        { label: "Analytics Management", icon: Activity },
        { label: "Exercise Management", icon: Dumbbell },
        { label: "Nutrition Management", icon: Utensils },
        { label: "Games and Challenges Builder", icon: Gamepad2 },
        { label: "Assets Management", icon: FileImage },
        { label: "Support Center", icon: LifeBuoy },
        { label: "Feedback Management", icon: MessageSquareText },
        { label: "App Follow Us", icon: Link2 },
        { label: "Email Management", icon: Mail },
        { label: "Notification Management", icon: BellRing },
        { label: "Badge Management", icon: Award },
    ];

const moduleDescriptions: Partial<Record<DeveloperSection, string>> = {
    "Nutrition Management": "Manage the nutrition food catalog, recipes, and AI recipe generation with live backend APIs.",
    "Analytics Management": "Calculator records can be managed through the existing API console. Configuration versioning and validation are not connected.",
    "Exercise Management": "Exercise catalog and workout plan management are available through the updated exercise APIs.",
    "Assets Management": "Manage dynamic asset catalog keys, uploaded images, metadata, and status through the assets API.",
    "Support Center": "App information, FAQ management, and support ticket operations are available through the Support API.",
};

const endpoints: { method: string; path: string; module: string; description: string; status: string; expectedResponse?: string }[] = [
    { method: "GET", path: "/api/v1/portal/dev/exercise/catalog", module: "Exercise", description: "Fetch paginated exercise catalog", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/exercise/catalog/{id}", module: "Exercise", description: "Fetch exercise details", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/exercise/catalog", module: "Exercise", description: "Create exercise", status: "Integrated frontend reference" },
    { method: "PUT", path: "/api/v1/portal/dev/exercise/catalog/{id}", module: "Exercise", description: "Update exercise", status: "Integrated frontend reference" },
    { method: "DELETE", path: "/api/v1/portal/dev/exercise/catalog/{id}", module: "Exercise", description: "Delete exercise", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/exercise/catalog/{id}/publication?published={boolean}", module: "Exercise", description: "Update exercise publication status", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/exercise/workout-plans", module: "Exercise", description: "Fetch workout plans", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/exercise/workout-plans/{id}", module: "Exercise", description: "Fetch workout plan details", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/exercise/workout-plans", module: "Exercise", description: "Create workout plan", status: "Integrated frontend reference" },
    { method: "PUT", path: "/api/v1/portal/dev/exercise/workout-plans/{id}", module: "Exercise", description: "Update workout plan", status: "Integrated frontend reference" },
    { method: "DELETE", path: "/api/v1/portal/dev/exercise/workout-plans/{id}", module: "Exercise", description: "Delete workout plan", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/exercise/workout-plans/{id}/publication?published={boolean}", module: "Exercise", description: "Update workout plan publication", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/nutrition/foods", module: "Nutrition", description: "Search and paginate foods", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/nutrition/foods", module: "Nutrition", description: "Create food", status: "Integrated frontend reference" },
    { method: "PUT", path: "/api/v1/portal/dev/nutrition/foods/{id}", module: "Nutrition", description: "Update food", status: "Integrated frontend reference" },
    { method: "DELETE", path: "/api/v1/portal/dev/nutrition/foods/{id}", module: "Nutrition", description: "Delete food", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/nutrition/recipes", module: "Nutrition", description: "Search and paginate recipes", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/nutrition/recipes/{id}", module: "Nutrition", description: "Get recipe details", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/nutrition/recipes", module: "Nutrition", description: "Create or save recipe", status: "Integrated frontend reference" },
    { method: "PUT", path: "/api/v1/portal/dev/nutrition/recipes/{id}", module: "Nutrition", description: "Update recipe", status: "Integrated frontend reference" },
    { method: "DELETE", path: "/api/v1/portal/dev/nutrition/recipes/{id}", module: "Nutrition", description: "Delete recipe", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/nutrition/recipes/generate", module: "Nutrition", description: "Generate AI recipes", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/challenge", module: "Challenges", description: "List challenges", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/challenge", module: "Challenges", description: "Create challenge", status: "Integrated frontend reference" },
    { method: "PUT", path: "/api/v1/portal/dev/challenge/{id}", module: "Challenges", description: "Replace/update challenge", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/challenge/{id}", module: "Challenges", description: "Partial update challenge", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/challenge/{id}/status", module: "Challenges", description: "Update challenge status", status: "Integrated frontend reference" },
    { method: "DELETE", path: "/api/v1/portal/dev/challenge/{id}", module: "Challenges", description: "Delete challenge", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/gamification/games", module: "Games", description: "List games", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/gamification/games", module: "Games", description: "Create game with media (multipart)", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/gamification/games/{gameType}", module: "Games", description: "Patch game with optional media (multipart)", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/gamification/games/{gameType}/status?active={boolean}", module: "Games", description: "Update game status", status: "Integrated frontend reference" },
    { method: "DELETE", path: "/api/v1/portal/dev/gamification/games/{gameType}", module: "Games", description: "Delete game", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/gamification/games/{gameType}/deactivate", module: "Games", description: "Deactivate game", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/assets/categories", module: "Assets", description: "List asset categories", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/assets/keys", module: "Assets", description: "List asset keys", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/assets/keys", module: "Assets", description: "Create asset key", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/assets/keys/batch", module: "Assets", description: "Create asset keys in batch", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/assets/upload", module: "Assets", description: "Upload asset media", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/assets/{assetKey}/image", module: "Assets", description: "Replace asset image", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/assets/{assetKey}/metadata", module: "Assets", description: "Update asset metadata", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/assets/{assetKey}/status?isActive={boolean}", module: "Assets", description: "Update asset active state", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/assets/keys/{assetKey}/status?enabled={boolean}", module: "Assets", description: "Update asset key enabled state", status: "Integrated frontend reference" },
    { method: "DELETE", path: "/api/v1/portal/dev/assets/{assetKey}/image", module: "Assets", description: "Delete asset image", status: "Integrated frontend reference" },
    { method: "DELETE", path: "/api/v1/portal/dev/assets/keys/{assetKey}", module: "Assets", description: "Delete asset key", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/app-profile/badges", module: "Badges", description: "List badges", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/app-profile/badges/{id}", module: "Badges", description: "Get badge details", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/app-profile/add-badges", module: "Badges", description: "Create badge", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/app-profile/badges/{id}", module: "Badges", description: "Update badge metadata", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/app-profile/badges/{id}/status", module: "Badges", description: "Update badge status", status: "Integrated frontend reference" },
    { method: "DELETE", path: "/api/v1/portal/dev/app-profile/badges/{id}", module: "Badges", description: "Delete badge", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/support/info-portal", module: "Support", description: "Fetch support information", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/support/get-faqs", module: "Support", description: "Fetch FAQs", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/support/upload/about", module: "Support", description: "Create About content", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/support/patch/about", module: "Support", description: "Update About content", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/support/upload/privacy-policy", module: "Support", description: "Create privacy policy", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/support/patch/privacy-policy", module: "Support", description: "Update privacy policy", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/support/upload/terms-condition", module: "Support", description: "Create terms and conditions", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/support/patch/terms-condition", module: "Support", description: "Update terms and conditions", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/support/upload/faqs", module: "Support", description: "Upload FAQs", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/support/patch/faqs/{id}", module: "Support", description: "Update FAQ", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/support/upload/faqs/category", module: "Support", description: "Create FAQ category", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/support/tickets", module: "Support", description: "List/filter support tickets", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/support/tickets/{ticketNumber}", module: "Support", description: "Get ticket details", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/support/tickets/{ticketNumber}/messages", module: "Support", description: "Get ticket messages", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/support/tickets/{ticketNumber}/messages", module: "Support", description: "Send ticket message or note", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/support/tickets/{ticketNumber}/status", module: "Support", description: "Update ticket status", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/feedback", module: "Feedback", description: "List feedback with pagination/filter", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/feedback/user/{userId}", module: "Feedback", description: "Get feedback by user", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/feedback/all", module: "Feedback", description: "Get all feedback", status: "Integrated frontend reference" },
    { method: "DELETE", path: "/api/v1/portal/dev/feedback/{id}", module: "Feedback", description: "Delete feedback", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/follow-us/get-links", module: "Follow Us", description: "Get app social links", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/follow-us/upload/links", module: "Follow Us", description: "Upload social links", status: "Integrated frontend reference" },
    { method: "PATCH", path: "/api/v1/portal/dev/follow-us/links/{id}", module: "Follow Us", description: "Update social link", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/email/send", module: "Email", description: "Send email", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/notification/users", module: "Notifications", description: "Fetch app users for notification recipient selection", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/notification/user/send?userEmail={email}", module: "Notifications", description: "Send to one directory user; title ≤200, body ≤2000, data ≤50 string entries", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/dev/notification/users/bulk", module: "Notifications", description: "Send to selected emails using { email: string[], notification: FcmNotificationRequest }", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/notification/history?page=0&size=20&status={status}", module: "Notifications", description: "Fetch newest-first page; status is optional PENDING, PROCESSING, RETRY_WAIT, SENT, NO_DEVICES, FAILED", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/dev/notification/history/analytics", module: "Notifications", description: "Fetch PortalNotificationAnalytics delivery metrics", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/auth/login", module: "Portal Authentication", description: "Portal login", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/auth/setup", module: "Portal Authentication", description: "Portal setup", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/auth/refresh", module: "Portal Authentication", description: "Refresh portal session", status: "Integrated frontend reference" },
    { method: "POST", path: "/api/v1/portal/auth/logout", module: "Portal Authentication", description: "Portal logout", status: "Integrated frontend reference" },
    { method: "GET", path: "/api/v1/portal/overview/live", module: "Health", description: "Application liveness check", status: "200 OK", expectedResponse: "{ status, checkedAt }" },
    { method: "GET", path: "/api/v1/portal/overview/ready", module: "Health", description: "Application readiness and database connectivity check", status: "200 OK · 503 Service Unavailable", expectedResponse: "{ status, database, databaseLatencyMs?, checkedAt }" },
    { method: "GET", path: "/api/v1/portal/overview", module: "Health", description: "Detailed application, database, JVM and connection pool health", status: "200 OK · 503 Service Unavailable", expectedResponse: "{ status, checkedAt, uptimeMs, database, jvm }" },
    { method: "GET", path: "/api/v1/portal/overview/api-latency", module: "Health", description: "Application API request count and latency metrics", status: "200 OK", expectedResponse: "{ measuredAt, requestCount, averageLatencyMs, maximumLatencyMs }" },
    { method: "GET", path: "/api/v1/portal/admin/mobile-users", module: "Mobile Users", description: "Search and paginate mobile application accounts", status: "200 OK · 401 Unauthorized · 403 Forbidden", expectedResponse: "Spring Page<MobileUserAdminResponseDto>" },
    { method: "GET", path: "/api/v1/portal/admin/mobile-users/{id}", module: "Mobile Users", description: "Fetch mobile user profile and account details", status: "200 OK · 401 Unauthorized · 403 Forbidden · 404 Not Found", expectedResponse: "MobileUserAdminResponseDto" },
    { method: "PATCH", path: "/api/v1/portal/admin/mobile-users/{id}/status", module: "Mobile Users", description: "Update a mobile user's account status", status: "200 OK · 400 Bad Request · 401 Unauthorized · 403 Forbidden · 404 Not Found", expectedResponse: "MobileUserAdminResponseDto" }
];

export default function DeveloperDashboard() {
    const [activeSection, setActiveSection] = useState<DeveloperSection>(() =>
        window.location.pathname.replace(/\/$/, "") === "/developer/logs" ? "Logs" : "Overview",
    );

    useEffect(() => {
        const syncLocation = () => setActiveSection(window.location.pathname.replace(/\/$/, "") === "/developer/logs" ? "Logs" : "Overview");
        window.addEventListener("popstate", syncLocation);
        return () => window.removeEventListener("popstate", syncLocation);
    }, []);

    const navigateToSection = (section: DeveloperSection) => {
        setActiveSection(section);
        const path = section === "Logs" ? "/developer/logs" : "/";
        if (window.location.pathname !== path) window.history.pushState({}, "", path);
    };

    const [search, setSearch] = useState("");
    const [apiModuleFilter, setApiModuleFilter] = useState("All modules");
    const [apiMethodFilter, setApiMethodFilter] = useState("All methods");

    const filteredEndpoints = endpoints.filter((endpoint) =>
        `${endpoint.method} ${endpoint.path} ${endpoint.description} ${endpoint.module}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
        (apiModuleFilter === "All modules" || endpoint.module === apiModuleFilter) &&
        (apiMethodFilter === "All methods" || endpoint.method === apiMethodFilter),
    );

    return (
        <div className="dev-portal">
            <aside className="dev-sidebar">
                <div className="dev-brand">
                    <span className="dev-brand-icon">
                        <Activity size={22} />
                    </span>

                    <span>
                        <strong>MusclePlay</strong>
                        <small>Developer Portal</small>
                    </span>
                </div>

                <div className="dev-workspace-label">DEV OPTIONS</div>

                <nav className="dev-nav" aria-label="Developer navigation">
                    {navigation.map(({ label, displayLabel, icon: Icon }) => (
                        <button
                            key={label}
                            aria-label={displayLabel ?? label}
                            title={displayLabel ?? label}
                            className={`dev-nav-item ${activeSection === label ? "active" : ""}`}
                            onClick={() => navigateToSection(label)}
                        >
                            <Icon size={18} />
                            <span>{displayLabel ?? label}</span>

                            {label === "Logs" && (
                                <span className="dev-nav-dot" />
                            )}
                        </button>
                    ))}
                </nav>

                <div className="dev-sidebar-bottom">
                    <div className="dev-help-card">
                        <span className="dev-help-icon">
                            <CircleHelp size={18} />
                        </span>

                        <strong>Need a hand?</strong>

                        <p>
                            Explore the API documentation to get started.
                        </p>

                        <button
                            onClick={() => navigateToSection("API Explorer")}
                        >
                            Explore APIs <ArrowUpRight size={14} />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="dev-main">
                <header className="dev-topbar">
                    <div className="dev-breadcrumb">
                        <span>Workspace</span>
                        <span className="dev-breadcrumb-separator">/</span>
                        <strong>{activeSection}</strong>
                    </div>

                    <div className="dev-topbar-actions">
                        <button
                            className="dev-icon-button"
                            aria-label="Search"
                            onClick={() => navigateToSection("API Explorer")}
                        >
                            <Search size={18} />
                        </button>

                        <button
                            className="dev-icon-button"
                            aria-label="Developer settings"
                            title="Developer settings"
                            onClick={() => navigateToSection("Settings")}
                        >
                            <Settings size={18} />
                        </button>

                        <button
                            className="dev-icon-button"
                            aria-label="Notifications"
                            title="Notifications are not connected"
                        >
                            <Bell size={18} />
                        </button>

                        <span className="dev-topbar-avatar">
                            {(sessionStorage.getItem("portalName")?.trim().charAt(0) || "D").toUpperCase()}
                        </span>
                        
                        <span className="dev-user-copy">
                            <strong>{sessionStorage.getItem("portalName") || sessionStorage.getItem("portalEmail") || "Developer"}</strong>
                        </span>
                    
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
                    </div>
                </header>

                {/* OVERVIEW */}
                {activeSection === "Overview" && <PlatformOverview/>}

                {/* API EXPLORER */}
                {activeSection === "API Explorer" && (
                    <div className="dev-content">
                        <div className="dev-page-heading">
                            <div>
                                <div className="dev-overline">
                                    API MANAGEMENT
                                </div>

                                <h1>API Explorer</h1>

                                <p>
                                    Browse selected endpoint references from your backend
                                    project.
                                </p>
                            </div>
                        </div>

                        <div className="dev-notice">
                            <ShieldCheck size={18} />

                            <div>
                                <strong>Integrated API reference</strong>

                                <p>
                                    This is a sample inventory, not a live API catalogue.
                                    It does not execute requests or verify endpoint
                                    authorization.
                                </p>
                            </div>
                        </div>

                        <div className="dev-panel dev-full-panel">
                            <div className="dev-api-toolbar">
                                <div>
                                    <h2>Endpoint reference</h2>
                                    <p>
                                        {filteredEndpoints.length} matching entries
                                    </p>
                                </div>

                                <div className="dev-api-search">
                                    <Search size={16} />

                                    <input
                                        aria-label="Search endpoints"
                                        placeholder="Search endpoints..."
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                    />

                                    {search && (
                                        <button
                                            aria-label="Clear search"
                                            onClick={() => setSearch("")}
                                        >
                                            <XCircle size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="dev-api-filters">
                                <select aria-label="Filter API module" value={apiModuleFilter} onChange={(event) => setApiModuleFilter(event.target.value)}>
                                    <option>All modules</option>
                                    {[...new Set(endpoints.map((endpoint) => endpoint.module))].sort().map((module) => <option key={module}>{module}</option>)}
                                </select>
                                <select aria-label="Filter HTTP method" value={apiMethodFilter} onChange={(event) => setApiMethodFilter(event.target.value)}>
                                    <option>All methods</option>
                                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => <option key={method}>{method}</option>)}
                                </select>
                            </div>

                            <div className="dev-table-wrap">
                                <table className="dev-api-table">
                                    <thead>
                                        <tr>
                                            <th>Method</th>
                                            <th>Module</th>
                                            <th>Endpoint</th>
                                            <th>Description</th>
                                            <th>HTTP status</th>
                                            <th>Expected response</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filteredEndpoints.map((endpoint) => (
                                            <tr key={endpoint.path}>
                                                <td>
                                                    <span
                                                        className={`dev-method ${endpoint.method === "POST"
                                                                ? "post"
                                                                : "get"
                                                            }`}
                                                    >
                                                        {endpoint.method}
                                                    </span>
                                                </td>

                                                <td>{endpoint.module}</td>
                                                <td>
                                                    <code>{endpoint.path}</code>
                                                </td>

                                                <td>{endpoint.description}</td>

                                                <td>
                                                    <span className="dev-endpoint-note">
                                                        {endpoint.status}
                                                    </span>
                                                </td>
                                                <td>{endpoint.expectedResponse ? <code>{endpoint.expectedResponse}</code> : "—"}</td>
                                            </tr>
                                        ))}

                                        {filteredEndpoints.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="dev-empty-row">
                                                    No endpoints match your search.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* LOGS */}
                {activeSection === "Logs" && <DeveloperLogsPage />}

                {/* SETTINGS */}
                {activeSection === "Settings" && (
                    <div className="dev-content">
                        <div className="dev-page-heading">
                            <div>
                                <div className="dev-overline">
                                    PREFERENCES
                                </div>

                                <h1>Developer settings</h1>

                                <p>
                                    Portal configuration and security information.
                                </p>
                            </div>
                        </div>

                        <div className="dev-panel dev-settings-card">
                            <div className="dev-settings-row">
                                <span className="dev-tool-icon blue">
                                    <ShieldCheck size={18} />
                                </span>

                                <div>
                                    <strong>
                                        Authentication and permissions
                                    </strong>

                                    <p>
                                        Portal access must be enforced by Spring Security
                                        on the server, not just by the frontend.
                                    </p>
                                </div>
                            </div>

                            <div className="dev-settings-row">
                                <span className="dev-tool-icon green">
                                    <Database size={18} />
                                </span>

                                <div>
                                    <strong>Backend connection</strong>

                                    <p>
                                        The health endpoint is connected through the Vite
                                        proxy. Database connectivity has not been verified.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === "Support Center" && <DeveloperSupportWorkspace />}
                {activeSection === "Feedback Management" && <DeveloperFeedbackManagement />}
                {activeSection === "App Follow Us" && <DeveloperFollowUsManagement />}
                {activeSection === "Email Management" && <DeveloperEmailManagement />}
                {activeSection === "Notification Management" && <DeveloperNotificationManagement />}
                {activeSection === "Assets Management" && <DeveloperAssetsManagement />}
                {activeSection === "Badge Management" && <DeveloperBadgeManagement />}
                {activeSection === "Exercise Management" && <DeveloperExerciseManagement />}
                {activeSection === "Nutrition Management" && <DeveloperNutritionManagement />}
                {activeSection === "Games and Challenges Builder" && <DeveloperGamificationManagement />}

                {![
                    "Overview",
                    "API Explorer",
                    "Logs",
                    "Settings",
                    "Support Center",
                    "Feedback Management",
                    "App Follow Us",
                    "Email Management",
                    "Notification Management",
                    "Assets Management",
                    "Badge Management",
                    "Exercise Management",
                    "Nutrition Management",
                    "Games and Challenges Builder",
                ].includes(activeSection) && (
                    <div className="dev-content">
                        <div className="dev-page-heading">
                            <div>
                                <div className="dev-overline">CONTENT WORKSPACE</div>
                                <h1>{activeSection}</h1>
                                <p>{moduleDescriptions[activeSection] ?? "This portal module is not connected to a verified backend capability yet."}</p>
                            </div>
                            <span className="dev-status-badge unknown"><span />Not connected</span>
                        </div>

                        <div className="dev-notice">
                            <ShieldCheck size={18} />
                            <div>
                                <strong>Portal screen only — not operational</strong>
                                <p>No records are fabricated here. Connect the corresponding backend API and permission policy before enabling data or write actions.</p>
                            </div>
                        </div>

                        <div className="dev-empty-state">
                            <span className="dev-empty-icon"><Code2 size={26} /></span>
                            <h2>No verified data source</h2>
                            <p>Explore the API Explorer for endpoint references and integration documentation.</p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
