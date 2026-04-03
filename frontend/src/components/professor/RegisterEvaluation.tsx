import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CircularProgress,
    Divider,
    MenuItem,
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
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

type EvaluationCategoryType = 'SYSTEMATIC_EVALUATION' | 'PARTIAL_EVALUATION' | 'FINAL_EVALUATION';

interface SubjectReference {
    _id: string;
    name: string;
    academicYear: number;
}

interface SelectOption {
    _id: string;
    value?: string;
    name?: string;
}

interface RegisterStudentRow {
    matriculatedSubjectId: string;
    studentId: string;
    studentName: string;
    evaluation: {
        _id: string;
        evaluationValueId: string;
        examinationTypeId: string;
        description: string;
        category: string;
        evaluationDate?: string;
    } | null;
}

interface RegisterEvaluationProps {
    subject: SubjectReference;
    mode?: 'create' | 'edit';
    initialCategory?: EvaluationCategoryType;
    initialEvaluationDate?: string;
    initialExaminationTypeId?: string;
    initialDescription?: string;
    onSaved?: (result: unknown) => void;
    onCancel?: () => void;
}

interface RegisterRowForm {
    matriculatedSubjectId: string;
    studentId: string;
    studentName: string;
    evaluationId: string;
    evaluationValueId: string;
}

const categoryOptions: Array<{ value: EvaluationCategoryType; label: string }> = [
    { value: 'SYSTEMATIC_EVALUATION', label: 'Sistemática' },
    { value: 'PARTIAL_EVALUATION', label: 'Parcial' },
    { value: 'FINAL_EVALUATION', label: 'Final' }
];

const normalizeEvaluationValue = (value?: string) => (value || '').trim().toUpperCase();

const getEvaluationValueLabel = (value?: string) => {
    const normalized = normalizeEvaluationValue(value);
    if (normalized === 'NP') return 'No presentado';
    if (normalized === 'CO') return 'Convalidado';
    return value || '';
};

