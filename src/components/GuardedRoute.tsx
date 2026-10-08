import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Box, CircularProgress, Typography, Button, Container, Paper } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import { RileysLogo } from './RileysLogo';

interface GuardedRouteProps {
  children: React.ReactNode;
  module?: string;
  action?: string;
}

export const GuardedRoute: React.FC<GuardedRouteProps> = ({ children, module, action }) => {
  const { user, loading, hasPermission, profile } = useAuthStore();
  const location = useLocation();

  if (loading || (user && !profile)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'radial-gradient(circle at 50% 50%, rgba(220, 38, 38, 0.15) 0%, rgba(10, 4, 6, 0.98) 70%), #0a0406',
          color: '#ffffff',
          gap: 2.5,
        }}
      >
        <RileysLogo size="lg" themeMode="red" variant="full" />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
          <CircularProgress size={28} thickness={4.5} sx={{ color: '#ef4444' }} />
          <Typography variant="body1" sx={{ fontWeight: 700, color: '#fca5a5', letterSpacing: '0.02em', fontSize: '0.95rem' }}>
            Loading Dashboard Session...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!user) {
    // Redirect to login page but save the current location they were trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change on first login
  if (profile?.isFirstLogin) {
    if (location.pathname !== '/change-password') {
      return <Navigate to="/change-password" replace />;
    }
  } else {
    if (location.pathname === '/change-password') {
      return <Navigate to="/" replace />;
    }
  }

  if (module && action && !hasPermission(module, action)) {
    return (
      <Container maxWidth="sm" sx={{ mt: 10 }}>
        <Paper
          elevation={0}
          sx={{
            p: 5,
            textAlign: 'center',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              p: 2,
              borderRadius: '50%',
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              mb: 3,
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#fff' }}>
            Access Denied
          </Typography>
          <Typography variant="body1" sx={{ color: '#94a3b8', mb: 4 }}>
            You do not have the required permissions ({module}:{action}) to view this resource. 
            Please contact your system administrator if you believe this is an error.
          </Typography>
          <Button
            variant="contained"
            href="/"
            sx={{
              bgcolor: '#6366f1',
              '&:hover': { bgcolor: '#4f46e5' },
              textTransform: 'none',
              borderRadius: '8px',
              px: 4,
              py: 1.2,
              fontWeight: 600,
            }}
          >
            Return to Dashboard
          </Button>
        </Paper>
      </Container>
    );
  }

  return <>{children}</>;
};
