import React from 'react';
import {
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
    Storage as StorageIcon,
    Assignment as AssignmentIcon,
    ArrowForward as ArrowIcon,
    Domain as DomainIcon,
    ManageAccounts as ManageAccountsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';

const AdminDashboard: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { user } = useAuth();

    const menuItems = [
        {
            title: 'Tablas del SIGENU',
            description: 'Importar, visualizar y gestionar los datos del sistema SIGENU.',
            icon: <StorageIcon />,
            path: '/admin/sigenu-tables',
            color: theme.palette.secondary.main
        },
        {
            title: 'Notas a Exportar',
            description: 'Gestionar y exportar calificaciones pendientes hacia el SIGENU.',
            icon: <AssignmentIcon />,
            path: '/admin/sigenu-pending',
            color: theme.palette.primary.main
        },
        {
            title: 'Asignación de Facultades',
            description: 'Vincular a los secretarios y vicedecanos con su facultad correspondiente.',
            icon: <DomainIcon />,
            path: '/admin/faculty-assignment',
            color: theme.palette.warning.main
        },
        {
            title: 'Gestión de Roles',
            description: 'Administrar privilegios de acceso (profesor, vicedecano, secretario, administrador).',
            icon: <ManageAccountsIcon />,
            path: '/admin/role-management',
            color: theme.palette.info.main
        }
    ];

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Panel de Administrador"
                    subtitle={`Bienvenido, ${user?.firstName || 'Usuario'}. Seleccione una opción para comenzar.`}
                />

                <Grid container spacing={3}>
                    {menuItems.map((item, index) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                            <Card
                                elevation={0}
                                onClick={() => navigate(item.path)}
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

export default AdminDashboard;
