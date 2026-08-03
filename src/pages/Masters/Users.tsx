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
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import AddIcon from '@mui/icons-material/Add';
import LockResetIcon from '@mui/icons-material/LockReset';

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

      // 1. Create Auth user via secondary app instance
      const secondaryUser = await registerSecondaryUser(emailLower, createFormData.password);
      const newUid = secondaryUser.uid;

      // 2. Create profile document in Firestore users collection
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
      // 1. Send Firebase native password reset email
      await sendPasswordResetEmail(auth, request.email);

      // 2. Update status in password_resets collection
      await updateDoc(doc(db, 'password_resets', request.id), {
        status: 'APPROVED',
        approvedAt: new Date()
      });

      // 3. Mark isFirstLogin = false in Firestore users collection
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
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            User & Member Administration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure security roles, manage team status, and approve password reset requests.
          </Typography>
        </Box>
        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            Add Member
          </Button>
        )}
      </Box>

      <Stack spacing={4}>
        {/* Users List Card */}
        <Card>
          <CardContent sx={{ px: 0 }}>
            <Box sx={{ px: 3, pb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                placeholder="Search users by name or email..."
                size="small"
                sx={{ width: 320 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ pl: 3 }}>User Details</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="center">Status</TableCell>
                    {isSuperAdmin && <TableCell align="right" sx={{ pr: 3 }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <TableRow key={u.id} hover>
                        <TableCell sx={{ pl: 3 }}>
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                            <Avatar sx={{ bgcolor: 'primary.dark', width: 34, height: 34, fontSize: '0.85rem' }}>
                              {u.name?.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {u.name} {u.id === userId && <span style={{ color: '#6366f1', fontSize: '0.75rem' }}>(You)</span>}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SecurityIcon fontSize="small" sx={{ color: 'primary.light' }} />
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {ROLE_MAP[u.roleId] || 'Viewer'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              display: 'inline-flex',
                              bgcolor: u.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: u.status === 'ACTIVE' ? 'secondary.light' : 'error.light',
                              borderRadius: '6px',
                              px: 1.5,
                              py: 0.5,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {u.status}
                          </Box>
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell align="right" sx={{ pr: 3 }}>
                            {u.id !== userId ? (
                              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
                                <Tooltip title="Toggle Status">
                                  <IconButton onClick={() => toggleUserStatusMutation.mutate(u)} size="small">
                                    {u.status === 'ACTIVE' ? (
                                      <ToggleOnIcon sx={{ color: 'secondary.main', fontSize: 26 }} />
                                    ) : (
                                      <ToggleOffIcon sx={{ color: 'text.disabled', fontSize: 26 }} />
                                    )}
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Modify Access">
                                  <IconButton onClick={() => handleEditClick(u)} size="small" color="primary">
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.disabled" sx={{ pr: 2 }}>Self account</Typography>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        {loadingUsers ? <CircularProgress color="primary" /> : <Typography color="text.secondary">No users found.</Typography>}
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
          <Card>
            <CardContent sx={{ px: 0 }}>
              <Typography variant="h6" sx={{ px: 3, pb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockResetIcon sx={{ color: 'primary.light' }} />
                Pending Password Reset Requests
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ pl: 3 }}>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Requested At</TableCell>
                      <TableCell align="right" sx={{ pr: 3 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resetRequests.length > 0 ? (
                      resetRequests.map((req) => (
                        <TableRow key={req.id} hover>
                          <TableCell sx={{ pl: 3, fontWeight: 600 }}>{req.name}</TableCell>
                          <TableCell>{req.email}</TableCell>
                          <TableCell>{new Date(req.requestedAt?.seconds * 1000 || req.requestedAt).toLocaleString()}</TableCell>
                          <TableCell align="right" sx={{ pr: 3 }}>
                            <Button
                              variant="outlined"
                              color="primary"
                              size="small"
                              onClick={() => handleApproveReset(req)}
                              sx={{ textTransform: 'none', borderRadius: '6px', fontWeight: 600 }}
                            >
                              Approve & Send Reset Link
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                          {loadingResets ? <CircularProgress color="primary" /> : <Typography color="text.secondary">No pending password reset requests.</Typography>}
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

      {/* Add User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => !creating && setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New Team Member</DialogTitle>
        <form onSubmit={handleCreateSubmit}>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                label="Full Name"
                required
                fullWidth
                value={createFormData.name}
                onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                disabled={creating}
              />
              <TextField
                label="Email Address"
                type="email"
                required
                fullWidth
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                disabled={creating}
              />
              <TextField
                label="Temporary Password"
                type="password"
                required
                fullWidth
                helperText="Must be at least 6 characters. User will be forced to change this upon first login."
                value={createFormData.password}
                onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                disabled={creating}
              />
              <FormControl fullWidth required>
                <InputLabel>Security Role</InputLabel>
                <Select
                  label="Security Role"
                  value={createFormData.roleId}
                  onChange={(e) => setCreateFormData({ ...createFormData, roleId: e.target.value })}
                  disabled={creating}
                >
                  <MenuItem value="tenant_admin">Tenant Admin</MenuItem>
                  <MenuItem value="plant_manager">Plant Manager</MenuItem>
                  <MenuItem value="supervisor">Supervisor</MenuItem>
                  <MenuItem value="operator">Operator</MenuItem>
                  <MenuItem value="viewer">Viewer</MenuItem>
                </Select>
              </FormControl>

              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Granted Screen Access
              </Typography>
              <FormGroup>
                {SCREEN_PERMISSIONS.map((perm) => (
                  <FormControlLabel
                    key={perm.id}
                    control={
                      <Checkbox
                        checked={createFormData.permissions.includes(perm.id)}
                        onChange={() => handleCreatePermissionToggle(perm.id)}
                        disabled={creating}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">{perm.name}</Typography>}
                  />
                ))}
              </FormGroup>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setCreateDialogOpen(false)} color="inherit" disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={creating}>
              {creating ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Modify Member Access</DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent>
            {editingUser && (
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Name: {editingUser.name}</Typography>
                  <Typography variant="body2" color="text.secondary">Email: {editingUser.email}</Typography>
                </Box>

                <FormControl fullWidth required>
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

                <FormControl fullWidth>
                  <InputLabel>Member Status</InputLabel>
                  <Select
                    label="Member Status"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  >
                    <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                    <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                  </Select>
                </FormControl>

                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Granted Screen Access
                </Typography>
                <FormGroup>
                  {SCREEN_PERMISSIONS.map((perm) => (
                    <FormControlLabel
                      key={perm.id}
                      control={
                        <Checkbox
                          checked={editFormData.permissions.includes(perm.id)}
                          onChange={() => handleEditPermissionToggle(perm.id)}
                          size="small"
                        />
                      }
                      label={<Typography variant="body2">{perm.name}</Typography>}
                    />
                  ))}
                </FormGroup>
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setEditDialogOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
              Apply Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification((n) => ({ ...n, open: false }))}
      >
        <Alert severity={notification.severity} variant="filled">
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
