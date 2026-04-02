import React from 'react';
import { Box, Typography, IconButton, useTheme } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
    title: string;
    subtitle?: string | React.ReactNode;
    showBackButton?: boolean;
    action?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
    title, 
    subtitle, 
    showBackButton = false,
    action
}) => {
    const navigate = useNavigate();
    const theme = useTheme();

    return (
        <Box sx={{ mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: subtitle ? 1 : 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {showBackButton && (
                        <IconButton 
                            onClick={() => navigate(-1)} 
                            sx={{ 
                                mr: 2, 
                                ml: -1, 
                                bgcolor: theme.palette.secondary.main,
                                color: 'white',
                                '&:hover': {
                                    bgcolor: theme.palette.secondary.dark,
                                }
                            }}
                            aria-label="go back"
                        >
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                    <Typography 
                        variant="h4" 
                        component="h1" 
                        fontWeight="bold" 
                        color="text.primary"
                    >
                        {title}
                    </Typography>
                </Box>
                {action && (
                    <Box>
                        {action}
                    </Box>
                )}
            </Box>
            
            {subtitle && (
                <Typography variant="h6" color="text.secondary">
                    {subtitle}
                </Typography>
            )}
        </Box>
    );
};

export default PageHeader;
