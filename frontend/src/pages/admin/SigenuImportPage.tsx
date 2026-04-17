import React, { useState, useRef, useEffect } from 'react';
import {
    Button, LinearProgress, Alert, Box, Typography, Card,
    Divider, useTheme, IconButton, alpha, Container
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CancelIcon from '@mui/icons-material/Cancel';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;
const CHUNK_SIZE = 5 * 1024 * 1024;

interface UploadState {
    file: File | null;
    progress: number;
    status: 'idle' | 'uploading' | 'completed' | 'error';
    message: string;
    fileId: string | null;
}

const SigenuImportPage: React.FC = () => {
    const theme = useTheme();
    const { token } = useAuth();
    const [state, setState] = useState<UploadState>({
        file: null,
        progress: 0,
        status: 'idle',
        message: '',
        fileId: null
    });

    const abortController = useRef<AbortController | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const progressInterval = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (abortController.current) abortController.current.abort();
            stopSimulation();
        };
    }, []);

    const stopSimulation = () => {
        if (progressInterval.current) {
            clearInterval(progressInterval.current);
            progressInterval.current = null;
        }
    };

    const startSimulation = (start: number, end: number, durationMs: number) => {
        stopSimulation();
        setState(prev => ({ ...prev, progress: start }));

        const stepTime = 200;
        const totalSteps = durationMs / stepTime;
        const increment = (end - start) / totalSteps;

        progressInterval.current = setInterval(() => {
            setState(prev => {
                if (prev.progress >= end) {
                    stopSimulation();
                    return prev;
                }
                return { ...prev, progress: prev.progress + increment };
            });
        }, stepTime);
    };

    const generateFileId = (file: File): string => {
        return `sigenu-${file.name}-${file.size}-${file.lastModified}`;
    };

    const isBackupFile = (file: File): boolean => {
        return file.name.toLowerCase().endsWith('.backup');
    };

    const handleRemoveFile = () => {
        stopSimulation();
        setState({
            file: null,
            status: 'idle',
            progress: 0,
            message: '',
            fileId: null
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!isBackupFile(file)) {
            setState(prev => ({
                ...prev,
                status: 'error',
                message: 'Formato no válido. Solo se permiten archivos .backup del SIGENU'
            }));
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setState({
            file,
            progress: 0,
            status: 'idle',
            message: '',
            fileId: generateFileId(file)
        });
    };

    const uploadChunk = async (chunkIndex: number, chunk: Blob, totalChunks: number, fileId: string): Promise<boolean> => {
        try {
            const formData = new FormData();
            formData.append('chunk', chunk);
            formData.append('chunkIndex', chunkIndex.toString());
            formData.append('totalChunks', totalChunks.toString());
            formData.append('fileId', fileId);
            formData.append('fileName', state.file!.name);

            const response = await fetch(`${API_BASE}/sigenu/import/upload-chunk`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
                signal: abortController.current?.signal
            });

            if (!response.ok) throw new Error(`Error en la subida: ${response.status}`);

            const uploadPercentage = ((chunkIndex + 1) / totalChunks) * 40;

            setState(prev => ({
                ...prev,
                progress: uploadPercentage,
                message: 'Subiendo archivo al servidor...'
            }));

            return true;
        } catch (error: any) {
            if (error.name === 'AbortError') return false;
            throw error;
        }
    };

    const handleMigrate = async (backupPath: string, signal?: AbortSignal) => {
        const migrateRes = await fetch(`${API_BASE}/sigenu/import/migrate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ backupPath }),
            signal
        });

        if (!migrateRes.ok) {
            const errorData = await migrateRes.json().catch(() => ({}));
            throw new Error(errorData.message || 'Error en la migración final de datos');
        }
    };

    const handleUpload = async () => {
        if (!state.file || !state.fileId) return;

        abortController.current = new AbortController();
        const totalChunks = Math.ceil(state.file.size / CHUNK_SIZE);

        setState(prev => ({ ...prev, status: 'uploading', progress: 0, message: 'Iniciando carga...' }));

        try {
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, state.file.size);
                const chunk = state.file.slice(start, end);

                const success = await uploadChunk(i, chunk, totalChunks, state.fileId);
                if (!success) return;
            }

            setState(prev => ({ ...prev, progress: 40, message: 'Verificando integridad y uniendo fragmentos...' }));
            const mergeRes = await fetch(`${API_BASE}/sigenu/import/merge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ fileId: state.fileId, fileName: state.file.name }),
                signal: abortController.current?.signal
            });
            if (!mergeRes.ok) throw new Error('Error al reconstruir el archivo de respaldo');
            const { backupPath } = await mergeRes.json();

            setState(prev => ({ ...prev, progress: 50 }));

            setState(prev => ({ ...prev, message: 'Restaurando estructura en PostgreSQL...' }));
            startSimulation(50, 70, 120000);

            const restoreRes = await fetch(`${API_BASE}/sigenu/import/restore`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ backupPath }),
                signal: abortController.current?.signal
            });
            if (!restoreRes.ok) throw new Error('Error durante la restauración de PostgreSQL');

            stopSimulation();
            setState(prev => ({ ...prev, progress: 75 }));

            setState(prev => ({ ...prev, message: 'Migrando datos y estudiantes a MongoDB...' }));
            startSimulation(75, 95, 80000);

            await handleMigrate(backupPath, abortController.current?.signal);

            stopSimulation();
            setState(prev => ({
                ...prev,
                progress: 100,
                status: 'completed',
                message: '¡Sincronización completada exitosamente!'
            }));

        } catch (error: any) {
            stopSimulation();
            if (error.name === 'AbortError') return;
            setState(prev => ({
                ...prev,
                status: 'error',
                message: error.message || 'Error crítico en la conexión'
            }));
        }
    };

    const handleCancel = () => {
        stopSimulation();
        if (abortController.current) abortController.current.abort();
        setState(prev => ({ ...prev, status: 'idle', progress: 0, message: 'Operación cancelada' }));
    };

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Importación de Base de Datos"
                    subtitle="Seleccione el archivo .backup generado por el sistema SIGENU. El proceso puede demorar unos minutos."
                    showBackButton={true}
                />

                <Card elevation={0} sx={{
                    p: 4,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: theme.palette.background.paper
                }}>
                    <Box sx={{
                        textAlign: 'center',
                        mb: 4,
                        p: 4,
                        borderRadius: 2,
                        border: '1px dashed',
                        borderColor: alpha(theme.palette.primary.main, 0.3),
                        bgcolor: alpha(theme.palette.primary.main, 0.02)
                    }}>
                        <input
                            type="file"
                            accept=".backup"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                        />

                        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                            <Box sx={{
                                width: 64,
                                height: 64,
                                borderRadius: '50%',
                                bgcolor: alpha(state.status === 'completed' ? theme.palette.success.main : theme.palette.primary.main, 0.1),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: state.status === 'completed' ? 'success.main' : 'primary.main',
                                mb: 2
                            }}>
                                {state.status === 'completed' ? <CheckCircleIcon fontSize="large" /> : <CloudUploadIcon fontSize="large" />}
                            </Box>
                        </Box>

                        <Typography variant="h6" gutterBottom>
                            {state.status === 'completed' ? 'Archivo Procesado' : 'Seleccionar Archivo de Respaldo'}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            {state.status === 'completed'
                                ? 'El archivo ha sido sincronizado exitosamente.'
                                : 'Selecciona un archivo .backup generado por el SIGENU para iniciar la sincronización.'}
                        </Typography>

                        <Button
                            variant="outlined"
                            onClick={() => {
                                if (fileInputRef.current) fileInputRef.current.value = '';
                                fileInputRef.current?.click();
                            }}
                            disabled={state.status === 'uploading'}
                            sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600
                            }}
                        >
                            {state.status === 'completed' ? 'Seleccionar otro archivo' : 'Explorar archivos'}
                        </Button>
                    </Box>

                    {state.file && (
                        <Box sx={{
                            mb: 3,
                            p: 2,
                            bgcolor: alpha(theme.palette.background.default, 0.5),
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2
                        }}>
                            <Box sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: alpha(state.status === 'completed' ? theme.palette.success.main : theme.palette.primary.main, 0.1),
                                color: state.status === 'completed' ? 'success.main' : 'primary.main',
                                display: 'flex'
                            }}>
                                <StorageIcon />
                            </Box>
                            <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="subtitle2" fontWeight={600}>{state.file.name}</Typography>
                                <Typography variant="caption" color="textSecondary">
                                    {(state.file.size / 1024 / 1024).toFixed(2)} MB
                                </Typography>
                            </Box>
                            {state.status !== 'uploading' && state.status !== 'completed' && (
                                <IconButton size="small" onClick={handleRemoveFile}>
                                    <CancelIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    )}

                    {state.status === 'uploading' && (
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="primary" fontWeight={600}>
                                    {state.message}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {Math.round(state.progress)}%
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={state.progress}
                                sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    mb: 1,
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    '& .MuiLinearProgress-bar': {
                                        borderRadius: 4,
                                        transition: 'transform 0.4s linear'
                                    }
                                }}
                            />
                        </Box>
                    )}

                    {(state.status === 'error' || state.status === 'completed') && (
                        <Alert
                            severity={state.status === 'error' ? 'error' : 'success'}
                            sx={{
                                mb: 3,
                                borderRadius: 2,
                                bgcolor: alpha(state.status === 'error' ? theme.palette.error.main : theme.palette.success.main, 0.1),
                                border: '1px solid',
                                borderColor: alpha(state.status === 'error' ? theme.palette.error.main : theme.palette.success.main, 0.2),
                            }}
                            icon={state.status === 'completed' ? <CheckCircleIcon fontSize="inherit" /> : undefined}
                        >
                            {state.message}
                        </Alert>
                    )}

                    <Divider sx={{ my: 3 }} />

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        {state.status === 'uploading' ? (
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={handleCancel}
                                startIcon={<CancelIcon />}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                            >
                                Cancelar
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                onClick={handleUpload}
                                disabled={!state.file || state.status === 'completed'}
                                sx={{
                                    px: 4,
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    boxShadow: 'none',
                                    '&:hover': {
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                    }
                                }}
                            >
                                {state.status === 'completed' ? 'Sincronizar de nuevo' : 'Iniciar Sincronización'}
                            </Button>
                        )}
                    </Box>
                </Card>
            </Container>
        </MainLayout>
    );
};

export default SigenuImportPage;
