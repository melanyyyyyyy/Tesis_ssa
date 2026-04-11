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
    Avatar,
    Skeleton
} from '@mui/material';
import {
    AssignmentInd as AssignmentIndIcon,
    ArrowForward as ArrowIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';

const API_BASE = import.meta.env.VITE_API_BASE;

interface Faculty {
    _id: string;
    name: string;
}

interface VicedeanProfile {
    _id: string;
    userId: string;
    facultyId: Faculty;
}

const VicedeanDashboard: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [profile, setProfile] = useState<VicedeanProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch(`${API_BASE}/vicedean/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setProfile(data);
                }
            } catch (error) {
                console.error('Error fetching vicedean profile:', error);
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchProfile();
        }
    }, [token]);

    const hasFacultyAssigned = Boolean(profile?.facultyId?._id);

    const menuItems = [
        {
            title: 'Asignación Docente',
            description: 'Asignar y gestionar el profesorado de las asignaturas por carrera.',
            icon: <AssignmentIndIcon />,
            path: '/vicedean/teaching-assignments',
            color: theme.palette.secondary.main
        }
    ]

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Panel de Vicedecano"
                    subtitle={loading ? 
                        <Skeleton width={300} height={24} /> : 
                        `Bienvenido, ${user?.firstName || 'Usuario'}. Seleccione una opción para comenzar.`
                    }
                />
                {!loading && !hasFacultyAssigned && (
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
                                    navigate(item.path, { state: { faculty: profile?.facultyId } });
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
    )
}

export default VicedeanDashboard;
