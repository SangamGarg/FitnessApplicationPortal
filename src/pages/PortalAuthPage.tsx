import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Activity, ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import "./PortalAuthPage.css";

type PortalRole = "ADMIN" | "DEVELOPER";
type Props = { onAuthenticated: (role: PortalRole) => void };

export default function PortalAuthPage({ onAuthenticated }: Props) {
  const setupToken = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [mode, setMode] = useState<"login" | "setup">(setupToken ? "setup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      if (mode === "setup") {
        if (!setupToken) throw new Error("This setup link is missing its token. Ask an Admin for a new link.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const response = await fetch("/api/portal/auth/setup", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: setupToken, password }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || body.message || "Could not set password. The link may have expired.");
        setMessage("Password created. You can now sign in with your email and password.");
        setMode("login"); setPassword(""); setConfirmPassword("");
        window.history.replaceState({}, "", window.location.pathname);
      } else {
        const response = await fetch("/api/portal/auth/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || body.message || "Invalid email or password.");
        if (!body.accessToken || !["ADMIN", "DEVELOPER"].includes(body.role)) throw new Error("The server returned an invalid portal session.");
        sessionStorage.setItem("portalToken", body.accessToken);
        sessionStorage.setItem("portalRole", body.role);
        sessionStorage.setItem("portalEmail", body.email || email);
        sessionStorage.setItem("portalName", body.name || "Portal user");
        onAuthenticated(body.role as PortalRole);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  return <main className="portal-auth-shell">
    <section className="portal-auth-card">
      <div className="portal-auth-brand"><span className="portal-auth-logo"><Activity size={23} /></span><span>Fitness<span className="portal-auth-brand-accent">OS</span><small>DEVELOPER PLATFORM</small></span></div>
      <div className="portal-auth-art"><div className="portal-auth-art-orb orb-one"/><div className="portal-auth-art-orb orb-two"/><div className="portal-auth-art-icon"><ShieldCheck size={31}/></div><span className="portal-auth-art-tag">SECURE WORKSPACE</span></div>
      <div className="portal-auth-copy"><div className="portal-auth-eyebrow">{mode === "setup" ? "ACCOUNT ACTIVATION" : "WELCOME BACK"}</div><h1>{mode === "setup" ? "Set your password" : "Sign in to your portal"}</h1><p>{mode === "setup" ? "Choose a strong password to activate your developer account." : "Manage your fitness platform with your authorized workspace access."}</p></div>
      <form className="portal-auth-form" onSubmit={submit}>
        {mode === "login" ? <label>Email address<div className="portal-auth-input"><Mail size={17}/><input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"/></div></label> : <div className="portal-auth-notice"><KeyRound size={18}/><span>This secure setup link can be used once and expires after 24 hours.</span></div>}
        <label>{mode === "setup" ? "Create password" : "Password"}<div className="portal-auth-input"><LockKeyhole size={17}/><input type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} required minLength={mode === "setup" ? 12 : 1} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "setup" ? "At least 12 characters" : "Enter your password"}/></div></label>
        {mode === "setup" && <label>Confirm password<div className="portal-auth-input"><LockKeyhole size={17}/><input type="password" autoComplete="new-password" required minLength={12} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter it again"/></div></label>}
        {error && <div className="portal-auth-alert error">{error}</div>}{message && <div className="portal-auth-alert success">{message}</div>}
        <button className="portal-auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "setup" ? "Activate account" : "Sign in"}<ArrowRight size={17}/></button>
      </form>
      <div className="portal-auth-footer"><ShieldCheck size={15}/> Access is controlled by your Fitness App administrator.</div>
    </section>
    <div className="portal-auth-bottom">FITNESSOS <span>·</span> PRIVATE DEVELOPER WORKSPACE</div>
  </main>;
}
