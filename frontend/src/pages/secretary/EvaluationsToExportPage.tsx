import React, { useMemo, useState } from 'react';
import {
    Box,
    Alert,
    Container,
    Button,
    Chip,
    IconButton,
    Tooltip
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { type Evaluation } from '../../components/secretary/EvaluationsTable';
import { EvaluationFormDialog } from '../../components/secretary/EvaluationFormDialog';
import { ModalDialog } from '../../components/common/ModalDialog';
import { useAuth } from '../../context/AuthContext';
import ReusableTable, { type ReusableTableAction, type ReusableTableColumn } from '../../components/common/ReusableTable';

const API_BASE = import.meta.env.VITE_API_BASE;

const EvaluationsToExportPage: React.FC = () => {
    const { token, logout } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
    const [evaluationToDelete, setEvaluationToDelete] = useState<Evaluation | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);

    const columns = useMemo<ReusableTableColumn<Evaluation>[]>(() => [
        {
            field: 'studentId',
            headerName: 'Estudiante',
            renderCell: (value) => {
                const student = value as Evaluation['studentId'];
                return student ? `${student.firstName} ${student.lastName}` : 'N/A';
            }
        },
        {
            field: 'studentId',
            headerName: 'Carrera',
            renderCell: (value) => {
                const student = value as Evaluation['studentId'];
                return student?.careerId?.name || student?.career?.name || 'Sin carrera';
            }
        },
        {
            field: 'matriculatedSubjectId',
            headerName: 'Asignatura',
            renderCell: (value) => {
                const matriculatedSubject = value as Evaluation['matriculatedSubjectId'];
                return matriculatedSubject?.subjectId?.name || 'N/A';
            }
        },
        { field: 'description', headerName: 'Descripción', renderCell: (value) => (value as string) || '-' },
        {
            field: 'category',
            headerName: 'Categoría',
            renderCell: (value) => {
                const category = value as string;
                const label =
                    category === 'SYSTEMATIC_EVALUATION' ? 'Sistemática'
                        : category === 'PARTIAL_EVALUATION' ? 'Parcial'
                            : category === 'FINAL_EVALUATION' ? 'Final'
                                : category;
                const color =
                    category === 'SYSTEMATIC_EVALUATION' ? 'info'
                        : category === 'PARTIAL_EVALUATION' ? 'warning'
                            : category === 'FINAL_EVALUATION' ? 'error'
                                : 'default';
                return <Chip label={label} size="small" color={color} variant="outlined" />;
            }
        },
        {
            field: 'evaluationValueId',
            headerName: 'Valor',
            renderCell: (value) => {
                const evaluationValue = value as Evaluation['evaluationValueId'];
                return (
                    <Chip
                        label={evaluationValue?.value || 'N/A'}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                    />
                );
            }
        },
        {
            field: 'examinationTypeId',
            headerName: 'Tipo Examen',
            renderCell: (value) => {
                const examinationType = value as Evaluation['examinationTypeId'];
                return examinationType?.name || 'N/A';
            }
        },
        {
            field: 'evaluationDate',
            headerName: 'Fecha',
            renderCell: (value) => new Date(value as string).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        }
    ], []);

    const handleAdd = () => {
        setSelectedEvaluation(null);
        setFormOpen(true);
    };

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
    };

    const handleEdit = (evaluation: Evaluation) => {
        setSelectedEvaluation(evaluation);
        setFormOpen(true);
    };

    const handleSave = async (data: Partial<Evaluation>) => {
        if (!token) return;
        try {
            setError(null);
            const payload: Partial<Evaluation> = {
                ...data,
                category: 'FINAL_EVALUATION'
            };
            const url = selectedEvaluation
                ? `${API_BASE}/secretary/evaluation/${selectedEvaluation._id}`
                : `${API_BASE}/secretary/evaluation`;

            const method = selectedEvaluation ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Error al guardar la evaluación');
            }

            setFormOpen(false);
            setSelectedEvaluation(null);
            setRefreshKey((prev) => prev + 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar la evaluación');
            throw err;
        }
    };

    const handleDelete = async (evaluation: Evaluation) => {
        if (!token) return;
        try {
            setError(null);
            const response = await fetch(`${API_BASE}/secretary/evaluation/${evaluation._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error('Error al eliminar la evaluación');
            }

            setRefreshKey((prev) => prev + 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al eliminar la evaluación');
        }
    };

    const handleOpenDeleteModal = (evaluation: Evaluation) => {
        setEvaluationToDelete(evaluation);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!evaluationToDelete) return;
        await handleDelete(evaluationToDelete);
        setDeleteModalOpen(false);
        setEvaluationToDelete(null);
    };

    const actions: ReusableTableAction<Evaluation>[] = [
        {
            variant: 'edit',
            label: 'Editar',
            icon: <EditIcon fontSize="small" />,
            onClick: (row) => handleEdit(row)
        },
        {
            variant: 'delete',
            label: 'Eliminar',
            icon: <DeleteIcon fontSize="small" />,
            onClick: (row) => handleOpenDeleteModal(row)
        }
    ];

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Evaluaciones a Exportar"
                    subtitle={`Total de registros: ${totalCount}`}
                    showBackButton={true}
                    action={
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="Actualizar datos">
                                <IconButton onClick={handleRefresh} color="primary">
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleAdd}
                            >
                                Añadir Evaluación
                            </Button>
                        </Box>
                    }
                />

                {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

                <ReusableTable<Evaluation>
                    endpoint="/secretary/pending-grades"
                    token={token}
                    queryParams={{ category: 'FINAL_EVALUATION' }}
                    columns={columns}
                    actions={actions}
                    rowKey="_id"
                    serverPagination={true}
                    refreshKey={refreshKey}
                    tableAriaLabel="pending export table"
                    onTotalCountChange={setTotalCount}
                    onUnauthorized={logout}
                    extractRows={(response) => {
                        if (Array.isArray(response)) {
                            return response as Evaluation[];
                        }
                        if (!response || typeof response !== 'object') {
                            return [];
                        }
                        const parsed = response as Record<string, unknown>;
                        if (Array.isArray(parsed.data)) {
                            return parsed.data as Evaluation[];
                        }
                        if (Array.isArray(parsed.items)) {
                            return parsed.items as Evaluation[];
                        }
                        return [];
                    }}
                    extractTotalCount={(response, rows) => {
                        if (!response || typeof response !== 'object') {
                            return rows.length;
                        }
                        const parsed = response as Record<string, unknown>;
                        return typeof parsed.totalCount === 'number' ? parsed.totalCount : rows.length;
                    }}
                />

                <EvaluationFormDialog
                    open={formOpen}
                    onClose={() => setFormOpen(false)}
                    onSubmit={handleSave}
                    initialData={selectedEvaluation}
                    hideCategory={true}
                />
                <ModalDialog
                    open={deleteModalOpen}
                    onClose={() => {
                        setDeleteModalOpen(false);
                        setEvaluationToDelete(null);
                    }}
                    onConfirm={handleConfirmDelete}
                    title="Eliminar evaluación"
                    description="¿Estás seguro de que deseas eliminar? Estos cambios no se pueden deshacer."
                    confirmText="Eliminar"
                    cancelText="Cancelar"
                    variant="error"
                />
            </Container>
        </MainLayout>
    );
};

export default EvaluationsToExportPage;
