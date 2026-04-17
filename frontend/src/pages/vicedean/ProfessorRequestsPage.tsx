import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    alpha,
    Button,
    Chip,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Tab,
    Tabs,
    Tooltip,
    Typography,
    useTheme
} from '@mui/material';
import { 
    Check as CheckIcon, 
    Close as CloseIcon, 
    Refresh as RefreshIcon 
} from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ReusableTable, {
    type ReusableTableAction,
    type ReusableTableColumn
} from '../../components/common/ReusableTable';
import { useAuth } from '../../context/AuthContext';

type ProfessorRequestTab = 'pending' | 'approved' | 'denied' | 'all';

interface ProfessorRequestUser {
    _id: string;
    requestId?: string | null;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    status: 'pending' | 'approved' | 'denied' | 'unknown';
    isPendingApproval: boolean;
    accessDenied: boolean;
}

interface CourseTypeOption {
    _id: string;
    name: string;
}

interface CareerOption {
    _id: string;
    name: string;
}

interface SubjectOption {
    _id: string;
    name: string;
}

const TAB_LABELS: Record<ProfessorRequestTab, string> = {
    pending: 'Pendientes',
    approved: 'Aprobados',
    denied: 'Denegados',
    all: 'Todos'
};

const ProfessorRequestsPage: React.FC = () => {
    const theme = useTheme();
    const { token, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<ProfessorRequestTab>('pending');
    const [refreshKey, setRefreshKey] = useState(0);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<ProfessorRequestUser | null>(null);
    
    const [courseTypes, setCourseTypes] = useState<CourseTypeOption[]>([]);
    const [careers, setCareers] = useState<CareerOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [selectedCourseTypeId, setSelectedCourseTypeId] = useState('');
    const [selectedCareerId, setSelectedCareerId] = useState('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!approvalDialogOpen || !token) return;
        const fetchCourseTypes = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE}/vicedean/course-types`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const result = await response.json();
                    setCourseTypes(result.data || []);
                }
            } catch (error) {
                console.error('Error fetching course types:', error);
            }
        };
        void fetchCourseTypes();
    }, [approvalDialogOpen, token]);

    useEffect(() => {
        if (!selectedCourseTypeId || !token) {
            setCareers([]);
            return;
        }
        const fetchCareers = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE}/vicedean/careers?courseTypeId=${selectedCourseTypeId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const result = await response.json();
                    setCareers(result.data || []);
                }
            } catch (error) {
                console.error('Error fetching careers:', error);
            }
        };
        void fetchCareers();
    }, [selectedCourseTypeId, token]);

    useEffect(() => {
        if (!selectedCareerId || !selectedAcademicYear || !selectedCourseTypeId || !token) {
            setSubjects([]);
            return;
        }
        const fetchSubjects = async () => {
            try {
                const query = new URLSearchParams({
                    careerId: selectedCareerId,
                    academicYear: selectedAcademicYear,
                    courseTypeId: selectedCourseTypeId
                });
                const response = await fetch(`${import.meta.env.VITE_API_BASE}/vicedean/subjects?${query.toString()}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const result = await response.json();
                    setSubjects(result.data || []);
                }
            } catch (error) {
                console.error('Error fetching subjects:', error);
            }
        };
        void fetchSubjects();
    }, [selectedCareerId, selectedAcademicYear, selectedCourseTypeId, token]);

    const handleOpenApproval = (user: ProfessorRequestUser) => {
        setSelectedUser(user);
        setApprovalDialogOpen(true);
        setSelectedCourseTypeId('');
        setSelectedCareerId('');
        setSelectedAcademicYear('');
        setSelectedSubjectId('');
    };

    const handleApprove = async () => {
        if (!selectedUser || !selectedSubjectId || !token) return;
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE}/vicedean/professor-requests/${selectedUser._id}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ subjectId: selectedSubjectId })
            });
            if (response.ok) {
                setInfoMessage('Profesor aprobado y asignatura asignada correctamente.');
                setRefreshKey(prev => prev + 1);
                setApprovalDialogOpen(false);
            } else {
                const err = await response.json();
                setErrorMessage(err.message || 'Error al aprobar solicitud');
            }
        } catch (error) {
            setErrorMessage('Error de red al aprobar solicitud');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async (user: ProfessorRequestUser) => {
        if (!token) return;
        setErrorMessage(null);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE}/vicedean/professor-requests/${user._id}/reject`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setInfoMessage('Solicitud rechazada correctamente.');
                setRefreshKey(prev => prev + 1);
            } else {
                const err = await response.json();
                setErrorMessage(err.message || 'Error al rechazar solicitud');
            }
        } catch (error) {
            setErrorMessage('Error de red al rechazar solicitud');
        }
    };

    const columns = useMemo<ReusableTableColumn<ProfessorRequestUser>[]>(() => [
        {
            field: 'fullName',
            headerName: 'Nombre',
            renderCell: (_value, row) => `${row.firstName} ${row.lastName}`.trim()
        },
        {
            field: 'email',
            headerName: 'Correo'
        },
        {
            field: 'status',
            headerName: 'Estado',
            renderCell: (value) => {
                const status = value as ProfessorRequestUser['status'];
                const config = {
                    pending: { label: 'Pendiente', color: theme.palette.warning.main },
                    approved: { label: 'Aprobado', color: theme.palette.success.main },
                    denied: { label: 'Denegado', color: theme.palette.error.main },
                    unknown: { label: 'Desconocido', color: theme.palette.text.secondary }
                };
                const item = config[status] || config.unknown;
                return (
                    <Chip
                        label={item.label}
                        size="small"
                        sx={{
                            borderRadius: theme.customShape.full,
                            bgcolor: alpha(item.color, 0.12),
                            color: item.color,
                            fontWeight: 700
                        }}
                    />
                );
            }
        }
    ], [theme]);

    const actions = useMemo<ReusableTableAction<ProfessorRequestUser>[]>(() => {
        const baseActions: ReusableTableAction<ProfessorRequestUser>[] = [];
        
        baseActions.push({
            variant: 'custom',
            label: 'Aprobar',
            icon: <CheckIcon fontSize="small" />,
            color: 'success',
            onClick: (row) => handleOpenApproval(row),
            hidden: (row) => row.status === 'approved'
        });

        baseActions.push({
            variant: 'custom',
            label: 'Denegar',
            icon: <CloseIcon fontSize="small" />,
            color: 'error',
            onClick: (row) => handleReject(row),
            hidden: (row) => row.status === 'denied'
        });

        return baseActions;
    }, [token]);

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Solicitudes de Profesores"
                    subtitle="Gestiona las solicitudes de acceso para el rol de profesor y asigna sus asignaturas iniciales."
                    showBackButton={true}
                    action={
                        <Tooltip title="Actualizar datos">
                            <IconButton onClick={() => setRefreshKey(prev => prev + 1)} color="primary">
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    }
                />

                {infoMessage && (
                    <Alert severity="success" onClose={() => setInfoMessage(null)} sx={{ mb: 3, borderRadius: 2 }}>
                        {infoMessage}
                    </Alert>
                )}
                {errorMessage && (
                    <Alert severity="error" onClose={() => setErrorMessage(null)} sx={{ mb: 3, borderRadius: 2 }}>
                        {errorMessage}
                    </Alert>
                )}

                <Paper elevation={0} sx={{ mb: 3, p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Tabs
                        value={activeTab}
                        onChange={(_e, newValue: ProfessorRequestTab) => setActiveTab(newValue)}
                        variant="fullWidth"
                    >
                        <Tab label={TAB_LABELS.pending} value="pending" />
                        <Tab label={TAB_LABELS.approved} value="approved" />
                        <Tab label={TAB_LABELS.denied} value="denied" />
                        <Tab label={TAB_LABELS.all} value="all" />
                    </Tabs>
                </Paper>

                <ReusableTable<ProfessorRequestUser>
                    endpoint="/vicedean/professor-requests"
                    token={token}
                    queryParams={{ status: activeTab }}
                    columns={columns}
                    actions={actions}
                    rowKey="_id"
                    refreshKey={refreshKey}
                    onUnauthorized={logout}
                    emptyMessage="No hay solicitudes para mostrar."
                />

                <Dialog open={approvalDialogOpen} onClose={() => !isSubmitting && setApprovalDialogOpen(false)} fullWidth maxWidth="sm">
                    <DialogTitle>Aprobar Profesor y Asignar Asignatura</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <Typography variant="body1" fontWeight={500}>
                                Usuario: {selectedUser?.fullName}
                            </Typography>
                            
                            <FormControl fullWidth>
                                <InputLabel>Tipo de Curso</InputLabel>
                                <Select
                                    value={selectedCourseTypeId}
                                    label="Tipo de Curso"
                                    onChange={(e) => {
                                        setSelectedCourseTypeId(e.target.value);
                                        setSelectedCareerId('');
                                        setSelectedAcademicYear('');
                                        setSelectedSubjectId('');
                                    }}
                                >
                                    {courseTypes.map(ct => <MenuItem key={ct._id} value={ct._id}>{ct.name}</MenuItem>)}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth disabled={!selectedCourseTypeId}>
                                <InputLabel>Carrera</InputLabel>
                                <Select
                                    value={selectedCareerId}
                                    label="Carrera"
                                    onChange={(e) => {
                                        setSelectedCareerId(e.target.value);
                                        setSelectedAcademicYear('');
                                        setSelectedSubjectId('');
                                    }}
                                >
                                    {careers.map(c => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth disabled={!selectedCareerId}>
                                <InputLabel>Año Académico</InputLabel>
                                <Select
                                    value={selectedAcademicYear}
                                    label="Año Académico"
                                    onChange={(e) => {
                                        setSelectedAcademicYear(e.target.value);
                                        setSelectedSubjectId('');
                                    }}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(year => (
                                        <MenuItem key={year} value={String(year)}>{year}º Año</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth disabled={!selectedAcademicYear}>
                                <InputLabel>Asignatura</InputLabel>
                                <Select
                                    value={selectedSubjectId}
                                    label="Asignatura"
                                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                                >
                                    {subjects.map(s => <MenuItem key={s._id} value={s._id}>{s.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setApprovalDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button 
                            variant="contained" 
                            onClick={handleApprove} 
                            disabled={!selectedSubjectId || isSubmitting}
                        >
                            Aprobar y Asignar
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </MainLayout>
    );
};

export default ProfessorRequestsPage;
