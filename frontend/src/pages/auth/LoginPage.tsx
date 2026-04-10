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
    IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import logoFull from '../../assets/logos/uho-blue.svg';

type Severity = 'error' | 'success' | 'info' | 'warning';
const API_BASE = import.meta.env.VITE_API_BASE;

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

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleNavigate = (path: string, data: { message?: string }) => {
        setFeedbackMsg({ message: data.message || 'Inicio de sesión exitoso.', severity: 'success' });
        setTimeout(() => {
            navigate(path);
        }, 1500);
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
        </Box>
    );
};

export default LoginPage;
