import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CircularProgress,
    Container,
    IconButton,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ReusableTable, { type ReusableTableColumn } from '../../components/common/ReusableTable';
import ExportToPDF, { type ExportTableConfig } from '../../components/common/ExportToPDF';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;
const SUBJECT_STORAGE_KEY = 'professorSelectedSubject';

interface SubjectReference {
    _id: string;
    name: string;
    academicYear: number;
    careerId?: {
        _id: string;
        name: string;
    } | string;
}

interface EvaluationHistoryRecord {
    createdAt: string;
    category: string;
    examinationTypeId: string;
    examinationType: string;
    evaluationDate: string;
    description: string;
    evaluationAverage: number;
}

interface EvaluationBatchStudentRow {
    _id: string;
    studentId: string;
    studentName: string;
    evaluationValue: string;
}

interface EvaluationBatchDetail {
    createdAt: string;
    category: string;
    examinationTypeId: string;
    examinationType: string;
    evaluationDate: string;
    description: string;
    evaluationAverage: number;
    subjectName: string;
}

const categoryLabels: Record<string, string> = {
    SYSTEMATIC_EVALUATION: 'Sistemática',
    PARTIAL_EVALUATION: 'Parcial',
    FINAL_EVALUATION: 'Final'
};

const formatDate = (value?: string) => {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
    return parsed.toLocaleDateString();
};

const formatEvaluationValue = (value?: string) => {
    const normalized = (value || '').trim().toUpperCase();
    if (normalized === 'NP') return 'No presentado';
    if (normalized === 'CO') return 'Convalidado';
    return value || '';
};

