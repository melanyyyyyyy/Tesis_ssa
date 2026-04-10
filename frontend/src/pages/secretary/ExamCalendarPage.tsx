import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Box,
    CircularProgress,
    Container,
    useTheme,
    Card,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography,
    type SelectChangeEvent
} from '@mui/material';
import PageHeader from '../../components/common/PageHeader';
import MainLayout from '../../layouts/MainLayout';
import ExaminationCalendar from '../../components/common/ExaminationCalendar';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

interface FacultyOption {
    _id: string;
    name: string;
}

interface CareerOption {
    _id: string;
    name: string;
}

interface CourseTypeOption {
    _id: string;
    name: string;
}

const ExamCalendarPage: React.FC = () => {
    const theme = useTheme();
    const { token } = useAuth();
    const [assignedFaculty, setAssignedFaculty] = useState<FacultyOption | null>(null);
    const [courseTypes, setCourseTypes] = useState<CourseTypeOption[]>([]);
    const [careers, setCareers] = useState<CareerOption[]>([]);
    const [selectedCourseTypeId, setSelectedCourseTypeId] = useState('');
    const [selectedCareerId, setSelectedCareerId] = useState('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingCourseTypes, setLoadingCourseTypes] = useState(false);
    const [loadingCareers, setLoadingCareers] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAssignedFaculty = useCallback(async () => {
        if (!token) return;
        setLoadingProfile(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/secretary/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 404) {
                setAssignedFaculty(null);
                setError(null);
                return;
            }

            if (!response.ok) {
                throw new Error('No se pudo cargar la facultad asignada');
            }

            const data = await response.json();
            setAssignedFaculty(data?.facultyId || null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoadingProfile(false);
        }
    }, [token]);

    const fetchCourseTypes = useCallback(async (facultyId: string) => {
        if (!token || !facultyId) {
            setCourseTypes([]);
            return;
        }

        setLoadingCourseTypes(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                facultyId,
                limit: '100'
            });

            const response = await fetch(`${API_BASE}/secretary/course-types?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('No se pudieron cargar los tipos de curso');
            }

            const data = await response.json();
            setCourseTypes(data.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoadingCourseTypes(false);
        }
    }, [token]);

    const fetchCareers = useCallback(async (facultyId: string, courseTypeId: string) => {
        if (!token || !facultyId || !courseTypeId) {
            setCareers([]);
            return;
        }

        setLoadingCareers(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                facultyId,
                courseTypeId,
                limit: '500'
            });

            const response = await fetch(`${API_BASE}/secretary/careers?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('No se pudieron cargar las carreras');
            }

            const data = await response.json();
            setCareers(data.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoadingCareers(false);
        }
    }, [token]);

    useEffect(() => {
        void fetchAssignedFaculty();
    }, [fetchAssignedFaculty]);

    useEffect(() => {
        if (!assignedFaculty?._id) {
            setCourseTypes([]);
            setCareers([]);
            setSelectedCourseTypeId('');
            setSelectedCareerId('');
            setSelectedAcademicYear('');
            return;
        }
        void fetchCourseTypes(assignedFaculty._id);
    }, [assignedFaculty?._id, fetchCourseTypes]);

    const handleCourseTypeChange = (event: SelectChangeEvent<string>) => {
        const courseTypeId = event.target.value;
        setSelectedCourseTypeId(courseTypeId);
        setSelectedCareerId('');
        setSelectedAcademicYear('');
        setCareers([]);
        if (assignedFaculty?._id) {
            void fetchCareers(assignedFaculty._id, courseTypeId);
        }
    };

    const handleCareerChange = (event: SelectChangeEvent<string>) => {
        setSelectedCareerId(event.target.value);
        setSelectedAcademicYear('');
    };

    const handleAcademicYearChange = (event: SelectChangeEvent<string>) => {
        setSelectedAcademicYear(event.target.value);
    };

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Calendario de Exámenes"
                    subtitle={assignedFaculty?.name
                        ? `Visualiza, programa o elimina las convocatorias de exámenes para ${assignedFaculty.name}.`
                        : 'Visualiza, programa o elimina las convocatorias de exámenes del curso académico.'
                    }
                    showBackButton={true}
                />

                <Card elevation={0} sx={{
                    p: 4,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: theme.palette.background.paper,
                    textAlign: 'left'
                }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Filtros
                    </Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                        <FormControl fullWidth disabled={!assignedFaculty?._id || loadingCourseTypes}>
                            <InputLabel id="course-type-select-label">Tipo de Curso</InputLabel>
                            <Select
                                labelId="course-type-select-label"
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

                        <FormControl fullWidth disabled={!assignedFaculty?._id || !selectedCourseTypeId || loadingCareers}>
                            <InputLabel id="career-select-label">Carrera</InputLabel>
                            <Select
                                labelId="career-select-label"
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

                        <FormControl fullWidth disabled={!assignedFaculty?._id || !selectedCareerId}>
                            <InputLabel id="academic-year-select-label">Año Académico</InputLabel>
                            <Select
                                labelId="academic-year-select-label"
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

                    {loadingProfile && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    {!loadingProfile && !assignedFaculty?._id && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            No tienes una facultad asignada en este momento. Contacta al administrador para habilitar esta vista.
                        </Alert>
                    )}

                    {!loadingProfile && assignedFaculty?._id && (!selectedCareerId || !selectedAcademicYear) && (
                        <Alert severity="info">
                            Selecciona un tipo de curso, una carrera y un año académico para visualizar y gestionar el calendario de exámenes.
                        </Alert>
                    )}

                    {!loadingProfile && assignedFaculty?._id && selectedCareerId && selectedAcademicYear && (
                        <ExaminationCalendar
                            carrera={selectedCareerId}
                            academicYear={Number(selectedAcademicYear)}
                        />
                    )}
                </Card>
            </Container>
        </MainLayout>
    )
}

export default ExamCalendarPage;
