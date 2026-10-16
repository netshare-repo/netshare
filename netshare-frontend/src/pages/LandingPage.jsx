import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authState";
import {
  Globe,
  Terminal,
  Activity,
  ShieldCheck,
  Check,
  Copy,
  ChevronDown,
  ArrowRight,
  Menu,
  X,
  Play,
  RotateCcw,
  Smartphone,
  Gauge,
  Sliders,
  Database
} from "lucide-react";
import "./LandingPage.css";

const marqueeItems = [
  "Regional Accessibility",
  "Website Performance",
  "Localization Testing",
  "Residential Node Execution",
  "Real HTTP Measurements",
  "Distributed Network Testing",
  "Node Participation",
  "Usage and Rewards"
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Navigation states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Interactive Code & Demo states
  const [activeTab, setActiveTab] = useState("submit");
  const [isSimulating, setIsSimulating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Terminal Execution Monitor state (live feed simulation)
  const [feedItems, setFeedItems] = useState([
    {
      id: 1,
      time: "03:41:12",
      method: "GET",
      url: "https://api.github.com/status",
      region: "US-WEST",
      status: 200,
      latency: 142,
      bytes: "1.8 KB"
    },
    {
      id: 2,
      time: "03:41:09",
      method: "GET",
      url: "https://stripe.com/checkout",
      region: "EU-CENTRAL",
      status: 200,
      latency: 218,
      bytes: "4.2 KB"
    },
    {
      id: 3,
      time: "03:41:05",
      method: "GET",
      url: "https://shopify.com/store/pricing",
      region: "APAC-EAST",
      status: 200,
      latency: 310,
      bytes: "6.1 KB"
    },
    {
      id: 4,
      time: "03:41:01",
      method: "GET",
      url: "https://news.ycombinator.com",
      region: "US-EAST",
      status: 200,
      latency: 104,
      bytes: "12.4 KB"
    },
    {
      id: 5,
      time: "03:40:57",
      method: "GET",
      url: "https://cloudflare.com/cdn-cgi/trace",
      region: "LATAM-SOUTH",
      status: 200,
      latency: 188,
      bytes: "0.8 KB"
    }
  ]);

  // Periodic subtle feed updater for terminal monitor
  useEffect(() => {
    const candidateTasks = [
      { method: "GET", url: "https://weather.gov/alerts", region: "US-CENTRAL", status: 200, latency: 122, bytes: "2.4 KB" },
      { method: "GET", url: "https://wikipedia.org/wiki/Latency", region: "EU-WEST", status: 200, latency: 165, bytes: "8.3 KB" },
      { method: "GET", url: "https://pricing.datadoghq.com", region: "APAC-SOUTH", status: 200, latency: 284, bytes: "5.1 KB" },
      { method: "GET", url: "https://bbc.co.uk/news", region: "GB-LONDON", status: 200, latency: 139, bytes: "14.6 KB" },
      { method: "GET", url: "https://status.openai.com", region: "US-EAST", status: 200, latency: 118, bytes: "1.9 KB" }
    ];

    let candidateIdx = 0;
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];
      const template = candidateTasks[candidateIdx % candidateTasks.length];
      candidateIdx++;

      setFeedItems((prev) => [
        {
          id: Date.now(),
          time: timeStr,
          ...template,
          latency: template.latency + Math.floor(Math.random() * 25 - 12)
        },
        ...prev.slice(0, 5)
      ]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Reveal major content as it enters the viewport, with a short stagger for card grids.
  useEffect(() => {
    const revealSelector = [
      ".nh-section-header",
      ".nh-console-card",
      ".nh-network-bento > *",
      ".nh-product-card",
      ".nh-terminal-window",
      ".nh-pathway-card",
      ".nh-pricing-card",
      ".nh-faq-item",
      ".nh-cta-container"
    ].join(",");
    const targets = document.querySelectorAll(revealSelector);
    const landing = document.querySelector(".nh-landing");

    targets.forEach((target) => target.classList.add("nh-scroll-reveal"));

    if (!("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-visible"));
      landing?.classList.add("nh-scroll-ready");
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -48px 0px"
    });

    targets.forEach((target) => {
      const siblings = Array.from(target.parentElement.children).filter((item) => item.matches(revealSelector));
      const index = siblings.indexOf(target);
      target.style.setProperty("--nh-reveal-delay", `${Math.max(0, Math.min(index, 4) * 85)}ms`);
      observer.observe(target);
    });

    landing?.classList.add("nh-scroll-ready");
    return () => observer.disconnect();
  }, []);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(0); // first item open by default

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleStartSim = () => {
    if (isSimulating) return;
    setIsSimulating(true);

    setTimeout(() => {
      setActiveTab("assign");
    }, 800);

    setTimeout(() => {
      setActiveTab("exec");
    }, 1700);

    setTimeout(() => {
      setActiveTab("results");
      setIsSimulating(false);
    }, 2600);
  };

  const handleCopyCode = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleScroll = (id) => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleAuthRedirect = (role = "client") => {
    if (user) {
      if (user.role === "admin") navigate("/admin/dashboard");
      else if (user.role === "node") navigate("/node/dashboard");
      else navigate("/client/dashboard");
    } else {
      navigate(role === "node" ? "/register?role=node" : "/register?role=client");
    }
  };

  // Demo step contents
  const demoSnippets = {
    submit: {
      lang: "HTTP / REST Client",
      code: `POST /api/tasks/create HTTP/1.1
Host: api.netshare.network
Authorization: Bearer ns_live_79a24e9bc3...
Content-Type: application/json

{
  "target_url": "https://example.com/checkout",
  "method": "GET",
  "target_region": "US-WEST",
  "timeout_ms": 5000,
  "verify_tls": true
}`
    },
    assign: {
      lang: "Coordinator Signaling Event",
      code: `[13:41:04.219] COORD: Inbound client task #TK-88219 validated.
[13:41:04.238] MATCH: Searching eligible Android nodes in region US-WEST...
[13:41:04.282] FOUND: Node #ND-408 (Carrier: Residential Fiber / ASN 7018)
[13:41:04.301] SIGNAL: Exchanging WebRTC SDP offer & ICE candidates...
[13:41:04.345] READY: P2P DataChannel established [crypto: DTLS-SRTP]`
    },
    exec: {
      lang: "Isolated Node Telemetry",
      code: `>>> CONNECT webrtc://datachannel.node-408.internal
>>> DISPATCH GET https://example.com/checkout
>>> DNS_RESOLVE: 93.184.216.34 (14ms)
>>> TCP_CONNECT: Handshake ACK (28ms)
>>> TLS_INIT: TLSv1.3 ECDHE-RSA-AES128-GCM-SHA256 (42ms)
>>> HTTP_GET: Sent HTTP/1.1 Header
>>> TTFB_RECEIVE: Time to first byte 114ms
>>> STREAM_BODY: 4,192 bytes payload buffered
>>> ENCRYPT & RELAY -> verified coordinator result`
    },
    results: {
      lang: "Verified Output (JSON)",
      code: `{
  "task_id": "TK-88219",
  "status": "COMPLETED",
  "http_status": 200,
  "latency_ms": 198,
  "ttfb_ms": 114,
  "payload_bytes": 4192,
  "node_region": "US-WEST",
  "isp_tier": "Residential",
  "content_type": "text/html; charset=utf-8",
  "content_language": "en-US",
  "signature": "ed25519:9f8b431c...verified"
}`
    }
  };

  // 9 Required FAQs
  const faqs = [
    {
      q: "What is NetShare?",
      a: "NetShare is a distributed network intelligence platform that enables authorized website testing, regional reachability verification, and performance measurement through participating Android devices operating on genuine residential connections."
    },
    {
      q: "How does regional testing work?",
      a: "Clients submit a target URL and select a desired geographic region. NetShare's coordination server authorizes the request and assigns an eligible, active Android node in that region. A secure WebRTC DataChannel connection executes the authorized HTTP GET test, and telemetry (status, latency, headers, payload size) is securely returned to the client."
    },
    {
      q: "Who executes a client's task?",
      a: "Tasks are executed exclusively by opt-in Android mobile nodes whose operators have installed the NetShare client, agreed to transparent terms, and activated a session with strict bandwidth and device safety thresholds."
    },
    {
      q: "What results will I receive?",
      a: "You receive verified HTTP telemetry including final status codes, redirect chains, Time-to-First-Byte (TTFB) latency, total response time, transferred byte sizes, Content-Type and Content-Language headers, and regional DNS resolution metrics."
    },
    {
      q: "How are credits calculated?",
      a: "NetShare operates on a server-controlled credit model. Task pricing is predictable and held in escrow upon task submission. Credits are debited solely when a task is successfully executed and verified. Node participants earn platform credits credited to their account wallet for valid executions."
    },
    {
      q: "How can I participate as a node?",
      a: "You can download the NetShare Android client, create a Node Participant account, pair your device, and start a sharing session. The client runs quietly in the background, only routing approved testing tasks when your specified conditions are met."
    },
    {
      q: "Can node participants control bandwidth?",
      a: "Yes. Node participants have absolute sovereign control. You can configure daily data transfer caps, bandwidth speed throttles, Wi-Fi-only execution, require AC charging before accepting tasks, and pause or stop participation at any time with a single tap."
    },
    {
      q: "What happens if a task fails?",
      a: "If an assigned node loses connectivity or exceeds the execution timeout, the task is automatically reassigned to another verified node in the same region without charging extra credits. If no replacement node is available within the window, your escrowed credits are refunded immediately."
    },
    {
      q: "Is NetShare an unrestricted VPN or proxy?",
      a: "No. NetShare is strictly NOT an open proxy or unrestricted VPN. We do not provide arbitrary SOCKS5 browsing tunnels or anonymous routing. NetShare coordinates single-request, authorized HTTP/HTTPS testing tasks specifically designed for availability monitoring, localization auditing, and network performance."
    }
  ];

  return (
    <div className="nh-landing">
      {/* =========================================================================
          SECTION 1 — Premium Sticky Navigation
          ========================================================================= */}
      <header className="nh-navbar-wrapper">
        <nav className="nh-navbar">
          {/* Logo */}
          <Link to="/" className="nh-logo">
            <span className="nh-logo-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#00E5FF" strokeWidth="1.5" strokeOpacity="0.4" />
                <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="4" fill="#00E5FF" />
                <path d="M12 4V8M12 16V20M4 12H8M16 12H20" stroke="#9D4EDD" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="nh-logo-text">NetShare</span>
          </Link>

          {/* Desktop Nav Items */}
          <div className="nh-nav-links">
            {/* Platform Dropdown */}
            <div
              className={`nh-nav-item has-dropdown ${activeDropdown === "platform" ? "is-active" : ""}`}
              onMouseEnter={() => setActiveDropdown("platform")}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button className="nh-nav-link-btn" onClick={() => handleScroll("features")}>
                Platform <ChevronDown size={14} className="nh-chevron" />
              </button>
              {activeDropdown === "platform" && (
                <div className="nh-dropdown-menu">
                  <a href="#features" onClick={(e) => { e.preventDefault(); handleScroll("features"); }} className="nh-dropdown-row">
                    <Activity size={16} className="nh-dd-icon text-cyan" />
                    <div>
                      <div className="nh-dd-title">Regional Accessibility</div>
                      <div className="nh-dd-sub">Real HTTP status and CDN reachability</div>
                    </div>
                  </a>
                  <a href="#features" onClick={(e) => { e.preventDefault(); handleScroll("features"); }} className="nh-dropdown-row">
                    <Gauge size={16} className="nh-dd-icon text-purple" />
                    <div>
                      <div className="nh-dd-title">Performance Testing</div>
                      <div className="nh-dd-sub">Response latency (TTFB) and packet timing</div>
                    </div>
                  </a>
                  <a href="#features" onClick={(e) => { e.preventDefault(); handleScroll("features"); }} className="nh-dropdown-row">
                    <Globe size={16} className="nh-dd-icon text-emerald" />
                    <div>
                      <div className="nh-dd-title">Localization QA</div>
                      <div className="nh-dd-sub">Region-based Content-Language checks</div>
                    </div>
                  </a>
                  <a href="#demo" onClick={(e) => { e.preventDefault(); handleScroll("demo"); }} className="nh-dropdown-row">
                    <Terminal size={16} className="nh-dd-icon text-slate" />
                    <div>
                      <div className="nh-dd-title">Execution Engine</div>
                      <div className="nh-dd-sub">WebRTC DataChannel telemetry pipeline</div>
                    </div>
                  </a>
                </div>
              )}
            </div>

            <a href="#demo" onClick={(e) => { e.preventDefault(); handleScroll("demo"); }} className="nh-nav-link">
              How It Works
            </a>

            <a href="#clients" onClick={(e) => { e.preventDefault(); handleScroll("clients"); }} className="nh-nav-link">
              For Clients
            </a>

            <a href="#nodes" onClick={(e) => { e.preventDefault(); handleScroll("nodes"); }} className="nh-nav-link">
              For Nodes
            </a>

            <a href="#pricing" onClick={(e) => { e.preventDefault(); handleScroll("pricing"); }} className="nh-nav-link">
              Pricing
            </a>

            {/* Resources Dropdown */}
            <div
              className={`nh-nav-item has-dropdown ${activeDropdown === "resources" ? "is-active" : ""}`}
              onMouseEnter={() => setActiveDropdown("resources")}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button className="nh-nav-link-btn" onClick={() => handleScroll("faq")}>
                Resources <ChevronDown size={14} className="nh-chevron" />
              </button>
              {activeDropdown === "resources" && (
                <div className="nh-dropdown-menu">
                  <a href="#monitor" onClick={(e) => { e.preventDefault(); handleScroll("monitor"); }} className="nh-dropdown-row">
                    <Activity size={16} className="nh-dd-icon text-cyan" />
                    <div>
                      <div className="nh-dd-title">Live Execution Monitor</div>
                      <div className="nh-dd-sub">Simulated distributed network flow</div>
                    </div>
                  </a>
                  <a href="#faq" onClick={(e) => { e.preventDefault(); handleScroll("faq"); }} className="nh-dropdown-row">
                    <ShieldCheck size={16} className="nh-dd-icon text-purple" />
                    <div>
                      <div className="nh-dd-title">Architecture FAQ</div>
                      <div className="nh-dd-sub">Answers on security, bandwidth and tasks</div>
                    </div>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Nav Actions */}
          <div className="nh-nav-actions">
            {/* System indicator */}
            <div className="nh-status-pill" title="Coordinator online">
              <span className="nh-status-dot"></span>
              <span className="nh-status-text">Network Active</span>
            </div>

            {user ? (
              <button
                onClick={() => handleAuthRedirect(user.role)}
                className="nh-btn-pill-white"
              >
                Dashboard
              </button>
            ) : (
              <>
                <Link to="/login" className="nh-nav-login">
                  Log in
                </Link>
                <Link to="/register" className="nh-btn-pill-white">
                  Sign up
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            <button
              className="nh-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="nh-mobile-navigation"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="nh-mobile-drawer" id="nh-mobile-navigation">
            <div className="nh-mobile-links">
              <a href="#features" onClick={() => handleScroll("features")}>Platform Features</a>
              <a href="#demo" onClick={() => handleScroll("demo")}>How It Works</a>
              <a href="#clients" onClick={() => handleScroll("clients")}>For Platform Clients</a>
              <a href="#nodes" onClick={() => handleScroll("nodes")}>For Node Participants</a>
              <a href="#pricing" onClick={() => handleScroll("pricing")}>Pricing & Credits</a>
              <a href="#faq" onClick={() => handleScroll("faq")}>FAQ</a>
            </div>
            <div className="nh-mobile-actions">
              {user ? (
                <button onClick={() => handleAuthRedirect(user.role)} className="nh-btn-pill-white w-full">
                  Go to Dashboard
                </button>
              ) : (
                <div className="nh-mobile-btn-group">
                  <Link to="/login" className="nh-btn-pill-dark w-full text-center">Log in</Link>
                  <Link to="/register" className="nh-btn-pill-white w-full text-center">Create account</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          SECTION 2 — Signature Editorial Hero
          ========================================================================= */}
      <section className="nh-hero-section">
        <div className="nh-hero-container">
          {/* Left Column: Editorial Headline & Actions */}
          <div className="nh-hero-content">
            {/* Announcement badge */}
            <button className="nh-hero-badge" onClick={() => handleScroll("demo")}>
              <span className="nh-badge-indicator"></span>
              <span className="nh-badge-mono">Website testing through real regional connections</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>

            {/* Oversized editorial serif heading */}
            <h1 className="nh-hero-headline">
              <span className="nh-hero-line-upright">Real networks.</span>
              <span className="nh-hero-line-italic">Real results.</span>
            </h1>

            {/* Supporting description */}
            <p className="nh-hero-desc">
              Run authorized website tests through participating devices in selected regions.
              Measure real-world accessibility, performance, and localization from the networks
              your users rely on.
            </p>

            {/* CTA Buttons */}
            <div className="nh-hero-actions">
              <button
                onClick={() => handleAuthRedirect("client")}
                className="nh-btn-pill-white"
              >
                Start Testing
              </button>
              <button
                onClick={() => handleAuthRedirect("node")}
                className="nh-btn-pill-dark"
              >
                <span>Become a Node</span>
                <ArrowRight size={14} className="nh-btn-arrow" />
              </button>
            </div>

            {/* Capability / Trust Checklist */}
            <div className="nh-hero-trust-row">
              <div className="nh-trust-item">
                <Check size={14} className="nh-trust-check" />
                <span>Residential node execution</span>
              </div>
              <div className="nh-trust-item">
                <Check size={14} className="nh-trust-check" />
                <span>Real HTTP measurements</span>
              </div>
              <div className="nh-trust-item">
                <Check size={14} className="nh-trust-check" />
                <span>Server-controlled credits</span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Contrast 3D Topographic Sculpted Globe */}
          <div className="nh-hero-visual-wrapper">
            <div className="nh-globe-container" aria-label="3D Topographic Network Globe">
              <div className="nh-globe-ambient-glow"></div>
              <div className="nh-globe-artwork-frame">
                <img
                  src="/netshare-hero-network.png"
                  alt="Three connected glowing regional network globes around a central node"
                  className="nh-globe-render-img"
                  loading="eager"
                  decoding="async"
                />

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3 — Infinite Use-Case Marquee
          ========================================================================= */}
      <section className="nh-marquee-section">
        <p className="nh-marquee-label">What teams run through the network</p>
        <div className="nh-marquee-viewport">
          <div className="nh-marquee-track">
            <div className="nh-marquee-group">
              {marqueeItems.map((item) => <span className="nh-marquee-item" key={item}>{item}</span>)}
            </div>
            {/* Duplicate group for seamless infinite CSS loop */}
            <div className="nh-marquee-group" aria-hidden="true">
              {marqueeItems.map((item) => <span className="nh-marquee-item" key={item}>{item}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4 — Interactive Execution Demonstration
          ========================================================================= */}
      <section id="demo" className="nh-demo-section">
        <div className="nh-container">
          <div className="nh-section-header">
            <span className="nh-eyebrow">DISTRIBUTED TASK LIFECYCLE</span>
            <h2 className="nh-section-title">
              One request.
              <br />
              <span className="text-gradient">Real regional insight.</span>
            </h2>
            <p className="nh-section-desc">
              Keep the scraper, headless browser or HTTP client you already have. Submit an authorized
              task and receive verified telemetry directly from real devices.
            </p>
          </div>

          {/* Interactive Console Window */}
          <div className="nh-console-card">
            {/* Console Window Topbar */}
            <div className="nh-console-topbar">
              <div className="nh-window-dots">
                <span className="nh-dot red"></span>
                <span className="nh-dot yellow"></span>
                <span className="nh-dot green"></span>
              </div>

              {/* Step Navigation Tabs */}
              <div className="nh-console-tabs">
                <button
                  className={`nh-tab-btn ${activeTab === "submit" ? "active" : ""}`}
                  onClick={() => setActiveTab("submit")}
                >
                  <span className="nh-tab-step">1</span>
                  <span>Submit Task</span>
                </button>
                <button
                  className={`nh-tab-btn ${activeTab === "assign" ? "active" : ""}`}
                  onClick={() => setActiveTab("assign")}
                >
                  <span className="nh-tab-step">2</span>
                  <span>Node Assignment</span>
                </button>
                <button
                  className={`nh-tab-btn ${activeTab === "exec" ? "active" : ""}`}
                  onClick={() => setActiveTab("exec")}
                >
                  <span className="nh-tab-step">3</span>
                  <span>Secure Execution</span>
                </button>
                <button
                  className={`nh-tab-btn ${activeTab === "results" ? "active" : ""}`}
                  onClick={() => setActiveTab("results")}
                >
                  <span className="nh-tab-step">4</span>
                  <span>Verified Results</span>
                </button>
              </div>

              {/* Action Controls */}
              <div className="nh-console-actions">
                <span className="nh-badge-pill-outline">Illustrative demo</span>
                <button
                  onClick={handleStartSim}
                  disabled={isSimulating}
                  className="nh-btn-run"
                  title="Run interactive simulation"
                >
                  {isSimulating ? (
                    <>
                      <RotateCcw size={13} className="nh-spinner" />
                      <span>Simulating...</span>
                    </>
                  ) : (
                    <>
                      <Play size={13} />
                      <span>Simulate Lifecycle</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Console Subheader Info */}
            <div className="nh-console-subbar">
              <span className="nh-subbar-lang">{demoSnippets[activeTab].lang}</span>
              <button
                className="nh-copy-btn"
                onClick={() => handleCopyCode(demoSnippets[activeTab].code)}
              >
                {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedCode ? "Copied" : "Copy"}</span>
              </button>
            </div>

            {/* Code Body Area */}
            <div className="nh-code-viewport">
              <pre className="nh-code-pre">
                <code>{demoSnippets[activeTab].code}</code>
              </pre>
            </div>

            {/* Console Footer Status */}
            <div className="nh-console-statusbar">
              <div className="nh-status-left">
                <span className="nh-led-dot"></span>
                <span>WebRTC DataChannel · DTLS-SRTP · Isolated Android Sandbox</span>
              </div>
              <div className="nh-status-right">
                <span>Phase: {activeTab.toUpperCase()}</span>
                <span className="nh-bar-sep">|</span>
                <span>Credit Escrow: 1.0</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5 — Network Overview and Metrics Bento
          ========================================================================= */}
      <section className="nh-network-section">
        <div className="nh-container">
          <div className="nh-section-header text-left">
            <span className="nh-eyebrow">GLOBAL PRESENCE</span>
            <h2 className="nh-section-title">
              Verified residential testing.
              <br />
              <span className="text-gradient">Engineered for real-world telemetry.</span>
            </h2>
          </div>

          <div className="nh-network-bento">
            {/* Left Card: Dark World Map Surface */}
            <div className="nh-bento-card-large">
              <div className="nh-map-header">
                <div>
                  <h3 className="nh-bento-title">Distributed Node Routing</h3>
                  <p className="nh-bento-sub">Regional clusters pairing verified mobile participants.</p>
                </div>
                <span className="nh-status-pill">
                  <span className="nh-status-dot"></span>
                  Active Signaling Mesh
                </span>
              </div>

              {/* Map Illustration Area */}
              <div className="nh-world-map-svg-wrap">
                <svg viewBox="0 0 760 380" className="nh-world-map-svg" fill="none">
                  {/* Subtle Grid Backdrop */}
                  <pattern id="mapGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#222222" strokeWidth="0.5" />
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#mapGrid)" opacity="0.4" />

                  {/* World Map Stylized Landmass Vector Silhouettes */}
                  {/* North America */}
                  <path
                    d="M120 70 Q160 60 210 90 Q240 130 200 170 Q170 190 140 160 Q110 120 120 70 Z"
                    fill="#0E0E0E"
                    stroke="#2A2A2A"
                    strokeWidth="1.2"
                  />
                  {/* South America */}
                  <path
                    d="M190 200 Q230 210 240 270 Q220 320 190 330 Q170 290 180 230 Z"
                    fill="#0E0E0E"
                    stroke="#2A2A2A"
                    strokeWidth="1.2"
                  />
                  {/* Europe */}
                  <path
                    d="M340 70 Q390 65 420 100 Q410 135 370 140 Q330 130 340 70 Z"
                    fill="#0E0E0E"
                    stroke="#2A2A2A"
                    strokeWidth="1.2"
                  />
                  {/* Africa */}
                  <path
                    d="M360 150 Q410 160 420 220 Q400 280 370 270 Q340 230 350 170 Z"
                    fill="#0E0E0E"
                    stroke="#2A2A2A"
                    strokeWidth="1.2"
                  />
                  {/* Asia */}
                  <path
                    d="M440 65 Q560 55 600 120 Q580 180 500 180 Q430 160 440 65 Z"
                    fill="#0E0E0E"
                    stroke="#2A2A2A"
                    strokeWidth="1.2"
                  />
                  {/* Australia */}
                  <path
                    d="M550 240 Q610 240 620 290 Q570 310 540 280 Z"
                    fill="#0E0E0E"
                    stroke="#2A2A2A"
                    strokeWidth="1.2"
                  />

                  {/* Connective Arcs */}
                  <path d="M180 120 C270 90 310 80 370 95" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.6" />
                  <path d="M370 95 C430 85 480 100 520 110" stroke="#9D4EDD" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.6" />
                  <path d="M180 120 C320 200 440 180 520 110" stroke="#00E5FF" strokeWidth="1.2" opacity="0.3" />

                  {/* Regional Node Clusters */}
                  {/* US-West */}
                  <g transform="translate(150, 110)">
                    <circle r="8" fill="#00E5FF" fillOpacity="0.2" className="nh-pulse-ring" />
                    <circle r="3.5" fill="#00E5FF" />
                    <text x="12" y="4" fill="#929298" fontSize="10" fontFamily="JetBrains Mono">US-WEST (114ms)</text>
                  </g>
                  {/* US-East */}
                  <g transform="translate(210, 125)">
                    <circle r="8" fill="#00E5FF" fillOpacity="0.2" className="nh-pulse-ring nh-pulse-delay-1" />
                    <circle r="3.5" fill="#00E5FF" />
                    <text x="12" y="4" fill="#929298" fontSize="10" fontFamily="JetBrains Mono">US-EAST (98ms)</text>
                  </g>
                  {/* EU-Central */}
                  <g transform="translate(385, 105)">
                    <circle r="9" fill="#9D4EDD" fillOpacity="0.2" className="nh-pulse-ring nh-pulse-delay-2" />
                    <circle r="3.5" fill="#9D4EDD" />
                    <text x="12" y="4" fill="#929298" fontSize="10" fontFamily="JetBrains Mono">EU-CENTRAL (142ms)</text>
                  </g>
                  {/* APAC-East */}
                  <g transform="translate(540, 120)">
                    <circle r="9" fill="#00E5FF" fillOpacity="0.2" className="nh-pulse-ring nh-pulse-delay-3" />
                    <circle r="3.5" fill="#00E5FF" />
                    <text x="12" y="4" fill="#929298" fontSize="10" fontFamily="JetBrains Mono">APAC-EAST (218ms)</text>
                  </g>
                  {/* LATAM */}
                  <g transform="translate(210, 260)">
                    <circle r="6" fill="#10B981" fillOpacity="0.2" />
                    <circle r="3" fill="#10B981" />
                    <text x="12" y="4" fill="#929298" fontSize="10" fontFamily="JetBrains Mono">SA-EAST (184ms)</text>
                  </g>
                </svg>
              </div>
            </div>

            {/* Right Column: 4 Capability Cards */}
            <div className="nh-bento-col-right">
              <div className="nh-bento-subcard">
                <div className="nh-subcard-icon text-cyan">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h4 className="nh-subcard-title">Residential Device Footprint</h4>
                  <p className="nh-subcard-desc">
                    Tasks execute on authentic mobile connections from verified Android node participants.
                  </p>
                </div>
              </div>

              <div className="nh-bento-subcard">
                <div className="nh-subcard-icon text-purple">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="nh-subcard-title">Direct WebRTC DataChannel</h4>
                  <p className="nh-subcard-desc">
                    Point-to-point encrypted communication with zero third-party proxy tampering or MITM.
                  </p>
                </div>
              </div>

              <div className="nh-bento-subcard">
                <div className="nh-subcard-icon text-emerald">
                  <Activity size={20} />
                </div>
                <div>
                  <h4 className="nh-subcard-title">Verified HTTP Telemetry</h4>
                  <p className="nh-subcard-desc">
                    Real status codes, time-to-first-byte (TTFB), and TLS handshakes returned securely.
                  </p>
                </div>
              </div>

              <div className="nh-bento-subcard">
                <div className="nh-subcard-icon text-slate">
                  <Database size={20} />
                </div>
                <div>
                  <h4 className="nh-subcard-title">Server-Controlled Credits</h4>
                  <p className="nh-subcard-desc">
                    Transparent task pricing governed by the platform coordinator with no hidden commitments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6 — Three Product / Service Cards with Topographic Sculptures
          ========================================================================= */}
      <section id="features" className="nh-products-section">
        <div className="nh-container">
          <div className="nh-section-header">
            <span className="nh-eyebrow">TESTING PRIMITIVES</span>
            <h2 className="nh-section-title">
              Three ways to understand the web.
            </h2>
            <p className="nh-section-desc">
              Engineered for reliability engineers, frontend platforms, and security operators
              who need ground-truth observation of external web availability.
            </p>
          </div>

          <div className="nh-products-grid">
            <article className="nh-product-card">
              <div className="nh-product-visual">
                <img src="/landing-regional-accessibility.png" alt="Isometric charcoal network map connecting homes to a regional testing point" loading="lazy" decoding="async" />
              </div>
              <div className="nh-product-body">
                <h3 className="nh-product-heading">Regional Accessibility</h3>
                <p className="nh-product-text">Check whether a website really loads from the region you choose. See HTTP status, DNS failures, and redirects through participating residential devices.</p>
                <ul className="nh-feature-list">
                  <li>HTTP status</li>
                  <li>Regional reachability</li>
                </ul>
                <a href="#demo" className="nh-product-link" onClick={(event) => { event.preventDefault(); handleScroll("demo"); }}>Explore <ArrowRight size={17} aria-hidden="true" /></a>
              </div>
            </article>

            <article className="nh-product-card">
              <div className="nh-product-visual">
                <img src="/landing-performance-testing.png" alt="Layered network terrain with cyan and violet performance paths" loading="lazy" decoding="async" />
              </div>
              <div className="nh-product-body">
                <h3 className="nh-product-heading">Performance Testing</h3>
                <p className="nh-product-text">Measure the response your users experience on real networks. Compare time to first byte, total latency, and transferred data across regions.</p>
                <ul className="nh-feature-list">
                  <li>TTFB and latency</li>
                  <li>Transfer size</li>
                </ul>
                <a href="#demo" className="nh-product-link" onClick={(event) => { event.preventDefault(); handleScroll("demo"); }}>Explore <ArrowRight size={17} aria-hidden="true" /></a>
              </div>
            </article>

            <article className="nh-product-card">
              <div className="nh-product-visual">
                <img src="/landing-localization-observations.png" alt="Dark world map connecting regions with localized language markers" loading="lazy" decoding="async" />
              </div>
              <div className="nh-product-body">
                <h3 className="nh-product-heading">Localization Observations</h3>
                <p className="nh-product-text">See how content changes by location. Check language headers, regional redirects, and localized assets from the connection your customers use.</p>
                <ul className="nh-feature-list">
                  <li>Content language</li>
                  <li>Regional content</li>
                </ul>
                <a href="#demo" className="nh-product-link" onClick={(event) => { event.preventDefault(); handleScroll("demo"); }}>Explore <ArrowRight size={17} aria-hidden="true" /></a>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7 — Network Execution Monitor (Terminal Feed)
          ========================================================================= */}
      <section id="monitor" className="nh-monitor-section">
        <div className="nh-container">
          <div className="nh-section-header">
            <span className="nh-eyebrow">DISTRIBUTED TELEMETRY STREAM</span>
            <h2 className="nh-section-title">
              One platform.
              <br />
              <span className="text-gradient">Distributed execution.</span>
            </h2>
            <p className="nh-section-desc">
              Watch testing tasks move across participating residential nodes in real time.
              Verified execution with no intermediary scraping proxies.
            </p>
          </div>

          {/* Terminal Console Card */}
          <div className="nh-terminal-window">
            <div className="nh-terminal-topbar">
              <div className="nh-window-dots">
                <span className="nh-dot red"></span>
                <span className="nh-dot yellow"></span>
                <span className="nh-dot green"></span>
              </div>
              <div className="nh-terminal-title">netshare-telemetry-feed — node-mesh-v2</div>
              <div className="nh-terminal-badge">Illustrative workflow</div>
            </div>

            {/* Terminal Table Header */}
            <div className="nh-terminal-table-head">
              <div className="col-time">TIME</div>
              <div className="col-method">METHOD</div>
              <div className="col-target">TARGET URL</div>
              <div className="col-region">REGION</div>
              <div className="col-status">STATUS</div>
              <div className="col-latency">LATENCY</div>
              <div className="col-bytes">PAYLOAD</div>
            </div>

            {/* Terminal Feed Rows */}
            <div className="nh-terminal-feed-rows">
              {feedItems.map((item) => (
                <div key={item.id} className="nh-terminal-row">
                  <div className="col-time nh-mono-text text-muted">{item.time}</div>
                  <div className="col-method">
                    <span className="nh-badge-method">{item.method}</span>
                  </div>
                  <div className="col-target nh-mono-text text-light">{item.url}</div>
                  <div className="col-region">
                    <span className="nh-badge-region">{item.region}</span>
                  </div>
                  <div className="col-status">
                    <span className="nh-badge-status-ok">{item.status} OK</span>
                  </div>
                  <div className="col-latency nh-mono-text text-cyan">{item.latency} ms</div>
                  <div className="col-bytes nh-mono-text text-muted">{item.bytes}</div>
                </div>
              ))}
            </div>

            {/* Terminal Footer */}
            <div className="nh-terminal-footer">
              <div className="nh-term-footer-left">
                <span className="nh-blink-cursor"></span>
                <span>Listening for authenticated DataChannel task completions...</span>
              </div>
              <div className="nh-term-footer-right">
                <span>Buffer: 6 events</span>
                <span className="nh-bar-sep">|</span>
                <span>Signaling: STUN/TURN Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 8 — Two Participation Pathways
          ========================================================================= */}
      <section id="pathways" className="nh-pathways-section">
        <div className="nh-container">
          <div className="nh-pathways-grid">
            {/* Left Card: For Platform Clients */}
            <div id="clients" className="nh-pathway-card">
              <div className="nh-pathway-header">
                <span className="nh-badge-mono">FOR PLATFORM CLIENTS</span>
                <h3 className="nh-pathway-title">Test from real networks.</h3>
                <p className="nh-pathway-desc">
                  Submit supported website tests through participating devices in targeted regions.
                  Audit genuine responses, monitor uptime, and verify localization with high precision.
                </p>
              </div>

              {/* Pathway Illustration */}
              <div className="nh-pathway-illustration">
                <svg viewBox="0 0 460 180" className="nh-pathway-svg" fill="none">
                  <rect x="20" y="30" width="120" height="120" rx="8" fill="#0D0D0D" stroke="#303030" strokeWidth="1" />
                  <text x="80" y="70" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="600">Client Portal</text>
                  <text x="80" y="90" textAnchor="middle" fill="#00E5FF" fontSize="10" fontFamily="JetBrains Mono">REST / SDK</text>
                  <circle cx="80" cy="115" r="4" fill="#00E5FF" />

                  {/* Connective pipeline */}
                  <path d="M140 90 L220 90" stroke="#00E5FF" strokeWidth="2" strokeDasharray="4 4" className="nh-route-path" />

                  <rect x="220" y="30" width="100" height="120" rx="8" fill="#101010" stroke="#353535" strokeWidth="1.2" />
                  <text x="270" y="70" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="600">Coordinator</text>
                  <text x="270" y="90" textAnchor="middle" fill="#9D4EDD" fontSize="10" fontFamily="JetBrains Mono">Escrow & Match</text>
                  <circle cx="270" cy="115" r="4" fill="#9D4EDD" />

                  <path d="M320 90 L380 90" stroke="#00E5FF" strokeWidth="2" strokeDasharray="4 4" className="nh-route-path nh-route-delay-1" />

                  <rect x="380" y="30" width="60" height="120" rx="8" fill="#0D0D0D" stroke="#303030" strokeWidth="1" />
                  <text x="410" y="80" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="600">Node</text>
                  <text x="410" y="100" textAnchor="middle" fill="#10B981" fontSize="9" fontFamily="JetBrains Mono">P2P</text>
                </svg>
              </div>

              <div className="nh-pathway-footer">
                <ul className="nh-pathway-points">
                  <li><Check size={14} className="text-cyan" /> Submit single-request HTTP tests with regional targeting</li>
                  <li><Check size={14} className="text-cyan" /> Monitor execution through real-time telemetry</li>
                  <li><Check size={14} className="text-cyan" /> Predictable credit deduction on verified success only</li>
                </ul>
                <button
                  onClick={() => handleAuthRedirect("client")}
                  className="nh-btn-pill-white w-full"
                >
                  Start Testing
                </button>
              </div>
            </div>

            {/* Right Card: For Node Participants */}
            <div id="nodes" className="nh-pathway-card">
              <div className="nh-pathway-header">
                <span className="nh-badge-mono">FOR NODE PARTICIPANTS</span>
                <h3 className="nh-pathway-title">Put your connection to work.</h3>
                <p className="nh-pathway-desc">
                  Join using the official NetShare Android app. Contribute idle residential connectivity
                  under complete personal control and earn verified platform credits.
                </p>
              </div>

              {/* Pathway Illustration */}
              <div className="nh-pathway-illustration">
                <svg viewBox="0 0 460 180" className="nh-pathway-svg" fill="none">
                  {/* Isometric Phone Shell */}
                  <rect x="60" y="20" width="100" height="140" rx="14" fill="#0D0D0D" stroke="#353535" strokeWidth="1.5" />
                  <rect x="70" y="34" width="80" height="112" rx="6" fill="#070707" />
                  <circle cx="110" cy="27" r="2.5" fill="#353535" />
                  <text x="110" y="65" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="600">NetShare Node</text>
                  <text x="110" y="85" textAnchor="middle" fill="#10B981" fontSize="9" fontFamily="JetBrains Mono">● Session Active</text>
                  <rect x="80" y="100" width="60" height="4" rx="2" fill="#262626" />
                  <rect x="80" y="100" width="42" height="4" rx="2" fill="#00E5FF" />
                  <text x="110" y="122" textAnchor="middle" fill="#8B8B92" fontSize="8" fontFamily="JetBrains Mono">Wi-Fi Only · 65% Cap</text>

                  {/* Connective pipeline */}
                  <path d="M160 90 L240 90" stroke="#9D4EDD" strokeWidth="2" strokeDasharray="4 4" className="nh-route-path" />

                  {/* Reward Wallet Block */}
                  <rect x="240" y="40" width="180" height="100" rx="10" fill="#111111" stroke="#3A3A3A" strokeWidth="1.2" />
                  <text x="330" y="70" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="600">Participant Wallet</text>
                  <text x="330" y="95" textAnchor="middle" fill="#9D4EDD" fontSize="16" fontWeight="700" fontFamily="JetBrains Mono">+284.5 CR</text>
                  <text x="330" y="118" textAnchor="middle" fill="#8B8B92" fontSize="9">Eligible tasks completed</text>
                </svg>
              </div>

              <div className="nh-pathway-footer">
                <ul className="nh-pathway-points">
                  <li><Check size={14} className="text-purple" /> Join securely using the NetShare Android client</li>
                  <li><Check size={14} className="text-purple" /> Strict bandwidth caps, battery rules and pause toggles</li>
                  <li><Check size={14} className="text-purple" /> Earn rewards for every successfully completed task</li>
                </ul>
                <button
                  onClick={() => handleAuthRedirect("node")}
                  className="nh-btn-pill-dark w-full"
                >
                  <span>Become a Node</span>
                  <ArrowRight size={14} className="nh-btn-arrow" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 9 — Pricing and Transparency
          ========================================================================= */}
      <section id="pricing" className="nh-pricing-section">
        <div className="nh-container">
          <div className="nh-section-header">
            <span className="nh-eyebrow">TRANSPARENT ACCOUNTING</span>
            <h2 className="nh-section-title">
              Know the cost before you run.
            </h2>
            <p className="nh-section-desc">
              NetShare uses a server-controlled credit pricing model. No opaque subscriptions,
              no surprise retainers, and no arbitrary lock-in.
            </p>
          </div>

          <div className="nh-pricing-grid">
            {/* Card 1: Transparent Credit Pricing */}
            <div className="nh-pricing-card">
              <div className="nh-pricing-icon text-cyan">
                <Database size={24} />
              </div>
              <h3 className="nh-pricing-card-title">Transparent Credit Pricing</h3>
              <p className="nh-pricing-card-desc">
                Task fees are governed directly by server configuration. Every test displays its
                exact credit requirement upfront before you confirm submission.
              </p>
              <div className="nh-pricing-meta">
                <span className="nh-mono-tag">Server-Governed</span>
                <span className="nh-pricing-subtext">No recurring minimums</span>
              </div>
            </div>

            {/* Card 2: Real Execution Results */}
            <div className="nh-pricing-card">
              <div className="nh-pricing-icon text-purple">
                <ShieldCheck size={24} />
              </div>
              <h3 className="nh-pricing-card-title">Real Execution Results</h3>
              <p className="nh-pricing-card-desc">
                Credits are debited strictly upon validated task delivery. If a task fails or an assigned
                node disconnects, credits are immediately returned to your balance.
              </p>
              <div className="nh-pricing-meta">
                <span className="nh-mono-tag">Escrow Protected</span>
                <span className="nh-pricing-subtext">Auto-refund on failure</span>
              </div>
            </div>

            {/* Card 3: Managed Network Participation */}
            <div className="nh-pricing-card">
              <div className="nh-pricing-icon text-emerald">
                <Sliders size={24} />
              </div>
              <h3 className="nh-pricing-card-title">Managed Participation</h3>
              <p className="nh-pricing-card-desc">
                Node participants enjoy fair reward distribution for verified task participation.
                Bandwidth counters and session logs remain fully visible at all times.
              </p>
              <div className="nh-pricing-meta">
                <span className="nh-mono-tag">Fair Allocation</span>
                <span className="nh-pricing-subtext">Auditable transaction log</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 10 — FAQ Accordion
          ========================================================================= */}
      <section id="faq" className="nh-faq-section">
        <div className="nh-container nh-faq-container">
          <div className="nh-section-header">
            <span className="nh-eyebrow">FREQUENTLY ASKED</span>
            <h2 className="nh-section-title">Common questions.</h2>
          </div>

          <div className="nh-faq-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} className={`nh-faq-item ${isOpen ? "open" : ""}`}>
                  <button
                    className="nh-faq-trigger"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                  >
                    <span className="nh-faq-question">{faq.q}</span>
                    <span className="nh-faq-icon">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className="nh-faq-answer">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 11 — Final Editorial CTA
          ========================================================================= */}
      <section className="nh-final-cta-section">
        <div className="nh-container nh-cta-container">
          <div className="nh-cta-glow"></div>
          <span className="nh-badge-mono">GET STARTED TODAY</span>
          <h2 className="nh-cta-headline">
            See the web
            <br />
            <span className="nh-cta-headline-italic">from another perspective.</span>
          </h2>
          <p className="nh-cta-desc">
            Join developers, platform architects, and network engineers using NetShare's
            distributed residential nodes for authentic regional testing.
          </p>

          <div className="nh-cta-actions">
            <button
              onClick={() => handleAuthRedirect("client")}
              className="nh-btn-pill-white"
            >
              Create Account
            </button>
            <a
              href="#demo"
              onClick={(e) => { e.preventDefault(); handleScroll("demo"); }}
              className="nh-btn-pill-dark"
            >
              <span>Explore How It Works</span>
              <ArrowRight size={14} className="nh-btn-arrow" />
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 12 — Multi-Column Footer
          ========================================================================= */}
      <footer className="nh-footer">
        <div className="nh-container">
          <div className="nh-footer-grid">
            {/* Col 1: NetShare Brand */}
            <div className="nh-footer-brand-col">
              <Link to="/" className="nh-logo">
                <span className="nh-logo-mark">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#00E5FF" strokeWidth="1.5" strokeOpacity="0.4" />
                    <circle cx="12" cy="12" r="4" fill="#00E5FF" />
                  </svg>
                </span>
                <span className="nh-logo-text">NetShare</span>
              </Link>
              <p className="nh-footer-mission">
                The distributed network intelligence platform powered by real residential nodes —
                reliable, global accessibility to the open web.
              </p>
              <div className="nh-footer-status">
                <span className="nh-status-dot"></span>
                <span>All systems operational</span>
              </div>
            </div>

            {/* Col 2: Platform */}
            <div className="nh-footer-col">
              <h4 className="nh-footer-col-title">Platform</h4>
              <ul className="nh-footer-links">
                <li><a href="#features" onClick={(e) => { e.preventDefault(); handleScroll("features"); }}>Regional Accessibility</a></li>
                <li><a href="#features" onClick={(e) => { e.preventDefault(); handleScroll("features"); }}>Performance Testing</a></li>
                <li><a href="#features" onClick={(e) => { e.preventDefault(); handleScroll("features"); }}>Localization Observations</a></li>
                <li><a href="#demo" onClick={(e) => { e.preventDefault(); handleScroll("demo"); }}>Execution Engine</a></li>
                <li><a href="#monitor" onClick={(e) => { e.preventDefault(); handleScroll("monitor"); }}>Live Telemetry Feed</a></li>
              </ul>
            </div>

            {/* Col 3: For Nodes */}
            <div className="nh-footer-col">
              <h4 className="nh-footer-col-title">For Nodes</h4>
              <ul className="nh-footer-links">
                <li><a href="#nodes" onClick={(e) => { e.preventDefault(); handleScroll("nodes"); }}>Android App Overview</a></li>
                <li><a href="#nodes" onClick={(e) => { e.preventDefault(); handleScroll("nodes"); }}>Bandwidth Controls</a></li>
                <li><a href="#pricing" onClick={(e) => { e.preventDefault(); handleScroll("pricing"); }}>Participant Rewards</a></li>
                <li><Link to="/register?role=node">Node Registration</Link></li>
              </ul>
            </div>

            {/* Col 4: Resources */}
            <div className="nh-footer-col">
              <h4 className="nh-footer-col-title">Resources</h4>
              <ul className="nh-footer-links">
                <li><a href="#demo" onClick={(e) => { e.preventDefault(); handleScroll("demo"); }}>Task Lifecycle</a></li>
                <li><a href="#faq" onClick={(e) => { e.preventDefault(); handleScroll("faq"); }}>Architecture FAQ</a></li>
                <li><a href="#pricing" onClick={(e) => { e.preventDefault(); handleScroll("pricing"); }}>Credit Structure</a></li>
                <li><Link to="/login">Sign In</Link></li>
              </ul>
            </div>

            {/* Col 5: Company */}
            <div className="nh-footer-col">
              <h4 className="nh-footer-col-title">Company</h4>
              <ul className="nh-footer-links">
                <li><Link to="/login">Client Portal</Link></li>
                <li><Link to="/register">Create Account</Link></li>
                <li><a href="#faq" onClick={(e) => { e.preventDefault(); handleScroll("faq"); }}>Security & Privacy</a></li>
                <li><a href="#demo" onClick={(e) => { e.preventDefault(); handleScroll("demo"); }}>Contact Protocol</a></li>
              </ul>
            </div>
          </div>

          <div className="nh-footer-bottom">
            <div className="nh-footer-copy">
              © 2026 NetShare Inc. All rights reserved.
            </div>
            <div className="nh-footer-legal">
              <span>Residential node telemetry</span>
              <span>·</span>
              <span>WebRTC DataChannel Protocol</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
