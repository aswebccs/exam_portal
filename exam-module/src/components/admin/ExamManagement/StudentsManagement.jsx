import React, { useEffect, useMemo, useRef, useState } from "react";
import { examApi } from "../../../api";
import { authStorage } from "../../../App";
import { Eye, EyeOff } from "lucide-react";

function ToggleSwitch({ checked, onClick, disabled = false, onLabel = "ON", offLabel = "OFF" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-7 w-16 items-center rounded-full border transition-colors ${
        checked ? "bg-blue-600 border-blue-600" : "bg-gray-200 border-gray-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span className={`absolute text-[10px] font-semibold ${checked ? "left-2 text-white" : "right-2 text-gray-600"}`}>
        {checked ? onLabel : offLabel}
      </span>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-9" : "translate-x-1"}`} />
    </button>
  );
}

export default function StudentsManagement({ mode = "all" }) {
  const token = authStorage.getToken();
  const defaultTab = mode === "assignments" ? "assignments" : "students";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [students, setStudents] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [exams, setExams] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedStatusStudentIds, setSelectedStatusStudentIds] = useState([]);
  const [statusBulkAction, setStatusBulkAction] = useState("active");
  const [bulkAction, setBulkAction] = useState("assign");

  const [searchName, setSearchName] = useState("");
  const [searchRollNumber, setSearchRollNumber] = useState("");
  const [filterInstituteId, setFilterInstituteId] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [filterActive, setFilterActive] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [manualForm, setManualForm] = useState({
    full_name: "",
    roll_number: "",
    mobile: "",
    email: "",
    password: "",
    institute_id: "",
    group_id: "",
    is_active: true,
  });
  const [file, setFile] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState("");
  const [editForm, setEditForm] = useState({
    full_name: "",
    roll_number: "",
    mobile: "",
    email: "",
    password: "",
    institute_id: "",
    group_id: "",
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [savingRowId, setSavingRowId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef(null);

  const notify = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
  };

  const loadBaseData = async () => {
    if (!token) return;
    try {
      const [institutesRes, groupsRes, examsRes] = await Promise.all([
        examApi.getAdminInstitutes(token),
        examApi.getAdminGroups(token),
        examApi.getAdminExams(token),
      ]);
      setInstitutes(institutesRes.data || []);
      setGroups(groupsRes.data || []);
      setExams(examsRes.data || []);
    } catch (err) {
      notify(err.message || "Failed to load base data");
    }
  };

  const loadStudents = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await examApi.getAdminStudents(token, {
        search: searchName,
        roll_number: searchRollNumber,
        institute_id: filterInstituteId,
        group_id: filterGroupId,
        is_active: filterActive === "" ? undefined : filterActive === "true",
      });
      setStudents(response.data || []);
    } catch (err) {
      notify(err.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async (examId) => {
    if (!token || !examId) {
      setAssignments([]);
      return;
    }
    try {
      const assignmentsRes = await examApi.getExamAssignments(examId, token);
      setAssignments(assignmentsRes.data || []);
    } catch (err) {
      setAssignments([]);
      notify(err.message || "Failed to load assignments");
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep tab in sync when route-level mode changes (students vs assignments).
  useEffect(() => {
    const nextTab = mode === "assignments" ? "assignments" : "students";
    setActiveTab(nextTab);
  }, [mode]);

  useEffect(() => {
    loadStudents();
  }, [searchName, searchRollNumber, filterInstituteId, filterGroupId, filterActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadAssignments(selectedExamId);
    setSelectedStudentIds([]);
  }, [selectedExamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateStudent = async (event) => {
    event.preventDefault();
    const mobile = String(manualForm.mobile || "").trim();
    if (!/^[0-9]{10,15}$/.test(mobile)) {
      notify("Mobile number must be 10 to 15 digits");
      return;
    }
    if (!manualForm.full_name || !manualForm.roll_number || !manualForm.email || !manualForm.password || !manualForm.institute_id || !manualForm.group_id) {
      notify("Please fill all required fields");
      return;
    }
    try {
      await examApi.createAdminStudent(manualForm, token);
      setManualForm({
        full_name: "",
        roll_number: "",
        mobile: "",
        email: "",
        password: "",
        institute_id: "",
        group_id: "",
        is_active: true,
      });
      setShowAddModal(false);
      notify("Student created successfully");
      loadStudents();
    } catch (err) {
      notify(err.message || "Failed to create student");
    }
  };

  const handleBulkUpload = async () => {
    if (!file) {
      notify("Please select a file");
      return;
    }
    try {
      const response = await examApi.bulkUploadStudents(file, token);
      const report = response?.data || {};
      notify(`Inserted: ${report.inserted_count || 0}, Skipped: ${report.skipped_count || 0}`);
      setFile(null);
      loadStudents();
    } catch (err) {
      notify(err.message || "Bulk upload failed");
    }
  };

  const downloadTemplate = () => {
    const headers = ["full_name", "roll_number", "mobile", "email", "password", "institute_id", "group_id"];
    const sampleRows = [
      ["John Doe", "ROLL001", "9999999999", "john@example.com", "Pass@123", "", ""],
      ["Jane Smith", "ROLL002", "8888888888", "jane@example.com", "Pass@123", "", ""],
    ];
    const csvData = [headers, ...sampleRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "students-upload-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const assignmentMap = useMemo(() => {
    const map = new Map();
    for (const row of assignments) map.set(String(row.student_id), row);
    return map;
  }, [assignments]);

  const visibleStudentIds = useMemo(() => students.map((s) => String(s.id)), [students]);
  const isAllSelected = useMemo(
    () => visibleStudentIds.length > 0 && visibleStudentIds.every((id) => selectedStudentIds.includes(id)),
    [visibleStudentIds, selectedStudentIds]
  );
  const isAllStatusSelected = useMemo(
    () => visibleStudentIds.length > 0 && visibleStudentIds.every((id) => selectedStatusStudentIds.includes(id)),
    [visibleStudentIds, selectedStatusStudentIds]
  );

  const groupsForSelectedInstituteFilter = useMemo(() => {
    if (!filterInstituteId) return groups;
    return groups.filter((g) => String(g.institute_id) === String(filterInstituteId));
  }, [groups, filterInstituteId]);

  const groupsForStudentForm = useMemo(() => {
    if (!manualForm.institute_id) return [];
    return groups.filter((g) => String(g.institute_id) === String(manualForm.institute_id));
  }, [groups, manualForm.institute_id]);

  const groupsForEditForm = useMemo(() => {
    if (!editForm.institute_id) return [];
    return groups.filter((g) => String(g.institute_id) === String(editForm.institute_id));
  }, [groups, editForm.institute_id]);

  useEffect(() => {
    setSelectedStatusStudentIds((prev) => prev.filter((id) => visibleStudentIds.includes(id)));
  }, [visibleStudentIds]);

  const toggleStudentAssignment = async (studentId, assignedNow) => {
    if (!selectedExamId) return;
    setSavingRowId(String(studentId));
    try {
      if (assignedNow) {
        await examApi.removeExamAssignment(selectedExamId, studentId, token);
      } else {
        await examApi.assignStudentsToExam(selectedExamId, [studentId], token);
      }
      await loadAssignments(selectedExamId);
      notify(`Assignment ${assignedNow ? "removed" : "updated"}`);
    } catch (err) {
      notify(err.message || "Failed to update assignment");
    } finally {
      setSavingRowId("");
    }
  };

  const toggleStudentActiveStatus = async (studentId, currentActive) => {
    setSavingRowId(String(studentId));
    try {
      await examApi.updateAdminStudentStatus(studentId, !currentActive, token);
      notify(`Student marked as ${!currentActive ? "active" : "inactive"}`);
      await loadStudents();
    } catch (err) {
      notify(err.message || "Failed to update student status");
    } finally {
      setSavingRowId("");
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!selectedStatusStudentIds.length) {
      notify("Select at least one student");
      return;
    }
    setBulkSaving(true);
    try {
      const nextActive = statusBulkAction === "active";
      await examApi.bulkUpdateAdminStudentStatus(selectedStatusStudentIds, nextActive, token);
      notify(`Selected students marked as ${nextActive ? "active" : "inactive"}`);
      setSelectedStatusStudentIds([]);
      await loadStudents();
    } catch (err) {
      notify(err.message || "Failed to update student status");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleRunBulkAction = async () => {
    if (!selectedExamId) {
      notify("Select an exam first");
      return;
    }
    if (!selectedStudentIds.length) {
      notify("Select at least one student");
      return;
    }
    setBulkSaving(true);
    try {
      if (bulkAction === "assign") {
        await examApi.assignStudentsToExam(selectedExamId, selectedStudentIds, token);
      } else if (bulkAction === "remove") {
        await Promise.all(selectedStudentIds.map((studentId) => examApi.removeExamAssignment(selectedExamId, studentId, token).catch(() => null)));
      }
      await loadAssignments(selectedExamId);
      setSelectedStudentIds([]);
      notify("Bulk action completed");
    } catch (err) {
      notify(err.message || "Bulk action failed");
    } finally {
      setBulkSaving(false);
    }
  };

  const openEditModal = (student) => {
    setEditingStudentId(String(student.id));
    setEditForm({
      full_name: student.full_name || "",
      roll_number: student.roll_number || "",
      mobile: student.mobile || "",
      email: student.email || "",
      password: "",
      institute_id: student.institute_id || "",
      group_id: student.group_id || "",
      is_active: student.is_active !== false,
    });
    setShowEditModal(true);
  };

  const handleEditStudent = async (event) => {
    event.preventDefault();
    if (!editingStudentId) return;
    const mobile = String(editForm.mobile || "").trim();
    if (!/^[0-9]{10,15}$/.test(mobile)) {
      notify("Mobile number must be 10 to 15 digits");
      return;
    }
    if (!editForm.full_name || !editForm.roll_number || !editForm.email || !editForm.institute_id || !editForm.group_id) {
      notify("Please fill all required fields");
      return;
    }
    try {
      await examApi.updateAdminStudent(editingStudentId, editForm, token);
      notify("Student updated successfully");
      setShowEditModal(false);
      setEditingStudentId("");
      await loadStudents();
    } catch (err) {
      notify(err.message || "Failed to update student");
    }
  };

  const showTabSwitch = mode === "all";

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-800">{activeTab === "assignments" ? "Exam Assignment" : "Student Management"}</h1>
        {showTabSwitch ? (
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => setActiveTab("students")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "students" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Students
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "assignments" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Exam Assignment
          </button>
        </div>
        ) : null}
      </div>

      {notice ? <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm">{notice}</div> : null}

      {activeTab === "students" ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200 flex flex-col gap-3">
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Add Student
              </button>
              <button onClick={() => setShowUploadPanel((v) => !v)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Upload Excel/CSV
              </button>
              <button onClick={downloadTemplate} className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Download CSV Template
              </button>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
             
              <div className="flex gap-2">
                <select
                  value={statusBulkAction}
                  onChange={(e) => setStatusBulkAction(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="active">Mark Selected Active</option>
                  <option value="inactive">Mark Selected Inactive</option>
                </select>
                <button
                  onClick={handleBulkStatusUpdate}
                  disabled={!selectedStatusStudentIds.length || bulkSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {bulkSaving ? "Applying..." : "Apply"}
                </button>
              </div>
            </div>

            </div>

            

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Search by name" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <input type="text" value={searchRollNumber} onChange={(e) => setSearchRollNumber(e.target.value)} placeholder="Search by roll number" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <select value={filterInstituteId} onChange={(e) => { setFilterInstituteId(e.target.value); setFilterGroupId(""); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">All Institutes</option>
                {institutes.map((institute) => (<option key={institute.id} value={institute.id}>{institute.institute_name}</option>))}
              </select>
              <select value={filterGroupId} onChange={(e) => setFilterGroupId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">All Groups</option>
                {groupsForSelectedInstituteFilter.map((group) => (<option key={group.id} value={group.id}>{group.group_name}</option>))}
              </select>
              <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          {showUploadPanel ? (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col gap-3 border border-dashed border-emerald-300 bg-white rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium w-fit">Choose File</button>
                  <span className="text-sm text-gray-600">{file ? file.name : "No file selected"}</span>
                </div>
                <button onClick={handleBulkUpload} className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-semibold w-fit">Upload File</button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Required columns: full_name,roll_number,password (optional: email,mobile,institute_id,group_id)</p>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 w-12">
                    <input
                      type="checkbox"
                      checked={isAllStatusSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStatusStudentIds((prev) => Array.from(new Set([...prev, ...visibleStudentIds])));
                        } else {
                          setSelectedStatusStudentIds((prev) => prev.filter((id) => !visibleStudentIds.includes(id)));
                        }
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Roll Number</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Institute</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Group</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Created At</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={8}>Loading students...</td></tr>
                ) : students.length === 0 ? (
                  <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={8}>No students found</td></tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.id} className="border-t border-gray-200">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedStatusStudentIds.includes(String(student.id))}
                          onChange={(e) => {
                            const studentId = String(student.id);
                            setSelectedStatusStudentIds((prev) =>
                              e.target.checked ? [...prev, studentId] : prev.filter((id) => id !== studentId)
                            );
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{student.full_name || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{student.roll_number || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{student.institute_name || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{student.group_name || "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <ToggleSwitch checked={student.is_active !== false} disabled={savingRowId === String(student.id)} onClick={() => toggleStudentActiveStatus(student.id, student.is_active !== false)} onLabel="ON" offLabel="OFF" />
                          <span className={`text-xs font-semibold ${student.is_active !== false ? "text-emerald-700" : "text-red-700"}`}>{student.is_active !== false ? "Active" : "Inactive"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{student.created_at ? new Date(student.created_at).toLocaleString() : "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        <select
                          defaultValue=""
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                          onChange={(e) => {
                            const action = e.target.value;
                            e.target.value = "";
                            if (action === "edit") openEditModal(student);
                          }}
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
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Exam Assignment</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Exam</option>
              {exams.map((exam) => (<option key={exam.id} value={exam.id}>{exam.title}</option>))}
            </select>
            <input type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Search by student name" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <div className="flex gap-2">
              <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="assign">Assign Exam to Selected</option>
                <option value="remove">Remove Exam from Selected</option>
              </select>
              <button onClick={handleRunBulkAction} disabled={!selectedExamId || !selectedStudentIds.length || bulkSaving} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{bulkSaving ? "Applying..." : "Actions"}</button>
            </div>
          </div>

          {!selectedExamId ? (
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-600">Select an exam to load students.</div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 w-12">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...visibleStudentIds])));
                          else setSelectedStudentIds((prev) => prev.filter((id) => !visibleStudentIds.includes(id)));
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Roll Number</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-4 py-3 text-sm text-gray-500" colSpan={4}>Loading...</td></tr>
                  ) : students.length === 0 ? (
                    <tr><td className="px-4 py-3 text-sm text-gray-500" colSpan={4}>No students found</td></tr>
                  ) : (
                    students.map((student) => {
                      const studentId = String(student.id);
                      const assignment = assignmentMap.get(studentId);
                      const assigned = Boolean(assignment);
                      const rowSaving = savingRowId === studentId;
                      return (
                        <tr key={student.id} className="border-t border-gray-200">
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={selectedStudentIds.includes(studentId)} onChange={(e) => setSelectedStudentIds((prev) => e.target.checked ? [...prev, studentId] : prev.filter((id) => id !== studentId))} />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{student.full_name || "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{student.roll_number || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <ToggleSwitch checked={assigned} disabled={rowSaving} onClick={() => toggleStudentAssignment(student.id, assigned)} />
                              <span className={`text-xs font-semibold ${assigned ? "text-emerald-700" : "text-gray-500"}`}>{assigned ? "Assigned" : "Not Assigned"}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddModal ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Add Student</h3>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-50 text-blue-600">x</button>
            </div>
            <form onSubmit={handleCreateStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input type="text" value={manualForm.full_name} onChange={(e) => setManualForm((p) => ({ ...p, full_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                  <input type="text" value={manualForm.roll_number} onChange={(e) => setManualForm((p) => ({ ...p, roll_number: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                  <input type="tel" value={manualForm.mobile} onChange={(e) => setManualForm((p) => ({ ...p, mobile: e.target.value.replace(/[^\d]/g, "") }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" minLength={10} maxLength={15} pattern="[0-9]{10,15}" title="Enter 10 to 15 digits" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={manualForm.email} onChange={(e) => setManualForm((p) => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institute</label>
                  <select value={manualForm.institute_id} onChange={(e) => setManualForm((p) => ({ ...p, institute_id: e.target.value, group_id: "" }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                    <option value="">Select Institute</option>
                    {institutes.map((institute) => (<option key={institute.id} value={institute.id}>{institute.institute_name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
                  <select value={manualForm.group_id} onChange={(e) => setManualForm((p) => ({ ...p, group_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" disabled={!manualForm.institute_id} required>
                    <option value="">Select Group</option>
                    {groupsForStudentForm.map((group) => (<option key={group.id} value={group.id}>{group.group_name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input type={showAddPassword ? "text" : "password"} value={manualForm.password} onChange={(e) => setManualForm((p) => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg pr-10" required />
                    <button
                      type="button"
                      onClick={() => setShowAddPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                      aria-label={showAddPassword ? "Hide password" : "Show password"}
                    >
                      {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between ">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Active</label>
                      <p className="text-sm text-gray-500">Active (Shown Everywhere). In-active (Hidden Everywhere).</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={manualForm.is_active} onChange={(e) => setManualForm((p) => ({ ...p, is_active: e.target.checked }))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save Student</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showEditModal ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Edit Student</h3>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-600">x</button>
            </div>
            <form onSubmit={handleEditStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input type="text" value={editForm.full_name} onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                  <input type="text" value={editForm.roll_number} onChange={(e) => setEditForm((p) => ({ ...p, roll_number: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                  <input type="tel" value={editForm.mobile} onChange={(e) => setEditForm((p) => ({ ...p, mobile: e.target.value.replace(/[^\d]/g, "") }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" minLength={10} maxLength={15} pattern="[0-9]{10,15}" title="Enter 10 to 15 digits" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institute</label>
                  <select value={editForm.institute_id} onChange={(e) => setEditForm((p) => ({ ...p, institute_id: e.target.value, group_id: "" }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                    <option value="">Select Institute</option>
                    {institutes.map((institute) => (<option key={institute.id} value={institute.id}>{institute.institute_name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
                  <select value={editForm.group_id} onChange={(e) => setEditForm((p) => ({ ...p, group_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" disabled={!editForm.institute_id} required>
                    <option value="">Select Group</option>
                    {groupsForEditForm.map((group) => (<option key={group.id} value={group.id}>{group.group_name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password (Optional)</label>
                  <div className="relative">
                    <input type={showEditPassword ? "text" : "password"} value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg pr-10" />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                      aria-label={showEditPassword ? "Hide password" : "Show password"}
                    >
                      {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Active</label>
                      <p className="text-sm text-gray-500">Active (Shown Everywhere). In-active (Hidden Everywhere).</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Update Student</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}









