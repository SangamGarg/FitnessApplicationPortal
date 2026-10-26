
import { useEffect, useState } from "react";
import {
    Activity,
    ArrowUpRight,
    Bell,
    BookOpen,
    Bot,
    ChevronDown,
    CircleHelp,
    Code2,
    Database,
    Dumbbell,
    FileCode2,
    FileImage,
    Gauge,
    Gamepad2,
    GitBranch,
    LayoutDashboard,
    LifeBuoy,
    ListChecks,
    Search,
    Server,
    Settings,
    ShieldCheck,
    Terminal,
    Utensils,
    Wifi,
    XCircle,
} from "lucide-react";
import "./DeveloperDashboard.css";
import DeveloperFeatureConsole from "./DeveloperFeatureConsole";

type DeveloperSection =
    | "Overview"
    | "Services"
    | "API Explorer"
    | "Logs"
    | "Settings"
    | "Fitness Tools"
    | "Exercise Library CMS"
    | "Workout Plan CMS"
    | "Workout Content CMS"
    | "Diet and Food Database"
    | "Fitness Calculator Configuration"
    | "Games and Challenges Builder"
    | "Media Asset Library"
    | "FAQs and Help Center"
    | "Chatbot Knowledge Management"
    | "Content Publication and Version History"
    | "Support Ticket Inbox";

type HealthStatus = "checking" | "up" | "down";

type HealthResponse = {
    status?: string;
};

const navigation: {
    label: DeveloperSection;
    icon: typeof LayoutDashboard;
    displayLabel?: string;
}[] = [
        { label: "Overview", displayLabel: "Developer Overview", icon: LayoutDashboard },
        { label: "Exercise Library CMS", icon: Dumbbell },
        { label: "Workout Plan CMS", icon: ListChecks },
        { label: "Workout Content CMS", icon: BookOpen },
        { label: "Diet and Food Database", icon: Utensils },
        { label: "Fitness Calculator Configuration", icon: Activity },
        { label: "Games and Challenges Builder", icon: Gamepad2 },
        { label: "Media Asset Library", icon: FileImage },
        { label: "FAQs and Help Center", icon: CircleHelp },
        { label: "Chatbot Knowledge Management", icon: Bot },
        { label: "API Explorer", displayLabel: "API Explorer and Documentation", icon: Code2 },
        { label: "Content Publication and Version History", icon: FileCode2 },
        { label: "Services", displayLabel: "Technical Monitoring", icon: Server },
        { label: "Settings", displayLabel: "Developer Settings", icon: Settings },
        { label: "Support Ticket Inbox", icon: LifeBuoy },
        { label: "Logs", icon: FileCode2 },
        { label: "Fitness Tools", displayLabel: "Fitness Tools Console", icon: Terminal },
    ];

const moduleDescriptions: Partial<Record<DeveloperSection, string>> = {
    "Exercise Library CMS": "Exercise create, update, and delete operations are available in the existing API console. Content is not published through a verified publication workflow yet.",
    "Diet and Food Database": "Food nutrition upload and update operations are available in the existing API console. Dataset validation and import status are not connected.",
    "Fitness Calculator Configuration": "Calculator records can be managed through the existing API console. Configuration versioning and validation are not connected.",
    "Workout Plan CMS": "Workout plan authoring and exercise relationship APIs are not configured in this portal.",
    "Workout Content CMS": "Workout content creation and publication APIs are not configured in this portal.",
    "Games and Challenges Builder": "Game configuration, challenge authoring, and user-facing publication are not connected.",
    "Media Asset Library": "Media upload, storage, moderation, and metadata APIs are not configured.",
    "FAQs and Help Center": "FAQ management endpoints exist in the tools reference, but publication status and version history are not integrated.",
    "Chatbot Knowledge Management": "Chatbot knowledge ingestion, validation, and release controls are not configured.",
    "Content Publication and Version History": "No content publishing or version-history service is connected.",
    "Support Ticket Inbox": "Ticket assignment, replies, and status updates require a support service that is not connected.",
};

