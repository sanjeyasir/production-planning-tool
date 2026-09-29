import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getUsers,
  updateUserRole,
  updateUserStatus
} from '../../services/db';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
  TextField,
  Avatar,
  Divider,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Chip,
  InputAdornment
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import AddIcon from '@mui/icons-material/Add';
import LockResetIcon from '@mui/icons-material/LockReset';
import PeopleIcon from '@mui/icons-material/People';
import SearchIcon from '@mui/icons-material/Search';

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db, auth, registerSecondaryUser } from '../../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

const ROLE_MAP: Record<string, string> = {
  'super_admin': 'Super Admin',
  'tenant_admin': 'Tenant Admin',
  'plant_manager': 'Plant Manager',
  'supervisor': 'Supervisor',
  'operator': 'Operator',
  'viewer': 'Viewer'
};

const SCREEN_PERMISSIONS = [
  { id: 'downtime:view', name: 'Downtime Analytics (Dashboard)' },
  { id: 'production:view', name: 'Production Analytics (Dashboard)' },
  { id: 'downtime:create', name: 'Enter Downtime Operations' },
  { id: 'production:create', name: 'Enter Production Operations' },
  { id: 'master:view', name: 'Master Data (Plants, Machines, Categories)' },
  { id: 'user:view', name: 'Users & Permissions Management' },
];

