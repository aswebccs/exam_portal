const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const XLSX = require("xlsx");

const STUDENT_USER_TYPE = 3;
const ADMIN_USER_TYPE = 1;
const ADMIN_USER_TYPE_ALT = 2;

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const parseAsNumberArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((v) => Number(v)).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
};

const parseAsStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((v) => normalizeText(v)).filter(Boolean);
};

const hasStudentAccess = (req, res) => {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return false;
  }

  if (Number(req.user?.user_type) !== STUDENT_USER_TYPE) {
    res.status(403).json({ success: false, message: "Only students can access this module" });
    return false;
  }

  return true;
};

const hasAdminAccess = (req, res) => {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return false;
  }

  const userType = Number(req.user?.user_type);
  if (userType !== ADMIN_USER_TYPE && userType !== ADMIN_USER_TYPE_ALT) {
    res.status(403).json({ success: false, message: "Only admins can access this endpoint" });
    return false;
  }

  return true;
};

const getAssignedExam = async (examId, studentId) => {
  const assignedExamRes = await pool.query(
    `
    SELECT
      e.id,
      e.title,
      e.duration_minutes,
      e.passing_score,
      e.show_result,
      e.is_active,
      e.is_deleted
    FROM exam_assignments ea
    JOIN exams e ON e.id = ea.exam_id
    WHERE ea.exam_id = $1 AND ea.student_id = $2
    LIMIT 1
    `,
    [examId, studentId]
  );
  return assignedExamRes.rows[0] || null;
};

const getEffectiveResultVisibility = async (examId, studentId, fallbackShowResult = true) => {
  const visibilityRes = await pool.query(
    `
    SELECT show_result
    FROM exam_result_visibility
    WHERE exam_id = $1 AND student_id = $2
    LIMIT 1
    `,
    [examId, studentId]
  );
  if (!visibilityRes.rows.length) return Boolean(fallbackShowResult);
  return Boolean(visibilityRes.rows[0].show_result);
};

const logAssignmentAudit = async ({ examId, studentId, adminId, action }, client = pool) => {
  await client.query(
    `
    INSERT INTO exam_assignment_audit_logs (exam_id, student_id, admin_id, action)
    VALUES ($1, $2, $3, $4)
    `,
    [examId, studentId, adminId, action]
  );
};

const getExamAttemptCount = async (examId, client = pool) => {
  const attemptRes = await client.query(
    `
    SELECT COUNT(*)::int AS attempt_count
    FROM exam_attempts
    WHERE exam_id = $1
    `,
    [examId]
  );
  return Number(attemptRes.rows[0]?.attempt_count || 0);
};

