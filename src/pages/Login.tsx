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
  Chip,
} from '@mui/material';

// Icons
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import SpeedIcon from '@mui/icons-material/Speed';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

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

      setForgotSuccess('Your password reset request has been submitted to the Riley’s administrator.');
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
            companyName: "Riley's Plant Operations",
            subscriptionPlan: 'ENTERPRISE',
            status: 'ACTIVE',
            createdAt: new Date(),
          });

          // 4. Create User Profile
          await setDoc(doc(db, 'users', uid), {
            tenantId,
            name: 'Riley Administrator',
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

  const handleQuickFillAdmin = () => {
    setEmail('admin@gmail.com');
    setPassword('admin123');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%), #0f172a',
        px: 2.5,
        py: 4,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient Glows */}
      <Box
        sx={{
          position: 'absolute',
          width: 450,
          height: 450,
          borderRadius: '50%',
          filter: 'blur(120px)',
          background: 'rgba(99, 102, 241, 0.18)',
          top: '-15%',
          left: '10%',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          filter: 'blur(140px)',
          background: 'rgba(16, 185, 129, 0.12)',
          bottom: '-15%',
          right: '8%',
          zIndex: 0,
        }}
      />

      <Card
        sx={{
          maxWidth: 480,
          width: '100%',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          bgcolor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          zIndex: 1,
          p: { xs: 3, sm: 4 },
          color: '#ffffff'
        }}
      >
        <CardContent sx={{ p: '0 !important' }}>
          {/* Brand Header */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 3.5 }}>
            {/* Riley's Monogram Crest */}
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #6366f1 0%, #10b981 100%)',
                p: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.5)',
                mb: 2.2,
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  bgcolor: '#0f172a',
                  borderRadius: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5
                }}
              >
                <Typography sx={{ fontWeight: 900, fontSize: '1.75rem', fontFamily: '"Outfit", sans-serif', color: '#ffffff', letterSpacing: '-0.04em' }}>
                  R
                </Typography>
                <PrecisionManufacturingIcon sx={{ color: '#10b981', fontSize: 18 }} />
              </Box>
            </Box>

            <Typography
              variant="h4"
              sx={{
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '-0.03em',
                fontFamily: '"Outfit", sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 0.8
              }}
            >
              Riley’s
            </Typography>

            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(90deg, #818cf8 0%, #34d399 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '0.02em',
                fontSize: '0.925rem',
                mt: 0.3
              }}
            >
              Production Planning & Dashboard
            </Typography>

            <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.6, fontSize: '0.775rem' }}>
              Manufacturing Intelligence, Capacity Scheduling & Yield Telemetry
            </Typography>

            {/* Quick Feature Badges */}
            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', justifyContent: 'center', gap: 0.8 }}>
              <Chip
                icon={<AutoModeIcon sx={{ fontSize: '14px !important', color: '#818cf8 !important' }} />}
                label="Auto Schedule Shift"
                size="small"
                sx={{ bgcolor: 'rgba(99, 102, 241, 0.12)', color: '#c7d2fe', border: '1px solid rgba(99, 102, 241, 0.25)', fontSize: '0.675rem', fontWeight: 700 }}
              />
              <Chip
                icon={<TrendingUpIcon sx={{ fontSize: '14px !important', color: '#34d399 !important' }} />}
                label="Daily Yield Curves"
                size="small"
                sx={{ bgcolor: 'rgba(16, 185, 129, 0.12)', color: '#a7f3d0', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.675rem', fontWeight: 700 }}
              />
              <Chip
                icon={<SpeedIcon sx={{ fontSize: '14px !important', color: '#fbbf24 !important' }} />}
                label="Downtime Matrix"
                size="small"
                sx={{ bgcolor: 'rgba(245, 158, 11, 0.12)', color: '#fde68a', border: '1px solid rgba(245, 158, 11, 0.25)', fontSize: '0.675rem', fontWeight: 700 }}
              />
            </Stack>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                borderRadius: '12px',
                bgcolor: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                '& .MuiAlert-icon': { color: '#ef4444' }
              }}
            >
              {error}
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            <Stack spacing={2.2}>
              <Box>
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 700, mb: 0.6, display: 'block', fontSize: '0.775rem' }}>
                  Work Email Address
                </Typography>
                <TextField
                  fullWidth
                  placeholder="name@company.com"
                  size="small"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon sx={{ color: '#64748b', fontSize: 18 }} />
                        </InputAdornment>
                      ),
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(30, 41, 59, 0.7)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                      '&:hover fieldset': { borderColor: '#6366f1' },
                      '&.Mui-focused fieldset': { borderColor: '#818cf8', borderWidth: '1.5px' },
                    }
                  }}
                />
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.6 }}>
                  <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.775rem' }}>
                    Password
                  </Typography>
                  <Button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    sx={{
                      p: 0,
                      minWidth: 'auto',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      color: '#818cf8',
                      textTransform: 'none',
                      '&:hover': { color: '#a5b4fc', bgcolor: 'transparent' }
                    }}
                  >
                    Forgot password?
                  </Button>
                </Box>
                <TextField
                  fullWidth
                  placeholder="••••••••••••"
                  size="small"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: '#64748b', fontSize: 18 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                            sx={{ color: '#94a3b8' }}
                          >
                            {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(30, 41, 59, 0.7)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                      '&:hover fieldset': { borderColor: '#6366f1' },
                      '&.Mui-focused fieldset': { borderColor: '#818cf8', borderWidth: '1.5px' },
                    }
                  }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                fullWidth
                sx={{
                  mt: 1,
                  py: 1.3,
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.925rem',
                  letterSpacing: '0.02em',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    boxShadow: '0 12px 24px -4px rgba(99, 102, 241, 0.5)',
                  },
                }}
              >
                {submitting ? <CircularProgress size={22} color="inherit" /> : 'Sign In to Riley’s Hub'}
              </Button>
            </Stack>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <Box sx={{ mt: 3, p: 1.5, bgcolor: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, display: 'block' }}>
                  Default Admin Access:
                </Typography>
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                  admin@gmail.com / admin123
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={handleQuickFillAdmin}
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  py: 0.2,
                  px: 1,
                  color: '#818cf8',
                  borderColor: 'rgba(99, 102, 241, 0.3)',
                  '&:hover': { borderColor: '#818cf8', bgcolor: 'rgba(99, 102, 241, 0.1)' }
                }}
              >
                Quick Fill
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Forgot Password Modal */}
      <Dialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '20px',
              p: 1.5,
              bgcolor: '#0f172a',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#ffffff', fontFamily: '"Outfit", sans-serif' }}>
            Riley’s Password Reset
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Submit an automated request to the plant security administrator.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {forgotSuccess ? (
            <Alert
              severity="success"
              sx={{
                borderRadius: '12px',
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                color: '#a7f3d0',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}
            >
              {forgotSuccess}
            </Alert>
          ) : (
            <form id="forgot-form" onSubmit={handleForgotSubmit}>
              {forgotError && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(239, 68, 68, 0.15)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {forgotError}
                </Alert>
              )}
              <TextField
                label="Registered Email Address"
                placeholder="name@company.com"
                type="email"
                size="small"
                fullWidth
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                disabled={forgotLoading}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{
                  mt: 1,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(30, 41, 59, 0.7)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                  }
                }}
              />
            </form>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => { setForgotOpen(false); setForgotSuccess(''); setForgotError(''); }}
            sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'none' }}
          >
            Cancel
          </Button>
          {!forgotSuccess && (
            <Button
              form="forgot-form"
              type="submit"
              variant="contained"
              disabled={forgotLoading}
              sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' }, fontWeight: 700, borderRadius: '8px' }}
            >
              {forgotLoading ? <CircularProgress size={18} color="inherit" /> : 'Submit Request'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Login;