export const Users: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, profile } = useAuthStore();
  const tenantId = tenant?.id || '';
  const userId = profile?.id || '';
  const userEmail = profile?.email || '';

  const isSuperAdmin = userEmail === 'admin@gmail.com' || profile?.roleId === 'tenant_admin';

  // Notification Banner
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Queries
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users', tenantId],
    queryFn: () => getUsers(tenantId),
    enabled: !!tenantId,
  });

  const { data: resetRequests = [], isLoading: loadingResets, refetch: refetchResets } = useQuery({
    queryKey: ['resetRequests', tenantId],
    queryFn: async () => {
      const q = query(
        collection(db, 'password_resets'),
        where('status', '==', 'PENDING')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    },
    enabled: !!tenantId && isSuperAdmin,
  });

  // Create User State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<{
    name: string;
    email: string;
    password: string;
    roleId: string;
    permissions: string[];
  }>({
    name: '',
    email: '',
    password: '',
    roleId: 'viewer',
    permissions: ['downtime:view', 'production:view']
  });
  const [creating, setCreating] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<{
    roleId: string;
    status: string;
    permissions: string[];
  }>({
    roleId: '',
    status: 'ACTIVE',
    permissions: []
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Filtering users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const name = u.name.toLowerCase();
      const email = u.email.toLowerCase();
      const match = search.toLowerCase();
      return name.includes(match) || email.includes(match);
    });
  }, [users, search]);

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditFormData({
      roleId: user.roleId,
      status: user.status,
      permissions: user.permissions || []
    });
    setEditDialogOpen(true);
  };

  const handleCreatePermissionToggle = (permId: string) => {
    const currentPerms = createFormData.permissions;
    if (currentPerms.includes(permId)) {
      setCreateFormData({
        ...createFormData,
        permissions: currentPerms.filter(p => p !== permId)
      });
    } else {
      setCreateFormData({
        ...createFormData,
        permissions: [...currentPerms, permId]
      });
    }
  };

  const handleEditPermissionToggle = (permId: string) => {
    const currentPerms = editFormData.permissions;
    if (currentPerms.includes(permId)) {
      setEditFormData({
        ...editFormData,
        permissions: currentPerms.filter(p => p !== permId)
      });
    } else {
      setEditFormData({
        ...editFormData,
        permissions: [...currentPerms, permId]
      });
    }
  };

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      
      const roleChanged = editingUser.roleId !== editFormData.roleId;
      const statusChanged = editingUser.status !== editFormData.status;
      const permissionsChanged = JSON.stringify(editingUser.permissions || []) !== JSON.stringify(editFormData.permissions);

      if (roleChanged) {
        await updateUserRole(editingUser.id, editFormData.roleId);
      }

      if (statusChanged) {
        await updateUserStatus(editingUser.id, editFormData.status);
      }

      if (permissionsChanged || roleChanged || statusChanged) {
        const userDocRef = doc(db, 'users', editingUser.id);
        await updateDoc(userDocRef, {
          permissions: editFormData.permissions
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', tenantId] });
      setEditDialogOpen(false);
      setNotification({ open: true, message: 'User updated successfully!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to update user: ${err.message}`, severity: 'error' });
    }
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async (user: any) => {
      const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateUserStatus(user.id, nextStatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', tenantId] });
      setNotification({ open: true, message: 'User status updated!', severity: 'success' });
    }
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name || !createFormData.email || !createFormData.password || !createFormData.roleId) {
      setNotification({ open: true, message: 'Please fill in all fields', severity: 'error' });
      return;
    }

    if (createFormData.password.length < 6) {
      setNotification({ open: true, message: 'Password must be at least 6 characters long', severity: 'error' });
      return;
    }

    try {
      setCreating(true);
      const emailLower = createFormData.email.trim().toLowerCase();

      const secondaryUser = await registerSecondaryUser(emailLower, createFormData.password);
      const newUid = secondaryUser.uid;

      await setDoc(doc(db, 'users', newUid), {
        tenantId,
        name: createFormData.name.trim(),
        email: emailLower,
        roleId: createFormData.roleId,
        status: 'ACTIVE',
        isFirstLogin: true,
        permissions: createFormData.permissions,
        createdAt: new Date()
      });

      queryClient.invalidateQueries({ queryKey: ['users', tenantId] });
      setCreateDialogOpen(false);
      setCreateFormData({ name: '', email: '', password: '', roleId: 'viewer', permissions: ['downtime:view', 'production:view'] });
      setNotification({ open: true, message: 'User created successfully! They will change their password on first login.', severity: 'success' });
    } catch (err: any) {
      setNotification({ open: true, message: `Failed to create user: ${err.message}`, severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleApproveReset = async (request: any) => {
    try {
      await sendPasswordResetEmail(auth, request.email);

      await updateDoc(doc(db, 'password_resets', request.id), {
        status: 'APPROVED',
        approvedAt: new Date()
      });

      await updateDoc(doc(db, 'users', request.userId), {
        isFirstLogin: false
      });

      refetchResets();
      setNotification({ open: true, message: `Password reset link sent to ${request.email}!`, severity: 'success' });
    } catch (err: any) {
      setNotification({ open: true, message: `Failed to send reset link: ${err.message}`, severity: 'error' });
    }
  };

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon sx={{ color: '#6366f1' }} />
            User & Member Management
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Configure security roles, monitor account status, and approve pending password reset requests.
          </Typography>
        </Box>
        {isSuperAdmin && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            Add Member
          </Button>
        )}
      </Box>

      <Stack spacing={3}>
        {/* Users List Card */}
        <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ pb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                placeholder="Search users by name or email..."
                size="small"
                sx={{ width: { xs: '100%', sm: 300 } }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User Details</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="center">Status</TableCell>
                    {isSuperAdmin && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <TableRow key={u.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                            <Avatar sx={{ bgcolor: '#10b981', width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700 }}>
                              {u.name?.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                              {u.name} {u.id === userId && <span style={{ color: '#6366f1', fontSize: '0.75rem', fontWeight: 700 }}>(You)</span>}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ color: '#475569' }}>{u.email}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SecurityIcon sx={{ color: '#6366f1', fontSize: 17 }} />
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                              {ROLE_MAP[u.roleId] || 'Viewer'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={u.status}
                            sx={{
                              fontWeight: 700,
                              bgcolor: u.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: u.status === 'ACTIVE' ? '#059669' : '#dc2626',
                              fontSize: '0.7rem'
                            }}
                          />
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell align="right">
                            {u.id !== userId ? (
                              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                                <Tooltip title="Toggle Status">
                                  <IconButton onClick={() => toggleUserStatusMutation.mutate(u)} size="small">
                                    {u.status === 'ACTIVE' ? (
                                      <ToggleOnIcon sx={{ color: '#10b981', fontSize: 26 }} />
                                    ) : (
                                      <ToggleOffIcon sx={{ color: '#94a3b8', fontSize: 26 }} />
                                    )}
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Modify Access">
                                  <IconButton onClick={() => handleEditClick(u)} size="small" sx={{ color: '#6366f1' }}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            ) : (
                              <Typography variant="caption" sx={{ color: '#94a3b8', pr: 1.5 }}>Self account</Typography>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#64748b' }}>
                        {loadingUsers ? <CircularProgress size={30} /> : 'No users found.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Reset Requests Card (Visible to Admins) */}
        {isSuperAdmin && (
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" sx={{ pb: 1.5, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockResetIcon sx={{ color: '#6366f1' }} />
                Pending Password Reset Requests
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>User Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Requested At</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resetRequests.length > 0 ? (
                      resetRequests.map((req) => (
                        <TableRow key={req.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{req.name}</TableCell>
                          <TableCell>{req.email}</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleString() : new Date(req.requestedAt).toLocaleString()}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              onClick={() => handleApproveReset(req)}
                              sx={{ borderRadius: '6px', textTransform: 'none', fontWeight: 600 }}
                            >
                              Send Reset Link
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: '#64748b' }}>
                          {loadingResets ? <CircularProgress size={24} /> : 'No pending reset requests.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}
      </Stack>

      {/* Create User Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              p: 1
            }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1 }}>
          Add New Team Member
        </DialogTitle>
        <form onSubmit={handleCreateSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Full Name"
                size="small"
                required
                fullWidth
                value={createFormData.name}
                onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
              />
              <TextField
                label="Email Address"
                type="email"
                size="small"
                required
                fullWidth
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
              />
              <TextField
                label="Temporary Password"
                type="password"
                size="small"
                required
                fullWidth
                helperText="Must be at least 6 characters. User will change on first login."
                value={createFormData.password}
                onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
              />
              <FormControl fullWidth size="small" required>
                <InputLabel>Security Role</InputLabel>
                <Select
                  label="Security Role"
                  value={createFormData.roleId}
                  onChange={(e) => setCreateFormData({ ...createFormData, roleId: e.target.value })}
                >
                  <MenuItem value="tenant_admin">Tenant Admin (Full Plant Management)</MenuItem>
                  <MenuItem value="plant_manager">Plant Manager</MenuItem>
                  <MenuItem value="supervisor">Supervisor</MenuItem>
                  <MenuItem value="operator">Operator</MenuItem>
                  <MenuItem value="viewer">Viewer (Read Only)</MenuItem>
                </Select>
              </FormControl>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                  Screen Access Permissions
                </Typography>
                <FormGroup sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 0.5 }}>
                  {SCREEN_PERMISSIONS.map((perm) => (
                    <FormControlLabel
                      key={perm.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={createFormData.permissions.includes(perm.id)}
                          onChange={() => handleCreatePermissionToggle(perm.id)}
                          sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }}
                        />
                      }
                      label={<Typography variant="body2" sx={{ fontSize: '0.825rem', color: '#334155' }}>{perm.name}</Typography>}
                    />
                  ))}
                </FormGroup>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCreateDialogOpen(false)} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={creating} sx={{ borderRadius: '8px', fontWeight: 700 }}>
              {creating ? <CircularProgress size={20} color="inherit" /> : 'Create Member'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              p: 1
            }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1 }}>
          Modify User Access: {editingUser?.name}
        </DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Security Role</InputLabel>
                <Select
                  label="Security Role"
                  value={editFormData.roleId}
                  onChange={(e) => setEditFormData({ ...editFormData, roleId: e.target.value })}
                >
                  <MenuItem value="tenant_admin">Tenant Admin</MenuItem>
                  <MenuItem value="plant_manager">Plant Manager</MenuItem>
                  <MenuItem value="supervisor">Supervisor</MenuItem>
                  <MenuItem value="operator">Operator</MenuItem>
                  <MenuItem value="viewer">Viewer</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" required>
                <InputLabel>Account Status</InputLabel>
                <Select
                  label="Account Status"
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                >
                  <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                  <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                </Select>
              </FormControl>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                  Screen Access Permissions
                </Typography>
                <FormGroup sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 0.5 }}>
                  {SCREEN_PERMISSIONS.map((perm) => (
                    <FormControlLabel
                      key={perm.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={editFormData.permissions.includes(perm.id)}
                          onChange={() => handleEditPermissionToggle(perm.id)}
                          sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }}
                        />
                      }
                      label={<Typography variant="body2" sx={{ fontSize: '0.825rem', color: '#334155' }}>{perm.name}</Typography>}
                    />
                  ))}
                </FormGroup>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditDialogOpen(false)} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={updateMutation.isPending} sx={{ borderRadius: '8px', fontWeight: 700 }}>
              Save Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification((n) => ({ ...n, open: false }))}
      >
        <Alert severity={notification.severity} variant="filled" sx={{ width: '100%', borderRadius: '10px' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
