import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Container } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { ModalDialog } from '../../components/common/ModalDialog';
import RegisterAttendance from '../../components/professor/RegisterAttendance';

interface SubjectReference {
    _id: string;
    name: string;
    academicYear: number;
    careerId?: {
        _id: string;
        name: string;
    } | string;
}

const SUBJECT_STORAGE_KEY = 'professorSelectedSubject';

const RegisterAttendancePage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);

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

    const handleRequestCancel = () => {
        setIsExitModalOpen(true);
    };

    const handleConfirmCancel = () => {
        setIsExitModalOpen(false);
        navigate('/professor/subject-detail', { state: { subject: selectedSubject } });
    };

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Registro de Asistencia"
                    subtitle={selectedSubject
                        ? `${selectedSubject.name} | Año académico: ${selectedSubject.academicYear} | Carrera: ${subjectCareerName}`
                        : 'No hay asignatura seleccionada.'}
                    showBackButton={true}
                />

                {!selectedSubject ? (
                    <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                        Debes seleccionar una asignatura para registrar asistencias.
                    </Alert>
                ) : (
                    <RegisterAttendance
                        subject={{
                            _id: selectedSubject._id,
                            name: selectedSubject.name,
                            academicYear: selectedSubject.academicYear
                        }}
                        onSaved={() => navigate('/professor/subject-detail', { state: { subject: selectedSubject } })}
                        onCancel={handleRequestCancel}
                    />
                )}

                {!selectedSubject && (
                    <Box sx={{ py: 2 }}>
                        <Button variant="contained" onClick={() => navigate('/professor/dashboard')}>
                            Volver al panel
                        </Button>
                    </Box>
                )}

                <ModalDialog
                    open={isExitModalOpen}
                    onClose={() => setIsExitModalOpen(false)}
                    onConfirm={handleConfirmCancel}
                    title="Confirmar salida"
                    description="¿Estás seguro de que deseas salir? Los cambios no guardados se perderán."
                    confirmText="Salir"
                    cancelText="Continuar editando"
                    variant="error"
                />
            </Container>
        </MainLayout>
    );
};

export default RegisterAttendancePage;
