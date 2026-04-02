import { useEffect } from 'react';
import { Box } from '@mui/material';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

interface MainLayoutProps {
  children?: React.ReactNode; 
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { token, logout } = useAuth();

  useEffect(() => {
    if (!token) return;

    const validateSession = async () => {
      try {
        const response = await fetch(`${API_BASE}/common/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          logout();
        }
      } catch {
        return;
      }
    };

    void validateSession();
  }, [logout, token]);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh',
      bgcolor: '#f5f5f5' 
    }}>
      <Navbar />
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 } }}>
        {children}
      </Box>
      <Footer />
    </Box>
  );
};

export default MainLayout;
