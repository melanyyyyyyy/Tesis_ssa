import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
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
import { 
    Person as PersonIcon, 
    Email as EmailIcon, 
    Badge as BadgeIcon, 
    CheckCircle as CheckCircleIcon, 
    Cancel as CancelIcon,
    Business as BusinessIcon
} from '@mui/icons-material';
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

interface RoleFacultyResponse {
    facultyId?: {
        _id?: string;
        name?: string;
    } | null;
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
    const { token } = useAuth(); 
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [facultyName, setFacultyName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUserProfile = useCallback(async () => {
        if (!token) {
            setError('No authentication token found.');
            setLoading(false);
            return;
        }

        try {
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

            const roleName = data?.role?.name;
            if (roleName === 'secretary' || roleName === 'vicedean') {
                const endpoint = roleName === 'secretary' ? 'secretary/profile' : 'vicedean/profile';
                const facultyResponse = await fetch(`${API_BASE}/${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (facultyResponse.ok) {
                    const facultyData = await facultyResponse.json() as RoleFacultyResponse;
                    setFacultyName(facultyData?.facultyId?.name || 'Sin facultad asignada');
                } else if (facultyResponse.status === 404) {
                    setFacultyName('Sin facultad asignada');
                } else {
                    setFacultyName('Sin facultad asignada');
                }
            } else {
                setFacultyName(null);
            }
        } catch (err) {
            console.error('Profile fetch error:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

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
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                gap: 2,
                                justifyContent: 'center',
                                alignItems: 'stretch'
                            }}
                        >
                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                p: 2, 
                                borderRadius: 2, 
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.default',
                                flex: '1 1 250px',
                                maxWidth: '350px'
                            }}>
                                <EmailIcon sx={{ mr: 2, color: 'primary.main' }} />
                                <Box sx={{ textAlign: 'left' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                                        Correo Electrónico
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">{`${profile.email}@uho.edu.cu`}</Typography>
                                </Box>
                            </Box>

                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                p: 2, 
                                borderRadius: 2, 
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.default',
                                flex: '1 1 250px',
                                maxWidth: '350px'
                            }}>
                                <BadgeIcon sx={{ mr: 2, color: 'primary.main' }} />
                                <Box sx={{ textAlign: 'left' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                                        Identificación
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">{profile.identification}</Typography>
                                </Box>
                            </Box>

                            {(profile.role?.name === 'secretary' || profile.role?.name === 'vicedean') && (
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    p: 2, 
                                    borderRadius: 2, 
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.default',
                                    flex: '1 1 250px',
                                    maxWidth: '350px'
                                }}>
                                    <BusinessIcon sx={{ mr: 2, color: 'primary.main' }} />
                                    <Box sx={{ textAlign: 'left' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                                            Facultad
                                        </Typography>
                                        <Typography variant="body1" fontWeight="medium">{facultyName || 'Sin facultad asignada'}</Typography>
                                    </Box>
                                </Box>
                            )}

                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                p: 2, 
                                borderRadius: 2, 
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.default',
                                flex: '1 1 250px',
                                maxWidth: '350px'
                            }}>
                                {profile.isActive ? (
                                    <CheckCircleIcon sx={{ mr: 2, color: 'success.main' }} />
                                ) : (
                                    <CancelIcon sx={{ mr: 2, color: 'error.main' }} />
                                )}
                                <Box sx={{ textAlign: 'left' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                                        Estado
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                        {profile.isActive ? 'Usuario activo' : 'Usuario inactivo'}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        {profile.student && (
                            <>
                                <Divider sx={{ my: 4 }} />
                                <Typography variant="h6" gutterBottom sx={{ mb: 3, textAlign: 'center', fontWeight: 'bold' }}>
                                    Información Académica
                                </Typography>

                                <Box sx={{ 
                                    display: 'flex', 
                                    flexWrap: 'wrap', 
                                    gap: 2,
                                    justifyContent: 'center'
                                }}>
                                    <Box sx={{ 
                                        p: 2, 
                                        borderRadius: 2, 
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.default',
                                        flex: '1 1 200px',
                                        maxWidth: '300px',
                                        textAlign: 'left'
                                    }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                                            Año Académico
                                        </Typography>
                                        <Typography variant="body1" fontWeight="medium">{profile.student.academicYear}º año</Typography>
                                    </Box>

                                    <Box sx={{ 
                                        p: 2, 
                                        borderRadius: 2, 
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.default',
                                        flex: '1 1 200px',
                                        maxWidth: '300px',
                                        textAlign: 'left'
                                    }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                                            Carrera
                                        </Typography>
                                        <Typography variant="body1" fontWeight="medium">
                                            {profile.student.career?.name || 'Sin carrera asignada'}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ 
                                        p: 2, 
                                        borderRadius: 2, 
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.default',
                                        flex: '1 1 200px',
                                        maxWidth: '300px',
                                        textAlign: 'left'
                                    }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                                            Tipo de Curso
                                        </Typography>
                                        <Typography variant="body1" fontWeight="medium">
                                            {profile.student.courseType?.name || 'Sin tipo asignado'}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ 
                                        p: 2, 
                                        borderRadius: 2, 
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.default',
                                        flex: '1 1 200px',
                                        maxWidth: '300px',
                                        textAlign: 'left'
                                    }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold', mb: 1, display: 'block' }}>
                                            Estado Académico
                                        </Typography>
                                        <Chip
                                            label={profile.student.studentStatus?.kind || 'Sin estado'}
                                            color="secondary"
                                            size="small"
                                        />
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
