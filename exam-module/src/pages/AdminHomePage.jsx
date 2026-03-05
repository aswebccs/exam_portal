import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { examApi } from "../api";
import { authStorage } from "../App";

const QUESTION_TYPES = [
  { code: "MSA", label: "Single Choice" },
  { code: "MMA", label: "Multiple Choice (Multiple Answers)" },
  { code: "TOF", label: "True / False" },
  { code: "FIB", label: "Fill in the Blank" },
  { code: "SAQ", label: "Short Answer" },
  { code: "MTF", label: "Match the Following" },
  { code: "ORD", label: "Ordering / Sequence" },
];

const EMPTY_EDITOR = {
  id: null,
  question_text: "",
  question_type_code: "MSA",
  marks: 1,
  difficulty: "Medium",
  explanation: "",
  options: ["", "", "", ""],
  correct_index: 0,
  correct_indexes: [],
  true_false_answer: "True",
  blank_answers: "",
  pairs: [
    { left: "", right: "" },
    { left: "", right: "" },
    { left: "", right: "" },
  ],
  ordering_items: "",
};

const isTempId = (id) => String(id).startsWith("temp_");

const normalizeQuestion = (q) => {
  const questionData = q.question_data || {};
  return {
    id: q.id,
    question_text: q.question_text || "",
    display_order: q.display_order || 1,
    marks: q.marks || 1,
    difficulty: q.difficulty || "Medium",
    explanation: q.explanation || "",
    question_data: questionData,
  };
};

const toEditor = (question) => {
  const data = question.question_data || {};
  const typeCode = String(data.question_type_code || "MSA").toUpperCase();
  return {
    id: question.id,
    question_text: question.question_text || "",
    question_type_code: typeCode,
    marks: question.marks || 1,
    difficulty: question.difficulty || "Medium",
    explanation: question.explanation || "",
    options: Array.isArray(data.options) && data.options.length ? data.options : ["", "", "", ""],
    correct_index: Number.isInteger(data.correct_index) ? data.correct_index : 0,
    correct_indexes: Array.isArray(data.correct_indexes) ? data.correct_indexes : [],
    true_false_answer: data.correct_answer === "False" ? "False" : "True",
    blank_answers: Array.isArray(data.answers) ? data.answers.join(", ") : "",
    pairs:
      Array.isArray(data.pairs) && data.pairs.length
        ? [...data.pairs, { left: "", right: "" }, { left: "", right: "" }].slice(0, 3)
        : [
            { left: "", right: "" },
            { left: "", right: "" },
            { left: "", right: "" },
          ],
    ordering_items: Array.isArray(data.sequence) ? data.sequence.join(", ") : "",
  };
};

