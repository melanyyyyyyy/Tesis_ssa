import React, { useEffect, useState } from 'react';
import { 
    Alert,
    Box, 
    Card, 
    CardContent, 
    Typography, 
    Grid,
    useTheme,
    alpha,
    Container,
    Avatar
} from '@mui/material';
import { 
    CalendarMonth as CalendarIcon,
    ArrowForward as ArrowIcon
} from '@mui/icons-material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';

const SecretaryDashboard: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [hasFacultyAssigned, setHasFacultyAssigned] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);

    useEffect(() => {
        const API_BASE = import.meta.env.VITE_API_BASE;
        const fetchSecretaryProfile = async () => {
            if (!token) {
                setLoadingProfile(false);
                return;
            }
            try {
                const response = await fetch(`${API_BASE}/secretary/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setHasFacultyAssigned(Boolean(data?.facultyId?._id));
                } else {
                    setHasFacultyAssigned(false);
                }
            } catch {
                setHasFacultyAssigned(false);
            } finally {
                setLoadingProfile(false);
            }
        };

        void fetchSecretaryProfile();
    }, [token]);

    const menuItems = [
        {
            title: 'Reportes del SIGENU',
            description: 'Visualizar los datos de la facultad y exportar tablas en formato PDF.',
            icon: <PictureAsPdfIcon />,
            path: '/secretary/sigenu-tables',  
            color: theme.palette.secondary.main
        },
        {
            title: 'Calendario de Exámenes',
            description: 'Planificar y organizar las fechas y horarios de exámenes.',
            icon: <CalendarIcon />,
            path: '/secretary/exams',
            color: theme.palette.primary.main
        }
    ];

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader 
                    title="Panel de Secretario"
                    subtitle={`Bienvenido, ${user?.firstName || 'Usuario'}. Seleccione una opción para comenzar.`}
                />
                {!loadingProfile && !hasFacultyAssigned && (
                    <Alert severity="info" sx={{ mb: 3 }}>
                        No tienes una facultad asignada en este momento. Contacta al administrador para habilitar tus opciones.
                    </Alert>
                )}

                <Grid container spacing={3}>
                    {menuItems.map((item, index) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                            <Card 
                                elevation={0}
                                onClick={() => {
                                    if (!hasFacultyAssigned) return;
                                    navigate(item.path);
                                }}
                                sx={{ 
                                    borderRadius: 2, 
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    height: '100%',
                                    cursor: hasFacultyAssigned ? 'pointer' : 'not-allowed',
                                    opacity: hasFacultyAssigned ? 1 : 0.6,
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': { 
                                        transform: hasFacultyAssigned ? 'translateY(-2px)' : 'none',
                                        boxShadow: hasFacultyAssigned ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                                        borderColor: hasFacultyAssigned ? alpha(item.color, 0.5) : 'divider'
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

export default SecretaryDashboard;
