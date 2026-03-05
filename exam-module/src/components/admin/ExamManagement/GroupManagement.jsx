import React, { useEffect, useState } from "react";
import { examApi } from "../../../api";
import { authStorage } from "../../../App";

export default function GroupManagement() {
  const token = authStorage.getToken();
  const [institutes, setInstitutes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [filterInstituteId, setFilterInstituteId] = useState("");
  const [createInstituteId, setCreateInstituteId] = useState("");
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [editingGroupId, setEditingGroupId] = useState("");
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingInstituteId, setEditingInstituteId] = useState("");
  const [notice, setNotice] = useState("");

  const notify = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
  };

  const loadInstitutes = async () => {
    if (!token) return;
    try {
      const response = await examApi.getAdminInstitutes(token);
      setInstitutes(response.data || []);
    } catch (err) {
      notify(err.message || "Failed to load institutes");
    }
  };

  const loadGroups = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await examApi.getAdminGroups(token, filterInstituteId, search);
      setGroups(response.data || []);
    } catch (err) {
      notify(err.message || "Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstitutes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadGroups();
  }, [filterInstituteId, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!createInstituteId) {
      notify("Select institute first");
      return;
    }
    if (!groupName.trim()) {
      notify("Group name is required");
      return;
    }
    setSaving(true);
    try {
      await examApi.createAdminGroup(
        { group_name: groupName.trim(), institute_id: createInstituteId },
        token
      );
      setGroupName("");
      setCreateInstituteId("");
      setShowCreateCard(false);
      notify("Group created");
      loadGroups();
      loadInstitutes();
    } catch (err) {
      notify(err.message || "Failed to create group");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (group) => {
    setEditingGroupId(String(group.id));
    setEditingGroupName(String(group.group_name || ""));
    setEditingInstituteId(String(group.institute_id || ""));
  };

  const cancelEdit = () => {
    setEditingGroupId("");
    setEditingGroupName("");
    setEditingInstituteId("");
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingGroupId) return;
    if (!editingGroupName.trim() || !editingInstituteId) {
      notify("Group name and institute are required");
      return;
    }
    setSavingId(editingGroupId);
    try {
      await examApi.updateAdminGroup(
        editingGroupId,
        { group_name: editingGroupName.trim(), institute_id: editingInstituteId },
        token
      );
      notify("Group updated");
      cancelEdit();
      loadGroups();
      loadInstitutes();
    } catch (err) {
      notify(err.message || "Failed to update group");
    } finally {
      setSavingId("");
    }
  };

  const handleRowAction = (action, group) => {
    if (action === "edit") {
      startEdit(group);
      return;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Group Management</h1>
        <button
          type="button"
          onClick={() => setShowCreateCard(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          NEW GROUP
        </button>
      </div>
      {notice ? <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm">{notice}</div> : null}

      {showCreateCard ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-900">New Group</h2>
              <button
                type="button"
                onClick={() => {
                  setGroupName("");
                  setCreateInstituteId("");
                  setShowCreateCard(false);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-50 text-blue-600 text-4xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-xl font-medium text-gray-800 mb-2">Institute *</label>
                <select
                  value={createInstituteId}
                  onChange={(e) => setCreateInstituteId(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Institute</option>
                  {institutes.map((institute) => (
                    <option key={institute.id} value={institute.id}>
                      {institute.institute_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xl font-medium text-gray-800 mb-2">Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Batch A"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-xl font-semibold"
                >
                  {saving ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupName("");
                    setCreateInstituteId("");
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

      {editingGroupId ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={editingInstituteId}
              onChange={(e) => setEditingInstituteId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Institute</option>
              {institutes.map((institute) => (
                <option key={institute.id} value={institute.id}>
                  {institute.institute_name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={editingGroupName}
              onChange={(e) => setEditingGroupName(e.target.value)}
              placeholder="Update group name"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={savingId === editingGroupId}
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
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-3">
          <select
            value={filterInstituteId}
            onChange={(e) => setFilterInstituteId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Institutes</option>
            {institutes.map((institute) => (
              <option key={institute.id} value={institute.id}>
                {institute.institute_name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search group"
            className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Group Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Institute</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Created At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-500" colSpan={4}>Loading...</td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-500" colSpan={4}>No groups found</td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.id} className="border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{group.group_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{group.institute_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {group.created_at ? new Date(group.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        defaultValue=""
                        disabled={savingId === String(group.id)}
                        onChange={(e) => {
                          const action = e.target.value;
                          e.target.value = "";
                          handleRowAction(action, group);
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
