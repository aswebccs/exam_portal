import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { examApi } from "../api";
import { authStorage } from "../App";
import "./InstructionsPage.css";

const EXAM_LOCK_KEY = "exam_module_lock";

const typeLabelMap = {
  MSA: "Multiple Choice Single Answer",
  MMA: "Multiple Choice Multiple Answers",
  TOF: "True / False",
  SAQ: "Short Answer",
  MTF: "Match the Following",
  ORD: "Ordering / Sequence",
  FIB: "Fill in the Blanks",
};

export default function InstructionsPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);
  const hasQuestions = Number(data?.total_questions || 0) > 0;

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const token = authStorage.getToken();
        const examsResponse = await examApi.getExams(token);
        const assignedExams = examsResponse.data || [];
        const currentExam = assignedExams.find((exam) => String(exam.id) === String(examId));

        if (currentExam?.has_attempted) {
          setAlreadyAttempted(true);
          setData({
            title: currentExam.title || "Exam",
            duration_minutes: currentExam.duration_minutes || 0,
            total_questions: currentExam.total_questions || 0,
            question_type_counts: {},
            instructions: [],
          });
          return;
        }

        const response = await examApi.getInstructions(examId, token);
        setData(response.data || null);
      } catch (err) {
        setError(err.message || "Failed to load exam details");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [examId]);

  useEffect(() => {
    const handlePopState = () => {
      setShowExitWarning(true);
      window.history.pushState({ examInstruction: true }, "", window.location.href);
    };

    window.history.pushState({ examInstruction: true }, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const questionTypes = useMemo(() => {
    const counts = data?.question_type_counts || {};
    return Object.entries(counts).map(([code, count]) => ({
      code,
      count,
      label: typeLabelMap[String(code).toUpperCase()] || code,
    }));
  }, [data]);

  const handleStart = async () => {
    if (!hasQuestions) {
      setError("This exam has no questions yet. Please contact admin.");
      return;
    }
    if (!accepted) {
      setError("Please accept the instructions checkbox.");
      return;
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      }
    } catch {
      setError("Please allow full-screen mode to start exam.");
      return;
    }

    sessionStorage.setItem(
      EXAM_LOCK_KEY,
      JSON.stringify({ examId: String(examId), status: "in_progress", startedAt: Date.now() })
    );
    navigate(`/exams/${examId}/start`);
  };

  const handleExit = () => {
    sessionStorage.removeItem(EXAM_LOCK_KEY);
    authStorage.setLastResult(null);
    authStorage.clear();
    navigate("/login", { replace: true, state: { message: "You exited from exam instructions." } });
  };

  if (loading) {
    return (
      <div className="ip-center-wrap">
        <div className="ip-center-card">
          <div className="ip-loader" />
          <p>Loading exam details...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ip-center-wrap">
        <div className="ip-center-card ip-error-card">
          <p>{error || "Exam not found."}</p>
          <button type="button" onClick={() => navigate("/login")}>Back to Login</button>
        </div>
      </div>
    );
  }

  if (alreadyAttempted) {
    return (
      <div className="ip-center-wrap">
        <div className="ip-center-card">
          <p className="text-[15px] font-semibold text-gray-800">You already attempted this exam.</p>
          <p className="text-sm text-gray-600 mt-2">{data?.title || "Exam"}</p>
          <button type="button" onClick={() => navigate("/login")} style={{ marginTop: 12 }} className="ip-start-btn" >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ip-root">
      <header className="ip-header">
        <div className="ip-brand">Exam Creator Portal</div>
        <div className="ip-header-tag">
          <ShieldCheck size={14} />
          <span>Instruction Verification</span>
        </div>
      </header>

      <main className="ip-main">
        <section className="ip-content-card">
          <p className="ip-eyebrow">Exam Brief</p>
          <h1>{data.title}</h1>
          <p className="ip-sub">Please review all details and instructions before starting your exam.</p>

          <div className="ip-metrics-grid">
            <div className="ip-metric">
              <span>Duration</span>
              <strong>{data.duration_minutes || 60} Min</strong>
            </div>
            <div className="ip-metric">
              <span>Questions</span>
              <strong>{data.total_questions || 0}</strong>
            </div>
            <div className="ip-metric">
              <span>Total Marks</span>
              <strong>{data.total_questions || 0}</strong>
            </div>
          </div>

          <div className="ip-block">
            <h3>Question Types</h3>
            <div className="ip-list">
              {questionTypes.length ? (
                questionTypes.map((qt) => (
                  <div key={qt.code} className="ip-list-row">
                    <span>{qt.label}</span>
                    <small>{qt.count} Questions</small>
                  </div>
                ))
              ) : (
                <div className="ip-list-empty">No questions available</div>
              )}
            </div>
          </div>

          <div className="ip-block">
            <h3>General Instructions</h3>
            <ul className="ip-rules">
              {(data.instructions || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="ip-action-card">
          <label className="ip-checkbox-row">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked);
                setError("");
              }}
            />
            <span>I have read all instructions and understood them.</span>
          </label>

          {!hasQuestions ? <div className="ip-warn">This exam has no questions yet. Start is disabled.</div> : null}
          {error ? <div className="ip-error">{error}</div> : null}

          <button
            type="button"
            onClick={handleStart}
            disabled={!accepted || !hasQuestions}
            className="ip-start-btn"
          >
            Start Test
          </button>
        </aside>
      </main>

      <footer className="ip-footer">Exam Creator Suite - Candidate instruction verification stage</footer>

      {showExitWarning ? (
        <div className="ip-modal-overlay">
          <div className="ip-modal">
            <div className="ip-modal-head">
              <div className="ip-modal-icon"><AlertTriangle size={18} /></div>
              <div>
                <h4>Back navigation is restricted</h4>
                <p>You cannot go back from here. If you want to leave, click Exit.</p>
              </div>
            </div>
            <div className="ip-modal-actions">
              <button type="button" onClick={() => setShowExitWarning(false)} className="ip-btn-muted">Continue</button>
              <button type="button" onClick={handleExit} className="ip-btn-danger">Exit</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
