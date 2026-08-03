import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { seedGlobalRoles } from '../seed';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, profile } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError('Please enter your email address');
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError('');
      setForgotSuccess('');

      const emailLower = forgotEmail.trim().toLowerCase();

      // Check if user exists in Firestore
      const userQ = query(
        collection(db, 'users'),
        where('email', '==', emailLower)
      );
      const userSnap = await getDocs(userQ);

      if (userSnap.empty) {
        throw new Error('No user account found with this email address.');
      }

      const userData = userSnap.docs[0].data();

      // Add a reset request to password_resets collection
      await addDoc(collection(db, 'password_resets'), {
        email: emailLower,
        userId: userSnap.docs[0].id,
        name: userData.name || 'User',
        status: 'PENDING',
        requestedAt: new Date()
      });

      setForgotSuccess('Your password reset request has been submitted to the administrator.');
      setForgotEmail('');
    } catch (err: any) {
      setForgotError(err.message || 'Failed to submit request.');
    } finally {
      setForgotLoading(false);
    }
  };

  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (!loading && user && profile) {
      navigate(from, { replace: true });
    }
  }, [user, loading, profile, navigate, from]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    const emailLower = email.trim().toLowerCase();

    try {
      setError('');
      setSubmitting(true);

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, emailLower, password);
      } catch (err: any) {
        if (
          (err.code === 'auth/user-not-found' || 
           err.code === 'auth/invalid-credential' || 
           err.code === 'auth/invalid-email') &&
          emailLower === 'admin@gmail.com' &&
          password === 'admin123'
        ) {
          // 1. Ensure global roles are seeded
          await seedGlobalRoles();

          // 2. Register default admin user
          userCredential = await createUserWithEmailAndPassword(auth, 'admin@gmail.com', 'admin123');

          const uid = userCredential.user.uid;
          const tenantId = 'admin_tenant_gmail';

          // 3. Create Tenant Profile
          await setDoc(doc(db, 'tenants', tenantId), {
            companyName: 'Main Plant Operations',
            subscriptionPlan: 'ENTERPRISE',
            status: 'ACTIVE',
            createdAt: new Date(),
          });

          // 4. Create User Profile
          await setDoc(doc(db, 'users', uid), {
            tenantId,
            name: 'Administrator',
            email: 'admin@gmail.com',
            roleId: 'tenant_admin',
            status: 'ACTIVE',
            createdAt: new Date(),
          });
        } else {
          throw err;
        }
      }

      setSubmitting(false);
      navigate(from, { replace: true });
    } catch (err: any) {
      setSubmitting(false);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else {
        setError(err.message || 'Failed to sign in');
      }
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
              <PrecisionManufacturingIcon sx={{ color: '#fff', fontSize: 32 }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>
              MOIP
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Manufacturing Operations Intelligence Platform
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <Stack spacing={2.5}>
              <TextField
                label="Email Address"
                type="email"
                required
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                {submitting ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
              </Button>
            </Stack>
          </form>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              onClick={() => {
                setForgotError('');
                setForgotSuccess('');
                setForgotEmail('');
                setForgotOpen(true);
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: 'primary.light',
                fontSize: '0.875rem',
              }}
            >
              Forgot Password?
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={forgotOpen}
        onClose={() => !forgotLoading && setForgotOpen(false)}
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            sx: {
              borderRadius: '16px',
              bgcolor: '#0f172a',
              backgroundImage: 'none',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }
          }
        }}
      >
        <form onSubmit={handleForgotSubmit}>
          <DialogTitle sx={{ fontWeight: 700, color: '#fff' }}>Request Password Reset</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Enter your registered email address. Your administrator will be notified to reset your password.
              </Typography>
              
              {forgotError && (
                <Alert severity="error" sx={{ borderRadius: '8px' }}>
                  {forgotError}
                </Alert>
              )}
              {forgotSuccess && (
                <Alert severity="success" sx={{ borderRadius: '8px' }}>
                  {forgotSuccess}
                </Alert>
              )}

              <TextField
                label="Email Address"
                type="email"
                required
                fullWidth
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                disabled={forgotLoading}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button 
              onClick={() => setForgotOpen(false)} 
              color="inherit"
              disabled={forgotLoading}
            >
              Close
            </Button>
            <Button 
              type="submit" 
              variant="contained"
              disabled={forgotLoading}
            >
              {forgotLoading ? <CircularProgress size={24} color="inherit" /> : 'Submit Request'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};
