
import { useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import "./LoginPage.css";

export type PortalRole = "ADMIN" | "DEVELOPER";

type LoginPageProps = {
  onContinue: (role: PortalRole) => void;
};

export default function LoginPage({ onContinue }: LoginPageProps) {
  const [role, setRole] = useState<PortalRole>("ADMIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // UI preview only. No credentials are sent or authenticated.
    onContinue(role);
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="visual-brand">
          <div className="brand-mark">
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <span>MusclePlay</span>
        </div>

        <div className="visual-content">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            FITNESS PLATFORM MANAGEMENT
          </span>

          <h1>
            Build healthier
            <br />
            habits. <span>At scale.</span>
          </h1>

          <p>
            Your central workspace to manage the MusclePlay fitness platform,
            monitor activity, and keep your services running smoothly.
          </p>

          <div className="visual-stats">
            <div>
              <span className="stat-icon">
                <Activity size={18} />
              </span>
              <div>
                <strong>Platform insights</strong>
                <small>Monitor key activity metrics</small>
              </div>
            </div>

            <div>
              <span className="stat-icon">
                <ShieldCheck size={18} />
              </span>
              <div>
                <strong>Secure access</strong>
                <small>Role-based management workspace</small>
              </div>
            </div>
          </div>
        </div>

        <div className="visual-footer">
          <span>FITNESSOS PORTAL</span>
          <span>Admin &amp; Developer Workspace</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="mobile-brand">
            <div className="brand-mark">
              <Activity size={22} strokeWidth={2.5} />
            </div>
            <span>MusclePlay</span>
          </div>

          <div className="form-heading">
            <span className="form-kicker">WELCOME BACK</span>
            <h2>Sign in to your portal</h2>
            <p>Choose your workspace and enter your credentials.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="field-label">Workspace</label>

            <div className="role-options">
              <button
                type="button"
                className={`role-option ${role === "ADMIN" ? "selected" : ""}`}
                onClick={() => setRole("ADMIN")}
                aria-pressed={role === "ADMIN"}
              >
                <span className="role-icon">
                  <ShieldCheck size={19} />
                </span>
                <span className="role-copy">
                  <strong>Admin</strong>
                  <small>Platform management</small>
                </span>
                <span className="role-radio" />
              </button>

              <button
                type="button"
                className={`role-option ${role === "DEVELOPER" ? "selected" : ""}`}
                onClick={() => setRole("DEVELOPER")}
                aria-pressed={role === "DEVELOPER"}
              >
                <span className="role-icon">
                  <Users size={19} />
                </span>
                <span className="role-copy">
                  <strong>Developer</strong>
                  <small>Technical workspace</small>
                </span>
                <span className="role-radio" />
              </button>
            </div>

            <label className="field-label" htmlFor="portal-email">
              Email address
            </label>
            <div className="input-wrap">
              <Mail size={18} />
              <input
                id="portal-email"
                type="email"
                placeholder="you@company.com"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="password-label-row">
              <label className="field-label" htmlFor="portal-password">
                Password
              </label>
              <span className="password-hint">Keep it confidential</span>
            </div>

            <div className="input-wrap">
              <LockKeyhole size={18} />
              <input
                id="portal-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button className="sign-in-button" type="submit">
              Continue to preview
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="preview-notice">
            <ShieldCheck size={17} />
            <p>
              <strong>Preview mode</strong>
              <span>
                This form does not authenticate or send your credentials.
              </span>
            </p>
          </div>

          <p className="login-legal">
            Authorized access only. Role permissions will be enforced by the
            backend when authentication is connected.
          </p>
        </div>
      </section>
    </main>
  );
}