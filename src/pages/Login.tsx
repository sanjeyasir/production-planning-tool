import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { seedAllCompaniesAndRoles } from '../seed';
import { useAuthStore } from '../store/authStore';
import { RileysToyoLogo } from '../components/RileysToyoLogo';
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
          // 1. Ensure global roles & multi-company data are seeded
          await seedAllCompaniesAndRoles();

          // 2. Register default admin user
          userCredential = await createUserWithEmailAndPassword(auth, 'admin@gmail.com', 'admin123');

          const uid = userCredential.user.uid;

          // 3. Create Tenant Profiles
          await setDoc(doc(db, 'tenants', 'rileys'), {
            companyName: "Riley's Plant Operations",
            subscriptionPlan: 'ENTERPRISE',
            status: 'ACTIVE',
            createdAt: new Date(),
          }, { merge: true });

          await setDoc(doc(db, 'tenants', 'toyo'), {
            companyName: "Toyo Manufacturing",
            subscriptionPlan: 'ENTERPRISE',
            status: 'ACTIVE',
            createdAt: new Date(),
          }, { merge: true });

          // 4. Create Super Admin User Profile with company: 'all'
          await setDoc(doc(db, 'users', uid), {
            tenantId: 'rileys',
            company: 'all',
            name: 'System Administrator',
            email: 'admin@gmail.com',
            roleId: 'super_admin',
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
      {/* Ambient Dual-Brand Glows (Crimson + Ocean Blue + Indigo) */}
      <Box
        sx={{
          position: 'absolute',
          width: 540,
          height: 540,
          borderRadius: '50%',
          filter: 'blur(140px)',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.28) 0%, rgba(185, 28, 28, 0.08) 70%, transparent 100%)',
          top: '-15%',
          left: '5%',
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
          background: 'radial-gradient(circle, rgba(2, 132, 199, 0.3) 0%, rgba(3, 105, 161, 0.1) 70%, transparent 100%)',
          bottom: '-15%',
          right: '5%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 380,
          height: 380,
          borderRadius: '50%',
          filter: 'blur(100px)',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <Card
        sx={{
          maxWidth: 500,
          width: '100%',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          bgcolor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.85), 0 0 35px rgba(2, 132, 199, 0.16), 0 0 35px rgba(239, 68, 68, 0.16)',
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
                bgcolor: 'rgba(15, 23, 42, 0.96)',
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
              <RileysToyoLogo size="lg" variant="icon" />
              <CircularProgress size={42} thickness={4.5} sx={{ color: '#38bdf8' }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#ffffff', fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.01em' }}>
                  Authenticating Session...
                </Typography>
                <Typography variant="caption" sx={{ color: '#93c5fd', display: 'block', mt: 0.5, fontWeight: 600, fontSize: '0.825rem' }}>
                  Loading Riley's &amp; Toyo production operations workspace...
                </Typography>
              </Box>
            </Box>
          )}

          {/* Unified Riley's & Toyo Brand Header */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 3 }}>
            <RileysToyoLogo size="lg" variant="full" />
            <Typography variant="body2" sx={{ color: '#94a3b8', mt: 1, fontWeight: 500, fontSize: '0.85rem' }}>
              Integrated Operations, Dynamic Capacity &amp; Planning
            </Typography>
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
                <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 700, mb: 0.6, display: 'block', fontSize: '0.775rem' }}>
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
                          <EmailIcon sx={{ color: '#ef4444', fontSize: 18 }} />
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
                      '&:hover fieldset': { borderColor: '#38bdf8' },
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 3px rgba(2, 132, 199, 0.2)',
                      },
                      '&.Mui-focused fieldset': { borderColor: '#0284c7', borderWidth: '1.5px' },
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
                  <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.775rem' }}>
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
                      color: '#38bdf8',
                      textTransform: 'none',
                      '&:hover': { color: '#7dd3fc', bgcolor: 'transparent' }
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
                          <LockIcon sx={{ color: '#0284c7', fontSize: 18 }} />
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
                      bgcolor: '#ffffff',
                      borderRadius: '12px',
                      color: '#0f172a',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                      '& fieldset': { borderColor: '#e2e8f0' },
                      '&:hover fieldset': { borderColor: '#38bdf8' },
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 3px rgba(2, 132, 199, 0.2)',
                      },
                      '&.Mui-focused fieldset': { borderColor: '#0284c7', borderWidth: '1.5px' },
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
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 45%, #0284c7 100%)',
                  boxShadow: '0 8px 24px -4px rgba(2, 132, 199, 0.4), 0 8px 24px -4px rgba(239, 68, 68, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #f87171 0%, #dc2626 40%, #0ea5e9 100%)',
                    boxShadow: '0 12px 28px -4px rgba(2, 132, 199, 0.55), 0 12px 28px -4px rgba(239, 68, 68, 0.55)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                {submitting ? <CircularProgress size={22} color="inherit" /> : 'Sign In to Production Portal'}
              </Button>
            </Stack>
          </form>
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
