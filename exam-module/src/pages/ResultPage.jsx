import React from "react";
import { Award } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { examApi } from "../api";
import { authStorage } from "../App";

const EXAM_LOCK_KEY = "exam_module_lock";
const AUTO_LOGOUT_SECONDS = 300;

export default function ResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialResult = location.state?.result || authStorage.getLastResult();
  const stateExamId = location.state?.examId;
  const effectiveExamId = stateExamId || initialResult?.exam_id;
  const [result, setResult] = React.useState(initialResult);
  const [loading, setLoading] = React.useState(Boolean(effectiveExamId));
  const [secondsLeft, setSecondsLeft] = React.useState(AUTO_LOGOUT_SECONDS);

  React.useEffect(() => {
    sessionStorage.removeItem(EXAM_LOCK_KEY);
  }, []);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (secondsLeft > 0) return;
    authStorage.setLastResult(null);
    authStorage.clear();
    navigate("/login", { replace: true });
  }, [secondsLeft, navigate]);

  React.useEffect(() => {
    const verify = async () => {
      if (!effectiveExamId) {
        setLoading(false);
        return;
      }
      try {
        const token = authStorage.getToken();
        const response = await examApi.getStudentResult(effectiveExamId, token);
        setResult(response.data || initialResult);
        authStorage.setLastResult(response.data || initialResult);
      } catch (_err) {
        authStorage.setLastResult(null);
        navigate("/login", { replace: true });
        return;
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [effectiveExamId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 text-center">
          <p className="text-gray-700">Loading result...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow border p-6 text-center">
          <p className="text-gray-700">No result found.</p>
        </div>
      </div>
    );
  }

  const showResult = result?.show_result !== false;
  const passed = String(result.result_status || "").toUpperCase() === "PASSED";
  const percentageNum = Number(result.percentage || 0);
  const passMark = Number(result.pass_percentage || 70);
  const countdownLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl w-full mx-auto flex items-center justify-center py-8 px-4">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-blue-600 p-6">
            <h2 className="text-2xl font-bold text-white mb-1">{result.exam_title || "Exam Result"}</h2>
            <p className="text-blue-100">Skill Test Results</p>
          </div>

          <div className="p-8">
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
              You will be logged out automatically in <span className="font-semibold">{countdownLabel}</span>.
            </div>

            {showResult ? (
              <>
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div className="text-center">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Answered</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {result.score}/{result.total_questions}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Percentage</p>
                      <p className="text-2xl font-bold text-gray-900">{percentageNum}%</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Score</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {result.score}/{result.total_questions}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Pass/Fail</p>
                      <p className={`text-2xl font-bold ${passed ? "text-green-600" : "text-red-600"}`}>
                        {passed ? "Passed" : "Failed"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>Pass Percentage: {passMark}%</strong>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600">{result.total_questions}</div>
                    <div className="text-sm text-gray-600 mt-1">Total Questions</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{result.score}</div>
                    <div className="text-sm text-gray-600 mt-1">Correct Answers</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">
                      {Math.max(0, Number(result.total_questions || 0) - Number(result.score || 0))}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Wrong Answers</div>
                  </div>
                </div>

                <div
                  className={`border-l-4 p-5 rounded-lg mb-8 ${
                    percentageNum >= 80
                      ? "bg-green-50 border-green-500"
                      : percentageNum >= 60
                      ? "bg-blue-50 border-blue-500"
                      : percentageNum >= passMark
                      ? "bg-yellow-50 border-yellow-500"
                      : "bg-red-50 border-red-500"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Award
                      className={`w-6 h-6 mt-0.5 ${
                        percentageNum >= 80
                          ? "text-green-600"
                          : percentageNum >= 60
                          ? "text-blue-600"
                          : percentageNum >= passMark
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    />
                    <div>
                      <h3
                        className={`font-bold mb-1 ${
                          percentageNum >= 80
                            ? "text-green-800"
                            : percentageNum >= 60
                            ? "text-blue-800"
                            : percentageNum >= passMark
                            ? "text-yellow-800"
                            : "text-red-800"
                        }`}
                      >
                        {percentageNum >= 80
                          ? "Outstanding Performance!"
                          : percentageNum >= 60
                          ? "Good Job!"
                          : percentageNum >= passMark
                          ? "Passed!"
                          : "Needs Improvement"}
                      </h3>
                      <p
                        className={`text-sm ${
                          percentageNum >= 80
                            ? "text-green-700"
                            : percentageNum >= 60
                            ? "text-blue-700"
                            : percentageNum >= passMark
                            ? "text-yellow-700"
                            : "text-red-700"
                        }`}
                      >
                        {percentageNum >= 80
                          ? "Excellent work! You have a strong grasp of the material."
                          : percentageNum >= 60
                          ? "Well done! You have a good understanding of most topics."
                          : percentageNum >= passMark
                          ? "You passed the test. Consider reviewing the topics you missed."
                          : "Please review and try again after preparation."}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Thank you for completing the exam.</h3>
                <p className="text-gray-700">Your response has been recorded.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
