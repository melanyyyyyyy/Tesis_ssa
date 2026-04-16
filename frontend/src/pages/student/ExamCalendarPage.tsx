import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Card, CircularProgress, Container, useTheme } from '@mui/material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import ExaminationCalendar from '../../components/common/ExaminationCalendar';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

interface StudentProfileResponse {
    student?: {
        career?: { _id: string; name?: string } | null;
        academicYear?: number;
    } | null;
}

interface StudentRecordSummary {
    _id: string;
    subjectId: string;
    subjectName: string;
    academicYear: number;
}

interface StudentRecordsResponse {
    data?: StudentRecordSummary[];
}

const ExamCalendarPage: React.FC = () => {
    const theme = useTheme();
    const { token, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [careerId, setCareerId] = useState<string | null>(null);
    const [careerName, setCareerName] = useState<string>('Sin carrera');
    const [academicYear, setAcademicYear] = useState<number | null>(null);
    const [subjectIds, setSubjectIds] = useState<string[]>([]);

    useEffect(() => {
        const abortController = new AbortController();

        const loadCalendarContext = async () => {
            if (!token) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const profileResponse = await fetch(`${API_BASE}/common/profile`, {
                    signal: abortController.signal,
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (profileResponse.status === 401) {
                    logout();
                    return;
                }

                if (!profileResponse.ok) {
                    throw new Error('No se pudo cargar el perfil del estudiante');
                }

                const profileResult = await profileResponse.json() as StudentProfileResponse;
                const studentCareer = profileResult.student?.career;
                const studentAcademicYear = profileResult.student?.academicYear;

                if (!studentCareer?._id || typeof studentAcademicYear !== 'number') {
                    throw new Error('No se encontró la carrera o el año académico del estudiante');
                }

                const recordsResponse = await fetch(
                    `${API_BASE}/student/records-summary?academicYear=${studentAcademicYear}`,
                    {
                        signal: abortController.signal,
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (recordsResponse.status === 401) {
                    logout();
                    return;
                }

                if (!recordsResponse.ok) {
                    throw new Error('No se pudieron cargar las asignaturas matriculadas del estudiante');
                }

                const recordsResult = await recordsResponse.json() as StudentRecordsResponse;
                const records = Array.isArray(recordsResult.data) ? recordsResult.data : [];
                const enrolledSubjectIds = Array.from(new Set(records.map((item) => item.subjectId).filter(Boolean)));

                setCareerId(studentCareer._id);
                setCareerName(studentCareer.name || 'Sin carrera');
                setAcademicYear(studentAcademicYear);
                setSubjectIds(enrolledSubjectIds);
                setLoading(false);
            } catch (fetchError) {
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    return;
                }

                setCareerId(null);
                setAcademicYear(null);
                setSubjectIds([]);
                setError(fetchError instanceof Error ? fetchError.message : 'Error desconocido');
                setLoading(false);
            }
        };

        void loadCalendarContext();

        return () => {
            abortController.abort();
        };
    }, [logout, token]);

    const hasEnrolledSubjects = useMemo(() => subjectIds.length > 0, [subjectIds]);

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Calendario de Exámenes"
                    subtitle={academicYear !== null
                        ? `Carrera: ${careerName} | Año académico: ${academicYear}`
                        : 'Consulta las fechas programadas para los exámenes de tus asignaturas matriculadas.'}
                    showBackButton={true}
                    backTo="/student/dashboard"
                />

                {error && (
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : !careerId || academicYear === null ? (
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                        No se pudo determinar la carrera o el año académico del estudiante.
                    </Alert>
                ) : !hasEnrolledSubjects ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                        No tienes asignaturas matriculadas en tu año académico actual.
                    </Alert>
                ) : (
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
                        <ExaminationCalendar
                            carrera={careerId}
                            academicYear={academicYear}
                            allowedSubjectIds={subjectIds}
                            readOnly={true}
                        />
                    </Card>
                )}
            </Container>
        </MainLayout>
    );
};

export default ExamCalendarPage;
