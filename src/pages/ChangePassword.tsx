import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuthStore } from '../store/authStore';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

export const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const { profile, tenant, role, setAuth } = useAuthStore();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setError('');
      setSubmitting(true);

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No user is currently signed in');
      }

      // 1. Update password in Firebase Auth
      await updatePassword(currentUser, newPassword);

      // 2. Update isFirstLogin to false in Firestore user profile
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        isFirstLogin: false
      });

      // 3. Update local store state so React detects the update
      setAuth(
        currentUser,
        { ...profile, isFirstLogin: false } as any,
        tenant,
        role
      );

      setSubmitting(false);
      navigate('/');
    } catch (err: any) {
      setSubmitting(false);
      setError(err.message || 'Failed to update password. You may need to log out and log in again.');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.05) 0%, transparent 50%), #f8fafc',
        px: 2.5,
        py: 4,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient Blur Glows */}
      <Box
        sx={{
          position: 'absolute',
          width: 320,
          height: 320,
          borderRadius: '50%',
          filter: 'blur(90px)',
          background: 'rgba(99, 102, 241, 0.08)',
          top: '-10%',
          left: '5%',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          filter: 'blur(100px)',
          background: 'rgba(16, 185, 129, 0.06)',
          bottom: '-10%',
          right: '5%',
          zIndex: 0,
        }}
      />

      <Card
        sx={{
          maxWidth: 440,
          width: '100%',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
          zIndex: 1,
          p: { xs: 2.5, sm: 3.5 },
        }}
      >
        <CardContent sx={{ p: '0 !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 3.5 }}>
            <Box
              sx={{
                bgcolor: '#10b981',
                borderRadius: '16px',
                p: 1.5,
                display: 'flex',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                mb: 2,
              }}
            >
              <LockResetIcon sx={{ color: '#fff', fontSize: 32 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', fontSize: '1.45rem' }}>
              Update Password
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, fontSize: '0.85rem' }}>
              Please set a strong, secure password for your account.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px' }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleChangePassword}>
            <Stack spacing={2.25}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', mb: 0.75, display: 'block' }}>
                  New Password
                </Typography>
                <TextField
                  placeholder="Min 6 characters"
                  type={showPassword ? 'text' : 'password'}
                  required
                  fullWidth
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={submitting}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            sx={{ color: '#94a3b8' }}
                          >
                            {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', mb: 0.75, display: 'block' }}>
                  Confirm Password
                </Typography>
                <TextField
                  placeholder="Repeat new password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  fullWidth
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={submitting}
                sx={{
                  py: 1.3,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                  },
                }}
              >
                {submitting ? <CircularProgress size={24} color="inherit" /> : 'Set Password'}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};
