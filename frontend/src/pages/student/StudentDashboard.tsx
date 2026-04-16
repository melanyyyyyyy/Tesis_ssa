import React from 'react';
import {
    Avatar,
    Box,
    Card,
    CardContent,
    Container,
    Grid,
    Typography,
    alpha,
    useTheme
} from '@mui/material';
import {
    ArrowForward as ArrowIcon,
    EmojiEvents as EmojiEventsIcon,
    Event as EventIcon,
    Forum as ForumIcon,
    FactCheck as FactCheckIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';

interface StudentMenuItem {
    title: string;
    description: string;
    icon: React.ReactNode;
    path: string;
    color: string;
}

const StudentDashboard: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { user } = useAuth();

    const menuItems: StudentMenuItem[] = [
        {
            title: 'Registros de evaluaciones y asistencias',
            description: 'Consulta tus evaluaciones y asistencias de las asignaturas que tienes matriculadas.',
            icon: <FactCheckIcon />,
            path: '/student/records',
            color: theme.palette.secondary.main,
        },
        {
            title: 'Escalafón académico',
            description: 'Consulta tu índice y descubre tu posición en el ranking del grupo de acuerdo a tu rendimiento.',
            icon: <EmojiEventsIcon />,
            path: '/student/academic-ranking',
            color: theme.palette.warning.main,
        },
        {
            title: 'Calendario de exámenes',
            description: 'Visualiza las fechas programadas para tus exámenes finales en cada convocatoria.',
            icon: <EventIcon />,
            path: '/student/exams',
            color: theme.palette.error.main,
        },
        {
            title: 'Chat',
            description: 'Comunícate de forma directa con tus profesores y participa en los canales de tus asignaturas.',
            icon: <ForumIcon />,
            path: '/student/chat',
            color: theme.palette.primary.main,
        }
    ];

    const handleCardClick = (item: StudentMenuItem) => {
        navigate(item.path);
    };

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Panel del Estudiante"
                    subtitle={`Bienvenido, ${user?.firstName || 'Usuario'}. Seleccione una opción para continuar.`}
                />

                <Grid container spacing={3}>
                    {menuItems.map((item) => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.title}>
                            <Card
                                elevation={0}
                                onClick={() => handleCardClick(item)}
                                sx={{
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    height: '100%',
                                    cursor: 'pointer',
                                    opacity: 1,
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                        borderColor: alpha(item.color, 0.5)
                                    } 
                                }}
                            >
                                <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Avatar
                                            variant="rounded"
                                            sx={{
                                                bgcolor: alpha(item.color, 0.1),
                                                color: item.color,
                                                borderRadius: 1.5,
                                                width: 48,
                                                height: 48
                                            }}
                                        >
                                            {item.icon}
                                        </Avatar>
                                            <ArrowIcon sx={{ color: 'text.disabled' }} />
                                    </Box>

                                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                                        {item.title}
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
                                        {item.description}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </MainLayout>
    );
};

export default StudentDashboard;
