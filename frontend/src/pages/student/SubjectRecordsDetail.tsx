import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Card,
    Container,
    Divider,
    IconButton,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ExportToPDF, { type ExportTableConfig } from '../../components/common/ExportToPDF';
import ReusableTable, { type ReusableTableColumn } from '../../components/common/ReusableTable';
import { useAuth } from '../../context/AuthContext';

interface StudentSubjectRecordSummary {
    _id: string;
    subjectId: string;
    subjectName: string;
    academicYear: number;
    attendanceAverage: number | null;
    evaluationAverage: number | null;
}

interface SubjectRecordsDetailState {
    subject: StudentSubjectRecordSummary;
}

interface EvaluationTypeRef {
    _id: string;
    name: string;
}

interface EvaluationValueRef {
    _id: string;
    value: string;
}

interface EvaluationRecord {
    _id: string;
    recordKey: string;
    source: 'evaluationScore' | 'evaluation';
    isReadOnly: boolean;
    category: string;
    examinationTypeId?: EvaluationTypeRef | null;
    evaluationDate: string;
    description?: string;
    evaluationValueId?: EvaluationValueRef | null;
}

interface AttendanceRecord {
    _id: string;
    attendanceDate: string;
    isPresent?: boolean;
    justified?: boolean;
    justificationReason?: string;
}

const DETAIL_STORAGE_KEY = 'studentSelectedSubjectRecordsDetail';
const API_BASE = import.meta.env.VITE_API_BASE;

