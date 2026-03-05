import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  Briefcase,
  BookOpen,
  Users,
  LogOut,
  Bell,
  Calendar,
  ChevronDown,
  Trash2,
  Building2,
  Users2,
  BarChart3
} from 'lucide-react';

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [examMenuOpen, setExamMenuOpen] = useState(true);
  const userType = Number(localStorage.getItem("user_type"));

  useEffect(() => {
    if (userType !== 1 && userType !== 2) {
      navigate("/login");
    }
  }, [userType, navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const path = location.pathname;
  const isExamRoute = path.startsWith('/admin/exam-management');

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 hidden md:block`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h1 className={`text-xl font-bold text-gray-800 ${!sidebarOpen && 'hidden'}`}>CCS</h1>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <nav className="space-y-2">

            <button
              onClick={() => setExamMenuOpen((v) => !v)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isExamRoute ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-200' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-3">
                <FileText className="w-5 h-5" />
                {sidebarOpen && <span className="font-medium">Exams</span>}
              </span>
              {sidebarOpen && (
                <ChevronDown className={`w-4 h-4 transition-transform ${examMenuOpen ? 'rotate-180' : ''}`} />
              )}
            
            </button>

            {sidebarOpen && examMenuOpen && (
              <div className="ml-3 border-l border-gray-200 pl-3 space-y-1">
        
                <button
                  onClick={() => navigate('/admin/exam-management/exam')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                    path === '/admin/exam-management/exam' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>Exams</span>
                </button>
                <button
                  onClick={() => navigate('/admin/exam-management/questions')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                    path === '/admin/exam-management/questions' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>Questions</span>
                </button>
                <button
                  onClick={() => navigate('/admin/exam-management/question-types')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                    path === '/admin/exam-management/question-types' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>Question Types</span>
                </button>
                <button
                  onClick={() => navigate('/admin/exam-management/attempts')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                    path === '/admin/exam-management/attempts' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>Attempts</span>
                </button>
                <button
                  onClick={() => navigate('/admin/exam-management/recycle-bin')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                    path === '/admin/exam-management/recycle-bin' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>Recycle Bin</span>
                </button>
              </div>
            )}

            <button
              onClick={() => navigate('/admin/exam-management/institutes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                path === '/admin/exam-management/institutes' ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-200' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Institutes</span>}
            </button>

            <button
              onClick={() => navigate('/admin/exam-management/groups')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                path === '/admin/exam-management/groups' ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-200' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users2 className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Groups</span>}
            </button>

            <button
              onClick={() => navigate('/admin/exam-management/students')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                path === '/admin/exam-management/students' ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-200' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Students</span>}
            </button>

            <button
              onClick={() => navigate('/admin/exam-management/assignments')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                path === '/admin/exam-management/assignments' ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-200' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Briefcase className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Assignments</span>}
            </button>

            <button
              onClick={() => navigate('/admin/exam-management/results')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                path === '/admin/exam-management/results' ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-200' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Results</span>}
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all duration-200 mt-4"
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Logout</span>}
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <span className="text-lg font-semibold text-gray-800">Admin Panel</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700 font-medium">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </div>

    </div>
  );
};

export default AdminLayout;
