import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    Container,
    Divider,
    Typography
} from '@mui/material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';
import ReusableTable, { type ReusableTableAction, type ReusableTableColumn } from '../../components/common/ReusableTable';

interface SubjectReference {
    _id: string;
    name: string;
    academicYear: number;
}

interface StudentSubjectSummary {
    _id: string;
    studentId: string;
    studentName: string;
    attendanceAverage: number;
    evaluationAverage: number;
}

interface StudentDetailState {
    subject: SubjectReference;
    studentSummary: StudentSubjectSummary;
}

interface EvaluationTypeRef {
    _id: string;
    name: string;
}

interface EvaluationValueRef {
    _id: string;
    value: string;
}

interface EvaluationRecord {
    _id: string;
    category: string;
    examinationTypeId?: EvaluationTypeRef | null;
    evaluationDate: string;
    description?: string;
    evaluationValueId?: EvaluationValueRef | null;
}

interface AttendanceRecord {
    _id: string;
    attendanceDate: string;
    isPresent?: boolean;
    justified?: boolean;
    justificationReason?: string;
}

const DETAIL_STORAGE_KEY = 'professorSelectedStudentDetail';

const StudentDetail: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { token, logout } = useAuth();
    const [refreshKey, setRefreshKey] = useState(0);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    const detail = useMemo(() => {
        const state = location.state as StudentDetailState | null;
        if (state?.subject && state.studentSummary) {
            localStorage.setItem(DETAIL_STORAGE_KEY, JSON.stringify(state));
            return state;
        }

        const saved = localStorage.getItem(DETAIL_STORAGE_KEY);
        if (!saved) return null;
        try {
            return JSON.parse(saved) as StudentDetailState;
        } catch {
            return null;
        }
    }, [location.state]);

    const evaluationColumns = useMemo<ReusableTableColumn<EvaluationRecord>[]>(() => [
        {
            field: 'category',
            headerName: 'Tipo de evaluación',
            renderCell: (value) => {
                const category = String(value || '');
                if (category === 'SYSTEMATIC_EVALUATION') return 'Sistemática';
                if (category === 'PARTIAL_EVALUATION') return 'Parcial';
                if (category === 'FINAL_EVALUATION') return 'Final';
                return category || '-';
            }
        },
        {
            field: 'examinationTypeId',
            headerName: 'Tipo de examen',
            renderCell: (value) => {
                const examType = value as EvaluationTypeRef | null | undefined;
                return examType?.name || '-';
            }
        },
        {
            field: 'evaluationDate',
            headerName: 'Fecha de evaluación',
            renderCell: (value) => new Date(String(value)).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        },
        {
            field: 'description',
            headerName: 'Descripción',
            renderCell: (value) => String(value || '-')
        },
        {
            field: 'evaluationValueId',
            headerName: 'Evaluación',
            renderCell: (value) => {
                const evaluationValue = value as EvaluationValueRef | null | undefined;
                const label = String(evaluationValue?.value || '').trim().toUpperCase();
                if (!label) return '-';
                if (label === 'NP') return 'No presentado';
                if (label === 'CO') return 'Convalidado';
                return evaluationValue?.value || '-';
            }
        }
    ], []);

    const attendanceColumns = useMemo<ReusableTableColumn<AttendanceRecord>[]>(() => [
        {
            field: 'attendanceDate',
            headerName: 'Fecha de asistencia',
            renderCell: (value) => new Date(String(value)).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        },
        {
            field: 'isPresent',
            headerName: 'Asistió',
            renderCell: (value) => {
                if (typeof value !== 'boolean') return '-';
                return value ? 'Sí' : 'No';
            }
        },
        {
            field: 'justified',
            headerName: 'Justificado',
            renderCell: (value) => {
                if (typeof value !== 'boolean') return '-';
                return value ? 'Sí' : 'No';
            }
        },
        {
            field: 'justificationReason',
            headerName: 'Descripción',
            renderCell: (value) => String(value || '-')
        }
    ], []);

    const evaluationActions = useMemo<ReusableTableAction<EvaluationRecord>[]>(() => [
        {
            variant: 'edit',
            label: 'Editar',
            onClick: () => setInfoMessage('La edición de evaluaciones se implementará más adelante.')
        }
    ], []);

    const attendanceActions = useMemo<ReusableTableAction<AttendanceRecord>[]>(() => [
        {
            variant: 'edit',
            label: 'Editar',
            onClick: () => setInfoMessage('La edición de asistencias se implementará más adelante.')
        }
    ], []);

    if (!detail) {
        return (
            <MainLayout>
                <Container maxWidth="xl" sx={{ py: 4 }}>
                    <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                        Debes seleccionar primero un estudiante desde el detalle de la asignatura.
                    </Alert>
                    <Button variant="contained" onClick={() => navigate('/professor/dashboard')}>
                        Volver al panel
                    </Button>
                </Container>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title={`Detalles de ${detail.studentSummary.studentName} en la asignatura ${detail.subject.name}`}
                    subtitle={`Promedio de asistencia: ${detail.studentSummary.attendanceAverage.toFixed(2)}% | Promedio de evaluación: ${detail.studentSummary.evaluationAverage.toFixed(2)}`}
                    showBackButton={true}
                    backTo="/professor/subject-detail"
                    action={(
                        <Button
                            variant="outlined"
                            onClick={() => setRefreshKey((prev) => prev + 1)}
                        >
                            Actualizar
                        </Button>
                    )}
                />

                {infoMessage && (
                    <Alert severity="info" onClose={() => setInfoMessage(null)} sx={{ mb: 3, borderRadius: 2 }}>
                        {infoMessage}
                    </Alert>
                )}

                <Card elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Registros de Evaluaciones</Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <ReusableTable<EvaluationRecord>
                        endpoint="/professor/student-evaluation-records"
                        token={token}
                        columns={evaluationColumns}
                        actions={evaluationActions}
                        rowKey="_id"
                        serverPagination={true}
                        refreshKey={refreshKey}
                        queryParams={{
                            subjectId: detail.subject._id,
                            studentId: detail.studentSummary.studentId
                        }}
                        tableAriaLabel="registros de evaluaciones del estudiante"
                        emptyMessage="No hay registros de evaluación para este estudiante."
                        onUnauthorized={logout}
                        extractRows={(response) => {
                            if (!response || typeof response !== 'object') return [];
                            const parsed = response as Record<string, unknown>;
                            if (Array.isArray(parsed.data)) return parsed.data as EvaluationRecord[];
                            if (Array.isArray(parsed.items)) return parsed.items as EvaluationRecord[];
                            return [];
                        }}
                        extractTotalCount={(response, rows) => {
                            if (!response || typeof response !== 'object') return rows.length;
                            const parsed = response as Record<string, unknown>;
                            return typeof parsed.totalCount === 'number' ? parsed.totalCount : rows.length;
                        }}
                    />
                </Card>

                <Card elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Registros de Asistencias</Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <ReusableTable<AttendanceRecord>
                        endpoint="/professor/student-attendance-records"
                        token={token}
                        columns={attendanceColumns}
                        actions={attendanceActions}
                        rowKey="_id"
                        serverPagination={true}
                        refreshKey={refreshKey}
                        queryParams={{
                            subjectId: detail.subject._id,
                            studentId: detail.studentSummary.studentId
                        }}
                        tableAriaLabel="registros de asistencias del estudiante"
                        emptyMessage="No hay registros de asistencia para este estudiante."
                        onUnauthorized={logout}
                        extractRows={(response) => {
                            if (!response || typeof response !== 'object') return [];
                            const parsed = response as Record<string, unknown>;
                            if (Array.isArray(parsed.data)) return parsed.data as AttendanceRecord[];
                            if (Array.isArray(parsed.items)) return parsed.items as AttendanceRecord[];
                            return [];
                        }}
                        extractTotalCount={(response, rows) => {
                            if (!response || typeof response !== 'object') return rows.length;
                            const parsed = response as Record<string, unknown>;
                            return typeof parsed.totalCount === 'number' ? parsed.totalCount : rows.length;
                        }}
                    />
                </Card>
            </Container>
        </MainLayout>
    );
};

export default StudentDetail;
