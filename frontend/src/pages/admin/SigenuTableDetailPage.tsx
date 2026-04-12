import React, { useState } from 'react';
import {
    Alert,
    Chip,
    IconButton,
    Tooltip
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';
import ReusableTable, { type ReusableTableColumn } from '../../components/common/ReusableTable';

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
}

const tableConfigs: Record<string, TableConfig> = {
    careers: {
        title: 'Carreras',
        apiEndpoint: '/admin/careers',
        columns: [
            { field: 'name', headerName: 'Nombre de la Carrera' },
            { field: 'facultyName', headerName: 'Nombre de la Facultad' },
            { field: 'courseTypeName', headerName: 'Tipo de Curso' }
        ]
    },
    courseTypes: {
        title: 'Tipos de Curso',
        apiEndpoint: '/admin/course-types',
        columns: [
            { field: 'name', headerName: 'Nombre' }
        ]
    },
    evaluations: {
        title: 'Evaluaciones',
        apiEndpoint: '/admin/evaluations',
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
        columns: [
            { field: 'value', headerName: 'Valor' }
        ]
    },
    examinationTypes: {
        title: 'Tipos de Examen',
        apiEndpoint: '/admin/examination-types',
        columns: [
            { field: 'name', headerName: 'Nombre' }
        ]
    },
    faculties: {
        title: 'Facultades',
        apiEndpoint: '/admin/faculties',
        columns: [
            { field: 'name', headerName: 'Nombre de la Facultad' }
        ]
    },
    matriculatedSubjects: {
        title: 'Asignaturas Matriculadas',
        apiEndpoint: '/admin/matriculated-subjects',
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
        columns: [
            { field: 'kind', headerName: 'Tipo' }
        ]
    },
    subjects: {
        title: 'Asignaturas',
        apiEndpoint: '/admin/subjects',
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

    const config = tableConfigs[tableType!];

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
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
                    <Tooltip title="Actualizar datos">
                        <IconButton onClick={handleRefresh} color="primary">
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                }
            />
            <ReusableTable<Record<string, unknown>>
                endpoint={config.apiEndpoint}
                token={token}
                columns={config.columns as ReusableTableColumn<Record<string, unknown>>[]}
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
