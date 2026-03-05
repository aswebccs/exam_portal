const pool = require("../db");

const levelList = [];
const examTypes = [];

let questionTypes = [
  { id: 1, code: "MSA", name: "Multiple Choice Single Answer", is_active: true, short_description: "" },
  { id: 2, code: "MMA", name: "Multiple Choice Multiple Answers", is_active: true, short_description: "" },
  { id: 3, code: "TOF", name: "True or False", is_active: true, short_description: "" },
  { id: 4, code: "SAQ", name: "Short Answer", is_active: true, short_description: "" },
  { id: 5, code: "MTF", name: "Match the Following", is_active: true, short_description: "" },
  { id: 6, code: "ORD", name: "Ordering/Sequence", is_active: true, short_description: "" },
  { id: 7, code: "FIB", name: "Fill in the Blanks", is_active: true, short_description: "" },
];

const categoryList = [];
const subCategoryList = [];

const examMetaById = new Map();
const examModulesByExamId = new Map();
let moduleCounter = 1000;

const toInt = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const paginate = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

const buildExamPayload = (row) => {
  const meta = examMetaById.get(Number(row.id)) || {};
  return {
    ...row,
    code: `EXM${String(row.id).padStart(3, "0")}`,
    total_marks: meta.total_marks || 100,
    description: meta.description || "",
    show_result: row.show_result ?? true,
  };
};

exports.getCategories = async (_req, res) => {
  res.json({ success: true, data: categoryList });
};

exports.getSubcategories = async (req, res) => {
  const categoryId = toInt(req.query.category_id, 1);
  res.json({ success: true, data: subCategoryList.filter((x) => Number(x.category_id) === Number(categoryId)) });
};

exports.getLevels = async (_req, res) => {
  res.json({ success: true, data: levelList });
};

exports.getExamTypes = async (_req, res) => {
  res.json({ success: true, data: examTypes });
};

exports.getQuestionTypes = async (_req, res) => {
  res.json({ success: true, data: questionTypes });
};

exports.toggleQuestionType = async (req, res) => {
  const id = toInt(req.params.id, 0);
  questionTypes = questionTypes.map((q) => (q.id === id ? { ...q, is_active: !q.is_active } : q));
  res.json({ success: true, message: "Question type status updated" });
};

exports.uploadBadge = async (_req, res) => {
  res.json({
    success: true,
    data: {
      secure_url: "https://dummyimage.com/300x300/e5e7eb/374151.png&text=Badge",
    },
  });
};

