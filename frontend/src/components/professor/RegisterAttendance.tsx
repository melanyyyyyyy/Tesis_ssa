import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    Checkbox,
    CircularProgress,
    Divider,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
    useTheme
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { ModalDialog } from '../common/ModalDialog';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

interface SubjectReference {
    _id: string;
    name: string;
    academicYear: number;
}

interface RegisterAttendanceRowResponse {
    studentId: string;
    studentName: string;
    attendance: {
        _id: string;
        attendanceDate?: string;
        isPresent: boolean;
        justified: boolean;
        justificationReason?: string;
    } | null;
}

interface RegisterAttendanceProps {
    subject: SubjectReference;
    mode?: 'create' | 'edit';
    initialAttendanceDate?: string;
    onSaved?: (result: unknown) => void;
    onCancel?: () => void;
}

interface RegisterAttendanceRowForm {
    studentId: string;
    studentName: string;
    attendanceId: string;
    isPresent: boolean;
    justified: boolean;
    justificationReason: string;
}

interface AttendanceRowProps {
    index: number;
    row: RegisterAttendanceRowForm;
    disableInputs: boolean;
    onPresenceChange: (studentId: string, checked: boolean) => void;
    onJustifiedChange: (studentId: string, checked: boolean) => void;
    onJustificationReasonChange: (studentId: string, value: string) => void;
}

const AttendanceRow = React.memo<AttendanceRowProps>(({
    index,
    row,
    disableInputs,
    onPresenceChange,
    onJustifiedChange,
    onJustificationReasonChange
}) => {
    return (
        <TableRow>
            <TableCell>{index + 1}</TableCell>
            <TableCell>
                <Typography variant="body2" fontWeight={500}>{row.studentName}</Typography>
            </TableCell>
            <TableCell>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Checkbox
                        checked={row.isPresent}
                        onChange={(event) => onPresenceChange(row.studentId, event.target.checked)}
                        disabled={disableInputs}
                    />
                    <Typography variant="body2">
                        {row.isPresent ? 'Sí' : 'No'}
                    </Typography>
                </Stack>
            </TableCell>
            <TableCell>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Checkbox
                        checked={!row.isPresent && row.justified}
                        onChange={(event) => onJustifiedChange(row.studentId, event.target.checked)}
                        disabled={disableInputs || row.isPresent}
                    />
                    <Typography variant="body2">
                        {!row.isPresent && row.justified ? 'Sí' : 'No'}
                    </Typography>
                </Stack>
            </TableCell>
            <TableCell>
                <TextField
                    value={row.justificationReason}
                    onChange={(event) => onJustificationReasonChange(row.studentId, event.target.value)}
                    fullWidth
                    size="small"
                    placeholder="Escriba la razón de la falta"
                    disabled={disableInputs || row.isPresent || !row.justified}
                    inputProps={{ maxLength: 500 }}
                />
            </TableCell>
        </TableRow>
    );
});

