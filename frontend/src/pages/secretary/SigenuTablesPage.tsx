import React, { useEffect, useState } from 'react';
import {
    Alert,
    Avatar,
    Box,
    Card,
    CardContent,
    CircularProgress,
    Container,
    Grid,
    Typography,
    alpha,
    useTheme
} from '@mui/material';
import {
    Assignment as AssignmentIcon,
    Class as ClassIcon,
    FactCheck as FactCheckIcon,
    Grade as GradeIcon,
    LibraryBooks as LibraryBooksIcon,
    People as PeopleIcon,
    Quiz as QuizIcon,
    School as SchoolIcon,
    Storage as StorageIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

interface DashboardStats {
    facultyName: string;
    careers: number;
    courseTypes: number;
    evaluations: number;
    evaluationValues: number;
    examinationTypes: number;
    matriculatedSubjects: number;
    students: number;
    studentStatuses: number;
    subjects: number;
}

const SigenuTablesPage: React.FC = () => {
    const navigate = useNavigate();
    const theme = useTheme();
    const { token, logout } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch(`${API_BASE}/secretary/sigenu-stats`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    logout();
                    return;
                }

                if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    throw new Error(data?.message || 'Error al obtener estadísticas');
                }

                const data = await response.json();
                setStats(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error desconocido');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            void fetchStats();
        }
    }, [logout, token]);

    const tableItems = stats ? [
        { name: 'Estudiantes', count: stats.students, key: 'students', icon: <PeopleIcon />, color: theme.palette.primary.main },
        { name: 'Carreras', count: stats.careers, key: 'careers', icon: <SchoolIcon />, color: theme.palette.info.main },
        { name: 'Asignaturas', count: stats.subjects, key: 'subjects', icon: <LibraryBooksIcon />, color: theme.palette.warning.main },
        { name: 'Evaluaciones', count: stats.evaluations, key: 'evaluations', icon: <AssignmentIcon />, color: theme.palette.secondary.main },
        { name: 'Tipos de Curso', count: stats.courseTypes, key: 'courseTypes', icon: <ClassIcon />, color: '#673ab7' },
        { name: 'Tipos de Examen', count: stats.examinationTypes, key: 'examinationTypes', icon: <QuizIcon />, color: '#009688' },
        { name: 'Valores Evaluación', count: stats.evaluationValues, key: 'evaluationValues', icon: <GradeIcon />, color: '#ff5722' },
        { name: 'Estados Estudiante', count: stats.studentStatuses, key: 'studentStatuses', icon: <FactCheckIcon />, color: '#795548' },
        { name: 'Asig. Matriculadas', count: stats.matriculatedSubjects, key: 'matriculatedSubjects', icon: <StorageIcon />, color: '#607d8b' }
    ] : [];

    if (loading) {
        return (
            <MainLayout>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                    <CircularProgress size={60} thickness={4} />
                </Box>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Tablas del SIGENU"
                    subtitle={`Resumen de registros asociados a la ${stats?.facultyName || ''}`}
                    showBackButton={true}
                />

                {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.875rem' }}>
                    Resumen de Registros
                </Typography>

                <Grid container spacing={3}>
                    {tableItems.map((item) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.key}>
                            <Card
                                elevation={0}
                                onClick={() => navigate(`/secretary/sigenu/${item.key}`)}
                                sx={{
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    height: '100%',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                        borderColor: alpha(item.color, 0.5)
                                    }
                                }}
                            >
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Avatar
                                            variant="rounded"
                                            sx={{
                                                bgcolor: alpha(item.color, 0.08),
                                                color: item.color,
                                                borderRadius: 1.5,
                                                width: 44,
                                                height: 44
                                            }}
                                        >
                                            {item.icon}
                                        </Avatar>
                                        <Typography variant="h4" fontWeight="800" sx={{ color: 'text.primary', ml: 2 }}>
                                            {item.count}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ mb: 0.5 }}>
                                            {item.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            Registros visibles
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </MainLayout>
    );
};

export default SigenuTablesPage;
