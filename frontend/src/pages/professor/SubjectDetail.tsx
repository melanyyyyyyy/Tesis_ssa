import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    Container,
    Divider,
    IconButton,
    Stack,
    Tooltip,
    Typography,
    useTheme
} from '@mui/material';
import {
    Chat as ChatIcon,
    EmojiEvents as RankingIcon,
    Event as CalendarIcon,
    FactCheck as EvaluationIcon,
    History as HistoryIcon,
    HowToReg as AttendanceIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';
import ReusableTable, { type ReusableTableAction, type ReusableTableColumn } from '../../components/common/ReusableTable';

interface SubjectReference {
    _id: string;
    name: string;
    academicYear: number;
    careerId?: {
        _id: string;
        name: string;
    } | string;
}

interface StudentSubjectSummary {
    _id: string;
    studentId: string;
    studentName: string;
    attendanceAverage: number;
    evaluationAverage: number;
    academicYear: number;
}

const SUBJECT_STORAGE_KEY = 'professorSelectedSubject';

const SubjectDetail: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const { token, logout } = useAuth();
    const [refreshKey, setRefreshKey] = useState(0);
    const selectedSubject = useMemo(() => {
        const state = location.state as { subject?: SubjectReference } | null;
        if (state?.subject) {
            localStorage.setItem(SUBJECT_STORAGE_KEY, JSON.stringify(state.subject));
            return state.subject;
        }

        const saved = localStorage.getItem(SUBJECT_STORAGE_KEY);
        if (!saved) return null;
        try {
            return JSON.parse(saved) as SubjectReference;
        } catch {
            return null;
        }
    }, [location.state]);

    const columns = useMemo<ReusableTableColumn<StudentSubjectSummary>[]>(() => [
        { field: 'studentName', headerName: 'Nombre del estudiante' },
        {
            field: 'attendanceAverage',
            headerName: 'Promedio de asistencia',
            renderCell: (value) => `${Number(value || 0).toFixed(2)}%`
        },
        {
            field: 'evaluationAverage',
            headerName: 'Promedio de la evaluación',
            renderCell: (value) => Number(value || 0).toFixed(2)
        }
    ], []);

    const actions = useMemo<ReusableTableAction<StudentSubjectSummary>[]>(() => [
        {
            variant: 'view',
            label: 'Ver más',
            onClick: (row) => {
                if (!selectedSubject) return;
                navigate('/professor/student-detail', {
                    state: {
                        subject: selectedSubject,
                        studentSummary: row
                    }
                });
            }
        }
    ], [navigate, selectedSubject]);

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
    };

    const subjectCareerName = useMemo(() => {
        if (!selectedSubject?.careerId) return 'Sin carrera';
        if (typeof selectedSubject.careerId === 'string') return selectedSubject.careerId;
        return selectedSubject.careerId.name || 'Sin carrera';
    }, [selectedSubject]);

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Detalle de Asignatura"
                    subtitle={selectedSubject
                        ? `${selectedSubject.name} | Año académico: ${selectedSubject.academicYear} | Carrera: ${subjectCareerName}`
                        : 'No hay asignatura seleccionada.'}
                    showBackButton={true}
                    backTo="/professor/dashboard"
                    action={
                        <Tooltip title="Actualizar datos">
                            <IconButton onClick={handleRefresh} color="primary">
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    }
                />

                {!selectedSubject && (
                    <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                        Debes seleccionar una asignatura desde el panel del profesor para ver su detalle.
                    </Alert>
                )}

                <Stack spacing={2}>
                    <Card elevation={0} sx={{
                        p: 4,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: theme.palette.background.paper,
                        textAlign: 'left'
                    }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">Acciones</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    spacing={2} 
                    sx={{ 
                        mb: 3, 
                        flexWrap: 'wrap',
                        gap: 1 
                    }}
                >
                    <Button 
                        variant="contained" 
                        color="secondary"
                        disableElevation
                        startIcon={<AttendanceIcon />}
                        disabled={!selectedSubject}
                        onClick={() => selectedSubject && navigate('/professor/register-attendance', {
                            state: { subject: selectedSubject }
                        })}
                    >
                        Añadir registro de asistencia
                    </Button>

                    <Button 
                        variant="contained" 
                        color="secondary"
                        disableElevation
                        startIcon={<EvaluationIcon />}
                        disabled={!selectedSubject}
                        onClick={() => selectedSubject && navigate('/professor/register-evaluation', {
                            state: { subject: selectedSubject }
                        })}
                    >
                        Añadir registro de evaluación
                    </Button>

                    <Button 
                        variant="contained" 
                        color="primary"
                        disableElevation
                        startIcon={<CalendarIcon />}
                        disabled={!selectedSubject}
                        onClick={() => selectedSubject && navigate('/professor/exams', {
                            state: {
                                subjectId: selectedSubject._id,
                                subjectName: selectedSubject.name,
                                careerId: typeof selectedSubject.careerId === 'string' 
                                    ? selectedSubject.careerId 
                                    : selectedSubject.careerId?._id || '',
                                academicYear: selectedSubject.academicYear
                            }
                        })}
                    >
                        Calendario de exámenes
                    </Button>

                    <Button 
                        variant="contained" 
                        color="primary"
                        disableElevation
                        startIcon={<HistoryIcon />}
                    >
                        Historial de registros
                    </Button>

                    <Button 
                        variant="contained" 
                        color="primary"
                        disableElevation
                        startIcon={<RankingIcon />}
                        disabled={!selectedSubject}
                        onClick={() => selectedSubject && navigate('/professor/academic-ranking', {
                            state: { subject: selectedSubject }
                        })}
                    >
                        Escalafón Académico
                    </Button>

                    <Button 
                        variant="outlined" 
                        color="primary"
                        startIcon={<ChatIcon />}
                        disabled={!selectedSubject}
                        onClick={() => selectedSubject && navigate('/professor/chat', {
                            state: { subject: selectedSubject }
                        })}
                    >
                        Chat
                    </Button>
                </Stack>
                    </Card>
                    <Card elevation={0} sx={{
                        p: 4,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: theme.palette.background.paper,
                        textAlign: 'left'
                    }}>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">Estudiantes matriculados</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />

                        {selectedSubject ? (
                            <ReusableTable<StudentSubjectSummary>
                                endpoint="/professor/subject-students"
                                token={token}
                                columns={columns}
                                actions={actions}
                                rowKey="_id"
                                serverPagination={true}
                                refreshKey={refreshKey}
                                queryParams={{ subjectId: selectedSubject._id }}
                                tableAriaLabel="resumen de estudiantes en asignatura"
                                emptyMessage="No hay estudiantes matriculados en esta asignatura."
                                onUnauthorized={logout}
                                extractRows={(response) => {
                                    if (Array.isArray(response)) {
                                        return response as StudentSubjectSummary[];
                                    }
                                    if (!response || typeof response !== 'object') {
                                        return [];
                                    }
                                    const parsed = response as Record<string, unknown>;
                                    if (Array.isArray(parsed.data)) {
                                        return parsed.data as StudentSubjectSummary[];
                                    }
                                    if (Array.isArray(parsed.items)) {
                                        return parsed.items as StudentSubjectSummary[];
                                    }
                                    return [];
                                }}
                                extractTotalCount={(response, rows) => {
                                    if (!response || typeof response !== 'object') {
                                        return rows.length;
                                    }
                                    const parsed = response as Record<string, unknown>;
                                    return typeof parsed.totalCount === 'number' ? parsed.totalCount : rows.length;
                                }}
                            />
                        ) : (
                            <Box sx={{ py: 3 }}>
                                <Button variant="contained" onClick={() => navigate('/professor/dashboard')}>
                                    Volver al panel
                                </Button>
                            </Box>
                        )}
                    </Card>
                </Stack>
            </Container>
        </MainLayout>
    );
};

export default SubjectDetail;
