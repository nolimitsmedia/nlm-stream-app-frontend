import { Link } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import Footer from "./Footer";

const GUIDES = [
  {
    slug: "admin-guide",
    title: "Admin Guide",
    description:
      "Everything an admin needs — channels, going live, recording, social publishing, analytics, API access, and more.",
    available: true,
  },
  {
    slug: "obs-setup",
    title: "OBS Setup Guide",
    description: "Configuring OBS Studio to broadcast to your channel.",
    available: true,
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting Guide",
    description: "Common issues and how to resolve them.",
    available: true,
  },
];

function HelpCenterPage() {
  return (
    <div className="hc-page">
      <PublicHeader />

      <main className="hc-main">
        <div className="hc-container">
          <header className="hc-hero">
            <span className="hc-eyebrow">Help Center</span>
            <h1>How can we help?</h1>
            <p className="hc-intro">
              Guides for getting the most out of NLM Streaming Cloud — whether
              you're setting up your first channel or looking up a specific
              feature.
            </p>
          </header>

          <div className="hc-guide-grid">
            {GUIDES.map((guide) =>
              guide.available ? (
                <Link
                  key={guide.slug}
                  to={`/help/${guide.slug}`}
                  className="hc-guide-card"
                >
                  <h2>{guide.title}</h2>
                  <p>{guide.description}</p>
                  <span className="hc-guide-card-cta">Read guide →</span>
                </Link>
              ) : (
                <div
                  key={guide.slug}
                  className="hc-guide-card hc-guide-card--soon"
                >
                  <span className="hc-coming-soon">Coming soon</span>
                  <h2>{guide.title}</h2>
                  <p>{guide.description}</p>
                </div>
              ),
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default HelpCenterPage;
