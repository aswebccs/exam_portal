import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { examApi } from "../api";
import { authStorage } from "../App";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await examApi.loginAdmin(username.trim(), password);
      authStorage.setSession({
        token: response.token,
        user: response.admin,
        role: "admin",
      });
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-center">
      <section className="card card-sm">
        <h1>Admin Login</h1>
        <p className="muted">Sign in with admin email and password.</p>
        <form onSubmit={handleSubmit} className="form">
          <label>
            Email
            <input
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin email"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Login as Admin"}
          </button>
        </form>
        <p className="muted">
          Student? <Link to="/login">Go to student login</Link>
        </p>
      </section>
    </main>
  );
}
