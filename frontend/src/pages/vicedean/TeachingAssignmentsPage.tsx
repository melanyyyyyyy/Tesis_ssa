import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography,
    type SelectChangeEvent
} from '@mui/material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ReusableTable, { type ReusableTableAction, type ReusableTableColumn } from '../../components/common/ReusableTable';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;
const FACULTY_STORAGE_KEY = 'vicedeanFacultyContext';

interface FacultyContext {
    _id: string;
    name: string;
}

interface CareerOption {
    _id: string;
    name: string;
    courseTypeId?: string;
    courseTypeName?: string;
}

interface CourseTypeOption {
    _id: string;
    name: string;
}

interface TeachingAssignmentRow {
    _id: string;
    name: string;
    professorId?: string | null;
    professorName?: string;
}

interface ProfessorOption {
    _id: string;
    firstName: string;
    lastName: string;
}

interface TeachingAssignmentsLocationState {
    faculty?: FacultyContext;
}

const TeachingAssignmentsPage: React.FC = () => {
    const location = useLocation();
    const { token, logout } = useAuth();
    const [careers, setCareers] = useState<CareerOption[]>([]);
    const [courseTypes, setCourseTypes] = useState<CourseTypeOption[]>([]);
    const [professors, setProfessors] = useState<ProfessorOption[]>([]);
    const [selectedCourseTypeId, setSelectedCourseTypeId] = useState('');
    const [selectedCareerId, setSelectedCareerId] = useState('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
    const [loadingCareers, setLoadingCareers] = useState(true);
    const [loadingCourseTypes, setLoadingCourseTypes] = useState(true);
    const [loadingProfessors, setLoadingProfessors] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState<TeachingAssignmentRow | null>(null);
    const [selectedProfessorId, setSelectedProfessorId] = useState('');
    const [savingProfessor, setSavingProfessor] = useState(false);

    const faculty = useMemo(() => {
        const state = location.state as TeachingAssignmentsLocationState | null;
        if (state?.faculty) {
            localStorage.setItem(FACULTY_STORAGE_KEY, JSON.stringify(state.faculty));
            return state.faculty;
        }

        const savedFaculty = localStorage.getItem(FACULTY_STORAGE_KEY);
        if (!savedFaculty) {
            return null;
        }

        try {
            return JSON.parse(savedFaculty) as FacultyContext;
        } catch {
            return null;
        }
    }, [location.state]);

    const hasFacultyAssigned = Boolean(faculty?._id);

    useEffect(() => {
        const fetchCourseTypes = async () => {
            if (!token) {
                setLoadingCourseTypes(false);
                return;
            }
            if (!hasFacultyAssigned) {
                setCourseTypes([]);
                setLoadingCourseTypes(false);
                return;
            }

            setLoadingCourseTypes(true);
            setError(null);

            try {
                const response = await fetch(`${API_BASE}/vicedean/course-types`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    logout();
                    return;
                }

                if (!response.ok) {
                    throw new Error('No se pudieron cargar los tipos de curso');
                }

                const result = await response.json() as { data?: CourseTypeOption[] };
                setCourseTypes(Array.isArray(result.data) ? result.data : []);
            } catch (fetchError) {
                setError(fetchError instanceof Error ? fetchError.message : 'Error desconocido');
            } finally {
                setLoadingCourseTypes(false);
            }
        };

        const fetchCareers = async () => {
            if (!token) {
                setLoadingCareers(false);
                return;
            }
            if (!hasFacultyAssigned) {
                setCareers([]);
                setLoadingCareers(false);
                return;
            }

            setLoadingCareers(true);
            setError(null);

            try {
                if (!selectedCourseTypeId) {
                    setCareers([]);
                    setLoadingCareers(false);
                    return;
                }

                const params = new URLSearchParams({ limit: '200' });
                params.set('courseTypeId', selectedCourseTypeId);

                const response = await fetch(`${API_BASE}/vicedean/careers?${params.toString()}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    logout();
                    return;
                }

                if (!response.ok) {
                    throw new Error('No se pudieron cargar las carreras de la facultad');
                }

                const result = await response.json() as { data?: CareerOption[] };
                setCareers(Array.isArray(result.data) ? result.data : []);
            } catch (fetchError) {
                setError(fetchError instanceof Error ? fetchError.message : 'Error desconocido');
            } finally {
                setLoadingCareers(false);
            }
        };

        void fetchCourseTypes();
        void fetchCareers();
    }, [hasFacultyAssigned, logout, selectedCourseTypeId, token]);

    useEffect(() => {
        const fetchProfessors = async () => {
            if (!token) {
                setLoadingProfessors(false);
                return;
            }
            if (!hasFacultyAssigned) {
                setProfessors([]);
                setLoadingProfessors(false);
                return;
            }

            setLoadingProfessors(true);
            try {
                const response = await fetch(`${API_BASE}/vicedean/professors`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    logout();
                    return;
                }

                if (!response.ok) {
                    throw new Error('No se pudieron cargar los profesores');
                }

                const result = await response.json() as { data?: ProfessorOption[] };
                setProfessors(Array.isArray(result.data) ? result.data : []);
            } catch (fetchError) {
                setError(fetchError instanceof Error ? fetchError.message : 'Error desconocido');
            } finally {
                setLoadingProfessors(false);
            }
        };

        void fetchProfessors();
    }, [hasFacultyAssigned, logout, token]);

    useEffect(() => {
        if (!selectedCareerId) return;
        const careerExists = careers.some((career) => career._id === selectedCareerId);
        if (!careerExists) {
            setSelectedCareerId('');
            setSelectedAcademicYear('');
        }
    }, [careers, selectedCareerId]);

    const columns = useMemo<ReusableTableColumn<TeachingAssignmentRow>[]>(() => [
        {
            field: 'name',
            headerName: 'Asignatura'
        },
        {
            field: 'professorName',
            headerName: 'Profesor',
            renderCell: (value) => String(value || 'No asignado')
        }
    ], []);

    const actions = useMemo<ReusableTableAction<TeachingAssignmentRow>[]>(() => [
        {
            variant: 'edit',
            label: 'Editar',
            onClick: (row) => {
                setSelectedSubject(row);
                setSelectedProfessorId(row.professorId || '');
                setEditDialogOpen(true);
                setInfoMessage(null);
            }
        }
    ], []);

    const selectedCareer = useMemo(
        () => careers.find((career) => career._id === selectedCareerId) || null,
        [careers, selectedCareerId]
    );

    const tableQueryParams = useMemo(
        () => ({
            careerId: selectedCareerId,
            courseTypeId: selectedCourseTypeId,
            academicYear: selectedAcademicYear
        }),
        [selectedAcademicYear, selectedCareerId, selectedCourseTypeId]
    );

    const handleCourseTypeChange = (event: SelectChangeEvent<string>) => {
        setSelectedCourseTypeId(event.target.value);
        setSelectedCareerId('');
        setSelectedAcademicYear('');
        setInfoMessage(null);
    };

    const handleCareerChange = (event: SelectChangeEvent<string>) => {
        setSelectedCareerId(event.target.value);
        setSelectedAcademicYear('');
        setInfoMessage(null);
    };

    const handleAcademicYearChange = (event: SelectChangeEvent<string>) => {
        setSelectedAcademicYear(event.target.value);
        setInfoMessage(null);
    };

    const handleProfessorChange = (event: SelectChangeEvent<string>) => {
        setSelectedProfessorId(event.target.value);
    };

    const handleCloseEditDialog = () => {
        if (savingProfessor) return;
        setEditDialogOpen(false);
        setSelectedSubject(null);
        setSelectedProfessorId('');
    };

    const handleSaveProfessor = async () => {
        if (!token || !selectedSubject || !selectedProfessorId) return;

        setSavingProfessor(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/vicedean/subjects/${selectedSubject._id}/professor`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ professorId: selectedProfessorId })
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.message || 'No se pudo actualizar la asignación del profesor');
            }

            setInfoMessage('Profesor asignado correctamente.');
            setRefreshKey((prev) => prev + 1);
            handleCloseEditDialog();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Error desconocido');
        } finally {
            setSavingProfessor(false);
        }
    };

    const showTable = Boolean(hasFacultyAssigned && selectedCareerId && selectedCourseTypeId && selectedAcademicYear);

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Asignación Docente"
                    subtitle={faculty
                        ? `Gestiona la asignación del profesorado de la ${faculty.name} por carrera y año académico.`
                        : 'Gestiona la asignación del profesorado por carrera y año académico.'
                    }
                    showBackButton={true}
                />

                <Card
                    elevation={0}
                    sx={{
                        p: 4,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        textAlign: 'left'
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Filtros
                    </Typography>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                        <FormControl fullWidth disabled={!hasFacultyAssigned || loadingCourseTypes}>
                            <InputLabel id="vicedean-course-type-select-label">Tipo de Curso</InputLabel>
                            <Select
                                labelId="vicedean-course-type-select-label"
                                value={selectedCourseTypeId}
                                label="Tipo de Curso"
                                onChange={handleCourseTypeChange}
                            >
                                {courseTypes.map((courseType) => (
                                    <MenuItem key={courseType._id} value={courseType._id}>
                                        {courseType.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth disabled={!hasFacultyAssigned || !selectedCourseTypeId || loadingCareers}>
                            <InputLabel id="vicedean-career-select-label">Carrera</InputLabel>
                            <Select
                                labelId="vicedean-career-select-label"
                                value={selectedCareerId}
                                label="Carrera"
                                onChange={handleCareerChange}
                            >
                                {careers.map((career) => (
                                    <MenuItem key={career._id} value={career._id}>
                                        {career.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth disabled={!hasFacultyAssigned || !selectedCareerId || !selectedCourseTypeId}>
                            <InputLabel id="vicedean-academic-year-select-label">Año Académico</InputLabel>
                            <Select
                                labelId="vicedean-academic-year-select-label"
                                value={selectedAcademicYear}
                                label="Año Académico"
                                onChange={handleAcademicYearChange}
                            >
                                <MenuItem value="1">1er Año</MenuItem>
                                <MenuItem value="2">2do Año</MenuItem>
                                <MenuItem value="3">3er Año</MenuItem>
                                <MenuItem value="4">4to Año</MenuItem>
                                <MenuItem value="5">5to Año</MenuItem>
                                <MenuItem value="6">6to Año</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>

                    {selectedCareer && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Carrera seleccionada: {selectedCareer.name}
                        </Typography>
                    )}

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {infoMessage && <Alert severity="info" sx={{ mb: 2 }}>{infoMessage}</Alert>}

                    {!faculty && !error && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            No tienes una facultad asignada en este momento. Contacta al administrador para habilitar esta vista.
                        </Alert>
                    )}

                    {!showTable && !error && hasFacultyAssigned && (
                        <Alert severity="info">
                            Seleccione un tipo de curso, una carrera y un año académico para visualizar las asignaturas y su profesor asignado.
                        </Alert>
                    )}

                    {showTable && (
                        <Box sx={{ mt: 1 }}>
                            <ReusableTable<TeachingAssignmentRow>
                                endpoint="/vicedean/subjects"
                                token={token}
                                columns={columns}
                                queryParams={tableQueryParams}
                                serverPagination={true}
                                initialRowsPerPage={10}
                                emptyMessage="No hay asignaturas registradas para la carrera y el año académico seleccionados."
                                tableAriaLabel="tabla de asignación docente"
                                actions={actions}
                                onUnauthorized={logout}
                                refreshKey={refreshKey}
                            />
                        </Box>
                    )}
                </Card>
            </Container>
            <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} fullWidth maxWidth="sm">
                <DialogTitle>Editar Asignación Docente</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Asignatura: {selectedSubject?.name || '-'}
                        </Typography>
                        <FormControl fullWidth disabled={loadingProfessors || savingProfessor}>
                            <InputLabel id="professor-select-label">Profesor</InputLabel>
                            <Select
                                labelId="professor-select-label"
                                value={selectedProfessorId}
                                label="Profesor"
                                onChange={handleProfessorChange}
                            >
                                {professors.map((professor) => (
                                    <MenuItem key={professor._id} value={professor._id}>
                                        {`${professor.firstName} ${professor.lastName}`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEditDialog} color="inherit" disabled={savingProfessor}>
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveProfessor}
                        disabled={!selectedProfessorId || savingProfessor}
                    >
                        Guardar
                    </Button>
                </DialogActions>
            </Dialog>
        </MainLayout>
    );
};

export default TeachingAssignmentsPage;
