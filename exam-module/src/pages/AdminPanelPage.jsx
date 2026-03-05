import React from "react";
import { useLocation, Navigate } from "react-router-dom";
import AdminLayout from "../components/admin/AdminLayout";
import Exam from "../components/admin/ExamManagement/Exam";
import Questions from "../components/admin/ExamManagement/Questions";
import QuestionTypes from "../components/admin/ExamManagement/QuestionTypes";
import ExamAttempts from "../components/admin/ExamManagement/ExamAttempts";
import RecycleBin from "../components/admin/ExamManagement/RecycleBin";
import StudentsManagement from "../components/admin/ExamManagement/StudentsManagement";
import InstituteManagement from "../components/admin/ExamManagement/InstituteManagement";
import GroupManagement from "../components/admin/ExamManagement/GroupManagement";
import ResultManagement from "../components/admin/ExamManagement/ResultManagement";

const Placeholder = ({ title }) => (
  <div className="min-h-[300px] bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold text-gray-800 mb-2">{title}</h2>
    <p className="text-gray-600">This section is not used in this setup.</p>
  </div>
);

export default function AdminPanelPage() {
  const location = useLocation();
  const path = location.pathname;

  let content = null;

  if (path === "/admin" || path === "/admin/exam-management/exam") {
    content = <Exam />;
  } else if (path === "/admin/exam-management/questions") {
    content = <Questions />;
  } else if (path === "/admin/exam-management/question-types") {
    content = <QuestionTypes />;
  } else if (path === "/admin/exam-management/attempts") {
    content = <ExamAttempts />;
  } else if (path === "/admin/exam-management/recycle-bin") {
    content = <RecycleBin />;
  } else if (path === "/admin/exam-management/students") {
    content = <StudentsManagement key="students-page" mode="students" />;
  } else if (path === "/admin/exam-management/assignments") {
    content = <StudentsManagement key="assignments-page" mode="assignments" />;
  } else if (path === "/admin/exam-management/institutes") {
    content = <InstituteManagement />;
  } else if (path === "/admin/exam-management/groups") {
    content = <GroupManagement />;
  } else if (path === "/admin/exam-management/results") {
    content = <ResultManagement />;
  } else if (path === "/admin/exam-management/category") {
    content = <Placeholder title="Categories" />;
  } else if (path === "/admin/exam-management/subcategory") {
    content = <Placeholder title="Subcategories" />;
  } else {
    return <Navigate to="/admin/exam-management/exam" replace />;
  }

  return <AdminLayout>{content}</AdminLayout>;
}