const SubjectRecordsDetail: React.FC = () => {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { token, logout, user } = useAuth();
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [detail, setDetail] = useState<SubjectRecordsDetailState | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(true);
    const [detailError, setDetailError] = useState<string | null>(null);
    const subjectIdParam = searchParams.get('subjectId')?.trim() || '';

    useEffect(() => {
        const state = location.state as SubjectRecordsDetailState | null;
        let isMounted = true;

        const readSavedDetail = (): SubjectRecordsDetailState | null => {
            const saved = localStorage.getItem(DETAIL_STORAGE_KEY);
            if (!saved) return null;

            try {
                return JSON.parse(saved) as SubjectRecordsDetailState;
            } catch {
                localStorage.removeItem(DETAIL_STORAGE_KEY);
                return null;
            }
        };

        const loadDetail = async () => {
            setIsLoadingDetail(true);
            setDetailError(null);

            if (state?.subject) {
                localStorage.setItem(DETAIL_STORAGE_KEY, JSON.stringify(state));
                if (isMounted) {
                    setDetail(state);
                    setIsLoadingDetail(false);
                }
                return;
            }

            const savedDetail = readSavedDetail();

            if (subjectIdParam) {
                if (savedDetail?.subject?.subjectId === subjectIdParam) {
                    if (isMounted) {
                        setDetail(savedDetail);
                        setIsLoadingDetail(false);
                    }
                    return;
                }

                if (!token) {
                    if (isMounted) {
                        setDetail(null);
                        setDetailError('No se pudo cargar el detalle de la asignatura.');
                        setIsLoadingDetail(false);
                    }
                    return;
                }

                try {
                    const response = await fetch(`${API_BASE}/student/records-summary`, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    });

                    if (!isMounted) return;

                    if (response.status === 401) {
                        logout();
                        return;
                    }

                    if (!response.ok) {
                        throw new Error('No se pudo obtener el resumen de registros.');
                    }

                    const payload = await response.json() as { data?: StudentSubjectRecordSummary[] };
                    const matchedSubject = payload.data?.find((item) => item.subjectId === subjectIdParam) || null;

                    if (!matchedSubject) {
                        setDetail(null);
                        setDetailError('No se encontró la asignatura asociada a esta notificación.');
                        setIsLoadingDetail(false);
                        return;
                    }

                    const nextDetail = { subject: matchedSubject };
                    localStorage.setItem(DETAIL_STORAGE_KEY, JSON.stringify(nextDetail));
                    setDetail(nextDetail);
                } catch {
                    if (!isMounted) return;
                    setDetail(null);
                    setDetailError('No se pudo cargar el detalle de la asignatura.');
                } finally {
                    if (isMounted) {
                        setIsLoadingDetail(false);
                    }
                }
                return;
            }

            if (savedDetail) {
                if (isMounted) {
                    setDetail(savedDetail);
                    setIsLoadingDetail(false);
                }
                return;
            }

            if (isMounted) {
                setDetail(null);
                setIsLoadingDetail(false);
            }
        }

        void loadDetail();

        return () => {
            isMounted = false;
        };
    }, [location.state, logout, subjectIdParam, token]);

    const evaluationColumns = useMemo<ReusableTableColumn<EvaluationRecord>[]>(() => [
        {
            field: 'category',
            headerName: 'Tipo de evaluación',
            renderCell: (value) => {
                const category = String(value || '');
                if (category === 'SYSTEMATIC_EVALUATION') return 'Sistemática';
                if (category === 'PARTIAL_EVALUATION') return 'Parcial';
                if (category === 'FINAL_EVALUATION') return 'Final';
                return category || '-';
            }
        },
        {
            field: 'examinationTypeId',
            headerName: 'Tipo de examen',
            renderCell: (value) => {
                const examType = value as EvaluationTypeRef | null | undefined;
                return examType?.name || '-';
            }
        },
        {
            field: 'evaluationDate',
            headerName: 'Fecha de evaluación',
            renderCell: (value) => new Date(String(value)).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        },
        {
            field: 'description',
            headerName: 'Descripción',
            renderCell: (value) => String(value || '-')
        },
        {
            field: 'evaluationValueId',
            headerName: 'Evaluación',
            renderCell: (value) => {
                const evaluationValue = value as EvaluationValueRef | null | undefined;
                const label = String(evaluationValue?.value || '').trim().toUpperCase();
                if (!label) return '-';
                if (label === 'NP') return 'No presentado';
                if (label === 'CO') return 'Convalidado';
                return evaluationValue?.value || '-';
            }
        }
    ], []);

    const attendanceColumns = useMemo<ReusableTableColumn<AttendanceRecord>[]>(() => [
        {
            field: 'attendanceDate',
            headerName: 'Fecha de asistencia',
            renderCell: (value) => new Date(String(value)).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        },
        {
            field: 'isPresent',
            headerName: 'Asistió',
            renderCell: (value) => {
                if (typeof value !== 'boolean') return '-';
                return value ? 'Sí' : 'No';
            }
        },
        {
            field: 'justified',
            headerName: 'Justificado',
            renderCell: (value, row) => {
                if (row.isPresent === true) return '-';
                if (typeof value !== 'boolean') return '-';
                return value ? 'Sí' : 'No';
            }
        },
        {
            field: 'justificationReason',
            headerName: 'Justificación de falta',
            renderCell: (value) => String(value || '-')
        }
    ], []);

    const pdfTables = useMemo<ExportTableConfig<any>[]>(() => {
        if (!detail) return [];

        return [
            {
                title: 'Registros de Evaluaciones',
                endpoint: '/student/subject-evaluation-records',
                queryParams: { subjectId: detail.subject.subjectId },
                columns: evaluationColumns,
                extractRows: (response) => {
                    if (!response || typeof response !== 'object') return [];
                    const parsed = response as Record<string, unknown>;
                    if (Array.isArray(parsed.data)) return parsed.data as EvaluationRecord[];
                    if (Array.isArray(parsed.items)) return parsed.items as EvaluationRecord[];
                    return [];
                }
            },
            {
                title: 'Registros de Asistencias',
                endpoint: '/student/subject-attendance-records',
                queryParams: { subjectId: detail.subject.subjectId },
                columns: attendanceColumns,
                extractRows: (response) => {
                    if (!response || typeof response !== 'object') return [];
                    const parsed = response as Record<string, unknown>;
                    if (Array.isArray(parsed.data)) return parsed.data as AttendanceRecord[];
                    if (Array.isArray(parsed.items)) return parsed.items as AttendanceRecord[];
                    return [];
                }
            }
        ];
    }, [attendanceColumns, detail, evaluationColumns]);

    const studentFullName = useMemo(() => {
        const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
        return fullName || 'estudiante';
    }, [user?.firstName, user?.lastName]);

    if (isLoadingDetail) {
        return (
            <MainLayout>
                <Container maxWidth="xl" sx={{ py: 4 }}>
                    <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                        Cargando detalle de la asignatura...
                    </Alert>
                </Container>
            </MainLayout>
        );
    }

    if (!detail) {
        return (
            <MainLayout>
                <Container maxWidth="xl" sx={{ py: 4 }}>
                    <Alert severity={detailError ? 'error' : 'warning'} sx={{ mb: 3, borderRadius: 2 }}>
                        {detailError || 'Debes seleccionar primero una asignatura desde tus registros.'}
                    </Alert>
                </Container>
            </MainLayout>
        );
    }

    const attendanceLabel = typeof detail.subject.attendanceAverage === 'number'
        ? `Promedio de asistencia: ${detail.subject.attendanceAverage.toFixed(2)}%`
        : 'Sin registros de asistencia';

    const evaluationLabel = typeof detail.subject.evaluationAverage === 'number'
        ? `Promedio de evaluación: ${detail.subject.evaluationAverage.toFixed(2)}`
        : 'Sin registros de evaluación';

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title={`Detalles de ${detail.subject.subjectName}`}
                    subtitle={`${attendanceLabel} | ${evaluationLabel}`}
                    showBackButton={true}
                    backTo="/student/records"
                    action={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Tooltip title="Actualizar datos">
                                <IconButton
                                    color="primary"
                                    onClick={() => setRefreshKey((prev) => prev + 1)}
                                >
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
                            <ExportToPDF
                                token={token}
                                fileName={`registros-${detail.subject.subjectName}`}
                                buttonLabel="Exportar a PDF"
                                logoUrl="/images/uho-blue.png"
                                institutionName="Sistema de Seguimiento Académico"
                                reportSubtitle={`Detalle de evaluaciones y asistencias de ${detail.subject.subjectName} del estudiante ${studentFullName}`}
                                onUnauthorized={logout}
                                onError={(message) => setInfoMessage(message)}
                                disabled={pdfTables.length === 0}
                                tables={pdfTables}
                            />
                        </Box>
                    }
                />

                {infoMessage && (
                    <Alert severity="info" onClose={() => setInfoMessage(null)} sx={{ mb: 3, borderRadius: 2 }}>
                        {infoMessage}
                    </Alert>
                )}

                <Stack spacing={3}>
                    <Card elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">Registros de Evaluaciones</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <ReusableTable<EvaluationRecord>
                            endpoint="/student/subject-evaluation-records"
                            token={token}
                            columns={evaluationColumns}
                            rowKey="recordKey"
                            serverPagination={true}
                            refreshKey={refreshKey}
                            queryParams={{ subjectId: detail.subject.subjectId }}
                            tableAriaLabel="registros de evaluaciones de la asignatura"
                            emptyMessage="No hay registros de evaluación para esta asignatura."
                            onUnauthorized={logout}
                            extractRows={(response) => {
                                if (!response || typeof response !== 'object') return [];
                                const parsed = response as Record<string, unknown>;
                                if (Array.isArray(parsed.data)) return parsed.data as EvaluationRecord[];
                                if (Array.isArray(parsed.items)) return parsed.items as EvaluationRecord[];
                                return [];
                            }}
                            extractTotalCount={(response, rows) => {
                                if (!response || typeof response !== 'object') return rows.length;
                                const parsed = response as Record<string, unknown>;
                                return typeof parsed.totalCount === 'number' ? parsed.totalCount : rows.length;
                            }}
                        />
                    </Card>

                    <Card elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">Registros de Asistencias</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <ReusableTable<AttendanceRecord>
                            endpoint="/student/subject-attendance-records"
                            token={token}
                            columns={attendanceColumns}
                            rowKey="_id"
                            serverPagination={true}
                            refreshKey={refreshKey}
                            queryParams={{ subjectId: detail.subject.subjectId }}
                            tableAriaLabel="registros de asistencias de la asignatura"
                            emptyMessage="No hay registros de asistencia para esta asignatura."
                            onUnauthorized={logout}
                            extractRows={(response) => {
                                if (!response || typeof response !== 'object') return [];
                                const parsed = response as Record<string, unknown>;
                                if (Array.isArray(parsed.data)) return parsed.data as AttendanceRecord[];
                                if (Array.isArray(parsed.items)) return parsed.items as AttendanceRecord[];
                                return [];
                            }}
                            extractTotalCount={(response, rows) => {
                                if (!response || typeof response !== 'object') return rows.length;
                                const parsed = response as Record<string, unknown>;
                                return typeof parsed.totalCount === 'number' ? parsed.totalCount : rows.length;
                            }}
                        />
                    </Card>
                </Stack>
            </Container>
        </MainLayout>
    );
};

export default SubjectRecordsDetail;
