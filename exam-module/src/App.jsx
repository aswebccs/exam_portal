import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import AdminPanelPage from "./pages/AdminPanelPage";
import ExamsPage from "./pages/ExamsPage";
import InstructionsPage from "./pages/InstructionsPage";
import ExamPage from "./pages/ExamPage";
import ResultPage from "./pages/ResultPage";

const TOKEN_KEY = "exam_module_token";
const USER_KEY = "exam_module_user";
const ROLE_KEY = "exam_module_role";
const RESULT_KEY = "exam_module_last_result";

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getRole: () => localStorage.getItem(ROLE_KEY),
  setSession: ({ token, user, student, role = "student" }) => {
    const actor = user || student || null;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(actor));
    localStorage.setItem(ROLE_KEY, role);
    localStorage.setItem("token", token);
    localStorage.setItem("user_type", role === "admin" ? "1" : "3");
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem("token");
    localStorage.removeItem("user_type");
  },
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  },
  getStudent: () => authStorage.getUser(),
  setLastResult: (result) => localStorage.setItem(RESULT_KEY, JSON.stringify(result)),
  getLastResult: () => {
    try {
      return JSON.parse(localStorage.getItem(RESULT_KEY) || "null");
    } catch {
      return null;
    }
  },
};

const ProtectedRoute = ({ children, role = "student" }) => {
  const token = authStorage.getToken();
  const activeRole = authStorage.getRole();
  if (!token || activeRole !== role) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute role="admin">
              <AdminPanelPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exams"
          element={
            <ProtectedRoute role="student">
              <ExamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exams/:examId/instructions"
          element={
            <ProtectedRoute role="student">
              <InstructionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exams/:examId/start"
          element={
            <ProtectedRoute role="student">
              <ExamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/result"
          element={
            <ProtectedRoute role="student">
              <ResultPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
