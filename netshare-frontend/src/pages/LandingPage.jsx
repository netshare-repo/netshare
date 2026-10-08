import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authState";
import {
  Network,
  Globe,
  ShieldCheck,
  Zap,
  Activity,
  Cpu,
  Server,
  Lock,
  Menu,
  X,
  CreditCard,
  CheckCircle2,
  Layers,
  CheckSquare,
  Gift,
  ChevronDown,
  ChevronUp,
  Settings,
  Database
} from "lucide-react";
import "./LandingPage.css";

function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const handleGetStarted = () => {
    if (user) {
      navigate(user.role === "admin" ? "/admin/dashboard" : "/client/dashboard");
    } else {
      navigate("/register");
    }
  };

  const handleScroll = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "What is NetShare?",
      a: "NetShare is a distributed bandwidth sharing and internet testing platform where users can contribute idle bandwidth and clients can submit controlled testing tasks."
    },
    {
      q: "How do users earn credits?",
      a: "Node participants earn credits when their registered node participates in assigned testing tasks and completes sessions successfully."
    },
    {
      q: "Can users control bandwidth usage?",
      a: "Yes. Users can configure bandwidth limits, speed caps, and maximum concurrent tasks."
    },
    {
      q: "What can platform clients test?",
      a: "Clients can submit tasks such as ad verification, accessibility testing, localization testing, and performance testing."
    },
    {
      q: "How does marketplace redemption work?",
      a: "Users spend earned credits on marketplace products. Admins manually fulfil orders in the current phase."
    },
    {
      q: "Is real WebRTC or VPN routing implemented?",
      a: "Current Phase-1 uses backend-controlled secure session simulation. Real WebRTC or Android VpnService routing is planned for future phases."
    }
  ];

  return (
    <div className="landing-wrapper">
      {/* 1. Navbar */}
      <nav className="lp-navbar">
        <div className="lp-logo">
          <Network className="lp-logo-icon" size={28} />
          <span>NetShare</span>
        </div>

        <div className="lp-nav-links">
          <a href="#how-it-works" onClick={(e) => { e.preventDefault(); handleScroll("how-it-works"); }}>How It Works</a>
          <a href="#features" onClick={(e) => { e.preventDefault(); handleScroll("features"); }}>Features</a>
          <a href="#nodes" onClick={(e) => { e.preventDefault(); handleScroll("nodes"); }}>For Nodes</a>
          <a href="#clients" onClick={(e) => { e.preventDefault(); handleScroll("clients"); }}>For Clients</a>
          <a href="#marketplace" onClick={(e) => { e.preventDefault(); handleScroll("marketplace"); }}>Marketplace</a>
          <a href="#faq" onClick={(e) => { e.preventDefault(); handleScroll("faq"); }}>FAQ</a>
        </div>

        <div className="lp-nav-actions">
          {user ? (
            <button onClick={handleGetStarted} className="btn-primary">
              Dashboard
            </button>
          ) : (
            <>
              <Link to="/login" className="login-link">Login</Link>
              <Link to="/register" className="btn-primary">Get Started</Link>
            </>
          )}
        </div>

        <button className="lp-mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* 2. Hero Section */}
      <header className="lp-hero">
        <div className="lp-hero-content">
          <span className="lp-badge">Decentralized Bandwidth Testing Platform</span>
          <h1>Earn Credits From Unused Internet Bandwidth</h1>
          <p>
            NetShare lets users share idle bandwidth as controlled testing nodes while platform clients run real-world website, ad, localization, and performance tests.
          </p>
          <div className="lp-hero-buttons">
            <button className="btn-primary" onClick={() => navigate("/register")}>
              Start Sharing Bandwidth
            </button>
            <button className="btn-secondary" onClick={() => navigate(user ? "/client/submit-task" : "/register")}>
              Submit Testing Task
            </button>
          </div>
          <div className="lp-hero-trust-text">
            <ShieldCheck size={16} /> Built for node participants, platform clients, and admin monitoring.
          </div>
        </div>

        <div className="lp-hero-visual">
          <div className="image-fallback-container" style={{ width: "100%", maxWidth: "500px", position: "relative" }}>
            {/* CSS Mockup acting as fallback if /assets/images/netshare-hero-illustration.png doesn't exist */}
            <div className="hero-dashboard-mockup">
              <div className="mock-ui-header" style={{ marginBottom: "20px", borderBottom: "1px solid var(--card-border)", paddingBottom: "15px" }}>
                <strong>NetShare Node Dashboard</strong>
                <Activity size={18} color="var(--primary)" />
              </div>
              
              <div style={{ alignItems: "center", gap: "8px", marginBottom: "20px", background: "rgba(34, 197, 94, 0.1)", color: "var(--accent-green)", padding: "6px 12px", borderRadius: "999px", display: "inline-flex", fontSize: "0.85rem", fontWeight: "600" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-green)", animation: "pulseSoft 2s infinite" }}></span>
                Status: Active
              </div>

              <div className="mock-ui-row">
                <span>Bandwidth Limit</span>
                <strong>2 GB</strong>
              </div>
              <div className="mock-ui-row">
                <span>Speed Cap</span>
                <strong>18 Mbps</strong>
              </div>
              <div className="mock-ui-row">
                <span>Credits Earned</span>
                <strong style={{ color: "var(--primary)" }}>540</strong>
              </div>
              <div className="mock-ui-row">
                <span>Connection</span>
                <strong style={{ color: "var(--accent-green)" }}>Stable</strong>
              </div>
            </div>

            <div className="hero-floating-card hero-fc-1">
              <div className="hero-fc-icon"><Network size={16} /></div>
              <div className="hero-fc-text">
                <span>Active Nodes</span>
                <strong>1,200+</strong>
              </div>
            </div>

            <div className="hero-floating-card hero-fc-2">
              <div className="hero-fc-icon"><Activity size={16} /></div>
              <div className="hero-fc-text">
                <span>Running Tasks</span>
                <strong>26</strong>
              </div>
            </div>

            <div className="hero-floating-card hero-fc-3">
              <div className="hero-fc-icon"><Globe size={16} /></div>
              <div className="hero-fc-text">
                <span>Regions</span>
                <strong>40+</strong>
              </div>
            </div>

            <div className="hero-floating-card hero-fc-4">
              <div className="hero-fc-icon"><ShieldCheck size={16} /></div>
              <div className="hero-fc-text">
                <span>Success Rate</span>
                <strong style={{ color: "var(--accent-green)" }}>98%</strong>
              </div>
            </div>
            
            {/* Real Image Placeholder (Will overlay CSS mockup if image exists) */}
            <img 
              src="/assets/images/netshare-hero-illustration.png" 
              alt="" 
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0 }} 
              onError={(e) => e.target.style.display = 'none'}
              onLoad={(e) => { e.target.style.opacity = 1; e.target.style.zIndex = 10; e.target.previousSibling.style.display = 'none'; }}
            />
          </div>
        </div>
      </header>

      {/* 3. Stats / Trusted Strip */}
      <section className="lp-stats-strip">
        <div className="lp-stat-item">
          <Network className="lp-stat-icon" size={28} />
          <div className="lp-stat-text">
            <strong>1,200+</strong>
            <span>Participating Nodes</span>
          </div>
        </div>
        <div className="lp-stat-item">
          <Globe className="lp-stat-icon" size={28} />
          <div className="lp-stat-text">
            <strong>40+</strong>
            <span>Regions Supported</span>
          </div>
        </div>
        <div className="lp-stat-item">
          <ShieldCheck className="lp-stat-icon" size={28} />
          <div className="lp-stat-text">
            <strong>98%</strong>
            <span>Task Success Rate</span>
          </div>
        </div>
        <div className="lp-stat-item">
          <Activity className="lp-stat-icon" size={28} />
          <div className="lp-stat-text">
            <strong>24/7</strong>
            <span>Monitoring</span>
          </div>
        </div>
        <div className="lp-stat-item">
          <Gift className="lp-stat-icon" size={28} />
          <div className="lp-stat-text">
            <strong>500</strong>
            <span>Starting Client Credits</span>
          </div>
        </div>
      </section>

      {/* 4. Why NetShare Matters */}
      <section id="why" className="lp-section bg-alt">
        <div className="lp-section-header">
          <h2>Why NetShare Matters</h2>
          <p>You already pay for internet every month. A large part of that bandwidth stays unused. NetShare turns idle capacity into a controlled testing network where users earn credits and clients get real-world internet insights.</p>
        </div>
        <div className="lp-why-grid">
          <div className="clean-card lp-why-card">
            <div className="lp-why-icon"><Zap size={28} /></div>
            <h3>Use Idle Bandwidth</h3>
            <p>Put unused internet capacity to work through controlled participation.</p>
          </div>
          <div className="clean-card lp-why-card">
            <div className="lp-why-icon"><Globe size={28} /></div>
            <h3>Support Real-World Testing</h3>
            <p>Help clients test websites, ads, localization, and performance from real user networks.</p>
          </div>
          <div className="clean-card lp-why-card">
            <div className="lp-why-icon"><Gift size={28} /></div>
            <h3>Earn Redeemable Credits</h3>
            <p>Track your contribution and redeem credits in the NetShare marketplace.</p>
          </div>
        </div>
      </section>

      {/* 5. How It Works */}
      <section id="how-it-works" className="lp-section bg-light">
        <div className="lp-section-header">
          <h2>How NetShare Works</h2>
        </div>
        <div className="lp-steps">
          <div className="clean-card lp-step-card">
            <div className="step-number">1</div>
            <h3>Create Your Account</h3>
            <p>Choose Node Participant, Platform Client, or Both.</p>
          </div>
          <div className="clean-card lp-step-card">
            <div className="step-number">2</div>
            <h3>Configure Participation</h3>
            <p>Set bandwidth limit, speed cap, region, and task limit.</p>
          </div>
          <div className="clean-card lp-step-card">
            <div className="step-number">3</div>
            <h3>Run Testing Tasks</h3>
            <p>Clients submit URL, service type, region, and execution limit.</p>
          </div>
          <div className="clean-card lp-step-card">
            <div className="step-number">4</div>
            <h3>Earn and Redeem</h3>
            <p>Nodes earn credits and redeem them through the marketplace.</p>
          </div>
        </div>
      </section>

      {/* 6. For Node Participants */}
      <section id="nodes" className="lp-section bg-alt">
        <div className="lp-split-section">
          <div className="lp-split-content">
            <h2>Share Bandwidth With Full Control</h2>
            <p>NetShare gives node participants control over how much bandwidth they share and when participation starts or stops.</p>
            <ul>
              <li><CheckCircle2 size={18} /> Set daily bandwidth usage limit</li>
              <li><CheckCircle2 size={18} /> Set upload/download speed caps</li>
              <li><CheckCircle2 size={18} /> Control maximum concurrent tasks</li>
              <li><CheckCircle2 size={18} /> Start or stop participation anytime</li>
              <li><CheckCircle2 size={18} /> Track bandwidth usage and credits earned</li>
              <li><CheckCircle2 size={18} /> Redeem credits in the marketplace</li>
            </ul>
            <button className="btn-primary" onClick={() => navigate("/register")} style={{ marginTop: "10px" }}>Become a Node Participant</button>
          </div>
          <div className="lp-split-visual">
            <div className="image-fallback-container mock-ui-wrapper">
              <div className="css-mockup-content">
                <div className="mock-ui-header">
                  <strong>Node Dashboard Preview</strong>
                  <Activity size={18} color="var(--primary)" />
                </div>
                <div className="mock-ui-row">
                  <span>Node Status</span>
                  <strong style={{ color: "var(--accent-green)" }}>Active</strong>
                </div>
                <div className="mock-ui-row">
                  <span>Bandwidth Used</span>
                  <strong>1.2 GB</strong>
                </div>
                <div className="mock-ui-row">
                  <span>Speed Cap</span>
                  <strong>18 Mbps</strong>
                </div>
                <div className="mock-ui-row">
                  <span>Active Tasks</span>
                  <strong>3</strong>
                </div>
                <div className="mock-ui-row">
                  <span>Credits Earned</span>
                  <strong style={{ color: "var(--primary)" }}>540</strong>
                </div>
                <div className="mock-ui-row">
                  <span>Connection Quality</span>
                  <strong style={{ color: "var(--accent-green)" }}>Stable</strong>
                </div>
              </div>
              <img 
                src="/assets/images/netshare-node-dashboard.png" 
                alt="" 
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0 }} 
                onError={(e) => e.target.style.display = 'none'}
                onLoad={(e) => { e.target.style.opacity = 1; e.target.style.zIndex = 10; e.target.previousSibling.style.display = 'none'; }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 7. For Platform Clients */}
      <section id="clients" className="lp-section bg-light">
        <div className="lp-split-section reverse">
          <div className="lp-split-content">
            <h2>Run Real-World Internet Testing Tasks</h2>
            <p>Platform clients can submit controlled testing tasks and get visibility into regional website behavior, ad delivery, localization, and performance.</p>
            <ul>
              <li><CheckCircle2 size={18} /> Submit target website URL</li>
              <li><CheckCircle2 size={18} /> Select service type</li>
              <li><CheckCircle2 size={18} /> Choose target region</li>
              <li><CheckCircle2 size={18} /> Set execution limit</li>
              <li><CheckCircle2 size={18} /> Track task status</li>
              <li><CheckCircle2 size={18} /> View result summary</li>
            </ul>
            <button className="btn-primary" onClick={() => navigate("/register")} style={{ marginTop: "10px" }}>Launch a Testing Task</button>
          </div>
          <div className="lp-split-visual">
            <div className="image-fallback-container mock-ui-wrapper" style={{ background: "linear-gradient(135deg, #071326 0%, #0B1730 100%)", color: "white", border: "none" }}>
              <div className="css-mockup-content">
                <div className="mock-ui-header" style={{ borderBottomColor: "rgba(255,255,255,0.1)" }}>
                  <strong style={{ color: "white" }}>Task Preview</strong>
                  <Network size={18} color="var(--accent-cyan)" />
                </div>
                <div className="mock-ui-row" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                  <span style={{ color: "var(--text-white-muted)" }}>Service</span>
                  <strong style={{ color: "white" }}>Ad Verification</strong>
                </div>
                <div className="mock-ui-row" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                  <span style={{ color: "var(--text-white-muted)" }}>Region</span>
                  <strong style={{ color: "white" }}>UAE</strong>
                </div>
                <div className="mock-ui-row" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                  <span style={{ color: "var(--text-white-muted)" }}>Status</span>
                  <strong style={{ color: "var(--accent-cyan)" }}>Running</strong>
                </div>
                <div className="mock-ui-row" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                  <span style={{ color: "var(--text-white-muted)" }}>Estimated Cost</span>
                  <strong style={{ color: "white" }}>120 Credits</strong>
                </div>
                <div className="mock-ui-row" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                  <span style={{ color: "var(--text-white-muted)" }}>Success Rate</span>
                  <strong style={{ color: "var(--accent-green)" }}>92%</strong>
                </div>
                <div className="mock-ui-row" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                  <span style={{ color: "var(--text-white-muted)" }}>Response Time</span>
                  <strong style={{ color: "white" }}>2.4s</strong>
                </div>
              </div>
              <img 
                src="/assets/images/netshare-client-dashboard.png" 
                alt="" 
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0 }} 
                onError={(e) => e.target.style.display = 'none'}
                onLoad={(e) => { e.target.style.opacity = 1; e.target.style.zIndex = 10; e.target.previousSibling.style.display = 'none'; }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 8. Feature Grid */}
      <section id="features" className="lp-section bg-alt">
        <div className="lp-section-header">
          <h2>Everything Needed for a Controlled Bandwidth Network</h2>
        </div>
        <div className="lp-features-grid">
          <div className="clean-card lp-feature-card">
            <div className="lp-feature-icon"><Globe size={24} /></div>
            <h3>Residential Node Network</h3>
            <p>Access genuine residential connections globally.</p>
          </div>
          <div className="clean-card lp-feature-card">
            <div className="lp-feature-icon"><ShieldCheck size={24} /></div>
            <h3>Ad Verification</h3>
            <p>Verify ad visibility securely and effectively.</p>
          </div>
          <div className="clean-card lp-feature-card">
            <div className="lp-feature-icon"><Activity size={24} /></div>
            <h3>Regional Accessibility Testing</h3>
            <p>Check website behavior across different regions.</p>
          </div>
          <div className="clean-card lp-feature-card">
            <div className="lp-feature-icon"><Layers size={24} /></div>
            <h3>Localization Testing</h3>
            <p>Ensure localized content resolves correctly.</p>
          </div>
          <div className="clean-card lp-feature-card">
            <div className="lp-feature-icon"><Zap size={24} /></div>
            <h3>Performance Testing</h3>
            <p>Measure response times and success rates.</p>
          </div>
          <div className="clean-card lp-feature-card">
            <div className="lp-feature-icon"><CreditCard size={24} /></div>
            <h3>Credit Wallet</h3>
            <p>Track earnings transparently with an internal ledger.</p>
          </div>
          <div className="clean-card lp-feature-card">
            <div className="lp-feature-icon"><Gift size={24} /></div>
            <h3>Digital Marketplace</h3>
            <p>Redeem credits for premium tools and subscriptions.</p>
          </div>
          <div className="clean-card lp-feature-card">
            <div className="lp-feature-icon"><Settings size={24} /></div>
            <h3>Admin Monitoring</h3>
            <p>Full oversight of nodes, tasks, and transactions.</p>
          </div>
        </div>
      </section>

      {/* 9. Marketplace Preview */}
      <section id="marketplace" className="lp-section bg-light">
        <div className="lp-section-header">
          <h2>Redeem Credits in the NetShare Marketplace</h2>
          <p>Node participants can use earned credits to request digital products and subscriptions.</p>
        </div>
        
        <div className="image-fallback-container" style={{ marginBottom: "40px" }}>
          {/* Main Marketplace Wrapper. It will hide if image loads */}
          <div className="css-mockup-content lp-marketplace-grid" style={{ width: "100%" }}>
            <div className="clean-card lp-marketplace-card">
              <div className="lp-marketplace-icon"><Cpu size={32} /></div>
              <h3>ChatGPT Plus</h3>
              <p>Productivity and AI assistance subscription</p>
              <span className="lp-marketplace-price">850 Credits</span>
              <button className="btn-secondary" onClick={() => navigate(user ? "/client/marketplace" : "/login")} style={{ width: "100%" }}>Redeem</button>
            </div>
            <div className="clean-card lp-marketplace-card">
              <div className="lp-marketplace-icon"><Layers size={32} /></div>
              <h3>Gemini Advanced</h3>
              <p>AI research and writing support</p>
              <span className="lp-marketplace-price">750 Credits</span>
              <button className="btn-secondary" onClick={() => navigate(user ? "/client/marketplace" : "/login")} style={{ width: "100%" }}>Redeem</button>
            </div>
            <div className="clean-card lp-marketplace-card">
              <div className="lp-marketplace-icon"><CheckSquare size={32} /></div>
              <h3>Adobe Creative Cloud</h3>
              <p>Creative software subscription bundle</p>
              <span className="lp-marketplace-price">1200 Credits</span>
              <button className="btn-secondary" onClick={() => navigate(user ? "/client/marketplace" : "/login")} style={{ width: "100%" }}>Redeem</button>
            </div>
          </div>
          <img 
            src="/assets/images/netshare-marketplace-preview.png" 
            alt="" 
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0 }} 
            onError={(e) => e.target.style.display = 'none'}
            onLoad={(e) => { e.target.style.opacity = 1; e.target.style.zIndex = 10; e.target.previousSibling.style.display = 'none'; }}
          />
        </div>
      </section>

      {/* 10. Trust and Security */}
      <section className="lp-section bg-alt">
        <div className="lp-section-header">
          <h2>Built for Transparency and Control</h2>
          <p>NetShare is designed so users understand their participation, credits, and account activity.</p>
        </div>
        
        <div className="lp-trust-container">
          <div className="lp-trust-grid">
            <div className="clean-card">
              <Lock size={20} color="var(--primary)" />
              <strong>JWT Authentication</strong>
            </div>
            <div className="clean-card">
              <ShieldCheck size={20} color="var(--accent-green)" />
              <strong>Role-Based Access</strong>
            </div>
            <div className="clean-card">
              <CreditCard size={20} color="var(--primary)" />
              <strong>Wallet Transaction History</strong>
            </div>
            <div className="clean-card">
              <Database size={20} color="var(--accent-cyan)" />
              <strong>Admin Audit Logs</strong>
            </div>
            <div className="clean-card">
              <Zap size={20} color="var(--accent-green)" />
              <strong>Bandwidth Limits</strong>
            </div>
            <div className="clean-card">
              <Server size={20} color="var(--primary)" />
              <strong>Controlled Session Simulation</strong>
            </div>
          </div>
          
          <div className="lp-trust-visual">
            <div className="image-fallback-container" style={{ width: "100%", maxWidth: "400px", minHeight: "300px" }}>
              <div className="css-mockup-content" style={{ textAlign: "center", background: "var(--bg-white)", padding: "40px", borderRadius: "24px", boxShadow: "var(--shadow-lg)", border: "1px solid var(--card-border)" }}>
                <ShieldCheck size={80} color="var(--primary)" style={{ margin: "0 auto 20px" }} />
                <h3>Phase-1 Simulation</h3>
                <p style={{ fontSize: "0.95rem", marginTop: "15px" }}>Phase-1 uses backend-controlled secure session simulation and is designed for future secure routing expansion.</p>
              </div>
              <img 
                src="/assets/images/netshare-trust-illustration.png" 
                alt="" 
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0 }} 
                onError={(e) => e.target.style.display = 'none'}
                onLoad={(e) => { e.target.style.opacity = 1; e.target.style.zIndex = 10; e.target.previousSibling.style.display = 'none'; }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 11. Community / Ecosystem */}
      <section className="lp-section bg-light">
        <div className="lp-section-header">
          <h2>One Network, Multiple Roles</h2>
          <p>NetShare connects people who contribute bandwidth with clients who need real-world testing, all managed through a transparent admin system.</p>
        </div>
        
        <div className="image-fallback-container">
          <div className="css-mockup-content lp-community-grid" style={{ width: "100%" }}>
            <div className="clean-card lp-community-card">
              <div className="lp-community-icon"><Network size={36} /></div>
              <h3>Node Participants</h3>
              <p>Share bandwidth and earn credits.</p>
            </div>
            <div className="clean-card lp-community-card">
              <div className="lp-community-icon"><Globe size={36} /></div>
              <h3>Platform Clients</h3>
              <p>Submit testing tasks and view results.</p>
            </div>
            <div className="clean-card lp-community-card">
              <div className="lp-community-icon"><Settings size={36} /></div>
              <h3>Administrators</h3>
              <p>Monitor users, nodes, tasks, transactions, and marketplace orders.</p>
            </div>
          </div>
          <img 
            src="/assets/images/netshare-community-illustration.png" 
            alt="" 
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0 }} 
            onError={(e) => e.target.style.display = 'none'}
            onLoad={(e) => { e.target.style.opacity = 1; e.target.style.zIndex = 10; e.target.previousSibling.style.display = 'none'; }}
          />
        </div>
      </section>

      {/* 12. FAQ Section */}
      <section id="faq" className="lp-section bg-alt">
        <div className="lp-section-header">
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="lp-faq-container">
          {faqs.map((faq, index) => (
            <div key={index} className="lp-faq-item">
              <div className="lp-faq-question" onClick={() => toggleFaq(index)}>
                {faq.q}
                {openFaq === index ? <ChevronUp size={20} color="var(--primary)" /> : <ChevronDown size={20} color="var(--text-light)" />}
              </div>
              {openFaq === index && (
                <div className="lp-faq-answer">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 13. Final CTA */}
      <section className="lp-cta">
        <h2>Turn Idle Bandwidth Into Real Value</h2>
        <p>Join NetShare as a node participant, platform client, or both.</p>
        <div className="lp-cta-buttons">
          <button className="btn-primary" onClick={() => navigate("/register")} style={{ background: "white", color: "var(--primary)" }}>Create Account</button>
          <button className="btn-secondary" onClick={() => navigate("/login")}>Login</button>
        </div>
      </section>

      {/* 14. Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <div className="lp-logo" style={{ fontSize: "1.2rem", color: "var(--text-white)" }}>
              <Network className="lp-logo-icon" size={20} />
              <span>NetShare</span>
            </div>
            <p>A Decentralized Internet Bandwidth Sharing and Distributed Testing Platform.</p>
          </div>
          
          <div className="lp-footer-links">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); handleScroll("how-it-works"); }}>How it Works</a></li>
              <li><a href="#features" onClick={(e) => { e.preventDefault(); handleScroll("features"); }}>Features</a></li>
              <li><a href="#marketplace" onClick={(e) => { e.preventDefault(); handleScroll("marketplace"); }}>Marketplace</a></li>
              <li><a href="#faq" onClick={(e) => { e.preventDefault(); handleScroll("faq"); }}>FAQ</a></li>
            </ul>
          </div>
          
          <div className="lp-footer-links">
            <h4>Modules</h4>
            <ul>
              <li><a href="#">User Management</a></li>
              <li><a href="#">Host Node Management</a></li>
              <li><a href="#">Client Task Management</a></li>
              <li><a href="#">Wallet and Credits</a></li>
              <li><a href="#">Marketplace</a></li>
              <li><a href="#">Admin Dashboard</a></li>
            </ul>
          </div>

          <div className="lp-footer-links">
            <h4>Contact</h4>
            <ul>
              <li><a href="#">Support Center</a></li>
              <li><a href="#">API Documentation</a></li>
              <li><a href="#">hello@netshare.com</a></li>
            </ul>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <p>&copy; {new Date().getFullYear()} NetShare. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
