import React, { useMemo } from 'react';
import { Alert, Box, Button, Container } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
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

interface AttendanceHistoryRecord {
    createdAt: string;
    attendanceDate: string;
    averageAttendance: number;
}

interface AttendanceSaveResponseRow {
    createdAt?: string;
    attendanceDate?: string;
    isPresent?: boolean;
}

interface AttendanceEditPageState {
    subject?: SubjectReference;
    attendanceRecord?: AttendanceHistoryRecord;
    returnTo?: string;
    returnState?: Record<string, unknown>;
}

const SUBJECT_STORAGE_KEY = 'professorSelectedSubject';

const RecordsAttendanceEdit: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const routeState = location.state as AttendanceEditPageState | null;

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

    const attendanceRecord = routeState?.attendanceRecord || null;
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
            returnTo === '/professor/records-attendance-view' &&
            result &&
            typeof result === 'object' &&
            'data' in result &&
            Array.isArray((result as { data?: unknown[] }).data) &&
            (result as { data?: unknown[] }).data &&
            (result as { data?: unknown[] }).data!.length > 0
        ) {
            const savedRows = (result as { data?: unknown[] }).data as AttendanceSaveResponseRow[];
            const firstRow = savedRows[0] || {};
            const presentCount = savedRows.filter((row) => Boolean(row?.isPresent)).length;
            const averageAttendance = savedRows.length > 0
                ? Number(((presentCount / savedRows.length) * 100).toFixed(2))
                : (attendanceRecord?.averageAttendance || 0);

            navigate(returnTo, {
                state: {
                    subject: selectedSubject,
                    attendanceRecord: {
                        createdAt: firstRow.createdAt || attendanceRecord?.createdAt || '',
                        attendanceDate: firstRow.attendanceDate || attendanceRecord?.attendanceDate || '',
                        averageAttendance
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
                    title="Editar registro de asistencia"
                    subtitle={selectedSubject
                        ? `${selectedSubject.name} | Año académico: ${selectedSubject.academicYear} | Carrera: ${subjectCareerName}`
                        : 'No hay asignatura seleccionada.'}
                    showBackButton={false}
                />

                {!selectedSubject || !attendanceRecord ? (
                    <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                        Debes seleccionar un registro de asistencia para editarlo.
                    </Alert>
                ) : (
                    <RegisterAttendance
                        subject={{
                            _id: selectedSubject._id,
                            name: selectedSubject.name,
                            academicYear: selectedSubject.academicYear
                        }}
                        mode="edit"
                        initialAttendanceDate={attendanceRecord.attendanceDate}
                        onSaved={handleSaved}
                        onCancel={handleCancel}
                    />
                )}

                {(!selectedSubject || !attendanceRecord) && (
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

export default RecordsAttendanceEdit;
