import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "./api";
import "./ScheduledStreamsModern.css";

const emptyForm = {
  channel_id: "",
  title: "",
  stream_key: "",
  description: "",
  scheduled_start: "",
  scheduled_end: "",
  timezone: "America/Los_Angeles",
  status: "scheduled",
  automation_enabled: false,
  automation_start_targets: true,
  automation_stop_targets: true,
};

const TIMEZONES = [
  ["America/Los_Angeles", "Pacific Time", "Los Angeles"],
  ["America/Denver", "Mountain Time", "Denver"],
  ["America/Chicago", "Central Time", "Chicago"],
  ["America/New_York", "Eastern Time", "New York"],
  ["America/Phoenix", "Arizona Time", "Phoenix"],
  ["America/Anchorage", "Alaska Time", "Anchorage"],
  ["Pacific/Honolulu", "Hawaii Time", "Honolulu"],
  ["America/Toronto", "Eastern Time", "Toronto"],
  ["America/Vancouver", "Pacific Time", "Vancouver"],
  ["America/Mexico_City", "Central Time", "Mexico City"],
  ["America/Sao_Paulo", "Brasilia Time", "São Paulo"],
  ["Europe/London", "United Kingdom", "London"],
  ["Europe/Paris", "Central European Time", "Paris"],
  ["Europe/Berlin", "Central European Time", "Berlin"],
  ["Europe/Madrid", "Central European Time", "Madrid"],
  ["Europe/Rome", "Central European Time", "Rome"],
  ["Europe/Athens", "Eastern European Time", "Athens"],
  ["Africa/Johannesburg", "South Africa Time", "Johannesburg"],
  ["Asia/Dubai", "Gulf Time", "Dubai"],
  ["Asia/Kolkata", "India Standard Time", "Kolkata"],
  ["Asia/Singapore", "Singapore Time", "Singapore"],
  ["Asia/Manila", "Philippine Time", "Manila"],
  ["Asia/Hong_Kong", "Hong Kong Time", "Hong Kong"],
  ["Asia/Tokyo", "Japan Standard Time", "Tokyo"],
  ["Asia/Seoul", "Korea Standard Time", "Seoul"],
  ["Australia/Sydney", "Australian Eastern Time", "Sydney"],
  ["Pacific/Auckland", "New Zealand Time", "Auckland"],
  ["UTC", "Coordinated Universal Time", "UTC"],
].map(([value, label, city]) => ({ value, label, city }));

const STATUS_COLORS = {
  scheduled: "blue",
  live: "green",
  ended: "grey",
  cancelled: "red",
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getPublicRoute(path) {
  const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${appBase}${path}`;
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function localValueFromParts(year, month, day, hour, minute) {
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

function partsFromLocalValue(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function formatDate(value, timezone) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone || undefined,
    });
  } catch {
    return new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
}

function formatPickerValue(value) {
  const p = partsFromLocalValue(value);
  if (!p) return { date: "Choose date", time: "Choose time" };
  const date = new Date(p.year, p.month, p.day);
  const hour12 = p.hour % 12 || 12;
  const meridiem = p.hour >= 12 ? "PM" : "AM";
  return {
    date: date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: `${hour12}:${pad(p.minute)} ${meridiem}`,
  };
}

function durationLabel(start, end) {
  const a = partsFromLocalValue(start);
  const b = partsFromLocalValue(end);
  if (!a || !b) return "";
  const startMs = new Date(a.year, a.month, a.day, a.hour, a.minute).getTime();
  const endMs = new Date(b.year, b.month, b.day, b.hour, b.minute).getTime();
  const mins = Math.round((endMs - startMs) / 60000);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr${h === 1 ? "" : "s"}`;
  return `${h} hr ${m} min`;
}

function timezoneOffsetLabel(timeZone, referenceValue) {
  try {
    const p = partsFromLocalValue(referenceValue);
    const ref = p
      ? new Date(p.year, p.month, p.day, p.hour, p.minute)
      : new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });
    const item = formatter
      .formatToParts(ref)
      .find((part) => part.type === "timeZoneName");
    return item?.value?.replace("GMT", "UTC") || "";
  } catch {
    return "";
  }
}

function CalendarIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ClockIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function GlobeIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

