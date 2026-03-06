
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { API_ENDPOINTS } from '../../../config/api';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/exam-module').replace('/api/exam-module', '');

const Exams = ({ onNext }) => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchCode, setSearchCode] = useState('');
  const [searchTitle, setSearchTitle] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    title: '',
    duration_minutes: '60',
    passing_score: '70',
    total_marks: '100',
    description: '',
    isActive: true,
    show_result: true
  });

  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);
  const modalRef = useRef(null);
  const [notice, setNotice] = useState({ type: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ 
    isOpen: false, 
    action: 'delete',
    title: '', 
    message: '', 
    examName: '',
    examId: null,
    force: false,
    isProcessing: false
  });

  const getAuthHeaders = (includeJson = false) => {
    const token = localStorage.getItem('token');
    return {
      ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  useEffect(() => {
    loadExams();
  }, [searchCode, searchTitle, filterStatus, page, rowsPerPage]);

  useEffect(() => {
    if (editingExam) {
      setFormData({
        title: editingExam.title || '',
        duration_minutes: String(editingExam.duration_minutes ?? 60),
        passing_score: String(editingExam.passing_score ?? 70),
        total_marks: String(editingExam.total_marks ?? 100),
        description: editingExam.description || '',
        isActive: editingExam.is_active ?? true,
        show_result: editingExam.show_result ?? true
      });
    } else {
      setFormData({
        title: '',
        duration_minutes: '60', passing_score: '70', total_marks: '100',
        description: '', isActive: true, show_result: true
      });
    }
  }, [editingExam]);

  useEffect(() => {
    if (showModal && editorRef.current) {
      editorRef.current.innerHTML = formData.description || '';
    }
  }, [showModal, editingExam]);

  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e) => {
      if (e.key !== 'Backspace') return;
      const target = document.activeElement;
      const isEditable = target?.isContentEditable || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
      const inModal = modalRef.current?.contains(target);
      if (isEditable && inModal) return;
      e.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showModal]);

  const loadExams = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: rowsPerPage,
        ...(searchCode && { search_code: searchCode }),
        ...(searchTitle && { search_title: searchTitle }),
        ...(filterStatus && { status: filterStatus })
      });

      const res = await fetch(`${API_ROOT}/api/exam-management/exams?${params}`);
      const result = await res.json();

      if (result.success) {
        setExams(result.data);
        setTotalPages(result.pagination.totalPages);
      }
    } catch (error) {
      showAlertOnce('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmedTitle = formData.title.trim();
    if (!trimmedTitle) {
      showAlertOnce('Exam title is required');
      return;
    }
    const durationMinutes = Number(formData.duration_minutes);
    const passingScore = Number(formData.passing_score);
    const totalMarks = Number(formData.total_marks);

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      showAlertOnce('Duration must be greater than 0');
      return;
    }
    if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) {
      showAlertOnce('Passing score must be between 0 and 100');
      return;
    }
    if (!Number.isFinite(totalMarks) || totalMarks <= 0) {
      showAlertOnce('Total marks must be greater than 0');
      return;
    }
    setSaving(true);

    try {
      const url = editingExam
        ? `${API_ROOT}/api/exam-management/exams/${editingExam.id}`
        : `${API_ROOT}/api/exam-management/exams`;

      const payload = {
        title: trimmedTitle,
        duration_minutes: durationMinutes,
        passing_score: passingScore,
        total_marks: totalMarks,
        description: formData.description,
        is_active: formData.isActive,
        show_result: formData.show_result
      };

      const res = await fetch(url, {
        method: editingExam ? 'PUT' : 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (result.success) {
        setShowModal(false);
        setEditingExam(null);
        loadExams();
        showAlertOnce(result.message || (editingExam ? 'Exam updated' : 'Exam created'), 'success');
        if (!editingExam && onNext && result.data) {
          onNext({ examId: result.data.id, examTitle: result.data.title, levelName: '' });
        }
      } else {
        showAlertOnce(result.message || 'Save failed');
      }
    } catch (error) {
      showAlertOnce('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    if (!id) {
      showAlertOnce('Invalid exam id. Please refresh and try again.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      action: 'delete',
      title: 'Delete Exam',
      message: `Are you sure you want to delete the exam "${name}"? This will move it to the Recycle Bin where you can restore or permanently delete it.`,
      examName: name,
      examId: id,
      force: false,
      isProcessing: false
    });
  };

  const handleConfirmAction = async () => {
    const id = confirmModal.examId;
    if (!id) {
      showAlertOnce('Invalid exam id. Please refresh and try again.');
      return;
    }
    try {
      setConfirmModal(prev => ({ ...prev, isProcessing: true }));
      const endpoint = confirmModal.action === 'toggle'
        ? `${API_ROOT}/api/exam-management/exams/${id}/toggle${confirmModal.force ? '?force=true' : ''}`
        : `${API_ENDPOINTS.EXAM_DELETE(id)}${confirmModal.force ? '?force=true' : ''}`;
      const res = await fetch(endpoint, { 
        method: confirmModal.action === 'toggle' ? 'PATCH' : 'DELETE',
        headers: getAuthHeaders() 
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(result.message || `HTTP ${res.status}`);
        err.status = res.status;
        err.payload = result;
        throw err;
      }
      if (result.success) {
        setConfirmModal({ isOpen: false, action: 'delete', title: '', message: '', examName: '', examId: null, force: false, isProcessing: false });
        loadExams();
        showAlertOnce(result.message || (confirmModal.action === 'toggle' ? 'Status updated' : 'Exam deleted and moved to trash'), 'success');
      } else {
        showAlertOnce(result.message || 'Action failed');
      }
    } catch (error) {
      if (Number(error.status) === 409 && error.payload?.requires_force) {
        setConfirmModal((prev) => ({
          ...prev,
          title: prev.action === 'toggle' ? 'Confirm Deactivate Exam' : 'Confirm Delete Exam',
          message: error.payload?.message || 'This exam has attempts. Continue only if you are sure.',
          force: true,
          isProcessing: false,
        }));
        return;
      }
      console.error('Action error:', error);
      showAlertOnce(error.message || `Failed to ${confirmModal.action === 'toggle' ? 'toggle' : 'delete'} exam. Please try again.`);
    } finally {
      setConfirmModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleToggle = async (id) => {
    try {
    const res = await fetch(`${API_ROOT}/api/exam-management/exams/${id}/toggle`, { method: 'PATCH', headers: getAuthHeaders() });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 409 && result?.requires_force) {
          setConfirmModal({
            isOpen: true,
            action: 'toggle',
            title: 'Confirm Deactivate Exam',
            message: result.message || 'This exam has attempts. Deactivating can impact students. Continue?',
            examName: '',
            examId: id,
            force: true,
            isProcessing: false
          });
          return;
        }
        throw new Error(result.message || `HTTP ${res.status}`);
      }
      if (result.success) {
        loadExams();
        showAlertOnce(result.message || 'Status updated', 'success');
      } else {
        showAlertOnce(result.message || 'Toggle failed');
      }
    } catch (error) {
      showAlertOnce(error.message || 'Toggle failed');
    }
  };

  const handleGoToQuestions = (exam) => {
    const examId = exam.id ?? exam.exam_id;
    if (!examId) {
      showAlertOnce('Invalid exam id. Please refresh and try again.');
      return;
    }
    if (onNext) {
      onNext({ examId, examTitle: exam.title, levelName: '' });
      return;
    }
    const params = new URLSearchParams({
      examId: String(examId),
      examTitle: exam.title || '',
      levelName: '',
    });
    navigate(`/admin/exam-management/questions?${params.toString()}`);
  };

  const handleRowAction = async (exam, action) => {
    const examId = exam.id ?? exam.exam_id ?? null;
    if (action === 'manage_questions') {
      handleGoToQuestions(exam);
      return;
    }
    if (action === 'manage_question_types') {
      navigate('/admin/exam-management/question-types');
      return;
    }
    if (action === 'edit') {
      setEditingExam({ ...exam, id: examId });
      setShowModal(true);
      return;
    }
    if (action === 'toggle') {
      handleToggle(examId);
      return;
    }
    if (action === 'toggle_result_visibility') {
      handleToggleResultVisibility(examId);
      return;
    }
    if (action === 'delete') {
      handleDelete(examId, exam.title);
    }
  };

  const handleToggleResultVisibility = async (id) => {
    try {
      const res = await fetch(`${API_ROOT}/api/exam-management/exams/${id}/toggle-result-visibility`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      const result = await res.json();
      if (result.success) {
        loadExams();
        showAlertOnce(result.message || 'Result visibility updated', 'success');
      } else {
        showAlertOnce(result.message || 'Failed to update result visibility');
      }
    } catch (error) {
      showAlertOnce('Failed to update result visibility');
    }
  };

  const applyFormat = (command) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, null);
    setFormData((prev) => ({ ...prev, description: editorRef.current.innerHTML }));
  };

  const showAlertOnce = (message, type = 'error') => {
    setNotice({ message, type });
    setTimeout(() => setNotice({ message: '', type: '' }), 3000);
  };

  const getStatusBadgeClass = (isActive) => (
    isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
  );

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
              {notice.type === "success" ? "" : "!"}
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
                      setConfirmModal({ isOpen: false, action: 'delete', title: '', message: '', examName: '', examId: null, force: false, isProcessing: false });
                    }
                  }}
                  disabled={confirmModal.isProcessing}
                  className="px-4 py-2 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={confirmModal.isProcessing}
                  className="px-4 py-2 rounded-lg text-white font-medium transition-colors text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500 flex items-center gap-2"
                >
                  {confirmModal.isProcessing && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  )}
                  {confirmModal.action === 'toggle' ? 'Deactivate' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Exams</h1>
          <button
            onClick={() => { setEditingExam(null); setShowModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            NEW EXAM
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="min-w-[1240px]">
          <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_240px] gap-4 p-4 border-b border-gray-200">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase">CODE</label>
              <input
                type="text"
                placeholder="Search Code"
                value={searchCode}
                onChange={(e) => { setSearchCode(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase">TITLE</label>
              <input
                type="text"
                placeholder="Search Title"
                value={searchTitle}
                onChange={(e) => { setSearchTitle(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase">STATUS</label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-2 uppercase">RESULT</label></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-2 uppercase">ACTIONS</label></div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading...</p>
            </div>
          ) : exams.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No exams found</div>
          ) : (
            exams.map((exam) => (
              <div key={exam.id ?? exam.exam_id ?? exam.code} className="grid grid-cols-[1fr_1.5fr_1fr_1fr_240px] gap-4 items-center p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <div>
                  <button
                    onClick={() => handleGoToQuestions(exam)}
                    className="inline-flex items-center gap-1 bg-blue-500 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-600"
                    title="Add questions for this exam"
                  >
                    {exam.code}
                  </button>
                </div>
                <div><span className="font-medium text-gray-800">{exam.title}</span></div>
                <div>
                  <span className={`inline-block px-3 py-1.5 rounded text-sm font-medium ${getStatusBadgeClass(exam.is_active)}`}>
                    {exam.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <span className={`inline-block px-3 py-1.5 rounded text-sm font-medium ${exam.show_result ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {exam.show_result ? 'Visible' : 'Hidden'}
                  </span>
                </div>
                <div className="flex justify-end">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      handleRowAction(exam, e.target.value);
                      e.target.value = '';
                    }}
                    className="w-full max-w-[230px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Actions</option>
                    <option value="manage_questions">Manage Questions</option>
                    <option value="manage_question_types">Question Types</option>
                    <option value="edit">Edit</option>
                    <option value="toggle">{exam.is_active ? 'Make Inactive' : 'Make Active'}</option>
                    <option value="toggle_result_visibility">{exam.show_result ? 'Hide Result' : 'Show Result'}</option>
                    <option value="delete">Delete</option>
                  </select>
                </div>
              </div>
            ))
          )}

          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">ROWS PER PAGE:</span>
              <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(1); }} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 font-medium">PAGE</span>
              <input type="number" value={page} onChange={(e) => { const p = parseInt(e.target.value); if (p >= 1 && p <= totalPages) setPage(p); }}
                min="1" max={totalPages} className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-center" />
              <span className="text-sm text-gray-600 font-medium">OF {totalPages}</span>
            </div>
          </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 overflow-y-auto">
          <div ref={modalRef} className="bg-white w-full max-w-4xl rounded-lg my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">{editingExam ? 'Edit Exam' : 'New Exam'}</h2>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-50 text-blue-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-2">Exam Title <span className="text-red-500">*</span></label>
                  <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Java Beginner Exam" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Duration (minutes) <span className="text-red-500">*</span></label>
                  <input type="number" required min="1" value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Passing Score (%)</label>
                  <input type="number" min="0" max="100" value={formData.passing_score}
                    onChange={(e) => setFormData({ ...formData, passing_score: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Total Marks</label>
                  <input type="number" min="1" value={formData.total_marks}
                    onChange={(e) => setFormData({ ...formData, total_marks: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Show Result to Student</label>
                  <select
                    value={formData.show_result ? 'yes' : 'no'}
                    onChange={(e) => setFormData({ ...formData, show_result: e.target.value === 'yes' })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>


                <div className="md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Active</label>
                      <p className="text-sm text-gray-500">Active (Shown Everywhere). In-active (Hidden Everywhere).</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:bg-gray-400">
                  {saving ? 'Saving...' : editingExam ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
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

export default Exams;











