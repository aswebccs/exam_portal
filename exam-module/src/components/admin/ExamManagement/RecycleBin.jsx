import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, Trash } from 'lucide-react';
import { API_ENDPOINTS } from '../../../config/api';

const RecycleBin = () => {
  const [activeTab, setActiveTab] = useState('exams');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [notice, setNotice] = useState({ type: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    type: 'restore',
    itemId: null,
    isProcessing: false
  });

  const getAuthHeaders = (includeJson = false) => {
    const token = localStorage.getItem('token');
    return {
      ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const loadTrashItems = async (tabType) => {
    try {
      setLoading(true);
      let url = '';

      if (tabType === 'exams') {
        url = `${API_ENDPOINTS.EXAMS_TRASH_LIST}?page=${page}&limit=${rowsPerPage}`;
      } else if (tabType === 'questions') {
        url = `${API_ENDPOINTS.QUESTIONS_TRASH_LIST}?page=${page}&limit=${rowsPerPage}`;
      }

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const result = await res.json();

      if (result.success) {
        setItems(result.data || []);
        setTotalPages(result.pagination?.totalPages || 1);
      } else {
        showAlert(result.message || 'Failed to load trash items', 'error');
      }
    } catch (error) {
      console.error('Load trash error:', error);
      showAlert('Error loading trash items. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadTrashItems(activeTab);
  }, [activeTab]);

  useEffect(() => {
    loadTrashItems(activeTab);
  }, [page, rowsPerPage]);

  const handleRestore = async (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Restore Item',
      message: 'Are you sure you want to restore this item to its original location?',
      type: 'restore',
      itemId: id,
      isProcessing: false
    });
  };

  const handlePermanentDelete = async (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete Item',
      message: '⚠️ This will PERMANENTLY delete the item. This action cannot be undone!',
      type: 'delete',
      itemId: id,
      isProcessing: false
    });
  };

  const showAlert = (message, type = 'error') => {
    setNotice({ message, type });
    setTimeout(() => setNotice({ message: '', type: '' }), 3000);
  };

  const getRestoreUrl = (tab, id) => {
    if (tab === 'exams') return API_ENDPOINTS.EXAM_RESTORE(id);
    if (tab === 'questions') return API_ENDPOINTS.QUESTION_RESTORE(id);
    return '';
  };

  const getPermanentDeleteUrl = (tab, id) => {
    if (tab === 'exams') return API_ENDPOINTS.EXAM_PERMANENT_DELETE(id);
    if (tab === 'questions') return API_ENDPOINTS.QUESTION_PERMANENT_DELETE(id);
    return '';
  };

  const handleConfirmAction = async () => {
    if (confirmModal.isProcessing || !confirmModal.itemId) return;
    try {
      setConfirmModal(prev => ({ ...prev, isProcessing: true }));
      const isRestore = confirmModal.type === 'restore';

      const url = isRestore
        ? getRestoreUrl(activeTab, confirmModal.itemId)
        : getPermanentDeleteUrl(activeTab, confirmModal.itemId);
      const method = isRestore ? 'PATCH' : 'DELETE';

      if (!url) {
        showAlert('Invalid action. Please refresh and try again.', 'error');
        return;
      }

      const res = await fetch(url, { method, headers: getAuthHeaders() });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || `HTTP ${res.status}`);

      if (result.success) {
        showAlert(isRestore ? 'Item restored successfully' : 'Item permanently deleted', 'success');
        await loadTrashItems(activeTab);
        setConfirmModal({ isOpen: false, title: '', message: '', type: 'restore', itemId: null, isProcessing: false });
      } else {
        showAlert(result.message || (isRestore ? 'Restore failed' : 'Delete failed'), 'error');
      }
    } catch (error) {
      console.error(confirmModal.type === 'restore' ? 'Restore error:' : 'Permanent delete error:', error);
      showAlert(error.message || 'Action failed. Please try again.', 'error');
    } finally {
      setConfirmModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleCancelConfirm = () => {
    if (!confirmModal.isProcessing) {
      setConfirmModal({ isOpen: false, title: '', message: '', type: 'restore', itemId: null, isProcessing: false });
    }
  };

  const getTitleColumn = () => {
    if (activeTab === 'exams') return 'Exam Title';
    if (activeTab === 'questions') return 'Question Text';
    return 'Name';
  };

  const getNameValue = (item) => {
    if (activeTab === 'exams') return item.title;
    if (activeTab === 'questions') return item.question_text || item.name || '';
    return item.name || item.title || '';
  };

  const getCodeValue = (item) => {
    if (item.code) return item.code;
    if (activeTab === 'exams') return `EXM${String(item.id || '').padStart(3, '0')}`;
    if (activeTab === 'questions') return `Q${String(item.id || '').padStart(4, '0')}`;
    return '-';
  };

  const getCategoryName = (item) => {
    if (activeTab === 'exams') return item.category_name || '-';
    if (activeTab === 'questions') return item.exam_title || item.exam_name || '-';
    return '';
  };

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
              <div
                className={`text-xl ${
                  notice.type === "success" ? "text-green-500" : "text-red-500"
                }`}
              >
                {notice.type === "success" ? "✓" : "⚠"}
              </div>
              <p className="text-sm text-gray-600 mt-1">{notice.message}</p>
            </div>
          </div>
        )}

        {/* Custom Confirmation Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn">
              {/* Modal Header */}
              <div className={`p-6 ${confirmModal.type === 'delete' ? 'bg-red-50 border-b border-red-100' : 'bg-blue-50 border-b border-blue-100'}`}>
                <h3 className={`text-lg font-bold ${confirmModal.type === 'delete' ? 'text-red-900' : 'text-blue-900'}`}>
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
                  onClick={handleCancelConfirm}
                  disabled={confirmModal.isProcessing}
                  className="px-4 py-2 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={confirmModal.isProcessing}
                  className={`px-4 py-2 rounded-lg text-white font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                    confirmModal.type === 'delete'
                      ? 'bg-red-500 hover:bg-red-600 disabled:hover:bg-red-500'
                      : 'bg-blue-500 hover:bg-blue-600 disabled:hover:bg-blue-500'
                  }`}
                >
                  {confirmModal.isProcessing && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  )}
                  {confirmModal.type === 'delete' ? 'Delete Permanently' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">

          <h1 className="text-3xl font-bold text-gray-800">Recycle Bin</h1>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'exams', label: 'Exams' },
              { id: 'questions', label: 'Questions' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={`flex-1 py-4 px-6 font-medium text-center transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Headers */}
            <div className={`grid ${activeTab === 'questions' ? 'grid-cols-5' : 'grid-cols-4'} gap-4 items-center p-4 bg-gray-50 border-b border-gray-200`}>
              <div>
                <span className="text-sm font-semibold text-gray-700 uppercase">Code</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700 uppercase">
                  {getTitleColumn()}
                </span>
              </div>
              {activeTab === 'questions' ? (
                <div>
                  <span className="text-sm font-semibold text-gray-700 uppercase">Exam</span>
                </div>
              ) : null}
              <div>
                <span className="text-sm font-semibold text-gray-700 uppercase">Deleted On</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700 uppercase">Actions</span>
              </div>
            </div>

            {/* Data Rows */}
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Trash2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No deleted items in {activeTab}</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={`grid ${activeTab === 'questions' ? 'grid-cols-5' : 'grid-cols-4'} gap-4 items-center p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors`}
                >
                  <div>
                    <span className="inline-flex items-center gap-1 bg-gray-500 text-white px-3 py-1.5 rounded text-sm font-medium">
                      {getCodeValue(item)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">{getNameValue(item)}</span>
                  </div>
                  {activeTab === 'questions' ? (
                    <div>
                      <span className="text-gray-700 text-sm">{getCategoryName(item)}</span>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-gray-600 text-sm">
                      {item.deleted_at
                        ? new Date(item.deleted_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </span>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleRestore(item.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors"
                      title="Restore this item"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(item.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors"
                      title="Permanently delete (cannot be undone)"
                    >
                      <Trash className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Pagination */}
            {items.length > 0 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-medium">Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value));
                      setPage(1);
                    }}
                    className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 font-medium">Page</span>
                  <input
                    type="number"
                    value={page}
                    onChange={(e) => {
                      const newPage = parseInt(e.target.value);
                      if (newPage >= 1 && newPage <= totalPages) {
                        setPage(newPage);
                      }
                    }}
                    min="1"
                    max={totalPages}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-600 font-medium">of {totalPages}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <div className="text-yellow-600 text-lg">ℹ️</div>
          <div className="text-sm text-yellow-800">
            <p className="font-medium">How Recycle Bin Works:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Restore:</strong> Returns the item to its original location</li>
              <li><strong>Permanently Delete:</strong> Removes the item completely (cannot be undone)</li>
              <li>Deleted items are kept for your reference and auditing</li>
            </ul>
          </div>
        </div>

        <style>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-10px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

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

          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }

          .animate-scaleIn {
            animation: scaleIn 0.3s ease-out;
          }
        `}</style>
      </div>
    </div>
  );
};

export default RecycleBin;
