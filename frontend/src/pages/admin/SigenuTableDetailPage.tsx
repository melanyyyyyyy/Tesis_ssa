import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Chip,
    IconButton,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Tooltip,
    Typography,
    Divider,
    type SelectChangeEvent
} from '@mui/material';
import { Refresh as RefreshIcon, FilterList as FilterIcon } from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';
import ReusableTable, { type ReusableTableColumn } from '../../components/common/ReusableTable';
import ExportToPDF from '../../components/common/ExportToPDF';

const API_BASE = import.meta.env.VITE_API_BASE;
const ACADEMIC_YEAR_OPTIONS = ['1', '2', '3', '4', '5', '6'];

type FilterKey = 'facultyId' | 'courseTypeId' | 'careerId' | 'academicYear' | 'studentId';

interface TableColumn {
    field: string;
    headerName: string;
    width?: number;
    renderCell?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface TableConfig {
    title: string;
    columns: TableColumn[];
    apiEndpoint: string;
    filters: FilterKey[];
}

interface FacultyOption {
    _id: string;
    name: string;
}

interface CourseTypeOption {
    _id: string;
    name: string;
}

interface CareerOption {
    _id: string;
    name: string;
}

interface StudentOption {
    _id: string;
    firstName: string;
    lastName: string;
}

const tableConfigs: Record<string, TableConfig> = {
    careers: {
        title: 'Carreras',
        apiEndpoint: '/admin/careers',
        filters: ['facultyId', 'courseTypeId'],
        columns: [
            { field: 'name', headerName: 'Nombre de la Carrera' },
            { field: 'facultyName', headerName: 'Nombre de la Facultad' },
            { field: 'courseTypeName', headerName: 'Tipo de Curso' }
        ]
    },
    courseTypes: {
        title: 'Tipos de Curso',
        apiEndpoint: '/admin/course-types',
        filters: [],
        columns: [
            { field: 'name', headerName: 'Nombre' }
        ]
    },
    evaluations: {
        title: 'Evaluaciones',
        apiEndpoint: '/admin/evaluations',
        filters: ['facultyId', 'courseTypeId', 'careerId', 'academicYear', 'studentId'],
        columns: [
            { field: 'studentName', headerName: 'Nombre del Estudiante' },
            { field: 'facultyName', headerName: 'Facultad' },
            { field: 'courseTypeName', headerName: 'Tipo de Curso' },
            { field: 'careerName', headerName: 'Carrera' },
            { field: 'academicYear', headerName: 'Año Académico' },
            { field: 'matriculatedSubjectName', headerName: 'Asignatura Matriculada' },
            { field: 'evaluationValue', headerName: 'Valor de la Evaluación' },
            { field: 'examinationTypeName', headerName: 'Tipo de Examen' },
            { 
                field: 'evaluationDate', 
                headerName: 'Fecha de Evaluación',
                renderCell: (value: unknown) => new Date(value as string).toLocaleDateString()
            },
            { 
                field: 'registrationDate', 
                headerName: 'Fecha de Registro',
                renderCell: (value: unknown) => new Date(value as string).toLocaleDateString()
            }
        ]
    },
    evaluationValues: {
        title: 'Valores de Evaluación',
        apiEndpoint: '/admin/evaluation-values',
        filters: [],
        columns: [
            { field: 'value', headerName: 'Valor' }
        ]
    },
    examinationTypes: {
        title: 'Tipos de Examen',
        apiEndpoint: '/admin/examination-types',
        filters: [],
        columns: [
            { field: 'name', headerName: 'Nombre' }
        ]
    },
    faculties: {
        title: 'Facultades',
        apiEndpoint: '/admin/faculties',
        filters: [],
        columns: [
            { field: 'name', headerName: 'Nombre de la Facultad' }
        ]
    },
    matriculatedSubjects: {
        title: 'Asignaturas Matriculadas',
        apiEndpoint: '/admin/matriculated-subjects',
        filters: ['facultyId', 'courseTypeId', 'careerId', 'academicYear', 'studentId'],
        columns: [
            { field: 'studentName', headerName: 'Nombre del Estudiante' },
            { field: 'facultyName', headerName: 'Facultad' },
            { field: 'courseTypeName', headerName: 'Tipo de Curso' },
            { field: 'careerName', headerName: 'Carrera' },
            { field: 'academicYear', headerName: 'Año Académico' },
            { field: 'subjectName', headerName: 'Nombre de la Asignatura' },
            { 
                field: 'evaluated', 
                headerName: 'Evaluada',
                renderCell: (value) => (
                    <Chip 
                        label={value ? 'Sí' : 'No'} 
                        color={value ? 'success' : 'default'}
                        size="small"
                    />
                )
            },
            { field: 'evaluation', headerName: 'Evaluación' }
        ]
    },
    students: {
        title: 'Estudiantes',
        apiEndpoint: '/admin/students',
        filters: ['facultyId', 'courseTypeId', 'careerId', 'academicYear'],
        columns: [
            { field: 'firstName', headerName: 'Nombres' },
            { field: 'lastName', headerName: 'Apellidos' },
            { field: 'identification', headerName: 'Identificación' },
            { field: 'email', headerName: 'Email' },
            { field: 'facultyName', headerName: 'Facultad' },
            { field: 'courseTypeName', headerName: 'Tipo de Curso' },
            { field: 'careerName', headerName: 'Carrera' },
            { field: 'academicYear', headerName: 'Año Académico' },
            { field: 'studentStatusType', headerName: 'Estado del Estudiante' }
        ]
    },
    studentStatuses: {
        title: 'Estados de Estudiante',
        apiEndpoint: '/admin/student-statuses',
        filters: [],
        columns: [
            { field: 'kind', headerName: 'Tipo' }
        ]
    },
    subjects: {
        title: 'Asignaturas',
        apiEndpoint: '/admin/subjects',
        filters: ['facultyId', 'courseTypeId', 'careerId', 'academicYear'],
        columns: [
            { field: 'name', headerName: 'Nombre de la Asignatura' },
            { field: 'facultyName', headerName: 'Facultad' },
            { field: 'courseTypeName', headerName: 'Tipo de Curso' },
            { field: 'careerName', headerName: 'Carrera' },
            { field: 'academicYear', headerName: 'Año Académico' }
        ]
    }
};

const SigenuTableDetailPage: React.FC = () => {
    const { tableType } = useParams<{ tableType: string }>();
    const { token, logout } = useAuth();
    const [totalCount, setTotalCount] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [faculties, setFaculties] = useState<FacultyOption[]>([]);
    const [courseTypes, setCourseTypes] = useState<CourseTypeOption[]>([]);
    const [careers, setCareers] = useState<CareerOption[]>([]);
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [filterError, setFilterError] = useState<string | null>(null);
    const [selectedFacultyId, setSelectedFacultyId] = useState('');
    const [selectedCourseTypeId, setSelectedCourseTypeId] = useState('');
    const [selectedCareerId, setSelectedCareerId] = useState('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');

    const config = tableConfigs[tableType!];
    const activeFilters = config?.filters || [];
    const needsFaculty = activeFilters.includes('facultyId');
    const needsCourseType = activeFilters.includes('courseTypeId');
    const needsCareer = activeFilters.includes('careerId');
    const needsAcademicYear = activeFilters.includes('academicYear');
    const needsStudent = activeFilters.includes('studentId');
    const selectedFaculty = useMemo(
        () => faculties.find((faculty) => faculty._id === selectedFacultyId) || null,
        [faculties, selectedFacultyId]
    );
    const selectedCourseType = useMemo(
        () => courseTypes.find((courseType) => courseType._id === selectedCourseTypeId) || null,
        [courseTypes, selectedCourseTypeId]
    );
    const selectedCareer = useMemo(
        () => careers.find((career) => career._id === selectedCareerId) || null,
        [careers, selectedCareerId]
    );
    const selectedStudent = useMemo(
        () => students.find((student) => student._id === selectedStudentId) || null,
        [selectedStudentId, students]
    );

    useEffect(() => {
        setSelectedFacultyId('');
        setSelectedCourseTypeId('');
        setSelectedCareerId('');
        setSelectedAcademicYear('');
        setSelectedStudentId('');
        setCourseTypes([]);
        setCareers([]);
        setStudents([]);
        setFilterError(null);
    }, [tableType]);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchFaculties = async () => {
            if (!token || !needsFaculty) {
                setFaculties([]);
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/admin/faculties?limit=200`, {
                    signal: abortController.signal,
                    headers: {
                        Authorization: `Bearer ${token}`
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
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }
                setFilterError(error instanceof Error ? error.message : 'Error desconocido');
            }
        };

        void fetchFaculties();
        return () => {
            abortController.abort();
        };
    }, [logout, needsFaculty, token]);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchCourseTypes = async () => {
            if (!token || !needsCourseType) {
                setCourseTypes([]);
                return;
            }

            if (needsFaculty && !selectedFacultyId) {
                setCourseTypes([]);
                return;
            }

            try {
                const params = new URLSearchParams({ limit: '200' });
                if (needsFaculty && selectedFacultyId) {
                    params.set('facultyId', selectedFacultyId);
                }

                const response = await fetch(`${API_BASE}/admin/course-types?${params.toString()}`, {
                    signal: abortController.signal,
                    headers: {
                        Authorization: `Bearer ${token}`
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
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }
                setFilterError(error instanceof Error ? error.message : 'Error desconocido');
            }
        };

        void fetchCourseTypes();
        return () => {
            abortController.abort();
        };
    }, [logout, needsCourseType, needsFaculty, selectedFacultyId, token]);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchCareers = async () => {
            if (!token || !needsCareer) {
                setCareers([]);
                return;
            }

            if (needsFaculty && !selectedFacultyId) {
                setCareers([]);
                return;
            }

            try {
                const params = new URLSearchParams({ limit: '200' });
                if (needsFaculty && selectedFacultyId) {
                    params.set('facultyId', selectedFacultyId);
                }
                if (needsCourseType && selectedCourseTypeId) {
                    params.set('courseTypeId', selectedCourseTypeId);
                }

                const response = await fetch(`${API_BASE}/admin/careers?${params.toString()}`, {
                    signal: abortController.signal,
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    logout();
                    return;
                }

                if (!response.ok) {
                    throw new Error('No se pudieron cargar las carreras');
                }

                const result = await response.json() as { data?: CareerOption[] };
                setCareers(Array.isArray(result.data) ? result.data : []);
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }
                setFilterError(error instanceof Error ? error.message : 'Error desconocido');
            }
        };

        void fetchCareers();
        return () => {
            abortController.abort();
        };
    }, [logout, needsCareer, needsCourseType, needsFaculty, selectedCourseTypeId, selectedFacultyId, token]);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchStudents = async () => {
            if (!token || !needsStudent) {
                setStudents([]);
                return;
            }

            if ((needsFaculty && !selectedFacultyId) || !selectedAcademicYear) {
                setStudents([]);
                return;
            }

            try {
                const params = new URLSearchParams({
                    academicYear: selectedAcademicYear,
                    limit: '200'
                });

                if (needsFaculty && selectedFacultyId) {
                    params.set('facultyId', selectedFacultyId);
                }
                if (needsCourseType && selectedCourseTypeId) {
                    params.set('courseTypeId', selectedCourseTypeId);
                }
                if (needsCareer && selectedCareerId) {
                    params.set('careerId', selectedCareerId);
                }

                const response = await fetch(`${API_BASE}/admin/students?${params.toString()}`, {
                    signal: abortController.signal,
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    logout();
                    return;
                }

                if (!response.ok) {
                    throw new Error('No se pudieron cargar los estudiantes');
                }

                const result = await response.json() as { data?: StudentOption[] };
                setStudents(Array.isArray(result.data) ? result.data : []);
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }
                setFilterError(error instanceof Error ? error.message : 'Error desconocido');
            }
        };

        void fetchStudents();
        return () => {
            abortController.abort();
        };
    }, [
        logout,
        needsStudent,
        needsCareer,
        needsCourseType,
        needsFaculty,
        selectedAcademicYear,
        selectedCareerId,
        selectedCourseTypeId,
        selectedFacultyId,
        token
    ]);

    useEffect(() => {
        if (!selectedCourseTypeId) {
            return;
        }

        const courseTypeExists = courseTypes.some((courseType) => courseType._id === selectedCourseTypeId);
        if (!courseTypeExists) {
            setSelectedCourseTypeId('');
            setSelectedCareerId('');
            setSelectedAcademicYear('');
            setSelectedStudentId('');
        }
    }, [courseTypes, selectedCourseTypeId]);

    useEffect(() => {
        if (!selectedCareerId) {
            return;
        }

        const careerExists = careers.some((career) => career._id === selectedCareerId);
        if (!careerExists) {
            setSelectedCareerId('');
            setSelectedAcademicYear('');
            setSelectedStudentId('');
        }
    }, [careers, selectedCareerId]);

    useEffect(() => {
        if (!selectedStudentId) {
            return;
        }

        const studentExists = students.some((student) => student._id === selectedStudentId);
        if (!studentExists) {
            setSelectedStudentId('');
        }
    }, [selectedStudentId, students]);

    const queryParams = useMemo(
        () => ({
            facultyId: needsFaculty ? selectedFacultyId : undefined,
            courseTypeId: needsCourseType ? selectedCourseTypeId : undefined,
            careerId: needsCareer ? selectedCareerId : undefined,
            academicYear: needsAcademicYear ? selectedAcademicYear : undefined,
            studentId: needsStudent ? selectedStudentId : undefined
        }),
        [
            needsAcademicYear,
            needsCareer,
            needsCourseType,
            needsFaculty,
            needsStudent,
            selectedAcademicYear,
            selectedCareerId,
            selectedCourseTypeId,
            selectedFacultyId,
            selectedStudentId
        ]
    );
    const exportSubtitle = useMemo(() => {
        const subtitleParts: string[] = [];

        if (needsFaculty && selectedFaculty?.name) {
            subtitleParts.push(`Facultad: ${selectedFaculty.name}`);
        }
        if (needsCourseType && selectedCourseType?.name) {
            subtitleParts.push(`Tipo de curso: ${selectedCourseType.name}`);
        }
        if (needsCareer && selectedCareer?.name) {
            subtitleParts.push(`Carrera: ${selectedCareer.name}`);
        }
        if (needsAcademicYear && selectedAcademicYear) {
            subtitleParts.push(`Año académico: ${selectedAcademicYear}`);
        }
        if (needsStudent && selectedStudent) {
            subtitleParts.push(`Estudiante: ${`${selectedStudent.firstName} ${selectedStudent.lastName}`.trim()}`);
        }

        if (subtitleParts.length === 0) {
            return `Reporte de ${config?.title || 'tabla'}`;
        }

        return `${config?.title || 'Tabla'} - ${subtitleParts.join(' | ')}`;
    }, [
        config?.title,
        needsAcademicYear,
        needsCareer,
        needsCourseType,
        needsFaculty,
        needsStudent,
        selectedAcademicYear,
        selectedCareer,
        selectedCourseType,
        selectedFaculty,
        selectedStudent
    ]);
    const exportFileName = useMemo(() => {
        const suffix = exportSubtitle
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80);

        return `reporte-${(config?.title || 'tabla').toLowerCase().replace(/\s+/g, '-')}${suffix ? `-${suffix}` : ''}`;
    }, [config?.title, exportSubtitle]);

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
    };

    const handleFacultyChange = (event: SelectChangeEvent<string>) => {
        setSelectedFacultyId(event.target.value);
        setSelectedCourseTypeId('');
        setSelectedCareerId('');
        setSelectedAcademicYear('');
        setSelectedStudentId('');
        setFilterError(null);
    };

    const handleCourseTypeChange = (event: SelectChangeEvent<string>) => {
        setSelectedCourseTypeId(event.target.value);
        setSelectedCareerId('');
        setSelectedAcademicYear('');
        setSelectedStudentId('');
        setFilterError(null);
    };

    const handleCareerChange = (event: SelectChangeEvent<string>) => {
        setSelectedCareerId(event.target.value);
        setSelectedAcademicYear('');
        setSelectedStudentId('');
        setFilterError(null);
    };

    const handleAcademicYearChange = (event: SelectChangeEvent<string>) => {
        setSelectedAcademicYear(event.target.value);
        setSelectedStudentId('');
        setFilterError(null);
    };

    const handleStudentChange = (event: SelectChangeEvent<string>) => {
        setSelectedStudentId(event.target.value);
        setFilterError(null);
    };

    if (!config) {
        return (
            <MainLayout>
                <Alert severity="error" sx={{ m: 4 }}>
                    Tipo de tabla no válido: {tableType}
                </Alert>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <PageHeader 
                title={config.title}
                subtitle={`Total de registros: ${totalCount}`}
                showBackButton={true}
                action={
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip title="Actualizar datos">
                            <IconButton onClick={handleRefresh} color="primary">
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                        <ExportToPDF
                            token={token}
                            fileName={exportFileName}
                            buttonLabel="Exportar a PDF"
                            logoUrl="/images/uho-blue.png"
                            institutionName="Sistema de Seguimiento Academico"
                            reportSubtitle={exportSubtitle}
                            onUnauthorized={logout}
                            onError={(message) => setFilterError(message)}
                            tables={[
                                {
                                    title: config.title,
                                    endpoint: config.apiEndpoint,
                                    queryParams: {
                                        ...queryParams,
                                        page: 0,
                                        limit: 1000
                                    },
                                    columns: config.columns as ReusableTableColumn<Record<string, unknown>>[],
                                    extractRows: (response) => {
                                        if (Array.isArray(response)) {
                                            return response as Record<string, unknown>[];
                                        }
                                        if (!response || typeof response !== 'object') {
                                            return [];
                                        }
                                        const parsed = response as Record<string, unknown>;
                                        if (Array.isArray(parsed.data)) {
                                            return parsed.data as Record<string, unknown>[];
                                        }
                                        if (Array.isArray(parsed.items)) {
                                            return parsed.items as Record<string, unknown>[];
                                        }
                                        return [];
                                    }
                                }
                            ]}
                        />
                    </Stack>
                }
            />
            {activeFilters.length > 0 && (
                <Paper elevation={0} sx={{ mb: 3, p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <FilterIcon color="primary" fontSize="small" />
                        <Typography variant="h6" fontWeight="600" color="primary">
                            Filtros
                        </Typography>
                    </Stack>
                    <Divider sx={{ mb: 3 }} />
                    {filterError && <Alert severity="error" sx={{ mb: 2 }}>{filterError}</Alert>}
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        {needsFaculty && (
                            <FormControl fullWidth>
                                <InputLabel id="faculty-filter-label">Facultad</InputLabel>
                                <Select
                                    labelId="faculty-filter-label"
                                    value={selectedFacultyId}
                                    label="Facultad"
                                    onChange={handleFacultyChange}
                                >
                                    <MenuItem value="">
                                        <em>Selecciona una facultad</em>
                                    </MenuItem>
                                    {faculties.map((faculty) => (
                                        <MenuItem key={faculty._id} value={faculty._id}>
                                            {faculty.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {needsCourseType && (
                            <FormControl fullWidth disabled={needsFaculty && !selectedFacultyId}>
                                <InputLabel id="course-type-filter-label">Tipo de curso</InputLabel>
                                <Select
                                    labelId="course-type-filter-label"
                                    value={selectedCourseTypeId}
                                    label="Tipo de curso"
                                    onChange={handleCourseTypeChange}
                                >
                                    <MenuItem value="">
                                        <em>Selecciona un tipo de curso</em>
                                    </MenuItem>
                                    {courseTypes.map((courseType) => (
                                        <MenuItem key={courseType._id} value={courseType._id}>
                                            {courseType.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {needsCareer && (
                            <FormControl
                                fullWidth
                                disabled={(needsFaculty && !selectedFacultyId) || (needsCourseType && !selectedCourseTypeId)}
                            >
                                <InputLabel id="career-filter-label">Carrera</InputLabel>
                                <Select
                                    labelId="career-filter-label"
                                    value={selectedCareerId}
                                    label="Carrera"
                                    onChange={handleCareerChange}
                                >
                                    <MenuItem value="">
                                        <em>Selecciona una carrera</em>
                                    </MenuItem>
                                    {careers.map((career) => (
                                        <MenuItem key={career._id} value={career._id}>
                                            {career.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {needsAcademicYear && (
                            <FormControl
                                fullWidth
                                disabled={
                                    (needsFaculty && !selectedFacultyId) ||
                                    (needsCourseType && !selectedCourseTypeId) ||
                                    (needsCareer && !selectedCareerId)
                                }
                            >
                                <InputLabel id="academic-year-filter-label">Año académico</InputLabel>
                                <Select
                                    labelId="academic-year-filter-label"
                                    value={selectedAcademicYear}
                                    label="Año académico"
                                    onChange={handleAcademicYearChange}
                                >
                                    <MenuItem value="">
                                        <em>Selecciona un año</em>
                                    </MenuItem>
                                    {ACADEMIC_YEAR_OPTIONS.map((year) => (
                                        <MenuItem key={year} value={year}>
                                            {year}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {needsStudent && (
                            <FormControl fullWidth disabled={!selectedAcademicYear}>
                                <InputLabel id="student-filter-label">Estudiante</InputLabel>
                                <Select
                                    labelId="student-filter-label"
                                    value={selectedStudentId}
                                    label="Estudiante"
                                    onChange={handleStudentChange}
                                >
                                    <MenuItem value="">
                                        <em>Selecciona un estudiante</em>
                                    </MenuItem>
                                    {students.map((student) => (
                                        <MenuItem key={student._id} value={student._id}>
                                            {`${student.firstName} ${student.lastName}`.trim()}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Stack>
                </Paper>
            )}
            <ReusableTable<Record<string, unknown>>
                endpoint={config.apiEndpoint}
                token={token}
                columns={config.columns as ReusableTableColumn<Record<string, unknown>>[]}
                queryParams={queryParams}
                serverPagination={true}
                refreshKey={refreshKey}
                tableAriaLabel="detail table"
                onTotalCountChange={setTotalCount}
                onUnauthorized={logout}
                extractRows={(response) => {
                    if (Array.isArray(response)) {
                        return response as Record<string, unknown>[];
                    }
                    if (!response || typeof response !== 'object') {
                        return [];
                    }
                    const parsed = response as Record<string, unknown>;
                    if (Array.isArray(parsed.data)) {
                        return parsed.data as Record<string, unknown>[];
                    }
                    if (Array.isArray(parsed.items)) {
                        return parsed.items as Record<string, unknown>[];
                    }
                    return [];
                }}
                extractTotalCount={(response, rows) => {
                    if (!response || typeof response !== 'object') {
                        return rows.length;
                    }
                    const parsed = response as Record<string, unknown>;
                    return typeof parsed.totalCount === 'number' ? parsed.totalCount : rows.length;
                }}
            />
        </MainLayout>
    );
};

export default SigenuTableDetailPage;
