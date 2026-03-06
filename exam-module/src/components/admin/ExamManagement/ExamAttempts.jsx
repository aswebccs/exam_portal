import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { authStorage } from '../../../App';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/exam-module').replace('/api/exam-module', '');

const ExamAttempts = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_ROOT}/api/exam-management/attempts`, {
        params: {
          page,
          limit: 10,
          ...(search.trim() && { search: search.trim() }),
          ...(status && { status }),
        },
        headers: getAuthHeaders(),
      });
      const data = response?.data || {};
      setRows(data.data || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0, limit: 10 });
    } catch (err) {
      setRows([]);
      setPagination({ page: 1, totalPages: 1, total: 0, limit: 10 });
      alert('Failed to load exam attempts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, [page, status]);

  const handleSearch = () => {
    setPage(1);
    fetchAttempts();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Exam Attempts</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">Total: {pagination.total}</div>
          <button
            onClick={async () => {
              try {
                const token = authStorage.getToken();
                const response = await fetch(`${API_ROOT}/api/exam-module/admin/results/export?format=csv`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `exam-results-${Date.now()}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                alert('Failed to export results');
              }
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Search user/email/exam"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Results</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Search
          </button>
          <button
            onClick={() => {
              setSearch('');
              setStatus('');
              setPage(1);
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border-gray-200 overflow-x-auto">
        <table className="min-w-full border border-gray-200">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">Exam</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">Score</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">Percentage</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">Result</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Attempted At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-sm text-gray-500 border-t border-gray-200" colSpan={7}>Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-sm text-gray-500 border-t border-gray-200" colSpan={7}>No attempts found</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-200">
                  <td className="px-4 py-3 text-sm text-gray-800 border-r border-gray-200">{row.user_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{row.user_email}</td>
                  <td className="px-4 py-3 text-sm text-gray-800 border-r border-gray-200">{row.exam_title}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">{row.score}/{row.total_questions}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">{Number(row.percentage || 0).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-sm border-r border-gray-200">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${row.result_status === 'PASSED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {row.result_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {row.attempted_at ? new Date(row.attempted_at).toLocaleString() : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1.5 border rounded disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-sm text-gray-600">Page {pagination.page} of {pagination.totalPages || 1}</span>
        <button
          disabled={page >= (pagination.totalPages || 1)}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 border rounded disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ExamAttempts;

