import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CircularProgress from '@mui/material/CircularProgress';
import LoginPage from '../pages/auth/LoginPage';
import SecretaryDashboard from '../pages/secretary/SecretaryDashboard';
import SigenuImportPage from '../pages/secretary/SigenuImportPage';
import SigenuSyncPage from '../pages/secretary/SigenuSyncPage';
import SigenuTablesPage from '../pages/secretary/SigenuTablesPage';
import SigenuTableDetailPage from '../pages/secretary/SigenuTableDetailPage';
import SigenuPendingPage from '../pages/secretary/SigenuPendingPage';
import EvaluationsToExportPage from '../pages/secretary/EvaluationsToExportPage';
import LastExportPage from '../pages/secretary/LastExportPage';
import ExamCalendarPage from '../pages/secretary/ExamCalendarPage';
import ProfessorExamCalendarPage from '../pages/professor/ExamCalendarPage';
import RegisterAttendancePage from '../pages/professor/RegisterAttendancePage';
import RegisterEvaluationPage from '../pages/professor/RegisterEvaluationPage';
import ProfilePage from '../pages/common/ProfilePage';
import NotificationPage from '../pages/common/NotificationPage';
import ProfessorDashboard from '../pages/professor/ProfessorDashboard';
import SubjectDetail from '../pages/professor/SubjectDetail';
import StudentDetail from '../pages/professor/StudentDetail';

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

        {/* Secretary Routes */}
        <Route element={<ProtectedRoute allowedRoles={['secretary']} />}>
          <Route path="/" element={<Navigate to="/secretary/dashboard" replace />} />
          <Route path="/secretary/dashboard" element={<SecretaryDashboard />} />
          <Route path="/secretary/sigenu-tables" element={<SigenuTablesPage />} />
          <Route path="/secretary/sigenu/:tableType" element={<SigenuTableDetailPage />} />
          <Route path="/secretary/sigenu-import" element={<SigenuImportPage />} />
          <Route path="/secretary/sigenu-sync" element={<SigenuSyncPage />} />
          <Route path="/secretary/sigenu-pending" element={<SigenuPendingPage />} />
          <Route path="/secretary/sigenu-pending/export" element={<EvaluationsToExportPage />} />
          <Route path="/secretary/sigenu-pending/last-export" element={<LastExportPage />} />
          <Route path="/secretary/exams" element={<ExamCalendarPage />} />
        </Route>

        {/* Professor Routes */}
        <Route element={<ProtectedRoute allowedRoles={['professor']} />}>
          <Route path="/" element={<Navigate to="/professor/dashboard" replace />} />
          <Route path="/professor/dashboard" element={<ProfessorDashboard />} />
          <Route path="/professor/subject-detail" element={<SubjectDetail />} />
          <Route path="/professor/student-detail" element={<StudentDetail />} />
          <Route path="/professor/register-attendance" element={<RegisterAttendancePage />} />
          <Route path="/professor/register-evaluation" element={<RegisterEvaluationPage />} />
          <Route path="/professor/exams" element={<ProfessorExamCalendarPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
