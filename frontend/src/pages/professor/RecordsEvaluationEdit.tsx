import React, { useMemo } from 'react';
import { Alert, Box, Button, Container } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import RegisterEvaluation from '../../components/professor/RegisterEvaluation';

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

interface EvaluationSaveResponseRow {
    createdAt?: string;
    category?: string;
    evaluationDate?: string;
    description?: string;
}

interface EvaluationEditPageState {
    subject?: SubjectReference;
    evaluationRecord?: EvaluationHistoryRecord;
    returnTo?: string;
    returnState?: Record<string, unknown>;
}

const SUBJECT_STORAGE_KEY = 'professorSelectedSubject';

const RecordsEvaluationEdit: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const routeState = location.state as EvaluationEditPageState | null;

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

    const evaluationRecord = routeState?.evaluationRecord || null;
    const returnTo = routeState?.returnTo || '/professor/history-records';
    const returnState = routeState?.returnState || (selectedSubject ? { subject: selectedSubject } : undefined);

    const subjectCareerName = useMemo(() => {
        if (!selectedSubject?.careerId) return 'Sin carrera';
        if (typeof selectedSubject.careerId === 'string') return selectedSubject.careerId;
        return selectedSubject.careerId.name || 'Sin carrera';
    }, [selectedSubject]);

    const handleCancel = () => {
        navigate(returnTo, { state: returnState });
    };

    const handleSaved = (result: unknown) => {
        if (
            returnTo === '/professor/records-evaluation-view' &&
            result &&
            typeof result === 'object' &&
            'data' in result &&
            Array.isArray((result as { data?: unknown[] }).data) &&
            (result as { data?: unknown[] }).data &&
            (result as { data?: unknown[] }).data!.length > 0
        ) {
            const firstRow = ((result as { data?: unknown[] }).data?.[0] || {}) as EvaluationSaveResponseRow;
            navigate(returnTo, {
                state: {
                    subject: selectedSubject,
                    evaluationRecord: {
                        createdAt: firstRow.createdAt || evaluationRecord?.createdAt || '',
                        category: firstRow.category || evaluationRecord?.category || '',
                        examinationTypeId: evaluationRecord?.examinationTypeId || '',
                        examinationType: evaluationRecord?.examinationType || '',
                        evaluationDate: firstRow.evaluationDate || evaluationRecord?.evaluationDate || '',
                        description: firstRow.description || evaluationRecord?.description || '',
                        evaluationAverage: evaluationRecord?.evaluationAverage || 0
                    }
                }
            });
            return;
        }

        navigate(returnTo, { state: returnState });
    };

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Editar registro de evaluación"
                    subtitle={selectedSubject
                        ? `${selectedSubject.name} | Año académico: ${selectedSubject.academicYear} | Carrera: ${subjectCareerName}`
                        : 'No hay asignatura seleccionada.'}
                    showBackButton={false}
                />

                {!selectedSubject || !evaluationRecord ? (
                    <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                        Debes seleccionar un registro de evaluación para editarlo.
                    </Alert>
                ) : (
                    <RegisterEvaluation
                        subject={{
                            _id: selectedSubject._id,
                            name: selectedSubject.name,
                            academicYear: selectedSubject.academicYear
                        }}
                        mode="edit"
                        initialCategory={evaluationRecord.category as 'SYSTEMATIC_EVALUATION' | 'PARTIAL_EVALUATION' | 'FINAL_EVALUATION'}
                        initialEvaluationDate={evaluationRecord.evaluationDate}
                        initialExaminationTypeId={evaluationRecord.examinationTypeId}
                        initialDescription={evaluationRecord.description}
                        onSaved={handleSaved}
                        onCancel={handleCancel}
                    />
                )}

                {(!selectedSubject || !evaluationRecord) && (
                    <Box sx={{ py: 2 }}>
                        <Button variant="contained" onClick={handleCancel}>
                            Volver
                        </Button>
                    </Box>
                )}
            </Container>
        </MainLayout>
    );
};

export default RecordsEvaluationEdit;
