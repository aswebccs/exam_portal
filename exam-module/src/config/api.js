// API Configuration
const normalizeUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

const DEFAULT_MODULE_BASE = "http://localhost:5000/api/exam-module";
const PRIMARY_MODULE_BASE = normalizeUrl(import.meta.env.VITE_API_URL) || DEFAULT_MODULE_BASE;
const FALLBACK_MODULE_BASE = normalizeUrl(import.meta.env.VITE_API_FALLBACK_URL);

export const API_MODULE_BASES = Array.from(
  new Set([PRIMARY_MODULE_BASE, FALLBACK_MODULE_BASE].filter(Boolean))
);

const toApiRoot = (moduleBase) => {
  if (moduleBase.endsWith("/api/exam-module")) {
    return moduleBase.slice(0, -"/api/exam-module".length);
  }
  return moduleBase.replace(/\/api\/?$/, "");
};

export const API_ROOT_BASES = Array.from(new Set(API_MODULE_BASES.map(toApiRoot).filter(Boolean)));

const PRIMARY_API_ROOT = API_ROOT_BASES[0] || "http://localhost:5000";

const API_BASE_URL =
  normalizeUrl(import.meta.env.VITE_API_BASE) || `${PRIMARY_API_ROOT}/api`;

const toPath = (path) => {
  const trimmed = String(path || "").trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const shouldRetryResponse = (response) => response.status >= 500 || response.status === 429;

export const fetchWithFailover = async (path, options = {}, config = {}) => {
  const scope = config.scope === "root" ? "root" : "module";
  const bases = scope === "root" ? API_ROOT_BASES : API_MODULE_BASES;
  const targetPath = toPath(path);

  let lastError = null;

  for (let i = 0; i < bases.length; i += 1) {
    const base = bases[i];
    const url = `${base}${targetPath}`;
    const isLast = i === bases.length - 1;

    try {
      const response = await fetch(url, options);
      if (response.ok || isLast || !shouldRetryResponse(response)) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
      if (isLast) throw error;
    }
  }

  throw lastError || new Error("All API backends are unavailable");
};

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
