import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    alpha,
    Box,
    Button,
    Chip,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
    useTheme
} from '@mui/material';
import { Edit as EditIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ReusableTable, {
    type ReusableTableAction,
    type ReusableTableColumn
} from '../../components/common/ReusableTable';
import { useAuth } from '../../context/AuthContext';

type RoleManagementTab = 'pending' | 'assigned' | 'all';
type ManagedRole = 'admin' | 'secretary' | 'vicedean' | 'professor' | null;
type EditableRoleValue = 'unassigned' | 'admin' | 'secretary' | 'vicedean' | 'professor';

interface FacultyOption {
    _id: string;
    name: string;
}

interface RoleManagementUser {
    _id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    role: ManagedRole;
    faculty: FacultyOption | null;
}

const TAB_LABELS: Record<RoleManagementTab, string> = {
    pending: 'Pendientes (Sin Rol)',
    assigned: 'Asignados',
    all: 'Todos'
};

const TAB_DESCRIPTIONS: Record<RoleManagementTab, string> = {
    pending: 'Usuarios pendientes de asignacion de rol.',
    assigned: 'Usuarios que ya tienen un rol asignado.',
    all: 'Vista completa de usuarios administrables.'
};

const formatInstitutionalEmail = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
        return 'Sin correo';
    }

    if (normalizedEmail.includes('@')) {
        return normalizedEmail;
    }

    return `${normalizedEmail}@uho.edu.cu`;
};

const getEditableRoleValue = (role: ManagedRole): EditableRoleValue => role ?? 'unassigned';

