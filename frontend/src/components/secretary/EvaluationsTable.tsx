import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Tooltip,
    Typography,
    Chip,
    useTheme,
    alpha
} from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { ModalDialog } from '../common/ModalDialog';

export interface Evaluation {
    _id: string;
    studentId?: {
        firstName: string;
        lastName: string;
        careerId?: {
            name: string;
        };
        career?: {
            name: string;
        };
    };
    matriculatedSubjectId: {
        _id: string;
        subjectId: {
            name: string;
        };
    };
    description: string;
    category: string;
    evaluationValueId: {
        _id: string;
        value: string;
    };
    examinationTypeId: {
        _id: string;
        name: string;
    };
    evaluationDate: string;
}

interface EvaluationsTableProps {
    evaluations: Evaluation[];
    onEdit?: (evaluation: Evaluation) => void;
    onDelete?: (evaluation: Evaluation) => void;
    showEdit?: boolean;
    showDelete?: boolean;
}

const EvaluationsTable: React.FC<EvaluationsTableProps> = ({
    evaluations,
    onEdit,
    onDelete,
    showEdit = true,
    showDelete = true
}) => {
    const theme = useTheme();
    const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
    const [evaluationToDelete, setEvaluationToDelete] = React.useState<Evaluation | null>(null);

    const handleDeleteClick = (evaluation: Evaluation) => {
        setEvaluationToDelete(evaluation);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (evaluationToDelete && onDelete) {
            onDelete(evaluationToDelete);
        }
        setDeleteModalOpen(false);
        setEvaluationToDelete(null);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getCategoryLabel = (category: string) => {
        const categories: Record<string, string> = {
            'SYSTEMATIC_EVALUATION': 'Sistemática',
            'PARTIAL_EVALUATION': 'Parcial',
            'FINAL_EVALUATION': 'Final'
        };
        return categories[category] || category;
    };

    const getCategoryColor = (category: string) => {
        const colors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
            'SYSTEMATIC_EVALUATION': 'info',
            'PARTIAL_EVALUATION': 'warning',
            'FINAL_EVALUATION': 'error'
        };
        return colors[category] || 'default';
    };

    const getStudentName = (row: Evaluation | null) => {
        if (!row) return 'N/A';
        if (row.studentId) {
            return `${row.studentId.firstName} ${row.studentId.lastName}`;
        }
        return 'N/A';
    };

    const getCareerName = (row: Evaluation | null) => {
        if (!row || !row.studentId) return '-';

        if (row.studentId.careerId?.name) {
            return row.studentId.careerId.name;
        }

        if (row.studentId.career?.name) {
            return row.studentId.career.name;
        }

        return 'Sin carrera'; 
    };

    return (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Table sx={{ minWidth: 650 }} aria-label="evaluations table">
                <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                        <TableCell sx={{ fontWeight: 600 }}>Estudiante</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Carrera</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Asignatura</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Descripción</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Categoría</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Valor</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Tipo Examen</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                        {(showEdit || showDelete) && (
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Acciones</TableCell>
                        )}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {evaluations.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                                <Typography color="text.secondary">No hay evaluaciones para mostrar</Typography>
                            </TableCell>
                        </TableRow>
                    ) : (
                        evaluations.map((row) => (
                            <TableRow
                                key={row._id}
                                sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) } }}
                            >
                                <TableCell>
                                    <Typography variant="body2" fontWeight={500}>
                                        {getStudentName(row)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">
                                        {getCareerName(row)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">
                                        {row.matriculatedSubjectId?.subjectId?.name || 'N/A'}
                                    </Typography>
                                </TableCell>
                                <TableCell>{row.description || '-'}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={getCategoryLabel(row.category)}
                                        size="small"
                                        color={getCategoryColor(row.category)}
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={row.evaluationValueId?.value || 'N/A'}
                                        size="small"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                </TableCell>
                                <TableCell>{row.examinationTypeId?.name || 'N/A'}</TableCell>
                                <TableCell>{formatDate(row.evaluationDate)}</TableCell>
                                {(showEdit || showDelete) && (
                                    <TableCell align="right">
                                        {showEdit && (
                                            <Tooltip title="Editar">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => onEdit && onEdit(row)}
                                                    sx={{ color: 'primary.main', mr: 1 }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {showDelete && (
                                            <Tooltip title="Eliminar">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteClick(row)}
                                                    sx={{ color: 'error.main' }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            <ModalDialog
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Eliminar Evaluación"
                description={
                    evaluationToDelete
                        ? `¿Estás seguro de que deseas eliminar la evaluación de ${getStudentName(evaluationToDelete)} - ${evaluationToDelete.matriculatedSubjectId?.subjectId?.name || 'N/A'}? Esta acción no se puede deshacer.`
                        : '¿Estás seguro de que deseas eliminar esta evaluación? Esta acción no se puede deshacer.'
                }
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="error"
            />
        </TableContainer>
    );
};

export default EvaluationsTable;
