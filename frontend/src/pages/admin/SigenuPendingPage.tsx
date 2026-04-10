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
    Sync as SyncIcon, 
    Assignment as AssignmentIcon,
    History as HistoryIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

const SigenuPendingPage: React.FC = () => {
    const navigate = useNavigate();
    const theme = useTheme();
    const { token } = useAuth();
    const [pendingCount, setPendingCount] = useState<number | null>(null);
    const [lastExport, setLastExport] = useState<{ count: number; date: string | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPendingCount = async () => {
            try {
                const response = await fetch(`${API_BASE}/admin/pending-grades-count`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Error al obtener notas pendientes');
                }

                const data = await response.json();
                setPendingCount(data.count);
                if (data.lastExport) {
                    setLastExport(data.lastExport);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error desconocido');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchPendingCount();
        }
    }, [token]);

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Nunca';
        return new Date(dateString).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

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
                    title="Notas a Exportar"
                    subtitle="Gestión de evaluaciones pendientes de sincronización con SIGENU."
                    showBackButton={true}
                />

                {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.875rem' }}>
                    Acciones de Sistema
                </Typography>
                
                <Box sx={{ mb: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={() => navigate('/admin/sigenu-sync')}
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
                            <SyncIcon />
                        </Avatar>
                        <Box>
                            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>Sincronizar con SIGENU</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                                Exportar notas pendientes y generar backup
                            </Typography>
                        </Box>
                    </Paper>
                </Box>

                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.875rem' }}>
                    Resumen de Registros
                </Typography>
                
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                        <Card 
                            elevation={0}
                            onClick={() => navigate('/admin/sigenu-pending/export')}
                            sx={{ 
                                cursor: 'pointer',
                                borderRadius: 2, 
                                border: '1px solid',
                                borderColor: 'divider',
                                height: '100%',
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': { 
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                    borderColor: alpha(theme.palette.warning.main, 0.5)
                                }
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                    <Avatar 
                                        variant="rounded"
                                        sx={{ 
                                            bgcolor: alpha(theme.palette.warning.main, 0.08), 
                                            color: theme.palette.warning.main,
                                            borderRadius: 1.5,
                                            width: 44,
                                            height: 44
                                        }}
                                    >
                                        <AssignmentIcon />
                                    </Avatar>
                                </Box>
                                
                                <Typography variant="h4" fontWeight="800" sx={{ mb: 1, color: 'text.primary' }}>
                                    {pendingCount ?? 0}
                                </Typography>
                                
                                <Typography variant="body2" fontWeight="500" color="text.secondary">
                                    Evaluaciones a exportar
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                        <Card 
                            elevation={0}
                            onClick={() => navigate('/admin/sigenu-pending/last-export')}
                            sx={{ 
                                cursor: 'pointer',
                                borderRadius: 2, 
                                border: '1px solid',
                                borderColor: 'divider',
                                height: '100%',
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': { 
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                    borderColor: alpha(theme.palette.success.main, 0.5)
                                }
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                    <Avatar 
                                        variant="rounded"
                                        sx={{ 
                                            bgcolor: alpha(theme.palette.success.main, 0.08), 
                                            color: theme.palette.success.main,
                                            borderRadius: 1.5,
                                            width: 44,
                                            height: 44
                                        }}
                                    >
                                        <HistoryIcon />
                                    </Avatar>
                                </Box>
                                
                                <Typography variant="h4" fontWeight="800" sx={{ mb: 1, color: 'text.primary' }}>
                                    {lastExport?.count ?? 0}
                                </Typography>
                                
                                <Box>
                                    <Typography variant="body2" fontWeight="500" color="text.secondary">
                                        Última exportación
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                                        {formatDate(lastExport?.date || null)}
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Container>
        </MainLayout>
    );
};

export default SigenuPendingPage;