const RoleManagementPage: React.FC = () => {
    const theme = useTheme();
    const { token, logout, user } = useAuth();
    const [activeTab, setActiveTab] = useState<RoleManagementTab>('pending');
    const [totalCount, setTotalCount] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<RoleManagementUser | null>(null);
    const [selectedRole, setSelectedRole] = useState<EditableRoleValue>('unassigned');
    const [selectedFacultyId, setSelectedFacultyId] = useState('');
    const [faculties, setFaculties] = useState<FacultyOption[]>([]);
    const [loadingFaculties, setLoadingFaculties] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

    const requiresFaculty = selectedRole === 'secretary' || selectedRole === 'vicedean';

    useEffect(() => {
        const fetchFaculties = async () => {
            if (!token) return;

            setLoadingFaculties(true);
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE}/admin/faculties?limit=200`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    logout();
                    return;
                }

                if (!response.ok) {
                    throw new Error('No se pudieron cargar las facultades');
                }

                const result = await response.json() as { data?: FacultyOption[] };
                setFaculties(Array.isArray(result.data) ? result.data : []);
            } catch (error) {
                setInfoMessage(error instanceof Error ? error.message : 'No se pudieron cargar las facultades');
            } finally {
                setLoadingFaculties(false);
            }
        };

        void fetchFaculties();
    }, [logout, token]);

    const columns = useMemo<ReusableTableColumn<RoleManagementUser>[]>(() => [
        {
            field: 'fullName',
            headerName: 'Nombre',
            renderCell: (_value, row) => `${row.firstName} ${row.lastName}`.trim()
        },
        {
            field: 'email',
            headerName: 'Correo',
            renderCell: (value) => formatInstitutionalEmail(String(value || ''))
        },
        {
            field: 'role',
            headerName: 'Rol',
            renderCell: (value) => {
                const role = value as ManagedRole;

                if (!role) {
                    return (
                        <Chip
                            label="Sin asignar"
                            size="small"
                            sx={{
                                borderRadius: theme.customShape.full,
                                bgcolor: alpha(theme.palette.text.secondary, 0.12),
                                color: theme.palette.text.secondary,
                                fontWeight: 700
                            }}
                        />
                    );
                }

                const roleConfig: Record<Exclude<ManagedRole, null>, { label: string; color: string }> = {
                    admin: { label: 'Administrador', color: theme.palette.info.main },
                    secretary: { label: 'Secretario', color: theme.palette.warning.main },
                    vicedean: { label: 'Vicedecano', color: theme.palette.secondary.main },
                    professor: { label: 'Profesor', color: theme.palette.primary.main }
                };

                const config = roleConfig[role];

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

    const actions = useMemo<ReusableTableAction<RoleManagementUser>[]>(() => [
        {
            variant: 'edit',
            label: 'Editar',
            icon: <EditIcon fontSize="small" />,
            onClick: (row) => {
                if (user && row._id === user._id) {
                    setInfoMessage('No puedes editar tu propio rol para evitar perder permisos de administrador.');
                    return;
                }
                setInfoMessage(null);
                setSelectedUser(row);
                setSelectedRole(getEditableRoleValue(row.role));
                setSelectedFacultyId(row.faculty?._id || '');
                setEditDialogOpen(true);
            }
        }
    ], [user]);

    const handleCloseDialog = () => {
        if (savingEdit) return;
        setEditDialogOpen(false);
        setSelectedUser(null);
        setSelectedRole('unassigned');
        setSelectedFacultyId('');
    };

    const handleSaveRole = async () => {
        if (!token || !selectedUser) return;

        setSavingEdit(true);
        setInfoMessage(null);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE}/admin/role-management-users/${selectedUser._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    role: selectedRole === 'unassigned' ? null : selectedRole,
                    facultyId: requiresFaculty ? selectedFacultyId : null
                })
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result?.message || result?.error || 'No se pudo actualizar el rol');
            }

            handleCloseDialog();
            setRefreshKey((prev) => prev + 1);
            setInfoMessage('Rol actualizado correctamente.');
        } catch (error) {
            setInfoMessage(error instanceof Error ? error.message : 'No se pudo actualizar el rol');
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Gestion de Roles"
                    subtitle={`${TAB_DESCRIPTIONS[activeTab]} Total de registros: ${totalCount}.`}
                    showBackButton={true}
                    action={
                        <Tooltip title="Actualizar datos">
                            <IconButton onClick={() => setRefreshKey((prev) => prev + 1)} color="primary">
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    }
                />

                {infoMessage && (
                    <Alert severity="info" onClose={() => setInfoMessage(null)} sx={{ mb: 3, borderRadius: 2 }}>
                        {infoMessage}
                    </Alert>
                )}

                <Paper
                    elevation={0}
                    sx={{
                        mb: 3,
                        p: 1,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper'
                    }}
                >
                    <Tabs
                        value={activeTab}
                        onChange={(_event, newValue: RoleManagementTab) => setActiveTab(newValue)}
                        variant="fullWidth"
                        sx={{
                            minHeight: 48,
                            '& .MuiTabs-indicator': {
                                height: 3,
                                borderRadius: 999
                            }
                        }}
                    >
                        <Tab label={TAB_LABELS.pending} value="pending" />
                        <Tab label={TAB_LABELS.assigned} value="assigned" />
                        <Tab label={TAB_LABELS.all} value="all" />
                    </Tabs>
                </Paper>

                <Box>
                    <ReusableTable<RoleManagementUser>
                        endpoint="/admin/role-management-users"
                        token={token}
                        queryParams={{ status: activeTab }}
                        columns={columns}
                        actions={actions}
                        rowKey="_id"
                        refreshKey={refreshKey}
                        tableAriaLabel="tabla de gestion de roles"
                        emptyMessage="No hay usuarios para mostrar en esta vista."
                        onTotalCountChange={setTotalCount}
                        onUnauthorized={logout}
                    />
                </Box>

                <Dialog open={editDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
                    <DialogTitle>Editar rol</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <Box sx={{ mb: 1 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, ml: 1 }}>
                                    Usuario
                                </Typography>
                                <Typography variant="body1" fontWeight={500} sx={{ mb: 0.5, ml: 1 }}>
                                    {selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}`.trim() : ''}
                                </Typography>
                            </Box>

                            <TextField
                                select
                                label="Rol"
                                value={selectedRole}
                                onChange={(event) => {
                                    const newRole = event.target.value as EditableRoleValue;
                                    setSelectedRole(newRole);
                                    if (newRole !== 'secretary' && newRole !== 'vicedean') {
                                        setSelectedFacultyId('');
                                    }
                                }}
                                fullWidth
                                disabled={savingEdit}
                            >
                                <MenuItem value="unassigned">No asignado</MenuItem>
                                <MenuItem value="professor">Profesor</MenuItem>
                                <MenuItem value="secretary">Secretario</MenuItem>
                                <MenuItem value="admin">Administrador</MenuItem>
                                <MenuItem value="vicedean">Vicedecano</MenuItem>
                            </TextField>

                            {requiresFaculty && (
                                <TextField
                                    select
                                    label="Facultad"
                                    value={selectedFacultyId}
                                    onChange={(event) => setSelectedFacultyId(event.target.value)}
                                    fullWidth
                                    disabled={savingEdit || loadingFaculties}
                                    helperText="Opcional. Puedes dejar este rol sin facultad asignada."
                                    slotProps={{
                                        select: {
                                            displayEmpty: true
                                        },
                                        inputLabel: {
                                            shrink: true
                                        }
                                    }}
                                >
                                    <MenuItem value="">
                                        Sin facultad asignada
                                    </MenuItem>
                                    {faculties.length > 0 ? faculties.map((faculty) => (
                                        <MenuItem key={faculty._id} value={faculty._id}>
                                            {faculty.name}
                                        </MenuItem>
                                    )) : (
                                        <MenuItem disabled>
                                            {loadingFaculties ? 'Cargando facultades...' : 'No hay facultades disponibles'}
                                        </MenuItem>
                                    )}
                                </TextField>
                            )}
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog} color="inherit" disabled={savingEdit}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveRole} variant="contained" disabled={savingEdit}>
                            {savingEdit ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </MainLayout>
    );
};

export default RoleManagementPage;
