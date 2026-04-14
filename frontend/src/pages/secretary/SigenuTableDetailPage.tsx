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

type FilterKey = 'courseTypeId' | 'careerId' | 'academicYear' | 'studentId';

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
        apiEndpoint: '/secretary/careers',
        filters: ['courseTypeId'],
        columns: [
            { field: 'name', headerName: 'Nombre de la Carrera' },
            { field: 'courseTypeName', headerName: 'Tipo de Curso' }
        ]
    },
    courseTypes: {
        title: 'Tipos de Curso',
        apiEndpoint: '/secretary/course-types',
        filters: [],
        columns: [
            { field: 'name', headerName: 'Nombre' }
        ]
    },
    evaluations: {
        title: 'Evaluaciones',
        apiEndpoint: '/secretary/evaluations',
        filters: ['courseTypeId', 'careerId', 'academicYear', 'studentId'],
        columns: [
            { field: 'studentName', headerName: 'Nombre del Estudiante' },
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
        apiEndpoint: '/secretary/evaluation-values',
        filters: [],
        columns: [
            { field: 'value', headerName: 'Valor' }
        ]
    },
    examinationTypes: {
        title: 'Tipos de Examen',
        apiEndpoint: '/secretary/examination-types',
        filters: [],
        columns: [
            { field: 'name', headerName: 'Nombre' }
        ]
    },
    matriculatedSubjects: {
        title: 'Asignaturas Matriculadas',
        apiEndpoint: '/secretary/matriculated-subjects',
        filters: ['courseTypeId', 'careerId', 'academicYear', 'studentId'],
        columns: [
            { field: 'studentName', headerName: 'Nombre del Estudiante' },
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
        apiEndpoint: '/secretary/students',
        filters: ['courseTypeId', 'careerId', 'academicYear'],
        columns: [
            { field: 'firstName', headerName: 'Nombres' },
            { field: 'lastName', headerName: 'Apellidos' },
            { field: 'identification', headerName: 'Identificación' },
            { field: 'email', headerName: 'Email' },
            { field: 'courseTypeName', headerName: 'Tipo de Curso' },
            { field: 'careerName', headerName: 'Carrera' },
            { field: 'academicYear', headerName: 'Año Académico' },
            { field: 'studentStatusType', headerName: 'Estado del Estudiante' }
        ]
    },
    studentStatuses: {
        title: 'Estados de Estudiante',
        apiEndpoint: '/secretary/student-statuses',
        filters: [],
        columns: [
            { field: 'kind', headerName: 'Tipo' }
        ]
    },
    subjects: {
        title: 'Asignaturas',
        apiEndpoint: '/secretary/subjects',
        filters: ['courseTypeId', 'careerId', 'academicYear'],
        columns: [
            { field: 'name', headerName: 'Nombre de la Asignatura' },
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
    const [courseTypes, setCourseTypes] = useState<CourseTypeOption[]>([]);
    const [careers, setCareers] = useState<CareerOption[]>([]);
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [filterError, setFilterError] = useState<string | null>(null);
    const [selectedCourseTypeId, setSelectedCourseTypeId] = useState('');
    const [selectedCareerId, setSelectedCareerId] = useState('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');

    const config = tableConfigs[tableType!];
    const activeFilters = config?.filters || [];
    const needsCourseType = activeFilters.includes('courseTypeId');
    const needsCareer = activeFilters.includes('careerId');
    const needsAcademicYear = activeFilters.includes('academicYear');
    const needsStudent = activeFilters.includes('studentId');
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
        setSelectedCourseTypeId('');
        setSelectedCareerId('');
        setSelectedAcademicYear('');
        setSelectedStudentId('');
        setCareers([]);
        setStudents([]);
        setFilterError(null);
    }, [tableType]);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchCourseTypes = async () => {
            if (!token || !needsCourseType) {
                setCourseTypes([]);
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/secretary/course-types?limit=200`, {
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
    }, [logout, needsCourseType, token]);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchCareers = async () => {
            if (!token || !needsCareer || !selectedCourseTypeId) {
                setCareers([]);
                return;
            }

            try {
                const params = new URLSearchParams({
                    courseTypeId: selectedCourseTypeId,
                    limit: '200'
                });

                const response = await fetch(`${API_BASE}/secretary/careers?${params.toString()}`, {
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
    }, [logout, needsCareer, selectedCourseTypeId, token]);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchStudents = async () => {
            if (!token || !needsStudent || !selectedCourseTypeId || !selectedCareerId || !selectedAcademicYear) {
                setStudents([]);
                return;
            }

            try {
                const params = new URLSearchParams({
                    courseTypeId: selectedCourseTypeId,
                    careerId: selectedCareerId,
                    academicYear: selectedAcademicYear,
                    limit: '200'
                });

                const response = await fetch(`${API_BASE}/secretary/students?${params.toString()}`, {
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
    }, [logout, needsStudent, selectedAcademicYear, selectedCareerId, selectedCourseTypeId, token]);

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
            courseTypeId: needsCourseType ? selectedCourseTypeId : undefined,
            careerId: needsCareer ? selectedCareerId : undefined,
            academicYear: needsAcademicYear ? selectedAcademicYear : undefined,
            studentId: needsStudent ? selectedStudentId : undefined
        }),
        [
            needsAcademicYear,
            needsCareer,
            needsCourseType,
            needsStudent,
            selectedAcademicYear,
            selectedCareerId,
            selectedCourseTypeId,
            selectedStudentId
        ]
    );
    const exportSubtitle = useMemo(() => {
        const subtitleParts: string[] = [];

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
            return `Reporte de ${config.title}`;
        }

        return `${config.title} - ${subtitleParts.join(' | ')}`;
    }, [
        config.title,
        needsAcademicYear,
        needsCareer,
        needsCourseType,
        needsStudent,
        selectedAcademicYear,
        selectedCareer,
        selectedCourseType,
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

        return `reporte-${config.title.toLowerCase().replace(/\s+/g, '-')}${suffix ? `-${suffix}` : ''}`;
    }, [config.title, exportSubtitle]);

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
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
                            institutionName="Sistema de Seguimiento Académico"
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
                        {needsCourseType && (
                            <FormControl fullWidth>
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
                            <FormControl fullWidth disabled={!selectedCourseTypeId}>
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
                            <FormControl fullWidth disabled={needsCareer && !selectedCareerId}>
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
