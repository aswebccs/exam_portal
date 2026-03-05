import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Clock, Flag, Send, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { examApi } from "../api";
import { authStorage } from "../App";

const EXAM_LOCK_KEY = "exam_module_lock";

const getInitialSeconds = (durationMinutes) => Math.max(1, Number(durationMinutes || 60)) * 60;

const formatClock = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function ExamPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [visited, setVisited] = useState({});
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [strictModeWarning, setStrictModeWarning] = useState("");
  const [requiresFullscreen, setRequiresFullscreen] = useState(false);
  const submittedRef = useRef(false);
  const securityExitRef = useRef(false);
  const suppressBeforeUnloadRef = useRef(false);
  const fullscreenArmedRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const token = authStorage.getToken();
        const response = await examApi.getQuestions(examId, token);
        const payload = response.data || {};
        setExam(payload.exam || null);
        setQuestions(payload.questions || []);
        setSeconds(getInitialSeconds(payload.exam?.duration_minutes));
      } catch (err) {
        setError(err.message || "Failed to load exam");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [examId]);

  useEffect(() => {
    const current = questions[index];
    if (!current?.id) return;
    setVisited((prev) => ({ ...prev, [current.id]: true }));
  }, [index, questions]);

  useEffect(() => {
    if (loading || submitting || seconds <= 0 || requiresFullscreen) return;
    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, submitting, seconds, requiresFullscreen]);

  useEffect(() => {
    if (!loading && !requiresFullscreen && seconds === 0 && questions.length) {
      handleSubmit(true);
    }
  }, [seconds, requiresFullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || !questions.length || submittedRef.current) return;
    if (document.fullscreenElement) {
      fullscreenArmedRef.current = true;
      setRequiresFullscreen(false);
      return;
    }
    setRequiresFullscreen(true);
    setStrictModeWarning("Please enable full-screen mode to continue the exam.");
  }, [loading, questions.length]);

  useEffect(() => {
    if (loading || !questions.length || submittedRef.current) return undefined;

    const handleSecurityViolation = (message) => {
      if (securityExitRef.current || submittedRef.current) return;
      securityExitRef.current = true;
      setStrictModeWarning(message);
      setError(message);
      handleSubmit(true, { forceLogoutAfterSubmit: true });
    };

    const handleBeforeUnload = (event) => {
      if (suppressBeforeUnloadRef.current || submittedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handleContextMenu = (event) => {
      event.preventDefault();
    };

    const handleKeyDown = (event) => {
      const key = String(event.key || "").toLowerCase();
      const isRefresh = key === "f5" || ((event.ctrlKey || event.metaKey) && key === "r");
      const isBack = (event.altKey && key === "arrowleft") || key === "browserback";
      const isBlocked = isRefresh || key === "f12" || ((event.ctrlKey || event.metaKey) && key === "u");
      const target = event.target;
      const targetTag = String(target?.tagName || "").toLowerCase();
      const isTextInput = targetTag === "input" || targetTag === "textarea";
      const isBackspaceNav = key === "backspace" && !isTextInput;

      if (isBlocked || isBack || isBackspaceNav) {
        event.preventDefault();
      }

      if (isBack || isBackspaceNav) {
        handleSecurityViolation("Back navigation is blocked during exam. You have been logged out.");
      }
    };

    const handlePopState = () => {
      handleSecurityViolation("Navigation is blocked during exam. You have been logged out.");
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleSecurityViolation("Tab switching is not allowed during exam. You have been logged out.");
      }
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        fullscreenArmedRef.current = true;
        setRequiresFullscreen(false);
        setStrictModeWarning("");
        return;
      }

      if (!submittedRef.current && fullscreenArmedRef.current) {
        handleSecurityViolation("Full-screen exit detected. Exam is submitted and session is closed.");
      }
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [loading, questions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentQuestion = questions[index];

  const answeredCount = useMemo(() => {
    return Object.keys(answers).filter((key) => answers[key] !== "" && answers[key] !== undefined).length;
  }, [answers]);

  const getQuestionStatus = (questionId) => {
    const id = String(questionId);
    const isAnswered = answers[id] !== undefined && answers[id] !== "";
    if (isAnswered && markedForReview[id]) return "answered-marked";
    if (isAnswered) return "answered";
    if (markedForReview[id]) return "marked";
    if (visited[id]) return "not-answered";
    return "not-visited";
  };

  const getStatusCounts = () => {
    const ids = questions.map((q) => String(q.id));
    const answered = ids.filter((id) => answers[id] !== undefined && answers[id] !== "" && !markedForReview[id]).length;
    const marked = ids.filter((id) => markedForReview[id] && (answers[id] === undefined || answers[id] === "")).length;
    const answeredMarked = ids.filter((id) => markedForReview[id] && answers[id] !== undefined && answers[id] !== "").length;
    const notAnswered = ids.filter((id) => !markedForReview[id] && visited[id] && (answers[id] === undefined || answers[id] === "")).length;
    const notVisited = ids.length - answered - marked - answeredMarked - notAnswered;
    return { answered, marked, answeredMarked, notAnswered, notVisited };
  };

  const handleAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const clearAnswer = (questionId) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const toggleMarkForReview = (questionId) => {
    setMarkedForReview((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const forceLogout = (message = "") => {
    suppressBeforeUnloadRef.current = true;
    sessionStorage.removeItem(EXAM_LOCK_KEY);
    authStorage.setLastResult(null);
    authStorage.clear();
    navigate("/login", { replace: true, state: message ? { message } : undefined });
  };

  const handleSubmit = async (autoSubmit = false, options = {}) => {
    const { forceLogoutAfterSubmit = false } = options;
    if (!autoSubmit) {
      setShowSubmitModal(true);
      return;
    }
    if (submitting || submittedRef.current) return;
    setSubmitting(true);
    setError("");
    try {
      const token = authStorage.getToken();
      const response = await examApi.submitExam(examId, answers, token);
      submittedRef.current = true;
      sessionStorage.removeItem(EXAM_LOCK_KEY);
      suppressBeforeUnloadRef.current = true;
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      if (forceLogoutAfterSubmit) {
        forceLogout("Exam session ended due to security policy.");
        return;
      }
      authStorage.setLastResult(response.data);
      navigate("/result", { replace: true, state: { result: response.data } });
    } catch (err) {
      setError(err.message || "Failed to submit exam");
      if (forceLogoutAfterSubmit) {
        forceLogout("Exam session ended due to security policy.");
      }
    } finally {
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  const handleEnableFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      if (document.fullscreenElement) {
        fullscreenArmedRef.current = true;
        setRequiresFullscreen(false);
        setStrictModeWarning("");
      } else {
        setStrictModeWarning("Full-screen mode is required to start the exam.");
      }
    } catch {
      setStrictModeWarning("Please allow full-screen mode in your browser and try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow border p-6 text-center">
          <p className="text-red-600">{error || "No questions available."}</p>
        </div>
      </div>
    );
  }

  if (requiresFullscreen) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow border p-6 text-center max-w-md w-full">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Full-screen Required</h2>
          <p className="text-sm text-gray-600 mb-4">Enable full-screen mode to begin the exam.</p>
          {strictModeWarning ? (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 text-sm font-medium">
              {strictModeWarning}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleEnableFullscreen}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
          >
            Enable Full Screen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white truncate">{exam?.title || "Exam"}</h1>
              <p className="text-xs text-blue-100">Skill Assessment Test</p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold ${
                  seconds < 300 ? "bg-red-100 text-red-700" : "bg-white text-blue-600"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatClock(seconds)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {strictModeWarning ? (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 text-sm font-medium">
            {strictModeWarning}
          </div>
        ) : null}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-lg font-semibold text-sm">
                    Q {index + 1} of {questions.length}
                  </span>
                  {markedForReview[String(currentQuestion.id)] && (
                    <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg font-medium text-xs flex items-center gap-1">
                      <Flag className="w-3 h-3" />
                      Marked for Review
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggleMarkForReview(String(currentQuestion.id))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
                    markedForReview[String(currentQuestion.id)]
                      ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                      : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  {markedForReview[String(currentQuestion.id)] ? "Unmark" : "Mark for Review"}
                </button>
              </div>

              <div className="mb-6">
                <p className="text-base text-gray-800 leading-relaxed">{currentQuestion.question_text}</p>
              </div>

              <div className="space-y-3 mb-6">
                {(currentQuestion.question_type_code === "MSA" || currentQuestion.question_type_code === "TOF") &&
                  (currentQuestion.options || []).map((option, optIndex) => {
                    const label = String.fromCharCode(65 + optIndex);
                    const checked = answers[String(currentQuestion.id)] === option;
                    return (
                      <button
                        key={`${option}-${optIndex}`}
                        onClick={() => handleAnswer(String(currentQuestion.id), option)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          checked ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                              checked ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 text-gray-600"
                            }`}
                          >
                            {label}
                          </div>
                          <span className="text-sm text-gray-800 flex-1">{option}</span>
                        </div>
                      </button>
                    );
                  })}

                {currentQuestion.question_type_code === "MMA" &&
                  (currentQuestion.options || []).map((option, optIndex) => {
                    const picked = Array.isArray(answers[String(currentQuestion.id)]) ? answers[String(currentQuestion.id)] : [];
                    const checked = picked.includes(optIndex);
                    return (
                      <label
                        key={`${option}-${optIndex}`}
                        className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          checked ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked ? picked.filter((x) => x !== optIndex) : [...picked, optIndex];
                            if (!next.length) clearAnswer(String(currentQuestion.id));
                            else handleAnswer(String(currentQuestion.id), next);
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center font-semibold text-sm flex-shrink-0 border-gray-300 text-gray-600">
                          {String.fromCharCode(65 + optIndex)}
                        </div>
                        <span className="text-sm text-gray-800 flex-1">{option}</span>
                      </label>
                    );
                  })}

                {(currentQuestion.question_type_code === "FIB" || currentQuestion.question_type_code === "SAQ") && (
                  <input
                    type="text"
                    value={answers[String(currentQuestion.id)] || ""}
                    onChange={(e) => handleAnswer(String(currentQuestion.id), e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                )}

                {currentQuestion.question_type_code === "ORD" && (
                  <input
                    type="text"
                    value={answers[String(currentQuestion.id)] || ""}
                    onChange={(e) => handleAnswer(String(currentQuestion.id), e.target.value)}
                    placeholder="Comma separated sequence"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <button
                  onClick={() => clearAnswer(String(currentQuestion.id))}
                  disabled={answers[String(currentQuestion.id)] === undefined || answers[String(currentQuestion.id)] === ""}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <X className="w-4 h-4" />
                  Clear Answer
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
                    disabled={index === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  {index < questions.length - 1 ? (
                    <button
                      onClick={() => setIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
                    >
                      Save & Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubmit(false)}
                      className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all"
                    >
                      <Send className="w-4 h-4" />
                      Finish Test
                    </button>
                  )}
                </div>
              </div>

              {error ? <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div> : null}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-5 sticky top-24">
              <h3 className="font-bold text-gray-900 mb-4">Question Palette</h3>
              {(() => {
                const stats = getStatusCounts();
                return (
                  <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 border rounded-md relative">
                          <span className="absolute bottom-0 w-full h-1 bg-green-500" />
                        </span>
                        <span>Answered</span>
                      </div>
                      <span className="font-semibold">{stats.answered}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 border rounded-md relative">
                          <span className="absolute bottom-0 w-full h-1 bg-red-500" />
                        </span>
                        <span>Not Answered</span>
                      </div>
                      <span className="font-semibold">{stats.notAnswered}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 border rounded-md relative">
                          <span className="absolute bottom-0 w-full h-1 bg-yellow-500" />
                        </span>
                        <span>Marked for Review</span>
                      </div>
                      <span className="font-semibold">{stats.marked}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 border rounded-md relative">
                          <span className="absolute bottom-0 w-full h-1 bg-purple-500" />
                        </span>
                        <span>Answered & Marked</span>
                      </div>
                      <span className="font-semibold">{stats.answeredMarked}</span>
                    </div>
                    <div className="flex items-center justify-between col-span-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 border rounded-md relative">
                          <span className="absolute bottom-0 w-full h-1 bg-gray-400" />
                        </span>
                        <span>Not Visited</span>
                      </div>
                      <span className="font-semibold">{stats.notVisited}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-4 gap-2 mb-4">
                {questions.map((q, i) => {
                  const status = getQuestionStatus(q.id);
                  return (
                    <button
                      key={String(q.id)}
                      onClick={() => setIndex(i)}
                      className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all ${
                        i === index ? "ring-1 ring-blue-500 ring-offset-2" : ""
                      } ${
                        status === "answered-marked"
                          ? "ring-1 ring-purple-500"
                          : status === "answered"
                          ? "ring-1 ring-green-500"
                          : status === "marked"
                          ? "ring-1 ring-yellow-500"
                          : status === "not-answered"
                          ? "ring-1 ring-red-500"
                          : "ring-1 ring-gray-500"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Finish Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSubmitModal ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <AlertCircle className="w-9 h-9 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Submit Skill Test?</h2>
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  You have answered <span className="font-semibold text-gray-900">{answeredCount}</span> out of{" "}
                  <span className="font-semibold text-gray-900">{questions.length}</span> questions.
                </p>
                <p className="text-red-600 font-bold mt-3">This test can only be taken once!</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Review Again
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors"
              >
                {submitting ? "Submitting..." : "Yes, Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
