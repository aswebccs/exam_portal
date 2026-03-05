import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Monitor, Clock3, Lock } from "lucide-react";
import "./LandingPage.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setShowMobileWarning(window.innerWidth < 768);
    };
    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  return (
    <div className="lp-root">
      <header className="lp-header">
        <div className="lp-brand">
          <span className="lp-brand-dot" />
          <span>Exam Creator Portal</span>
        </div>
        <div className="lp-header-tag">
          <ShieldCheck size={14} />
          <span>Secure Assessment Environment</span>
        </div>
      </header>

      <main className="lp-main">
        <section className="lp-hero">
          <p className="lp-eyebrow">Online Examination System</p>
          <h1>Professional Exam Delivery Platform</h1>
          <p className="lp-subtitle">
            Welcome to the online examination portal. Login with your assigned credentials to begin your exam in a
            controlled and secure environment.
          </p>

          <div className="lp-feature-grid">
            <article className="lp-feature-card">
              <Monitor size={18} />
              <div>
                <h3>Desktop-Only Mode</h3>
                <p>Use laptop or desktop for a stable exam session.</p>
              </div>
            </article>
            <article className="lp-feature-card">
              <Clock3 size={18} />
              <div>
                <h3>Timed Assessment</h3>
                <p>Exam duration and submission are strictly managed.</p>
              </div>
            </article>
            <article className="lp-feature-card">
              <Lock size={18} />
              <div>
                <h3>Controlled Navigation</h3>
                <p>Back/refresh restrictions are enabled during exam flow.</p>
              </div>
            </article>
          </div>
        </section>

        <aside className="lp-cta-card">
          <h2>Start Your Exam</h2>
          <p>
            Ensure you have your username/roll number and password ready before continuing to login.
          </p>
          <ul>
            <li>Do not refresh browser during exam.</li>
            <li>Read instructions before starting.</li>
            <li>Use stable internet connection.</li>
          </ul>
          <button type="button" onClick={() => navigate("/login")}>Start Exam</button>
        </aside>
      </main>

      <footer className="lp-footer">
        <span>Exam Creator Suite</span>
        <span>Confidential and Proctored Assessment Workflow</span>
      </footer>

      {showMobileWarning ? (
        <div className="lp-mobile-overlay">
          <div className="lp-mobile-card">
            <h3>Desktop Required</h3>
            <p>This exam can only be taken on desktop or laptop.</p>
            <button type="button" onClick={() => setShowMobileWarning(false)}>Understood</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
