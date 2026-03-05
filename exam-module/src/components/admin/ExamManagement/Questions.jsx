import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Save, X } from 'lucide-react';
import { API_ENDPOINTS } from '../../../config/api';

const QUESTION_TYPE_FALLBACK = [
  { code: 'MSA', name: 'Multiple Choice Single Answer', is_active: true },
  { code: 'MMA', name: 'Multiple Choice Multiple Answers', is_active: true },
  { code: 'TOF', name: 'True or False', is_active: true },
  { code: 'SAQ', name: 'Short Answer', is_active: true },
  { code: 'MTF', name: 'Match the Following', is_active: true },
  { code: 'ORD', name: 'Ordering/Sequence', is_active: true },
  { code: 'FIB', name: 'Fill in the Blanks', is_active: true },
];

const QUESTION_TYPE_TO_MODULE = {
  MSA: 'MCQs',
  MMA: 'MCQs',
  TOF: 'MCQs',
  MTF: 'MCQs',
  ORD: 'MCQs',
  SAQ: 'Fill in the Blanks',
  FIB: 'Fill in the Blanks',
};

const EXAM_MODULE_FALLBACK = [
  { id: 1, name: 'MCQs', is_active: true },
  { id: 2, name: 'Fill in the Blanks', is_active: true },
];
const QUESTION_DRAFT_KEY_PREFIX = 'exam_question_draft';

