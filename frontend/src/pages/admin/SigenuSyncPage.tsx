import React, { useState } from 'react';
import { 
    Box, Card, Typography, Button, CircularProgress, 
    Alert, useTheme, alpha, Container, Divider 
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

interface SyncResult {
    backupFile: string;
    processedCount: number;
    errorCount: number;
}

const SigenuSyncPage: React.FC = () => {
    const theme = useTheme();
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SyncResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDownload = async (file: string) => {
        setError(null);
        
        try {
            if (!file || typeof file !== 'string') {
                throw new Error('Nombre de archivo inválido.');
            }
            
            if (!token) {
                throw new Error('No hay token de autenticación disponible.');
            }
            
            console.log('[Download] Downloading backup:', file);
            
            const downloadUrl = `${API_BASE}/sigenu/sync/download?backupFile=${encodeURIComponent(file)}&token=${encodeURIComponent(token)}`;
            
            console.log('[Download] Starting download from URL:', downloadUrl);
            
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = file;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('[Download] Descarga iniciada');
            
        } catch (err: any) {
            console.error('[Download] Download failed:', err);
            
            let errorMessage = "No se pudo descargar el archivo generado.";
            if (err.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
        }
    };

    const handleSyncAndDownload = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch(`${API_BASE}/sigenu/sync/pending-grades`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error durante la sincronización');
            }

            setResult(data.data);
            await handleDownload(data.data.backupFile);

        } catch (err: any) {
            if (err.message.startsWith('DatabaseNotFound:')) {
                setError('Debe importar una base de datos de SIGENU primero en la página de importación.');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout>
             <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader 
                    title="Sincronización de Notas Pendientes"
                    subtitle="Exportar notas locales modificadas al formato SIGENU."
                    showBackButton={true}
                />

                <Card elevation={0} sx={{
                    p: 4,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: theme.palette.background.paper,
                    textAlign: 'center'
                }}>
                    <Box sx={{ 
                        mb: 4, 
                        display: 'flex', 
                        justifyContent: 'center' 
                    }}>
                        <Box sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'primary.main'
                        }}>
                            <SyncIcon sx={{ fontSize: 40 }} />
                        </Box>
                    </Box>

                    <Typography variant="h5" gutterBottom fontWeight={600}>
                        Sincronizar con SIGENU
                    </Typography>
                    
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 800, mx: 'auto' }}>
                        Este proceso identificará todas las evaluaciones que no han sido registradas en el SIGENU o que han sido modificadas recientemente. 
                        Se generará un archivo <strong>.backup</strong> actualizado que deberá ser importado en el sistema SIGENU oficial.
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
                            {error}
                        </Alert>
                    )}

                    {result && (
                        <Alert 
                            severity={result.errorCount > 0 ? "warning" : "success"}
                            sx={{ mb: 3, textAlign: 'left' }}
                            icon={<CheckCircleIcon />}
                        >
                            <Typography variant="subtitle2" fontWeight={600}>
                                Sincronización completada
                            </Typography>
                            <Typography variant="body2">
                                Se procesaron {result.processedCount} notas correctamente.
                                {result.errorCount > 0 && ` Hubo ${result.errorCount} errores (posible falta de IDs de SIGENU).`}
                            </Typography>
                            <Button 
                                size="small" 
                                startIcon={<DownloadIcon />} 
                                sx={{ mt: 1 }}
                                onClick={() => handleDownload(result.backupFile)}
                            >
                                Descargar Backup Nuevamente
                            </Button>
                        </Alert>
                    )}

                    <Divider sx={{ my: 3 }} />

                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleSyncAndDownload}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
                        sx={{
                            px: 4,
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600,
                            boxShadow: 'none',
                            '&:hover': {
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }
                        }}
                    >
                        {loading ? 'Procesando...' : 'Iniciar Sincronización y Descargar'}
                    </Button>
                </Card>
            </Container>
        </MainLayout>
    );
};

export default SigenuSyncPage;
