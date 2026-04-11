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

type FacultyAssignmentTab = 'secretaries' | 'vicedeans' | 'all';
type ManagedRole = 'secretary' | 'vicedean' | null;

interface FacultyOption {
    _id: string;
    name: string;
}

interface FacultyAssignmentUser {
    _id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    role: ManagedRole;
    faculty: FacultyOption | null;
}

const TAB_LABELS: Record<FacultyAssignmentTab, string> = {
    secretaries: 'Secretarios',
    vicedeans: 'Vicedecanos',
    all: 'Todos'
};

const TAB_DESCRIPTIONS: Record<FacultyAssignmentTab, string> = {
    secretaries: 'Gestiona la facultad asignada a los secretarios.',
    vicedeans: 'Gestiona la facultad asignada a los vicedecanos.',
    all: 'Vista completa de secretarios y vicedecanos.'
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

const FacultyAssignmentPage: React.FC = () => {
    const theme = useTheme();
    const { token, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<FacultyAssignmentTab>('secretaries');
    const [totalCount, setTotalCount] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<FacultyAssignmentUser | null>(null);
    const [selectedFacultyId, setSelectedFacultyId] = useState('');
    const [faculties, setFaculties] = useState<FacultyOption[]>([]);
    const [loadingFaculties, setLoadingFaculties] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

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

    const columns = useMemo<ReusableTableColumn<FacultyAssignmentUser>[]>(() => [
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

                const roleConfig: Record<Exclude<ManagedRole, null>, { label: string; color: string }> = {
                    secretary: { label: 'Secretario', color: theme.palette.warning.main },
                    vicedean: { label: 'Vicedecano', color: theme.palette.secondary.main }
                };

                const config = role ? roleConfig[role] : null;

                return (
                    <Chip
                        label={config?.label || 'Sin asignar'}
                        size="small"
                        sx={{
                            borderRadius: theme.customShape.full,
                            bgcolor: alpha((config?.color || theme.palette.text.secondary), 0.12),
                            color: config?.color || theme.palette.text.secondary,
                            fontWeight: 700
                        }}
                    />
                );
            }
        },
        {
            field: 'faculty',
            headerName: 'Facultad',
            renderCell: (value) => {
                const faculty = value as FacultyOption | null;

                if (!faculty?.name) {
                    return (
                        <Chip
                            label="No asignado"
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

                return (
                    <Chip
                        label={faculty.name}
                        size="small"
                        sx={{
                            borderRadius: theme.customShape.full,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            fontWeight: 700
                        }}
                    />
                );
            }
        }
    ], [theme]);

    const actions = useMemo<ReusableTableAction<FacultyAssignmentUser>[]>(() => [
        {
            variant: 'edit',
            label: 'Editar',
            icon: <EditIcon fontSize="small" />,
            onClick: (row) => {
                setInfoMessage(null);
                setSelectedUser(row);
                setSelectedFacultyId(row.faculty?._id || '');
                setEditDialogOpen(true);
            }
        }
    ], []);

    const handleCloseDialog = () => {
        if (savingEdit) return;
        setEditDialogOpen(false);
        setSelectedUser(null);
        setSelectedFacultyId('');
    };

    const handleSaveFaculty = async () => {
        if (!token || !selectedUser) return;

        setSavingEdit(true);
        setInfoMessage(null);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE}/admin/faculty-assignment-users/${selectedUser._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    facultyId: selectedFacultyId
                })
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result?.message || result?.error || 'No se pudo actualizar la facultad');
            }

            handleCloseDialog();
            setRefreshKey((prev) => prev + 1);
            setInfoMessage('Facultad actualizada correctamente.');
        } catch (error) {
            setInfoMessage(error instanceof Error ? error.message : 'No se pudo actualizar la facultad');
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Asignacion de Facultades"
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
                        onChange={(_event, newValue: FacultyAssignmentTab) => setActiveTab(newValue)}
                        variant="fullWidth"
                        sx={{
                            minHeight: 48,
                            '& .MuiTabs-indicator': {
                                height: 3,
                                borderRadius: 999
                            }
                        }}
                    >
                        <Tab label={TAB_LABELS.secretaries} value="secretaries" />
                        <Tab label={TAB_LABELS.vicedeans} value="vicedeans" />
                        <Tab label={TAB_LABELS.all} value="all" />
                    </Tabs>
                </Paper>

                <Box>
                    <ReusableTable<FacultyAssignmentUser>
                        endpoint="/admin/faculty-assignment-users"
                        token={token}
                        queryParams={{ tab: activeTab }}
                        columns={columns}
                        actions={actions}
                        rowKey="_id"
                        refreshKey={refreshKey}
                        tableAriaLabel="tabla de asignacion de facultades"
                        emptyMessage="No hay usuarios para mostrar en esta vista."
                        onTotalCountChange={setTotalCount}
                        onUnauthorized={logout}
                    />
                </Box>

                <Dialog open={editDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
                    <DialogTitle>Editar facultad</DialogTitle>
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
                                <MenuItem value="">Sin facultad asignada</MenuItem>
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
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog} color="inherit" disabled={savingEdit}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveFaculty} variant="contained" disabled={savingEdit}>
                            {savingEdit ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </MainLayout>
    );
};

export default FacultyAssignmentPage;
