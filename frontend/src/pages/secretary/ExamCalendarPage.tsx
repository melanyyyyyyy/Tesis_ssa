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
    const [faculties, setFaculties] = useState<FacultyOption[]>([]);
    const [courseTypes, setCourseTypes] = useState<CourseTypeOption[]>([]);
    const [careers, setCareers] = useState<CareerOption[]>([]);
    const [selectedFacultyId, setSelectedFacultyId] = useState('');
    const [selectedCourseTypeId, setSelectedCourseTypeId] = useState('');
    const [selectedCareerId, setSelectedCareerId] = useState('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
    const [loadingFaculties, setLoadingFaculties] = useState(true);
    const [loadingCourseTypes, setLoadingCourseTypes] = useState(false);
    const [loadingCareers, setLoadingCareers] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchFaculties = useCallback(async () => {
        if (!token) return;
        setLoadingFaculties(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/secretary/faculties?limit=200`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('No se pudieron cargar las facultades');
            }

            const data = await response.json();
            setFaculties(data.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoadingFaculties(false);
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
        void fetchFaculties();
    }, [fetchFaculties]);

    const handleFacultyChange = (event: SelectChangeEvent<string>) => {
        const facultyId = event.target.value;
        setSelectedFacultyId(facultyId);
        setSelectedCourseTypeId('');
        setSelectedCareerId('');
        setSelectedAcademicYear('');
        setCareers([]);
        void fetchCourseTypes(facultyId);
    };

    const handleCourseTypeChange = (event: SelectChangeEvent<string>) => {
        const courseTypeId = event.target.value;
        setSelectedCourseTypeId(courseTypeId);
        setSelectedCareerId('');
        setSelectedAcademicYear('');
        void fetchCareers(selectedFacultyId, courseTypeId);
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
                    subtitle="Visualiza, programa o elimina las convocatorias de exámenes del curso académico."
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
                        <FormControl fullWidth disabled={loadingFaculties}>
                            <InputLabel id="faculty-select-label">Facultad</InputLabel>
                            <Select
                                labelId="faculty-select-label"
                                value={selectedFacultyId}
                                label="Facultad"
                                onChange={handleFacultyChange}
                            >
                                {faculties.map((faculty) => (
                                    <MenuItem key={faculty._id} value={faculty._id}>
                                        {faculty.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth disabled={!selectedFacultyId || loadingCourseTypes}>
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

                        <FormControl fullWidth disabled={!selectedCourseTypeId || loadingCareers}>
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

                        <FormControl fullWidth disabled={!selectedCareerId}>
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

                    {loadingFaculties && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    {!loadingFaculties && (!selectedCareerId || !selectedAcademicYear) && (
                        <Alert severity="info">
                            Selecciona una facultad, un tipo de curso, una carrera y un año académico para visualizar y gestionar el calendario de exámenes.
                        </Alert>
                    )}

                    {!loadingFaculties && selectedCareerId && selectedAcademicYear && (
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