const RegisterAttendance: React.FC<RegisterAttendanceProps> = ({
    subject,
    mode = 'create',
    initialAttendanceDate,
    onSaved,
    onCancel
}) => {
    const theme = useTheme();
    const { token, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [attendanceDate, setAttendanceDate] = useState(() => {
        if (initialAttendanceDate) {
            try {
                const date = new Date(initialAttendanceDate);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            } catch (e) {
                console.error('Error parsing initial attendance date:', e);
            }
            if (typeof initialAttendanceDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(initialAttendanceDate)) {
                return initialAttendanceDate.split('T')[0];
            }
        }
        return new Date().toISOString().split('T')[0];
    });
    const [rows, setRows] = useState<RegisterAttendanceRowForm[]>([]);
    const redirectTimeoutRef = useRef<number | null>(null);

    const disableInputs = useMemo(
        () => saving || isRedirecting,
        [saving, isRedirecting]
    );

    const loadData = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({ subjectId: subject._id });
            if (mode === 'edit' && initialAttendanceDate) {
                params.set('attendanceDate', initialAttendanceDate);
            }

            const response = await fetch(`${API_BASE}/professor/attendance-register-data?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error('No se pudieron cargar los datos del registro de asistencia');
            }

            const result = await response.json() as {
                data?: RegisterAttendanceRowResponse[];
            };

            const isEditMode = mode === 'edit';
            const mappedRows = Array.isArray(result.data)
                ? result.data.map((item) => ({
                    studentId: item.studentId,
                    studentName: item.studentName,
                    attendanceId: isEditMode ? item.attendance?._id || '' : '',
                    isPresent: isEditMode ? Boolean(item.attendance?.isPresent) : false,
                    justified: isEditMode ? Boolean(item.attendance?.justified) : false,
                    justificationReason: isEditMode
                        ? String(item.attendance?.justificationReason || '')
                        : ''
                }))
                : [];

            setRows(mappedRows);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Error al cargar los datos');
        } finally {
            setLoading(false);
        }
    }, [token, subject._id, mode, initialAttendanceDate, logout]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        return () => {
            if (redirectTimeoutRef.current !== null) {
                window.clearTimeout(redirectTimeoutRef.current);
            }
        };
    }, []);

    const handlePresenceChange = useCallback((studentId: string, checked: boolean) => {
        setRows((current) => current.map((row) => {
            if (row.studentId !== studentId) return row;
            return {
                ...row,
                isPresent: checked,
                justified: checked ? false : row.justified,
                justificationReason: checked ? '' : row.justificationReason
            };
        }));
    }, []);

    const handleJustifiedChange = useCallback((studentId: string, checked: boolean) => {
        setRows((current) => current.map((row) => {
            if (row.studentId !== studentId) return row;
            return {
                ...row,
                justified: checked,
                justificationReason: checked ? row.justificationReason : ''
            };
        }));
    }, []);

    const handleJustificationReasonChange = useCallback((studentId: string, value: string) => {
        setRows((current) => current.map((row) => {
            if (row.studentId !== studentId) return row;
            return {
                ...row,
                justificationReason: value
            };
        }));
    }, []);

    const handleCancelClick = () => {
        if (!onCancel || disableInputs) return;
        setCancelModalOpen(true);
    };

    const handleCloseCancelModal = () => {
        setCancelModalOpen(false);
    };

    const handleConfirmCancel = () => {
        setCancelModalOpen(false);
        onCancel?.();
    };

    const handleSave = async () => {
        if (!token) return;

        if (!attendanceDate) {
            setError('Debes seleccionar una fecha de asistencia');
            return;
        }

        const hasInvalidJustification = rows.some((row) =>
            !row.isPresent && row.justified && !row.justificationReason.trim()
        );

        if (hasInvalidJustification) {
            setError('Debes escribir la razón de la falta en los ausentes justificados');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`${API_BASE}/professor/attendance-register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    subjectId: subject._id,
                    attendanceDate,
                    entries: rows.map((row) => ({
                        attendanceId: row.attendanceId || undefined,
                        studentId: row.studentId,
                        isPresent: row.isPresent,
                        justified: !row.isPresent && row.justified,
                        justificationReason: !row.isPresent ? row.justificationReason.trim() : ''
                    }))
                })
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.message || result?.error || 'No se pudo guardar el registro de asistencia');
            }
            if (typeof result?.savedCount === 'number' && result.savedCount === 0) {
                throw new Error('No se guardó ningún registro de asistencia.');
            }

            setSuccess('Asistencias registradas exitosamente. Redirigiendo...');
            setIsRedirecting(true);
            redirectTimeoutRef.current = window.setTimeout(() => {
                onSaved?.(result);
            }, 2000);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card
            elevation={0}
            sx={{
                p: 4,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                background: theme.palette.background.paper,
                textAlign: 'left'
            }}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h6">
                    {mode === 'edit' ? 'Editar registro de asistencia' : 'Nuevo registro de asistencia'}
                </Typography>
            </Stack>
            <Divider sx={{ mb: 3 }} />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <TextField
                    type="date"
                    label="Fecha de asistencia"
                    value={attendanceDate}
                    onChange={(event) => setAttendanceDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    required
                    disabled={disableInputs}
                />
            </Stack>

            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Estudiantes de {subject.name}
            </Typography>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table aria-label="registro de asistencia por estudiante">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, width: '6%' }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: '28%' }}>Estudiante</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: '12%' }}>Asistió</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: '12%' }}>Justificado</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Razón de falta</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center">
                                        <Typography color="text.secondary" sx={{ py: 2 }}>
                                            No hay estudiantes para registrar.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, index) => (
                                    <AttendanceRow
                                        key={row.studentId}
                                        index={index}
                                        row={row}
                                        disableInputs={disableInputs}
                                        onPresenceChange={handlePresenceChange}
                                        onJustifiedChange={handleJustifiedChange}
                                        onJustificationReasonChange={handleJustificationReasonChange}
                                    />
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {(error || success) && (
                <Stack spacing={1.5} sx={{ mt: 2, mb: 2 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    {success && <Alert severity="info">{success}</Alert>}
                </Stack>
            )}

            <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 2 }}>
                {onCancel && (
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleCancelClick}
                        disabled={disableInputs}
                    >
                        Cancelar
                    </Button>
                )}
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleSave}
                    disabled={disableInputs || loading || rows.length === 0}
                    startIcon={<SaveIcon />}
                >
                    {saving ? 'Guardando...' : isRedirecting ? 'Redirigiendo...' : 'Guardar registro'}
                </Button>
            </Stack>
            <ModalDialog
                open={cancelModalOpen}
                onClose={handleCloseCancelModal}
                onConfirm={handleConfirmCancel}
                title="Confirmar cancelación"
                description="Estas seguro de que deseas cancelar? Los cambios no guardados se perderán"
                confirmText="Sí, cancelar"
                cancelText="Seguir editando"
                variant="error"
            />
        </Card>
    );
};

export default RegisterAttendance;
