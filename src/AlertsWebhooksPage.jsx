import { useCallback, useEffect, useState } from "react";
import api from "./api";
import "./AlertsWebhooksPage.css";

// Alerts & Webhooks
//   Alerts:   who gets told (email / Slack / SMS) and about what
//   Webhooks: signed event delivery to the customer's own systems
//   Activity: what happened recently and who was alerted

function formatWhen(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function errorText(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function PanelHeader({ title, sub, right }) {
  return (
    <div className="ak-panel-header aw-panel-header">
      <div>
        <h2>{title}</h2>
        {sub ? <p>{sub}</p> : null}
      </div>
      {right || null}
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled, hint }) {
  return (
    <label
      className={disabled ? "aw-toggle aw-toggle--disabled" : "aw-toggle"}
      title={hint}
    >
      <input
        type="checkbox"
        role="switch"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="aw-toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────
function AlertsTab() {
  const [state, setState] = useState({ loading: true });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get("/api/organizations/current/alerts");
      return { loading: false, ...res.data };
    } catch (err) {
      return {
        loading: false,
        error: errorText(err, "Could not load alert settings."),
      };
    }
  }, []);

  const apply = (next) => {
    setState(next);
    if (next.settings) {
      setForm({
        ...next.settings,
        slackWebhookUrl: "",
        events: { ...next.settings.events },
      });
    }
  };

  useEffect(() => {
    let active = true;
    fetchSettings().then((next) => {
      if (active) apply(next);
    });
    return () => {
      active = false;
    };
  }, [fetchSettings]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const payload = {
        enabled: form.enabled,
        emailEnabled: form.emailEnabled,
        emailRecipients: form.emailRecipients,
        slackEnabled: form.slackEnabled,
        smsEnabled: form.smsEnabled,
        smsNumbers: form.smsNumbers,
        events: form.events,
        degradedThresholdPercent: form.degradedThresholdPercent,
        cooldownMinutes: form.cooldownMinutes,
      };
      if (form.slackWebhookUrl.trim() || form.clearSlack)
        payload.slackWebhookUrl = form.clearSlack
          ? ""
          : form.slackWebhookUrl.trim();
      await api.put("/api/organizations/current/alerts", payload);
      apply(await fetchSettings());
      setMessage({ type: "ok", text: "Alert settings saved." });
    } catch (err) {
      setMessage({
        type: "error",
        text: errorText(err, "Could not save alert settings."),
      });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await api.post("/api/organizations/current/alerts/test");
      const channels = res.data.summary?.channels || {};
      const parts = Object.entries(channels).map(([name, r]) =>
        r.ok ? `${name}: sent` : `${name}: ${r.skipped || r.error || "failed"}`,
      );
      setMessage({
        type: parts.some((p) => p.endsWith("sent")) ? "ok" : "error",
        text: parts.length
          ? `Test alert: ${parts.join(" · ")}`
          : "No alert channel is turned on. Turn on email, Slack or SMS and save first.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: errorText(err, "Could not send the test alert."),
      });
    } finally {
      setTesting(false);
    }
  };

  if (state.loading)
    return <div className="ak-loading">Loading alert settings…</div>;
  if (state.error) return <div className="ak-error">{state.error}</div>;
  if (!form) return null;
  const available = form.channelsAvailable || {};

  return (
    <>
      <section className="ak-panel">
        <PanelHeader
          title="Stream health alerts"
          sub="Get told the moment a stream drops, a destination like Facebook fails, or the encoder is set up wrong."
          right={
            <Toggle
              checked={form.enabled}
              onChange={(v) => update({ enabled: v })}
              label={form.enabled ? "Alerts on" : "Alerts off"}
            />
          }
        />

        <div className="aw-channels">
          <div
            className={
              form.emailEnabled ? "aw-channel aw-channel--on" : "aw-channel"
            }
          >
            <Toggle
              checked={form.emailEnabled}
              onChange={(v) => update({ emailEnabled: v })}
              label="Email"
            />
            {!available.email ? (
              <p className="aw-warn-text">
                Email sending isn’t configured on this server (Mailgun).
              </p>
            ) : null}
            <label className="aw-field">
              Send to
              <textarea
                className="ak-input"
                rows={2}
                placeholder="Leave empty to email the organization’s owners and admins"
                value={form.emailRecipients}
                onChange={(e) => update({ emailRecipients: e.target.value })}
              />
              <small>Separate addresses with commas.</small>
            </label>
          </div>

          <div
            className={
              form.slackEnabled ? "aw-channel aw-channel--on" : "aw-channel"
            }
          >
            <Toggle
              checked={form.slackEnabled}
              onChange={(v) => update({ slackEnabled: v })}
              label="Slack"
            />
            <label className="aw-field">
              Incoming webhook URL
              <input
                className="ak-input"
                type="url"
                placeholder={
                  form.slackConfigured
                    ? `Saved (${form.slackWebhookHint}). Paste a new URL to replace it.`
                    : "https://hooks.slack.com/services/…"
                }
                value={form.slackWebhookUrl}
                onChange={(e) =>
                  update({ slackWebhookUrl: e.target.value, clearSlack: false })
                }
              />
              <small>
                In Slack: Apps → Incoming Webhooks → Add to a channel, then
                paste the URL here.
                {form.slackConfigured ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="aw-link"
                      onClick={() =>
                        update({ clearSlack: true, slackWebhookUrl: "" })
                      }
                    >
                      Remove saved URL
                    </button>
                  </>
                ) : null}
              </small>
            </label>
          </div>

          <div
            className={
              form.smsEnabled ? "aw-channel aw-channel--on" : "aw-channel"
            }
          >
            <Toggle
              checked={form.smsEnabled}
              onChange={(v) => update({ smsEnabled: v })}
              label="Text message (SMS)"
              disabled={!available.sms}
              hint={
                available.sms ? "" : "SMS needs Twilio settings on the server"
              }
            />
            {!available.sms ? (
              <p className="aw-warn-text">
                SMS isn’t configured on this server (Twilio).
              </p>
            ) : null}
            <label className="aw-field">
              Phone numbers
              <input
                className="ak-input"
                placeholder="+639171234567, +18045550100"
                value={form.smsNumbers}
                disabled={!available.sms}
                onChange={(e) => update({ smsNumbers: e.target.value })}
              />
              <small>
                International format. Texts are sent for critical alerts only: a
                dropped service or a failed destination.
              </small>
            </label>
          </div>
        </div>
      </section>

      <section className="ak-panel">
        <PanelHeader
          title="What to alert on"
          sub="Recovery messages are only sent when you were alerted about the problem."
        />
        <ul className="aw-event-list">
          {(state.events || []).map((event) => (
            <li key={event.type}>
              <Toggle
                checked={form.events[event.type]}
                onChange={(v) =>
                  update({ events: { ...form.events, [event.type]: v } })
                }
                label={event.label}
              />
              <p>{event.description}</p>
              <span className={`aw-sev aw-sev--${event.severity}`}>
                {event.severity}
              </span>
            </li>
          ))}
        </ul>

        <div className="aw-tuning">
          <label className="aw-field">
            Weak-signal alert when bitrate drops by more than
            <span className="aw-range">
              <input
                type="range"
                min="20"
                max="80"
                step="5"
                value={form.degradedThresholdPercent}
                onChange={(e) =>
                  update({ degradedThresholdPercent: Number(e.target.value) })
                }
              />
              <strong>{form.degradedThresholdPercent}%</strong>
            </span>
            <small>
              Compared with the stream’s own normal bitrate over the last few
              minutes, held for 30 seconds.
            </small>
          </label>
          <label className="aw-field">
            Don’t repeat the same alert within
            <select
              className="ak-input"
              value={form.cooldownMinutes}
              onChange={(e) =>
                update({ cooldownMinutes: Number(e.target.value) })
              }
            >
              {[5, 10, 15, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
        </div>

        {message.text ? (
          <div
            className={message.type === "ok" ? "ak-notice" : "ak-error"}
            role="status"
          >
            {message.text}
          </div>
        ) : null}

        <div className="aw-actions">
          <button
            type="button"
            className="ak-btn ak-btn--primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save alert settings"}
          </button>
          <button
            type="button"
            className="ak-btn ak-btn--ghost"
            onClick={sendTest}
            disabled={testing}
            title="Sends a test message to every channel that’s turned on (save first)"
          >
            {testing ? "Sending…" : "Send test alert"}
          </button>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Webhooks
// ─────────────────────────────────────────────────────────────
function SecretBox({ secret, onDone }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ak-new-key-box aw-secret">
      <strong>Copy this signing secret now</strong>
      <p>
        It won’t be shown again. Store it in your server’s settings and use it
        to verify the NLM-Signature header.
      </p>
      <code>{secret}</code>
      <button
        type="button"
        className="ak-btn ak-btn--ghost"
        onClick={() => {
          navigator.clipboard?.writeText(secret);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <button type="button" className="ak-btn ak-btn--ghost" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

function EventPicker({ catalog, value, onChange }) {
  const all = value.includes("*");
  return (
    <div className="aw-picker">
      <label className="aw-radio">
        <input type="radio" checked={all} onChange={() => onChange(["*"])} />
        All events (including ones added later)
      </label>
      <label className="aw-radio">
        <input
          type="radio"
          checked={!all}
          onChange={() => onChange(["stream.started", "stream.ended"])}
        />
        Choose events
      </label>
      {!all ? (
        <div className="aw-picker-grid">
          {catalog.map((event) => (
            <label
              key={event.type}
              className="aw-check"
              title={event.description}
            >
              <input
                type="checkbox"
                checked={value.includes(event.type)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, event.type]
                      : value.filter((t) => t !== event.type),
                  )
                }
              />
              <code>{event.type}</code>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Deliveries({ endpointId }) {
  const [state, setState] = useState({ loading: true, rows: [] });
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);

  const fetchRows = useCallback(async () => {
    try {
      const res = await api.get(
        `/api/organizations/current/webhooks/${endpointId}/deliveries`,
      );
      return { loading: false, rows: res.data.deliveries || [] };
    } catch (err) {
      return {
        loading: false,
        rows: [],
        error: errorText(err, "Could not load deliveries."),
      };
    }
  }, [endpointId]);

  useEffect(() => {
    let active = true;
    const read = () =>
      fetchRows().then((next) => {
        if (active) setState(next);
      });
    read();
    const timer = setInterval(read, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fetchRows]);

  const redeliver = async (id) => {
    setBusy(id);
    try {
      await api.post(
        `/api/organizations/current/webhooks/deliveries/${id}/redeliver`,
      );
      setState(await fetchRows());
    } finally {
      setBusy(null);
    }
  };

  if (state.loading)
    return <div className="ak-loading">Loading deliveries…</div>;
  if (state.error) return <div className="ak-error">{state.error}</div>;
  if (!state.rows.length)
    return (
      <div className="ak-empty">
        No deliveries yet. Send a test event to try it.
      </div>
    );

  return (
    <ul className="aw-deliveries">
      {state.rows.map((row) => (
        <li key={row.id} className={`aw-delivery aw-delivery--${row.status}`}>
          <button
            type="button"
            className="aw-delivery-row"
            onClick={() => setOpen(open === row.id ? null : row.id)}
            aria-expanded={open === row.id}
          >
            <span className={`aw-status aw-status--${row.status}`}>
              {row.status}
            </span>
            <code>{row.event_type}</code>
            <span>
              {row.response_status
                ? `HTTP ${row.response_status}`
                : row.error
                  ? "No response"
                  : ""}
            </span>
            <span>
              {row.attempts} attempt{row.attempts === 1 ? "" : "s"}
            </span>
            <time>{formatWhen(row.created_at)}</time>
          </button>
          {open === row.id ? (
            <div className="aw-delivery-detail">
              {row.error ? <p className="aw-warn-text">{row.error}</p> : null}
              {row.status === "pending" && row.attempts > 0 ? (
                <p className="aw-muted">
                  Next retry {formatWhen(row.next_attempt_at)}
                </p>
              ) : null}
              <strong>Payload</strong>
              <pre>{JSON.stringify(row.payload, null, 2)}</pre>
              {row.response_body ? (
                <>
                  <strong>Response</strong>
                  <pre>{row.response_body}</pre>
                </>
              ) : null}
              <button
                type="button"
                className="ak-btn ak-btn--ghost"
                disabled={busy === row.id}
                onClick={() => redeliver(row.id)}
              >
                {busy === row.id ? "Queued…" : "Redeliver"}
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EndpointCard({ endpoint, catalog, onChanged, onSecret }) {
  const [view, setView] = useState(null); // "deliveries" | "edit"
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState({
    url: endpoint.url,
    description: endpoint.description,
    events: endpoint.events,
  });

  const run = async (name, fn, success) => {
    setBusy(name);
    setNote("");
    try {
      await fn();
      if (success) setNote(success);
      await onChanged();
      return true;
    } catch (err) {
      setNote(errorText(err, "Something went wrong."));
      return false;
    } finally {
      setBusy("");
    }
  };

  const base = `/api/organizations/current/webhooks/${endpoint.id}`;
  return (
    <li
      className={
        endpoint.enabled ? "aw-endpoint" : "aw-endpoint aw-endpoint--off"
      }
    >
      <div className="aw-endpoint-head">
        <div className="aw-endpoint-main">
          <code className="aw-url">{endpoint.url}</code>
          <span className="aw-muted">
            {endpoint.description ? `${endpoint.description} · ` : ""}
            {endpoint.events.includes("*")
              ? "All events"
              : `${endpoint.events.length} event(s)`}
          </span>
          <span className="aw-muted">
            Last success: {formatWhen(endpoint.lastSuccessAt)}
            {endpoint.consecutiveFailures
              ? ` · ${endpoint.consecutiveFailures} failure(s) in a row`
              : ""}
          </span>
          {endpoint.disabledReason ? (
            <span className="aw-warn-text">{endpoint.disabledReason}</span>
          ) : null}
        </div>
        <Toggle
          checked={endpoint.enabled}
          label={endpoint.enabled ? "On" : "Off"}
          onChange={(v) => run("toggle", () => api.patch(base, { enabled: v }))}
        />
      </div>

      <div className="aw-endpoint-actions">
        <button
          type="button"
          className="ak-btn ak-btn--ghost"
          disabled={busy === "test" || !endpoint.enabled}
          onClick={() =>
            run(
              "test",
              () => api.post(`${base}/test`),
              "Test event queued. Check Deliveries.",
            )
          }
          title="Sends a webhook.test event to this URL"
        >
          {busy === "test" ? "Sending…" : "Send test event"}
        </button>
        <button
          type="button"
          className="ak-btn ak-btn--ghost"
          onClick={() => setView(view === "deliveries" ? null : "deliveries")}
          aria-expanded={view === "deliveries"}
        >
          Deliveries
        </button>
        <button
          type="button"
          className="ak-btn ak-btn--ghost"
          onClick={() => setView(view === "edit" ? null : "edit")}
          aria-expanded={view === "edit"}
        >
          Edit
        </button>
        <button
          type="button"
          className="ak-btn ak-btn--ghost"
          disabled={busy === "rotate"}
          title="Creates a new signing secret. The old one stops working immediately."
          onClick={() => {
            if (
              !window.confirm(
                "Create a new signing secret? The current secret stops working immediately, so update your server right after.",
              )
            )
              return;
            run("rotate", async () => {
              const res = await api.post(`${base}/rotate-secret`);
              onSecret(res.data.secret);
            });
          }}
        >
          Rotate secret
        </button>
        <button
          type="button"
          className="ak-btn ak-btn--danger"
          disabled={busy === "delete"}
          onClick={() => {
            if (
              !window.confirm(
                "Delete this webhook? Pending deliveries are canceled.",
              )
            )
              return;
            run("delete", () => api.delete(base));
          }}
        >
          Delete
        </button>
      </div>
      {note ? <div className="aw-note">{note}</div> : null}

      {view === "edit" ? (
        <div className="aw-edit">
          <label className="aw-field">
            URL
            <input
              className="ak-input"
              value={edit.url}
              onChange={(e) => setEdit({ ...edit, url: e.target.value })}
            />
          </label>
          <label className="aw-field">
            Description
            <input
              className="ak-input"
              value={edit.description}
              maxLength={255}
              onChange={(e) =>
                setEdit({ ...edit, description: e.target.value })
              }
            />
          </label>
          <EventPicker
            catalog={catalog}
            value={edit.events}
            onChange={(events) => setEdit({ ...edit, events })}
          />
          <button
            type="button"
            className="ak-btn ak-btn--primary"
            disabled={busy === "save"}
            onClick={() =>
              run("save", () => api.patch(base, edit), "Saved.").then(
                (ok) => ok && setView(null),
              )
            }
          >
            {busy === "save" ? "Saving…" : "Save changes"}
          </button>
        </div>
      ) : null}
      {view === "deliveries" ? <Deliveries endpointId={endpoint.id} /> : null}
    </li>
  );
}

const VERIFY_SNIPPET = `// Node.js / Express — verify an NLM webhook
const crypto = require("crypto");

app.post("/webhooks/nlm", express.raw({ type: "application/json" }), (req, res) => {
  const header = req.get("NLM-Signature") || "";           // "t=...,v1=..."
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const body = req.body.toString("utf8");                     // raw body, unparsed
  const expected = crypto
    .createHmac("sha256", process.env.NLM_WEBHOOK_SECRET)
    .update(\`\${parts.t}.\${body}\`)
    .digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  const valid = fresh && parts.v1 &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  if (!valid) return res.status(400).send("bad signature");

  const event = JSON.parse(body);                             // { id, type, data, ... }
  // Use event.id to ignore duplicates (retries reuse the same id).
  res.sendStatus(200);                                        // reply fast; do work async
});`;

function WebhooksTab() {
  const [state, setState] = useState({
    loading: true,
    endpoints: [],
    events: [],
  });
  const [secret, setSecret] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ url: "", description: "", events: ["*"] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get("/api/organizations/current/webhooks");
      return { loading: false, ...res.data };
    } catch (err) {
      return {
        loading: false,
        endpoints: [],
        events: [],
        error: errorText(err, "Could not load webhooks."),
      };
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [fetchAll]);

  const refresh = async () => setState(await fetchAll());

  const create = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/api/organizations/current/webhooks", form);
      setSecret(res.data.secret);
      setForm({ url: "", description: "", events: ["*"] });
      setAdding(false);
      await refresh();
    } catch (err) {
      setError(errorText(err, "Could not add the webhook."));
    } finally {
      setSaving(false);
    }
  };

  if (state.loading) return <div className="ak-loading">Loading webhooks…</div>;

  return (
    <>
      {state.error ? <div className="ak-error">{state.error}</div> : null}
      {secret ? (
        <SecretBox secret={secret} onDone={() => setSecret(null)} />
      ) : null}

      <section className="ak-panel">
        <PanelHeader
          title="Webhook endpoints"
          sub="NLM sends a signed POST to your URL whenever an event happens, so your website, app or church management system can react."
          right={
            !adding ? (
              <button
                type="button"
                className="ak-btn ak-btn--primary"
                onClick={() => setAdding(true)}
                disabled={state.endpoints.length >= 10}
              >
                Add endpoint
              </button>
            ) : null
          }
        />

        {adding ? (
          <div className="aw-edit aw-add">
            <label className="aw-field">
              Endpoint URL
              <input
                className="ak-input"
                type="url"
                placeholder="https://example.com/webhooks/nlm"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
              <small>Must be https:// and reachable from the internet.</small>
            </label>
            <label className="aw-field">
              Description (optional)
              <input
                className="ak-input"
                maxLength={255}
                placeholder="e.g. Website live banner"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <EventPicker
              catalog={state.events}
              value={form.events}
              onChange={(events) => setForm({ ...form, events })}
            />
            {error ? <div className="ak-error">{error}</div> : null}
            <div className="aw-actions">
              <button
                type="button"
                className="ak-btn ak-btn--primary"
                onClick={create}
                disabled={saving || !form.url.trim()}
              >
                {saving ? "Adding…" : "Add endpoint"}
              </button>
              <button
                type="button"
                className="ak-btn ak-btn--ghost"
                onClick={() => {
                  setAdding(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {state.endpoints.length === 0 && !adding ? (
          <div className="ak-empty">
            No webhooks yet. Add an endpoint to start receiving events.
          </div>
        ) : (
          <ul className="aw-endpoints">
            {state.endpoints.map((endpoint) => (
              <EndpointCard
                key={endpoint.id}
                endpoint={endpoint}
                catalog={state.events}
                onChanged={refresh}
                onSecret={setSecret}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="ak-panel ak-docs-panel">
        <PanelHeader
          title="How deliveries work"
          sub={`API version ${state.apiVersion || ""}`}
        />
        <ul className="aw-docs">
          <li>
            <strong>Request:</strong> <code>POST</code> with a JSON body{" "}
            <code>
              {"{ id, type, created_at, organization_id, channel_id, data }"}
            </code>
            .
          </li>
          <li>
            <strong>Signature:</strong> header{" "}
            <code>NLM-Signature: t=&lt;unix time&gt;,v1=&lt;hex&gt;</code>,
            where v1 is HMAC-SHA256 of <code>t + "." + raw body</code> using
            your signing secret.
          </li>
          <li>
            <strong>Success:</strong> reply with any 2xx status within 10
            seconds. Do slow work after replying.
          </li>
          <li>
            <strong>Retries:</strong> failures retry after 30s, 2m, 10m, 30m,
            2h, 6h and 12h, with the same <code>NLM-Webhook-Id</code>, so ignore
            ids you’ve already processed.
          </li>
          <li>
            <strong>Auto-off:</strong> after 25 failed deliveries in a row the
            endpoint is switched off until you turn it back on.
          </li>
        </ul>
        <pre className="ak-docs-code aw-code">{VERIFY_SNIPPET}</pre>
        <details className="aw-catalog">
          <summary>Event types</summary>
          <ul>
            {state.events.map((event) => (
              <li key={event.type}>
                <code>{event.type}</code> {event.description}
              </li>
            ))}
          </ul>
        </details>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Activity
// ─────────────────────────────────────────────────────────────
function ActivityTab() {
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [state, setState] = useState({ loading: true, events: [] });

  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get("/api/organizations/current/events", {
        params: { limit: 100, ...(alertsOnly ? { alertsOnly: 1 } : {}) },
      });
      return { loading: false, events: res.data.events || [] };
    } catch (err) {
      return {
        loading: false,
        events: [],
        error: errorText(err, "Could not load activity."),
      };
    }
  }, [alertsOnly]);

  useEffect(() => {
    let active = true;
    const read = () =>
      fetchEvents().then((next) => {
        if (active) setState(next);
      });
    read();
    const timer = setInterval(read, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fetchEvents]);

  return (
    <section className="ak-panel">
      <PanelHeader
        title="Recent activity"
        sub="Everything the monitor noticed in the last 90 days, and who was alerted."
        right={
          <Toggle
            checked={alertsOnly}
            onChange={setAlertsOnly}
            label="Alerts only"
          />
        }
      />
      {state.loading ? <div className="ak-loading">Loading…</div> : null}
      {state.error ? <div className="ak-error">{state.error}</div> : null}
      {!state.loading && !state.events.length ? (
        <div className="ak-empty">
          Nothing yet. Events appear here when a channel goes live.
        </div>
      ) : null}
      <ul className="aw-activity">
        {state.events.map((event) => {
          const channels = event.alert_summary?.channels || {};
          return (
            <li key={event.event_id}>
              <span
                className={`aw-dot aw-dot--${event.severity}`}
                aria-hidden="true"
              />
              <div>
                <strong>{event.title}</strong>
                <span className="aw-muted">
                  <code>{event.event_type}</code>
                  {event.channel_name ? ` · ${event.channel_name}` : ""}
                </span>
                {Object.keys(channels).length ? (
                  <span className="aw-alerted">
                    Alerted:{" "}
                    {Object.entries(channels)
                      .map(([name, r]) => `${name} ${r.ok ? "✓" : "✕"}`)
                      .join(" · ")}
                  </span>
                ) : null}
              </div>
              <time>{formatWhen(event.created_at)}</time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function AlertsWebhooksPage() {
  const [tab, setTab] = useState("alerts");
  const tabs = [
    { key: "alerts", label: "Alerts" },
    { key: "webhooks", label: "Webhooks" },
    { key: "activity", label: "Activity" },
  ];
  return (
    <div className="ak-page">
      <div className="ak-page-header">
        <div className="ak-page-header-left">
          <div className="ak-page-icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div>
            <h1 className="ak-page-title">Alerts &amp; Webhooks</h1>
            <p className="ak-page-sub">
              Know when something goes wrong, and connect your streams to other
              systems.
            </p>
          </div>
        </div>
      </div>

      <div className="aw-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "aw-tab aw-tab--on" : "aw-tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "alerts" ? <AlertsTab /> : null}
      {tab === "webhooks" ? <WebhooksTab /> : null}
      {tab === "activity" ? <ActivityTab /> : null}
    </div>
  );
}
