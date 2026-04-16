import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    Container,
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    TextField,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';
import ReusableTable, { type ReusableTableAction, type ReusableTableColumn } from '../../components/common/ReusableTable';
import ExportToPDF from '../../components/common/ExportToPDF';

interface SubjectReference {
    _id: string;
    name: string;
    academicYear: number;
}

interface StudentSubjectSummary {
    _id: string;
    studentId: string;
    studentName: string;
    attendanceAverage: number;
    evaluationAverage: number;
}

interface StudentDetailState {
    subject: SubjectReference;
    studentSummary: StudentSubjectSummary;
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
    matriculatedSubjectId?: string;
    category: string;
    examinationTypeId?: EvaluationTypeRef | null;
    evaluationDate: string;
    description?: string;
    evaluationValueId?: EvaluationValueRef | null;
}

interface AttendanceRecord {
    _id: string;
    studentId?: string;
    attendanceDate: string;
    isPresent?: boolean;
    justified?: boolean;
    justificationReason?: string;
}

interface SelectOption {
    _id: string;
    value?: string;
    name?: string;
}

const DETAIL_STORAGE_KEY = 'professorSelectedStudentDetail';
const API_BASE = import.meta.env.VITE_API_BASE;

const normalizeEvaluationValue = (value?: string) => (value || '').trim().toUpperCase();

const getEvaluationValueLabel = (value?: string) => {
    const normalized = normalizeEvaluationValue(value);
    if (normalized === 'NP') return 'No presentado';
    if (normalized === 'CO') return 'Convalidado';
    return value || '';
};