const Questions = ({ examId, examTitle, levelName, onComplete }) => {
  const getExamId = (exam) => exam?.id ?? exam?.exam_id ?? '';
  const getQuestionId = (question) => question?.id ?? question?.question_id ?? null;

  const getAuthHeaders = (includeJson = false) => {
    const token = localStorage.getItem('token');
    return {
      ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const [searchParams] = useSearchParams();
  const queryExamId = searchParams.get('examId') || '';
  const queryExamTitle = searchParams.get('examTitle') || '';
  const queryLevelName = searchParams.get('levelName') || '';
  const isExamLockedContext = Boolean(examId || queryExamId);

  const [selectedExamId, setSelectedExamId] = useState(examId || queryExamId || '');
  const [confirmedExamId, setConfirmedExamId] = useState(examId || queryExamId || '');
  const [selectedExamInfo, setSelectedExamInfo] = useState({
    code: '',
    title: examTitle || queryExamTitle || '',
    levelName: levelName || queryLevelName || ''
  });
  const [exams, setExams] = useState([]);
  const [questionModules, setQuestionModules] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [questionTypes, setQuestionTypes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [validationIssues, setValidationIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [showPreviewOptions, setShowPreviewOptions] = useState(false);
  const [notice, setNotice] = useState({ type: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    questionText: '',
    questionId: null,
    isProcessing: false
  });

  const [currentQuestion, setCurrentQuestion] = useState({
    moduleId: '',
    questionTypeCode: '',
    questionText: '',
    marks: 1,
    difficulty: 'Medium',
    explanation: '',
    mcqOptions: ['', '', '', ''],
    mcqCorrectIndex: 0,
    mmaCorrectIndexes: [],
    trueFalseAnswer: 'True',
    blankAnswers: '',
    matchPairs: [
      { left: '', right: '' },
      { left: '', right: '' },
      { left: '', right: '' },
    ],
    orderingItems: '',
  });

  useEffect(() => {
    loadExams();
    loadExamTypes();
    loadQuestionTypes();
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    loadExamModules(selectedExamId);
    loadExamQuestions(selectedExamId);
  }, [selectedExamId]);

  const activeQuestionTypes = useMemo(
    () => questionTypes.filter((q) => q.is_active !== false),
    [questionTypes]
  );
  const activeDraftExamId = String(confirmedExamId || selectedExamId || examId || queryExamId || '');

  const getQuestionTypeMeta = (code) => activeQuestionTypes.find((q) => q.code === code);

  const getMappedModuleType = (questionTypeCode) => QUESTION_TYPE_TO_MODULE[questionTypeCode] || 'MCQs';
  const getQuestionTextLabel = (questionTypeCode) => {
    switch (questionTypeCode) {
      case 'FIB':
        return 'Blank Sentence *';
      case 'TOF':
        return 'Statement *';
      case 'MTF':
        return 'Match Prompt *';
      case 'ORD':
        return 'Ordering Prompt *';
      default:
        return 'Question Text *';
    }
  };

  
  const getModuleByQuestionType = (questionTypeCode) => {
    const moduleType = getMappedModuleType(questionTypeCode);
    return questionModules.find((m) => m.module_type === moduleType);
  };

  const showNotice = (message, type = 'error') => {
    setNotice({ type, message });
    setTimeout(() => setNotice({ type: '', message: '' }), 3000);
  };

  const alert = (message) => showNotice(message, 'error');

  const getDraftStorageKey = () => `${QUESTION_DRAFT_KEY_PREFIX}:${activeDraftExamId || 'global'}`;

  const isQuestionFormEmpty = (question) => {
    if (!question) return true;
    return !String(question.questionTypeCode || '').trim() &&
      !String(question.questionText || '').trim() &&
      Number(question.marks || 1) === 1 &&
      !String(question.explanation || '').trim() &&
      (!Array.isArray(question.mcqOptions) || question.mcqOptions.every((x) => !String(x || '').trim())) &&
      !String(question.blankAnswers || '').trim() &&
      !String(question.orderingItems || '').trim() &&
      (!Array.isArray(question.matchPairs) || question.matchPairs.every((x) => !String(x?.left || '').trim() && !String(x?.right || '').trim()));
  };

  useEffect(() => {
    if (!showQuestionModal || !activeDraftExamId || editingQuestionId) return;
    const raw = localStorage.getItem(getDraftStorageKey());
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.examId && String(parsed.examId) !== String(activeDraftExamId)) return;
      if (parsed.question && !isQuestionFormEmpty(parsed.question)) {
        setCurrentQuestion((prev) => ({ ...prev, ...parsed.question }));
        showNotice('Draft restored for this exam.', 'success');
      }
    } catch (_error) {}
  }, [showQuestionModal, editingQuestionId, activeDraftExamId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showQuestionModal || editingQuestionId || !activeDraftExamId) return;
    if (isQuestionFormEmpty(currentQuestion)) {
      localStorage.removeItem(getDraftStorageKey());
      return;
    }
    localStorage.setItem(
      getDraftStorageKey(),
      JSON.stringify({
        examId: activeDraftExamId,
        updatedAt: Date.now(),
        question: currentQuestion,
      })
    );
  }, [currentQuestion, showQuestionModal, editingQuestionId, activeDraftExamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadExams = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/exam-management/exams?page=1&limit=200');
      const result = await response.json();
      if (!result.success) return;
      const normalizedExams = (result.data || []).map((e) => ({ ...e, id: getExamId(e) }));
      setExams(normalizedExams);
      if (selectedExamId) {
        const selected = normalizedExams.find((e) => String(getExamId(e)) === String(selectedExamId));
        if (selected) {
          setSelectedExamInfo({
            code: selected.code || '',
            title: selected.title || '',
            levelName: selected.level_name || '',
          });
        }
      }
      if (!selectedExamId && normalizedExams.length > 0) {
        const first = normalizedExams[0];
        setSelectedExamId(String(getExamId(first)));
        setSelectedExamInfo({ code: first.code || '', title: first.title, levelName: first.level_name || '' });
      }
    } catch (error) {
      console.error('Error loading exams:', error);
    }
  };

  const loadExamTypes = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/exam-management/exam-types');
      const result = await response.json();
      if (result.success && Array.isArray(result.data) && result.data.length) {
        setExamTypes(result.data);
      } else {
        setExamTypes(EXAM_MODULE_FALLBACK);
      }
    } catch (error) {
      setExamTypes(EXAM_MODULE_FALLBACK);
    }
  };

  const loadQuestionTypes = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/exam-management/question-types', { headers: getAuthHeaders() });
      const result = await response.json();
      if (result.success && Array.isArray(result.data) && result.data.length) {
        setQuestionTypes(result.data);
      } else {
        setQuestionTypes(QUESTION_TYPE_FALLBACK);
      }
    } catch (error) {
      setQuestionTypes(QUESTION_TYPE_FALLBACK);
    }
  };

  const loadExamModules = async (examIdParam) => {
    try {
      const response = await fetch(`http://localhost:5000/api/exam-management/exams/${examIdParam}/modules`);
      const result = await response.json();
      if (result.success) setQuestionModules(result.data);
    } catch (error) {
      console.error('Error loading exam modules:', error);
    }
  };

  const loadExamQuestions = async (examIdParam) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/exam-management/exams/${examIdParam}/questions`);
      const result = await response.json();
      if (result.success) {
        const normalizedQuestions = (result.data || []).map((q) => ({
          ...q,
          id: getQuestionId(q),
          moduleId: q.moduleId ?? q.module_id ?? '',
        }));
        setQuestions(normalizedQuestions);
        setValidationIssues([]);
      }
    } catch (error) {
      console.error('Error loading exam questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const ensureExamModules = async (examIdToUse) => {
    const existingResponse = await fetch(`http://localhost:5000/api/exam-management/exams/${examIdToUse}/modules`);
    const existingResult = await existingResponse.json();
    const existing = existingResult.success ? existingResult.data : [];

    const existingTypes = new Set(existing.map((m) => m.module_type));
    const missing = examTypes.filter((t) => !existingTypes.has(t.name));

    if (missing.length > 0) {
      const payload = missing.map((type, idx) => ({
        module_type: type.name,
        title: type.name,
        display_order: existing.length + idx + 1,
      }));

      await fetch(`http://localhost:5000/api/exam-management/exams/${examIdToUse}/modules`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ modules: payload }),
      });
    }

    await loadExamModules(examIdToUse);
  };

  const handleConfirmExam = async () => {
    if (!selectedExamId) {
      alert('Please select an exam first');
      return;
    }
    try {
      setSaving(true);
      await ensureExamModules(selectedExamId);
      setConfirmedExamId(selectedExamId);
    } catch (error) {
      console.error('Error confirming exam:', error);
      alert('Failed to confirm exam');
    } finally {
      setSaving(false);
    }
  };

  const handleQuestionTypeChange = (questionTypeCode) => {
    const module = getModuleByQuestionType(questionTypeCode);
    setCurrentQuestion((prev) => ({
      ...prev,
      questionTypeCode,
      moduleId: module ? String(module.id) : '',
      mcqOptions: ['', '', '', ''],
      mcqCorrectIndex: 0,
      mmaCorrectIndexes: [],
      trueFalseAnswer: 'True',
      blankAnswers: '',
      matchPairs: [
        { left: '', right: '' },
        { left: '', right: '' },
        { left: '', right: '' },
      ],
      orderingItems: '',
    }));
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.questionTypeCode) {
      alert('Please select question type');
      return false;
    }
    if (!currentQuestion.questionText.trim()) {
      alert('Please enter question text');
      return false;
    }
    if (!Number.isFinite(Number(currentQuestion.marks)) || Number(currentQuestion.marks) <= 0) {
      alert('Marks must be greater than 0');
      return false;
    }

    const mappedModule = getModuleByQuestionType(currentQuestion.questionTypeCode);
    const moduleId = currentQuestion.moduleId || (mappedModule ? String(mappedModule.id) : '');
    if (!moduleId) {
      alert('Required exam module is missing. Create the mapped module first.');
      return false;
    }

    let questionData = {
      question_type_code: currentQuestion.questionTypeCode,
      question_type_name: getQuestionTypeMeta(currentQuestion.questionTypeCode)?.name || '',
    };

    if (currentQuestion.questionTypeCode === 'MSA') {
      const options = currentQuestion.mcqOptions.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) {
        alert('Please add at least 2 options');
        return false;
      }
      questionData = {
        ...questionData,
        options,
        correct_index: currentQuestion.mcqCorrectIndex,
        correct_answer: options[currentQuestion.mcqCorrectIndex] || '',
      };
    }

    if (currentQuestion.questionTypeCode === 'MMA') {
      const options = currentQuestion.mcqOptions.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) {
        alert('Please add at least 2 options');
        return false;
      }
      if (!currentQuestion.mmaCorrectIndexes.length) {
        alert('Please select at least one correct option');
        return false;
      }
      questionData = {
        ...questionData,
        options,
        correct_indexes: currentQuestion.mmaCorrectIndexes,
        correct_answers: currentQuestion.mmaCorrectIndexes.map((i) => options[i]).filter(Boolean),
      };
    }

    if (currentQuestion.questionTypeCode === 'TOF') {
      questionData = {
        ...questionData,
        options: ['True', 'False'],
        correct_answer: currentQuestion.trueFalseAnswer,
      };
    }

    if (['FIB', 'SAQ'].includes(currentQuestion.questionTypeCode)) {
      const answers = currentQuestion.blankAnswers
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      if (answers.length === 0) {
        alert('Please add at least one answer');
        return false;
      }
      questionData = { ...questionData, answers };
    }

    if (currentQuestion.questionTypeCode === 'MTF') {
      const pairs = currentQuestion.matchPairs
        .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
        .filter((p) => p.left && p.right);
      if (pairs.length < 2) {
        alert('Please add at least 2 matching pairs');
        return false;
      }
      questionData = { ...questionData, pairs };
    }

    if (currentQuestion.questionTypeCode === 'ORD') {
      const sequence = currentQuestion.orderingItems
        .split(',')
        .map((i) => i.trim())
        .filter(Boolean);
      if (sequence.length < 2) {
        alert('Please add at least 2 sequence items');
        return false;
      }
      questionData = { ...questionData, sequence };
    }

    const newQuestion = {
      id: editingQuestionId || `temp_${Date.now()}`,
      moduleId,
      questionTypeCode: currentQuestion.questionTypeCode,
      questionText: currentQuestion.questionText,
      marks: currentQuestion.marks,
      difficulty: currentQuestion.difficulty,
      explanation: currentQuestion.explanation,
      questionData,
      displayOrder: editingQuestionId
        ? (questions.find((q) => String(q.id) === String(editingQuestionId))?.displayOrder ||
          questions.find((q) => String(q.id) === String(editingQuestionId))?.display_order ||
          1)
        : questions.length + 1,
    };

    if (editingQuestionId) {
      setQuestions((prev) => prev.map((q) => (String(q.id) === String(editingQuestionId) ? { ...q, ...newQuestion } : q)));
    } else {
      setQuestions((prev) => [...prev, newQuestion]);
    }
    setValidationIssues([]);
    setCurrentQuestion({
      moduleId: '',
      questionTypeCode: '',
      questionText: '',
      marks: 1,
      difficulty: 'Medium',
      explanation: '',
      mcqOptions: ['', '', '', ''],
      mcqCorrectIndex: 0,
      mmaCorrectIndexes: [],
      trueFalseAnswer: 'True',
      blankAnswers: '',
      matchPairs: [
        { left: '', right: '' },
        { left: '', right: '' },
        { left: '', right: '' },
      ],
      orderingItems: '',
    });
    setEditingQuestionId(null);
    localStorage.removeItem(getDraftStorageKey());
    return true;
  };

  const handleDeleteQuestion = (questionId, questionText) => {
    if (!confirmedExamId) {
      alert('Please confirm exam first');
      return;
    }
    if (!questionId) {
      showNotice('Invalid question id. Please refresh and try again.', 'error');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Delete Question',
      message: `Are you sure you want to delete this question? It will be moved to the Recycle Bin where you can restore or permanently delete it.`,
      questionText: questionText,
      questionId: questionId,
      isProcessing: false
    });
  };

  const handleConfirmDeleteQuestion = async () => {
    const questionId = confirmModal.questionId;
    if (!confirmedExamId) {
      alert('Please confirm exam first');
      return;
    }
    if (!questionId) {
      showNotice('Invalid question id. Please refresh and try again.', 'error');
      return;
    }
    try {
      setConfirmModal(prev => ({ ...prev, isProcessing: true }));
      const res = await fetch(
        API_ENDPOINTS.QUESTION_DELETE_IN_EXAM(confirmedExamId, questionId),
        { method: 'DELETE', headers: getAuthHeaders() }
      );
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || `HTTP ${res.status}`);
      if (result.success) {
        setConfirmModal({ isOpen: false, title: '', message: '', questionText: '', questionId: null, isProcessing: false });
        await loadExamQuestions(confirmedExamId);
        showNotice('Question deleted and moved to trash', 'success');
      } else {
        showNotice(result.message || 'Failed to delete question', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showNotice(error.message || 'Error deleting question. Please try again.', 'error');
    } finally {
      setConfirmModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const isTempQuestion = (id) => String(id).startsWith('temp_');

  const handleEditQuestion = (question) => {
    const qData = question.questionData || question.question_data || {};
    const typeCode = qData.question_type_code || '';
    const options = qData.options || ['', '', '', ''];
    const normalizedOptions = options.length ? options : ['', '', '', ''];

    setCurrentQuestion({
      moduleId: String(question.moduleId || question.module_id || ''),
      questionTypeCode: typeCode,
      questionText: question.questionText || question.question_text || '',
      marks: question.marks || 1,
      difficulty: question.difficulty || 'Medium',
      explanation: question.explanation || '',
      mcqOptions: normalizedOptions,
      mcqCorrectIndex: Number.isInteger(qData.correct_index) ? qData.correct_index : 0,
      mmaCorrectIndexes: Array.isArray(qData.correct_indexes) ? qData.correct_indexes : [],
      trueFalseAnswer: qData.correct_answer === 'False' ? 'False' : 'True',
      blankAnswers: Array.isArray(qData.answers) ? qData.answers.join(', ') : '',
      matchPairs: Array.isArray(qData.pairs) && qData.pairs.length
        ? [...qData.pairs, { left: '', right: '' }, { left: '', right: '' }].slice(0, 3)
        : [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
      orderingItems: Array.isArray(qData.sequence) ? qData.sequence.join(', ') : '',
    });

    setEditingQuestionId(question.id);
    setShowQuestionModal(true);
  };

  const getModuleName = (moduleId) => {
    const module = questionModules.find((m) => String(m.id) === String(moduleId));
    return module ? module.title || module.module_type : 'General';
  };

  const handleSaveExam = async () => {
    if (!confirmedExamId) {
      alert('Confirm exam first');
      return;
    }
    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    const validateQuestionForSave = (q, idx) => {
      const questionData = q.questionData || q.question_data || {};
      const displayOrder = q.displayOrder || q.display_order || idx + 1;
      const issues = [];
      const questionText = String(q.questionText || q.question_text || '').trim();
      const typeCode = String(questionData.question_type_code || q.questionTypeCode || '').trim().toUpperCase();
      const mappedModuleId = q.moduleId || q.module_id || getModuleByQuestionType(typeCode)?.id;
      if (!questionText) issues.push('Question text is required');
      if (!typeCode) issues.push('Question type is missing');
      if (!Number.isFinite(Number(q.marks)) || Number(q.marks) <= 0) issues.push('Marks must be greater than 0');
      if (!Number.isFinite(Number(displayOrder)) || Number(displayOrder) <= 0) issues.push('Display order is invalid');
      if (!Number.isFinite(Number(mappedModuleId))) issues.push('Module mapping is missing');
      if (typeCode === 'MSA') {
        const options = Array.isArray(questionData.options) ? questionData.options.filter((o) => String(o || '').trim()) : [];
        if (options.length < 2) issues.push('MSA requires at least 2 options');
      }
      if (typeCode === 'MMA') {
        const options = Array.isArray(questionData.options) ? questionData.options.filter((o) => String(o || '').trim()) : [];
        const correctIndexes = Array.isArray(questionData.correct_indexes) ? questionData.correct_indexes : [];
        if (options.length < 2) issues.push('MMA requires at least 2 options');
        if (!correctIndexes.length) issues.push('MMA requires at least one correct option');
      }
      if (typeCode === 'FIB' || typeCode === 'SAQ') {
        const answers = Array.isArray(questionData.answers) ? questionData.answers.filter((a) => String(a || '').trim()) : [];
        if (!answers.length) issues.push('At least one answer is required');
      }
      if (typeCode === 'MTF') {
        const pairs = Array.isArray(questionData.pairs) ? questionData.pairs.filter((p) => String(p?.left || '').trim() && String(p?.right || '').trim()) : [];
        if (pairs.length < 2) issues.push('MTF requires at least 2 valid pairs');
      }
      if (typeCode === 'ORD') {
        const sequence = Array.isArray(questionData.sequence) ? questionData.sequence.filter((s) => String(s || '').trim()) : [];
        if (sequence.length < 2) issues.push('ORD requires at least 2 sequence items');
      }
      return { id: q.id || `row_${idx + 1}`, index: idx + 1, text: questionText || '-', issues };
    };

    const issues = questions.map(validateQuestionForSave).filter((item) => item.issues.length > 0);
    if (issues.length) {
      setValidationIssues(issues);
      showNotice(`Validation failed in ${issues.length} question(s). Check details below.`);
      return;
    }

    try {
      setSaving(true);
      setValidationIssues([]);
      const tempQuestions = questions.filter((q) => isTempQuestion(q.id));
      const existingQuestions = questions.filter((q) => !isTempQuestion(q.id));

      if (tempQuestions.length > 0) {
        const createPayload = tempQuestions.map((q, idx) => {
          const questionData = q.questionData || q.question_data || {};
          const mappedModuleId =
            q.moduleId ||
            q.module_id ||
            getModuleByQuestionType(questionData.question_type_code)?.id;
          const moduleId = Number(mappedModuleId);

          if (!Number.isInteger(moduleId)) {
            throw new Error(`Invalid module mapping for question ${idx + 1}. Please reopen question and select type again.`);
          }

          return {
            module_id: moduleId,
            question_text: q.questionText || q.question_text,
            marks: q.marks,
            difficulty: q.difficulty,
            explanation: q.explanation,
            question_data: questionData,
            display_order: q.displayOrder || q.display_order || idx + 1,
          };
        });

        const createResponse = await fetch(`http://localhost:5000/api/exam-management/exams/${confirmedExamId}/questions`, {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            questions: createPayload,
          }),
        });
        if (!createResponse.ok) {
          let serverMessage = 'Failed to create new questions';
          try {
            const errorResult = await createResponse.json();
            if (errorResult?.message) serverMessage = errorResult.message;
          } catch (e) {}
          throw new Error(serverMessage);
        }
      }

      for (const q of existingQuestions) {
        const questionData = q.questionData || q.question_data || {};
        const mappedModuleId =
          q.moduleId ||
          q.module_id ||
          getModuleByQuestionType(questionData.question_type_code)?.id;
        const moduleId = Number(mappedModuleId);
        if (!Number.isInteger(moduleId)) {
          throw new Error(`Invalid module mapping for question ID ${q.id}`);
        }

        const updateResponse = await fetch(
          `http://localhost:5000/api/exam-management/exams/${confirmedExamId}/questions/${q.id}`,
          {
            method: 'PUT',
            headers: getAuthHeaders(true),
            body: JSON.stringify({
              module_id: moduleId,
              question_text: q.questionText || q.question_text,
              marks: q.marks,
              difficulty: q.difficulty,
              explanation: q.explanation,
              question_data: questionData,
              display_order: q.displayOrder || q.display_order || 1,
            }),
          }
        );
        if (!updateResponse.ok) {
          let serverMessage = 'Failed to update existing questions';
          try {
            const errorResult = await updateResponse.json();
            if (errorResult?.message) serverMessage = errorResult.message;
          } catch (e) {}
          throw new Error(serverMessage);
        }
      }

      await loadExamQuestions(confirmedExamId);
      localStorage.removeItem(getDraftStorageKey());
      showNotice(`Exam questions saved for ${selectedExamInfo.title || 'selected exam'}`, 'success');

      if (onComplete) onComplete({ success: true });
    } catch (error) {
      console.error('Error saving exam:', error);
      showNotice(error.message || 'Failed to save exam');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {notice.message && (
        <div className="fixed top-6 right-6 z-[60] w-[340px] animate-slideIn">
          <div
            className={`flex items-start gap-3 bg-white rounded-xl shadow-lg border border-gray-200 px-5 py-4 transition-all duration-300 ${
              notice.type === "success"
                ? "border-l-4 border-l-green-500"
                : "border-l-4 border-l-red-500"
            }`}
          >
            {/* Icon */}
            <div className={`text-xl ${
              notice.type === "success" ? "text-green-500" : "text-red-500"
            }`}>
              {notice.type === "success" ? "OK" : "!"}
            </div>
            <p className="text-sm text-gray-600 mt-1">
                {notice.message}
            </p>
          </div>
        </div>

        )}

        {/* Confirmation Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn">
              {/* Modal Header */}
              <div className="p-6 bg-red-50 border-b border-red-100">
                <h3 className="text-lg font-bold text-red-900">
                  {confirmModal.title}
                </h3>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <p className="text-gray-700 text-sm leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    if (!confirmModal.isProcessing) {
                      setConfirmModal({ isOpen: false, title: '', message: '', questionText: '', questionId: null, isProcessing: false });
                    }
                  }}
                  disabled={confirmModal.isProcessing}
                  className="px-4 py-2 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteQuestion}
                  disabled={confirmModal.isProcessing}
                  className="px-4 py-2 rounded-lg text-white font-medium transition-colors text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500 flex items-center gap-2"
                >
                  {confirmModal.isProcessing && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          {isExamLockedContext || confirmedExamId ? (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-2">Exam</label>
              <div className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                {(selectedExamInfo.code || '-')} - {(selectedExamInfo.title || 'Selected Exam')} ({selectedExamInfo.levelName || 'Level'})
              </div>
              <p className="mt-2 text-sm text-blue-700">
                {isExamLockedContext ? 'Exam is fixed from Exam page. Add questions and save.' : 'Exam confirmed and locked. Add questions, then save.'}
              </p>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exam <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <select
                  value={selectedExamId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedExamId(id);
                    const found = exams.find((x) => String(getExamId(x)) === String(id));
                    setSelectedExamInfo({ code: found?.code || '', title: found?.title || '', levelName: found?.level_name || '' });
                    setQuestionModules([]);
                    setQuestions([]);
                    setConfirmedExamId('');
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Exam</option>
                  {exams.map((exam) => (
                    <option key={getExamId(exam) || exam.code} value={getExamId(exam)}>
                      {exam.title} ({exam.level_name || 'Level'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleConfirmExam}
                  disabled={!selectedExamId || saving}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                  {saving ? 'Confirming...' : 'Confirm Exam'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">Select exam and click Confirm Exam.</p>
            </>
          )}
        </div>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Questions</h1>
            <p className="text-gray-500">
              {selectedExamInfo.title ? `${selectedExamInfo.title} (${selectedExamInfo.levelName || ''})` : 'Select an exam'}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingQuestionId(null);
              setCurrentQuestion({
                moduleId: '',
                questionTypeCode: '',
                questionText: '',
                marks: 1,
                difficulty: 'Medium',
                explanation: '',
                mcqOptions: ['', '', '', ''],
                mcqCorrectIndex: 0,
                mmaCorrectIndexes: [],
                trueFalseAnswer: 'True',
                blankAnswers: '',
                matchPairs: [
                  { left: '', right: '' },
                  { left: '', right: '' },
                  { left: '', right: '' },
                ],
                orderingItems: '',
              });
              setShowQuestionModal(true);
            }}
            disabled={!confirmedExamId}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:text-gray-500"
          >
            NEW QUESTION
          </button>
        </div>

        
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="min-w-[1200px]">
          <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-700 uppercase">Exam</div>
            <div className="text-sm font-semibold text-gray-700 uppercase">Question Type</div>
            <div className="text-sm font-semibold text-gray-700 uppercase">Question</div>
            <div className="text-sm font-semibold text-gray-700 uppercase">Marks</div>
            <div className="text-sm font-semibold text-gray-700 uppercase">Difficulty</div>
            <div className="text-sm font-semibold text-gray-700 uppercase">Actions</div>
          </div>

          {!confirmedExamId ? (
            <div className="p-8 text-center text-gray-500">Confirm exam to view questions</div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No questions added yet</div>
          ) : (
            questions.map((question) => (
              <div key={getQuestionId(question) || question.question_text} className="grid grid-cols-6 gap-4 items-center p-4 border-b border-gray-200">
                <div className="text-sm text-gray-700">
                  {(selectedExamInfo.code || '-')} - {(selectedExamInfo.title || '-')}
                </div>
                <div className="text-sm text-gray-700">
                  {(question.questionData || question.question_data)?.question_type_name ||
                    (question.questionData || question.question_data)?.question_type_code ||
                    'N/A'}
                </div>
                <div className="text-gray-800">{question.questionText || question.question_text}</div>
                <div className="text-gray-700">{question.marks}</div>
                <div className="text-gray-700">{question.difficulty}</div>
                <div>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const action = e.target.value;
                      if (action === 'preview') {
                        setPreviewQuestion(question);
                        setShowPreviewOptions(false);
                      } else if (action === 'edit') {
                        handleEditQuestion(question);
                      } else if (action === 'delete') {
                        handleDeleteQuestion(getQuestionId(question), question.questionText || question.question_text);
                      }
                      e.target.value = '';
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Actions</option>
                    <option value="preview">Preview</option>
                    <option value="edit">Edit</option>
                    <option value="delete">Delete</option>
                  </select>
                </div>
              </div>
            ))
          )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleSaveExam}
            disabled={!confirmedExamId || questions.length === 0 || saving}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium ${
              confirmedExamId && questions.length > 0 && !saving
                ? 'bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:text-gray-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Questions'}
          </button>
        </div>
        {validationIssues.length > 0 ? (
          <div className="mt-4 bg-white border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-700 mb-2">
              Validation Preview ({validationIssues.length} issue row{validationIssues.length > 1 ? 's' : ''})
            </h3>
            <div className="max-h-64 overflow-auto space-y-2">
              {validationIssues.map((item) => (
                <div key={item.id} className="border border-red-100 bg-red-50 rounded p-2">
                  <p className="text-sm font-medium text-red-800">
                    Q{item.index}: {item.text}
                  </p>
                  <p className="text-xs text-red-700">{item.issues.join(' | ')}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {showQuestionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">{editingQuestionId ? 'Update Question' : 'New Question'}</h2>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-50 text-blue-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                This question will be saved to: <strong>{selectedExamInfo.title || 'Selected Exam'}</strong> (ID: {confirmedExamId || '-'})
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Question Type *</label>
                  <select
                    value={currentQuestion.questionTypeCode}
                    onChange={(e) => handleQuestionTypeChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Question Type</option>
                    {activeQuestionTypes.map((qt) => (
                      <option key={qt.code} value={qt.code}>
                        {qt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Marks *</label>
                  <input
                    type="number"
                    min="1"
                    value={currentQuestion.marks}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, marks: parseInt(e.target.value || '1', 10) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                  <select
                    value={currentQuestion.difficulty}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, difficulty: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getQuestionTextLabel(currentQuestion.questionTypeCode)}
                </label>
                <textarea
                  rows={4}
                  value={currentQuestion.questionText}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, questionText: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {['MSA', 'MMA'].includes(currentQuestion.questionTypeCode) && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Options</label>
                    <button
                      type="button"
                      title="Add option"
                      onClick={() => setCurrentQuestion({ ...currentQuestion, mcqOptions: [...currentQuestion.mcqOptions, ''] })}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-blue-600 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentQuestion.mcqOptions.map((opt, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={opt}
                        placeholder={`Option ${idx + 1}`}
                        onChange={(e) => {
                          const next = [...currentQuestion.mcqOptions];
                          next[idx] = e.target.value;
                          setCurrentQuestion({ ...currentQuestion, mcqOptions: next });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    ))}
                  </div>
                  {currentQuestion.questionTypeCode === 'MSA' ? (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Correct Option</label>
                      <select
                        value={currentQuestion.mcqCorrectIndex}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, mcqCorrectIndex: parseInt(e.target.value, 10) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {currentQuestion.mcqOptions.map((_, idx) => (
                          <option key={idx} value={idx}>{`Option ${idx + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Correct Options</label>
                      <div className="grid grid-cols-2 gap-2">
                        {currentQuestion.mcqOptions.map((opt, idx) => (
                          <label key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={currentQuestion.mmaCorrectIndexes.includes(idx)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...currentQuestion.mmaCorrectIndexes, idx]
                                  : currentQuestion.mmaCorrectIndexes.filter((i) => i !== idx);
                                setCurrentQuestion({ ...currentQuestion, mmaCorrectIndexes: next });
                              }}
                            />
                            {opt || `Option ${idx + 1}`}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentQuestion.questionTypeCode === 'TOF' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
                  <select
                    value={currentQuestion.trueFalseAnswer}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, trueFalseAnswer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </select>
                </div>
              )}

              {['FIB', 'SAQ'].includes(currentQuestion.questionTypeCode) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Answers *</label>
                  <input
                    type="text"
                    value={currentQuestion.blankAnswers}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, blankAnswers: e.target.value })}
                    placeholder="Comma separated answers"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {currentQuestion.questionTypeCode === 'MTF' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Matching Pairs</label>
                  <div className="space-y-2">
                    {currentQuestion.matchPairs.map((pair, idx) => (
                      <div key={idx} className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={pair.left}
                          placeholder={`Left ${idx + 1}`}
                          onChange={(e) => {
                            const next = [...currentQuestion.matchPairs];
                            next[idx] = { ...next[idx], left: e.target.value };
                            setCurrentQuestion({ ...currentQuestion, matchPairs: next });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={pair.right}
                          placeholder={`Right ${idx + 1}`}
                          onChange={(e) => {
                            const next = [...currentQuestion.matchPairs];
                            next[idx] = { ...next[idx], right: e.target.value };
                            setCurrentQuestion({ ...currentQuestion, matchPairs: next });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentQuestion.questionTypeCode === 'ORD' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Correct Sequence Items</label>
                  <input
                    type="text"
                    value={currentQuestion.orderingItems}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, orderingItems: e.target.value })}
                    placeholder="Comma separated items in correct order"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (Optional)</label>
                <textarea
                  rows={3}
                  value={currentQuestion.explanation}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, explanation: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowQuestionModal(false)}
                  className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const added = handleAddQuestion();
                    if (added) setShowQuestionModal(false);
                  }}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingQuestionId ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white w-full max-w-3xl rounded-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-2xl font-semibold text-gray-800">Question Preview</h2>
               <button
                onClick={() => setPreviewQuestion(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-50 text-blue-600"
              >
                <X className="w-5 h-5" />
              </button>

            </div>
            <div className="p-6">
              <div className="bg-white border border-gray-200 rounded-md p-4">
                <div className="inline-flex px-3 py-1 text-sm rounded bg-blue-100 text-blue-700 mb-4">
                  {getModuleName(previewQuestion.moduleId || previewQuestion.module_id)}
                </div>

                <p className="text-2xl text-gray-800 mb-4">
                  {previewQuestion.questionText || previewQuestion.question_text}
                </p>

                {Array.isArray((previewQuestion.questionData || previewQuestion.question_data)?.options) && (
                  <button
                    onClick={() => setShowPreviewOptions((v) => !v)}
                    className="text-blue-600 mb-4"
                  >
                    {showPreviewOptions ? 'Hide Options' : 'View Options'}
                  </button>
      
                )}

                {showPreviewOptions && (
                  <div className="mb-4">
                    <ul className="list-disc pl-6 text-gray-700">
                      {(previewQuestion.questionData || previewQuestion.question_data)?.options?.map((opt, i) => (
                        <li key={`${opt}-${i}`}>{opt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-3 text-base">
                  <div>
                    <span className="font-semibold text-gray-700">Question Type:</span>{' '}
                    <span className="text-gray-600">
                      {(previewQuestion.questionData || previewQuestion.question_data)?.question_type_name ||
                        (previewQuestion.questionData || previewQuestion.question_data)?.question_type_code ||
                        'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Difficulty Level:</span>{' '}
                    <span className="text-gray-600">{previewQuestion.difficulty || 'Medium'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Marks/Points:</span>{' '}
                    <span className="text-gray-600">{previewQuestion.marks || 1} XP</span>
                  </div>
                </div>

                <div className="mt-5 inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                  {previewQuestion.id}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Questions;
