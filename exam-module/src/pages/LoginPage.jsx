import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { examApi } from "../api";
import { authStorage } from "../App";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(location.state?.message || "");

  const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const rawUsername = String(username || "").trim();
    const rawPassword = String(password || "");

    if (!rawUsername) {
      setError("Please enter username/email.");
      return;
    }
    if (!rawPassword) {
      setError("Please enter password.");
      return;
    }

    setLoading(true);
    try {
      if (isEmail(rawUsername)) {
        const response = await examApi.loginAdmin(rawUsername, rawPassword);
        authStorage.setSession({ token: response.token, user: response.admin, role: "admin" });
        navigate("/admin", { replace: true });
      } else {
        const response = await examApi.login(rawUsername, rawPassword);
        authStorage.setSession({ token: response.token, student: response.student, role: "student" });

        const examsResponse = await examApi.getExams(response.token);
        const assignedExams = examsResponse.data || [];

        if (!assignedExams.length) {
          authStorage.clear();
          setError("No exam assigned to you.");
          return;
        }

        const targetExam = assignedExams.find((exam) => !exam.has_attempted) || assignedExams[0];
        navigate(`/exams/${targetExam.id}/instructions`, { replace: true });
      }
    } catch (err) {
      const fallback = isEmail(rawUsername)
        ? "Invalid admin email or password."
        : "Invalid username/roll number or password.";
      setError(err.message || fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <header className="login-header">
        <div className="login-brand">Exam Creator Portal</div>
        <div className="login-secure-tag">
          <ShieldCheck size={14} />
          <span>Protected Authentication</span>
        </div>
      </header>

      <main className="login-main">
        <section className="login-left">
          <p className="login-left-eyebrow">Candidate Access</p>
          <h1>Secure Sign-in for Exam Delivery</h1>
          <p>
            Students must login with username or roll number. Admin must login with registered email.
            After successful login, assigned exam instructions will open directly.
          </p>
          <div className="login-left-note">
            Do not share credentials. Exam sessions are monitored and policy-protected.
          </div>
        </section>

        <section className="login-card">
          <h2>Sign In</h2>
          <p>Use your credentials to continue.</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="username">Username / Email</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Student username/roll number or admin email"
              autoComplete="username"
              required
            />

            <label htmlFor="password">Password</label>
            <div className="login-password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error ? <div className="login-error">{error}</div> : null}

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="login-helper">Students: username/roll number | Admin: email</div>
        </section>
      </main>

      <footer className="login-footer">Exam Creator Suite - Role-based secure login</footer>
    </div>
  );
}
