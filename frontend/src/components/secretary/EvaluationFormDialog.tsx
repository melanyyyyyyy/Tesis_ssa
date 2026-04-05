import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    MenuItem,
    Grid,
    CircularProgress,
    Alert,
    Box,
    Typography,
    Divider
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { type Evaluation } from './EvaluationsTable';

const API_BASE = import.meta.env.VITE_API_BASE;

interface EvaluationFormDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<Evaluation>) => Promise<void>;
    initialData?: Evaluation | null;
    hideCategory?: boolean;
}

interface Option {
    _id: string;
    name?: string;
    value?: string;
    subjectId?: {
        name: string;
    };
    studentId?: {
        firstName: string;
        lastName: string;
        identification: string;
    };
    firstName?: string;
    lastName?: string;
}

export const EvaluationFormDialog: React.FC<EvaluationFormDialogProps> = ({
    open,
    onClose,
    onSubmit,
    initialData,
    hideCategory = false
}) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [faculties, setFaculties] = useState<Option[]>([]);
    const [careers, setCareers] = useState<Option[]>([]);
    const [students, setStudents] = useState<Option[]>([]);
    const [subjects, setSubjects] = useState<Option[]>([]);
    
    const [evaluationValues, setEvaluationValues] = useState<Option[]>([]);
    const [examinationTypes, setExaminationTypes] = useState<Option[]>([]);
    const [courseTypes, setCourseTypes] = useState<Option[]>([]);

    const [formData, setFormData] = useState({
        facultyId: '',
        courseTypeId: '',
        careerId: '',
        academicYear: '',
        studentId: '',
        matriculatedSubjectId: '',
        description: '',
        category: 'FINAL_EVALUATION',
        evaluationValueId: '',
        examinationTypeId: '',
        evaluationDate: new Date().toISOString().split('T')[0]
    });

    const years = [1, 2, 3, 4, 5, 6];

    const getFilteredExaminationTypes = () => {
        if (formData.category === 'FINAL_EVALUATION') {
            return examinationTypes;
        }
        return [];
    };

    useEffect(() => {
        if (open) {
            fetchInitialOptions();
            if (initialData) {
                const student = initialData.studentId || (initialData.matriculatedSubjectId as any)?.studentId;
                
                setFormData({
                    facultyId: '', 
                    courseTypeId: '',
                    careerId: '',
                    academicYear: '',
                    studentId: student?._id || '',
                    matriculatedSubjectId: initialData.matriculatedSubjectId?._id || (initialData.matriculatedSubjectId as any) || '',
                    description: initialData.description || '',
                    category: initialData.category || 'FINAL_EVALUATION',
                    evaluationValueId: initialData.evaluationValueId?._id || (initialData.evaluationValueId as any) || '',
                    examinationTypeId: initialData.examinationTypeId?._id || (initialData.examinationTypeId as any) || '',
                    evaluationDate: initialData.evaluationDate ? new Date(initialData.evaluationDate).toISOString().split('T')[0] : ''
                });

                if (student?._id) {
                    fetchStudentSubjects(student._id);
                }
            } else {
                setFormData({
                    facultyId: '',
                    courseTypeId: '',
                    careerId: '',
                    academicYear: '',
                    studentId: '',
                    matriculatedSubjectId: '',
                    description: '',
                    category: 'FINAL_EVALUATION',
                    evaluationValueId: '',
                    examinationTypeId: '',
                    evaluationDate: new Date().toISOString().split('T')[0]
                });
                setCareers([]);
                setStudents([]);
                setSubjects([]);
            }
        }
    }, [open, initialData]);

    const fetchInitialOptions = async () => {
        setLoading(true);
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            
            const [facultiesRes, valuesRes, typesRes] = await Promise.all([
                fetch(`${API_BASE}/secretary/faculties`, { headers }),
                fetch(`${API_BASE}/secretary/evaluation-values`, { headers }),
                fetch(`${API_BASE}/secretary/examination-types`, { headers })
            ]);

            if (facultiesRes.ok) {
                const facultiesData = await facultiesRes.json();
                const facultiesArray = Array.isArray(facultiesData) ? facultiesData : (facultiesData.data || facultiesData.items || []);
                setFaculties(facultiesArray);
            }
            if (valuesRes.ok) {
                const values = await valuesRes.json();
                const valuesArray = Array.isArray(values) ? values : (values.data || values.items || []);
                const sortedValues = valuesArray.sort((a: Option, b: Option) => {
                    const aValue = a.value || '';
                    const bValue = b.value || '';
                    const aIsNumber = !isNaN(Number(aValue));
                    const bIsNumber = !isNaN(Number(bValue));

                    if (aIsNumber && bIsNumber) {
                        return Number(aValue) - Number(bValue);
                    }
                    if (aIsNumber) return -1;
                    if (bIsNumber) return 1;
                    return aValue.localeCompare(bValue);
                });
                setEvaluationValues(sortedValues);
            }
            if (typesRes.ok) {
                const typesData = await typesRes.json();
                const typesArray = Array.isArray(typesData) ? typesData : (typesData.data || typesData.items || []);
                setExaminationTypes(typesArray);
            }

        } catch (err) {
            console.error('Error fetching options:', err);
            setError('Error al cargar las opciones iniciales');
        } finally {
            setLoading(false);
        }
    };

    const fetchCareers = async (facultyId: string, courseTypeId?: string) => {
        if (!facultyId || !courseTypeId) {
            setCareers([]);
            return;
        }
        try {
            let url = `${API_BASE}/secretary/careers?facultyId=${facultyId}`;
            if (courseTypeId) {
                url += `&courseTypeId=${courseTypeId}`;
            }
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const careersData = await res.json();
                const careersArray = Array.isArray(careersData) ? careersData : (careersData.data || careersData.items || []);
                setCareers(careersArray);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCourseTypes = async (facultyId: string) => {
        if (!facultyId) {
            setCourseTypes([]);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/secretary/course-types?facultyId=${facultyId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const courseTypesData = await res.json();
                const courseTypesArray = Array.isArray(courseTypesData) ? courseTypesData : (courseTypesData.data || courseTypesData.items || []);
                setCourseTypes(courseTypesArray);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchStudents = async (facultyId: string, careerId: string, year: string) => {
        if (!facultyId || !careerId || !year) {
            setStudents([]);
            return;
        }
        try {
            const params = new URLSearchParams({
                facultyId,
                careerId,
                academicYear: year
            });
            const res = await fetch(`${API_BASE}/secretary/students?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const studentsData = await res.json();
                const studentsArray = Array.isArray(studentsData) ? studentsData : (studentsData.data || studentsData.items || []);
                setStudents(studentsArray);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchStudentSubjects = async (studentId: string) => {
        if (!studentId) {
            setSubjects([]);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/secretary/matriculated-subjects?studentId=${studentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const subjectsData = await res.json();
                const subjectsArray = Array.isArray(subjectsData) ? subjectsData : (subjectsData.data || subjectsData.items || []);
                setSubjects(subjectsArray);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'facultyId') {
            setFormData(prev => ({ 
                ...prev, 
                facultyId: value, courseTypeId: '', careerId: '', academicYear: '', studentId: '', matriculatedSubjectId: '' 
            }));
            fetchCourseTypes(value);
            setCareers([]);
            setStudents([]);
            setSubjects([]);
        } else if (name === 'courseTypeId') {
            setFormData(prev => ({ 
                ...prev, 
                courseTypeId: value, careerId: '', academicYear: '', studentId: '', matriculatedSubjectId: '' 
            }));
            fetchCareers(formData.facultyId, value);
            setStudents([]);
            setSubjects([]);
        } else if (name === 'careerId') {
             setFormData(prev => ({ 
                ...prev, 
                careerId: value, academicYear: '', studentId: '', matriculatedSubjectId: '' 
            }));
             setStudents([]);
             setSubjects([]);
        } else if (name === 'academicYear') {
            setFormData(prev => ({ 
                ...prev, 
                academicYear: value, studentId: '', matriculatedSubjectId: '' 
            }));
            fetchStudents(formData.facultyId, formData.careerId, value);
            setSubjects([]);
        } else if (name === 'studentId') {
            setFormData(prev => ({ 
                ...prev, 
                studentId: value, matriculatedSubjectId: '' 
            }));
            fetchStudentSubjects(value);
        } else if (name === 'category') {
            setFormData(prev => ({ 
                ...prev, 
                category: value, 
                examinationTypeId: value === 'FINAL_EVALUATION' ? prev.examinationTypeId : '' 
            }));
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            if (!formData.matriculatedSubjectId || !formData.evaluationValueId) {
                throw new Error('Por favor complete todos los campos requeridos');
            }
            if (formData.category === 'FINAL_EVALUATION' && !formData.examinationTypeId) {
                throw new Error('Por favor seleccione un tipo de examen para evaluaciones finales');
            }
            await onSubmit(formData as any);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSubmitting(false);
        }
    };

    const getSubjectName = (option: Option) => {
        return option.subjectId?.name || option.name || 'Sin Asignatura';
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{initialData ? 'Editar Evaluación' : 'Nueva Evaluación'}</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        
                        {!initialData && (
                            <>
                                <Grid size={12}>
                                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                                        Selección de Estudiante
                                    </Typography>
                                </Grid>
                                <Grid size={6}>
                                    <TextField
                                        select
                                        label="Facultad"
                                        name="facultyId"
                                        value={formData.facultyId}
                                        onChange={handleChange}
                                        fullWidth
                                    >
                                        {faculties.length > 0 ? (
                                            faculties.map((option) => (
                                                <MenuItem key={option._id} value={option._id}>
                                                    {option.name}
                                                </MenuItem>
                                            ))
                                        ) : (
                                            <MenuItem disabled>No hay opciones que mostrar</MenuItem>
                                        )}
                                    </TextField>
                                </Grid>
                                <Grid size={6}>
                                    <TextField
                                        select
                                        label="Tipo de Curso"
                                        name="courseTypeId"
                                        value={formData.courseTypeId}
                                        onChange={handleChange}
                                        fullWidth
                                        disabled={!formData.facultyId}
                                    >
                                        {courseTypes.length > 0 ? (
                                            courseTypes.map((option) => (
                                                <MenuItem key={option._id} value={option._id}>
                                                    {option.name}
                                                </MenuItem>
                                            ))
                                        ) : (
                                            <MenuItem disabled>No hay opciones que mostrar</MenuItem>
                                        )}
                                    </TextField>
                                </Grid>
                                <Grid size={6}>
                                    <TextField
                                        select
                                        label="Carrera"
                                        name="careerId"
                                        value={formData.careerId}
                                        onChange={handleChange}
                                        fullWidth
                                        disabled={!formData.courseTypeId}
                                    >
                                        {careers.length > 0 ? (
                                            careers.map((option) => (
                                                <MenuItem key={option._id} value={option._id}>
                                                    {option.name}
                                                </MenuItem>
                                            ))
                                        ) : (
                                            <MenuItem disabled>No hay opciones que mostrar</MenuItem>
                                        )}
                                    </TextField>
                                </Grid>
                                <Grid size={4}>
                                    <TextField
                                        select
                                        label="Año"
                                        name="academicYear"
                                        value={formData.academicYear}
                                        onChange={handleChange}
                                        fullWidth
                                        disabled={!formData.careerId}
                                    >
                                        {years.map((year) => (
                                            <MenuItem key={year} value={year}>
                                                {year}º Año
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                                <Grid size={8}>
                                    <TextField
                                        select
                                        label="Estudiante"
                                        name="studentId"
                                        value={formData.studentId}
                                        onChange={handleChange}
                                        fullWidth
                                        disabled={!formData.academicYear}
                                    >
                                        {students.length > 0 ? (
                                            students.map((option) => (
                                                <MenuItem key={option._id} value={option._id}>
                                                    {option.firstName} {option.lastName}
                                                </MenuItem>
                                            ))
                                        ) : (
                                            <MenuItem disabled>No hay opciones que mostrar</MenuItem>
                                        )}
                                    </TextField>
                                </Grid>
                                <Grid size={12}>
                                    <Divider sx={{ my: 1 }} />
                                </Grid>
                            </>
                        )}

                        <Grid size={12}>
                            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                                Datos de la Evaluación
                            </Typography>
                        </Grid>

                        <Grid size={12}>
                            <TextField
                                select
                                label="Asignatura"
                                name="matriculatedSubjectId"
                                value={formData.matriculatedSubjectId}
                                onChange={handleChange}
                                fullWidth
                                required
                                disabled={!formData.studentId && !initialData}
                                helperText={initialData ? "Asignatura matriculada del estudiante" : "Asignaturas del estudiante seleccionado"}
                            >
                                {subjects.length > 0 ? (
                                    subjects.map((option) => (
                                        <MenuItem key={option._id} value={option._id}>
                                            {getSubjectName(option)}
                                        </MenuItem>
                                    ))
                                ) : (
                                    <MenuItem disabled>No hay opciones que mostrar</MenuItem>
                                )}
                            </TextField>
                        </Grid>

                        <Grid size={12}>
                            <TextField
                                label="Descripción"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                fullWidth
                                multiline
                                rows={2}
                            />
                        </Grid>

                        {!hideCategory && (
                            <Grid size={6}>
                                <TextField
                                    select
                                    label="Categoría"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    fullWidth
                                    required
                                >
                                    <MenuItem value="SYSTEMATIC_EVALUATION">Sistemática</MenuItem>
                                    <MenuItem value="PARTIAL_EVALUATION">Parcial</MenuItem>
                                    <MenuItem value="FINAL_EVALUATION">Final</MenuItem>
                                </TextField>
                            </Grid>
                        )}

                        <Grid size={6}>
                            <TextField
                                select
                                label="Valor"
                                name="evaluationValueId"
                                value={formData.evaluationValueId}
                                onChange={handleChange}
                                fullWidth
                                required
                            >
                                {evaluationValues.length > 0 ? (
                                    evaluationValues.map((option) => (
                                        <MenuItem key={option._id} value={option._id}>
                                            {option.value}
                                        </MenuItem>
                                    ))
                                ) : (
                                    <MenuItem disabled>No hay opciones que mostrar</MenuItem>
                                )}
                            </TextField>
                        </Grid>

                        <Grid size={6}>
                            <TextField
                                select
                                label="Tipo de Examen"
                                name="examinationTypeId"
                                value={formData.examinationTypeId}
                                onChange={handleChange}
                                fullWidth
                                required={formData.category === 'FINAL_EVALUATION'}
                                disabled={formData.category !== 'FINAL_EVALUATION'}
                            >
                                {getFilteredExaminationTypes().length > 0 ? (
                                    getFilteredExaminationTypes().map((option) => (
                                        <MenuItem key={option._id} value={option._id}>
                                            {option.name}
                                        </MenuItem>
                                    ))
                                ) : (
                                    <MenuItem disabled>No hay opciones que mostrar</MenuItem>
                                )}
                            </TextField>
                        </Grid>

                        <Grid size={6}>
                            <TextField
                                type="date"
                                label="Fecha"
                                name="evaluationDate"
                                value={formData.evaluationDate}
                                onChange={handleChange}
                                fullWidth
                                required
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                    </Grid>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
                <Button 
                    onClick={handleSubmit} 
                    variant="contained" 
                    disabled={submitting || loading}
                >
                    {submitting ? 'Guardando...' : 'Guardar'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
