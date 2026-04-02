import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    IconButton,
    Tooltip,
    Card,
    Typography,
    useTheme,
    Divider
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';
import ReusableTable, { type ReusableTableAction, type ReusableTableColumn } from '../../components/common/ReusableTable';

interface ProfessorSubject {
    _id: string;
    name: string;
    academicYear: number;
    careerId?: {
        _id: string;
        name: string;
    } | string;
}

const ProfessorDashboard: React.FC = () => {
    const theme = useTheme();
    const { user, token, logout } = useAuth();
    const [refreshKey, setRefreshKey] = useState(0);
    const navigate = useNavigate();

    const columns = useMemo<ReusableTableColumn<ProfessorSubject>[]>(() => [
        { field: 'name', headerName: 'Nombre de la asignatura' },
        { field: 'academicYear', headerName: 'Año académico' },
        {
            field: 'careerId',
            headerName: 'Carrera',
            renderCell: (value) => {
                if (!value) return 'Sin carrera';
                if (typeof value === 'string') return value;
                const career = value as { name?: string };
                return career.name || 'Sin carrera';
            }
        }
    ], []);

    const actions = useMemo<ReusableTableAction<ProfessorSubject>[]>(() => [
        {
            variant: 'view',
            label: 'Ver más',
            onClick: (row) => navigate(`/professor/subject/${row._id}`)
        }
    ], []);

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
    };

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Panel del Profesor"
                    subtitle={`Bienvenido, ${user?.firstName || 'Usuario'}. Seleccione una opción para continuar.`}
                    action={
                        <Tooltip title="Actualizar datos">
                            <IconButton onClick={handleRefresh} color="primary">
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    }
                />
                <Card elevation={0} sx={{
                    p: 4,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: theme.palette.background.paper,
                    textAlign: 'left'
                }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Asignaturas impartidas</Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />

                        <ReusableTable<ProfessorSubject>
                            endpoint="/professor/subjects"
                            token={token}
                            columns={columns}
                            actions={actions}
                            rowKey="_id"
                            serverPagination={true}
                            refreshKey={refreshKey}
                            tableAriaLabel="asignaturas del profesor"
                            emptyMessage="No tienes asignaturas asignadas."
                            onUnauthorized={logout}
                            extractRows={(response) => {
                                if (Array.isArray(response)) {
                                    return response as ProfessorSubject[];
                                }
                                if (!response || typeof response !== 'object') {
                                    return [];
                                }
                                const parsed = response as Record<string, unknown>;
                                if (Array.isArray(parsed.data)) {
                                    return parsed.data as ProfessorSubject[];
                                }
                                if (Array.isArray(parsed.items)) {
                                    return parsed.items as ProfessorSubject[];
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
                    </Card>
            </Container>
        </MainLayout>
    );
};

export default ProfessorDashboard;
