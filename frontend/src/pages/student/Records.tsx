import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Card,
    CircularProgress,
    Container,
    IconButton,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ExportToPDF, { type ExportTableConfig } from '../../components/common/ExportToPDF';
import ReusableTable, {
    type ReusableTableAction,
    type ReusableTableColumn
} from '../../components/common/ReusableTable';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

interface StudentRecordSummary {
    _id: string;
    subjectId: string;
    subjectName: string;
    academicYear: number;
    attendanceAverage: number | null;
    evaluationAverage: number | null;
}

interface RecordsSummaryResponse {
    data?: StudentRecordSummary[];
    totalCount?: number;
    academicYears?: number[];
    message?: string;
}

const getRowsFromResponse = (response: unknown) => {
    if (!response || typeof response !== 'object') {
        return [];
    }

    const parsed = response as RecordsSummaryResponse;
    return Array.isArray(parsed.data) ? parsed.data : [];
};

const Records: React.FC = () => {
    const navigate = useNavigate();
    const { token, logout, user } = useAuth();
    const [academicYears, setAcademicYears] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchAcademicYears = async () => {
            if (!token) {
                setAcademicYears([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            setInfoMessage(null);

            try {
                const response = await fetch(`${API_BASE}/student/records-summary`, {
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
                    throw new Error('No se pudieron cargar las asignaturas matriculadas');
                }

                const result = await response.json() as RecordsSummaryResponse;
                const years = Array.isArray(result.academicYears)
                    ? result.academicYears
                    : Array.from(new Set(getRowsFromResponse(result).map((item) => item.academicYear))).sort((a, b) => a - b);

                setAcademicYears(years);
                setLoading(false);
            } catch (fetchError) {
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    return;
                }

                setAcademicYears([]);
                setError(fetchError instanceof Error ? fetchError.message : 'Error desconocido');
                setLoading(false);
            }
        };

        void fetchAcademicYears();

        return () => {
            abortController.abort();
        };
    }, [logout, refreshKey, token]);

    const columns = useMemo<ReusableTableColumn<StudentRecordSummary>[]>(() => [
        {
            field: 'subjectName',
            headerName: 'Nombre de la asignatura'
        },
        {
            field: 'attendanceAverage',
            headerName: 'Promedio de asistencias',
            renderCell: (value) => {
                if (value === null || value === undefined) return 'Sin registros';
                return `${Number(value).toFixed(2)}%`;
            }
        },
        {
            field: 'evaluationAverage',
            headerName: 'Promedio de calificaciones',
            renderCell: (value) => {
                if (value === null || value === undefined) return 'Sin registros';
                return Number(value).toFixed(2);
            }
        }
    ], []);

    const actions = useMemo<ReusableTableAction<StudentRecordSummary>[]>(() => [
        {
            variant: 'view',
            label: 'Visualizar',
            onClick: (row) => {
                navigate('/student/subject-records-detail', {
                    state: {
                        subject: row
                    }
                });
            }
        }
    ], [navigate]);

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
    };

    const pdfTables = useMemo<ExportTableConfig<StudentRecordSummary>[]>(() => (
        academicYears.map((academicYear) => ({
            title: `Año académico ${academicYear}`,
            endpoint: '/student/records-summary',
            queryParams: { academicYear },
            columns,
            extractRows: (response) => getRowsFromResponse(response)
        }))
    ), [academicYears, columns]);

    const studentFullName = useMemo(() => {
        const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
        return fullName || 'estudiante';
    }, [user?.firstName, user?.lastName]);

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Asignaturas Matriculadas"
                    subtitle="Consulta tus registros de asistencia y evaluaciones organizados por año académico."
                    showBackButton={true}
                    backTo="/student/dashboard"
                    action={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Tooltip title="Actualizar datos">
                                <IconButton onClick={handleRefresh} color="primary">
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
                            <ExportToPDF
                                token={token}
                                fileName="asignaturas-matriculadas"
                                buttonLabel="Exportar a PDF"
                                logoUrl="/images/uho-blue.png"
                                institutionName="Sistema de Seguimiento Académico"
                                reportSubtitle={`Registros de evaluaciones y asistencias de ${studentFullName}`}
                                onUnauthorized={logout}
                                onError={(message) => setInfoMessage(message)}
                                disabled={loading || pdfTables.length === 0}
                                tables={pdfTables}
                            />
                        </Box>
                    }
                />

                {error && (
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                        {error}
                    </Alert>
                )}

                {infoMessage && (
                    <Alert severity="info" onClose={() => setInfoMessage(null)} sx={{ mb: 3, borderRadius: 2 }}>
                        {infoMessage}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : academicYears.length === 0 ? (
                    <Card elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body1" color="text.secondary">
                            No tienes asignaturas matriculadas con registros disponibles en este momento.
                        </Typography>
                    </Card>
                ) : (
                    <Stack spacing={4}>
                        {academicYears.map((academicYear) => (
                            <Card
                                key={academicYear}
                                elevation={0}
                                sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                            >
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="h6" fontWeight="bold">
                                        Año académico {academicYear}
                                    </Typography>
                                </Box>

                                <ReusableTable<StudentRecordSummary>
                                    endpoint="/student/records-summary"
                                    token={token}
                                    columns={columns}
                                    actions={actions}
                                    rowKey="_id"
                                    refreshKey={refreshKey}
                                    queryParams={{ academicYear }}
                                    tableAriaLabel={`asignaturas matriculadas del año ${academicYear}`}
                                    emptyMessage="No hay asignaturas matriculadas para este año académico."
                                    onUnauthorized={logout}
                                    extractRows={getRowsFromResponse}
                                    extractTotalCount={(response, rows) => {
                                        if (!response || typeof response !== 'object') {
                                            return rows.length;
                                        }

                                        const parsed = response as RecordsSummaryResponse;
                                        return typeof parsed.totalCount === 'number' ? parsed.totalCount : rows.length;
                                    }}
                                />
                            </Card>
                        ))}
                    </Stack>
                )}
            </Container>
        </MainLayout>
    );
};

export default Records;
