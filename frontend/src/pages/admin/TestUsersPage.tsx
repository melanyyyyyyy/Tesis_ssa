import React, { useMemo, useState } from 'react';
import {
    Alert,
    alpha,
    Box,
    Button,
    Chip,
    Container,
    Stack,
    Tooltip,
    IconButton,
    Typography,
    useTheme
} from '@mui/material';
import {
    GroupAdd as GroupAddIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ReusableTable, { type ReusableTableColumn } from '../../components/common/ReusableTable';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

type TestUserRole = 'admin' | 'secretary' | 'vicedean' | 'professor' | 'student' | 'sin_rol';

interface TestUserRow {
    _id: string;
    firstName: string;
    lastName: string;
    identification: string;
    email: string;
    password: string;
    faculty: string;
    role: TestUserRole;
}

interface FeedbackMessage {
    type: 'success' | 'error';
    text: string;
}

const formatInstitutionalEmail = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
        return '-';
    }

    if (normalizedEmail.includes('@')) {
        return normalizedEmail;
    }

    return `${normalizedEmail}@uho.edu.cu`;
};

const TestUsersPage: React.FC = () => {
    const theme = useTheme();
    const { token, logout } = useAuth();
    const [refreshKey, setRefreshKey] = useState(0);
    const [feedbackMessage, setFeedbackMessage] = useState<FeedbackMessage | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const columns = useMemo<ReusableTableColumn<TestUserRow>[]>(() => [
        {
            field: 'firstName',
            headerName: 'Nombres'
        },
        {
            field: 'lastName',
            headerName: 'Apellidos'
        },
        {
            field: 'identification',
            headerName: 'Identificación',
            renderCell: (value) => String(value || '-')
        },
        {
            field: 'email',
            headerName: 'Email',
            renderCell: (value) => formatInstitutionalEmail(String(value || ''))
        },
        {
            field: 'password',
            headerName: 'Contraseña'
        },
        {
            field: 'faculty',
            headerName: 'Facultad',
            renderCell: (value) => String(value || '-')
        },
        {
            field: 'role',
            headerName: 'Rol',
            renderCell: (value) => {
                const role = value as TestUserRole;
                const roleConfig: Record<TestUserRole, { label: string; color: string }> = {
                    admin: { label: 'Administrador', color: theme.palette.info.main },
                    secretary: { label: 'Secretario', color: theme.palette.warning.main },
                    vicedean: { label: 'Vicedecano', color: theme.palette.secondary.main },
                    professor: { label: 'Profesor', color: theme.palette.primary.main },
                    student: { label: 'Estudiante', color: theme.palette.success.main },
                    sin_rol: { label: 'Sin rol', color: theme.palette.text.secondary }
                };

                const config = roleConfig[role] || roleConfig.sin_rol;

                return (
                    <Chip
                        label={config.label}
                        size="small"
                        sx={{
                            borderRadius: theme.customShape.full,
                            bgcolor: alpha(config.color, 0.12),
                            color: config.color,
                            fontWeight: 700
                        }}
                    />
                );
            }
        }
    ], [theme]);

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
    };

    const handleCreateTestUsers = async () => {
        if (!token) {
            return;
        }

        setIsCreating(true);
        setFeedbackMessage(null);

        try {
            const response = await fetch(`${API_BASE}/admin/test-users/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const result = await response.json().catch(() => ({})) as {
                message?: string;
                error?: string;
                logs?: string[];
            };

            if (!response.ok) {
                throw new Error(result.error || result.message || 'No se pudieron crear los usuarios de prueba.');
            }

            setFeedbackMessage({
                type: 'success',
                text: result.message || 'Usuarios de prueba creados o actualizados correctamente.'
            });
            setRefreshKey((prev) => prev + 1);
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'No se pudieron crear los usuarios de prueba.';
            setFeedbackMessage({
                type: 'error',
                text: message
            });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Usuarios de Prueba"
                    subtitle="Crea rapidamente cuentas de prueba para administrador, secretario, vicedecano, profesor y estudiante."
                    showBackButton={true}
                    action={
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                                variant="contained"
                                startIcon={<GroupAddIcon />}
                                onClick={() => void handleCreateTestUsers()}
                                disabled={isCreating}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                                {isCreating ? 'Creando...' : 'Crear usuarios de prueba'}
                            </Button>
                            <Tooltip title="Actualizar">
                                <span>
                                    <IconButton
                                        color="primary"
                                        onClick={handleRefresh}
                                        disabled={isCreating}
                                    >
                                        <RefreshIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Stack>
                    }
                />

                <Stack spacing={3}>
                    {feedbackMessage && (
                        <Alert
                            severity={feedbackMessage.type}
                            onClose={() => setFeedbackMessage(null)}
                            sx={{ borderRadius: 2 }}
                        >
                            {feedbackMessage.text}
                        </Alert>
                    )}

                    <Box>
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                            Cuentas Disponibles
                        </Typography>
                        <ReusableTable<TestUserRow>
                            endpoint="/admin/test-users"
                            token={token}
                            columns={columns}
                            refreshKey={refreshKey}
                            rowKey="_id"
                            onUnauthorized={logout}
                            emptyMessage="Todavia no hay usuarios de prueba creados."
                        />
                    </Box>
                </Stack>
            </Container>
        </MainLayout>
    );
};

export default TestUsersPage;
