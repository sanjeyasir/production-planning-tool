import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo
      light: '#818cf8',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#10b981', // Emerald green (Success/Production)
      light: '#34d399',
      dark: '#059669',
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444', // Red (Rejects/Downtime)
      light: '#f87171',
      dark: '#dc2626',
    },
    warning: {
      main: '#f59e0b', // Amber (Warnings/Shifts)
      light: '#fbbf24',
      dark: '#d97706',
    },
    info: {
      main: '#3b82f6', // Light Blue
      light: '#60a5fa',
      dark: '#2563eb',
    },
    background: {
      default: '#080c14', // Very dark deep space blue
      paper: '#0f172a',   // Dark slate for cards/drawers
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      disabled: '#64748b',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 800 },
    h2: { fontSize: '2rem', fontWeight: 700 },
    h3: { fontSize: '1.75rem', fontWeight: 700 },
    h4: { fontSize: '1.5rem', fontWeight: 600 },
    h5: { fontSize: '1.25rem', fontWeight: 600 },
    h6: { fontSize: '1rem', fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.43 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
          '&.MuiButton-containedPrimary': {
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 16,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0f172a',
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
});