const StudentDetail: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { token, logout } = useAuth();
    const initialState = location.state as StudentDetailState | null;
    const [refreshKey, setRefreshKey] = useState(0);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [evaluationDialogOpen, setEvaluationDialogOpen] = useState(false);
    const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
    const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationRecord | null>(null);
    const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
    const [evaluationValues, setEvaluationValues] = useState<SelectOption[]>([]);
    const [selectedEvaluationValueId, setSelectedEvaluationValueId] = useState('');
    const [evaluationAverage, setEvaluationAverage] = useState<number | null>(() =>
        typeof initialState?.studentSummary?.evaluationAverage === 'number'
            ? initialState.studentSummary.evaluationAverage
            : null
    );
    const [attendanceIsPresent, setAttendanceIsPresent] = useState(false);
    const [attendanceJustified, setAttendanceJustified] = useState(false);
    const [attendanceReason, setAttendanceReason] = useState('');

    const detail = useMemo(() => {
        const state = location.state as StudentDetailState | null;
        if (state?.subject && state.studentSummary) {
            localStorage.setItem(DETAIL_STORAGE_KEY, JSON.stringify(state));
            return state;
        }

        const saved = localStorage.getItem(DETAIL_STORAGE_KEY);
        if (!saved) return null;
        try {
            return JSON.parse(saved) as StudentDetailState;
        } catch {
            return null;
        }
    }, [location.state]);

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

    const studentTableQueryParams = useMemo(() => ({
        subjectId: detail?.subject._id || '',
        studentId: detail?.studentSummary.studentId || ''
    }), [detail]);

    const loadEvaluationSummary = useCallback(async () => {
        if (!token || !detail) return;

        try {
            const params = new URLSearchParams({
                ...studentTableQueryParams,
                page: '0',
                limit: '1'
            });
            const response = await fetch(`${API_BASE}/professor/student-evaluation-records?${params.toString()}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error('No se pudo cargar el promedio de evaluación');
            }

            const result = await response.json() as {
                summary?: {
                    evaluationAverage?: number | null;
                };
            };
            setEvaluationAverage(typeof result.summary?.evaluationAverage === 'number'
                ? result.summary.evaluationAverage
                : null);
        } catch (error) {
            setInfoMessage(error instanceof Error ? error.message : 'No se pudo cargar el promedio de evaluación');
        }
    }, [detail, logout, studentTableQueryParams, token]);

    useEffect(() => {
        void loadEvaluationSummary();
    }, [loadEvaluationSummary, refreshKey]);

    const loadEvaluationValues = async () => {
        if (!token || !detail) return;
        if (evaluationValues.length > 0) return;
        const params = new URLSearchParams({ subjectId: detail.subject._id });
        const response = await fetch(`${API_BASE}/professor/evaluation-register-data?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.status === 401) {
            logout();
            return;
        }
        if (!response.ok) {
            throw new Error('No se pudieron cargar los valores de evaluación');
        }
        const result = await response.json() as {
            options?: {
                evaluationValues?: SelectOption[];
            };
        };
        setEvaluationValues(Array.isArray(result.options?.evaluationValues) ? result.options?.evaluationValues : []);
    };

    const handleOpenEvaluationEdit = async (row: EvaluationRecord) => {
        if (row.isReadOnly) return;
        try {
            setInfoMessage(null);
            await loadEvaluationValues();
            setSelectedEvaluation(row);
            setSelectedEvaluationValueId(row.evaluationValueId?._id || '');
            setEvaluationDialogOpen(true);
        } catch (error) {
            setInfoMessage(error instanceof Error ? error.message : 'No se pudo abrir la edición de evaluación');
        }
    };

    const handleSaveEvaluationEdit = async () => {
        if (!token || !detail || !selectedEvaluation) return;
        if (!selectedEvaluationValueId) {
            setInfoMessage('Debes seleccionar una evaluación');
            return;
        }
        if (!selectedEvaluation.matriculatedSubjectId) {
            setInfoMessage('No se encontró la matrícula asociada a esta evaluación');
            return;
        }
        setSavingEdit(true);
        setInfoMessage(null);
        try {
            const response = await fetch(`${API_BASE}/professor/evaluation-register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    subjectId: detail.subject._id,
                    category: selectedEvaluation.category,
                    evaluationDate: selectedEvaluation.evaluationDate,
                    examinationTypeId: selectedEvaluation.category === 'FINAL_EVALUATION'
                        ? selectedEvaluation.examinationTypeId?._id
                        : undefined,
                    description: selectedEvaluation.description || '',
                    entries: [
                        {
                            evaluationId: selectedEvaluation._id,
                            matriculatedSubjectId: selectedEvaluation.matriculatedSubjectId,
                            evaluationValueId: selectedEvaluationValueId
                        }
                    ]
                })
            });
            if (response.status === 401) {
                logout();
                return;
            }
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result?.message || result?.error || 'No se pudo actualizar la evaluación');
            }
            setEvaluationDialogOpen(false);
            setSelectedEvaluation(null);
            setSelectedEvaluationValueId('');
            setRefreshKey((prev) => prev + 1);
            setInfoMessage('Evaluación actualizada correctamente.');
        } catch (error) {
            setInfoMessage(error instanceof Error ? error.message : 'No se pudo actualizar la evaluación');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleOpenAttendanceEdit = (row: AttendanceRecord) => {
        setInfoMessage(null);
        setSelectedAttendance(row);
        setAttendanceIsPresent(Boolean(row.isPresent));
        setAttendanceJustified(Boolean(row.justified));
        setAttendanceReason(String(row.justificationReason || ''));
        setAttendanceDialogOpen(true);
    };

    const handleSaveAttendanceEdit = async () => {
        if (!token || !detail || !selectedAttendance) return;
        if (!selectedAttendance.studentId) {
            setInfoMessage('No se encontró el estudiante asociado a esta asistencia');
            return;
        }
        setSavingEdit(true);
        setInfoMessage(null);
        try {
            const response = await fetch(`${API_BASE}/professor/attendance-register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    subjectId: detail.subject._id,
                    attendanceDate: selectedAttendance.attendanceDate,
                    entries: [
                        {
                            attendanceId: selectedAttendance._id,
                            studentId: selectedAttendance.studentId,
                            isPresent: attendanceIsPresent,
                            justified: !attendanceIsPresent && attendanceJustified,
                            justificationReason: !attendanceIsPresent && attendanceJustified
                                ? attendanceReason.trim()
                                : ''
                        }
                    ]
                })
            });
            if (response.status === 401) {
                logout();
                return;
            }
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result?.message || result?.error || 'No se pudo actualizar la asistencia');
            }
            setAttendanceDialogOpen(false);
            setSelectedAttendance(null);
            setAttendanceReason('');
            setRefreshKey((prev) => prev + 1);
            setInfoMessage('Asistencia actualizada correctamente.');
        } catch (error) {
            setInfoMessage(error instanceof Error ? error.message : 'No se pudo actualizar la asistencia');
        } finally {
            setSavingEdit(false);
        }
    };

    const evaluationActions = useMemo<ReusableTableAction<EvaluationRecord>[]>(() => [
        {
            variant: 'edit',
            label: 'Editar',
            hidden: (row) => row.isReadOnly,
            onClick: (row) => {
                void handleOpenEvaluationEdit(row);
            }
        },
        {
            label: '-',
            icon: <Typography variant="body2" color="text.secondary">-</Typography>,
            color: 'default',
            hidden: (row) => !row.isReadOnly,
            disabled: () => true,
            onClick: () => {}
        }
    ], [evaluationValues.length, token, detail, logout]);

    const attendanceActions = useMemo<ReusableTableAction<AttendanceRecord>[]>(() => [
        {
            variant: 'edit',
            label: 'Editar',
            onClick: (row) => handleOpenAttendanceEdit(row)
        }
    ], []);

    if (!detail) {
        return (
            <MainLayout>
                <Container maxWidth="xl" sx={{ py: 4 }}>
                    <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                        Debes seleccionar primero un estudiante desde el detalle de la asignatura.
                    </Alert>
                    <Button variant="contained" onClick={() => navigate('/professor/dashboard')}>
                        Volver al panel
                    </Button>
                </Container>
            </MainLayout>
        );
    }

    const attendanceLabel = (typeof detail.studentSummary.attendanceAverage === 'number')
        ? `Promedio de asistencia: ${detail.studentSummary.attendanceAverage.toFixed(2)}%`
        : 'Sin registros de asistencia';

    const evaluationLabel = (typeof evaluationAverage === 'number')
        ? `Promedio de evaluación: ${evaluationAverage.toFixed(2)}`
        : 'Sin registros de evaluación';

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title={`Detalles de ${detail.studentSummary.studentName} en la asignatura ${detail.subject.name}`}
                    subtitle={`${attendanceLabel} | ${evaluationLabel}`}
                    showBackButton={true}
                    backTo="/professor/subject-detail"
                    action={(
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
                                fileName={`detalle-estudiante-${detail.studentSummary.studentName}`}
                                buttonLabel="Exportar a PDF"
                                logoUrl="/images/uho-blue.png"
                                institutionName="Sistema de Seguimiento Académico"
                                reportSubtitle={`Historial de Evaluaciones y Asistencias - ${detail.studentSummary.studentName} - ${detail.subject.name}`}
                                onUnauthorized={logout}
                                onError={(message) => setInfoMessage(message)}
                                tables={[
                                    {
                                        title: `Registros de Evaluaciones - ${detail.studentSummary.studentName} - ${detail.subject.name}`,
                                        endpoint: '/professor/student-evaluation-records',
                                        queryParams: {
                                            ...studentTableQueryParams,
                                            page: 0,
                                            limit: 1000
                                        },
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
                                        title: `Registros de Asistencias - ${detail.studentSummary.studentName} - ${detail.subject.name}`,
                                        endpoint: '/professor/student-attendance-records',
                                        queryParams: {
                                            ...studentTableQueryParams,
                                            page: 0,
                                            limit: 1000
                                        },
                                        columns: attendanceColumns,
                                        extractRows: (response) => {
                                            if (!response || typeof response !== 'object') return [];
                                            const parsed = response as Record<string, unknown>;
                                            if (Array.isArray(parsed.data)) return parsed.data as AttendanceRecord[];
                                            if (Array.isArray(parsed.items)) return parsed.items as AttendanceRecord[];
                                            return [];
                                        }
                                    }
                                ]}
                            />
                        </Box>
                    )}
                />

                {infoMessage && (
                    <Alert severity="info" onClose={() => setInfoMessage(null)} sx={{ mb: 3, borderRadius: 2 }}>
                        {infoMessage}
                    </Alert>
                )}

                <Card elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Registros de Evaluaciones</Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <ReusableTable<EvaluationRecord>
                        endpoint="/professor/student-evaluation-records"
                        token={token}
                        columns={evaluationColumns}
                        actions={evaluationActions}
                        rowKey="recordKey"
                        serverPagination={true}
                        refreshKey={refreshKey}
                        queryParams={studentTableQueryParams}
                        tableAriaLabel="registros de evaluaciones del estudiante"
                        emptyMessage="No hay registros de evaluación para este estudiante."
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
                        endpoint="/professor/student-attendance-records"
                        token={token}
                        columns={attendanceColumns}
                        actions={attendanceActions}
                        rowKey="_id"
                        serverPagination={true}
                        refreshKey={refreshKey}
                        queryParams={studentTableQueryParams}
                        tableAriaLabel="registros de asistencias del estudiante"
                        emptyMessage="No hay registros de asistencia para este estudiante."
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

                <Dialog open={evaluationDialogOpen} onClose={() => setEvaluationDialogOpen(false)} fullWidth maxWidth="xs">
                    <DialogTitle>Editar evaluación</DialogTitle>
                    <DialogContent>
                        <Stack sx={{ pt: 1 }}>
                            <TextField
                                select
                                label="Evaluación"
                                value={selectedEvaluationValueId}
                                onChange={(event) => setSelectedEvaluationValueId(event.target.value)}
                                fullWidth
                                disabled={savingEdit}
                            >
                                {evaluationValues.length > 0 ? evaluationValues.map((option) => (
                                    <MenuItem key={option._id} value={option._id}>
                                        {getEvaluationValueLabel(option.value)}
                                    </MenuItem>
                                )) : (
                                    <MenuItem disabled>No hay valores disponibles</MenuItem>
                                )}
                            </TextField>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEvaluationDialogOpen(false)} color="inherit" disabled={savingEdit}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveEvaluationEdit} variant="contained" disabled={savingEdit}>
                            {savingEdit ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={attendanceDialogOpen} onClose={() => setAttendanceDialogOpen(false)} fullWidth maxWidth="xs">
                    <DialogTitle>Editar asistencia</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <TextField
                                select
                                label="Asistió"
                                value={attendanceIsPresent ? 'YES' : 'NO'}
                                onChange={(event) => {
                                    const present = event.target.value === 'YES';
                                    setAttendanceIsPresent(present);
                                    if (present) {
                                        setAttendanceJustified(false);
                                        setAttendanceReason('');
                                    }
                                }}
                                fullWidth
                                disabled={savingEdit}
                            >
                                <MenuItem value="YES">Sí</MenuItem>
                                <MenuItem value="NO">No</MenuItem>
                            </TextField>

                            {!attendanceIsPresent && (
                                <TextField
                                    select
                                    label="Justificado"
                                    value={attendanceJustified ? 'YES' : 'NO'}
                                    onChange={(event) => {
                                        const justified = event.target.value === 'YES';
                                        setAttendanceJustified(justified);
                                        if (!justified) {
                                            setAttendanceReason('');
                                        }
                                    }}
                                    fullWidth
                                    disabled={savingEdit}
                                >
                                    <MenuItem value="YES">Sí</MenuItem>
                                    <MenuItem value="NO">No</MenuItem>
                                </TextField>
                            )}

                            {!attendanceIsPresent && attendanceJustified && (
                                <TextField
                                    label="Razón de falta"
                                    value={attendanceReason}
                                    onChange={(event) => setAttendanceReason(event.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    inputProps={{ maxLength: 500 }}
                                    disabled={savingEdit}
                                />
                            )}
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setAttendanceDialogOpen(false)} color="inherit" disabled={savingEdit}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveAttendanceEdit} variant="contained" disabled={savingEdit}>
                            {savingEdit ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </MainLayout>
    );
};

export default StudentDetail;
