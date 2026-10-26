import supportModeImg from "./assets/Support_Mode.png";
import systemStatusImg from "./assets/System_Status.png";
import platformAdminsImg from "./assets/Platform_Admins.png";
import clientOnboardingWizardImg from "./assets/Client_Onboarding_Wizard.png";

function Screenshot({ label, src }) {
  if (src) {
    return (
      <div className="hc-screenshot">
        <img src={src} alt={label} />
      </div>
    );
  }

  return (
    <div className="hc-screenshot-placeholder">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span>Screenshot: {label}</span>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="hc-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function SuperAdminGuidePage() {
  return (
    <div className="sh-page">
      <div className="sh-page-header">
        <div className="sh-page-header-left">
          <div className="sh-page-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h2 className="sh-page-title">Super Admin Guide</h2>
            <p className="sh-page-sub">
              Platform-wide management — Support Mode, detailed system status,
              and managing platform admin accounts. This is internal
              documentation, not shown anywhere on the public site.
            </p>
          </div>
        </div>
      </div>

      <nav className="hc-toc" aria-label="Table of contents">
        <a href="#support-mode">Support Mode</a>
        <a href="#system-status">System Status (detail)</a>
        <a href="#admins">Platform Admins</a>
        <a href="#client-onboarding">Client Onboarding</a>
        <a href="#troubleshooting">Troubleshooting (Internal)</a>
        <a href="#disaster-recovery">Disaster Recovery</a>
        <a href="#release-notes">Release Notes</a>
      </nav>

      <Section id="support-mode" title="1. Support Mode">
        <p>
          Enter <strong>Support Mode</strong> on any organization from the org
          selector in the top bar — this steps you into that organization's
          dashboard exactly as their own admin would see it, for
          troubleshooting, without needing that org's own login credentials.
        </p>
        <Screenshot
          label="Support Mode org switcher in the top bar"
          src={supportModeImg}
        />
        <p>
          While in Support Mode, the top bar clearly indicates which
          organization you're viewing (e.g. "Support Mode — No Limits Media").
          Selecting a different organization from that same dropdown re-checks
          its live/simulcast status against the actual server state. Choosing{" "}
          <strong>— Platform view (no client selected) —</strong> exits Support
          Mode and returns you to the Platform Overview.
        </p>
        <p>
          <em>
            Everything a regular org admin can do — channels, recording, social
            publishing, analytics, and so on — works identically while in
            Support Mode. It's the same dashboard, just entered a different way.
          </em>
        </p>
      </Section>

      <Section id="system-status" title="2. System Status (detailed view)">
        <p>
          While the public <code>/status</code> page shows a simple
          Operational/Degraded/Outage view per category, super_admin accounts
          additionally have access to a detailed System Status page inside the
          dashboard (Admin → System Status).
        </p>
        <Screenshot
          label="Admin System Status page with per-service latency numbers"
          src={systemStatusImg}
        />
        <p>
          This shows real latency numbers and raw error detail for every
          underlying service — database, media server (SRS), storage/CDN
          (Bunny), and billing (WHMCS) — refreshed every 15 seconds. Use this
          when actually diagnosing an issue, not just confirming that one
          exists.
        </p>
        <p>
          <em>
            Billing status is checked by configuration presence, not a live
            connection test — WHMCS isn't pinged every few seconds purely for a
            status page.
          </em>
        </p>
      </Section>

      <Section id="admins" title="3. Platform Admins">
        <p>
          Manage who has <strong>super_admin</strong>, <strong>admin</strong>,
          or <strong>operator</strong> access at the platform level (Admin →
          Admins) — separate from individual organizations' own team members,
          which each organization manages for itself within their own account.
        </p>
        <Screenshot
          label="Admins & Users page listing platform admin accounts"
          src={platformAdminsImg}
        />
        <p>
          Fill in name, email, password, and role, then click{" "}
          <strong>Create Admin</strong>. Existing accounts can be edited or
          deleted from the All Accounts table below.
        </p>
        <p>
          <em>
            Grant super_admin access carefully — it includes visibility into
            every organization on the platform, not just the ability to view
            your own.
          </em>
        </p>
      </Section>

      <Section id="client-onboarding" title="4. Client Onboarding">
        <p>
          The <strong>Client Onboarding Wizard</strong> (Platform → Client
          Onboarding) creates a brand-new organization, its first admin login,
          and its first channel — all in one flow, rather than setting each of
          those up separately.
        </p>
        <Screenshot
          label="Client Onboarding Wizard, all three steps"
          src={clientOnboardingWizardImg}
        />

        <h3>Step 1 — Organization</h3>
        <p>
          Organization Name and Slug (auto-generated from the name, or fill it
          in yourself), Plan, optional Custom Domain, Logo URL, and Donation
          URL, plus Primary/Secondary brand colors used across that org's
          dashboard and public watch pages.
        </p>

        <h3>Step 2 — Client Login</h3>
        <p>
          Client Name, Client Email, and a Temporary Password create that org's
          first login. Global Role and Tenant Role set their permission level.
          If the email already belongs to an existing account, the wizard
          attaches that account to the new tenant instead of creating a
          duplicate — it will <strong>not</strong> overwrite their existing
          password.
        </p>

        <h3>Step 3 — First Channel</h3>
        <p>
          Channel Name and an optional Description generate that channel's
          stream credentials and public watch page — ready to hand to the client
          immediately after the wizard finishes.
        </p>

        <p>
          Click <strong>Auto-fill Slug</strong> to generate the organization
          slug from the name you've entered, or{" "}
          <strong>Create Client Tenant</strong> once all three steps are filled
          in to actually create everything at once.
        </p>
      </Section>

      <Section id="troubleshooting" title="5. Troubleshooting (Internal)">
        <p>
          For issues a client can self-diagnose (wrong stream key, OBS
          connection problems, buffering), point them to the public{" "}
          <a href="/help/troubleshooting" target="_blank" rel="noreferrer">
            Troubleshooting Guide
          </a>{" "}
          instead of walking through it yourself. This section is for issues
          that actually require server/infrastructure access.
        </p>

        <h3>Start with System Status</h3>
        <p>
          Before digging into logs, check the admin{" "}
          <strong>System Status</strong> page — it shows real latency numbers
          per service (database, SRS, Bunny, WHMCS) and will usually tell you
          which layer is actually failing before you go looking for it manually.
        </p>

        <h3>Reading backend logs</h3>
        <p>SSH into the server and run:</p>
        <code className="hc-code-block">
          pm2 logs nlm-stream-backend --lines 150 --nostream
        </code>
        <p>
          Add <code>| grep -i "keyword"</code> to filter for something specific
          — e.g. a stream key, a channel name, or a feature name like
          "manual-recording" — rather than scrolling through everything.
        </p>

        <h3>Checking SRS (the media server)</h3>
        <code className="hc-code-block">
          docker ps
          {"\n"}docker logs nlm-srs --tail 100
        </code>
        <p>
          Confirm the <code>nlm-srs</code> container shows as{" "}
          <strong>Up</strong>, not restarting. A stream that won't go live at
          all, when the backend itself looks healthy, is often an SRS container
          issue rather than a backend one.
        </p>

        <h3>Frontend vs. backend deploys are separate</h3>
        <p>
          <strong>
            A frontend code change is never live just because the backend was
            deployed.
          </strong>{" "}
          Backend deploys via <code>./deploy.sh</code> on the server (git pull +
          PM2 restart). Frontend changes require a local{" "}
          <code>npm run build</code> and uploading the resulting{" "}
          <code>dist</code> folder to DirectAdmin — a completely separate step.
          If a UI change "isn't showing up" after a backend deploy, check
          whether the frontend was actually rebuilt and re-uploaded before
          assuming it's a bug.
        </p>

        <h3>General principle</h3>
        <p>
          <em>
            Verify against the actual logs/server state before concluding
            something is broken (or that it's fixed) — a surprising number of
            issues turn out to be a stale deploy, a cached browser session, or a
            config value that looks right but isn't what's actually running.
            Don't trust a status claim (including your own past assumption)
            without checking it against what's currently live.
          </em>
        </p>
      </Section>

      <Section id="disaster-recovery" title="6. Disaster Recovery Procedure">
        <p>
          What to do if something goes seriously wrong — in the order to
          actually check things, not necessarily the order problems tend to
          happen.
        </p>

        <h3>1. Confirm what's actually down</h3>
        <p>
          Check <strong>System Status</strong> first — it isolates which layer
          is failing (database, media server, storage/CDN, billing) before you
          start guessing. Don't skip this step even in a panic; acting on the
          wrong assumption wastes time you don't have during an actual incident.
        </p>

        <h3>2. Server / backend unreachable</h3>
        <p>
          SSH into <code>192.211.56.162</code>. If SSH itself is unreachable,
          this is a hosting-provider-level outage (Hivelocity) rather than an
          application issue — check their status directly rather than trying to
          fix something on a server you can't reach.
        </p>
        <p>
          If SSH works but the site doesn't, check <code>pm2 status</code> — if
          the backend process is crash-looping, check{" "}
          <code>pm2 logs nlm-stream-backend --lines 100 --nostream</code> for
          the actual error before restarting it blind.
        </p>

        <h3>3. SRS (media server) down</h3>
        <p>
          Run <code>docker ps</code> to confirm the <code>nlm-srs</code>{" "}
          container status, then <code>docker logs nlm-srs --tail 100</code> for
          the actual failure. A full recreate (<code>docker compose down</code>{" "}
          then <code>docker compose up -d</code> from{" "}
          <code>/opt/nlm-stream/srs/</code>) is safe to try if a plain restart
          doesn't resolve it — it fully rebuilds the container from the current
          config rather than just restarting the existing process.
        </p>

        <h3>4. A bad deploy broke production</h3>
        <p>
          Backend deploys are git-based (<code>./deploy.sh</code> pulls from
          GitHub) — rolling back means checking out the last known-good commit
          and redeploying, not manually patching the live file. Frontend
          rollback means rebuilding and re-uploading a previous known-good
          build, since the deployed <code>dist</code> folder isn't itself
          version-controlled the same way.
        </p>
        <p>
          <em>
            Always confirm a fix actually landed by checking the live
            server/file, not just that the deploy command completed successfully
            — several real incidents this session turned out to be "the fix
            never actually reached production" rather than "the fix didn't
            work."
          </em>
        </p>

        <h3>5. Data loss scenarios</h3>
        <p>
          Recordings are archived to Bunny Storage and deleted from local disk
          shortly after processing — a server wipe or reprovision does{" "}
          <strong>not</strong> lose already-processed recordings, only whatever
          was mid-capture at the exact moment of failure. Database backups are
          managed through Railway's own dashboard — confirm their current
          backup/retention settings directly there rather than assuming a
          specific policy, since that's configured outside this codebase.
        </p>
      </Section>

      <Section id="release-notes" title="7. Release Notes">
        <p>
          A running log of major platform changes — add a new entry at the top
          each time something significant ships, rather than keeping this only
          in commit messages.
        </p>

        <h3>August 2026</h3>
        <ul>
          <li>
            <strong>Manual mid-broadcast recording</strong> — record just part
            of a live broadcast on demand, independent of automatic recording,
            with its own Bunny Storage folder structure
          </li>
          <li>
            <strong>File Broadcast</strong> — stream a pre-uploaded recording
            out through the live pipeline as if it were happening now
          </li>
          <li>
            <strong>AES-128 HLS encryption</strong> — live streams are now
            encrypted end-to-end, not just access-controlled by signed URLs
          </li>
          <li>
            <strong>Public REST API + org API keys</strong> — read-only
            programmatic access to streams, recordings, and analytics
          </li>
          <li>
            <strong>System Status</strong> — public status page plus a detailed
            admin view with real per-service latency
          </li>
          <li>
            <strong>Instagram simulcast</strong> — manual-key based, added
            alongside existing Facebook/YouTube one-click publishing
          </li>
          <li>
            <strong>"Record all incoming streams" toggle</strong> — per- channel
            control over automatic recording, layered on top of the plan-level
            setting
          </li>
          <li>
            <strong>Help Center</strong> — public Admin Guide, OBS Setup Guide,
            and Troubleshooting Guide; this Super Admin Guide moved in-dashboard
            for internal-only content
          </li>
        </ul>
      </Section>
    </div>
  );
}

export default SuperAdminGuidePage;
