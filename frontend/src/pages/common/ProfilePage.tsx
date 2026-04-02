import React, { useEffect, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Avatar,
    Divider,
    Chip,
    CircularProgress,
    Alert,
    Container,
    useTheme
} from '@mui/material';
import { Person as PersonIcon, Email as EmailIcon, Badge as BadgeIcon, CheckCircle as CheckCircleIcon, Cancel as CancelIcon } from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import MainLayout from '../../layouts/MainLayout';

const API_BASE = import.meta.env.VITE_API_BASE;

interface UserProfile {
    id: string;
    email: string;
    identification: string;
    firstName: string;
    lastName: string;
    role: {
        _id: string;
        name: string;
    };
    isActive: boolean;
    student?: {
        career: {
            _id: string;
            name: string;
        };
        courseType: {
            _id: string;
            name: string;
        };
        academicYear: number;
        studentStatus: {
            _id: string;
            kind: string;
        };
    };
    createdAt?: string | Date;
}

const getRoleName = (role: string) => {
    const roles: { [key: string]: string } = {
        'admin': 'Administrador',
        'secretary': 'Secretario',
        'vicedean': 'Vicedecano',
        'student': 'Estudiante',
        'professor': 'Profesor'
    };
    return roles[role];
};

const ProfilePage: React.FC = () => {
    const theme = useTheme();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            console.log('Token retrieved:', token ? 'Token exists' : 'No token found');
            console.log('API URL:', `${API_BASE}/common/profile`);

            const response = await fetch(`${API_BASE}/common/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                console.log('Error response:', errorText);
                throw new Error(`Error loading profile: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Profile data received:', data);
            setProfile(data);
        } catch (err) {
            console.error('Profile fetch error:', err);
            setError(err instanceof Error ? err.message : 'Uknowed error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    if (!profile) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning">No se encontró información del perfil</Alert>
            </Box>
        );
    }

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Mi Perfil"
                    showBackButton={true}
                />

                <Card elevation={0} sx={{
                    p: 4,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: theme.palette.background.paper,
                    textAlign: 'center'
                }}>
                    <CardContent sx={{ p: 4 }}>
                        <Box sx={{ textAlign: 'center', mb: 4 }}>
                            <Avatar
                                sx={{
                                    width: 120,
                                    height: 120,
                                    mx: 'auto',
                                    mb: 2,
                                    bgcolor: 'primary.main',
                                    fontSize: 60
                                }}
                            >
                                <PersonIcon sx={{ fontSize: 60 }} />
                            </Avatar>
                            <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
                                {profile.firstName} {profile.lastName}
                            </Typography>
                            <Chip
                                label={getRoleName(profile.role?.name) || 'Sin rol asignado'}
                                color="primary"
                                variant="outlined"
                                sx={{ fontSize: '1rem', px: 2, py: 0.5 }}
                            />
                        </Box>

                        <Divider sx={{ my: 3 }} />

                            <Box 
                            sx={{ 
                                display: 'grid', 
                                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, 
                                gap: 3,
                                placeItems: 'center', 
                            }}
                            >
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <EmailIcon sx={{ mr: 2, color: 'text.secondary' }} />
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            Correo Electrónico
                                        </Typography>
                                        <Typography variant="body1">{`${profile.email}@uho.edu.cu`}</Typography>
                                    </Box>
                                </Box>
                            </Box>

                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <BadgeIcon sx={{ mr: 2, color: 'text.secondary' }} />
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            Identificación
                                        </Typography>
                                        <Typography variant="body1">{profile.identification}</Typography>
                                    </Box>
                                </Box>
                            </Box>

                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    {profile.isActive ? (
                                        <CheckCircleIcon sx={{ mr: 2, color: 'success.main' }} />
                                    ) : (
                                        <CancelIcon sx={{ mr: 2, color: 'error.main' }} />
                                    )}
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            Estado
                                        </Typography>
                                        <Typography variant="body1">
                                            {profile.isActive ? 'Usuario activo' : 'Usuario inactivo'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>

                        {profile.student && (
                            <>
                                <Divider sx={{ my: 3 }} />
                                <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                                    Información Académica
                                </Typography>

                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
                                    <Box>
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Año Académico
                                            </Typography>
                                            <Typography variant="body1">{profile.student.academicYear}º año</Typography>
                                        </Box>
                                    </Box>

                                    <Box>
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Carrera
                                            </Typography>
                                            <Typography variant="body1">
                                                {profile.student.career?.name || 'Sin carrera asignada'}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box>
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Tipo de Curso
                                            </Typography>
                                            <Typography variant="body1">
                                                {profile.student.courseType?.name || 'Sin tipo asignado'}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Estado del Estudiante
                                            </Typography>
                                            <Chip
                                                label={profile.student.studentStatus?.kind || 'Sin estado'}
                                                color="info"
                                                variant="outlined"
                                            />
                                        </Box>
                                    </Box>
                                </Box>
                            </>
                        )}

                        <Divider sx={{ my: 3 }} />

                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                                Miembro desde: {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                }) : 'Fecha no disponible'}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            </Container>
        </MainLayout>
    );
};

export default ProfilePage;