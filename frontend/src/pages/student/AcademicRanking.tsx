import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    CircularProgress,
    Container,
    IconButton,
    Tooltip
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ReusableTable, { type ReusableTableColumn } from '../../components/common/ReusableTable';
import ExportToPDF, { type ExportTableConfig } from '../../components/common/ExportToPDF';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

interface StudentAcademicRankingRow {
    _id: string;
    studentId: string;
    studentName: string;
    generalAverage: number | null;
}

interface StudentAcademicRankingCohort {
    careerName: string;
    courseTypeName: string;
    academicYear: number;
}

interface StudentAcademicRankingResponse {
    data?: StudentAcademicRankingRow[];
    totalCount?: number;
    cohort?: StudentAcademicRankingCohort;
    message?: string;
}

const getRowsFromResponse = (response: unknown) => {
    if (!response || typeof response !== 'object') {
        return [];
    }

    const parsed = response as StudentAcademicRankingResponse;
    return Array.isArray(parsed.data) ? parsed.data : [];
};

const StudentAcademicRanking: React.FC = () => {
    const { token, logout, user } = useAuth();
    const [refreshKey, setRefreshKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [cohort, setCohort] = useState<StudentAcademicRankingCohort | null>(null);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchCohort = async () => {
            if (!token) {
                setCohort(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`${API_BASE}/student/academic-ranking?page=0&limit=1`, {
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
                    throw new Error('No se pudo cargar el escalafón académico');
                }

                const result = await response.json() as StudentAcademicRankingResponse;
                setCohort(result.cohort || null);
                setLoading(false);
            } catch (fetchError) {
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    return;
                }

                setCohort(null);
                setError(fetchError instanceof Error ? fetchError.message : 'Error desconocido');
                setLoading(false);
            }
        };

        void fetchCohort();

        return () => {
            abortController.abort();
        };
    }, [logout, refreshKey, token]);

    const columns = useMemo<ReusableTableColumn<StudentAcademicRankingRow>[]>(() => [
        {
            field: 'studentName',
            headerName: 'Nombre del estudiante'
        },
        {
            field: 'generalAverage',
            headerName: 'Promedio general',
            renderCell: (value) => {
                if (value === null || value === undefined) return 'Sin registros';
                return Number(value).toFixed(2);
            }
        }
    ], []);

    const pdfTables = useMemo<ExportTableConfig<StudentAcademicRankingRow>[]>(() => {
        if (!cohort) return [];

        return [
            {
                title: `Escalafón académico de la carrera ${cohort.careerName} | Tipo de curso: ${cohort.courseTypeName} | Año académico: ${cohort.academicYear}`,
                endpoint: '/student/academic-ranking',
                queryParams: {
                    page: 0,
                    limit: 1000
                },
                columns,
                extractRows: (response) => getRowsFromResponse(response)
            }
        ];
    }, [cohort, columns]);

    const studentFullName = useMemo(() => {
        const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
        return fullName || 'estudiante';
    }, [user?.firstName, user?.lastName]);

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Escalafón académico"
                    subtitle={cohort
                        ? `Carrera: ${cohort.careerName} | Tipo de curso: ${cohort.courseTypeName} | Año académico: ${cohort.academicYear}`
                        : 'Consulta tu posición en el ranking de tu grupo.'}
                    showBackButton={true}
                    backTo="/student/dashboard"
                    action={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Tooltip title="Actualizar datos">
                                <IconButton color="primary" onClick={() => setRefreshKey((prev) => prev + 1)}>
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
                            <ExportToPDF
                                token={token}
                                buttonLabel="Exportar a PDF"
                                fileName={`escalafon-academico-${studentFullName}`}
                                logoUrl="/images/uho-blue.png"
                                institutionName="Sistema de Seguimiento Académico"
                                reportSubtitle={cohort
                                    ? `Escalafón del grupo de ${studentFullName} en ${cohort.careerName}, ${cohort.courseTypeName}, año académico ${cohort.academicYear}`
                                    : `Escalafón del grupo de ${studentFullName}`}
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
                ) : (
                    <ReusableTable<StudentAcademicRankingRow>
                        endpoint="/student/academic-ranking"
                        token={token}
                        columns={columns}
                        rowKey="_id"
                        serverPagination={true}
                        refreshKey={refreshKey}
                        tableAriaLabel="tabla de escalafón académico del estudiante"
                        emptyMessage="No hay datos de escalafón académico para tu grupo."
                        onUnauthorized={logout}
                        extractRows={getRowsFromResponse}
                        extractTotalCount={(response, rows) => {
                            if (!response || typeof response !== 'object') {
                                return rows.length;
                            }

                            const parsed = response as StudentAcademicRankingResponse;
                            return typeof parsed.totalCount === 'number' ? parsed.totalCount : rows.length;
                        }}
                    />
                )}
            </Container>
        </MainLayout>
    );
};

export default StudentAcademicRanking;
