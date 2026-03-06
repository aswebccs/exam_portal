import React, { useEffect, useMemo, useState } from 'react';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/exam-module').replace('/api/exam-module', '');

const FALLBACK_QUESTION_TYPES = [
  {
    code: 'MSA',
    name: 'Multiple Choice Single Answer',
    shortDescription: 'Users pick one correct option from the given choices.',
    isActive: true,
  },
  {
    code: 'MMA',
    name: 'Multiple Choice Multiple Answers',
    shortDescription: 'Users can select more than one correct option.',
    isActive: true,
  },
  {
    code: 'TOF',
    name: 'True or False',
    shortDescription: 'Statement-based question where user selects true or false.',
    isActive: true,
  },
  {
    code: 'SAQ',
    name: 'Short Answer',
    shortDescription: 'Users provide brief text or numeric answers.',
    isActive: true,
  },
  {
    code: 'MTF',
    name: 'Match the Following',
    shortDescription: 'Users match items from two related lists.',
    isActive: true,
  },
  {
    code: 'ORD',
    name: 'Ordering/Sequence',
    shortDescription: 'Users arrange items in the correct order.',
    isActive: true,
  },
  {
    code: 'FIB',
    name: 'Fill in the Blanks',
    shortDescription: 'Users fill one or more missing words in a sentence/paragraph.',
    isActive: true,
  },
];

const META_BY_NAME = {
  MCQs: {
    code: 'MCQ',
    shortDescription: 'Multiple choice questions with predefined options.',
  },
  Programming: {
    code: 'PRG',
    shortDescription: 'Coding questions with solution and input/output evaluation.',
  },
  'Fill in the Blanks': {
    code: 'FIB',
    shortDescription: 'Users fill missing words in the provided text.',
  },
};

const toCode = (name) =>
  String(name || '')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 4) || 'QTY';

const QuestionTypes = () => {
  const getAuthHeaders = (includeJson = false) => {
    const token = localStorage.getItem('token');
    return {
      ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState([]);

  const loadTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_ROOT}/api/exam-management/question-types`, { headers: getAuthHeaders() });
      const result = await response.json();

      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        const mapped = result.data.map((item) => {
          const name = item.name;
          const meta = META_BY_NAME[name] || {};
          return {
            id: item.id,
            code: item.code || meta.code || toCode(name),
            name,
            shortDescription: item.short_description || meta.shortDescription || 'Configured question type in exam management.',
            isActive: typeof item.is_active === 'boolean' ? item.is_active : true,
          };
        });
        setTypes(mapped);
      } else {
        setTypes(FALLBACK_QUESTION_TYPES);
      }
    } catch (error) {
      setTypes(FALLBACK_QUESTION_TYPES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, []);

  const handleToggleStatus = async (type) => {
    if (!type.id) return;
    try {
      const response = await fetch(`${API_ROOT}/api/exam-management/question-types/${type.id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const result = await response.json();
      if (!result.success) {
        alert(result.message || 'Failed to update status');
        return;
      }
      await loadTypes();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const filteredTypes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return types;
    return types.filter((t) =>
      [t.code, t.name, t.shortDescription].some((v) => String(v).toLowerCase().includes(query))
    );
  }, [types, search]);

  return (
    <div className="min-h-screen bg-gray-100 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Question Types</h1>
          <p className="text-gray-500">Available question type definitions for admin question setup.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, name, or description"
            className="w-full md:w-96 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="min-w-[980px]">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700 uppercase">
            <div className="col-span-2">Code</div>
            <div className="col-span-3">Name</div>
            <div className="col-span-4">Short Description</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Actions</div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading question types...</div>
          ) : filteredTypes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No question types found</div>
          ) : (
            filteredTypes.map((type) => (
              <div
                key={`${type.code}-${type.name}`}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 items-start"
              >
                <div className="col-span-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-700">
                    {type.code}
                  </span>
                </div>
                <div className="col-span-3 text-gray-800 font-medium">{type.name}</div>
                <div className="col-span-4 text-gray-600">{type.shortDescription}</div>
                <div className="col-span-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                      type.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {type.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="col-span-2">
                  <select
                    defaultValue=""
                    disabled={!type.id}
                    onChange={(e) => {
                      if (e.target.value === 'toggle') {
                        handleToggleStatus(type);
                      }
                      e.target.value = '';
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">Actions</option>
                    <option value="toggle">{type.isActive ? 'Make Inactive' : 'Make Active'}</option>
                  </select>
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionTypes;