const buildQuestionPayload = (editor, displayOrder) => {
  const type = editor.question_type_code;
  const questionText = String(editor.question_text || "").trim();
  if (!questionText) throw new Error("Question text is required");

  const payload = {
    question_text: questionText,
    marks: Number(editor.marks || 1),
    difficulty: editor.difficulty || "Medium",
    explanation: editor.explanation || "",
    display_order: displayOrder,
    question_data: {
      question_type_code: type,
    },
  };

  if (type === "MSA") {
    const options = editor.options.map((o) => String(o || "").trim()).filter(Boolean);
    if (options.length < 2) throw new Error("MSA requires at least 2 options");
    if (!Number.isInteger(editor.correct_index) || editor.correct_index < 0 || editor.correct_index >= options.length) {
      throw new Error("Select a valid correct option");
    }
    payload.question_data.options = options;
    payload.question_data.correct_index = editor.correct_index;
    payload.question_data.correct_answer = options[editor.correct_index];
  } else if (type === "MMA") {
    const options = editor.options.map((o) => String(o || "").trim()).filter(Boolean);
    if (options.length < 2) throw new Error("MMA requires at least 2 options");
    const correctIndexes = (editor.correct_indexes || [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < options.length);
    if (!correctIndexes.length) throw new Error("Select at least one correct option for MMA");
    payload.question_data.options = options;
    payload.question_data.correct_indexes = correctIndexes;
  } else if (type === "TOF") {
    payload.question_data.options = ["True", "False"];
    payload.question_data.correct_answer = editor.true_false_answer === "False" ? "False" : "True";
  } else if (type === "FIB" || type === "SAQ") {
    const answers = String(editor.blank_answers || "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (!answers.length) throw new Error(`${type} requires at least one answer`);
    payload.question_data.answers = answers;
    payload.question_data.correct_answer = answers[0];
  } else if (type === "MTF") {
    const pairs = (editor.pairs || [])
      .map((p) => ({ left: String(p.left || "").trim(), right: String(p.right || "").trim() }))
      .filter((p) => p.left && p.right);
    if (pairs.length < 2) throw new Error("MTF requires at least 2 pairs");
    payload.question_data.pairs = pairs;
  } else if (type === "ORD") {
    const sequence = String(editor.ordering_items || "")
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);
    if (sequence.length < 2) throw new Error("ORD requires at least 2 items");
    payload.question_data.sequence = sequence;
  }

  return payload;
};

export default function AdminHomePage() {
  const navigate = useNavigate();
  const token = authStorage.getToken();
  const admin = authStorage.getUser();

  const [notice, setNotice] = useState({ type: "", message: "" });
  const [loadingExams, setLoadingExams] = useState(true);
  const [savingExam, setSavingExam] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [showCreateExamCard, setShowCreateExamCard] = useState(false);

  const [exams, setExams] = useState([]);
  const [searchTitle, setSearchTitle] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [questionEditor, setQuestionEditor] = useState({ ...EMPTY_EDITOR });
  const [editingQuestionId, setEditingQuestionId] = useState(null);

  const [examForm, setExamForm] = useState({
    title: "",
    duration_minutes: 60,
    passing_score: 70,
    is_active: true,
  });

  const selectedExam = useMemo(
    () => exams.find((e) => String(e.id) === String(selectedExamId)) || null,
    [exams, selectedExamId]
  );

  const filteredExams = useMemo(() => {
    const query = searchTitle.trim().toLowerCase();
    return exams.filter((exam) => {
      const titleMatched = !query || String(exam.title || "").toLowerCase().includes(query);
      const statusMatched =
        !filterStatus ||
        (filterStatus === "active" && exam.is_active) ||
        (filterStatus === "inactive" && !exam.is_active);
      return titleMatched && statusMatched;
    });
  }, [exams, searchTitle, filterStatus]);

  const showNotice = (message, type = "error") => {
    setNotice({ type, message });
    setTimeout(() => setNotice({ type: "", message: "" }), 3000);
  };

  const loadExams = async () => {
    setLoadingExams(true);
    try {
      const response = await examApi.getAdminExams(token);
      const rows = response.data || [];
      setExams(rows);
      if (!selectedExamId && rows.length) {
        setSelectedExamId(String(rows[0].id));
      }
    } catch (err) {
      showNotice(err.message || "Failed to load exams");
    } finally {
      setLoadingExams(false);
    }
  };

  const loadQuestions = async (examId) => {
    if (!examId) {
      setQuestions([]);
      return;
    }
    try {
      const response = await examApi.getAdminExamQuestions(examId, token);
      setQuestions((response.data || []).map(normalizeQuestion));
    } catch (err) {
      showNotice(err.message || "Failed to load questions");
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) loadQuestions(selectedExamId);
  }, [selectedExamId]);

  const handleLogout = () => {
    authStorage.clear();
    navigate("/login", { replace: true });
  };

  const handleCreateExam = async (event) => {
    event.preventDefault();
    setSavingExam(true);
    try {
      const payload = {
        title: examForm.title,
        duration_minutes: Number(examForm.duration_minutes),
        passing_score: Number(examForm.passing_score),
        is_active: Boolean(examForm.is_active),
      };
      const response = await examApi.createExam(payload, token);
      showNotice(response.message || "Exam created", "success");
      setExamForm({ title: "", duration_minutes: 60, passing_score: 70, is_active: true });
      setShowCreateExamCard(false);
      await loadExams();
      if (response.data?.id) {
        setSelectedExamId(String(response.data.id));
      }
    } catch (err) {
      showNotice(err.message || "Failed to create exam");
    } finally {
      setSavingExam(false);
    }
  };

  const resetEditor = () => {
    setQuestionEditor({ ...EMPTY_EDITOR });
    setEditingQuestionId(null);
  };

  const upsertQuestionLocally = () => {
    try {
      const displayOrder = editingQuestionId
        ? questions.find((q) => String(q.id) === String(editingQuestionId))?.display_order || 1
        : questions.length + 1;
      const payload = buildQuestionPayload(questionEditor, displayOrder);
      const row = {
        id: editingQuestionId || `temp_${Date.now()}`,
        question_text: payload.question_text,
        marks: payload.marks,
        difficulty: payload.difficulty,
        explanation: payload.explanation,
        display_order: payload.display_order,
        question_data: payload.question_data,
      };

      if (editingQuestionId) {
        setQuestions((prev) => prev.map((q) => (String(q.id) === String(editingQuestionId) ? row : q)));
      } else {
        setQuestions((prev) => [...prev, row]);
      }
      resetEditor();
      showNotice("Question added to draft", "success");
    } catch (err) {
      showNotice(err.message || "Invalid question data");
    }
  };

  const editQuestion = (question) => {
    setQuestionEditor(toEditor(question));
    setEditingQuestionId(question.id);
  };

  const deleteQuestion = async (question) => {
    if (isTempId(question.id)) {
      setQuestions((prev) => prev.filter((q) => q.id !== question.id));
      return;
    }
    try {
      await examApi.deleteAdminExamQuestion(selectedExamId, question.id, token);
      showNotice("Question deleted", "success");
      await loadQuestions(selectedExamId);
    } catch (err) {
      showNotice(err.message || "Failed to delete question");
    }
  };

  const handleSaveQuestions = async () => {
    if (!selectedExamId) {
      showNotice("Select an exam first");
      return;
    }
    if (!questions.length) {
      showNotice("Add at least one question");
      return;
    }

    setSavingQuestions(true);
    try {
      const tempQuestions = questions.filter((q) => isTempId(q.id));
      const existingQuestions = questions.filter((q) => !isTempId(q.id));

      if (tempQuestions.length) {
        const payload = tempQuestions.map((q, index) =>
          buildQuestionPayload(toEditor(q), Number(q.display_order || index + 1))
        );
        await examApi.createAdminExamQuestions(selectedExamId, payload, token);
      }

      for (const q of existingQuestions) {
        const payload = buildQuestionPayload(toEditor(q), Number(q.display_order || 1));
        await examApi.updateAdminExamQuestion(selectedExamId, q.id, payload, token);
      }

      await loadQuestions(selectedExamId);
      await loadExams();
      resetEditor();
      showNotice("Questions saved successfully", "success");
    } catch (err) {
      showNotice(err.message || "Failed to save questions");
    } finally {
      setSavingQuestions(false);
    }
  };

  const handleToggleExam = async (examId) => {
    try {
      await examApi.toggleAdminExam(examId, token);
      await loadExams();
      showNotice("Exam status updated", "success");
    } catch (err) {
      showNotice(err.message || "Failed to toggle exam");
    }
  };

  const handleDeleteExam = async (examId) => {
    try {
      await examApi.deleteAdminExam(examId, token);
      showNotice("Exam deleted", "success");
      if (String(selectedExamId) === String(examId)) {
        setSelectedExamId("");
        setQuestions([]);
      }
      await loadExams();
    } catch (err) {
      showNotice(err.message || "Failed to delete exam");
    }
  };

  return (
    <main className="page-wrap admin-page">
      <header className="top-bar">
        <div>
          <h1>Exam Management</h1>
          <p className="muted">{admin?.name ? `Welcome, ${admin.name}` : "Admin dashboard"}</p>
        </div>
        <button onClick={handleLogout} className="btn-light">
          Logout
        </button>
      </header>

      {notice.message ? (
        <div className={`notice ${notice.type === "success" ? "notice-success" : "notice-error"}`}>{notice.message}</div>
      ) : null}

      <section className="card">
        <div className="table-toolbar">
          <h2>Exams</h2>
          <div className="table-filters table-filters-wide">
            <input
              type="text"
              placeholder="Search by title"
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
            />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button type="button" onClick={() => setShowCreateExamCard((prev) => !prev)}>
              {showCreateExamCard ? "Close" : "Create New Exam"}
            </button>
          </div>
        </div>
        {loadingExams ? <p>Loading exams...</p> : null}
        {!loadingExams && !filteredExams.length ? <p>No exams found.</p> : null}
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>Pass %</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExams.map((exam) => (
                <tr key={exam.id}>
                  <td>{exam.title}</td>
                  <td>{exam.duration_minutes} min</td>
                  <td>{Number(exam.passing_score)}%</td>
                  <td>{exam.total_questions || 0}</td>
                  <td>
                    <span className={`status-pill ${exam.is_active ? "status-active" : "status-inactive"}`}>
                      {exam.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn-light" onClick={() => setSelectedExamId(String(exam.id))}>
                        Questions
                      </button>
                      <button type="button" className="btn-light" onClick={() => handleToggleExam(exam.id)}>
                        Toggle
                      </button>
                      <button type="button" onClick={() => handleDeleteExam(exam.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreateExamCard ? (
        <section className="card exam-create-card">
          <h2>Create Exam</h2>
          <form className="form" onSubmit={handleCreateExam}>
            <label>
              Exam Title
              <input
                type="text"
                value={examForm.title}
                onChange={(e) => setExamForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </label>
            <div className="row-3">
              <label>
                Duration (minutes)
                <input
                  type="number"
                  min="1"
                  value={examForm.duration_minutes}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                  required
                />
              </label>
              <label>
                Passing Score (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={examForm.passing_score}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, passing_score: e.target.value }))}
                  required
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={examForm.is_active}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Active
              </label>
            </div>
            <div className="actions">
              <button type="button" className="btn-light" onClick={() => setShowCreateExamCard(false)}>
                Cancel
              </button>
              <button type="submit" disabled={savingExam}>
                {savingExam ? "Creating..." : "Create Exam"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card">
        <h2>Questions {selectedExam ? `- ${selectedExam.title}` : ""}</h2>
        {!selectedExam ? <p>Select an exam to manage questions.</p> : null}
        {selectedExam ? (
          <>
            <div className="card">
              <div className="row-3">
                <label>
                  Question Type
                  <select
                    value={questionEditor.question_type_code}
                    onChange={(e) =>
                      setQuestionEditor((prev) => ({
                        ...prev,
                        question_type_code: e.target.value,
                      }))
                    }
                  >
                    {QUESTION_TYPES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} - {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Marks
                  <input
                    type="number"
                    min="1"
                    value={questionEditor.marks}
                    onChange={(e) => setQuestionEditor((prev) => ({ ...prev, marks: e.target.value }))}
                  />
                </label>
                <label>
                  Difficulty
                  <select
                    value={questionEditor.difficulty}
                    onChange={(e) => setQuestionEditor((prev) => ({ ...prev, difficulty: e.target.value }))}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </label>
              </div>
              <label>
                Question Text
                <textarea
                  rows={3}
                  value={questionEditor.question_text}
                  onChange={(e) => setQuestionEditor((prev) => ({ ...prev, question_text: e.target.value }))}
                />
              </label>

              {questionEditor.question_type_code === "MSA" || questionEditor.question_type_code === "MMA" ? (
                <div className="form">
                  <p className="muted">Options</p>
                  {questionEditor.options.map((option, index) => (
                    <div key={`opt-${index}`} className="option">
                      <input
                        type={questionEditor.question_type_code === "MSA" ? "radio" : "checkbox"}
                        name="answer"
                        checked={
                          questionEditor.question_type_code === "MSA"
                            ? questionEditor.correct_index === index
                            : questionEditor.correct_indexes.includes(index)
                        }
                        onChange={() => {
                          if (questionEditor.question_type_code === "MSA") {
                            setQuestionEditor((prev) => ({ ...prev, correct_index: index }));
                          } else {
                            setQuestionEditor((prev) => {
                              const exists = prev.correct_indexes.includes(index);
                              return {
                                ...prev,
                                correct_indexes: exists
                                  ? prev.correct_indexes.filter((i) => i !== index)
                                  : [...prev.correct_indexes, index],
                              };
                            });
                          }
                        }}
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) =>
                          setQuestionEditor((prev) => {
                            const options = [...prev.options];
                            options[index] = e.target.value;
                            return { ...prev, options };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {questionEditor.question_type_code === "TOF" ? (
                <label>
                  Correct Answer
                  <select
                    value={questionEditor.true_false_answer}
                    onChange={(e) => setQuestionEditor((prev) => ({ ...prev, true_false_answer: e.target.value }))}
                  >
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </select>
                </label>
              ) : null}

              {questionEditor.question_type_code === "FIB" || questionEditor.question_type_code === "SAQ" ? (
                <label>
                  Answers (comma separated)
                  <input
                    type="text"
                    value={questionEditor.blank_answers}
                    onChange={(e) => setQuestionEditor((prev) => ({ ...prev, blank_answers: e.target.value }))}
                    placeholder="answer1, answer2"
                  />
                </label>
              ) : null}

              {questionEditor.question_type_code === "MTF" ? (
                <div className="form">
                  <p className="muted">Pairs</p>
                  {questionEditor.pairs.map((pair, index) => (
                    <div key={`pair-${index}`} className="row-3">
                      <input
                        type="text"
                        placeholder="Left item"
                        value={pair.left}
                        onChange={(e) =>
                          setQuestionEditor((prev) => {
                            const pairs = [...prev.pairs];
                            pairs[index] = { ...pairs[index], left: e.target.value };
                            return { ...prev, pairs };
                          })
                        }
                      />
                      <input
                        type="text"
                        placeholder="Right item"
                        value={pair.right}
                        onChange={(e) =>
                          setQuestionEditor((prev) => {
                            const pairs = [...prev.pairs];
                            pairs[index] = { ...pairs[index], right: e.target.value };
                            return { ...prev, pairs };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {questionEditor.question_type_code === "ORD" ? (
                <label>
                  Sequence (comma separated)
                  <input
                    type="text"
                    value={questionEditor.ordering_items}
                    onChange={(e) => setQuestionEditor((prev) => ({ ...prev, ordering_items: e.target.value }))}
                    placeholder="first, second, third"
                  />
                </label>
              ) : null}

              <label>
                Explanation (optional)
                <textarea
                  rows={2}
                  value={questionEditor.explanation}
                  onChange={(e) => setQuestionEditor((prev) => ({ ...prev, explanation: e.target.value }))}
                />
              </label>

              <div className="actions">
                <button type="button" className="btn-light" onClick={resetEditor}>
                  Reset
                </button>
                <button type="button" onClick={upsertQuestionLocally}>
                  {editingQuestionId ? "Update Draft Question" : "Add Draft Question"}
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Draft / Saved Questions</h3>
              {!questions.length ? <p>No questions yet.</p> : null}
              {questions.map((q) => (
                <article key={q.id} className="card">
                  <p>
                    <strong>Q{q.display_order}.</strong> {q.question_text}
                  </p>
                  <p className="muted">
                    Type: {q.question_data?.question_type_code || "-"} | {isTempId(q.id) ? "Draft" : "Saved"}
                  </p>
                  <div className="actions">
                    <button type="button" className="btn-light" onClick={() => editQuestion(q)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteQuestion(q)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              <button type="button" onClick={handleSaveQuestions} disabled={savingQuestions}>
                {savingQuestions ? "Saving..." : "Save Questions"}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
