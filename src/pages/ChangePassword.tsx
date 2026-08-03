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
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';

export const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const { profile, tenant, role, setAuth } = useAuthStore();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#080c14', px: 2 }}>
      <Card
        sx={{
          maxWidth: 420,
          width: '100%',
          p: 2,
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(8, 12, 21, 0.9) 100%)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
            <Box
              sx={{
                bgcolor: 'primary.main',
                borderRadius: '16px',
                p: 1.2,
                display: 'flex',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
                mb: 2,
              }}
            >
              <LockResetIcon sx={{ color: '#fff', fontSize: 32 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff', letterSpacing: 0.5, textAlign: 'center' }}>
              First-Time Password Change
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, textAlign: 'center' }}>
              You are logging in for the first time. Please choose a new password.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleChangePassword}>
            <Stack spacing={2.5}>
              <TextField
                label="New Password"
                type="password"
                required
                fullWidth
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={submitting}
              />
              <TextField
                label="Confirm New Password"
                type="password"
                required
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={submitting}
                sx={{ py: 1.4, fontSize: '0.95rem', fontWeight: 700 }}
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
