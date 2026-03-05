const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/exam-module";

const parseJson = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }
  return payload;
};

export const examApi = {
  async login(username, password) {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return parseJson(response);
  },

  async loginAdmin(username, password) {
    const response = await fetch(`${API_BASE_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return parseJson(response);
  },

  async getAdminExams(token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async createExam(payload, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return parseJson(response);
  },

  async toggleAdminExam(examId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/toggle`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async setAdminExamResultVisibility(examId, showResult, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/result-visibility`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ show_result: Boolean(showResult) }),
    });
    return parseJson(response);
  },

  async deleteAdminExam(examId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async getAdminExamQuestions(examId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async createAdminExamQuestions(examId, questions, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/questions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ questions }),
    });
    return parseJson(response);
  },

  async updateAdminExamQuestion(examId, questionId, payload, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/questions/${questionId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return parseJson(response);
  },

  async deleteAdminExamQuestion(examId, questionId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/questions/${questionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async getExams(token) {
    const response = await fetch(`${API_BASE_URL}/exams`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async getInstructions(examId, token) {
    const response = await fetch(`${API_BASE_URL}/exams/${examId}/instructions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async getQuestions(examId, token) {
    const response = await fetch(`${API_BASE_URL}/exams/${examId}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async getStudentResult(examId, token) {
    const response = await fetch(`${API_BASE_URL}/exams/${examId}/result`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async submitExam(examId, answers, token) {
    const response = await fetch(`${API_BASE_URL}/exams/${examId}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answers }),
    });
    return parseJson(response);
  },

  async getAdminStudents(token, filters = {}) {
    const params = new URLSearchParams();
    if (String(filters.search || "").trim()) params.set("search", String(filters.search).trim());
    if (String(filters.roll_number || "").trim()) params.set("roll_number", String(filters.roll_number).trim());
    if (String(filters.institute_id || "").trim()) params.set("institute_id", String(filters.institute_id).trim());
    if (String(filters.group_id || "").trim()) params.set("group_id", String(filters.group_id).trim());
    if (filters.is_active === true || filters.is_active === false) params.set("is_active", String(filters.is_active));
    const response = await fetch(`${API_BASE_URL}/admin/students?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async createAdminStudent(payload, token) {
    const response = await fetch(`${API_BASE_URL}/admin/students`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return parseJson(response);
  },

  async updateAdminStudent(studentId, payload, token) {
    const response = await fetch(`${API_BASE_URL}/admin/students/${studentId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return parseJson(response);
  },

  async updateAdminStudentStatus(studentId, isActive, token) {
    const response = await fetch(`${API_BASE_URL}/admin/students/${studentId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_active: Boolean(isActive) }),
    });
    return parseJson(response);
  },

  async getAdminInstitutes(token, search = "") {
    const params = new URLSearchParams();
    if (String(search || "").trim()) params.set("search", String(search).trim());
    const response = await fetch(`${API_BASE_URL}/admin/institutes?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async createAdminInstitute(instituteName, token) {
    const response = await fetch(`${API_BASE_URL}/admin/institutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ institute_name: instituteName }),
    });
    return parseJson(response);
  },

  async updateAdminInstitute(instituteId, instituteName, token) {
    const response = await fetch(`${API_BASE_URL}/admin/institutes/${instituteId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ institute_name: instituteName }),
    });
    return parseJson(response);
  },

  async deleteAdminInstitute(instituteId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/institutes/${instituteId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async getAdminGroups(token, instituteId = "", search = "") {
    const params = new URLSearchParams();
    if (String(instituteId || "").trim()) params.set("institute_id", String(instituteId).trim());
    if (String(search || "").trim()) params.set("search", String(search).trim());
    const response = await fetch(`${API_BASE_URL}/admin/groups?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async createAdminGroup(payload, token) {
    const response = await fetch(`${API_BASE_URL}/admin/groups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return parseJson(response);
  },

  async updateAdminGroup(groupId, payload, token) {
    const response = await fetch(`${API_BASE_URL}/admin/groups/${groupId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return parseJson(response);
  },

  async deleteAdminGroup(groupId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/groups/${groupId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async getDeletedInstitutes(token) {
    const response = await fetch(`${API_BASE_URL}/admin/recycle-bin/institutes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async restoreDeletedInstitute(instituteId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/recycle-bin/institutes/${instituteId}/restore`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async permanentlyDeleteInstitute(instituteId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/recycle-bin/institutes/${instituteId}/permanent`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async getDeletedGroups(token) {
    const response = await fetch(`${API_BASE_URL}/admin/recycle-bin/groups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async restoreDeletedGroup(groupId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/recycle-bin/groups/${groupId}/restore`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async permanentlyDeleteGroup(groupId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/recycle-bin/groups/${groupId}/permanent`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async bulkUploadStudents(file, token) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/admin/students/bulk-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return parseJson(response);
  },

  async assignStudentsToExam(examId, studentIds, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/assignments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ student_ids: studentIds }),
    });
    return parseJson(response);
  },

  async getExamAssignments(examId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/assignments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async getExamAssignmentLogs(examId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/assignment-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async removeExamAssignment(examId, studentId, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/assignments/${studentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async setStudentResultVisibility(examId, studentId, showResult, token) {
    const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/assignments/${studentId}/result-visibility`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ show_result: Boolean(showResult) }),
    });
    return parseJson(response);
  },

  async getAdminResults(token, filters = {}) {
    const params = new URLSearchParams();
    if (filters.exam_id) params.set("exam_id", String(filters.exam_id));
    if (filters.student_id) params.set("student_id", String(filters.student_id));
    if (filters.institute_id) params.set("institute_id", String(filters.institute_id));
    if (filters.group_id) params.set("group_id", String(filters.group_id));
    if (filters.result_status) params.set("result_status", String(filters.result_status));
    const queryString = params.toString();
    const response = await fetch(`${API_BASE_URL}/admin/results${queryString ? `?${queryString}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseJson(response);
  },

  async exportAdminResults(token, format = "csv", filters = {}) {
    const params = new URLSearchParams();
    params.set("format", format);
    if (filters.exam_id) params.set("exam_id", String(filters.exam_id));
    if (filters.student_id) params.set("student_id", String(filters.student_id));
    if (filters.institute_id) params.set("institute_id", String(filters.institute_id));
    if (filters.group_id) params.set("group_id", String(filters.group_id));
    if (filters.result_status) params.set("result_status", String(filters.result_status));

    const response = await fetch(`${API_BASE_URL}/admin/results/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const json = await response.json();
        message = json?.message || message;
      } catch {
        // ignore JSON parse failures
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename=\"?([^"]+)\"?/i);
    return {
      blob,
      filename: match?.[1] || `exam-results.${format === "xlsx" ? "xlsx" : "csv"}`,
    };
  },
};
