import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { examApi } from "../api";
import { authStorage } from "../App";

export default function ExamsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAssignedExams = async () => {
      setLoading(true);
      setError("");
      try {
        const token = authStorage.getToken();
        const response = await examApi.getExams(token);
        const examRows = response.data || [];
        if (!examRows.length) {
          setError("No exam assigned to you.");
          return;
        }
        const targetExam = examRows.find((exam) => !exam.has_attempted) || examRows[0];
        navigate(`/exams/${targetExam.id}/instructions`, { replace: true });
      } catch (err) {
        setError(err.message || "Failed to load exams");
      } finally {
        setLoading(false);
      }
    };
    loadAssignedExams();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#f3f6fb]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 w-full max-w-lg text-center">
            <p className="text-gray-600">Loading exam...</p>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 w-full max-w-lg text-center">
            <p className="text-gray-700">{error}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
