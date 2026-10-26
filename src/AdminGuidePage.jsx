import { Link } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import Footer from "./Footer";
import creatingChannelImg from "./assets/Creating_a_channel.png";
import whatYouGetImg from "./assets/What_you_get_per_channel.png";
import goingLiveImg from "./assets/Going_Live.png";
import liveMonitorImg from "./assets/Live_Monitor.png";
import recordingImg from "./assets/Recording.png";
import fileBroadcastImg from "./assets/File_Broadcast.png";
import scheduledStreamsImg from "./assets/Scheduled_Streams.png";
import socialPublishingImg from "./assets/Social_Publishing_Simulcasting.png";
import analyticsImg from "./assets/Analytics.png";
import apiKeysImg from "./assets/API_Keys.png";

// Real screenshot when `src` is provided; otherwise the dashed-border
// placeholder, still labeled with what belongs there — used for the one
// or two spots still waiting on an image (the public /status page).
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

function AdminGuidePage() {
  return (
    <div className="hc-page">
      <PublicHeader />

      <main className="hc-main">
        <div className="hc-container">
          <div className="hc-breadcrumb">
            <Link to="/help">Help Center</Link>
            <span>/</span>
            <span>Admin Guide</span>
          </div>

          <header className="hc-hero">
            <span className="hc-eyebrow">Guide</span>
            <h1>Admin Guide</h1>
            <p className="hc-intro">
              Everything you need to run an organization on NLM Streaming Cloud
              — from creating your first channel through recording, social
              publishing, and API access.
            </p>
          </header>

          <nav className="hc-toc" aria-label="Table of contents">
            <a href="#roles">Account Roles</a>
            <a href="#channels">Channels</a>
            <a href="#going-live">Going Live</a>
            <a href="#live-monitor">Live Monitor</a>
            <a href="#recording">Recording</a>
            <a href="#file-broadcast">File Broadcast</a>
            <a href="#scheduled-streams">Scheduled Streams</a>
            <a href="#social">Social Publishing</a>
            <a href="#analytics">Analytics</a>
            <a href="#plans">Subscription &amp; Plans</a>
            <a href="#api-keys">API Keys</a>
            <a href="#status">System Status</a>
            <a href="#quick-reference">Quick Reference</a>
          </nav>

          <Section id="roles" title="1. Account Roles">
            <p>Every admin account has one of these roles:</p>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Can do</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>super_admin</strong>
                  </td>
                  <td>Platform-wide</td>
                  <td>
                    Everything — manage every organization, view System Status,
                    manage other admins, all org-level permissions below
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>owner / admin</strong>
                  </td>
                  <td>Single organization</td>
                  <td>
                    Full control of their own organization: channels,
                    recordings, social publishing, API keys, subscription, team
                    settings
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>operator</strong>
                  </td>
                  <td>Single organization</td>
                  <td>
                    Day-to-day operation (start/stop streams, manual recording)
                    without access to billing or destructive account actions
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              <em>
                Managing the platform across every organization — Support Mode,
                System Status detail, and platform admin accounts — is covered
                in the separate{" "}
                <Link to="/help/super-admin-guide">Super Admin Guide</Link>.
              </em>
            </p>
          </Section>

          <Section id="channels" title="2. Channels">
            <p>
              A <strong>channel</strong> is a single stream source with its own
              RTMP ingest, stream key, and watch page.
            </p>

            <h3>Creating a channel</h3>
            <p>
              Go to <strong>Channels → Create Channel</strong>, give it a name
              and optional description. A unique stream key is generated
              automatically. Your plan determines how many channels you can
              create — the page shows your current usage (e.g., "3 of 3 channels
              used").
            </p>
            <Screenshot label="Create Channel form" src={creatingChannelImg} />

            <h3>What you get per channel</h3>
            <ul>
              <li>
                <strong>RTMP Server</strong> + <strong>Stream Key</strong> —
                enter these into OBS (or any RTMP-capable encoder) to go live
              </li>
              <li>
                <strong>SRT URL</strong> — for encoders that support SRT instead
                of RTMP
              </li>
              <li>
                <strong>Playback URL</strong> — the raw HLS manifest, useful for
                embedding in your own tools
              </li>
              <li>
                <strong>Watch Page</strong> — the public page viewers actually
                visit
              </li>
              <li>
                <strong>Copy Embed Code</strong> — an iframe snippet to embed
                the live player on your own website
              </li>
            </ul>
            <Screenshot
              label="A channel card showing RTMP server, stream key, SRT URL, playback URL, and watch page"
              src={whatYouGetImg}
            />

            <h3>Regenerating a stream key</h3>
            <p>
              If a stream key is compromised or you just want a fresh one,
              regenerate it from the channel card.{" "}
              <strong>This immediately invalidates the old key</strong> — update
              OBS with the new one before you go live again.
            </p>
          </Section>

          <Section id="going-live" title="3. Going Live">
            <p>
              Point OBS (or your encoder of choice) at the RTMP Server + Stream
              Key shown on the channel. Once OBS starts publishing, the channel
              shows as <strong>Live</strong> across the dashboard within a few
              seconds.
            </p>
            <Screenshot
              label="OBS Settings → Stream, with the RTMP Server and Stream Key entered"
              src={goingLiveImg}
            />
            <p>
              Every broadcast automatically gets transcoded into multiple
              quality renditions (ABR) so viewers get the best quality their
              connection supports, without you doing anything extra.
            </p>
          </Section>

          <Section id="live-monitor" title="4. Live Monitor">
            <p>
              <strong>Live Monitor</strong> shows every currently-live channel
              with real-time viewer count, bitrate, uptime, and stream health.
              This is the fastest way to confirm a broadcast is actually
              reaching viewers, not just that OBS says it's connected.
            </p>
            <Screenshot
              label="Live Monitor page with an active broadcast"
              src={liveMonitorImg}
            />
          </Section>

          <Section id="recording" title="5. Recording">
            <p>
              There are two independent ways recordings happen. They don't
              interfere with each other — a channel can have one, both, or
              neither active at the same time.
            </p>
            <Screenshot
              label="Channels page showing both the Record all incoming streams toggle and the Manual Recording control"
              src={recordingImg}
            />

            <h3>5.1 Automatic recording ("Record all incoming streams")</h3>
            <p>
              A toggle on each channel (Channels page, below the stream
              details). When <strong>on</strong>, every broadcast on that
              channel is automatically archived from start to finish — no action
              needed once it's enabled. When <strong>off</strong>, that specific
              channel stops recording without affecting any other channel in
              your organization.
            </p>
            <p>
              <em>
                This requires a plan that includes recording. On the Essential
                plan, this toggle is shown locked with an upgrade prompt —
                recording simply isn't available on that tier.
              </em>
            </p>

            <h3>5.2 Manual recording (mid-broadcast clips)</h3>
            <p>
              For recording only <em>part</em> of a live broadcast — a specific
              segment, not the whole thing. Found on the Channels page, only
              visible while a channel is actually live and your plan includes
              recording.
            </p>
            <ul>
              <li>Click Start Recording to begin capturing from that moment</li>
              <li>
                A live elapsed-time counter shows how long the clip has been
                running
              </li>
              <li>
                Click Stop to end it — the clip is then converted, thumbnailed,
                and archived automatically, appearing in your Recordings list
                within moments
              </li>
            </ul>
            <p>
              Manual clips are stored in Bunny Storage under a distinct{" "}
              <code>
                manual recording/{"{channel}"}/{"{year}"}/{"{month}"}/{"{day}"}/
              </code>{" "}
              folder path, separate from your regular auto-archived recordings —
              makes them easy to find and manage independently.
            </p>

            <h3>5.3 Where recordings actually live</h3>
            <p>
              Recordings are only ever held temporarily on the server long
              enough to convert and upload them. Once processed, they're
              archived to Bunny Storage and the local copy is deleted — nothing
              accumulates on the streaming server itself.
            </p>
          </Section>

          <Section id="file-broadcast" title="6. File Broadcast">
            <p>
              Stream a previously-recorded video out through the live pipeline
              as if it were happening right now — useful for repeat airings,
              time-zone rebroadcasts, or filling a scheduled slot with
              pre-recorded content.
            </p>
            <p>
              Go to <strong>File Broadcast</strong>, pick a channel and an
              existing recording, optionally enable{" "}
              <strong>Loop continuously</strong> (repeats until manually
              stopped; off means it ends automatically when the file finishes),
              then click <strong>Start Broadcast</strong>.
            </p>
            <Screenshot
              label="File Broadcast page with channel/recording selectors and Start Broadcast button"
              src={fileBroadcastImg}
            />
            <p>
              Once running, it behaves exactly like a real broadcast — it
              appears in Live Monitor, gets transcoded normally, and plays on
              the public watch page like any other stream. Click{" "}
              <strong>Stop Broadcast</strong> to end it early at any time.
            </p>
            <p>
              <em>
                A file broadcast will refuse to start if the channel already has
                a real broadcast live, to avoid two sources competing for the
                same channel.
              </em>
            </p>
          </Section>

          <Section id="scheduled-streams" title="7. Scheduled Streams">
            <p>
              Plan broadcasts in advance so they show up on your public-facing
              schedule ahead of time, giving viewers a heads-up before you go
              live.
            </p>
            <Screenshot
              label="Create Schedule form"
              src={scheduledStreamsImg}
            />
          </Section>

          <Section id="social" title="8. Social Publishing (Simulcasting)">
            <p>
              Each channel can simultaneously push its broadcast out to
              Facebook, YouTube, and Instagram at the same time you're live on
              NLM Stream.
            </p>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>How it connects</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Facebook</strong>
                  </td>
                  <td>
                    Click Connect Facebook — creates a fresh Facebook broadcast
                    automatically every time you go live, no manual key needed
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>YouTube</strong>
                  </td>
                  <td>
                    Click Connect YouTube — same one-click automated flow as
                    Facebook
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Instagram</strong>
                  </td>
                  <td>
                    <strong>Manual key only.</strong> Instagram doesn't offer
                    the same one-click "connect" option Facebook/ YouTube do —
                    generate a fresh Stream Key from Instagram's own Live
                    Producer right before each broadcast and paste it into the
                    Instagram field here
                  </td>
                </tr>
              </tbody>
            </table>
            <Screenshot
              label="Social Publishing section with Facebook/YouTube/Instagram rows"
              src={socialPublishingImg}
            />
            <p>
              For Facebook/YouTube, once connected you'll see Go Live / End Live
              controls tied to your broadcast. For Instagram (or
              Facebook/YouTube used in manual mode instead), paste the stream
              key and use Start / Stop.
            </p>
          </Section>

          <Section id="analytics" title="9. Analytics">
            <p>
              Real-time and historical viewer data per channel — active viewers,
              session counts, watch time, device/browser breakdown, geographic
              distribution, and stream performance comparisons across channels.
              Data updates live while a stream is running.
            </p>
            <Screenshot label="Analytics page with charts" src={analyticsImg} />
          </Section>

          <Section id="plans" title="10. Subscription & Plans">
            <table className="hc-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Essential</th>
                  <th>Deluxe</th>
                  <th>Premium</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Channels</td>
                  <td>1</td>
                  <td>3</td>
                  <td>5</td>
                </tr>
                <tr>
                  <td>Storage</td>
                  <td>0GB</td>
                  <td>50GB</td>
                  <td>100GB</td>
                </tr>
                <tr>
                  <td>CDN Bandwidth</td>
                  <td>250GB</td>
                  <td>500GB</td>
                  <td>1000GB</td>
                </tr>
                <tr>
                  <td>Recording</td>
                  <td>❌</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>30-minute Rewind</td>
                  <td>❌</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Reduced Latency</td>
                  <td>❌</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>TV Channel</td>
                  <td>❌</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Max Bitrate</td>
                  <td>4Mb</td>
                  <td>10Mb</td>
                  <td>15Mb</td>
                </tr>
                <tr>
                  <td>Support</td>
                  <td>Standard</td>
                  <td>Standard</td>
                  <td>Priority</td>
                </tr>
              </tbody>
            </table>
            <p>
              If your organization exceeds its storage allowance, you'll receive
              an email notice at 80% usage (an early heads-up) and another at
              100%+ (confirming you're now in overage).{" "}
              <strong>
                Recordings are never blocked or deleted for being over quota
              </strong>{" "}
              — overage is simply tracked and billed separately later. Check
              Subscription for your current plan and usage.
            </p>
          </Section>

          <Section id="api-keys" title="11. API Keys">
            <p>
              Read-only programmatic access to your streams, recordings, and
              analytics — for pulling data into your own systems (a church
              management system, a custom dashboard, etc.) rather than only
              through this web dashboard.
            </p>

            <h3>Creating a key</h3>
            <p>
              Go to <strong>API Keys</strong>, give it a label describing what
              it's for, and click <strong>Generate Key</strong>.{" "}
              <strong>
                The full key is only ever shown once, immediately after creation
              </strong>{" "}
              — copy it right away. If you lose it, revoke it and generate a new
              one; there's no way to view a key again after leaving the page.
            </p>
            <Screenshot label="API Keys page" src={apiKeysImg} />

            <h3>Using a key</h3>
            <p>Send it as a bearer token on every request:</p>
            <code className="hc-code-block">
              Authorization: Bearer nlmapi_your_key_here
            </code>

            <h3>Available endpoints</h3>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Returns</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>GET /api/v1/streams</code>
                  </td>
                  <td>List all your channels</td>
                </tr>
                <tr>
                  <td>
                    <code>GET /api/v1/streams/:id</code>
                  </td>
                  <td>Detail for a single channel</td>
                </tr>
                <tr>
                  <td>
                    <code>GET /api/v1/recordings</code>
                  </td>
                  <td>List your recordings</td>
                </tr>
                <tr>
                  <td>
                    <code>GET /api/v1/recordings/:id</code>
                  </td>
                  <td>Detail for a single recording</td>
                </tr>
                <tr>
                  <td>
                    <code>GET /api/v1/analytics/:streamId</code>
                  </td>
                  <td>Viewer stats for a channel</td>
                </tr>
              </tbody>
            </table>
            <p>
              All requests are rate-limited to 300 per minute per key. Revoking
              a key takes effect immediately — any requests using it will start
              failing right away.
            </p>
          </Section>

          <Section id="status" title="12. System Status">
            <p>
              A public status page at <Link to="/status">/status</Link> shows a
              simple "All Systems Operational / Degraded / Outage" view per
              category — no login required — meant for clients or prospective
              clients checking whether an issue is platform-wide.
            </p>
            <Screenshot label="Public /status page" />
            <p>
              <em>
                A more detailed version, with real latency numbers for every
                underlying service, is available to super admins — see the{" "}
                <Link to="/help/super-admin-guide">Super Admin Guide</Link>.
              </em>
            </p>
          </Section>

          <Section
            id="quick-reference"
            title="Quick Reference: Where Things Live"
          >
            <table className="hc-table">
              <tbody>
                <tr>
                  <td>Get my stream key</td>
                  <td>Channels</td>
                </tr>
                <tr>
                  <td>See who's watching right now</td>
                  <td>Live Monitor</td>
                </tr>
                <tr>
                  <td>Turn recording on/off for a channel</td>
                  <td>Channels → Record all incoming streams toggle</td>
                </tr>
                <tr>
                  <td>Record just part of today's broadcast</td>
                  <td>Channels → Manual Recording (while live)</td>
                </tr>
                <tr>
                  <td>Re-air a past service</td>
                  <td>File Broadcast</td>
                </tr>
                <tr>
                  <td>Push my stream to Facebook/YouTube/Instagram</td>
                  <td>Channels → Social Publishing</td>
                </tr>
                <tr>
                  <td>Check viewer numbers over time</td>
                  <td>Analytics</td>
                </tr>
                <tr>
                  <td>See my plan and usage</td>
                  <td>Subscription</td>
                </tr>
                <tr>
                  <td>Pull my data into another system</td>
                  <td>API Keys</td>
                </tr>
                <tr>
                  <td>Check if there's a platform-wide issue</td>
                  <td>
                    <Link to="/status">/status</Link> (public) or System Status
                    (super_admin)
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <div className="hc-footer-links">
            <Link to="/help">← Back to Help Center</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default AdminGuidePage;