const getQuestionPayloadFromRequest = (question, index) => {
  const questionText = String(question?.question_text || "").trim();
  const typeCode = String(question?.question_type_code || question?.question_data?.question_type_code || "MSA")
    .trim()
    .toUpperCase();
  const displayOrder = Number(question?.display_order || index + 1);

  if (!questionText) {
    throw new Error(`Question ${index + 1}: question text is required`);
  }
  if (!Number.isFinite(displayOrder) || displayOrder <= 0) {
    throw new Error(`Question ${index + 1}: display order must be greater than 0`);
  }

  const questionDataFromPayload = question?.question_data && typeof question.question_data === "object"
    ? question.question_data
    : null;

  if (questionDataFromPayload) {
    const normalizedTypeCode = String(questionDataFromPayload.question_type_code || typeCode).toUpperCase();
    return {
      question_text: questionText,
      question_data: {
        ...questionDataFromPayload,
        question_type_code: normalizedTypeCode,
      },
      display_order: displayOrder,
    };
  }

  const options = Array.isArray(question?.options)
    ? question.options.map((o) => String(o || "").trim()).filter(Boolean)
    : [];
  const correctAnswer = String(question?.correct_answer || "").trim();

  if (!["MSA", "MMA", "TOF", "FIB", "SAQ", "MTF", "ORD"].includes(typeCode)) {
    throw new Error(`Question ${index + 1}: unsupported question type ${typeCode}`);
  }

  const questionData = { question_type_code: typeCode };

  if (typeCode === "MSA") {
    if (options.length < 2) throw new Error(`Question ${index + 1}: at least 2 options are required`);
    if (!correctAnswer || !options.includes(correctAnswer)) {
      throw new Error(`Question ${index + 1}: correct answer must match one option exactly`);
    }
    questionData.options = options;
    questionData.correct_answer = correctAnswer;
    questionData.correct_index = options.findIndex((value) => value === correctAnswer);
  } else if (typeCode === "MMA") {
    const correctIndexes = Array.isArray(question?.correct_indexes)
      ? question.correct_indexes.map((n) => Number(n)).filter((n) => Number.isInteger(n))
      : [];
    if (options.length < 2) throw new Error(`Question ${index + 1}: at least 2 options are required`);
    if (!correctIndexes.length) throw new Error(`Question ${index + 1}: at least one correct index is required`);
    questionData.options = options;
    questionData.correct_indexes = correctIndexes;
    questionData.correct_answers = correctIndexes.map((i) => options[i]).filter(Boolean);
  } else if (typeCode === "TOF") {
    const answer = correctAnswer || "True";
    if (!["True", "False"].includes(answer)) {
      throw new Error(`Question ${index + 1}: TOF answer must be True or False`);
    }
    questionData.options = ["True", "False"];
    questionData.correct_answer = answer;
  } else if (typeCode === "FIB" || typeCode === "SAQ") {
    const answers = Array.isArray(question?.answers)
      ? question.answers.map((a) => String(a || "").trim()).filter(Boolean)
      : String(question?.blank_answers || "")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
    if (!answers.length && !correctAnswer) {
      throw new Error(`Question ${index + 1}: at least one answer is required`);
    }
    questionData.answers = answers.length ? answers : [correctAnswer];
    if (correctAnswer) questionData.correct_answer = correctAnswer;
  } else if (typeCode === "MTF") {
    const pairs = Array.isArray(question?.pairs)
      ? question.pairs
          .map((p) => ({ left: String(p?.left || "").trim(), right: String(p?.right || "").trim() }))
          .filter((p) => p.left && p.right)
      : [];
    if (pairs.length < 2) throw new Error(`Question ${index + 1}: at least 2 pairs are required`);
    questionData.pairs = pairs;
  } else if (typeCode === "ORD") {
    const sequence = Array.isArray(question?.sequence)
      ? question.sequence.map((item) => String(item || "").trim()).filter(Boolean)
      : String(question?.ordering_items || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    if (sequence.length < 2) throw new Error(`Question ${index + 1}: at least 2 sequence items are required`);
    questionData.sequence = sequence;
  }

  return {
    question_text: questionText,
    question_data: questionData,
    display_order: displayOrder,
  };
};

const calculateScoreForQuestion = (question, submittedAnswer) => {
  const data = question.question_data || {};
  const typeCode = String(data.question_type_code || "MSA").toUpperCase();

  if (typeCode === "MSA" || typeCode === "TOF") {
    const expectedAnswer = normalizeText(data.correct_answer);
    const userAnswer = normalizeText(submittedAnswer);
    if (expectedAnswer && expectedAnswer === userAnswer) return 1;

    if (Number.isInteger(data.correct_index)) {
      return String(data.correct_index) === String(submittedAnswer) ? 1 : 0;
    }

    return 0;
  }

  if (typeCode === "MMA") {
    const expected = parseAsNumberArray(data.correct_indexes);
    const submitted = parseAsNumberArray(submittedAnswer);
    if (!expected.length || expected.length !== submitted.length) return 0;
    return expected.every((value, index) => value === submitted[index]) ? 1 : 0;
  }

  if (typeCode === "FIB" || typeCode === "SAQ") {
    const expectedMany = parseAsStringArray(data.answers);
    const submitted = normalizeText(submittedAnswer);
    if (!submitted) return 0;

    if (expectedMany.length) return expectedMany.includes(submitted) ? 1 : 0;

    const expectedSingle = normalizeText(data.correct_answer);
    return expectedSingle && expectedSingle === submitted ? 1 : 0;
  }

  if (typeCode === "ORD") {
    const expected = parseAsStringArray(data.sequence);
    if (!expected.length) return 0;

    const submitted = parseAsStringArray(
      Array.isArray(submittedAnswer) ? submittedAnswer : String(submittedAnswer || "").split(",")
    );

    if (expected.length !== submitted.length) return 0;
    return expected.every((value, index) => value === submitted[index]) ? 1 : 0;
  }

  return 0;
};

exports.loginStudent = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    const normalizedUsername = String(username).trim();
    const isEmailInput = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedUsername);
    if (isEmailInput) {
      return res.status(400).json({ success: false, message: "Students must login with username (roll number), not email" });
    }

    const userRes = await pool.query(
      `
      SELECT id, name, email, password, user_type, is_verified, roll_number, is_active
      FROM users
      WHERE LOWER(COALESCE(roll_number, '')) = LOWER($1)
      LIMIT 1
      `,
      [normalizedUsername]
    );

    if (!userRes.rows.length) {
      return res.status(400).json({ success: false, message: "Invalid username or password" });
    }

    const user = userRes.rows[0];
    if (Number(user.user_type) !== STUDENT_USER_TYPE) {
      return res.status(403).json({ success: false, message: "Only students can login to exam module" });
    }

    if (!user.is_verified) {
      return res.status(403).json({ success: false, message: "Please verify your email first" });
    }
    if (user.is_active === false) {
      return res.status(403).json({ success: false, message: "Student account is inactive" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,
      student: {
        id: user.id,
        name: user.name,
        roll_number: user.roll_number || null,
        username: user.email,
      },
    });
  } catch (err) {
    console.error("EXAM MODULE LOGIN ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const isEmailInput = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedUsername);
    if (!isEmailInput) {
      return res.status(400).json({ success: false, message: "Admin must login with email and password" });
    }

    const userRes = await pool.query(
      `
      SELECT id, name, email, password, user_type, is_verified
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [normalizedUsername]
    );

    if (!userRes.rows.length) {
      return res.status(400).json({ success: false, message: "Invalid username or password" });
    }

    const user = userRes.rows[0];
    const loginUserType = Number(user.user_type);
    if (loginUserType !== ADMIN_USER_TYPE && loginUserType !== ADMIN_USER_TYPE_ALT) {
      return res.status(403).json({ success: false, message: "Only admins can login here" });
    }

    if (!user.is_verified) {
      return res.status(403).json({ success: false, message: "Please verify your email first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      success: true,
      message: "Admin login successful",
      token,
      admin: {
        id: user.id,
        name: user.name,
        username: user.email,
      },
    });
  } catch (err) {
    console.error("EXAM MODULE ADMIN LOGIN ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listExamsForStudent = async (req, res) => {
  try {
    if (!hasStudentAccess(req, res)) return;

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.title,
        e.duration_minutes,
        e.passing_score,
        COALESCE(erv.show_result, e.show_result) AS show_result,
        COALESCE(q.total_questions, 0) AS total_questions,
        CASE WHEN ea.id IS NULL THEN FALSE ELSE TRUE END AS has_attempted,
        ea.result_status
      FROM exams e
      JOIN exam_assignments exa ON exa.exam_id = e.id AND exa.student_id = $1
      LEFT JOIN exam_result_visibility erv ON erv.exam_id = e.id AND erv.student_id = $1
      LEFT JOIN (
        SELECT exam_id, COUNT(*)::int AS total_questions
        FROM exam_questions
        WHERE is_deleted = FALSE AND is_active = TRUE
        GROUP BY exam_id
      ) q ON q.exam_id = e.id
      LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.user_id = $1
      WHERE
        e.is_deleted = FALSE
        AND e.is_active = TRUE
      ORDER BY e.created_at DESC
      `,
      [req.user.id]
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("EXAM MODULE LIST EXAMS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getExamInstructions = async (req, res) => {
  try {
    if (!hasStudentAccess(req, res)) return;

    const { examId } = req.params;

    const exam = await getAssignedExam(examId, req.user.id);
    if (!exam || exam.is_deleted || !exam.is_active) {
      return res.status(403).json({ success: false, message: "You are not assigned to this exam" });
    }
    const showResult = await getEffectiveResultVisibility(examId, req.user.id, exam.show_result);

    const questionsRes = await pool.query(
      `
      SELECT question_data
      FROM exam_questions
      WHERE exam_id = $1 AND is_deleted = FALSE AND is_active = TRUE
      ORDER BY display_order ASC, created_at ASC
      `,
      [examId]
    );

    const typeCounts = {};
    for (const row of questionsRes.rows) {
      const code = String(row.question_data?.question_type_code || "MSA").toUpperCase();
      typeCounts[code] = (typeCounts[code] || 0) + 1;
    }

    return res.json({
      success: true,
      data: {
        id: exam.id,
        title: exam.title,
        duration_minutes: exam.duration_minutes,
        passing_score: exam.passing_score,
        total_questions: questionsRes.rows.length,
        question_type_counts: typeCounts,
        show_result: Boolean(showResult),
        instructions: [
          "Read each question carefully before answering.",
          "Do not refresh the page while exam is in progress.",
          "Once submitted, the attempt cannot be changed.",
          `Minimum passing score is ${Number(exam.passing_score || 70)}%.`,
        ],
      },
    });
  } catch (err) {
    console.error("EXAM MODULE INSTRUCTIONS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getExamQuestions = async (req, res) => {
  try {
    if (!hasStudentAccess(req, res)) return;

    const { examId } = req.params;

    const alreadyAttempted = await pool.query(
      `SELECT id FROM exam_attempts WHERE exam_id = $1 AND user_id = $2 LIMIT 1`,
      [examId, req.user.id]
    );

    if (alreadyAttempted.rows.length) {
      return res.status(409).json({ success: false, message: "Exam already attempted" });
    }

    const exam = await getAssignedExam(examId, req.user.id);
    if (!exam || exam.is_deleted || !exam.is_active) {
      return res.status(403).json({ success: false, message: "You are not assigned to this exam" });
    }
    const showResult = await getEffectiveResultVisibility(examId, req.user.id, exam.show_result);

    const questionsRes = await pool.query(
      `
      SELECT id, question_text, question_data, display_order
      FROM exam_questions
      WHERE exam_id = $1 AND is_deleted = FALSE AND is_active = TRUE
      ORDER BY display_order ASC, created_at ASC
      `,
      [examId]
    );

    const questions = questionsRes.rows.map((row) => {
      const data = row.question_data || {};
      return {
        id: row.id,
        question_text: row.question_text,
        question_type_code: String(data.question_type_code || "MSA").toUpperCase(),
        options: Array.isArray(data.options) ? data.options : [],
      };
    });

    return res.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          duration_minutes: exam.duration_minutes,
          passing_score: exam.passing_score,
          show_result: Boolean(showResult),
        },
        questions,
      },
    });
  } catch (err) {
    console.error("EXAM MODULE QUESTIONS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.submitExam = async (req, res) => {
  try {
    if (!hasStudentAccess(req, res)) return;

    const { examId } = req.params;
    const submittedAnswers = req.body?.answers || {};

    if (typeof submittedAnswers !== "object" || Array.isArray(submittedAnswers)) {
      return res.status(400).json({ success: false, message: "Invalid answers payload" });
    }

    const alreadyAttempted = await pool.query(
      `SELECT id FROM exam_attempts WHERE exam_id = $1 AND user_id = $2 LIMIT 1`,
      [examId, req.user.id]
    );

    if (alreadyAttempted.rows.length) {
      return res.status(409).json({ success: false, message: "Exam already attempted" });
    }

    const exam = await getAssignedExam(examId, req.user.id);
    if (!exam || exam.is_deleted || !exam.is_active) {
      return res.status(403).json({ success: false, message: "You are not assigned to this exam" });
    }
    const showResult = await getEffectiveResultVisibility(examId, req.user.id, exam.show_result);

    const questionsRes = await pool.query(
      `
      SELECT id, question_data
      FROM exam_questions
      WHERE exam_id = $1 AND is_deleted = FALSE AND is_active = TRUE
      `,
      [examId]
    );

    const questions = questionsRes.rows;
    const totalQuestions = questions.length;
    let score = 0;

    for (const question of questions) {
      const submitted = submittedAnswers[String(question.id)];
      score += calculateScoreForQuestion(question, submitted);
    }

    const percentage = totalQuestions ? Number(((score / totalQuestions) * 100).toFixed(2)) : 0;
    const passed = percentage >= Number(exam.passing_score || 70);
    const resultStatus = passed ? "PASSED" : "FAILED";

    await pool.query(
      `
      INSERT INTO exam_attempts (
        exam_id, user_id, score, total_questions, percentage, result_status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        examId,
        req.user.id,
        Number(score),
        Number(totalQuestions),
        Number(percentage),
        resultStatus,
      ]
    );

    return res.status(201).json({
      success: true,
      data: showResult
        ? {
            exam_id: examId,
            exam_title: exam.title,
            score,
            total_questions: totalQuestions,
            percentage,
            result_status: resultStatus,
            show_result: true,
          }
        : {
            exam_id: examId,
            result_status: "SUBMITTED",
            show_result: false,
            message: "Result will be published later",
          },
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Exam already attempted" });
    }
    console.error("EXAM MODULE SUBMIT ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listExamsForAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.title,
        e.duration_minutes,
        e.passing_score,
        e.show_result,
        e.is_active,
        e.created_at,
        COALESCE(q.total_questions, 0) AS total_questions
      FROM exams e
      LEFT JOIN (
        SELECT exam_id, COUNT(*)::int AS total_questions
        FROM exam_questions
        WHERE is_deleted = FALSE
        GROUP BY exam_id
      ) q ON q.exam_id = e.id
      WHERE e.is_deleted = FALSE
      ORDER BY e.created_at DESC
      `
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("EXAM MODULE ADMIN LIST EXAMS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createExamByAdmin = async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    if (!hasAdminAccess(req, res)) return;

    const title = String(req.body?.title || "").trim();
    const durationMinutes = Number(req.body?.duration_minutes);
    const passingScore = Number(req.body?.passing_score);
    const isActive = req.body?.is_active !== false;
    const showResult = req.body?.show_result !== false;
    const rawQuestions = Array.isArray(req.body?.questions) ? req.body.questions : [];

    if (!title) {
      return res.status(400).json({ success: false, message: "Exam title is required" });
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return res.status(400).json({ success: false, message: "Duration must be greater than 0" });
    }
    if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) {
      return res.status(400).json({ success: false, message: "Passing score must be between 0 and 100" });
    }
    const questions = rawQuestions.map((question, index) => getQuestionPayloadFromRequest(question, index));

    await client.query("BEGIN");
    transactionStarted = true;

    const examInsert = await client.query(
      `
      INSERT INTO exams (title, duration_minutes, passing_score, is_active, show_result, is_deleted)
      VALUES ($1, $2, $3, $4, $5, FALSE)
      RETURNING id, title, duration_minutes, passing_score, show_result, is_active, created_at
      `,
      [title, durationMinutes, passingScore, isActive, showResult]
    );

    const exam = examInsert.rows[0];

    if (questions.length) {
      for (const question of questions) {
        await client.query(
          `
          INSERT INTO exam_questions (exam_id, question_text, question_data, display_order, is_active, is_deleted)
          VALUES ($1, $2, $3::jsonb, $4, TRUE, FALSE)
          `,
          [exam.id, question.question_text, JSON.stringify(question.question_data), question.display_order]
        );
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Exam created successfully",
      data: {
        ...exam,
        total_questions: questions.length,
      },
    });
  } catch (err) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    const message = err.message || "Server error";
    if (message.startsWith("Question ")) {
      return res.status(400).json({ success: false, message });
    }
    console.error("EXAM MODULE ADMIN CREATE EXAM ERROR:", message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

exports.getExamQuestionsForAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;

    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
      return res.status(400).json({ success: false, message: "Invalid exam id" });
    }

    const result = await pool.query(
      `
      SELECT id, exam_id, question_text, question_data, display_order, is_active, created_at
      FROM exam_questions
      WHERE exam_id = $1 AND is_deleted = FALSE
      ORDER BY display_order ASC, created_at ASC
      `,
      [examId]
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("EXAM MODULE ADMIN GET QUESTIONS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createExamQuestionsByAdmin = async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    if (!hasAdminAccess(req, res)) return;

    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
      return res.status(400).json({ success: false, message: "Invalid exam id" });
    }

    const rawQuestions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!rawQuestions.length) {
      return res.status(400).json({ success: false, message: "At least one question is required" });
    }

    const examRes = await client.query(
      `SELECT id FROM exams WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
      [examId]
    );
    if (!examRes.rows.length) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    const questions = rawQuestions.map((question, index) => getQuestionPayloadFromRequest(question, index));

    await client.query("BEGIN");
    transactionStarted = true;

    const created = [];
    for (const question of questions) {
      const insertRes = await client.query(
        `
        INSERT INTO exam_questions (exam_id, question_text, question_data, display_order, is_active, is_deleted)
        VALUES ($1, $2, $3::jsonb, $4, TRUE, FALSE)
        RETURNING id, exam_id, question_text, question_data, display_order, is_active, created_at
        `,
        [examId, question.question_text, JSON.stringify(question.question_data), question.display_order]
      );
      created.push(insertRes.rows[0]);
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Questions created successfully",
      data: created,
    });
  } catch (err) {
    if (transactionStarted) await client.query("ROLLBACK");
    const message = err.message || "Server error";
    if (message.startsWith("Question ")) {
      return res.status(400).json({ success: false, message });
    }
    console.error("EXAM MODULE ADMIN CREATE QUESTIONS ERROR:", message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

exports.updateExamQuestionByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;

    const examId = Number(req.params.examId);
    const questionId = Number(req.params.questionId);
    if (!Number.isInteger(examId) || !Number.isInteger(questionId)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const question = getQuestionPayloadFromRequest(req.body || {}, 0);

    const updateRes = await pool.query(
      `
      UPDATE exam_questions
      SET
        question_text = $1,
        question_data = $2::jsonb,
        display_order = $3
      WHERE id = $4 AND exam_id = $5 AND is_deleted = FALSE
      RETURNING id, exam_id, question_text, question_data, display_order, is_active, created_at
      `,
      [question.question_text, JSON.stringify(question.question_data), question.display_order, questionId, examId]
    );

    if (!updateRes.rows.length) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    return res.json({
      success: true,
      message: "Question updated successfully",
      data: updateRes.rows[0],
    });
  } catch (err) {
    const message = err.message || "Server error";
    if (message.startsWith("Question ")) {
      return res.status(400).json({ success: false, message });
    }
    console.error("EXAM MODULE ADMIN UPDATE QUESTION ERROR:", message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteExamQuestionByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;

    const examId = Number(req.params.examId);
    const questionId = Number(req.params.questionId);
    if (!Number.isInteger(examId) || !Number.isInteger(questionId)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const deleteRes = await pool.query(
      `
      UPDATE exam_questions
      SET is_deleted = TRUE
      WHERE id = $1 AND exam_id = $2 AND is_deleted = FALSE
      RETURNING id
      `,
      [questionId, examId]
    );

    if (!deleteRes.rows.length) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    return res.json({ success: true, message: "Question deleted successfully" });
  } catch (err) {
    console.error("EXAM MODULE ADMIN DELETE QUESTION ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.toggleExamByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;

    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
      return res.status(400).json({ success: false, message: "Invalid exam id" });
    }

    const force = String(req.query.force || "").trim().toLowerCase() === "true";
    const currentExamRes = await pool.query(
      `SELECT id, is_active FROM exams WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
      [examId]
    );
    if (!currentExamRes.rows.length) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }
    const currentExam = currentExamRes.rows[0];
    if (currentExam.is_active) {
      const attemptCount = await getExamAttemptCount(examId);
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
      `
      UPDATE exams
      SET is_active = NOT is_active
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING id, is_active
      `,
      [examId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    return res.json({
      success: true,
      message: `Exam marked as ${result.rows[0].is_active ? "active" : "inactive"}`,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("EXAM MODULE ADMIN TOGGLE EXAM ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteExamByAdmin = async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    if (!hasAdminAccess(req, res)) return;

    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
      return res.status(400).json({ success: false, message: "Invalid exam id" });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const force = String(req.query.force || "").trim().toLowerCase() === "true";
    const attemptCount = await getExamAttemptCount(examId, client);
    if (attemptCount > 0 && !force) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message: `This exam has ${attemptCount} attempt(s). Delete only if you are sure.`,
        requires_force: true,
        attempted_count: attemptCount,
      });
    }

    const examRes = await client.query(
      `
      UPDATE exams
      SET is_deleted = TRUE
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING id
      `,
      [examId]
    );

    if (!examRes.rows.length) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    await client.query(
      `
      UPDATE exam_questions
      SET is_deleted = TRUE
      WHERE exam_id = $1
      `,
      [examId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({ success: true, message: "Exam deleted successfully" });
  } catch (err) {
    if (transactionStarted) await client.query("ROLLBACK");
    console.error("EXAM MODULE ADMIN DELETE EXAM ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

exports.updateResultVisibilityByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;

    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
      return res.status(400).json({ success: false, message: "Invalid exam id" });
    }

    const showResult = req.body?.show_result;
    if (typeof showResult !== "boolean") {
      return res.status(400).json({ success: false, message: "show_result must be boolean" });
    }

    const result = await pool.query(
      `
      UPDATE exams
      SET show_result = $1
      WHERE id = $2 AND is_deleted = FALSE
      RETURNING id, show_result
      `,
      [showResult, examId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    return res.json({
      success: true,
      message: `Result visibility ${showResult ? "enabled" : "disabled"}`,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("EXAM MODULE ADMIN RESULT VISIBILITY ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.assignStudentsToExamByAdmin = async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    if (!hasAdminAccess(req, res)) return;

    const examId = Number(req.params.examId);
    const studentIds = Array.isArray(req.body?.student_ids)
      ? req.body.student_ids.map((id) => String(id || "").trim()).filter(Boolean)
      : [];

    if (!Number.isInteger(examId)) {
      return res.status(400).json({ success: false, message: "Invalid exam id" });
    }
    if (!studentIds.length) {
      return res.status(400).json({ success: false, message: "student_ids is required" });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const examRes = await client.query(`SELECT id FROM exams WHERE id = $1 AND is_deleted = FALSE LIMIT 1`, [examId]);
    if (!examRes.rows.length) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    const userRes = await client.query(
      `
      SELECT id
      FROM users
      WHERE user_type = $1
      AND id = ANY($2::uuid[])
      `,
      [STUDENT_USER_TYPE, studentIds]
    );
    const validIds = userRes.rows.map((row) => row.id);

    for (const studentId of validIds) {
      const assignRes = await client.query(
        `
        INSERT INTO exam_assignments (exam_id, student_id)
        VALUES ($1, $2)
        ON CONFLICT (exam_id, student_id) DO NOTHING
        RETURNING id
        `,
        [examId, studentId]
      );
      if (assignRes.rows.length) {
        await logAssignmentAudit(
          {
            examId,
            studentId,
            adminId: req.user.id,
            action: "ASSIGNED",
          },
          client
        );
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({
      success: true,
      message: "Students assigned successfully",
      data: {
        exam_id: examId,
        requested_count: studentIds.length,
        assigned_count: validIds.length,
      },
    });
  } catch (err) {
    if (transactionStarted) await client.query("ROLLBACK");
    console.error("EXAM MODULE ADMIN ASSIGN STUDENTS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

exports.removeStudentAssignmentByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const examId = Number(req.params.examId);
    const studentId = String(req.params.studentId || "").trim();
    if (!Number.isInteger(examId) || !studentId) {
      return res.status(400).json({ success: false, message: "Invalid payload" });
    }

    const deleteRes = await pool.query(
      `
      DELETE FROM exam_assignments
      WHERE exam_id = $1 AND student_id = $2
      RETURNING id
      `,
      [examId, studentId]
    );
    if (!deleteRes.rows.length) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }
    await pool.query(
      `
      DELETE FROM exam_result_visibility
      WHERE exam_id = $1 AND student_id = $2
      `,
      [examId, studentId]
    );

    await logAssignmentAudit({
      examId,
      studentId,
      adminId: req.user.id,
      action: "REMOVED",
    });

    return res.json({ success: true, message: "Assignment removed" });
  } catch (err) {
    console.error("EXAM MODULE ADMIN REMOVE ASSIGNMENT ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listExamAssignmentsByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
      return res.status(400).json({ success: false, message: "Invalid exam id" });
    }

    const result = await pool.query(
      `
      SELECT
        ea.id,
        ea.assigned_at,
        u.id AS student_id,
        u.name,
        u.roll_number,
        u.email,
        COALESCE(erv.show_result, e.show_result) AS show_result,
        erv.show_result AS show_result_override
      FROM exam_assignments ea
      JOIN exams e ON e.id = ea.exam_id
      JOIN users u ON u.id = ea.student_id
      LEFT JOIN exam_result_visibility erv ON erv.exam_id = ea.exam_id AND erv.student_id = ea.student_id
      WHERE ea.exam_id = $1
      ORDER BY ea.assigned_at DESC
      `,
      [examId]
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("EXAM MODULE ADMIN LIST ASSIGNMENTS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateStudentResultVisibilityByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const examId = Number(req.params.examId);
    const studentId = String(req.params.studentId || "").trim();
    const showResult = req.body?.show_result;

    if (!Number.isInteger(examId) || !studentId) {
      return res.status(400).json({ success: false, message: "Invalid payload" });
    }
    if (typeof showResult !== "boolean") {
      return res.status(400).json({ success: false, message: "show_result must be boolean" });
    }

    const assignedRes = await pool.query(
      `
      SELECT id
      FROM exam_assignments
      WHERE exam_id = $1 AND student_id = $2
      LIMIT 1
      `,
      [examId, studentId]
    );
    let isEligible = assignedRes.rows.length > 0;
    if (!isEligible) {
      const attemptRes = await pool.query(
        `
        SELECT id
        FROM exam_attempts
        WHERE exam_id = $1 AND user_id = $2
        LIMIT 1
        `,
        [examId, studentId]
      );
      isEligible = attemptRes.rows.length > 0;
    }
    if (!isEligible) {
      return res.status(404).json({ success: false, message: "Student is not assigned or has no attempt for this exam" });
    }

    await pool.query(
      `
      INSERT INTO exam_result_visibility (exam_id, student_id, show_result, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (exam_id, student_id)
      DO UPDATE SET show_result = EXCLUDED.show_result, updated_at = NOW()
      `,
      [examId, studentId, showResult]
    );

    await logAssignmentAudit({
      examId,
      studentId,
      adminId: req.user.id,
      action: showResult ? "RESULT_VISIBLE" : "RESULT_HIDDEN",
    });

    return res.json({
      success: true,
      message: "Student result visibility updated",
      data: { exam_id: examId, student_id: studentId, show_result: showResult },
    });
  } catch (err) {
    console.error("EXAM MODULE ADMIN UPDATE STUDENT RESULT VISIBILITY ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listAssignmentAuditLogsByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
      return res.status(400).json({ success: false, message: "Invalid exam id" });
    }

    const result = await pool.query(
      `
      SELECT
        l.id,
        l.exam_id,
        l.student_id,
        l.admin_id,
        l.action,
        l.created_at,
        s.name AS student_name,
        s.email AS student_email,
        a.name AS admin_name
      FROM exam_assignment_audit_logs l
      LEFT JOIN users s ON s.id = l.student_id
      LEFT JOIN users a ON a.id = l.admin_id
      WHERE l.exam_id = $1
      ORDER BY l.created_at DESC
      LIMIT 200
      `,
      [examId]
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("EXAM MODULE ADMIN LIST ASSIGNMENT LOGS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getStudentExamResult = async (req, res) => {
  try {
    if (!hasStudentAccess(req, res)) return;
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
      return res.status(400).json({ success: false, message: "Invalid exam id" });
    }

    const exam = await getAssignedExam(examId, req.user.id);
    if (!exam || exam.is_deleted || !exam.is_active) {
      return res.status(403).json({ success: false, message: "You are not assigned to this exam" });
    }

    const showResult = await getEffectiveResultVisibility(examId, req.user.id, exam.show_result);
    if (!showResult) {
      return res.status(403).json({ success: false, message: "Result will be published later" });
    }

    const attemptRes = await pool.query(
      `
      SELECT score, total_questions, percentage, result_status, attempted_at
      FROM exam_attempts
      WHERE exam_id = $1 AND user_id = $2
      ORDER BY attempted_at DESC
      LIMIT 1
      `,
      [examId, req.user.id]
    );
    if (!attemptRes.rows.length) {
      return res.status(404).json({ success: false, message: "No result found for this exam" });
    }

    const attempt = attemptRes.rows[0];
    return res.json({
      success: true,
      data: {
        exam_id: examId,
        exam_title: exam.title,
        score: Number(attempt.score || 0),
        total_questions: Number(attempt.total_questions || 0),
        percentage: Number(attempt.percentage || 0),
        result_status: attempt.result_status,
        submitted_at: attempt.attempted_at,
        show_result: true,
      },
    });
  } catch (err) {
    console.error("EXAM MODULE STUDENT GET RESULT ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listInstitutesByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const search = String(req.query.search || "").trim().toLowerCase();
    const result = await pool.query(
      `
      SELECT i.id, i.institute_name, i.created_at, COUNT(g.id)::int AS group_count
      FROM institutes i
      LEFT JOIN student_groups g ON g.institute_id = i.id AND g.is_deleted = FALSE
      WHERE i.is_deleted = FALSE
      GROUP BY i.id
      ORDER BY i.created_at DESC
      `
    );
    const rows = result.rows.filter((row) =>
      !search ? true : String(row.institute_name || "").toLowerCase().includes(search)
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("EXAM MODULE ADMIN LIST INSTITUTES ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createInstituteByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const instituteName = String(req.body?.institute_name || "").trim();
    if (!instituteName) {
      return res.status(400).json({ success: false, message: "institute_name is required" });
    }
    const created = await pool.query(
      `
      INSERT INTO institutes (institute_name)
      VALUES ($1)
      RETURNING id, institute_name, created_at
      `,
      [instituteName]
    );
    return res.status(201).json({ success: true, message: "Institute created", data: created.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Institute name already exists" });
    }
    console.error("EXAM MODULE ADMIN CREATE INSTITUTE ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateInstituteByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const instituteId = String(req.params.instituteId || "").trim();
    const instituteName = String(req.body?.institute_name || "").trim();
    if (!instituteId) {
      return res.status(400).json({ success: false, message: "instituteId is required" });
    }
    if (!instituteName) {
      return res.status(400).json({ success: false, message: "institute_name is required" });
    }

    const updated = await pool.query(
      `
      UPDATE institutes
      SET institute_name = $1
      WHERE id = $2 AND is_deleted = FALSE
      RETURNING id, institute_name, created_at
      `,
      [instituteName, instituteId]
    );

    if (!updated.rows.length) {
      return res.status(404).json({ success: false, message: "Institute not found" });
    }

    return res.json({ success: true, message: "Institute updated", data: updated.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Institute name already exists" });
    }
    console.error("EXAM MODULE ADMIN UPDATE INSTITUTE ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteInstituteByAdmin = async (req, res) => {
  const client = await pool.connect();
  try {
    if (!hasAdminAccess(req, res)) return;
    const instituteId = String(req.params.instituteId || "").trim();
    if (!instituteId) {
      return res.status(400).json({ success: false, message: "instituteId is required" });
    }

    await client.query("BEGIN");

    const deleted = await client.query(
      `
      UPDATE institutes
      SET is_deleted = TRUE, deleted_at = NOW()
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING id, institute_name, is_deleted, deleted_at
      `,
      [instituteId]
    );
    if (!deleted.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Institute not found" });
    }

    // Soft-delete all active groups under this institute in the same action.
    await client.query(
      `
      UPDATE student_groups
      SET is_deleted = TRUE, deleted_at = NOW()
      WHERE institute_id = $1 AND is_deleted = FALSE
      `,
      [instituteId]
    );

    await client.query("COMMIT");
    return res.json({ success: true, message: "Institute deleted", data: deleted.rows[0] });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("EXAM MODULE ADMIN DELETE INSTITUTE ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

exports.listGroupsByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const instituteId = String(req.query.institute_id || "").trim();
    const search = String(req.query.search || "").trim().toLowerCase();
    const result = await pool.query(
      `
      SELECT g.id, g.group_name, g.institute_id, g.created_at, i.institute_name
      FROM student_groups g
      JOIN institutes i ON i.id = g.institute_id
      WHERE g.is_deleted = FALSE AND i.is_deleted = FALSE
      ORDER BY g.created_at DESC
      `
    );
    let rows = result.rows;
    if (instituteId) rows = rows.filter((row) => String(row.institute_id) === instituteId);
    if (search) rows = rows.filter((row) => String(row.group_name || "").toLowerCase().includes(search));
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("EXAM MODULE ADMIN LIST GROUPS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createGroupByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const groupName = String(req.body?.group_name || "").trim();
    const instituteId = String(req.body?.institute_id || "").trim();
    if (!groupName || !instituteId) {
      return res.status(400).json({ success: false, message: "group_name and institute_id are required" });
    }
    const instituteRes = await pool.query(`SELECT id FROM institutes WHERE id = $1 AND is_deleted = FALSE LIMIT 1`, [instituteId]);
    if (!instituteRes.rows.length) {
      return res.status(404).json({ success: false, message: "Institute not found" });
    }
    const created = await pool.query(
      `
      INSERT INTO student_groups (group_name, institute_id)
      VALUES ($1, $2)
      RETURNING id, group_name, institute_id, created_at
      `,
      [groupName, instituteId]
    );
    return res.status(201).json({ success: true, message: "Group created", data: created.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Group already exists in this institute" });
    }
    console.error("EXAM MODULE ADMIN CREATE GROUP ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateGroupByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const groupId = String(req.params.groupId || "").trim();
    const groupName = String(req.body?.group_name || "").trim();
    const instituteId = String(req.body?.institute_id || "").trim();
    if (!groupId) {
      return res.status(400).json({ success: false, message: "groupId is required" });
    }
    if (!groupName || !instituteId) {
      return res.status(400).json({ success: false, message: "group_name and institute_id are required" });
    }

    const instituteRes = await pool.query(`SELECT id FROM institutes WHERE id = $1 AND is_deleted = FALSE LIMIT 1`, [instituteId]);
    if (!instituteRes.rows.length) {
      return res.status(404).json({ success: false, message: "Institute not found" });
    }

    const updated = await pool.query(
      `
      UPDATE student_groups
      SET group_name = $1, institute_id = $2
      WHERE id = $3 AND is_deleted = FALSE
      RETURNING id, group_name, institute_id, created_at
      `,
      [groupName, instituteId, groupId]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    return res.json({ success: true, message: "Group updated", data: updated.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Group already exists in this institute" });
    }
    console.error("EXAM MODULE ADMIN UPDATE GROUP ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteGroupByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const groupId = String(req.params.groupId || "").trim();
    if (!groupId) {
      return res.status(400).json({ success: false, message: "groupId is required" });
    }

    const deleted = await pool.query(
      `
      UPDATE student_groups
      SET is_deleted = TRUE, deleted_at = NOW()
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING id, group_name, institute_id, is_deleted, deleted_at
      `,
      [groupId]
    );
    if (!deleted.rows.length) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    return res.json({ success: true, message: "Group deleted", data: deleted.rows[0] });
  } catch (err) {
    console.error("EXAM MODULE ADMIN DELETE GROUP ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listDeletedInstitutesByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const result = await pool.query(
      `
      SELECT id, institute_name, created_at, deleted_at
      FROM institutes
      WHERE is_deleted = TRUE
      ORDER BY deleted_at DESC NULLS LAST, created_at DESC
      `
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("EXAM MODULE ADMIN LIST DELETED INSTITUTES ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.restoreInstituteByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const instituteId = String(req.params.instituteId || "").trim();
    if (!instituteId) {
      return res.status(400).json({ success: false, message: "instituteId is required" });
    }
    const updated = await pool.query(
      `
      UPDATE institutes
      SET is_deleted = FALSE, deleted_at = NULL
      WHERE id = $1 AND is_deleted = TRUE
      RETURNING id, institute_name
      `,
      [instituteId]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ success: false, message: "Deleted institute not found" });
    }
    return res.json({ success: true, message: "Institute restored", data: updated.rows[0] });
  } catch (err) {
    console.error("EXAM MODULE ADMIN RESTORE INSTITUTE ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.permanentlyDeleteInstituteByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const instituteId = String(req.params.instituteId || "").trim();
    if (!instituteId) {
      return res.status(400).json({ success: false, message: "instituteId is required" });
    }
    const linkedGroups = await pool.query(
      `SELECT COUNT(*)::int AS count FROM student_groups WHERE institute_id = $1`,
      [instituteId]
    );
    if (Number(linkedGroups.rows[0]?.count || 0) > 0) {
      return res.status(409).json({ success: false, message: "Cannot permanently delete institute with linked groups" });
    }
    const linkedStudents = await pool.query(
      `SELECT COUNT(*)::int AS count FROM users WHERE institute_id = $1 AND user_type = $2`,
      [instituteId, STUDENT_USER_TYPE]
    );
    if (Number(linkedStudents.rows[0]?.count || 0) > 0) {
      return res.status(409).json({ success: false, message: "Cannot permanently delete institute with linked students" });
    }
    const deleted = await pool.query(
      `DELETE FROM institutes WHERE id = $1 AND is_deleted = TRUE RETURNING id, institute_name`,
      [instituteId]
    );
    if (!deleted.rows.length) {
      return res.status(404).json({ success: false, message: "Deleted institute not found" });
    }
    return res.json({ success: true, message: "Institute permanently deleted", data: deleted.rows[0] });
  } catch (err) {
    console.error("EXAM MODULE ADMIN PERMANENT DELETE INSTITUTE ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listDeletedGroupsByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const result = await pool.query(
      `
      SELECT g.id, g.group_name, g.institute_id, g.created_at, g.deleted_at, i.institute_name
      FROM student_groups g
      LEFT JOIN institutes i ON i.id = g.institute_id
      WHERE g.is_deleted = TRUE
      ORDER BY g.deleted_at DESC NULLS LAST, g.created_at DESC
      `
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("EXAM MODULE ADMIN LIST DELETED GROUPS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.restoreGroupByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const groupId = String(req.params.groupId || "").trim();
    if (!groupId) {
      return res.status(400).json({ success: false, message: "groupId is required" });
    }
    const groupRes = await pool.query(
      `SELECT id, institute_id FROM student_groups WHERE id = $1 AND is_deleted = TRUE LIMIT 1`,
      [groupId]
    );
    if (!groupRes.rows.length) {
      return res.status(404).json({ success: false, message: "Deleted group not found" });
    }
    const instituteRes = await pool.query(
      `SELECT id FROM institutes WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
      [groupRes.rows[0].institute_id]
    );
    if (!instituteRes.rows.length) {
      return res.status(409).json({ success: false, message: "Restore parent institute first" });
    }
    const updated = await pool.query(
      `
      UPDATE student_groups
      SET is_deleted = FALSE, deleted_at = NULL
      WHERE id = $1 AND is_deleted = TRUE
      RETURNING id, group_name, institute_id
      `,
      [groupId]
    );
    if (!updated.rows.length) return res.status(404).json({ success: false, message: "Deleted group not found" });
    return res.json({ success: true, message: "Group restored", data: updated.rows[0] });
  } catch (err) {
    console.error("EXAM MODULE ADMIN RESTORE GROUP ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.permanentlyDeleteGroupByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const groupId = String(req.params.groupId || "").trim();
    if (!groupId) {
      return res.status(400).json({ success: false, message: "groupId is required" });
    }
    const linkedStudents = await pool.query(
      `SELECT COUNT(*)::int AS count FROM users WHERE group_id = $1 AND user_type = $2`,
      [groupId, STUDENT_USER_TYPE]
    );
    if (Number(linkedStudents.rows[0]?.count || 0) > 0) {
      return res.status(409).json({ success: false, message: "Cannot permanently delete group with linked students" });
    }
    const deleted = await pool.query(
      `DELETE FROM student_groups WHERE id = $1 AND is_deleted = TRUE RETURNING id, group_name, institute_id`,
      [groupId]
    );
    if (!deleted.rows.length) {
      return res.status(404).json({ success: false, message: "Deleted group not found" });
    }
    return res.json({ success: true, message: "Group permanently deleted", data: deleted.rows[0] });
  } catch (err) {
    console.error("EXAM MODULE ADMIN PERMANENT DELETE GROUP ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listStudentsByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const search = String(req.query.search || "").trim().toLowerCase();
    const rollNumber = String(req.query.roll_number || "").trim().toLowerCase();
    const instituteId = String(req.query.institute_id || "").trim();
    const groupId = String(req.query.group_id || "").trim();
    const activeParam = String(req.query.is_active || "").trim().toLowerCase();
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name AS full_name,
        u.roll_number,
        u.mobile,
        u.email,
        u.institute_id,
        u.group_id,
        u.is_active,
        u.created_at,
        i.institute_name,
        g.group_name
      FROM users u
      LEFT JOIN institutes i ON i.id = u.institute_id
      LEFT JOIN student_groups g ON g.id = u.group_id
      WHERE user_type = $1
      ORDER BY created_at DESC
      `,
      [STUDENT_USER_TYPE]
    );
    let rows = result.rows;
    if (search) {
      rows = rows.filter((row) =>
        [row.full_name, row.email].some((v) => String(v || "").toLowerCase().includes(search))
      );
    }
    if (rollNumber) {
      rows = rows.filter((row) => String(row.roll_number || "").toLowerCase().includes(rollNumber));
    }
    if (instituteId) rows = rows.filter((row) => String(row.institute_id || "") === instituteId);
    if (groupId) rows = rows.filter((row) => String(row.group_id || "") === groupId);
    if (activeParam === "true") rows = rows.filter((row) => row.is_active === true);
    if (activeParam === "false") rows = rows.filter((row) => row.is_active === false);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("EXAM MODULE ADMIN LIST STUDENTS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createStudentByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const name = String(req.body?.full_name || req.body?.name || "").trim();
    const rollNumber = String(req.body?.roll_number || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const mobile = String(req.body?.mobile || "").trim();
    const instituteId = String(req.body?.institute_id || "").trim();
    const groupId = String(req.body?.group_id || "").trim();
    const password = String(req.body?.password || "");
    const isActive = req.body?.is_active !== false;

    if (!name || !rollNumber || !mobile || !email || !instituteId || !groupId || !password) {
      return res.status(400).json({ success: false, message: "full_name, roll_number, mobile, email, institute_id, group_id and password are required" });
    }
    if (!/^[0-9]{10,15}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: "Mobile number must be 10 to 15 digits" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    if (instituteId) {
      const instituteRes = await pool.query(`SELECT id FROM institutes WHERE id = $1 AND is_deleted = FALSE LIMIT 1`, [instituteId]);
      if (!instituteRes.rows.length) {
        return res.status(404).json({ success: false, message: "Institute not found" });
      }
    }
    if (groupId) {
      const groupRes = await pool.query(
        `SELECT id, institute_id FROM student_groups WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
        [groupId]
      );
      if (!groupRes.rows.length) {
        return res.status(404).json({ success: false, message: "Group not found" });
      }
      if (instituteId && String(groupRes.rows[0].institute_id) !== instituteId) {
        return res.status(400).json({ success: false, message: "Group does not belong to selected institute" });
      }
    }

    const existing = await pool.query(
      `SELECT id FROM users WHERE LOWER(COALESCE(roll_number,'')) = LOWER($1) OR ($2 <> '' AND LOWER(email) = LOWER($2)) LIMIT 1`,
      [rollNumber, email]
    );
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: "Roll number or email already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const created = await pool.query(
      `
      INSERT INTO users (name, roll_number, mobile, email, password, institute_id, group_id, is_active, user_type, is_verified)
      VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::uuid, NULLIF($7, '')::uuid, $8, $9, TRUE)
      RETURNING id, name AS full_name, roll_number, mobile, email, institute_id, group_id, is_active, created_at
      `,
      [name, rollNumber, mobile, email, hash, instituteId, groupId, isActive, STUDENT_USER_TYPE]
    );
    return res.status(201).json({ success: true, message: "Student created", data: created.rows[0] });
  } catch (err) {
    console.error("EXAM MODULE ADMIN CREATE STUDENT ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateStudentByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const studentId = String(req.params.studentId || "").trim();
    if (!studentId) {
      return res.status(400).json({ success: false, message: "studentId is required" });
    }

    const fullName = String(req.body?.full_name || req.body?.name || "").trim();
    const rollNumber = String(req.body?.roll_number || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const mobile = String(req.body?.mobile || "").trim();
    const instituteId = String(req.body?.institute_id || "").trim();
    const groupId = String(req.body?.group_id || "").trim();
    const isActive = req.body?.is_active !== false;
    const password = String(req.body?.password || "").trim();

    if (!fullName || !rollNumber || !mobile || !email || !instituteId || !groupId) {
      return res.status(400).json({ success: false, message: "full_name, roll_number, mobile, email, institute_id and group_id are required" });
    }
    if (!/^[0-9]{10,15}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: "Mobile number must be 10 to 15 digits" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    if (password && password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const currentStudentRes = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND user_type = $2 LIMIT 1`,
      [studentId, STUDENT_USER_TYPE]
    );
    if (!currentStudentRes.rows.length) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const emailOwnerRes = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1`,
      [email, studentId]
    );
    if (email && emailOwnerRes.rows.length) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const rollOwnerRes = await pool.query(
      `SELECT id FROM users WHERE LOWER(COALESCE(roll_number,'')) = LOWER($1) AND id <> $2 LIMIT 1`,
      [rollNumber, studentId]
    );
    if (rollOwnerRes.rows.length) {
      return res.status(409).json({ success: false, message: "Roll number already exists" });
    }

    if (instituteId) {
      const instituteRes = await pool.query(`SELECT id FROM institutes WHERE id = $1 AND is_deleted = FALSE LIMIT 1`, [instituteId]);
      if (!instituteRes.rows.length) {
        return res.status(404).json({ success: false, message: "Institute not found" });
      }
    }

    if (groupId) {
      const groupRes = await pool.query(
        `SELECT id, institute_id FROM student_groups WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
        [groupId]
      );
      if (!groupRes.rows.length) {
        return res.status(404).json({ success: false, message: "Group not found" });
      }
      if (instituteId && String(groupRes.rows[0].institute_id) !== instituteId) {
        return res.status(400).json({ success: false, message: "Selected group does not belong to selected institute" });
      }
    }

    let hash = null;
    if (password) {
      hash = await bcrypt.hash(password, 10);
    }

    const updated = await pool.query(
      `
      UPDATE users
      SET
        name = $1,
        roll_number = $2,
        mobile = $3,
        email = $4,
        institute_id = NULLIF($5, '')::uuid,
        group_id = NULLIF($6, '')::uuid,
        is_active = $7,
        password = COALESCE($8, password)
      WHERE id = $9 AND user_type = $10
      RETURNING id, name AS full_name, roll_number, mobile, email, institute_id, group_id, is_active, created_at
      `,
      [fullName, rollNumber, mobile, email, instituteId, groupId, isActive, hash, studentId, STUDENT_USER_TYPE]
    );

    return res.json({ success: true, message: "Student updated", data: updated.rows[0] });
  } catch (err) {
    console.error("EXAM MODULE ADMIN UPDATE STUDENT ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateStudentStatusByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const studentId = String(req.params.studentId || "").trim();
    const isActive = req.body?.is_active;
    if (!studentId || typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "studentId and is_active(boolean) are required" });
    }
    const result = await pool.query(
      `
      UPDATE users
      SET is_active = $1
      WHERE id = $2 AND user_type = $3
      RETURNING id, name AS full_name, roll_number, is_active
      `,
      [isActive, studentId, STUDENT_USER_TYPE]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    return res.json({ success: true, message: "Student status updated", data: result.rows[0] });
  } catch (err) {
    console.error("EXAM MODULE ADMIN UPDATE STUDENT STATUS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.bulkUpdateStudentStatusByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;

    const studentIds = Array.isArray(req.body?.student_ids)
      ? req.body.student_ids.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    const isActive = req.body?.is_active;

    if (!studentIds.length || typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "student_ids(array) and is_active(boolean) are required" });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET is_active = $1
      WHERE id = ANY($2::uuid[]) AND user_type = $3
      RETURNING id, name AS full_name, roll_number, is_active
      `,
      [isActive, studentIds, STUDENT_USER_TYPE]
    );

    return res.json({
      success: true,
      message: `Updated ${result.rowCount} students`,
      data: {
        updated_count: result.rowCount,
        students: result.rows,
      },
    });
  } catch (err) {
    console.error("EXAM MODULE ADMIN BULK UPDATE STUDENT STATUS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.bulkUploadStudentsByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    if (!req.file) {
      return res.status(400).json({ success: false, message: "File is required" });
    }

    const ext = String(req.file.originalname || "").toLowerCase();
    let rows = [];
    if (ext.endsWith(".csv")) {
      const text = req.file.buffer.toString("utf8");
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = lines[0]?.split(",").map((v) => String(v || "").trim().toLowerCase()) || [];
      const nameIdx = header.includes("full_name") ? header.indexOf("full_name") : header.indexOf("name");
      const rollIdx = header.indexOf("roll_number");
      const emailIdx = header.indexOf("email");
      const passwordIdx = header.indexOf("password");
      const mobileIdx = header.indexOf("mobile");
      const instituteIdx = header.indexOf("institute_id");
      const groupIdx = header.indexOf("group_id");
      if (nameIdx < 0 || rollIdx < 0 || passwordIdx < 0) {
        return res.status(400).json({ success: false, message: "CSV must include full_name(or name),roll_number,password columns" });
      }
      rows = lines.slice(1).map((line) => {
        const parts = line.split(",");
        return {
          name: String(parts[nameIdx] || "").trim(),
          roll_number: String(parts[rollIdx] || "").trim(),
          email: String(parts[emailIdx] || "").trim().toLowerCase(),
          mobile: mobileIdx >= 0 ? String(parts[mobileIdx] || "").trim() : "",
          institute_id: instituteIdx >= 0 ? String(parts[instituteIdx] || "").trim() : "",
          group_id: groupIdx >= 0 ? String(parts[groupIdx] || "").trim() : "",
          password: String(parts[passwordIdx] || "").trim(),
        };
      });
    } else if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" }).map((row) => ({
        name: String(row.full_name || row.name || "").trim(),
        roll_number: String(row.roll_number || "").trim(),
        email: String(row.email || "").trim().toLowerCase(),
        mobile: String(row.mobile || "").trim(),
        institute_id: String(row.institute_id || "").trim(),
        group_id: String(row.group_id || "").trim(),
        password: String(row.password || "").trim(),
      }));
    } else {
      return res.status(400).json({ success: false, message: "Only .csv, .xlsx, .xls are supported" });
    }

    const errors = [];
    const seenEmails = new Set();
    let insertedCount = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const rowNo = i + 2;
      const row = rows[i];
      if (!row.name || !row.roll_number || !row.password) {
        errors.push({ row: rowNo, reason: "Missing full_name/roll_number/password" });
        continue;
      }
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push({ row: rowNo, reason: "Invalid email" });
        continue;
      }
      if (row.password.length < 6) {
        errors.push({ row: rowNo, reason: "Password must be at least 6 characters" });
        continue;
      }
      if (seenEmails.has(String(row.roll_number).toLowerCase())) {
        errors.push({ row: rowNo, reason: "Duplicate roll number in file" });
        continue;
      }
      seenEmails.add(String(row.roll_number).toLowerCase());

      const existing = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [row.email]);
      if (existing.rows.length) {
        errors.push({ row: rowNo, reason: "Email already exists" });
        continue;
      }
      const existingRoll = await pool.query(
        `SELECT id FROM users WHERE LOWER(COALESCE(roll_number,'')) = LOWER($1) LIMIT 1`,
        [row.roll_number]
      );
      if (existingRoll.rows.length) {
        errors.push({ row: rowNo, reason: "Roll number already exists" });
        continue;
      }

      const hash = await bcrypt.hash(row.password, 10);
      await pool.query(
        `
        INSERT INTO users (name, roll_number, mobile, email, password, institute_id, group_id, is_active, user_type, is_verified)
        VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::uuid, NULLIF($7, '')::uuid, TRUE, $8, TRUE)
        `,
        [row.name, row.roll_number, row.mobile || "", row.email || "", hash, row.institute_id || "", row.group_id || "", STUDENT_USER_TYPE]
      );
      insertedCount += 1;
    }

    return res.status(201).json({
      success: true,
      message: "Bulk upload processed",
      data: {
        total_rows: rows.length,
        inserted_count: insertedCount,
        skipped_count: rows.length - insertedCount,
        errors,
      },
    });
  } catch (err) {
    console.error("EXAM MODULE ADMIN BULK UPLOAD STUDENTS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listResultsByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const examId = String(req.query.exam_id || "").trim();
    const studentId = String(req.query.student_id || "").trim();
    const instituteId = String(req.query.institute_id || "").trim();
    const groupId = String(req.query.group_id || "").trim();
    const statusRaw = String(req.query.result_status || "").trim().toUpperCase();
    const status = statusRaw === "PASS" ? "PASSED" : statusRaw === "FAIL" ? "FAILED" : statusRaw;

    const result = await pool.query(
      `
      SELECT
        ea.id,
        ea.user_id AS student_id,
        ea.exam_id,
        ea.score,
        ea.total_questions AS total_marks,
        ea.percentage,
        ea.result_status,
        ea.attempted_at AS submitted_at,
        u.name AS student_name,
        u.roll_number AS student_roll_number,
        u.email AS student_email,
        u.institute_id,
        u.group_id,
        COALESCE(erv.show_result, e.show_result) AS show_result,
        e.title AS exam_title
      FROM exam_attempts ea
      LEFT JOIN users u ON u.id = ea.user_id
      LEFT JOIN exams e ON e.id = ea.exam_id
      LEFT JOIN exam_result_visibility erv ON erv.exam_id = ea.exam_id AND erv.student_id = ea.user_id
      ORDER BY ea.attempted_at DESC
      `
    );

    let rows = result.rows;
    if (examId) rows = rows.filter((r) => String(r.exam_id) === examId);
    if (studentId) rows = rows.filter((r) => String(r.student_id) === studentId);
    if (instituteId) rows = rows.filter((r) => String(r.institute_id || "") === instituteId);
    if (groupId) rows = rows.filter((r) => String(r.group_id || "") === groupId);
    if (status) rows = rows.filter((r) => String(r.result_status || "").toUpperCase() === status);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("EXAM MODULE ADMIN LIST RESULTS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.exportResultsByAdmin = async (req, res) => {
  try {
    if (!hasAdminAccess(req, res)) return;
    const format = String(req.query.format || "csv").toLowerCase();
    const examId = String(req.query.exam_id || "").trim();
    const studentId = String(req.query.student_id || "").trim();
    const instituteId = String(req.query.institute_id || "").trim();
    const groupId = String(req.query.group_id || "").trim();
    const statusRaw = String(req.query.result_status || "").trim().toUpperCase();
    const status = statusRaw === "PASS" ? "PASSED" : statusRaw === "FAIL" ? "FAILED" : statusRaw;

    const baseRes = await pool.query(
      `
      SELECT
        ea.user_id AS student_id,
        u.name AS student_name,
        u.roll_number AS student_roll_number,
        u.email AS student_email,
        u.institute_id,
        u.group_id,
        ea.exam_id,
        e.title AS exam_title,
        COALESCE(erv.show_result, e.show_result) AS show_result,
        ea.score,
        ea.total_questions AS total_marks,
        ea.percentage,
        ea.result_status,
        ea.attempted_at AS submitted_at
      FROM exam_attempts ea
      LEFT JOIN users u ON u.id = ea.user_id
      LEFT JOIN exams e ON e.id = ea.exam_id
      LEFT JOIN exam_result_visibility erv ON erv.exam_id = ea.exam_id AND erv.student_id = ea.user_id
      ORDER BY ea.attempted_at DESC
      `
    );

    let rows = baseRes.rows;
    if (examId) rows = rows.filter((r) => String(r.exam_id) === examId);
    if (studentId) rows = rows.filter((r) => String(r.student_id) === studentId);
    if (instituteId) rows = rows.filter((r) => String(r.institute_id || "") === instituteId);
    if (groupId) rows = rows.filter((r) => String(r.group_id || "") === groupId);
    if (status) rows = rows.filter((r) => String(r.result_status || "").toUpperCase() === status);

    const exportRows = rows.map((row) => ({
      student_name: row.student_name,
      student_roll_number: row.student_roll_number,
      student_email: row.student_email,
      exam_id: row.exam_id,
      exam_title: row.exam_title,
      score: row.score,
      total_marks: row.total_marks,
      percentage: row.percentage,
      result_status: row.result_status,
      show_result: row.show_result,
      submitted_at: row.submitted_at,
    }));

    if (format === "xlsx") {
      const sheet = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Results");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="exam-results-${Date.now()}.xlsx"`);
      return res.send(buffer);
    }

    const headers = [
      "student_name",
      "student_roll_number",
      "student_email",
      "exam_id",
      "exam_title",
      "score",
      "total_marks",
      "percentage",
      "result_status",
      "show_result",
      "submitted_at",
    ];
    const csvRows = [
      headers.join(","),
      ...exportRows.map((row) =>
        headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="exam-results-${Date.now()}.csv"`);
    return res.send(csvRows.join("\n"));
  } catch (err) {
    console.error("EXAM MODULE ADMIN EXPORT RESULTS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