exports.listExams = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.max(1, toInt(req.query.limit, 10));
    const searchTitle = String(req.query.search_title || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toLowerCase();

    const base = await pool.query(
      `
      SELECT
        e.id, e.title, e.duration_minutes, e.passing_score, e.show_result, e.is_active, e.is_deleted, e.created_at,
        COALESCE(q.total_questions, 0) AS total_questions
      FROM exams e
      LEFT JOIN (
        SELECT exam_id, COUNT(*)::int AS total_questions
        FROM exam_questions
        WHERE is_deleted = FALSE
        GROUP BY exam_id
      ) q ON q.exam_id = e.id
      ORDER BY e.created_at DESC
      `
    );

    let rows = base.rows.filter((r) => !r.is_deleted);
    if (searchTitle) rows = rows.filter((r) => String(r.title || "").toLowerCase().includes(searchTitle));
    if (status === "active") rows = rows.filter((r) => r.is_active);
    if (status === "inactive") rows = rows.filter((r) => !r.is_active);

    const total = rows.length;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit).map(buildExamPayload);

    res.json({ success: true, data, pagination: paginate(page, limit, total) });
  } catch (err) {
    console.error("COMPAT LIST EXAMS ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getExamById = async (req, res) => {
  try {
    const examId = toInt(req.params.id, 0);
    const result = await pool.query(
      `
      SELECT id, title, duration_minutes, passing_score, show_result, is_active, is_deleted, created_at
      FROM exams WHERE id = $1 LIMIT 1
      `,
      [examId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "Exam not found" });
    res.json({ success: true, data: buildExamPayload(result.rows[0]) });
  } catch (err) {
    console.error("COMPAT GET EXAM ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createExam = async (req, res) => {
  try {
    const payload = req.body || {};
    const title = String(payload.title || "").trim();
    if (!title) return res.status(400).json({ success: false, message: "Exam title is required" });

    const durationMinutes = Math.max(1, toInt(payload.duration_minutes, 60));
    const passingScore = Math.max(0, Math.min(100, toInt(payload.passing_score, 70)));
    const isActive = payload.is_active !== false;
    const showResult = payload.show_result !== false;

    const insert = await pool.query(
      `
      INSERT INTO exams (title, duration_minutes, passing_score, is_active, show_result, is_deleted)
      VALUES ($1, $2, $3, $4, $5, FALSE)
      RETURNING id, title, duration_minutes, passing_score, show_result, is_active, is_deleted, created_at
      `,
      [title, durationMinutes, passingScore, isActive, showResult]
    );

    const exam = insert.rows[0];
    examMetaById.set(Number(exam.id), {
      total_marks: toInt(payload.total_marks, 100),
      description: payload.description || "",
    });

    res.status(201).json({ success: true, message: "Exam created", data: buildExamPayload(exam) });
  } catch (err) {
    console.error("COMPAT CREATE EXAM ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateExam = async (req, res) => {
  try {
    const examId = toInt(req.params.id, 0);
    const payload = req.body || {};
    const title = String(payload.title || "").trim();
    if (!title) return res.status(400).json({ success: false, message: "Exam title is required" });

    const update = await pool.query(
      `
      UPDATE exams
      SET title = $1, duration_minutes = $2, passing_score = $3, is_active = $4, show_result = $5
      WHERE id = $6 AND is_deleted = FALSE
      RETURNING id, title, duration_minutes, passing_score, show_result, is_active, is_deleted, created_at
      `,
      [
        title,
        Math.max(1, toInt(payload.duration_minutes, 60)),
        Math.max(0, Math.min(100, toInt(payload.passing_score, 70))),
        payload.is_active !== false,
        payload.show_result !== false,
        examId
      ]
    );

    if (!update.rows.length) return res.status(404).json({ success: false, message: "Exam not found" });
    examMetaById.set(examId, {
      ...(examMetaById.get(examId) || {}),
      total_marks: toInt(payload.total_marks, 100),
      description: payload.description || "",
    });

    res.json({ success: true, message: "Exam updated", data: buildExamPayload(update.rows[0]) });
  } catch (err) {
    console.error("COMPAT UPDATE EXAM ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteExam = async (req, res) => {
  try {
    const examId = toInt(req.params.id, 0);
    const force = String(req.query.force || "").trim().toLowerCase() === "true";
    const attemptRes = await pool.query(`SELECT COUNT(*)::int AS attempt_count FROM exam_attempts WHERE exam_id = $1`, [examId]);
    const attemptCount = Number(attemptRes.rows[0]?.attempt_count || 0);
    if (attemptCount > 0 && !force) {
      return res.status(409).json({
        success: false,
        message: `This exam has ${attemptCount} attempt(s). Delete only if you are sure.`,
        requires_force: true,
        attempted_count: attemptCount,
      });
    }
    const result = await pool.query(
      `UPDATE exams SET is_deleted = TRUE WHERE id = $1 AND is_deleted = FALSE RETURNING id`,
      [examId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "Exam not found" });
    await pool.query(`UPDATE exam_questions SET is_deleted = TRUE WHERE exam_id = $1`, [examId]);
    res.json({ success: true, message: "Exam deleted and moved to trash" });
  } catch (err) {
    console.error("COMPAT DELETE EXAM ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.toggleExam = async (req, res) => {
  try {
    const examId = toInt(req.params.id, 0);
    const force = String(req.query.force || "").trim().toLowerCase() === "true";
    const currentExamRes = await pool.query(
      `SELECT id, is_active FROM exams WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
      [examId]
    );
    if (!currentExamRes.rows.length) return res.status(404).json({ success: false, message: "Exam not found" });
    if (currentExamRes.rows[0].is_active) {
      const attemptRes = await pool.query(`SELECT COUNT(*)::int AS attempt_count FROM exam_attempts WHERE exam_id = $1`, [examId]);
      const attemptCount = Number(attemptRes.rows[0]?.attempt_count || 0);
      if (attemptCount > 0 && !force) {
        return res.status(409).json({
          success: false,
          message: `This exam has ${attemptCount} attempt(s). Deactivating can impact students.`,
          requires_force: true,
          attempted_count: attemptCount,
        });
      }
    }
    const result = await pool.query(
      `UPDATE exams SET is_active = NOT is_active WHERE id = $1 AND is_deleted = FALSE RETURNING is_active`,
      [examId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "Exam not found" });
    res.json({ success: true, message: "Status updated", data: result.rows[0] });
  } catch (err) {
    console.error("COMPAT TOGGLE EXAM ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.toggleExamResultVisibility = async (req, res) => {
  try {
    const examId = toInt(req.params.id, 0);
    const result = await pool.query(
      `UPDATE exams SET show_result = NOT show_result WHERE id = $1 AND is_deleted = FALSE RETURNING show_result`,
      [examId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "Exam not found" });
    res.json({ success: true, message: "Result visibility updated", data: result.rows[0] });
  } catch (err) {
    console.error("COMPAT TOGGLE RESULT VISIBILITY ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getExamModules = async (req, res) => {
  const examId = toInt(req.params.examId, 0);
  if (!examModulesByExamId.has(examId)) examModulesByExamId.set(examId, []);
  res.json({ success: true, data: examModulesByExamId.get(examId) });
};

exports.createExamModules = async (req, res) => {
  const examId = toInt(req.params.examId, 0);
  const modules = Array.isArray(req.body?.modules) ? req.body.modules : [];
  const existing = examModulesByExamId.get(examId) || [];
  const next = modules.map((m) => ({
    id: ++moduleCounter,
    exam_id: examId,
    module_type: m.module_type || "MCQs",
    title: m.title || m.module_type || "Module",
    display_order: toInt(m.display_order, existing.length + 1),
  }));
  examModulesByExamId.set(examId, [...existing, ...next]);
  res.status(201).json({ success: true, data: next });
};

exports.getExamQuestions = async (req, res) => {
  try {
    const examId = toInt(req.params.examId, 0);
    const result = await pool.query(
      `
      SELECT id, exam_id, question_text, question_data, display_order, created_at
      FROM exam_questions
      WHERE exam_id = $1 AND is_deleted = FALSE
      ORDER BY display_order ASC, created_at ASC
      `,
      [examId]
    );
    const data = result.rows.map((q) => ({
      ...q,
      module_id: q.question_data?.module_id || 1,
      marks: q.question_data?.marks || 1,
      difficulty: q.question_data?.difficulty || "Medium",
      explanation: q.question_data?.explanation || "",
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error("COMPAT GET QUESTIONS ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createExamQuestions = async (req, res) => {
  try {
    const examId = toInt(req.params.examId, 0);
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!questions.length) return res.status(400).json({ success: false, message: "No questions provided" });

    const created = [];
    for (const item of questions) {
      const questionText = String(item.question_text || "").trim();
      if (!questionText) continue;
      const qd = typeof item.question_data === "object" && item.question_data ? item.question_data : {};
      qd.module_id = toInt(item.module_id, qd.module_id || 1);
      qd.marks = toInt(item.marks, qd.marks || 1);
      qd.difficulty = item.difficulty || qd.difficulty || "Medium";
      qd.explanation = item.explanation || qd.explanation || "";

      const insert = await pool.query(
        `
        INSERT INTO exam_questions (exam_id, question_text, question_data, display_order, is_active, is_deleted)
        VALUES ($1, $2, $3::jsonb, $4, TRUE, FALSE)
        RETURNING id, exam_id, question_text, question_data, display_order, created_at
        `,
        [examId, questionText, JSON.stringify(qd), toInt(item.display_order, 1)]
      );
      created.push(insert.rows[0]);
    }
    res.status(201).json({ success: true, data: created, message: "Questions created" });
  } catch (err) {
    console.error("COMPAT CREATE QUESTIONS ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateExamQuestion = async (req, res) => {
  try {
    const examId = toInt(req.params.examId, 0);
    const questionId = toInt(req.params.questionId, 0);
    const payload = req.body || {};
    const questionText = String(payload.question_text || "").trim();
    if (!questionText) return res.status(400).json({ success: false, message: "Question text is required" });

    const qd = typeof payload.question_data === "object" && payload.question_data ? payload.question_data : {};
    qd.module_id = toInt(payload.module_id, qd.module_id || 1);
    qd.marks = toInt(payload.marks, qd.marks || 1);
    qd.difficulty = payload.difficulty || qd.difficulty || "Medium";
    qd.explanation = payload.explanation || qd.explanation || "";

    const update = await pool.query(
      `
      UPDATE exam_questions
      SET question_text = $1, question_data = $2::jsonb, display_order = $3
      WHERE id = $4 AND exam_id = $5 AND is_deleted = FALSE
      RETURNING id
      `,
      [questionText, JSON.stringify(qd), toInt(payload.display_order, 1), questionId, examId]
    );
    if (!update.rows.length) return res.status(404).json({ success: false, message: "Question not found" });
    res.json({ success: true, message: "Question updated" });
  } catch (err) {
    console.error("COMPAT UPDATE QUESTION ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteExamQuestion = async (req, res) => {
  try {
    const examId = toInt(req.params.examId, 0);
    const questionId = toInt(req.params.questionId, 0);
    const result = await pool.query(
      `UPDATE exam_questions SET is_deleted = TRUE WHERE id = $1 AND exam_id = $2 AND is_deleted = FALSE RETURNING id`,
      [questionId, examId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "Question not found" });
    res.json({ success: true, message: "Question deleted and moved to trash" });
  } catch (err) {
    console.error("COMPAT DELETE QUESTION ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAttempts = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.max(1, toInt(req.query.limit, 10));
    const search = String(req.query.search || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toUpperCase();

    const result = await pool.query(
      `
      SELECT
        ea.id, ea.score, ea.total_questions, ea.total_questions AS total_marks, ea.percentage, ea.result_status, ea.attempted_at, ea.attempted_at AS submitted_at,
        u.name AS user_name, u.email AS user_email,
        e.title AS exam_title
      FROM exam_attempts ea
      LEFT JOIN users u ON u.id = ea.user_id
      LEFT JOIN exams e ON e.id = ea.exam_id
      ORDER BY ea.attempted_at DESC
      `
    );

    let rows = result.rows;
    if (search) {
      rows = rows.filter((r) =>
        [r.user_name, r.user_email, r.exam_title].some((v) => String(v || "").toLowerCase().includes(search))
      );
    }
    if (status) rows = rows.filter((r) => String(r.result_status || "").toUpperCase() === status);

    const total = rows.length;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit);
    res.json({ success: true, data, pagination: paginate(page, limit, total) });
  } catch (err) {
    console.error("COMPAT ATTEMPTS ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listTrashCategories = async (req, res) => {
  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.max(1, toInt(req.query.limit, 10));
  res.json({ success: true, data: [], pagination: paginate(page, limit, 0) });
};

exports.listTrashSubcategories = exports.listTrashCategories;

exports.listTrashExams = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.max(1, toInt(req.query.limit, 10));
    const result = await pool.query(
      `
      SELECT id, title, created_at AS deleted_at
      FROM exams
      WHERE is_deleted = TRUE
      ORDER BY created_at DESC
      `
    );
    const total = result.rows.length;
    const start = (page - 1) * limit;
    const data = result.rows.slice(start, start + limit);
    res.json({ success: true, data, pagination: paginate(page, limit, total) });
  } catch (err) {
    console.error("COMPAT EXAM TRASH ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listTrashQuestions = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.max(1, toInt(req.query.limit, 10));
    const result = await pool.query(
      `
      SELECT q.id, q.question_text, q.question_text AS name, e.title AS exam_name, q.created_at AS deleted_at
      FROM exam_questions q
      LEFT JOIN exams e ON e.id = q.exam_id
      WHERE q.is_deleted = TRUE
      ORDER BY q.created_at DESC
      `
    );
    const total = result.rows.length;
    const start = (page - 1) * limit;
    const data = result.rows.slice(start, start + limit);
    res.json({ success: true, data, pagination: paginate(page, limit, total) });
  } catch (err) {
    console.error("COMPAT QUESTION TRASH ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.restoreCategory = async (_req, res) => res.json({ success: true, message: "Restored" });
exports.restoreSubcategory = exports.restoreCategory;
exports.permanentDeleteCategory = exports.restoreCategory;
exports.permanentDeleteSubcategory = exports.restoreCategory;

exports.restoreExam = async (req, res) => {
  const id = toInt(req.params.id, 0);
  await pool.query(`UPDATE exams SET is_deleted = FALSE WHERE id = $1`, [id]);
  await pool.query(`UPDATE exam_questions SET is_deleted = FALSE WHERE exam_id = $1`, [id]);
  res.json({ success: true, message: "Exam restored" });
};

exports.permanentDeleteExam = async (req, res) => {
  const id = toInt(req.params.id, 0);
  await pool.query(`DELETE FROM exam_attempts WHERE exam_id = $1`, [id]);
  await pool.query(`DELETE FROM exam_questions WHERE exam_id = $1`, [id]);
  await pool.query(`DELETE FROM exams WHERE id = $1`, [id]);
  res.json({ success: true, message: "Exam permanently deleted" });
};

exports.restoreQuestion = async (req, res) => {
  const id = toInt(req.params.id, 0);
  await pool.query(`UPDATE exam_questions SET is_deleted = FALSE WHERE id = $1`, [id]);
  res.json({ success: true, message: "Question restored" });
};

exports.permanentDeleteQuestion = async (req, res) => {
  const id = toInt(req.params.id, 0);
  await pool.query(`DELETE FROM exam_questions WHERE id = $1`, [id]);
  res.json({ success: true, message: "Question permanently deleted" });
};
