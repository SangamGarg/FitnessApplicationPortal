import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clipboard,
  Code2,
  Expand,
  LoaderCircle,
  Mail,
  Minimize2,
  Send,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { portalFetch } from "../lib/portalApi";
import "./DeveloperEmailManagement.css";

type RecipientType = "SINGLE" | "SELECTED" | "ALL";

type CommonEmailFields = {
  subject: string;
  body: string;
  htmlBody: string;
};

type PortalEmailRequest =
  | (CommonEmailFields & { recipientType: "SINGLE"; name?: string; email: string })
  | (CommonEmailFields & { recipientType: "SELECTED"; emails: string[] })
  | (CommonEmailFields & { recipientType: "ALL" });

type EmailResponse = {
  status?: string;
  statusCode?: number;
  message?: string;
  recipientType?: RecipientType;
  recipientCount?: number;
  name?: string;
  emails?: string[];
  email?: string;
  subject?: string;
  body?: string;
};

type ExecutionResult = {
  timestamp: string;
  durationMs: number;
  recipientType: RecipientType;
  recipientCount?: number;
  statusCode: number | null;
  statusText?: string;
  ok: boolean;
  body: unknown;
};

const EMAIL_ENDPOINT = "/api/v1/portal/dev/email/send";
const MAX_SELECTED_RECIPIENTS = 5000;
const LARGE_LIST_CONFIRMATION_COUNT = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMMUTABLE_EMAIL_FOOTER = `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;line-height:1.6;">
    <p>This is an automated email sent by MusclePlay.</p>
    <p>Please do not reply directly to this email.</p>
    <p>
        Need assistance? Visit the
        <strong>Help &amp; Support</strong> section in your FitnessApp
        to raise a new support ticket.
    </p>
    <p>2026 MusclePlay Inc. All rights reserved.</p>
</div>`;
const SAMPLE_EMAIL_HTML = `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #333333; line-height: 1.7;">

    <h1 style="color: #f06427; font-size: 28px; margin-bottom: 16px;">
        A message from MusclePlay
    </h1>

    <p style="font-size: 16px; margin-bottom: 20px;">
        Hello Fitness Enthusiast! 👋
    </p>

    <div style="background-color: #fff5ef; border-left: 4px solid #f06427; padding: 16px; margin: 24px 0; border-radius: 6px;">
        <p style="margin: 0; font-size: 16px; color: #444444;">
            <strong>Your message goes here.</strong><br>
            Replace this section with your announcement, update, motivational message,
            information, or any content you want to share with your users.
        </p>
    </div>

    <p style="font-size: 16px;">
        Keep moving, keep growing, and keep pushing towards your goals!
    </p>

    <p style="font-size: 16px; margin-top: 28px;">
        Stay Strong 💪
    </p>

    <p style="font-weight: bold; color: #f06427; font-size: 16px;">
        MusclePlay Team
    </p>

</div>`;
const MAX_EDITABLE_HTML_LENGTH = 50000 - IMMUTABLE_EMAIL_FOOTER.length - 1;

function isValidEmail(email: string): boolean {
  return email.length <= 320 && EMAIL_PATTERN.test(email);
}

function parseRecipientInput(value: string): string[] {
  return value.split(/[,\s;]+/).map((email) => email.trim()).filter(Boolean);
}

