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
import { RileysLogo } from '../components/RileysLogo';
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

// Icons
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

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

  // Active transition flag: keeps spinner visible from click until dashboard route loads
  const isTransitioning = submitting || (!!user && !profile) || (loading && !!user);

  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (!loading && user && profile) {
      navigate(from, { replace: true });
    }
  }, [user, loading, profile, navigate, from]);

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

      setForgotSuccess('Your password reset request has been submitted to the security administrator.');
      setForgotEmail('');
    } catch (err: any) {
      setForgotError(err.message || 'Failed to submit request.');
    } finally {
      setForgotLoading(false);
    }
  };

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

      // Keep submitting true: isTransitioning keeps spinner active until useEffect navigates
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
        background: 'radial-gradient(circle at 15% 15%, rgba(220, 38, 38, 0.28) 0%, transparent 50%), radial-gradient(circle at 85% 85%, rgba(153, 27, 27, 0.35) 0%, transparent 55%), radial-gradient(circle at 50% 50%, rgba(239, 68, 68, 0.08) 0%, transparent 60%), #0a0406',
        px: 2.5,
        py: 4,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient Red Glows */}
      <Box
        sx={{
          position: 'absolute',
          width: 520,
          height: 520,
          borderRadius: '50%',
          filter: 'blur(130px)',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.1) 70%, transparent 100%)',
          top: '-15%',
          left: '8%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 580,
          height: 580,
          borderRadius: '50%',
          filter: 'blur(140px)',
          background: 'radial-gradient(circle, rgba(185, 28, 28, 0.28) 0%, rgba(127, 29, 29, 0.12) 70%, transparent 100%)',
          bottom: '-15%',
          right: '5%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 320,
          height: 320,
          borderRadius: '50%',
          filter: 'blur(90px)',
          background: 'rgba(254, 202, 202, 0.08)',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <Card
        sx={{
          maxWidth: 480,
          width: '100%',
          borderRadius: '24px',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          bgcolor: 'rgba(18, 10, 14, 0.88)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(220, 38, 38, 0.15), inset 0 1px 0 rgba(254, 202, 202, 0.15)',
          zIndex: 1,
          p: { xs: 3, sm: 4.5 },
          color: '#ffffff',
          position: 'relative',
        }}
      >
        <CardContent sx={{ p: '0 !important' }}>
          {/* Active Loading Spinner Overlay */}
          {isTransitioning && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '24px',
                bgcolor: 'rgba(14, 7, 10, 0.95)',
                backdropFilter: 'blur(16px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
                gap: 2.5,
                p: 3,
                textAlign: 'center',
              }}
            >
              <RileysLogo size="lg" themeMode="red" variant="icon" />
              <CircularProgress size={42} thickness={4.5} sx={{ color: '#ef4444' }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#ffffff', fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.01em' }}>
                  Authenticating Session...
                </Typography>
                <Typography variant="caption" sx={{ color: '#fca5a5', display: 'block', mt: 0.5, fontWeight: 600, fontSize: '0.825rem' }}>
                  Loading dashboard & production workspace...
                </Typography>
              </Box>
            </Box>
          )}

          {/* Brand Header with Fake Riley's Logo */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 3 }}>
            <RileysLogo size="lg" themeMode="red" variant="full" />
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                borderRadius: '12px',
                bgcolor: 'rgba(220, 38, 38, 0.2)',
                color: '#fecaca',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                '& .MuiAlert-icon': { color: '#ef4444' },
                fontSize: '0.825rem',
                fontWeight: 600,
              }}
            >
              {error}
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            <Stack spacing={2.2}>
              <Box>
                <Typography variant="caption" sx={{ color: '#fecaca', fontWeight: 700, mb: 0.6, display: 'block', fontSize: '0.775rem' }}>
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
                          <EmailIcon sx={{ color: '#f87171', fontSize: 18 }} />
                        </InputAdornment>
                      ),
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#ffffff',
                      borderRadius: '12px',
                      color: '#0f172a',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                      '& fieldset': { borderColor: '#e2e8f0' },
                      '&:hover fieldset': { borderColor: '#f87171' },
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.18)',
                      },
                      '&.Mui-focused fieldset': { borderColor: '#dc2626', borderWidth: '1.5px' },
                      '& input': {
                        color: '#0f172a',
                        fontWeight: 500,
                        '&::placeholder': { color: '#94a3b8', opacity: 1 },
                      },
                    }
                  }}
                />
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.6 }}>
                  <Typography variant="caption" sx={{ color: '#fecaca', fontWeight: 700, fontSize: '0.775rem' }}>
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
                      color: '#f87171',
                      textTransform: 'none',
                      '&:hover': { color: '#fca5a5', bgcolor: 'transparent' }
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
                          <LockIcon sx={{ color: '#f87171', fontSize: 18 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                            sx={{ color: '#fca5a5' }}
                          >
                            {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#ffffff',
                      borderRadius: '12px',
                      color: '#0f172a',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                      '& fieldset': { borderColor: '#e2e8f0' },
                      '&:hover fieldset': { borderColor: '#f87171' },
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.18)',
                      },
                      '&.Mui-focused fieldset': { borderColor: '#dc2626', borderWidth: '1.5px' },
                      '& input': {
                        color: '#0f172a',
                        fontWeight: 500,
                        '&::placeholder': { color: '#94a3b8', opacity: 1 },
                      },
                    }
                  }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                fullWidth
                endIcon={!submitting && <ArrowForwardIcon sx={{ fontSize: 18 }} />}
                sx={{
                  mt: 1,
                  py: 1.35,
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.925rem',
                  letterSpacing: '0.02em',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
                  boxShadow: '0 8px 24px -4px rgba(220, 38, 38, 0.55)',
                  border: '1px solid rgba(254, 202, 202, 0.2)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #f87171 0%, #ef4444 50%, #b91c1c 100%)',
                    boxShadow: '0 12px 28px -4px rgba(239, 68, 68, 0.65)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                {submitting ? <CircularProgress size={22} color="inherit" /> : 'Sign In to Portal'}
              </Button>
            </Stack>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <Box
            sx={{
              mt: 3,
              p: 1.5,
              bgcolor: 'rgba(28, 14, 18, 0.7)',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#fca5a5', fontWeight: 700, display: 'block' }}>
                  Default Admin Access:
                </Typography>
                <Typography variant="caption" sx={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 600 }}>
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
                  py: 0.3,
                  px: 1.2,
                  color: '#fca5a5',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  bgcolor: 'rgba(239, 68, 68, 0.08)',
                  '&:hover': {
                    borderColor: '#ef4444',
                    bgcolor: 'rgba(239, 68, 68, 0.18)',
                    color: '#ffffff',
                  },
                }}
              >
                Quick Fill
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Forgot Password Modal (Red Theme) */}
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
              bgcolor: '#12080a',
              color: '#ffffff',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(220, 38, 38, 0.2)'
            }
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#ffffff', fontFamily: '"Outfit", sans-serif' }}>
            Password Reset Request
          </Typography>
          <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
            Submit an automated request to the security administrator.
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
                    bgcolor: 'rgba(239, 68, 68, 0.2)',
                    color: '#fecaca',
                    border: '1px solid rgba(239, 68, 68, 0.4)'
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
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    color: '#0f172a',
                    '& fieldset': { borderColor: '#e2e8f0' },
                    '&:hover fieldset': { borderColor: '#f87171' },
                    '&.Mui-focused fieldset': { borderColor: '#dc2626' },
                    '& input': {
                      color: '#0f172a',
                      fontWeight: 500,
                      '&::placeholder': { color: '#94a3b8', opacity: 1 },
                    },
                  }
                }}
              />
            </form>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => { setForgotOpen(false); setForgotSuccess(''); setForgotError(''); }}
            sx={{ color: '#cbd5e1', fontWeight: 600, textTransform: 'none' }}
          >
            Cancel
          </Button>
          {!forgotSuccess && (
            <Button
              form="forgot-form"
              type="submit"
              variant="contained"
              disabled={forgotLoading}
              sx={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)' },
                fontWeight: 700,
                borderRadius: '8px'
              }}
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
