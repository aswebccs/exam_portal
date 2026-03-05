// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export const API_ENDPOINTS = {
  // Categories
  CATEGORIES_TRASH_LIST: `${API_BASE_URL}/exam-management/categories/trash/list`,
  CATEGORY_RESTORE: (id) => `${API_BASE_URL}/exam-management/categories/${id}/restore`,
  CATEGORY_PERMANENT_DELETE: (id) => `${API_BASE_URL}/exam-management/categories/${id}/permanent`,
  CATEGORY_DELETE: (id) => `${API_BASE_URL}/exam-management/categories/${id}`,

  // Subcategories
  SUBCATEGORIES_TRASH_LIST: `${API_BASE_URL}/exam-management/subcategories/trash/list`,
  SUBCATEGORY_RESTORE: (id) => `${API_BASE_URL}/exam-management/subcategories/${id}/restore`,
  SUBCATEGORY_PERMANENT_DELETE: (id) => `${API_BASE_URL}/exam-management/subcategories/${id}/permanent`,
  SUBCATEGORY_DELETE: (id) => `${API_BASE_URL}/exam-management/subcategories/${id}`,

  // Exams
  EXAMS_TRASH_LIST: `${API_BASE_URL}/exam-management/exams/trash/list`,
  EXAM_RESTORE: (id) => `${API_BASE_URL}/exam-management/exams/${id}/restore`,
  EXAM_PERMANENT_DELETE: (id) => `${API_BASE_URL}/exam-management/exams/${id}/permanent`,
  EXAM_DELETE: (id) => `${API_BASE_URL}/exam-management/exams/${id}`,

  // Questions
  QUESTIONS_TRASH_LIST: `${API_BASE_URL}/exam-management/questions/trash/list`,
  QUESTION_RESTORE: (id) => `${API_BASE_URL}/exam-management/questions/${id}/restore`,
  QUESTION_PERMANENT_DELETE: (id) => `${API_BASE_URL}/exam-management/questions/${id}/permanent`,
  QUESTION_DELETE_IN_EXAM: (examId, questionId) => `${API_BASE_URL}/exam-management/exams/${examId}/questions/${questionId}`,
};

export default API_BASE_URL;
