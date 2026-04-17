import { AppBar, Toolbar, Typography, Box, IconButton, Badge, Button, Stack, Avatar, Menu, ListItemText, ListItemIcon, Divider, List, ListItem, ListItemButton } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChatIcon from '@mui/icons-material/Chat';
import CircleIcon from '@mui/icons-material/Circle';
import Tooltip from '@mui/material/Tooltip';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import { ModalDialog } from '../components/common/ModalDialog';
import { useNavigate } from 'react-router-dom';

import logoShort from '../assets/logos/uho-short-white.svg';
import logoFull from '../assets/logos/uho-white.svg';

const API_BASE = import.meta.env.VITE_API_BASE;

interface Notification {
    _id: string;
    title?: string;
    message: string;
    type: 'NEW_EVALUATION' | 'NEW_ATTENDANCE' | 'NEW_EXAM_CALENDAR' | 'SYSTEM_ALERT' | 'INFO' | 'NEW_MESSAGE';
    isRead: boolean;
    link?: string;
    createdAt: string;
}

export const Navbar = () => {
    const { isAuthenticated, user, logout, token } = useAuth();
    const [openLogoutModal, setOpenLogoutModal] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();

    const openNotifications = Boolean(anchorEl);

    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated || !token) return;
        try {
            const response = await fetch(`${API_BASE}/notifications`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.status === 401) {
                logout();
                return;
            }
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [isAuthenticated, logout, token]);

    useEffect(() => {
        if (!isAuthenticated || !token) return;
        const initialFetch = setTimeout(() => {
            void fetchNotifications();
        }, 0);
        const interval = setInterval(fetchNotifications, 10000);
        return () => {
            clearTimeout(initialFetch);
            clearInterval(interval);
        };
    }, [fetchNotifications, isAuthenticated, token]);

    const handleOpenNotifications = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
        fetchNotifications();
    };

    const handleCloseNotifications = () => {
        setAnchorEl(null);
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!token) return;
        if (!notification.isRead) {
            try {
                const response = await fetch(`${API_BASE}/notifications/${notification._id}/read`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.status === 401) {
                    logout();
                    return;
                }
                setNotifications(prev => prev.map(n => 
                    n._id === notification._id ? { ...n, isRead: true } : n
                ));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (error) {
                console.error('Error marking notification as read:', error);
            }
        }

        if (notification.link) {
            navigate(notification.link);
            handleCloseNotifications();
        }
    };

    const handleMarkAllRead = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE}/notifications/read-all`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401) {
                logout();
                return;
            }
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getIconByType = (type: string) => {
        switch (type) {
            case 'SYSTEM_ALERT': return <WarningIcon color="error" fontSize="small" />;
            case 'NEW_EVALUATION': return <CheckCircleIcon color="success" fontSize="small" />;
            case 'NEW_ATTENDANCE': return <CheckCircleIcon color="success" fontSize="small" />;
            case 'NEW_EXAM_CALENDAR': return <InfoIcon color="primary" fontSize="small" />;
            case 'NEW_MESSAGE': return <ChatIcon color="primary" fontSize="small" />;
            case 'INFO': default: return <InfoIcon color="info" fontSize="small" />;
        }
    };

    const getRoleName = (role: string) => {
        const roles: { [key: string]: string } = {
            'admin': 'ADMINISTRADOR',
            'secretary': 'SECRETARIO',
            'vicedean': 'VICEDECANO',
            'student': 'ESTUDIANTE',
            'professor': 'PROFESOR'
        };
        return roles[role] || role.toUpperCase();
    };

    return (
        <AppBar position="sticky" sx={{ bgcolor: 'primary.main' }}>
            <Toolbar sx={{ justifyContent: 'space-between', minHeight: '70px', py: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <img
                        src={isAuthenticated ? logoShort : logoFull}
                        alt="Logo UHo"
                        style={{
                            height: '55px',
                            width: 'auto',
                            display: 'block'
                        }}
                    />
                </Box>
                {isAuthenticated && user && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton 
                            color="inherit"
                            onClick={handleOpenNotifications}
                            aria-controls={openNotifications ? 'notifications-menu' : undefined}
                            aria-haspopup="true"
                            aria-expanded={openNotifications ? 'true' : undefined}
                        >
                            <Badge badgeContent={unreadCount} color="error">
                                <NotificationsIcon />
                            </Badge>
                        </IconButton>

                        <Menu
                            id="notifications-menu"
                            anchorEl={anchorEl}
                            open={openNotifications}
                            onClose={handleCloseNotifications}
                            PaperProps={{
                                elevation: 0,
                                sx: {
                                    overflow: 'visible',
                                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                                    mt: 1.5,
                                    width: 360,
                                    maxHeight: 480,
                                    '& .MuiAvatar-root': {
                                        width: 32,
                                        height: 32,
                                        ml: -0.5,
                                        mr: 1,
                                    },
                                    '&:before': {
                                        content: '""',
                                        display: 'block',
                                        position: 'absolute',
                                        top: 0,
                                        right: 14,
                                        width: 10,
                                        height: 10,
                                        bgcolor: 'background.paper',
                                        transform: 'translateY(-50%) rotate(45deg)',
                                        zIndex: 0,
                                    },
                                },
                            }}
                            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        >
                            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle1" fontWeight="bold">Notificaciones</Typography>
                                {unreadCount > 0 && (
                                    <Button size="small" onClick={handleMarkAllRead}>
                                        Marcar todo como leído
                                    </Button>
                                )}
                            </Box>
                            <Divider />
                            <List sx={{ p: 0, maxHeight: 350, overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <ListItem>
                                        <ListItemText 
                                            primary="No tienes notificaciones" 
                                            sx={{ textAlign: 'center', color: 'text.secondary', py: 2 }} 
                                        />
                                    </ListItem>
                                ) : (
                                    notifications.map((notification) => (
                                        <ListItemButton 
                                            key={notification._id}
                                            onClick={() => handleNotificationClick(notification)}
                                            alignItems="flex-start"
                                            sx={{ 
                                                bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                                                borderLeft: notification.isRead ? 'none' : '4px solid',
                                                borderColor: 'primary.main'
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                                                {getIconByType(notification.type)}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Box display="flex" justifyContent="space-between">
                                                        <Typography variant="body2" fontWeight={notification.isRead ? 'normal' : 'bold'}>
                                                            {notification.title || 'Notificación'}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {new Date(notification.createdAt).toLocaleDateString()}
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondary={
                                                    <Typography
                                                        variant="caption"
                                                        color="text.primary"
                                                        sx={{ display: 'block', mt: 0.5 }}
                                                    >
                                                        {notification.message}
                                                    </Typography>
                                                }
                                            />
                                            {!notification.isRead && (
                                                <CircleIcon color="primary" sx={{ width: 10, height: 10, alignSelf: 'center', ml: 1 }} />
                                            )}
                                        </ListItemButton>
                                    ))
                                )}
                            </List>
                            <Divider />
                            <Box sx={{ p: 1, textAlign: 'center' }}>
                                <Button size="small" fullWidth onClick={() => navigate('/notifications')}>
                                    Ver todas
                                </Button>
                            </Box>
                        </Menu>

                        <Button
                            color="inherit"
                            onClick={() => navigate('/profile')}
                            sx={{
                                textTransform: 'none',
                                textAlign: 'left',
                                borderRadius: 2,
                                px: 1,
                                py: 1,
                                minHeight: 70,
                                height: 'auto',
                                cursor: 'pointer',
                            }}
                        >
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 32, height: 32 }}>
                                    <PersonIcon />
                                </Avatar>

                                <Box>
                                    <Typography variant="subtitle2" sx={{ lineHeight: 1.2, fontWeight: 600 }}>
                                        {user.firstName} {user.lastName}
                                    </Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', lineHeight: 1 }}>
                                        {getRoleName(user.role)}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Button>

                        <Tooltip title="Cerrar Sesión">
                            <IconButton
                                onClick={() => setOpenLogoutModal(true)}
                                sx={{
                                    ml: 1,
                                    bgcolor: 'error.main',
                                    color: 'white',
                                    borderRadius: '50%',
                                    '&:hover': {
                                        bgcolor: 'error.dark',
                                        border: 'none'
                                    },
                                    width: 40,
                                    height: 40
                                }}
                            >
                                <LogoutIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>

                    </Box>
                )}
            </Toolbar>

            <ModalDialog
                open={openLogoutModal}
                onClose={() => setOpenLogoutModal(false)}
                onConfirm={() => {
                    setOpenLogoutModal(false);
                    logout();
                }}
                title="Cerrar Sesión"
                description="¿Estás seguro que deseas cerrar sesión en el sistema?"
                confirmText="Cerrar Sesión"
                variant="error"
            />
        </AppBar>
    );
};
