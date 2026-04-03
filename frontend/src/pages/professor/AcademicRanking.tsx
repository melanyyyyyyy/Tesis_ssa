import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Container, IconButton, Tooltip } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ReusableTable, { type ReusableTableColumn } from '../../components/common/ReusableTable';
import { useAuth } from '../../context/AuthContext';
import ExportToPDF from '../../components/common/ExportToPDF';

interface SubjectReference {
    _id: string;
    name: string;
    academicYear: number;
    careerId?: {
        _id: string;
        name: string;
    } | string;
}

interface AcademicRankingRow {
    _id: string;
    studentId: string;
    studentName: string;
    subjectEvaluationAverage: number;
    generalAverage: number;
}

const SUBJECT_STORAGE_KEY = 'professorSelectedSubject';

const AcademicRanking: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { token, logout } = useAuth();
    const [refreshKey, setRefreshKey] = useState(0);

    const selectedSubject = useMemo(() => {
        const state = location.state as { subject?: SubjectReference } | null;
        if (state?.subject) {
            localStorage.setItem(SUBJECT_STORAGE_KEY, JSON.stringify(state.subject));
            return state.subject;
        }
        const saved = localStorage.getItem(SUBJECT_STORAGE_KEY);
        if (!saved) return null;
        try {
            return JSON.parse(saved) as SubjectReference;
        } catch {
            return null;
        }
    }, [location.state]);

    const subjectCareerName = useMemo(() => {
        if (!selectedSubject?.careerId) return 'Sin carrera';
        if (typeof selectedSubject.careerId === 'string') return selectedSubject.careerId;
        return selectedSubject.careerId.name || 'Sin carrera';
    }, [selectedSubject]);

    const columns = useMemo<ReusableTableColumn<AcademicRankingRow>[]>(() => [
        { field: 'studentName', headerName: 'Nombre del estudiante' },
        {
            field: 'subjectEvaluationAverage',
            headerName: `Promedio de evaluación en ${selectedSubject?.name || 'la asignatura'}`,
            renderCell: (value) => {
                const numericValue = Number(value || 0);
                return numericValue.toFixed(2);
            }
        },
        {
            field: 'generalAverage',
            headerName: 'Promedio general',
            renderCell: (value) => {
                const numericValue = Number(value || 0);
                return numericValue.toFixed(2);
            }
        }
    ], [selectedSubject?.name]);

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Escalafón académico"
                    subtitle={selectedSubject
                        ? `Carrera: ${subjectCareerName} | Año académico: ${selectedSubject.academicYear} | Asignatura: ${selectedSubject.name}`
                        : 'No hay asignatura seleccionada.'}
                    showBackButton={true}
                    backTo="/professor/subject-detail"
                    action={selectedSubject ? (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Tooltip title="Actualizar datos">
                                <IconButton color="primary" onClick={() => setRefreshKey((prev) => prev + 1)}>
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
                            <ExportToPDF
                                token={token}
                                buttonLabel="Exportar a PDF"
                                fileName={`escalafon-academico-${selectedSubject.name}`}
                                logoUrl="/images/uho-blue.png"
                                onUnauthorized={logout}
                                tables={[
                                    {
                                        title: `Escalafón académico de la carrera ${subjectCareerName} | Año académico: ${selectedSubject.academicYear}`,
                                        endpoint: '/professor/academic-ranking',
                                        queryParams: {
                                            subjectId: selectedSubject._id,
                                            page: 0,
                                            limit: 1000
                                        },
                                        columns
                                    }
                                ]}
                            />
                        </Box>
                    ) : undefined}
                />

                {!selectedSubject ? (
                    <>
                        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                            Debes seleccionar una asignatura para ver el escalafón académico.
                        </Alert>
                        <Box sx={{ py: 2 }}>
                            <Button variant="contained" onClick={() => navigate('/professor/dashboard')}>
                                Volver al panel
                            </Button>
                        </Box>
                    </>
                ) : (
                    <ReusableTable<AcademicRankingRow>
                        endpoint="/professor/academic-ranking"
                        token={token}
                        columns={columns}
                        rowKey="_id"
                        serverPagination={true}
                        refreshKey={refreshKey}
                        queryParams={{ subjectId: selectedSubject._id }}
                        tableAriaLabel="tabla de escalafón académico"
                        emptyMessage="No hay datos de escalafón para esta asignatura."
                        onUnauthorized={logout}
                        extractRows={(response) => {
                            if (Array.isArray(response)) return response as AcademicRankingRow[];
                            if (!response || typeof response !== 'object') return [];
                            const parsed = response as Record<string, unknown>;
                            if (Array.isArray(parsed.data)) return parsed.data as AcademicRankingRow[];
                            if (Array.isArray(parsed.items)) return parsed.items as AcademicRankingRow[];
                            return [];
                        }}
                        extractTotalCount={(response, rows) => {
                            if (!response || typeof response !== 'object') return rows.length;
                            const parsed = response as Record<string, unknown>;
                            return typeof parsed.totalCount === 'number' ? parsed.totalCount : rows.length;
                        }}
                    />
                )}
            </Container>
        </MainLayout>
    );
};

export default AcademicRanking;