const RegisterEvaluation: React.FC<RegisterEvaluationProps> = ({
    subject,
    mode = 'create',
    initialCategory,
    initialEvaluationDate,
    initialExaminationTypeId,
    initialDescription,
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
    const [evaluationValues, setEvaluationValues] = useState<SelectOption[]>([]);
    const [examinationTypes, setExaminationTypes] = useState<SelectOption[]>([]);
    const [rows, setRows] = useState<RegisterRowForm[]>([]);
    const [category, setCategory] = useState<EvaluationCategoryType | ''>(initialCategory || '');
    const [evaluationDate, setEvaluationDate] = useState(
        initialEvaluationDate || new Date().toISOString().split('T')[0]
    );
    const [examinationTypeId, setExaminationTypeId] = useState(initialExaminationTypeId || '');
    const [description, setDescription] = useState(initialDescription || '');
    const redirectTimeoutRef = useRef<number | null>(null);

    const sortedEvaluationValues = useMemo(() => {
        return [...evaluationValues].sort((a, b) => {
            const aValue = (a.value || '').trim();
            const bValue = (b.value || '').trim();
            const aNumber = Number.parseFloat(aValue.replace(',', '.'));
            const bNumber = Number.parseFloat(bValue.replace(',', '.'));
            const aIsNumber = Number.isFinite(aNumber);
            const bIsNumber = Number.isFinite(bNumber);
            if (aIsNumber && bIsNumber) return aNumber - bNumber;
            if (aIsNumber) return -1;
            if (bIsNumber) return 1;
            return aValue.localeCompare(bValue);
        });
    }, [evaluationValues]);

    const loadData = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({ subjectId: subject._id });
            if (initialCategory) params.set('category', initialCategory);
            if (initialEvaluationDate) params.set('evaluationDate', initialEvaluationDate);
            if (initialCategory === 'FINAL_EVALUATION' && initialExaminationTypeId) {
                params.set('examinationTypeId', initialExaminationTypeId);
            }
            if (initialDescription?.trim()) {
                params.set('description', initialDescription.trim());
            }

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
                throw new Error('No se pudieron cargar los datos del registro de evaluación');
            }

            const result = await response.json() as {
                options?: {
                    evaluationValues?: SelectOption[];
                    examinationTypes?: SelectOption[];
                };
                data?: RegisterStudentRow[];
            };

            const apiEvaluationValues = Array.isArray(result.options?.evaluationValues) ? result.options.evaluationValues : [];
            const apiExaminationTypes = Array.isArray(result.options?.examinationTypes) ? result.options.examinationTypes : [];
            const defaultNpValueId = apiEvaluationValues.find(
                (option) => normalizeEvaluationValue(option.value) === 'NP'
            )?._id || apiEvaluationValues[0]?._id || '';
            const isEditMode = mode === 'edit';

            setEvaluationValues(apiEvaluationValues);
            setExaminationTypes(apiExaminationTypes);

            const mappedRows = Array.isArray(result.data)
                ? result.data.map((item) => ({
                    matriculatedSubjectId: item.matriculatedSubjectId,
                    studentId: item.studentId,
                    studentName: item.studentName,
                    evaluationId: isEditMode ? item.evaluation?._id || '' : '',
                    evaluationValueId: isEditMode
                        ? item.evaluation?.evaluationValueId || defaultNpValueId
                        : defaultNpValueId
                }))
                : [];

            setRows(mappedRows);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Error al cargar los datos');
        } finally {
            setLoading(false);
        }
    }, [
        token,
        subject._id,
        initialCategory,
        initialEvaluationDate,
        initialExaminationTypeId,
        initialDescription,
        mode,
        logout
    ]);

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

    const handleCategoryChange = (value: string) => {
        const nextValue = value as EvaluationCategoryType;
        setCategory(nextValue);
        if (nextValue !== 'FINAL_EVALUATION') {
            setExaminationTypeId('');
        }
    };

    const handleRowValueChange = (matriculatedSubjectId: string, value: string) => {
        setRows((current) => current.map((row) => {
            if (row.matriculatedSubjectId !== matriculatedSubjectId) return row;
            return {
                ...row,
                evaluationValueId: value
            };
        }));
    };

    const handleSave = async () => {
        if (!token) return;
        if (!category) {
            setError('Debes seleccionar un tipo de evaluación');
            return;
        }
        if (!evaluationDate) {
            setError('Debes seleccionar una fecha de evaluación');
            return;
        }
        if (category === 'FINAL_EVALUATION' && !examinationTypeId) {
            setError('Debes seleccionar el tipo de examen para la evaluación final');
            return;
        }

        const hasMissingEvaluation = rows.some((row) => !row.evaluationValueId);
        if (hasMissingEvaluation) {
            setError('Debes registrar una evaluación para todos los estudiantes');
            return;
        }
        const entries = rows.map((row) => ({
            evaluationId: row.evaluationId || undefined,
            matriculatedSubjectId: row.matriculatedSubjectId,
            evaluationValueId: row.evaluationValueId
        }));

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`${API_BASE}/professor/evaluation-register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    subjectId: subject._id,
                    category,
                    evaluationDate,
                    examinationTypeId: category === 'FINAL_EVALUATION' ? examinationTypeId : undefined,
                    description: description.trim(),
                    entries
                })
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.message || result?.error || 'No se pudo guardar el registro');
            }

            setSuccess('Evaluaciones registradas exitosamente. Redirigiendo...');
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
                    {mode === 'edit' ? 'Editar registro de evaluación' : 'Nuevo registro de evaluación'}
                </Typography>
            </Stack>
            <Divider sx={{ mb: 3 }} />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <TextField
                    select
                    label="Tipo de evaluación"
                    value={category}
                    onChange={(event) => handleCategoryChange(event.target.value)}
                    fullWidth
                    required
                    disabled={saving || isRedirecting}
                >
                    {categoryOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.label}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    type="date"
                    label="Fecha de evaluación"
                    value={evaluationDate}
                    onChange={(event) => setEvaluationDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    required
                    disabled={saving || isRedirecting}
                />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                {category === 'FINAL_EVALUATION' && (
                    <TextField
                        select
                        label="Tipo de examen"
                        value={examinationTypeId}
                        onChange={(event) => setExaminationTypeId(event.target.value)}
                        fullWidth
                        required
                        disabled={saving || isRedirecting}
                    >
                        {examinationTypes.length > 0 ? (
                            examinationTypes.map((item) => (
                                <MenuItem key={item._id} value={item._id}>
                                    {item.name}
                                </MenuItem>
                            ))
                        ) : (
                            <MenuItem disabled>No hay tipos de examen disponibles</MenuItem>
                        )}
                    </TextField>
                )}

                <TextField
                    label="Descripción"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    fullWidth
                    inputProps={{ maxLength: 50 }}
                    disabled={saving || isRedirecting}
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
                    <Table aria-label="registro de evaluación por estudiante">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, width: '10%' }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Estudiante</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: '30%' }}>Nota</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} align="center">
                                        <Typography color="text.secondary" sx={{ py: 2 }}>
                                            No hay estudiantes para registrar.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, index) => (
                                    <TableRow key={row.matriculatedSubjectId}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={500}>{row.studentName}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                select
                                                value={row.evaluationValueId}
                                                onChange={(event) => handleRowValueChange(row.matriculatedSubjectId, event.target.value)}
                                                fullWidth
                                                size="small"
                                                placeholder="Seleccione la nota"
                                                disabled={saving || isRedirecting}
                                            >
                                                {sortedEvaluationValues.map((option) => (
                                                    <MenuItem key={option._id} value={option._id}>
                                                        {getEvaluationValueLabel(option.value)}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        </TableCell>
                                    </TableRow>
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
                    <Button variant="outlined" onClick={onCancel} disabled={saving || isRedirecting}>
                        Cancelar
                    </Button>
                )}
                <Button variant="contained" onClick={handleSave} disabled={saving || isRedirecting || loading || rows.length === 0}>
                    {saving ? 'Guardando...' : isRedirecting ? 'Redirigiendo...' : 'Guardar registro'}
                </Button>
            </Stack>
        </Card>
    );
};

export default RegisterEvaluation;
