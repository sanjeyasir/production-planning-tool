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
  InputAdornment,
  IconButton,
} from '@mui/material';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, profile } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        setError('Invalid email or password. Please verify credentials.');
      } else {
        setError(err.message || 'Failed to sign in');
      }
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
              <PrecisionManufacturingIcon sx={{ color: '#fff', fontSize: 32 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', fontSize: '1.45rem' }}>
              MOIP Operations Hub
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, fontSize: '0.85rem' }}>
              Manufacturing Operations Intelligence Platform
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px' }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <Stack spacing={2.25}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', mb: 0.75, display: 'block' }}>
                  Email Address
                </Typography>
                <TextField
                  placeholder="admin@gmail.com"
                  type="email"
                  required
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', mb: 0.75, display: 'block' }}>
                  Password
                </Typography>
                <TextField
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  required
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
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

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                    fontSize: '0.8rem',
                    color: '#6366f1',
                    p: 0,
                    minWidth: 'auto',
                    '&:hover': { background: 'transparent', textDecoration: 'underline' },
                  }}
                >
                  Forgot Password?
                </Button>
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
                {submitting ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
              </Button>
            </Stack>
          </form>

          {/* Quick Demo Credentials Info */}
          <Box
            sx={{
              mt: 3,
              p: 1.5,
              borderRadius: '10px',
              bgcolor: '#f8fafc',
              border: '1px dashed #cbd5e1',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontWeight: 600 }}>
              Default Administrator: <strong>admin@gmail.com</strong> / <strong>admin123</strong>
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              p: 1,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1 }}>
          Reset Password
        </DialogTitle>
        <form onSubmit={handleForgotSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
              Enter your account email. Your request will be queued for the system administrator to generate a secure reset link.
            </Typography>

            {forgotError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
                {forgotError}
              </Alert>
            )}
            {forgotSuccess && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>
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
              disabled={forgotLoading || !!forgotSuccess}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              onClick={() => setForgotOpen(false)}
              disabled={forgotLoading}
              variant="outlined"
              sx={{ borderRadius: '8px', textTransform: 'none' }}
            >
              Cancel
            </Button>
            {!forgotSuccess && (
              <Button
                type="submit"
                variant="contained"
                disabled={forgotLoading}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
              >
                {forgotLoading ? <CircularProgress size={20} color="inherit" /> : 'Submit Request'}
              </Button>
            )}
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};
