import React, { useState } from 'react';
import {
    Box,
    Chip,
    Container,
    useTheme,
    Card,
    Divider,
    Typography
} from '@mui/material';
import PageHeader from '../../components/common/PageHeader';
import MainLayout from '../../layouts/MainLayout';
import ReusableTable, { type ReusableTableColumn } from '../../components/common/ReusableTable';
import { useAuth } from '../../context/AuthContext';

interface NotificationItem {
    _id: string;
    title?: string;
    message: string;
    type: 'NEW_EVALUATION' | 'SYSTEM_ALERT' | 'INFO' | 'NEW_MESSAGE';
    isRead: boolean;
    createdAt: string;
}

const NotificationPage: React.FC = () => {
    const theme = useTheme();
    const { token, logout } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    const columns: ReusableTableColumn<NotificationItem>[] = [
        { field: 'title', headerName: 'Título', renderCell: (value) => (value as string) || 'Notificación' },
        { field: 'message', headerName: 'Mensaje' },
        { field: 'type', headerName: 'Tipo' },
        {
            field: 'isRead',
            headerName: 'Leída',
            renderCell: (value) => (
                <Chip
                    size="small"
                    label={value ? 'Sí' : 'No'}
                    color={value ? 'default' : 'primary'}
                />
            )
        },
        {
            field: 'createdAt',
            headerName: 'Fecha',
            renderCell: (value) => new Date(value as string).toLocaleString('es-ES')
        }
    ];

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Mis Notificaciones"
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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Listado</Typography>
                        <Chip label={`No leídas: ${unreadCount}`} color={unreadCount > 0 ? 'primary' : 'default'} />
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <ReusableTable<NotificationItem>
                        endpoint="/common/notifications"
                        token={token}
                        columns={columns}
                        rowKey="_id"
                        emptyMessage="No tienes notificaciones."
                        initialRowsPerPage={10}
                        rowsPerPageOptions={[10, 25, 50]}
                        onUnauthorized={logout}
                        extractRows={(response) => {
                            if (!response || typeof response !== 'object') {
                                setUnreadCount(0);
                                return [];
                            }

                            const parsed = response as {
                                notifications?: NotificationItem[];
                                unreadCount?: number;
                            };

                            setUnreadCount(parsed.unreadCount ?? 0);
                            return parsed.notifications ?? [];
                        }}
                    />
                </Card>
            </Container>
        </MainLayout>
    )
}

export default NotificationPage;
