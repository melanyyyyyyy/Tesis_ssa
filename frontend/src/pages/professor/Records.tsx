import React, { useMemo, useState } from 'react';
import { Container, Stack, Typography, Card, Box, Tooltip, IconButton } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ReusableTable, { type ReusableTableColumn } from '../../components/common/ReusableTable';
import ExportToPDF, { type ExportTableConfig } from '../../components/common/ExportToPDF';
import { useAuth } from '../../context/AuthContext';
import { ModalDialog } from '../../components/common/ModalDialog';

const API_BASE = import.meta.env.VITE_API_BASE;

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
    examinationType: string;
    evaluationDate: string;
    description: string;
    evaluationAverage: number;
}

interface AttendanceHistoryRecord {
    createdAt: string;
    attendanceDate: string;
    averageAttendance: number;
}

const SUBJECT_STORAGE_KEY = 'professorSelectedSubject';

const categoryLabels: Record<string, string> = {
    'SYSTEMATIC_EVALUATION': 'Sistemática',
    'PARTIAL_EVALUATION': 'Parcial',
    'FINAL_EVALUATION': 'Final'
};

const HistoryRecords: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [refreshKey, setRefreshKey] = useState(0);
    const [deleteModal, setDeleteModal] = useState<{
        open: boolean;
        type: 'evaluation' | 'attendance' | null;
        record: any | null;
    }>({ open: false, type: null, record: null });

    const handleRefresh = () => setRefreshKey(prev => prev + 1);

    const handleDeleteClick = (type: 'evaluation' | 'attendance', record: any) => {
        setDeleteModal({ open: true, type, record });
    };

    const confirmDelete = async () => {
        if (!deleteModal.record || !deleteModal.type || !token) return;

        try {
            const endpoint = deleteModal.type === 'evaluation' 
                ? '/professor/evaluation-batch' 
                : '/professor/attendance-batch';
            
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    subjectId: selectedSubject?._id,
                    createdAt: deleteModal.record.createdAt
                })
            });

            if (!response.ok) throw new Error('Error al eliminar los registros');

            handleRefresh();
        } catch (error) {
            console.error('Error deleting batch:', error);
            alert('No se pudo eliminar el registro');
        } finally {
            setDeleteModal({ open: false, type: null, record: null });
        }
    };

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

    const evaluationColumns = useMemo<ReusableTableColumn<EvaluationHistoryRecord>[]>(() => [
        { 
            field: 'category', 
            headerName: 'Tipo de evaluación',
            renderCell: (value) => categoryLabels[value as string] || value as string
        },
        { field: 'examinationType', headerName: 'Tipo de examen' },
        { 
            field: 'evaluationDate', 
            headerName: 'Fecha de evaluación',
            renderCell: (value) => new Date(value as string).toLocaleDateString()
        },
        { field: 'description', headerName: 'Descripción' },
        { 
            field: 'evaluationAverage', 
            headerName: 'Promedio de Evaluación',
            renderCell: (value) => Number(value).toFixed(2)
        }
    ], []);

    const attendanceColumns = useMemo<ReusableTableColumn<AttendanceHistoryRecord>[]>(() => [
        { 
            field: 'attendanceDate', 
            headerName: 'Fecha de asistencia',
            renderCell: (value) => new Date(value as string).toLocaleDateString()
        },
        { 
            field: 'averageAttendance', 
            headerName: 'Promedio de asistencia',
            renderCell: (value) => `${Number(value).toFixed(2)}%`
        }
    ], []);

    const evaluationActions = useMemo(() => [
        {
            variant: 'view' as const,
            label: 'Visualizar',
            onClick: (row: EvaluationHistoryRecord) => navigate('/professor/records-evaluation-view', {
                state: {
                    subject: selectedSubject,
                    evaluationRecord: row
                }
            })
        },
        {
            variant: 'edit' as const,
            label: 'Editar',
            onClick: (row: EvaluationHistoryRecord) => {
                console.log('Editar evaluación', row);
                // navigate('/professor/edit-evaluation', { state: { record: row, subject: selectedSubject } });
            }
        },
        {
            variant: 'delete' as const,
            label: 'Eliminar',
            onClick: (row: EvaluationHistoryRecord) => handleDeleteClick('evaluation', row)
        }
    ], [navigate, selectedSubject]);

    const attendanceActions = useMemo(() => [
        {
            variant: 'view' as const,
            label: 'Visualizar',
            onClick: (row: AttendanceHistoryRecord) => navigate('/professor/records-attendance-view', {
                state: {
                    subject: selectedSubject,
                    attendanceRecord: row
                }
            })
        },
        {
            variant: 'edit' as const,
            label: 'Editar',
            onClick: (row: AttendanceHistoryRecord) => {
                console.log('Editar asistencia', row);
            }
        },
        {
            variant: 'delete' as const,
            label: 'Eliminar',
            onClick: (row: AttendanceHistoryRecord) => handleDeleteClick('attendance', row)
        }
    ], [navigate, selectedSubject]);

    const pdfTables = useMemo<ExportTableConfig<any>[]>(() => [
        {
            title: 'Registros de Evaluación',
            endpoint: '/professor/subject-evaluation-history',
            queryParams: { subjectId: selectedSubject?._id },
            columns: evaluationColumns,
            extractRows: (res: any) => res.data || []
        },
        {
            title: 'Registros de Asistencia',
            endpoint: '/professor/subject-attendance-history',
            queryParams: { subjectId: selectedSubject?._id },
            columns: attendanceColumns,
            extractRows: (res: any) => res.data || []
        }
    ], [selectedSubject, evaluationColumns, attendanceColumns]);

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Historial de Registros"
                    subtitle={selectedSubject
                        ? `${selectedSubject.name} | Año académico: ${selectedSubject.academicYear} | Carrera: ${subjectCareerName}`
                        : 'No hay asignatura seleccionada.'}
                    showBackButton={true}
                    backTo="/professor/subject-detail"
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
                                fileName={`Historial_${selectedSubject?.name || 'Registros'}.pdf`}
                                institutionName="Sistema de Seguimiento Académico"
                                reportSubtitle={`Historial de Evaluaciones y Asistencias - ${selectedSubject?.name}`}
                            />
                        </Box>
                    }
                />

                <Stack spacing={4}>
                    <Card elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h6" fontWeight="bold">Registros de Evaluación</Typography>
                        </Box>
                        <ReusableTable
                            endpoint="/professor/subject-evaluation-history"
                            token={token}
                            columns={evaluationColumns}
                            queryParams={{ subjectId: selectedSubject?._id }}
                            actions={evaluationActions}
                            rowKey="createdAt"
                            refreshKey={refreshKey}
                        />
                    </Card>

                    <Card elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h6" fontWeight="bold">Registros de Asistencia</Typography>
                        </Box>
                        <ReusableTable
                            endpoint="/professor/subject-attendance-history"
                            token={token}
                            columns={attendanceColumns}
                            queryParams={{ subjectId: selectedSubject?._id }}
                            actions={attendanceActions}
                            rowKey="createdAt"
                            refreshKey={refreshKey}
                        />
                    </Card>
                </Stack>

                <ModalDialog
                    open={deleteModal.open}
                    onClose={() => setDeleteModal({ open: false, type: null, record: null })}
                    onConfirm={confirmDelete}
                    title="Confirmar eliminación"
                    description={`¿Estás seguro de que deseas eliminar este lote de registros de ${deleteModal.type === 'evaluation' ? 'evaluación' : 'asistencia'}? Esta acción no se puede deshacer.`}
                    confirmText="Eliminar"
                    cancelText="Cancelar"
                    variant="error"
                />
            </Container>
        </MainLayout>
    );
};

export default HistoryRecords;
