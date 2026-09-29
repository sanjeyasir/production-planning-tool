import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6366f1', // Indigo
      light: '#818cf8',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#10b981', // Emerald green
      light: '#34d399',
      dark: '#059669',
      contrastText: '#ffffff',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
      contrastText: '#080c14',
    },
    info: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc', // Soft slate background matching costing-sample-tracking
      paper: '#ffffff',   // Crisp white cards and containers
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
      disabled: '#94a3b8',
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a' },
    h2: { fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#0f172a' },
    h3: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a' },
    h4: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.015em', color: '#0f172a' },
    h5: { fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' },
    h6: { fontSize: '0.975rem', fontWeight: 600, color: '#0f172a' },
    subtitle1: { fontSize: '0.95rem', fontWeight: 500, lineHeight: 1.5, color: '#475569' },
    subtitle2: { fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.4, color: '#64748b' },
    body1: { fontSize: '0.925rem', lineHeight: 1.6, color: '#334155' },
    body2: { fontSize: '0.825rem', lineHeight: 1.5, color: '#64748b' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '7px 16px',
          fontWeight: 600,
          boxShadow: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: 'none',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
          '&:hover': {
            boxShadow: '0 6px 16px rgba(99, 102, 241, 0.3)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          borderColor: '#e2e8f0',
          color: '#334155',
          backgroundColor: '#ffffff',
          '&:hover': {
            borderWidth: '1.5px',
            borderColor: '#cbd5e1',
            backgroundColor: '#f8fafc',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
          border: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: '#f8fafc',
          color: '#475569',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '12px 16px',
        },
        root: {
          padding: '13px 16px',
          borderBottom: '1px solid #f1f5f9',
          fontSize: '0.875rem',
          color: '#0f172a',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#f8fafc',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 9999,
          fontSize: '0.775rem',
        },
        sizeSmall: {
          fontSize: '0.725rem',
          height: '22px',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#ffffff',
          transition: 'all 0.15s ease-in-out',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#cbd5e1',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#94a3b8',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#6366f1',
            borderWidth: '2px',
          },
        },
        input: {
          padding: '10px 14px',
          fontSize: '0.9rem',
          color: '#0f172a',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          color: '#64748b',
          fontWeight: 500,
          '&.Mui-focused': {
            color: '#6366f1',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
          backgroundImage: 'none',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 44,
        },
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
          backgroundColor: '#6366f1',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          minHeight: 44,
          padding: '8px 16px',
          color: '#64748b',
          '&.Mui-selected': {
            color: '#6366f1',
          },
        },
      },
    },
  },
});
