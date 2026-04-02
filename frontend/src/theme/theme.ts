import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Theme {
    customShape: {
      sm: number;
      md: number;
      lg: number;
      xl: number;
      full: number;
    };
    customShadows: {
      sm: string;
      md: string;
      lg: string;
    };
  }

  interface ThemeOptions {
    customShape?: {
      sm?: number;
      md?: number;
      lg?: number;
      xl?: number;
      full?: number;
    };
    customShadows?: {
      sm?: string;
      md?: string;
      lg?: string;
    };
  }
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1C2B5D',
      dark: '#162147',
      light: '#2A3D7A',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#70AD47',
      dark: '#59883A',
      light: '#8BC34A',
      contrastText: '#ffffff',
    },
    error: {
      main: '#e74c3c',
      dark: '#c93c2c',
    },
    warning: {
      main: '#f39c12',
    },
    success: {
      main: '#70AD47',
    },
    info: {
      main: '#2A3D7A',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#2c3e50',
      secondary: '#7f8c8d',
      disabled: '#bdc3c7',
    },
  },

  typography: {
    fontFamily: '"Museo Sans", "Roboto", "Helvetica", "Arial", sans-serif',
    body1: { fontSize: '1rem', fontWeight: 500 },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem' },
    h6: { fontSize: '1.125rem', fontWeight: 700 },
    h5: { fontSize: '1.25rem', fontWeight: 700 },
    h4: { fontSize: '1.5rem', fontWeight: 700 },
    h3: { fontSize: '1.875rem', fontWeight: 900 },
    h2: { fontSize: '2.25rem', fontWeight: 900 },
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },

  shape: {
    borderRadius: 8,
  },

  customShape: {
    sm: 2,    
    md: 4,    
    lg: 6,   
    xl: 8,   
    full: 9999,
  },

  customShadows: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.08)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 6px 12px rgba(0, 0, 0, 0.15)',
  },

  transitions: {
    duration: {
      shortest: 150,
      standard: 300,
      complex: 500,
    },
  },

  zIndex: {
    appBar: 1020,
    drawer: 1030,
    modal: 1050,
    tooltip: 1070,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f5f5f5',
          fontSize: '1rem',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});