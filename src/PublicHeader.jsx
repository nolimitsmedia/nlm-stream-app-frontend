import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import logo from "./assets/nlm-logo.png";

function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const closeMenu = () => setOpen(false);

  // Shrink + glow border once user scrolls past the hero
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`public-header${scrolled ? " public-header--scrolled" : ""}`}
    >
      <Link to="/home" className="public-brand" onClick={closeMenu}>
        <img src={logo} alt="NLM Stream" className="public-logo" />
      </Link>

      {/* Hamburger — mobile only */}
      <button
        className={`public-menu-toggle${open ? " is-open" : ""}`}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`public-nav${open ? " is-open" : ""}`}>
        <NavLink to="/home" onClick={closeMenu}>
          Home
        </NavLink>
        <NavLink to="/pricing" onClick={closeMenu}>
          Pricing
        </NavLink>
        <NavLink to="/help" onClick={closeMenu}>
          Help
        </NavLink>
        <NavLink to="/login" onClick={closeMenu}>
          Login
        </NavLink>

        <Link to="/signup" className="public-nav-cta" onClick={closeMenu}>
          {/* pulsing live dot for extra brand energy */}
          <span className="ph-cta-dot" />
          Create Account
        </Link>
      </nav>
    </header>
  );
}

export default PublicHeader;
