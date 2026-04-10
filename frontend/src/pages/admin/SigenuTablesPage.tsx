import React, { useEffect, useState } from 'react';
import { 
    Box, 
    Card, 
    CardContent, 
    Typography, 
    Grid, 
    Alert,
    CircularProgress,
    useTheme,
    alpha,
    Avatar,
    Container,
    Paper
} from '@mui/material';
import { 
    Storage as StorageIcon, 
    CloudUpload as CloudUploadIcon,
    School as SchoolIcon,
    People as PeopleIcon,
    LibraryBooks as LibraryBooksIcon,
    Assignment as AssignmentIcon,
    AccountBalance as AccountBalanceIcon,
    Class as ClassIcon,
    Quiz as QuizIcon,
    Grade as GradeIcon,
    FactCheck as FactCheckIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

interface DashboardStats {
    careers: number;
    courseTypes: number;
    evaluations: number;
    evaluationValues: number;
    examinationTypes: number;
    faculties: number;
    matriculatedSubjects: number;
    students: number;
    studentStatuses: number;
    subjects: number;
    pendingScores: number;
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
                const response = await fetch(`${API_BASE}/admin/sigenu-stats`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    logout();
                    return;
                }

                if (!response.ok) {
                    throw new Error('Error al obtener estadísticas');
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
            fetchStats();
        }
    }, [logout, token]);

    const tableItems = stats ? [
        { name: 'Estudiantes', count: stats.students, key: 'students', icon: <PeopleIcon />, color: theme.palette.primary.main },
        { name: 'Carreras', count: stats.careers, key: 'careers', icon: <SchoolIcon />, color: theme.palette.info.main },
        { name: 'Asignaturas', count: stats.subjects, key: 'subjects', icon: <LibraryBooksIcon />, color: theme.palette.warning.main },
        { name: 'Evaluaciones', count: stats.evaluations, key: 'evaluations', icon: <AssignmentIcon />, color: theme.palette.secondary.main },
        { name: 'Facultades', count: stats.faculties, key: 'faculties', icon: <AccountBalanceIcon />, color: theme.palette.success.main },
        { name: 'Tipos de Curso', count: stats.courseTypes, key: 'courseTypes', icon: <ClassIcon />, color: '#673ab7' },
        { name: 'Tipos de Examen', count: stats.examinationTypes, key: 'examinationTypes', icon: <QuizIcon />, color: '#009688' },
        { name: 'Valores Evaluación', count: stats.evaluationValues, key: 'evaluationValues', icon: <GradeIcon />, color: '#ff5722' },
        { name: 'Estados Estudiante', count: stats.studentStatuses, key: 'studentStatuses', icon: <FactCheckIcon />, color: '#795548' },
        { name: 'Asig. Matriculadas', count: stats.matriculatedSubjects, key: 'matriculatedSubjects', icon: <StorageIcon />, color: '#607d8b' },
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
                    subtitle="Centro de gestión de datos locales y sincronización."
                    showBackButton={true}
                />

                {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.875rem' }}>
                    Acciones de Sistema
                </Typography>
                
                <Box sx={{ mb: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={() => navigate('/admin/sigenu-import')}
                        sx={{
                            p: 3,
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            cursor: 'pointer',
                            maxWidth: 500,
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: alpha(theme.palette.primary.main, 0.02),
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                            }
                        }}
                    >
                        <Avatar 
                            variant="rounded"
                            sx={{ 
                                bgcolor: alpha(theme.palette.primary.main, 0.1), 
                                color: 'primary.main',
                                width: 56, 
                                height: 56, 
                                mr: 3,
                                borderRadius: 2
                            }}
                        >
                            <CloudUploadIcon />
                        </Avatar>
                        <Box>
                            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>Importar desde SIGENU</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                                Actualiza la base de datos local cargando un archivo .backup
                            </Typography>
                        </Box>
                    </Paper>
                </Box>

                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.875rem' }}>
                    Resumen de Registros
                </Typography>
                
                <Grid container spacing={3}>
                    {tableItems.map((item) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.key}>
                            <Card 
                                elevation={0}
                                onClick={() => navigate(`/admin/sigenu/${item.key}`)}
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
                                            Registros activos
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