const endpoints = [
    {
        method: "POST",
        path: "/api/portal/user/loginRegister",
        description: "User authentication",
        status: "Authentication flow",
    },
    {
        method: "POST",
        path: "/api/portal/user/refresh-token",
        description: "Refresh access token",
        status: "Authentication flow",
    },
    {
        method: "PATCH",
        path: "/api/portal/dev/exercise/patch/category",
        description: "Update exercise category",
        status: "JWT protected",
    },
    { method: "POST", path: "/api/portal/dev/exercise/upload/category", description: "Create exercise category", status: "Fitness tools" },
    { method: "POST", path: "/api/portal/dev/calculator/upload-calories-in-food", description: "Upload food nutrition", status: "Fitness tools" },
    { method: "GET", path: "/api/portal/dev/feedback/all", description: "Read feedback", status: "Fitness tools" },
    { method: "POST", path: "/api/portal/dev/notification/send", description: "Send device notification", status: "Fitness tools" },
    { method: "POST", path: "/api/portal/dev/email/send-email-one-user", description: "Send user email", status: "Fitness tools" },
];

const services = [
    {
        name: "Spring Boot API",
        description: "Java backend",
        detail: "localhost:8080",
    },
    {
        name: "PostgreSQL",
        description: "Application database",
        detail: "appfitness",
    },
    {
        name: "Firebase",
        description: "Authentication and app services",
        detail: "Cloud",
    },
];

