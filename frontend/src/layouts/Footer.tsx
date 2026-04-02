import { Box, Typography } from '@mui/material';

export const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <Box
            component="footer"
            sx={{
                bgcolor: '#171717', 
                color: 'white',
                py: 3, 
                textAlign: 'center',
                mt: 'auto',
                minHeight: '70px'
            }}
        >
            <Typography variant="body2">
                Sistema de Seguimiento Académico (SSA) {currentYear}
            </Typography>
        </Box>
    );
};