const RecordsEvaluationView: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { token, logout } = useAuth();
    const [batchDetail, setBatchDetail] = useState<EvaluationBatchDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const routeState = location.state as {
        subject?: SubjectReference;
        evaluationRecord?: EvaluationHistoryRecord;
    } | null;

    const selectedSubject = useMemo(() => {
        if (routeState?.subject) {
            localStorage.setItem(SUBJECT_STORAGE_KEY, JSON.stringify(routeState.subject));
            return routeState.subject;
        }

        const saved = localStorage.getItem(SUBJECT_STORAGE_KEY);
        if (!saved) return null;
        try {
            return JSON.parse(saved) as SubjectReference;
        } catch {
            return null;
        }
    }, [routeState]);

    const initialRecord = routeState?.evaluationRecord || null;

    const columns = useMemo<ReusableTableColumn<EvaluationBatchStudentRow>[]>(() => [
        { field: 'studentName', headerName: 'Estudiante' },
        {
            field: 'evaluationValue',
            headerName: 'Nota',
            renderCell: (value) => formatEvaluationValue(typeof value === 'string' ? value : '')
        }
    ], []);

    const loadBatchDetail = useCallback(async () => {
        if (!token || !selectedSubject?._id || !initialRecord?.createdAt) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                subjectId: selectedSubject._id,
                createdAt: initialRecord.createdAt
            });

            const response = await fetch(`${API_BASE}/professor/evaluation-batch-detail?${params.toString()}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error('No se pudieron cargar los detalles del registro de evaluación');
            }

            const result = await response.json() as { batch?: EvaluationBatchDetail };
            setBatchDetail(result.batch || null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Error al cargar el detalle');
        } finally {
            setLoading(false);
        }
    }, [initialRecord?.createdAt, logout, refreshKey, selectedSubject?._id, token]);

    useEffect(() => {
        void loadBatchDetail();
    }, [loadBatchDetail]);

    const displayedBatch = batchDetail || initialRecord;
    const subjectName = batchDetail?.subjectName || selectedSubject?.name || 'la asignatura';
    const handleRefresh = () => setRefreshKey((prev) => prev + 1);
    const pdfTables = useMemo<ExportTableConfig<EvaluationBatchStudentRow>[]>(() => [
        {
            title: 'Calificaciones por estudiante',
            endpoint: '/professor/evaluation-batch-detail',
            queryParams: selectedSubject && initialRecord
                ? {
                    subjectId: selectedSubject._id,
                    createdAt: initialRecord.createdAt
                }
                : undefined,
            columns,
            extractRows: (response) => {
                if (!response || typeof response !== 'object') return [];
                const parsed = response as { data?: EvaluationBatchStudentRow[] };
                return Array.isArray(parsed.data) ? parsed.data : [];
            }
        }
    ], [columns, initialRecord, selectedSubject]);

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title={`Detalles de registro de evaluación de ${subjectName}`}
                    subtitle={
                        displayedBatch
                            ? `Promedio de evaluación: ${Number(displayedBatch.evaluationAverage || 0).toFixed(2)}`
                            : 'No hay evaluación seleccionada.'
                    }
                    showBackButton={true}
                    backTo="/professor/history-records"
                    action={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Tooltip title="Actualizar datos">
                                <IconButton color="primary" onClick={handleRefresh}>
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
                            <ExportToPDF
                                token={token}
                                tables={pdfTables}
                                disabled={!selectedSubject || !initialRecord}
                                fileName={`Detalle_Evaluacion_${subjectName}`}
                                institutionName="Sistema de Seguimiento Académico"
                                reportSubtitle={`Detalle del registro de evaluación de ${subjectName}`}
                            />
                        </Box>
                    }
                />

                {!selectedSubject || !initialRecord ? (
                    <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                        Debes seleccionar un registro de evaluación desde el historial.
                    </Alert>
                ) : (
                    <Stack spacing={3}>
                        {error && (
                            <Alert severity="error" sx={{ borderRadius: 2 }}>
                                {error}
                            </Alert>
                        )}

                        <Card
                            elevation={0}
                            sx={{
                                p: 3,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'divider'
                            }}
                        >
                            {loading && !displayedBatch ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <Stack spacing={1.5}>
                                    <Typography variant="body1">
                                        <strong>Tipo de evaluación:</strong> {categoryLabels[displayedBatch?.category || ''] || displayedBatch?.category || '—'}
                                    </Typography>
                                    {displayedBatch?.category === 'FINAL_EVALUATION' && (
                                        <Typography variant="body1">
                                            <strong>Tipo de examen:</strong> {displayedBatch.examinationType || '—'}
                                        </Typography>
                                    )}
                                    <Typography variant="body1">
                                        <strong>Fecha:</strong> {formatDate(displayedBatch?.evaluationDate)}
                                    </Typography>
                                    {displayedBatch?.description && (
                                        <Typography variant="body1">
                                            <strong>Descripción:</strong> {displayedBatch.description}
                                        </Typography>
                                    )}
                                </Stack>
                            )}
                        </Card>

                        <Card
                            elevation={0}
                            sx={{
                                p: 3,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'divider'
                            }}
                        >
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="h6" fontWeight="bold">
                                    Calificaciones por estudiante
                                </Typography>
                            </Box>

                            <ReusableTable
                                endpoint="/professor/evaluation-batch-detail"
                                token={token}
                                columns={columns}
                                queryParams={{
                                    subjectId: selectedSubject._id,
                                    createdAt: initialRecord.createdAt
                                }}
                                rowKey="_id"
                                refreshKey={refreshKey}
                                extractRows={(response) => {
                                    if (!response || typeof response !== 'object') return [];
                                    const parsed = response as { data?: EvaluationBatchStudentRow[] };
                                    return Array.isArray(parsed.data) ? parsed.data : [];
                                }}
                                emptyMessage="No hay calificaciones disponibles para este registro."
                            />
                        </Card>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<EditIcon />}
                                onClick={() => navigate('/professor/records-evaluation-edit', {
                                    state: {
                                        subject: selectedSubject,
                                        evaluationRecord: displayedBatch,
                                        returnTo: '/professor/records-evaluation-view',
                                        returnState: {
                                            subject: selectedSubject,
                                            evaluationRecord: displayedBatch
                                        }
                                    }
                                })}
                            >
                                Editar
                            </Button>
                        </Box>
                    </Stack>
                )}

                {(!selectedSubject || !initialRecord) && (
                    <Box sx={{ py: 2 }}>
                        <Button variant="contained" onClick={() => navigate('/professor/history-records')}>
                            Volver al historial
                        </Button>
                    </Box>
                )}
            </Container>
        </MainLayout>
    );
};

export default RecordsEvaluationView;
