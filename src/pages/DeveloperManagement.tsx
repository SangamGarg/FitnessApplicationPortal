import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperManagement.css";

type Developer = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "ACTIVE" | "INVITED" | "DISABLED" | string;
  createdAt: string;
  mobileNumber?: string | null;
  gender?: string | null;
  address?: string | null;
};

type Gender = "" | "MALE" | "FEMALE" | "OTHER";

type DeveloperForm = {
  name: string;
  email: string;
  mobileNumber: string;
  gender: Gender;
  address: string;
};

type FormErrors = Partial<Record<keyof DeveloperForm, string>>;

const api = "/api/portal/admin/developers";
const INITIAL_FORM: DeveloperForm = {
  name: "",
  email: "",
  mobileNumber: "",
  gender: "",
  address: "",
};

async function request(path = "", init: RequestInit = {}) {
  const response = await portalFetch(`${api}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      response.status === 401
        ? "Your portal session expired. Sign in again."
        : "Admin permission is required for this action.",
    );
  }
  if (response.status === 409) {
    throw new Error("A developer with this email already exists.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.detail || body.message || `Request failed (${response.status})`,
    );
  }
  if (response.status === 204) return null;
  return response.json();
}

function validateForm(form: DeveloperForm): FormErrors {
  const errors: FormErrors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  const mobileNumber = form.mobileNumber.trim();
  const address = form.address.trim();

  // Names must contain letters, not just punctuation/numbers.
  if (!name) {
    errors.name = "Full name is required.";
  } else if (name.length > 120) {
    errors.name = "Full name must be 120 characters or fewer.";
  } else if (!/[A-Za-z]/.test(name) || !/^[A-Za-z][A-Za-z .'-]*$/.test(name)) {
    errors.name =
      "Enter a valid name using letters; spaces, hyphens, apostrophes and periods are allowed.";
  }

  // Basic email format check plus a requirement for a valid-looking domain.
  const emailPattern =
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
  if (!email) {
    errors.email = "Work email is required.";
  } else if (email.length > 254 || !emailPattern.test(email)) {
    errors.email = "Enter a valid email address, such as alex@company.com.";
  }

  if (!mobileNumber) {
    errors.mobileNumber = "Mobile number is required.";
  } else if (!/^\d{10}$/.test(mobileNumber)) {
    errors.mobileNumber = "Mobile number must contain exactly 10 digits.";
  } else if (/^(\d)\1{9}$/.test(mobileNumber)) {
    errors.mobileNumber = "Enter a valid 10-digit mobile number.";
  }

  if (!form.gender) {
    errors.gender = "Please select a gender.";
  }

  if (!address) {
    errors.address = "Address is required.";
  } else if (address.length > 500) {
    errors.address = "Address must be 500 characters or fewer.";
  } else if (!/[A-Za-z0-9]/.test(address)) {
    errors.address = "Address must contain at least one letter or number.";
  }

  return errors;
}

export default function DeveloperManagement() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState<DeveloperForm>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request();
      setDevelopers(Array.isArray(result) ? (result as Developer[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load developers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      developers.filter((d) =>
        `${d.name} ${d.email} ${d.status}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [developers, search],
  );

  function updateField<K extends keyof DeveloperForm>(
    field: K,
    value: DeveloperForm[K],
  ) {
    setFormData((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setCreateError("");
  }

  function openCreate() {
    setFormData(INITIAL_FORM);
    setFieldErrors({});
    setCreateError("");
    setError("");
    setShowCreate(true);
  }

  function closeCreate() {
    if (creating) return;
    setShowCreate(false);
    setCreateError("");
    setFieldErrors({});
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setError("");

    // Validate everything before making any network request.
    const errors = validateForm(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setCreateError("Please correct the highlighted fields before continuing.");
      return;
    }

    setCreating(true);
    const normalizedEmail = formData.email.trim().toLowerCase();

    try {
      await request("", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name.trim(),
          email: normalizedEmail,
          mobileNumber: formData.mobileNumber.trim(),
          gender: formData.gender,
          address: formData.address.trim(),
        }),
      });

      setNotice(`Onboarding email sent to ${normalizedEmail}.`);
      setFormData(INITIAL_FORM);
      setFieldErrors({});
      setCreateError("");
      setShowCreate(false);
      await load();
    } catch (e) {
      setCreateError(
        e instanceof Error
          ? e.message
          : "Could not create developer. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function action(
    developer: Developer,
    type: "reset-password" | "status" | "delete",
  ) {
    const prompts = {
      "reset-password": `Send a new one-time password setup link to ${developer.email}?`,
      status: `${developer.status === "DISABLED" ? "Enable" : "Disable"} ${developer.name}'s account?`,
      delete: `Permanently delete ${developer.name}'s developer account?`,
    };
    if (!window.confirm(prompts[type])) return;

    setBusyId(developer.id);
    setError("");
    setNotice("");
    try {
      if (type === "delete") {
        await request(`/${developer.id}`, { method: "DELETE" });
      } else if (type === "status") {
        await request(`/${developer.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ enabled: developer.status === "DISABLED" }),
        });
      } else {
        await request(`/${developer.id}/reset-password`, { method: "POST" });
      }

      setNotice(
        type === "reset-password"
          ? `Password setup email sent to ${developer.email}.`
          : type === "delete"
            ? `${developer.name} was deleted.`
            : "Developer status updated.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  const active = developers.filter((d) => d.status === "ACTIVE").length;
  const invited = developers.filter((d) => d.status === "INVITED").length;
  const disabled = developers.filter((d) => d.status === "DISABLED").length;

  function fieldClass(field: keyof DeveloperForm) {
    return fieldErrors[field] ? "devmgmt-input devmgmt-input-invalid" : "devmgmt-input";
  }

  return (
    <div className="developer-management">
      <div className="devmgmt-heading">
        <div>
          <div className="devmgmt-eyebrow">ACCESS &amp; WORKSPACE</div>
          <h2>Developer management</h2>
          <p>Create developer accounts and manage portal access.</p>
        </div>
        <button className="devmgmt-primary" type="button" onClick={openCreate}>
          <Plus size={17} /> Add developer
        </button>
      </div>

      {error && (
        <div className="devmgmt-alert error" role="alert">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="devmgmt-alert success" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="devmgmt-stats">
        <article>
          <span className="devmgmt-stat-icon purple"><Users size={19} /></span>
          <div><span>Total developers</span><strong>{developers.length}</strong></div>
        </article>
        <article>
          <span className="devmgmt-stat-icon green"><ShieldCheck size={19} /></span>
          <div><span>Active accounts</span><strong>{active}</strong></div>
        </article>
        <article>
          <span className="devmgmt-stat-icon amber"><Mail size={19} /></span>
          <div><span>Invitations pending</span><strong>{invited}</strong></div>
        </article>
        <article>
          <span className="devmgmt-stat-icon gray"><UserRound size={19} /></span>
          <div><span>Disabled</span><strong>{disabled}</strong></div>
        </article>
      </div>

      <section className="devmgmt-panel">
        <div className="devmgmt-panel-top">
          <div>
            <h3>All developers</h3>
            <p>Only Admins can create accounts or change developer access.</p>
          </div>
          <button
            className="devmgmt-icon-button"
            type="button"
            onClick={() => void load()}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="devmgmt-toolbar">
          <div className="devmgmt-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or status"
              aria-label="Search developers"
            />
          </div>
          <span className="devmgmt-count">
            {filtered.length} {filtered.length === 1 ? "developer" : "developers"}
          </span>
        </div>

        <div className="devmgmt-table-wrap">
          <table className="devmgmt-table">
            <thead>
              <tr>
                <th>DEVELOPER</th>
                <th>STATUS</th>
                <th>CREATED</th>
                <th className="devmgmt-action-heading">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="devmgmt-empty">Loading developer accounts…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="devmgmt-empty">
                    <Users size={25} />
                    <strong>{search ? "No matching developers" : "No developers yet"}</strong>
                    <span>{search ? "Try another search." : "Add your first developer to send an onboarding email."}</span>
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="devmgmt-person">
                        <span className="devmgmt-avatar">
                          {d.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                        <div><strong>{d.name}</strong><span>{d.email}</span></div>
                      </div>
                    </td>
                    <td>
                      <span className={`devmgmt-status ${d.status.toLowerCase()}`}>
                        <i />
                        {d.status === "ACTIVE" ? "Active" : d.status === "INVITED" ? "Invitation sent" : d.status === "DISABLED" ? "Disabled" : d.status}
                      </span>
                    </td>
                    <td className="devmgmt-date">
                      {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <details className="devmgmt-menu">
                        <summary aria-label={`Actions for ${d.name}`}><MoreHorizontal size={18} /></summary>
                        <div className="devmgmt-menu-popover">
                          <button type="button" disabled={busyId === d.id} onClick={() => void action(d, "reset-password")}><Mail size={15} /> Send password setup link</button>
                          <button type="button" disabled={busyId === d.id} onClick={() => void action(d, "status")}><ShieldCheck size={15} />{d.status === "DISABLED" ? "Enable account" : "Disable account"}</button>
                          <button type="button" className="danger" disabled={busyId === d.id} onClick={() => void action(d, "delete")}><Trash2 size={15} /> Delete developer</button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="devmgmt-footnote">
          <ShieldCheck size={16} />
          <span>Developers authenticate with their portal email and password. Setup links expire after 24 hours and can be used once.</span>
        </div>
      </section>

      {showCreate && (
        <div
          className="devmgmt-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCreate();
          }}
        >
          <section
            className="devmgmt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="devmgmt-modal-title"
          >
            <div className="devmgmt-modal-head">
              <div>
                <span className="devmgmt-modal-icon"><UserRound size={20} /></span>
                <h3 id="devmgmt-modal-title">Add a developer</h3>
                <p>A one-time password setup link will be sent to their email.</p>
              </div>
              <button
                className="devmgmt-icon-button"
                type="button"
                onClick={closeCreate}
                aria-label="Close"
                disabled={creating}
              >
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div className="devmgmt-alert error devmgmt-modal-error" role="alert">
                <CircleAlert size={17} />
                <span>{createError}</span>
                <button type="button" onClick={() => setCreateError("")} aria-label="Dismiss error">
                  <X size={16} />
                </button>
              </div>
            )}

            <form onSubmit={create} className="devmgmt-create-form" noValidate>
              <label>
                Full name <span aria-hidden="true">*</span>
                <input
                  autoFocus
                  className={fieldClass("name")}
                  required
                  value={formData.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("name", e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  maxLength={120}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "developer-name-error" : undefined}
                />
                {fieldErrors.name && <small className="devmgmt-field-error" id="developer-name-error">{fieldErrors.name}</small>}
              </label>

              <label>
                Work email <span aria-hidden="true">*</span>
                <input
                  className={fieldClass("email")}
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("email", e.target.value)}
                  placeholder="alex@company.com"
                  maxLength={254}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "developer-email-error" : undefined}
                />
                {fieldErrors.email && <small className="devmgmt-field-error" id="developer-email-error">{fieldErrors.email}</small>}
              </label>

              <label>
                Mobile number <span aria-hidden="true">*</span>
                <input
                  className={fieldClass("mobileNumber")}
                  required
                  type="tel"
                  inputMode="numeric"
                  value={formData.mobileNumber}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateField("mobileNumber", e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  autoComplete="tel-national"
                  aria-invalid={Boolean(fieldErrors.mobileNumber)}
                  aria-describedby={fieldErrors.mobileNumber ? "developer-mobile-error" : undefined}
                />
                {fieldErrors.mobileNumber && <small className="devmgmt-field-error" id="developer-mobile-error">{fieldErrors.mobileNumber}</small>}
              </label>

              <label>
                Gender <span aria-hidden="true">*</span>
                <select
                  className={fieldClass("gender")}
                  required
                  value={formData.gender}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => updateField("gender", e.target.value as Gender)}
                  aria-invalid={Boolean(fieldErrors.gender)}
                  aria-describedby={fieldErrors.gender ? "developer-gender-error" : undefined}
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
                {fieldErrors.gender && <small className="devmgmt-field-error" id="developer-gender-error">{fieldErrors.gender}</small>}
              </label>

              <label>
                Address <span aria-hidden="true">*</span>
                <textarea
                  className={fieldClass("address")}
                  required
                  value={formData.address}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateField("address", e.target.value.slice(0, 500))}
                  placeholder="Enter full address"
                  maxLength={500}
                  rows={3}
                  aria-invalid={Boolean(fieldErrors.address)}
                  aria-describedby={fieldErrors.address ? "developer-address-error" : "developer-address-count"}
                />
                <div className="devmgmt-address-meta" id="developer-address-count">
                  <span>{fieldErrors.address && <small className="devmgmt-field-error" id="developer-address-error">{fieldErrors.address}</small>}</span>
                  <small>{formData.address.length}/500 characters</small>
                </div>
              </label>

              <div className="devmgmt-modal-note">
                <Mail size={17} />
                <span>They'll receive a one-time link by email to set their portal password. The link expires in 24 hours and can only be used once.</span>
              </div>

              <div className="devmgmt-modal-actions">
                <button type="button" className="devmgmt-secondary" onClick={closeCreate} disabled={creating}>Cancel</button>
                <button type="submit" className="devmgmt-primary" disabled={creating}>
                  {creating ? "Sending invitation…" : "Create & invite"}
                  <ChevronDown size={15} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