function uniqueRecipients(emails: string[]): string[] {
  const seen = new Set<string>();
  return emails.filter((email) => {
    const key = email.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFinalHtmlBody(editableHtml: string): string {
  const content = editableHtml.split(IMMUTABLE_EMAIL_FOOTER).join("").trimEnd();
  return `${content}${content ? "\n" : ""}${IMMUTABLE_EMAIL_FOOTER}`;
}

function parseResponse(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function responseObject(body: unknown): EmailResponse | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  return body as EmailResponse;
}

export default function DeveloperEmailManagement() {
  const [recipientType, setRecipientType] = useState<RecipientType>("SINGLE");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<"request" | "response" | "html" | null>(null);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const sendingRef = useRef(false);

  const finalHtml = useMemo(() => buildFinalHtmlBody(htmlBody), [htmlBody]);
  const validRecipients = useMemo(
    () => recipients.filter(isValidEmail),
    [recipients],
  );
  const invalidRecipients = useMemo(
    () => recipients.filter((recipient) => !isValidEmail(recipient)),
    [recipients],
  );
  const payloadPreview = useMemo(() => {
    const common = {
      subject: subject.trim(),
      body,
      htmlBody: finalHtml,
    };
    if (recipientType === "SINGLE") {
      return {
        recipientType,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...common,
      };
    }
    if (recipientType === "SELECTED") {
      return { recipientType, emails: validRecipients, ...common };
    }
    return { recipientType, ...common };
  }, [body, email, finalHtml, name, recipientType, subject, validRecipients]);

  function addRecipients() {
    setRecipients((current) => uniqueRecipients([...current, ...parseRecipientInput(recipientInput)]));
    setRecipientInput("");
  }

  function validationErrors(): string[] {
    const errors: string[] = [];
    if (recipientType === "SINGLE") {
      if (name.length > 50) errors.push("Recipient name must be 50 characters or fewer.");
      if (!email.trim()) errors.push("Recipient email is required.");
      else if (!isValidEmail(email.trim())) errors.push("Enter a valid recipient email address (maximum 320 characters).");
    }
    if (recipientType === "SELECTED") {
      if (!recipients.length) errors.push("Add at least one recipient email address.");
      if (invalidRecipients.length) errors.push("Remove or correct each invalid recipient email address.");
      if (recipients.length > MAX_SELECTED_RECIPIENTS) errors.push("The recipient list cannot exceed 5,000 addresses.");
    }
    if (!subject.trim()) errors.push("Email subject is required.");
    if (subject.length > 100) errors.push("Subject must be 100 characters or fewer.");
    if (/[\r\n]/.test(subject)) errors.push("Subject cannot contain line breaks.");
    if (!body.trim()) errors.push("Plain-text body is required.");
    if (body.length > 1000) errors.push("Plain-text body must be 1,000 characters or fewer.");
    if (!htmlBody.trim()) errors.push("HTML content is required.");
    if (!/<[a-z][^>]*>/i.test(htmlBody)) errors.push("HTML content must contain at least one HTML tag.");
    if (finalHtml.length > 50000) errors.push("Final HTML, including the immutable footer, exceeds 50,000 characters.");
    return errors;
  }

  function createRequest(): PortalEmailRequest {
    const common: CommonEmailFields = { subject: subject.trim(), body, htmlBody: finalHtml };
    if (recipientType === "SINGLE") {
      const trimmedName = name.trim();
      return {
        recipientType,
        ...(trimmedName ? { name: trimmedName } : {}),
        email: email.trim(),
        ...common,
      };
    }
    if (recipientType === "SELECTED") {
      return { recipientType, emails: validRecipients, ...common };
    }
    return { recipientType, ...common };
  }

  async function copyText(value: string, key: "request" | "response" | "html") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? null : current), 1600);
    } catch {
      setNotice({ kind: "error", text: "Clipboard access failed. Check browser permissions and try again." });
    }
  }

  async function sendEmail() {
    if (sendingRef.current) return;
    const errors = validationErrors();
    if (errors.length) {
      setNotice({ kind: "error", text: errors[0] });
      setConfirming(false);
      return;
    }

    const request = createRequest();
    const requestType = request.recipientType;
    const timestamp = new Date().toISOString();
    const startedAt = performance.now();
    sendingRef.current = true;
    setBusy(true);
    setConfirming(false);
    setNotice(null);

    try {
      const response = await portalFetch(EMAIL_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: JSON.stringify(request),
      });
      const raw = await response.text();
      const parsed = parseResponse(raw);
      const data = responseObject(parsed);
      const durationMs = Math.round(performance.now() - startedAt);
      setResult({
        timestamp,
        durationMs,
        recipientType: requestType,
        recipientCount: data?.recipientCount,
        statusCode: response.status,
        statusText: response.statusText,
        ok: response.ok,
        body: parsed ?? (response.ok ? "The server returned an empty response body." : "The server returned an empty error response."),
      });
      setNotice({
        kind: response.ok ? "success" : "error",
        text: response.ok
          ? `Email request completed with HTTP ${response.status}. Review the actual response below for delivery details.`
          : `Email request failed with HTTP ${response.status}. The actual response is shown below.`,
      });
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      setResult({
        timestamp,
        durationMs,
        recipientType: requestType,
        statusCode: null,
        ok: false,
        body: error instanceof Error ? error.message : "The request failed before a response was received.",
      });
      setNotice({
        kind: "error",
        text: "No HTTP response was received, so the request outcome could not be confirmed. Verify backend state before manually retrying.",
      });
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  }

  function handleSend() {
    const errors = validationErrors();
    if (errors.length) {
      setNotice({ kind: "error", text: errors[0] });
      return;
    }
    setNotice(null);
    if (recipientType === "ALL" || (recipientType === "SELECTED" && validRecipients.length >= LARGE_LIST_CONFIRMATION_COUNT)) {
      setConfirming(true);
      return;
    }
    void sendEmail();
  }

  const sendLabel = recipientType === "ALL"
    ? "Send to All Active Users"
    : recipientType === "SELECTED"
      ? "Send to Selected Recipients"
      : "Send Email";

  const resultData = result ? responseObject(result.body) : undefined;
  const bulkRequestMayHavePartialDelivery = result && !result.ok && result.recipientType !== "SINGLE";

  return (
    <div className="dev-content email-management">
      <div className="dev-page-heading email-page-heading">
        <div>
          <h1>Email Management</h1>
          <p>Compose and send an authenticated email request to one recipient, a selected list, or all eligible active users.</p>
        </div>
        <span className="email-live-badge"><Mail size={15} /> Live API</span>
      </div>

      <div className="email-safety-notice">
        <ShieldAlert size={19} />
        <div>
          <strong>Outbound email sends are real and may be irreversible</strong>
          <p>Bulk sends are never retried automatically. If a batch fails or a connection times out, earlier batches may already have been delivered.</p>
        </div>
      </div>

      <div className="email-endpoint"><span>POST</span><code>{EMAIL_ENDPOINT}</code></div>

      <div className="email-workspace-grid">
        <section className="email-panel email-composer">
          <div className="email-panel-heading">
            <div><h2><Mail size={18} /> Compose email</h2><p>Fields are kept in this page session only and are cleared when you leave.</p></div>
          </div>

          <div className="email-form-content">
            <label className="email-field">
              <span>Recipient type</span>
              <select value={recipientType} onChange={(event) => setRecipientType(event.target.value as RecipientType)}>
                <option value="SINGLE">Single recipient</option>
                <option value="SELECTED">Selected recipients</option>
                <option value="ALL">All active users</option>
              </select>
            </label>

            {recipientType === "SINGLE" && (
              <div className="email-recipient-fields">
                <label className="email-field">
                  <span>Recipient name <small>{name.length}/50</small></span>
                  <input value={name} maxLength={50} onChange={(event) => setName(event.target.value)} />
                  <small>Optional. Maximum 50 characters. If omitted, the backend uses "Fitness Enthusiast".</small>
                </label>
                <label className="email-field">
                  <span>Recipient email</span>
                  <input type="email" autoComplete="off" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} />
                  <small>Required. Enter a valid recipient email address. Maximum 320 characters.</small>
                  {email.trim() && !isValidEmail(email.trim()) && <small className="email-inline-error">Enter a valid email address (maximum 320 characters).</small>}
                </label>
              </div>
            )}

            {recipientType === "SELECTED" && (
              <div className="email-selected-recipients">
                <label className="email-field">
                  <span>Recipient email addresses</span>
                  <textarea rows={3} value={recipientInput} onChange={(event) => setRecipientInput(event.target.value)} placeholder="Paste addresses separated by commas, semicolons, or new lines" />
                  <small>Provide one or more valid email addresses. Maximum 5,000 recipients. Duplicate addresses should be removed.</small>
                </label>
                <div className="email-recipient-actions">
                  <button className="email-secondary" type="button" onClick={addRecipients} disabled={!recipientInput.trim()}><Users size={15} /> Add addresses</button>
                  <span>{recipients.length.toLocaleString()} / 5,000 recipients</span>
                  {recipients.length > 0 && <button className="email-text-button" type="button" onClick={() => setRecipients([])}><Trash2 size={14} /> Clear list</button>}
                </div>
                {recipients.length >= 4500 && <div className="email-list-warning"><AlertCircle size={15} /> You are approaching the 5,000-recipient maximum.</div>}
                {invalidRecipients.length > 0 && <p className="email-inline-error">{invalidRecipients.length} invalid address(es) must be corrected or removed before sending.</p>}
                {recipients.length > 0 && (
                  <ul className="email-recipient-list">
                    {recipients.map((recipient) => (
                      <li key={recipient.toLocaleLowerCase()} className={isValidEmail(recipient) ? "" : "invalid"}>
                        <span title={recipient}>{recipient}</span>
                        {!isValidEmail(recipient) && <small>Invalid email</small>}
                        <button type="button" aria-label={`Remove ${recipient}`} onClick={() => setRecipients((current) => current.filter((value) => value.toLocaleLowerCase() !== recipient.toLocaleLowerCase()))}><X size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {recipientType === "ALL" && (
              <div className="email-all-info">
                <Users size={19} />
                <div>
                  <strong>Backend-managed bulk audience</strong>
                  <p>This email will be sent to active app users with available email addresses. The backend automatically loads recipients and sends emails in batches.</p>
                  <ul>
                    <li>This is a bulk email operation; recipients are determined by the backend.</li>
                    <li>The frontend does not fetch or submit individual recipient addresses.</li>
                    <li>A later batch failure does not necessarily mean earlier batches were not delivered.</li>
                  </ul>
                </div>
              </div>
            )}

            <label className="email-field">
              <span>Subject <small>{subject.length}/100</small></span>
              <input value={subject} maxLength={100} onChange={(event) => setSubject(event.target.value)} />
              <small>Required. Maximum 100 characters. Line breaks are not allowed.</small>
              {/[\r\n]/.test(subject) && <small className="email-inline-error">Line breaks are not allowed in the subject.</small>}
            </label>

            <label className="email-field">
              <span>Plain-text body <small>{body.length}/1,000</small></span>
              <textarea rows={5} value={body} maxLength={1000} onChange={(event) => setBody(event.target.value)} />
              <small>Required. Maximum 1,000 characters. This content is used for the plain-text version of the email. The backend appends its own plain-text footer.</small>
            </label>

            <section className={`email-html-editor ${isExpanded ? "expanded" : ""}`}>
              <div className="email-html-heading">
                <div><strong>HTML content</strong><small>{htmlBody.length.toLocaleString()} editable / {finalHtml.length.toLocaleString()} final characters (50,000 max)</small></div>
                <div className="email-html-actions">
                  <button type="button" className="email-secondary" onClick={() => setIsPreview((current) => !current)}><Code2 size={14} /> {isPreview ? "Edit HTML" : "Preview"}</button>
                  <button type="button" className="email-icon-button" aria-label={isExpanded ? "Collapse HTML editor" : "Expand HTML editor"} onClick={() => setIsExpanded((current) => !current)}>{isExpanded ? <Minimize2 size={15} /> : <Expand size={15} />}</button>
                </div>
              </div>
              {isPreview ? (
                <div className="email-preview-wrap">
                  <iframe
                    className="email-html-preview"
                    title="Sandboxed email HTML preview"
                    sandbox=""
                    referrerPolicy="no-referrer"
                    srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"></head><body style="font-family:Arial,sans-serif;color:#20242a;padding:20px">${finalHtml}</body></html>`}
                  />
                  <small>Preview is sandboxed. The backend will wrap this content in its own email template.</small>
                </div>
              ) : (
                <>
                  {!htmlBody && (
                    <div className="email-sample-prompt">
                      <span>Start with a sample, then edit it here. It won't be sent until you explicitly submit the form.</span>
                      <button type="button" className="email-secondary" onClick={() => setHtmlBody(SAMPLE_EMAIL_HTML)}>Insert editable sample</button>
                    </div>
                  )}
                  <textarea className="email-html-source" spellCheck={false} value={htmlBody} maxLength={MAX_EDITABLE_HTML_LENGTH} onChange={(event) => setHtmlBody(event.target.value)} rows={10} aria-label="Editable email HTML source" />
                  <div className="email-immutable-footer">
                    <strong><ShieldAlert size={14} /> Immutable footer — appended automatically</strong>
                    <pre>{IMMUTABLE_EMAIL_FOOTER}</pre>
                  </div>
                </>
              )}
              <div className="email-editor-footer">
                <small>Required. Maximum 50,000 characters including the immutable footer. HTML must contain at least one tag; this check does not guarantee that HTML is safe or valid.</small>
                <div>
                  <button type="button" className="email-text-button" onClick={() => void copyText(finalHtml, "html")}><Clipboard size={14} /> {copied === "html" ? "Copied" : "Copy final HTML"}</button>
                  <button type="button" className="email-text-button" onClick={() => setHtmlBody("")}><Trash2 size={14} /> Clear content</button>
                </div>
              </div>
            </section>

            <div className="email-plain-footer-note"><Check size={14} /> The plain-text footer is appended by the backend and is not included in the body field.</div>
            {notice && <div className={`email-notice ${notice.kind}`} role="status"><AlertCircle size={16} /><span>{notice.text}</span></div>}
            <button type="button" className="email-send-button" disabled={busy} onClick={handleSend}>
              {busy ? <LoaderCircle size={17} className="email-spin" /> : <Send size={16} />}
              {busy ? "Sending request…" : sendLabel}
            </button>
          </div>
        </section>

        <aside className="email-side-column">
          <section className="email-panel email-inspector">
            <div className="email-panel-heading">
              <div><h2><Code2 size={18} /> Request preview</h2><p>Live JSON preview of the payload shape for the current form.</p></div>
              <button type="button" className="email-icon-button" aria-label="Copy request JSON" onClick={() => void copyText(JSON.stringify(payloadPreview, null, 2), "request")}>{copied === "request" ? <Check size={15} /> : <Clipboard size={15} />}</button>
            </div>
            <div className="email-request-meta"><span>POST</span><code>{EMAIL_ENDPOINT}</code></div>
            {recipientType === "SELECTED" && invalidRecipients.length > 0 && <p className="email-preview-warning">{invalidRecipients.length} invalid address(es) are omitted from this preview. Sending is blocked until corrected.</p>}
            <pre className="email-json-preview">{JSON.stringify(payloadPreview, null, 2)}</pre>
            <p className="email-inspector-footnote"><ChevronDown size={13} /> The final HTML includes the immutable footer. Recipient addresses appear only in this private preview and are not saved to browser storage.</p>
          </section>

          <section className="email-panel email-response-panel">
            <div className="email-panel-heading">
              <div><h2>API response</h2><p>Actual response from your authenticated request. No sample results are shown.</p></div>
              {result && <button type="button" className="email-icon-button" aria-label="Copy actual response" onClick={() => void copyText(typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2), "response")}>{copied === "response" ? <Check size={15} /> : <Clipboard size={15} />}</button>}
            </div>
            {!result ? (
              <div className="email-response-empty"><Mail size={21} /><strong>No request made yet</strong><span>Send an email to inspect its actual response.</span></div>
            ) : (
              <>
                <div className={`email-response-status ${result.ok ? "success" : "failure"}`}>
                  {result.statusCode === null ? "No HTTP response" : `HTTP ${result.statusCode}${result.statusText ? ` ${result.statusText}` : ""}`}
                </div>
                <dl className="email-response-meta">
                  <div><dt>Timestamp</dt><dd>{new Date(result.timestamp).toLocaleString()}</dd></div>
                  <div><dt>Duration</dt><dd>{result.durationMs} ms</dd></div>
                  <div><dt>Recipient type</dt><dd>{result.recipientType}</dd></div>
                  {result.recipientCount !== undefined && <div><dt>Recipient count</dt><dd>{result.recipientCount.toLocaleString()}</dd></div>}
                  {resultData?.status && <div><dt>Response status</dt><dd>{resultData.status}</dd></div>}
                  {resultData?.message && <div><dt>Message</dt><dd>{resultData.message}</dd></div>}
                </dl>
                {bulkRequestMayHavePartialDelivery && <div className="email-partial-warning"><AlertCircle size={15} /><span>A failed bulk response or connection does not confirm that no emails were delivered. Earlier batches may have been sent; no retry was attempted.</span></div>}
                <details className="email-actual-response">
                  <summary>Show actual response body <ChevronDown size={14} /></summary>
                  <p>Response data can contain private recipient information. Expand only when needed.</p>
                  <pre>{typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2)}</pre>
                </details>
              </>
            )}
          </section>
        </aside>
      </div>

      {confirming && (
        <div className="email-confirm-backdrop" role="presentation">
          <section className="email-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="email-confirm-title">
            <div className="email-confirm-icon"><AlertCircle size={23} /></div>
            <h2 id="email-confirm-title">{recipientType === "ALL" ? "Send to all active users?" : "Confirm bulk email"}</h2>
            <p>{recipientType === "ALL"
              ? "This will send to all eligible active app users with available email addresses. The backend determines the audience and processes recipients in batches."
              : `This will send to ${validRecipients.length.toLocaleString()} selected recipients.`}</p>
            <div className="email-confirm-subject"><span>Subject</span><strong>{subject.trim()}</strong></div>
            <p className="email-confirm-warning">A later batch may fail after earlier emails have already been delivered. If the request times out or fails, do not assume nothing was sent. No automatic retry will occur.</p>
            <div className="email-confirm-actions">
              <button type="button" className="email-secondary" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className="email-send-button" disabled={busy} onClick={() => void sendEmail()}>{busy ? <LoaderCircle size={16} className="email-spin" /> : <Send size={15} />} Confirm and send</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
