import React from 'react';
import { useLocation } from 'react-router-dom';
import { Container, useTheme, Card } from '@mui/material';
import PageHeader from '../../components/common/PageHeader';
import MainLayout from '../../layouts/MainLayout';
import ExaminationCalendar from '../../components/common/ExaminationCalendar';

interface LocationState {
    subjectId: string;
    subjectName: string;
    careerId: string;
    academicYear: number;
}

const ExamCalendarPage: React.FC = () => {
    const theme = useTheme();
    const location = useLocation();
    const state = location.state as LocationState;

    if (!state) {
        return (
            <MainLayout>
                <Container maxWidth="xl" sx={{ py: 4 }}>
                    <PageHeader
                        title="Calendario de Exámenes"
                        subtitle="No hay datos de asignatura disponibles."
                        showBackButton={true}
                    />
                </Container>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Calendario de Exámenes"
                    subtitle={`Asignatura: ${state.subjectName}`}
                    showBackButton={true}
                />

                <Card elevation={0} sx={{
                    p: 4,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: theme.palette.background.paper,
                    textAlign: 'left'
                }}>
                    <ExaminationCalendar
                        carrera={state.careerId}
                        academicYear={state.academicYear}
                        asignatura={state.subjectId}
                    />
                </Card>
            </Container>
        </MainLayout>
    );
};

export default ExamCalendarPage;