function ChevronIcon({ direction = "down", size = 16 }) {
  const rotations = { down: 0, left: 90, up: 180, right: 270 };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${rotations[direction]}deg)` }}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function DateTimePicker({ label, value, onChange, minValue, accent = "blue" }) {
  const [open, setOpen] = useState(false);
  const initial =
    partsFromLocalValue(value) ||
    (() => {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
        hour: now.getHours(),
        minute: (Math.ceil(now.getMinutes() / 5) * 5) % 60,
      };
    })();
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [draftHour, setDraftHour] = useState(initial.hour);
  const [draftMinute, setDraftMinute] = useState(initial.minute);
  const rootRef = useRef(null);
  const formatted = formatPickerValue(value);

  useEffect(() => {
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const p = partsFromLocalValue(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
      setDraftHour(p.hour);
      setDraftMinute(p.minute);
    }
  }, [value]);

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const cells = [];
    for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
    for (let d = 1; d <= last.getDate(); d += 1) cells.push(d);
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const selected = partsFromLocalValue(value);
  const minParts = partsFromLocalValue(minValue);

  const chooseDay = (day) => {
    if (!day) return;
    const next = localValueFromParts(
      viewYear,
      viewMonth,
      day,
      draftHour,
      draftMinute,
    );
    if (minValue && next < minValue) return;
    onChange(next);
  };

  const setTime = (hour, minute) => {
    setDraftHour(hour);
    setDraftMinute(minute);
    const p = partsFromLocalValue(value);
    if (p) {
      const next = localValueFromParts(p.year, p.month, p.day, hour, minute);
      if (!minValue || next >= minValue) onChange(next);
    }
  };

  const moveMonth = (delta) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const setToday = () => {
    const d = new Date();
    const next = localValueFromParts(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      draftHour,
      draftMinute,
    );
    if (!minValue || next >= minValue) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      onChange(next);
    }
  };

  return (
    <div className="nlm-dtp" ref={rootRef}>
      <label className="ss-label">{label}</label>
      <button
        type="button"
        className={`nlm-date-trigger nlm-date-trigger--${accent}${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="nlm-date-trigger__icon">
          <CalendarIcon />
        </span>
        <span className="nlm-date-trigger__main">
          <strong>{formatted.date}</strong>
          <small>
            <ClockIcon size={14} /> {formatted.time}
          </small>
        </span>
        <span className="nlm-date-trigger__chevron">
          <ChevronIcon />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="nlm-picker-popover"
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.985 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <div className="nlm-calendar-head">
              <button
                type="button"
                className="nlm-icon-btn"
                onClick={() => moveMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronIcon direction="left" />
              </button>
              <strong>
                {MONTHS[viewMonth]} {viewYear}
              </strong>
              <button
                type="button"
                className="nlm-icon-btn"
                onClick={() => moveMonth(1)}
                aria-label="Next month"
              >
                <ChevronIcon direction="right" />
              </button>
            </div>
            <div className="nlm-calendar-grid nlm-calendar-weekdays">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="nlm-calendar-grid">
              {days.map((day, index) => {
                if (!day)
                  return (
                    <span
                      key={`blank-${index}`}
                      className="nlm-calendar-empty"
                    />
                  );
                const local = localValueFromParts(
                  viewYear,
                  viewMonth,
                  day,
                  draftHour,
                  draftMinute,
                );
                const disabled = Boolean(
                  minValue &&
                  local < minValue &&
                  (!minParts ||
                    day !== minParts.day ||
                    viewMonth !== minParts.month ||
                    viewYear !== minParts.year),
                );
                const isSelected = Boolean(
                  selected &&
                  selected.year === viewYear &&
                  selected.month === viewMonth &&
                  selected.day === day,
                );
                const now = new Date();
                const isToday =
                  now.getFullYear() === viewYear &&
                  now.getMonth() === viewMonth &&
                  now.getDate() === day;
                return (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    key={day}
                    disabled={disabled}
                    onClick={() => chooseDay(day)}
                    className={`nlm-calendar-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                  >
                    {day}
                  </motion.button>
                );
              })}
            </div>

            <div className="nlm-time-panel">
              <div className="nlm-time-panel__label">
                <ClockIcon size={16} /> Time
              </div>
              <div className="nlm-time-controls">
                <select
                  value={draftHour}
                  onChange={(e) => setTime(Number(e.target.value), draftMinute)}
                  aria-label="Hour"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option
                      value={h}
                      key={h}
                    >{`${pad(h)} ${h < 12 ? "AM" : "PM"}`}</option>
                  ))}
                </select>
                <span>:</span>
                <select
                  value={draftMinute}
                  onChange={(e) => setTime(draftHour, Number(e.target.value))}
                  aria-label="Minute"
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                    <option value={m} key={m}>
                      {pad(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="nlm-picker-footer">
              <button type="button" className="nlm-text-btn" onClick={setToday}>
                Today
              </button>
              <button
                type="button"
                className="nlm-done-btn"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TimezonePicker({ value, onChange, referenceValue }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const selected = TIMEZONES.find((zone) => zone.value === value) || {
    value,
    label: value,
    city: value,
  };

  useEffect(() => {
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = TIMEZONES.filter((zone) =>
    `${zone.label} ${zone.city} ${zone.value}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const offset = timezoneOffsetLabel(selected.value, referenceValue);

  return (
    <div className="nlm-tz" ref={rootRef}>
      <label className="ss-label">Timezone</label>
      <button
        type="button"
        className={`nlm-timezone-trigger${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="nlm-date-trigger__icon nlm-date-trigger__icon--globe">
          <GlobeIcon />
        </span>
        <span className="nlm-date-trigger__main">
          <strong>{selected.label}</strong>
          <small>
            {selected.city} · {offset || selected.value}
          </small>
        </span>
        <span className="nlm-zone-code">{offset}</span>
        <ChevronIcon />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="nlm-picker-popover nlm-timezone-popover"
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.985 }}
            transition={{ duration: 0.16 }}
          >
            <div className="nlm-zone-search">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search timezone or city…"
              />
            </div>
            <div className="nlm-zone-list">
              {filtered.length ? (
                filtered.map((zone) => {
                  const active = zone.value === value;
                  return (
                    <button
                      type="button"
                      key={zone.value}
                      className={`nlm-zone-option${active ? " is-active" : ""}`}
                      onClick={() => {
                        onChange(zone.value);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className="nlm-zone-check">
                        {active ? "✓" : ""}
                      </span>
                      <span>
                        <strong>{zone.label}</strong>
                        <small>
                          {zone.city} · {zone.value}
                        </small>
                      </span>
                      <em>{timezoneOffsetLabel(zone.value, referenceValue)}</em>
                    </button>
                  );
                })
              ) : (
                <div className="nlm-zone-empty">No matching timezone.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="nlm-toggle-row">
      <button
        type="button"
        className={`nlm-switch${checked ? " is-on" : ""}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 650, damping: 38 }}
        />
      </button>
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}

function ScheduledStreamsPage() {
  const reduceMotion = useReducedMotion();
  const currentAdmin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("nlm_admin") || "{}");
    } catch {
      return {};
    }
  }, []);

  const canManage = ["super_admin", "admin", "operator"].includes(
    currentAdmin.role,
  );
  const isSuperAdmin = currentAdmin.role === "super_admin";
  const [channels, setChannels] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const loadData = async () => {
    try {
      setError("");
      const [sRes, cRes] = await Promise.all([
        api.get("/api/schedules"),
        api.get("/api/channels"),
      ]);
      setSchedules(sRes.data.schedules || []);
      setChannels(cRes.data.channels || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load schedules.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const setField = (name, value) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: type === "checkbox" ? checked : value };
      if (name === "channel_id") {
        const ch = channels.find((c) => String(c.id) === String(value));
        if (ch) {
          next.stream_key = ch.stream_key;
          if (!next.title) next.title = ch.name;
        }
      }
      return next;
    });
  };

  const formValidation = useMemo(() => {
    if (!form.title || !form.stream_key || !form.scheduled_start)
      return "Title, stream key, and start time are required.";
    if (form.scheduled_end && form.scheduled_end <= form.scheduled_start)
      return "End date/time must be after the start date/time.";
    return "";
  }, [form]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (formValidation) {
      setError(formValidation);
      return;
    }
    try {
      setSaving(true);
      setNotice("");
      setError("");
      const payload = {
        ...form,
        channel_id: form.channel_id || null,
        scheduled_end: form.scheduled_end || null,
      };
      if (editingId) {
        await api.put(`/api/schedules/${editingId}`, payload);
        setNotice("Scheduled stream updated.");
      } else {
        await api.post("/api/schedules", payload);
        setNotice("Scheduled stream created.");
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  const editSchedule = (schedule) => {
    setEditingId(schedule.id);
    setForm({
      channel_id: schedule.channel_id || "",
      title: schedule.title || "",
      stream_key: schedule.stream_key || "",
      description: schedule.description || "",
      scheduled_start: toDatetimeLocal(schedule.scheduled_start),
      scheduled_end: schedule.scheduled_end
        ? toDatetimeLocal(schedule.scheduled_end)
        : "",
      timezone: schedule.timezone || "America/Los_Angeles",
      status: schedule.status || "scheduled",
      automation_enabled: Boolean(schedule.automation_enabled),
      automation_start_targets: schedule.automation_start_targets !== false,
      automation_stop_targets: schedule.automation_stop_targets !== false,
    });
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const deleteSchedule = async (schedule) => {
    if (!isSuperAdmin || !window.confirm(`Delete "${schedule.title}"?`)) return;
    try {
      await api.delete(`/api/schedules/${schedule.id}`);
      setNotice("Schedule deleted.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete.");
    }
  };

  const copyWatchLink = async (schedule) => {
    // Phase 2: share the channel's public playback ID, never the stream key.
    const channel =
      channels.find(
        (item) => String(item.id) === String(schedule.channel_id),
      ) || channels.find((item) => item.stream_key === schedule.stream_key);
    const watchId = channel?.playback_id || schedule.stream_key;
    const url = getPublicRoute(`/watch/${watchId}`);
    await navigator.clipboard.writeText(url);
    setCopiedId(schedule.id);
    setTimeout(() => setCopiedId(null), 1800);
    setNotice("Watch link copied.");
  };

  const duration = durationLabel(form.scheduled_start, form.scheduled_end);
  const zoneMeta = TIMEZONES.find((z) => z.value === form.timezone);
  const zoneOffset = timezoneOffsetLabel(form.timezone, form.scheduled_start);

  return (
    <motion.div
      className="ss-page ss-page--modern"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      <div className="ss-page-header nlm-modern-header">
        <div className="ss-page-header-left">
          <motion.div
            className="ss-page-icon nlm-header-icon"
            whileHover={reduceMotion ? undefined : { rotate: -4, scale: 1.04 }}
          >
            <CalendarIcon />
          </motion.div>
          <div>
            <div className="nlm-eyebrow">Broadcast automation</div>
            <h2 className="ss-page-title">Scheduled Streams</h2>
            <p className="ss-page-sub">
              Plan broadcasts with precise date, time, timezone, and Stream
              Target automation.
            </p>
          </div>
        </div>
        <span className="ss-count-pill">{schedules.length} Scheduled</span>
      </div>

      <AnimatePresence mode="popLayout">
        {notice && (
          <motion.div
            className="ss-banner ss-banner--success"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            ✓ {notice}
          </motion.div>
        )}
        {error && (
          <motion.div
            className="ss-banner ss-banner--error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            ! {error}
          </motion.div>
        )}
      </AnimatePresence>

      {canManage ? (
        <motion.div className="ss-form-card card nlm-scheduler-card" layout>
          <div className="ss-form-header nlm-form-header">
            <div>
              <div className="nlm-eyebrow">
                {editingId ? "Update broadcast" : "New broadcast"}
              </div>
              <h3 className="ss-form-title">
                {editingId ? "Edit Schedule" : "Create Schedule"}
              </h3>
              <p className="ss-form-sub">
                A focused scheduling workspace with timezone-aware automation.
              </p>
            </div>
            {editingId && (
              <span className="ss-editing-badge">
                <span className="ss-editing-dot" /> Editing
              </span>
            )}
          </div>

          <form className="ss-form" onSubmit={handleSubmit}>
            <section className="nlm-form-section">
              <div className="nlm-section-heading">
                <span className="nlm-step">01</span>
                <div>
                  <strong>Broadcast details</strong>
                  <small>Choose the channel and identify the event.</small>
                </div>
              </div>
              <div className="nlm-details-grid">
                <div className="ss-field">
                  <label className="ss-label">Channel</label>
                  <select
                    className="ss-input ss-select"
                    name="channel_id"
                    value={form.channel_id}
                    onChange={handleChange}
                  >
                    <option value="">Manual stream key</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ss-field">
                  <label className="ss-label">Title</label>
                  <input
                    className="ss-input"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Sunday Worship Service"
                  />
                </div>
                <div className="ss-field">
                  <label className="ss-label">Stream Key</label>
                  <input
                    className="ss-input"
                    name="stream_key"
                    value={form.stream_key}
                    onChange={handleChange}
                    placeholder="your-stream-key"
                  />
                </div>
                <div className="ss-field">
                  <label className="ss-label">Status</label>
                  <select
                    className="ss-input ss-select"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="live">Live</option>
                    <option value="ended">Ended</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="nlm-form-section nlm-schedule-section">
              <div className="nlm-section-heading">
                <span className="nlm-step">02</span>
                <div>
                  <strong>Schedule</strong>
                  <small>Pick an exact broadcast window and timezone.</small>
                </div>
              </div>
              <div className="nlm-schedule-grid">
                <DateTimePicker
                  label="Start"
                  value={form.scheduled_start}
                  onChange={(value) => setField("scheduled_start", value)}
                  accent="blue"
                />
                <DateTimePicker
                  label="End"
                  value={form.scheduled_end}
                  minValue={form.scheduled_start || undefined}
                  onChange={(value) => setField("scheduled_end", value)}
                  accent="orange"
                />
                <TimezonePicker
                  value={form.timezone}
                  onChange={(value) => setField("timezone", value)}
                  referenceValue={form.scheduled_start}
                />
              </div>

              {(form.scheduled_start || form.scheduled_end) && (
                <motion.div
                  className="nlm-schedule-summary"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="nlm-summary-dot" />
                  <div>
                    <strong>
                      {form.scheduled_start
                        ? formatPickerValue(form.scheduled_start).date
                        : "Start not set"}
                    </strong>
                    <small>
                      {form.scheduled_start
                        ? formatPickerValue(form.scheduled_start).time
                        : "—"}
                      {form.scheduled_end
                        ? ` → ${formatPickerValue(form.scheduled_end).time}`
                        : ""}
                      {duration ? ` · ${duration}` : ""}
                      {` · ${zoneMeta?.label || form.timezone}${zoneOffset ? ` (${zoneOffset})` : ""}`}
                    </small>
                  </div>
                </motion.div>
              )}
            </section>

            <section className="nlm-form-section">
              <div className="nlm-section-heading">
                <span className="nlm-step">03</span>
                <div>
                  <strong>Automation</strong>
                  <small>
                    Let NLM coordinate Stream Targets around the broadcast
                    window.
                  </small>
                </div>
              </div>
              <motion.div
                className={`nlm-automation-card${form.automation_enabled ? " is-enabled" : ""}`}
                layout
              >
                <Toggle
                  checked={form.automation_enabled}
                  onChange={(value) => setField("automation_enabled", value)}
                  label="Enable Scheduled Automation"
                  description="NLM watches the schedule and source state for you."
                />
                <AnimatePresence initial={false}>
                  {form.automation_enabled && (
                    <motion.div
                      className="nlm-automation-options"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Toggle
                        checked={form.automation_start_targets}
                        onChange={(value) =>
                          setField("automation_start_targets", value)
                        }
                        label="Start enabled Stream Targets"
                        description="Starts after the channel source is confirmed live."
                      />
                      <Toggle
                        checked={form.automation_stop_targets}
                        onChange={(value) =>
                          setField("automation_stop_targets", value)
                        }
                        label="Stop Stream Targets at end"
                        description="Gracefully ends target workers at the scheduled end."
                      />
                      <div className="nlm-automation-note">
                        <span>↻</span>
                        <p>
                          <strong>Late OBS protection</strong>
                          <small>
                            If the source is late, NLM retries automatically
                            during the configured grace period.
                          </small>
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </section>

            <section className="nlm-form-section">
              <div className="nlm-section-heading">
                <span className="nlm-step">04</span>
                <div>
                  <strong>Viewer notes</strong>
                  <small>
                    Optional context for your team or public-facing workflow.
                  </small>
                </div>
              </div>
              <div className="ss-field ss-field--wide">
                <textarea
                  className="ss-textarea nlm-modern-textarea"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Add service details, speaker name, or notes for viewers."
                />
              </div>
            </section>

            <div className="ss-form-actions nlm-form-actions">
              <motion.button
                whileHover={reduceMotion ? undefined : { y: -1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                className="ss-btn-primary nlm-primary-btn"
                type="submit"
                disabled={
                  saving || Boolean(formValidation && form.scheduled_start)
                }
              >
                {saving ? (
                  <>
                    <span className="ss-spinner" /> Saving…
                  </>
                ) : editingId ? (
                  "Update Schedule"
                ) : (
                  "Create Schedule"
                )}
              </motion.button>
              {editingId && (
                <button
                  className="ss-btn-ghost"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel Edit
                </button>
              )}
              <span className="nlm-form-hint">
                Times are stored timezone-aware by the Phase 3.1 scheduler.
              </span>
            </div>
          </form>
        </motion.div>
      ) : (
        <div className="ss-readonly-notice">
          View only — only admins and operators can create or edit schedules.
        </div>
      )}

      <div className="nlm-list-heading">
        <div>
          <span className="nlm-eyebrow">Broadcast queue</span>
          <h3>Upcoming & recent schedules</h3>
        </div>
      </div>
      <motion.div className="ss-list" layout>
        {schedules.length === 0 ? (
          <div className="ss-empty">
            <div className="ss-empty-icon">
              <CalendarIcon size={24} />
            </div>
            <strong>No scheduled streams yet.</strong>
            <p>Create one to enable countdowns and scheduled automation.</p>
          </div>
        ) : (
          schedules.map((schedule, index) => {
            const accent = STATUS_COLORS[schedule.status] || "grey";
            return (
              <motion.div
                key={schedule.id}
                layout
                className={`ss-card ss-card--${accent} nlm-schedule-card`}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: reduceMotion ? 0 : Math.min(index * 0.035, 0.2),
                }}
              >
                <div className="ss-card-body">
                  <div className="ss-card-top">
                    <div>
                      <div className="nlm-card-channel">
                        {schedule.channel_name || "Manual stream"}
                      </div>
                      <h3 className="ss-card-title">{schedule.title}</h3>
                    </div>
                    <span
                      className={`ss-status-badge ss-status--${schedule.status}`}
                    >
                      {schedule.status}
                    </span>
                  </div>
                  <p className="ss-card-desc">
                    {schedule.description || "No description added."}
                  </p>
                  <div className="nlm-card-timeline">
                    <div>
                      <span className="nlm-timeline-icon">
                        <CalendarIcon size={15} />
                      </span>
                      <span>
                        <strong>
                          {formatDate(
                            schedule.scheduled_start,
                            schedule.timezone,
                          )}
                        </strong>
                        <small>Start</small>
                      </span>
                    </div>
                    {schedule.scheduled_end && (
                      <div>
                        <span className="nlm-timeline-icon nlm-timeline-icon--orange">
                          <ClockIcon size={15} />
                        </span>
                        <span>
                          <strong>
                            {formatDate(
                              schedule.scheduled_end,
                              schedule.timezone,
                            )}
                          </strong>
                          <small>End</small>
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="nlm-timeline-icon nlm-timeline-icon--purple">
                        <GlobeIcon size={15} />
                      </span>
                      <span>
                        <strong>
                          {TIMEZONES.find((z) => z.value === schedule.timezone)
                            ?.label || schedule.timezone}
                        </strong>
                        <small>{schedule.timezone}</small>
                      </span>
                    </div>
                  </div>
                </div>
                {schedule.automation_enabled && (
                  <div className="nlm-card-automation">
                    <span className="nlm-live-pulse" />
                    <strong>Automation enabled</strong>
                    <span>
                      {schedule.automation_start_targets
                        ? "Start targets"
                        : "No target start"}
                    </span>
                    <span>·</span>
                    <span>
                      {schedule.automation_stop_targets
                        ? "Stop at end"
                        : "No target stop"}
                    </span>
                    {schedule.automation_last_error && (
                      <small>{schedule.automation_last_error}</small>
                    )}
                  </div>
                )}
                <div className="ss-card-actions">
                  <button
                    type="button"
                    className={`ss-action-btn ss-action-btn--copy${copiedId === schedule.id ? " ss-action-btn--copied" : ""}`}
                    onClick={() => copyWatchLink(schedule)}
                  >
                    {copiedId === schedule.id ? "✓ Copied!" : "Copy Watch Link"}
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      className="ss-action-btn ss-action-btn--edit"
                      onClick={() => editSchedule(schedule)}
                    >
                      Edit
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      type="button"
                      className="ss-action-btn ss-action-btn--delete"
                      onClick={() => deleteSchedule(schedule)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </motion.div>
  );
}

export default ScheduledStreamsPage;
