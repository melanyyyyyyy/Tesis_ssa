import React, { useState } from 'react';
import {
    Box,
    Paper,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    InputAdornment,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import logoFull from '../../assets/logos/uho-blue.svg';

type Severity = 'error' | 'success' | 'info' | 'warning';
const API_BASE = import.meta.env.VITE_API_BASE;

interface FacultyOption {
    _id: string;
    name: string;
}

interface PendingRoleRequest {
    _id: string;
    requestedRole: string;
    faculty: FacultyOption | null;
}

type RequestedRole = 'admin' | 'secretary' | 'vicedean' | 'professor' | '';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState<{
        message: string | null;
        severity: Severity;
    }>({
        message: null,
        severity: 'error'
    });
    const [loading, setLoading] = useState(false);
    const [roleRequestDialogOpen, setRoleRequestDialogOpen] = useState(false);
    const [roleRequestUserId, setRoleRequestUserId] = useState('');
    const [selectedRequestedRole, setSelectedRequestedRole] = useState<RequestedRole>('');
    const [faculties, setFaculties] = useState<FacultyOption[]>([]);
    const [selectedFacultyId, setSelectedFacultyId] = useState('');
    const [loadingFaculties, setLoadingFaculties] = useState(false);
    const [submittingRoleRequest, setSubmittingRoleRequest] = useState(false);
    const [roleRequestError, setRoleRequestError] = useState<string | null>(null);

    const { login } = useAuth();
    const navigate = useNavigate();
    const requiresFaculty = selectedRequestedRole === 'secretary'
        || selectedRequestedRole === 'vicedean'
        || selectedRequestedRole === 'professor';

    const handleNavigate = (path: string, data: { message?: string }) => {
        setFeedbackMsg({ message: data.message || 'Inicio de sesión exitoso.', severity: 'success' });
        setTimeout(() => {
            navigate(path);
        }, 1500);
    };

    const handleCloseRoleRequestDialog = () => {
        if (submittingRoleRequest) return;
        closeRoleRequestDialog();
    };

    const closeRoleRequestDialog = () => {
        setRoleRequestDialogOpen(false);
        setRoleRequestUserId('');
        setSelectedRequestedRole('');
        setSelectedFacultyId('');
        setRoleRequestError(null);
    };

    const fetchFacultiesForRoleRequest = async () => {
        setLoadingFaculties(true);
        setRoleRequestError(null);

        try {
            const response = await fetch(`${API_BASE}/auth/faculties`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || 'No se pudieron cargar las facultades.');
            }

            setFaculties(Array.isArray(data.data) ? data.data : []);
        } catch (err: any) {
            setRoleRequestError(err.message || 'No se pudieron cargar las facultades.');
            setFaculties([]);
        } finally {
            setLoadingFaculties(false);
        }
    };

    const handleOpenRoleRequestDialog = async (userId: string) => {
        setRoleRequestUserId(userId);
        setSelectedRequestedRole('');
        setSelectedFacultyId('');
        setFaculties([]);
        setRoleRequestError(null);
        setRoleRequestDialogOpen(true);
        await fetchFacultiesForRoleRequest();
    };

    const handleSubmitRoleRequest = async () => {
        if (!roleRequestUserId || !selectedRequestedRole) {
            setRoleRequestError('Debe seleccionar el rol que desea solicitar.');
            return;
        }

        if (requiresFaculty && !selectedFacultyId) {
            setRoleRequestError('Debe seleccionar una facultad.');
            return;
        }

        setSubmittingRoleRequest(true);
        setRoleRequestError(null);

        try {
            const response = await fetch(`${API_BASE}/auth/role-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: roleRequestUserId,
                    requestedRole: selectedRequestedRole,
                    facultyId: selectedFacultyId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 409 && data.hasPendingRoleRequest) {
                    const pendingRequest = data.pendingRoleRequest as PendingRoleRequest | null;
                    const roleLabel = pendingRequest?.requestedRole
                        ? `Rol solicitado: ${pendingRequest.requestedRole}.`
                        : '';
                    const facultyLabel = pendingRequest?.faculty?.name
                        ? ` Facultad: ${pendingRequest.faculty.name}.`
                        : '';

                    throw new Error(
                        data.error || `Ya tiene una solicitud pendiente por aprobar. ${roleLabel}${facultyLabel}`.trim()
                    );
                }
                if (response.status === 403 && data.hasRejectedRoleRequest) {
                    throw new Error(
                        data.error || 'Su solicitud anterior fue rechazada. No puede enviar una nueva solicitud en este momento.'
                    );
                }
                throw new Error(data.error || data.message || 'No se pudo enviar la solicitud.');
            }

            closeRoleRequestDialog();
            setFeedbackMsg({
                message: data.message || 'Solicitud enviada correctamente.',
                severity: 'success'
            });
        } catch (err: any) {
            setRoleRequestError(err.message || 'No se pudo enviar la solicitud.');
        } finally {
            setSubmittingRoleRequest(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFeedbackMsg({ message: null, severity: 'error' });
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403 && data.userCreated && data.hasRejectedRoleRequest) {
                    closeRoleRequestDialog();
                    setFeedbackMsg({
                        message: data.message || 'Su solicitud de rol fue rechazada. Contacte con un administrador.',
                        severity: 'error'
                    });
                    return;
                }

                if (response.status === 403 && data.userCreated && data.hasPendingRoleRequest) {
                    const pendingRequest = data.pendingRoleRequest as PendingRoleRequest | null;
                    const roleLabel = pendingRequest?.requestedRole
                        ? `Rol solicitado: ${pendingRequest.requestedRole}.`
                        : '';
                    const facultyLabel = pendingRequest?.faculty?.name
                        ? ` Facultad: ${pendingRequest.faculty.name}.`
                        : '';

                    closeRoleRequestDialog();
                    setFeedbackMsg({
                        message: data.message || `Ya tiene una solicitud pendiente por aprobar. ${roleLabel}${facultyLabel}`.trim(),
                        severity: 'info'
                    });
                    return;
                }

                if (response.status === 403 && data.userCreated && data.requiresRoleRequest && data.userId) {
                    await handleOpenRoleRequestDialog(String(data.userId));
                    setFeedbackMsg({
                        message: data.message || 'Usted aun no se encuentra registrado en el sistema.',
                        severity: 'info'
                    });
                    return;
                }
                if (response.status === 403 && data.userCreated) {
                    throw new Error(data.message || 'Usuario registrado pero sin rol asignado. Contacte al administrador.');
                }
                throw new Error(data.message || 'Error al iniciar sesión');
            }

            login(data.token, data.user);

            if (data.user.role === 'secretary') {
                handleNavigate('/secretary/dashboard', data);
            } else if (data.user.role === 'professor') {
                handleNavigate('/professor/dashboard', data);
            } else if (data.user.role === 'student') {
                handleNavigate('/student/dashboard', data);
            } else if (data.user.role === 'vicedean') {
                handleNavigate('/vicedean/dashboard', data);
            } else if (data.user.role === 'admin') {
                handleNavigate('/admin/dashboard', data);
            }
            else {
                handleNavigate('/', data);
            }

        } catch (err: any) {
            setFeedbackMsg({ message: err.message || 'Ocurrió un error inesperado', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.100',
                backgroundImage: 'url(/university-bg.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}
        >
            <Paper
                elevation={3}
                sx={{
                    p: 4,
                    maxWidth: 400,
                    width: '100%',
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}
            >
                <Box sx={{
                    mb: 2, p: 2, borderRadius: 1, width: '100%', display: 'flex', justifyContent: 'center', height: {
                        xs: 60,
                        sm: 80,
                        md: 110
                    },
                }}>
                    <img src={logoFull} alt="UHo Logo" style={{ height: '100%', width: 'auto', objectFit: 'contain', maxWidth: '100%' }} />
                </Box>

                <Typography variant="h5" component="h1" gutterBottom fontWeight="600" color="text.primary">
                    Iniciar Sesión
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Ingrese sus credenciales institucionales
                </Typography>

                {feedbackMsg.message && (
                    <Alert severity={`${feedbackMsg.severity}`} sx={{ width: '100%', mb: 2 }}>
                        {feedbackMsg.message}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                    <TextField
                        fullWidth
                        label="Usuario"
                        variant="outlined"
                        margin="normal"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        disabled={loading}
                        autoFocus
                    />

                    <TextField
                        fullWidth
                        label="Contraseña"
                        type={showPassword ? 'text' : 'password'}
                        variant="outlined"
                        margin="normal"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() => setShowPassword(!showPassword)}
                                        edge="end"
                                    >
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading}
                        sx={{ mt: 3, mb: 2 }}
                    >
                        {loading ? <CircularProgress size={24} /> : 'Entrar'}
                    </Button>
                </Box>
            </Paper>
            <Dialog open={roleRequestDialogOpen} onClose={handleCloseRoleRequestDialog} fullWidth maxWidth="sm">
                <DialogTitle>Solicitud de registro</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
                        Usted aun no se encuentra registrado en el sistema. Seleccione el rol que desea solicitar y, si corresponde, la facultad en la que usted desempeña sus funciones.
                    </Typography>

                    {roleRequestError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {roleRequestError}
                        </Alert>
                    )}

                    <FormControl fullWidth disabled={submittingRoleRequest} sx={{ mb: 2 }}>
                        <InputLabel id="role-request-label">Rol solicitado</InputLabel>
                        <Select
                            labelId="role-request-label"
                            value={selectedRequestedRole}
                            label="Rol solicitado"
                            onChange={(event) => {
                                const nextRole = event.target.value as RequestedRole;
                                setSelectedRequestedRole(nextRole);
                                if (nextRole !== 'secretary' && nextRole !== 'vicedean' && nextRole !== 'professor') {
                                    setSelectedFacultyId('');
                                }
                            }}
                        >
                            <MenuItem value="admin">Administrador</MenuItem>
                            <MenuItem value="secretary">Secretario</MenuItem>
                            <MenuItem value="vicedean">Vicedecano</MenuItem>
                            <MenuItem value="professor">Profesor</MenuItem>
                        </Select>
                    </FormControl>

                    {requiresFaculty && (
                        <FormControl fullWidth disabled={loadingFaculties || submittingRoleRequest}>
                            <InputLabel id="faculty-role-request-label">Facultad</InputLabel>
                            <Select
                                labelId="faculty-role-request-label"
                                value={selectedFacultyId}
                                label="Facultad"
                                onChange={(event) => setSelectedFacultyId(event.target.value)}
                            >
                                {faculties.length > 0 ? faculties.map((faculty) => (
                                    <MenuItem key={faculty._id} value={faculty._id}>
                                        {faculty.name}
                                    </MenuItem>
                                )) : (
                                    <MenuItem disabled>
                                        {loadingFaculties ? 'Cargando facultades...' : 'No hay facultades disponibles'}
                                    </MenuItem>
                                )}
                            </Select>
                        </FormControl>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseRoleRequestDialog} color="inherit" disabled={submittingRoleRequest}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmitRoleRequest}
                        variant="contained"
                        disabled={submittingRoleRequest || !selectedRequestedRole || (requiresFaculty && (loadingFaculties || !selectedFacultyId))}
                    >
                        {submittingRoleRequest ? 'Enviando...' : 'Enviar solicitud'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default LoginPage;
