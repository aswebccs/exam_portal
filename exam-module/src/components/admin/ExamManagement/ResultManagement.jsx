import React, { useEffect, useMemo, useState } from "react";
import { examApi } from "../../../api";
import { authStorage } from "../../../App";

export default function ResultManagement() {
  const token = authStorage.getToken();
  const [results, setResults] = useState([]);
  const [exams, setExams] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const [filters, setFilters] = useState({
    exam_id: "",
    institute_id: "",
    group_id: "",
    result_status: "",
  });

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [rowSavingKey, setRowSavingKey] = useState("");
  const [exportAction, setExportAction] = useState("csv");
  const [resultAction, setResultAction] = useState("show");
  const [notice, setNotice] = useState("");

  const notify = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
  };

  const loadMeta = async () => {
    if (!token) return;
    try {
      const [examsRes, institutesRes, groupsRes] = await Promise.all([
        examApi.getAdminExams(token),
        examApi.getAdminInstitutes(token),
        examApi.getAdminGroups(token),
      ]);
      setExams(examsRes.data || []);
      setInstitutes(institutesRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (err) {
      notify(err.message || "Failed to load metadata");
    }
  };

  const loadResults = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await examApi.getAdminResults(token, filters);
      setResults(response.data || []);
    } catch (err) {
      notify(err.message || "Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadResults();
    setSelectedRowKeys([]);
  }, [filters.exam_id, filters.institute_id, filters.group_id, filters.result_status]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupsForSelectedInstitute = useMemo(() => {
    if (!filters.institute_id) return groups;
    return groups.filter((g) => String(g.institute_id || "") === String(filters.institute_id));
  }, [groups, filters.institute_id]);

  const resultRowKeys = useMemo(
    () => results.map((row) => `${row.exam_id}::${row.student_id}`),
    [results]
  );

  const isAllSelected = useMemo(
    () => resultRowKeys.length > 0 && resultRowKeys.every((key) => selectedRowKeys.includes(key)),
    [resultRowKeys, selectedRowKeys]
  );

  const handleExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const { blob, filename } = await examApi.exportAdminResults(token, exportAction, filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      notify(`Exported ${exportAction.toUpperCase()} successfully`);
    } catch (err) {
      notify(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleBulkResultVisibility = async () => {
    if (!token) return;
    if (!selectedRowKeys.length) {
      notify("Select at least one row");
      return;
    }

    const showResult = resultAction === "show";
    const pairs = Array.from(new Set(selectedRowKeys)).map((value) => {
      const [examId, studentId] = value.split("::");
      return { examId, studentId };
    });

    setVisibilitySaving(true);
    let successCount = 0;
    for (const pair of pairs) {
      try {
        await examApi.setStudentResultVisibility(pair.examId, pair.studentId, showResult, token);
        successCount += 1;
      } catch {
        // skip failure and continue
      }
    }

    await loadResults();
    setSelectedRowKeys([]);
    setVisibilitySaving(false);
    notify(`${showResult ? "Show" : "Hide"} result applied for ${successCount}/${pairs.length} selected record(s)`);
  };

  const handleSingleResultVisibility = async (row, showResult) => {
    const rowKey = `${row.exam_id}::${row.student_id}`;
    if (!row.exam_id || !row.student_id) return;
    setRowSavingKey(rowKey);
    try {
      await examApi.setStudentResultVisibility(row.exam_id, row.student_id, showResult, token);
      await loadResults();
      notify(`Result ${showResult ? "shown" : "hidden"} for ${row.student_name || "student"}`);
    } catch (err) {
      notify(err.message || "Failed to update result visibility");
    } finally {
      setRowSavingKey("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Result Management</h1>
        <span className="text-sm text-gray-500">Selected: {selectedRowKeys.length}</span>
      </div>

      {notice ? (
        <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm">{notice}</div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3">
        <div className="overflow-x-auto">
          <div className="flex items-center gap-3 min-w-[900px]">
            <select
              value={filters.exam_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, exam_id: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[190px]"
            >
              <option value="">All Exams</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>

            <select
              value={filters.institute_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, institute_id: e.target.value, group_id: "" }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[190px]"
            >
              <option value="">All Institutes</option>
              {institutes.map((institute) => (
                <option key={institute.id} value={institute.id}>
                  {institute.institute_name}
                </option>
              ))}
            </select>

            <select
              value={filters.group_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, group_id: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[190px]"
            >
              <option value="">All Groups</option>
              {groupsForSelectedInstitute.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.group_name}
                </option>
              ))}
            </select>

            <select
              value={filters.result_status}
              onChange={(e) => setFilters((prev) => ({ ...prev, result_status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[160px]"
            >
              <option value="">All Status</option>
              <option value="PASSED">PASSED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex items-center gap-3 min-w-[760px]">
            <div className="flex items-center gap-2">
              <select
                value={exportAction}
                onChange={(e) => setExportAction(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[150px]"
              >
                <option value="csv">Export CSV</option>
                <option value="xlsx">Export Excel</option>
              </select>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {exporting ? "Running..." : "Run"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={resultAction}
                onChange={(e) => setResultAction(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[220px]"
              >
                <option value="show">Show Result (Selected)</option>
                <option value="hide">Hide Result (Selected)</option>
              </select>
              <button
                onClick={handleBulkResultVisibility}
                disabled={visibilitySaving || loading || selectedRowKeys.length === 0}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {visibilitySaving ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto max-h-[70vh]">
        <table className="min-w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 w-12">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedRowKeys((prev) => Array.from(new Set([...prev, ...resultRowKeys])));
                    else setSelectedRowKeys((prev) => prev.filter((key) => !resultRowKeys.includes(key)));
                  }}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Student</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Exam</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Score</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Total</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">%</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 w-[120px]">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 w-[140px]">Visibility</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 w-[130px]">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Submitted At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-sm text-gray-500" colSpan={10}>Loading results...</td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-sm text-gray-500 text-center" colSpan={10}>No results match current filters</td>
              </tr>
            ) : (
              results.map((row, index) => {
                const rowKey = `${row.exam_id}::${row.student_id}`;
                return (
                  <tr key={row.id} className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50/40"} border-t border-gray-200 hover:bg-blue-50/30`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRowKeys.includes(rowKey)}
                        onChange={(e) => {
                          setSelectedRowKeys((prev) => (e.target.checked ? [...prev, rowKey] : prev.filter((k) => k !== rowKey)));
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <div className="font-medium">{row.student_name || "-"}</div>
                      <div className="text-xs text-gray-500">{row.student_email || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.exam_title || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{row.score ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{row.total_marks ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{row.percentage ?? 0}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${String(row.result_status || "").toUpperCase() === "PASSED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {row.result_status || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${row.show_result === false ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {row.show_result === false ? "Hidden" : "Visible"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleSingleResultVisibility(row, row.show_result === false)}
                        disabled={rowSavingKey === rowKey}
                        className={`px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 ${
                          row.show_result === false
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        {rowSavingKey === rowKey ? "Updating..." : row.show_result === false ? "Show" : "Hide"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
