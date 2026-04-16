import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CircularProgress from '@mui/material/CircularProgress';
import LoginPage from '../pages/auth/LoginPage';

import SecretaryDashboard from '../pages/secretary/SecretaryDashboard';
import ExamCalendarPage from '../pages/secretary/ExamCalendarPage';
import SecretarySigenuTablesPage from '../pages/secretary/SigenuTablesPage';
import SecretarySigenuTableDetailPage from '../pages/secretary/SigenuTableDetailPage';

import AdminDashboard from '../pages/admin/AdminDashboard';
import SigenuImportPage from '../pages/admin/SigenuImportPage';
import SigenuSyncPage from '../pages/admin/SigenuSyncPage';
import SigenuTablesPage from '../pages/admin/SigenuTablesPage';
import SigenuTableDetailPage from '../pages/admin/SigenuTableDetailPage';
import SigenuPendingPage from '../pages/admin/SigenuPendingPage';
import EvaluationsToExportPage from '../pages/admin/EvaluationsToExportPage';
import LastExportPage from '../pages/admin/LastExportPage';
import FacultyAssignmentPage from '../pages/admin/FacultyAssignmentPage';
import RoleManagementPage from '../pages/admin/RoleManagementPage';
import TestUsersPage from '../pages/admin/TestUsersPage';

import ProfessorExamCalendarPage from '../pages/professor/ExamCalendarPage';
import RegisterAttendancePage from '../pages/professor/RegisterAttendancePage';
import RegisterEvaluationPage from '../pages/professor/RegisterEvaluationPage';
import AcademicRanking from '../pages/professor/AcademicRanking';
import HistoryRecords from '../pages/professor/Records';
import RecordsAttendanceEdit from '../pages/professor/RecordsAttendanceEdit';
import RecordsAttendanceView from '../pages/professor/RecordsAttendanceView';
import RecordsEvaluationEdit from '../pages/professor/RecordsEvaluationEdit';
import RecordsEvaluationView from '../pages/professor/RecordsEvaluationView';
import ProfessorDashboard from '../pages/professor/ProfessorDashboard';
import SubjectDetail from '../pages/professor/SubjectDetail';
import StudentDetail from '../pages/professor/StudentDetail';
import ChatPage from '../pages/professor/Chat';
import StudentDashboard from '../pages/student/StudentDashboard';
import StudentChatPage from '../pages/student/Chat';

import ProfilePage from '../pages/common/ProfilePage';
import NotificationPage from '../pages/common/NotificationPage';

import VicedeanDashboard from '../pages/vicedean/VicedeanDashboard';
import TeachingAssignmentsPage from '../pages/vicedean/TeachingAssignmentsPage';
import ProfessorRequestsPage from '../pages/vicedean/ProfessorRequestsPage';

const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: string[] }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <CircularProgress color="secondary" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const userRole = user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return <Navigate to="/login" replace />;
    }
  }

  return <Outlet />;
};

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Common Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationPage />} />
        </Route>

        {/* Admin Routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/sigenu-tables" element={<SigenuTablesPage />} />
          <Route path="/admin/sigenu/:tableType" element={<SigenuTableDetailPage />} />
          <Route path="/admin/sigenu-import" element={<SigenuImportPage />} />
          <Route path="/admin/sigenu-sync" element={<SigenuSyncPage />} />
          <Route path="/admin/sigenu-pending" element={<SigenuPendingPage />} />
          <Route path="/admin/sigenu-pending/export" element={<EvaluationsToExportPage />} />
          <Route path="/admin/sigenu-pending/last-export" element={<LastExportPage />} />
          <Route path="/admin/faculty-assignment" element={<FacultyAssignmentPage />} />
          <Route path="/admin/role-management" element={<RoleManagementPage />} />
          <Route path="/admin/test-users" element={<TestUsersPage />} />
        </Route>

        {/* Secretary Routes */}
        <Route element={<ProtectedRoute allowedRoles={['secretary']} />}>
          <Route path="/" element={<Navigate to="/secretary/dashboard" replace />} />
          <Route path="/secretary/dashboard" element={<SecretaryDashboard />} />
          <Route path="/secretary/sigenu-tables" element={<SecretarySigenuTablesPage />} />
          <Route path="/secretary/sigenu/:tableType" element={<SecretarySigenuTableDetailPage />} />
          <Route path="/secretary/exams" element={<ExamCalendarPage />} />
        </Route>

        {/* Professor Routes */}
        <Route element={<ProtectedRoute allowedRoles={['professor']} />}>
          <Route path="/" element={<Navigate to="/professor/dashboard" replace />} />
          <Route path="/professor/dashboard" element={<ProfessorDashboard />} />
          <Route path="/professor/subject-detail" element={<SubjectDetail />} />
          <Route path="/professor/student-detail" element={<StudentDetail />} />
          <Route path="/professor/chat" element={<ChatPage />} />
          <Route path="/professor/register-attendance" element={<RegisterAttendancePage />} />
          <Route path="/professor/register-evaluation" element={<RegisterEvaluationPage />} />
          <Route path="/professor/academic-ranking" element={<AcademicRanking />} />
          <Route path="/professor/history-records" element={<HistoryRecords />} />
          <Route path="/professor/records-attendance-edit" element={<RecordsAttendanceEdit />} />
          <Route path="/professor/records-attendance-view" element={<RecordsAttendanceView />} />
          <Route path="/professor/records-evaluation-edit" element={<RecordsEvaluationEdit />} />
          <Route path="/professor/records-evaluation-view" element={<RecordsEvaluationView />} />
          <Route path="/professor/exams" element={<ProfessorExamCalendarPage />} />
        </Route>

        {/* Student Routes */}
        <Route element={<ProtectedRoute allowedRoles={['student']} />}>
          <Route path="/" element={<Navigate to="/student/dashboard" replace />} />
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/chat" element={<StudentChatPage />} />
        </Route>

        {/* Vicedean Routes */}
        <Route element={<ProtectedRoute allowedRoles={['vicedean']} />}>
          <Route path="/vicedean/dashboard" element={<VicedeanDashboard />} />
          <Route path="/vicedean/teaching-assignments" element={<TeachingAssignmentsPage />} />
          <Route path="/vicedean/professor-requests" element={<ProfessorRequestsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