export default function DeveloperDashboard() {
    const [activeSection, setActiveSection] =
        useState<DeveloperSection>("Overview");

    const [search, setSearch] = useState("");

    const [healthStatus, setHealthStatus] =
        useState<HealthStatus>("checking");

    const [lastHealthCheck, setLastHealthCheck] =
        useState<Date | null>(null);

    const [healthMessage, setHealthMessage] = useState("");

    // Check the Spring Boot health endpoint on load and every 2 Minutes.
    useEffect(() => {
        let mounted = true;

        async function checkHealth() {
            try {
                const response = await fetch("/api/health", {
                    headers: {
                        Accept: "application/json",
                    },
                });

                if (!response.ok) {
                    throw new Error(`Health endpoint returned ${response.status}`);
                }

                const data: HealthResponse = await response.json();

                if (!mounted) {
                    return;
                }

                if (data.status?.toUpperCase() === "UP") {
                    setHealthStatus("up");
                    setHealthMessage("");
                } else {
                    setHealthStatus("down");
                    setHealthMessage("Unexpected health response");
                }

                setLastHealthCheck(new Date());
            } catch (error) {
                if (!mounted) {
                    return;
                }

                setHealthStatus("down");
                setHealthMessage(
                    error instanceof Error
                        ? error.message
                        : "Unable to reach the health endpoint",
                );
                setLastHealthCheck(new Date());
            }
        }

        void checkHealth();

        const intervalId = window.setInterval(() => {
            void checkHealth();
        }, 120_000);

        return () => {
            mounted = false;
            window.clearInterval(intervalId);
        };
    }, []);

    const filteredEndpoints = endpoints.filter((endpoint) =>
        `${endpoint.method} ${endpoint.path} ${endpoint.description}`
            .toLowerCase()
            .includes(search.toLowerCase()),
    );

    function renderHealthBadge() {
        const badgeClass =
            healthStatus === "up"
                ? "online"
                : healthStatus === "down"
                    ? "offline"
                    : "checking";

        const badgeText =
            healthStatus === "up"
                ? "Online"
                : healthStatus === "down"
                    ? "Unavailable"
                    : "Checking";

        return (
            <span
                className={`dev-status-badge ${badgeClass}`}
                title={
                    lastHealthCheck
                        ? `Last checked at ${lastHealthCheck.toLocaleTimeString()}`
                        : "Health check in progress"
                }
            >
                <span />
                {badgeText}
            </span>
        );
    }

    return (
        <div className="dev-portal">
            <aside className="dev-sidebar">
                <div className="dev-brand">
                    <span className="dev-brand-icon">
                        <Activity size={22} />
                    </span>

                    <span>
                        <strong>MusclePlay</strong>
                        <small>Developer workspace</small>
                    </span>
                </div>

                <div className="dev-workspace-label">WORKSPACE</div>

                <nav className="dev-nav" aria-label="Developer navigation">
                    {navigation.map(({ label, displayLabel, icon: Icon }) => (
                        <button
                            key={label}
                            aria-label={displayLabel ?? label}
                            title={displayLabel ?? label}
                            className={`dev-nav-item ${activeSection === label ? "active" : ""
                                }`}
                            onClick={() => setActiveSection(label)}
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
                            onClick={() => setActiveSection("API Explorer")}
                        >
                            Explore APIs <ArrowUpRight size={14} />
                        </button>
                    </div>

                    <div className="dev-user-profile">
                        <span className="dev-avatar">D</span>

                        <span className="dev-user-copy">
                            <strong>{sessionStorage.getItem("portalName") || sessionStorage.getItem("portalEmail") || "Developer"}</strong>
                            <small>{sessionStorage.getItem("portalRole") || "Developer"} workspace</small>
                        </span>

                        <ChevronDown size={16} />
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
                        <span className="dev-preview-pill">
                            <span />
                            Preview data
                        </span>

                        <button
                            className="dev-icon-button"
                            aria-label="Search"
                            onClick={() => setActiveSection("API Explorer")}
                        >
                            <Search size={18} />
                        </button>

                        <button
                            className="dev-icon-button"
                            aria-label="Notifications"
                            title="Notifications are not connected"
                        >
                            <Bell size={18} />
                        </button>

                        <span className="dev-topbar-avatar">D</span>
                    </div>
                </header>

                {/* OVERVIEW */}
                {activeSection === "Overview" && (
                    <div className="dev-content">
                        <div className="dev-page-heading">
                            <div>
                                <div className="dev-overline">
                                    DEVELOPER WORKSPACE
                                </div>

                                <h1>Engineering overview</h1>

                                <p>
                                    Monitor your backend services and explore your API
                                    infrastructure.
                                </p>
                            </div>

                            <button
                                className="dev-secondary-button"
                                onClick={() => setActiveSection("API Explorer")}
                            >
                                <Code2 size={16} />
                                Explore APIs
                            </button>
                        </div>

                        <div className="dev-notice">
                            <Activity size={18} />

                            <div>
                                <strong>Live backend health check</strong>

                                <p>
                                    Spring Boot is checked through the /api/health
                                    endpoint every 2 Minutes. Other metrics are still
                                    demonstration data.
                                </p>
                            </div>
                        </div>

                        <section className="dev-metric-grid">
                            <article className="dev-metric-card">
                                <div className="dev-metric-top">
                                    <span>Backend status</span>

                                    <span className="dev-metric-icon green">
                                        <Server size={18} />
                                    </span>
                                </div>

                                <strong>
                                    {healthStatus === "up"
                                        ? "Online"
                                        : healthStatus === "down"
                                            ? "Offline"
                                            : "Checking"}
                                </strong>

                                <div className="dev-metric-foot neutral">
                                    <Activity size={14} />
                                    <span>Live health endpoint</span>
                                </div>
                            </article>

                            <article className="dev-metric-card">
                                <div className="dev-metric-top">
                                    <span>API endpoints</span>

                                    <span className="dev-metric-icon blue">
                                        <Code2 size={18} />
                                    </span>
                                </div>

                                <strong>3</strong>

                                <div className="dev-metric-foot neutral">
                                    <GitBranch size={14} />
                                    <span>Sample endpoint inventory</span>
                                </div>
                            </article>

                            <article className="dev-metric-card">
                                <div className="dev-metric-top">
                                    <span>Database</span>

                                    <span className="dev-metric-icon purple">
                                        <Database size={18} />
                                    </span>
                                </div>

                                <strong>PostgreSQL</strong>

                                <div className="dev-metric-foot neutral">
                                    <Activity size={14} />
                                    <span>Connectivity not checked</span>
                                </div>
                            </article>

                            <article className="dev-metric-card">
                                <div className="dev-metric-top">
                                    <span>API latency</span>

                                    <span className="dev-metric-icon orange">
                                        <Gauge size={18} />
                                    </span>
                                </div>

                                <strong>--</strong>

                                <div className="dev-metric-foot neutral">
                                    <Wifi size={14} />
                                    <span>Telemetry not connected</span>
                                </div>
                            </article>
                        </section>

                        <section className="dev-panel-grid">
                            <article className="dev-panel dev-services-panel">
                                <div className="dev-panel-heading">
                                    <div>
                                        <h2>Service inventory</h2>
                                        <p>Core platform components</p>
                                    </div>

                                    <button
                                        className="dev-text-button"
                                        onClick={() => setActiveSection("Services")}
                                    >
                                        View services <ArrowUpRight size={14} />
                                    </button>
                                </div>

                                <div className="dev-service-row">
                                    <span className="dev-service-icon">
                                        <Server size={18} />
                                    </span>

                                    <div className="dev-service-copy">
                                        <strong>Spring Boot API</strong>
                                        <small>Health endpoint · Port 8080</small>
                                    </div>

                                    {renderHealthBadge()}
                                </div>

                                <div className="dev-service-row">
                                    <span className="dev-service-icon">
                                        <Database size={18} />
                                    </span>

                                    <div className="dev-service-copy">
                                        <strong>PostgreSQL</strong>
                                        <small>Application database</small>
                                    </div>

                                    <span className="dev-status-badge unknown">
                                        <span />
                                        Not checked
                                    </span>
                                </div>

                                <div className="dev-service-row">
                                    <span className="dev-service-icon">
                                        <ShieldCheck size={18} />
                                    </span>

                                    <div className="dev-service-copy">
                                        <strong>Authentication</strong>
                                        <small>Firebase and JWT integration</small>
                                    </div>

                                    <span className="dev-status-badge review">
                                        <span />
                                        Review
                                    </span>
                                </div>
                            </article>

                            <article className="dev-panel dev-quick-panel">
                                <div className="dev-panel-heading">
                                    <div>
                                        <h2>Developer tools</h2>
                                        <p>Quick access to common tasks</p>
                                    </div>
                                </div>

                                <button
                                    className="dev-tool-link"
                                    onClick={() => setActiveSection("API Explorer")}
                                >
                                    <span className="dev-tool-icon blue">
                                        <Code2 size={18} />
                                    </span>

                                    <span>
                                        <strong>API Explorer</strong>
                                        <small>Browse endpoint references</small>
                                    </span>

                                    <ArrowUpRight size={16} />
                                </button>

                                <button
                                    className="dev-tool-link"
                                    onClick={() => setActiveSection("Logs")}
                                >
                                    <span className="dev-tool-icon purple">
                                        <Terminal size={18} />
                                    </span>

                                    <span>
                                        <strong>Application logs</strong>
                                        <small>Prepare log monitoring</small>
                                    </span>

                                    <ArrowUpRight size={16} />
                                </button>

                                <button
                                    className="dev-tool-link"
                                    onClick={() => setActiveSection("Services")}
                                >
                                    <span className="dev-tool-icon green">
                                        <Activity size={18} />
                                    </span>

                                    <span>
                                        <strong>Service health</strong>
                                        <small>View live backend status</small>
                                    </span>

                                    <ArrowUpRight size={16} />
                                </button>
                            </article>
                        </section>

                        <div className="dev-footer">
                            <span>MusclePlay Developer Portal</span>
                            <span>
                                {lastHealthCheck
                                    ? `Last health check: ${lastHealthCheck.toLocaleTimeString()}`
                                    : "Waiting for health check"}
                            </span>
                        </div>
                    </div>
                )}

                {/* SERVICES */}
                {activeSection === "Services" && (
                    <div className="dev-content">
                        <div className="dev-page-heading">
                            <div>
                                <div className="dev-overline">
                                    INFRASTRUCTURE
                                </div>

                                <h1>Services</h1>

                                <p>
                                    Review your backend components and their connection
                                    status.
                                </p>
                            </div>
                        </div>

                        <div className="dev-notice">
                            <Activity size={18} />

                            <div>
                                <strong>
                                    {healthStatus === "up"
                                        ? "Spring Boot health endpoint is responding"
                                        : healthStatus === "down"
                                            ? "Spring Boot health check failed"
                                            : "Checking Spring Boot health"}
                                </strong>

                                <p>
                                    {healthMessage ||
                                        (lastHealthCheck
                                            ? `Last checked at ${lastHealthCheck.toLocaleTimeString()}.`
                                            : "Waiting for the first health check.")}

                                    {" "}PostgreSQL and Firebase are not independently
                                    monitored yet.
                                </p>
                            </div>
                        </div>

                        <div className="dev-panel dev-full-panel">
                            {services.map(({ name, description, detail }) => {
                                const isBackend = name === "Spring Boot API";

                                const badgeClass = !isBackend
                                    ? "unknown"
                                    : healthStatus === "up"
                                        ? "online"
                                        : healthStatus === "down"
                                            ? "offline"
                                            : "checking";

                                const badgeText = !isBackend
                                    ? "Not checked"
                                    : healthStatus === "up"
                                        ? "Online"
                                        : healthStatus === "down"
                                            ? "Unavailable"
                                            : "Checking";

                                return (
                                    <div className="dev-service-row" key={name}>
                                        <span className="dev-service-icon">
                                            {name === "PostgreSQL" ? (
                                                <Database size={18} />
                                            ) : name === "Firebase" ? (
                                                <ShieldCheck size={18} />
                                            ) : (
                                                <Server size={18} />
                                            )}
                                        </span>

                                        <div className="dev-service-copy">
                                            <strong>{name}</strong>
                                            <small>{description}</small>
                                        </div>

                                        <span className="dev-service-detail">
                                            {detail}
                                        </span>

                                        <span
                                            className={`dev-status-badge ${badgeClass}`}
                                            title={
                                                isBackend && lastHealthCheck
                                                    ? `Last checked at ${lastHealthCheck.toLocaleTimeString()}`
                                                    : undefined
                                            }
                                        >
                                            <span />
                                            {badgeText}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

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
                                <strong>Endpoint reference only</strong>

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

                            <div className="dev-table-wrap">
                                <table className="dev-api-table">
                                    <thead>
                                        <tr>
                                            <th>Method</th>
                                            <th>Endpoint</th>
                                            <th>Description</th>
                                            <th>Notes</th>
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

                                                <td>
                                                    <code>{endpoint.path}</code>
                                                </td>

                                                <td>{endpoint.description}</td>

                                                <td>
                                                    <span className="dev-endpoint-note">
                                                        {endpoint.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}

                                        {filteredEndpoints.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="dev-empty-row">
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
                {activeSection === "Logs" && (
                    <div className="dev-content">
                        <div className="dev-page-heading">
                            <div>
                                <div className="dev-overline">
                                    OBSERVABILITY
                                </div>

                                <h1>Application logs</h1>

                                <p>
                                    Prepare a central view for backend events and errors.
                                </p>
                            </div>
                        </div>

                        <div className="dev-empty-state">
                            <span className="dev-empty-icon">
                                <Terminal size={26} />
                            </span>

                            <h2>Log streaming isn't connected yet</h2>

                            <p>
                                This page will display real application logs after we
                                configure a secure log retrieval approach. No sample
                                entries are presented as real events.
                            </p>

                            <button
                                className="dev-secondary-button"
                                onClick={() => setActiveSection("Services")}
                            >
                                <Server size={16} />
                                Review services
                            </button>
                        </div>
                    </div>
                )}

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

                {/* FITNESS BACKEND TOOLS */}
                {activeSection === "Fitness Tools" && <DeveloperFeatureConsole />}

                {![
                    "Overview",
                    "Services",
                    "API Explorer",
                    "Logs",
                    "Settings",
                    "Fitness Tools",
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
                            <p>Existing developer API operations are available in the fitness tools console. That console sends requests to the configured API and should only be used against an approved test environment.</p>
                            <button className="dev-secondary-button" onClick={() => setActiveSection("Fitness Tools")}>
                                <Terminal size={16} /> Open fitness tools console
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}