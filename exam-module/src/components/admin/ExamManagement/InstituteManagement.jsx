import React, { useEffect, useState } from "react";
import { examApi } from "../../../api";
import { authStorage } from "../../../App";

export default function InstituteManagement() {
  const token = authStorage.getToken();
  const [institutes, setInstitutes] = useState([]);
  const [search, setSearch] = useState("");
  const [instituteName, setInstituteName] = useState("");
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [editingInstituteId, setEditingInstituteId] = useState("");
  const [editingInstituteName, setEditingInstituteName] = useState("");
  const [notice, setNotice] = useState("");

  const notify = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
  };

  const loadInstitutes = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await examApi.getAdminInstitutes(token, search);
      setInstitutes(response.data || []);
    } catch (err) {
      notify(err.message || "Failed to load institutes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstitutes();
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!instituteName.trim()) {
      notify("Institute name is required");
      return;
    }
    setSaving(true);
    try {
      await examApi.createAdminInstitute(instituteName.trim(), token);
      setInstituteName("");
      setShowCreateCard(false);
      notify("Institute created");
      loadInstitutes();
    } catch (err) {
      notify(err.message || "Failed to create institute");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (institute) => {
    setEditingInstituteId(String(institute.id));
    setEditingInstituteName(String(institute.institute_name || ""));
  };

  const cancelEdit = () => {
    setEditingInstituteId("");
    setEditingInstituteName("");
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingInstituteId) return;
    if (!editingInstituteName.trim()) {
      notify("Institute name is required");
      return;
    }
    setSavingId(editingInstituteId);
    try {
      await examApi.updateAdminInstitute(editingInstituteId, editingInstituteName.trim(), token);
      notify("Institute updated");
      cancelEdit();
      loadInstitutes();
    } catch (err) {
      notify(err.message || "Failed to update institute");
    } finally {
      setSavingId("");
    }
  };

  const handleRowAction = (action, institute) => {
    if (action === "edit") {
      startEdit(institute);
      return;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Institute Management</h1>
        <button
          type="button"
          onClick={() => setShowCreateCard(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          NEW INSTITUTE
        </button>
      </div>
      {notice ? <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm">{notice}</div> : null}

      {showCreateCard ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-900">New Institute</h2>
              <button
                type="button"
                onClick={() => {
                  setInstituteName("");
                  setShowCreateCard(false);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-50 text-blue-600 text-4xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-xl font-medium text-gray-800 mb-2">Institute Name *</label>
                <input
                  type="text"
                  value={instituteName}
                  onChange={(e) => setInstituteName(e.target.value)}
                  placeholder="e.g., ABC Institute"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5  py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-xl font-semibold"
                >
                  {saving ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInstituteName("");
                    setShowCreateCard(false);
                  }}
                  className="px-5 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-xl font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingInstituteId ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
            <input
              type="text"
              value={editingInstituteName}
              onChange={(e) => setEditingInstituteName(e.target.value)}
              placeholder="Update institute name"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={savingId === editingInstituteId}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </form>
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search institute"
            className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Institute Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Groups</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Created At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-500" colSpan={4}>Loading...</td>
                </tr>
              ) : institutes.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-500" colSpan={4}>No institutes found</td>
                </tr>
              ) : (
                institutes.map((institute) => (
                  <tr key={institute.id} className="border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{institute.institute_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{institute.group_count || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {institute.created_at ? new Date(institute.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        defaultValue=""
                        disabled={savingId === String(institute.id)}
                        onChange={(e) => {
                          const action = e.target.value;
                          e.target.value = "";
                          handleRowAction(action, institute);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      >
                        <option value="" disabled>Actions</option>
                        <option value="edit">Edit</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
