import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getUsers,
  getAllUsers,
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
import RestartAltIcon from '@mui/icons-material/RestartAlt';

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

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  defaultPermissions: string[];
  badgeColor: { bg: string; color: string; border: string };
}

export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  super_admin: {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Global administrator with multi-company access, role setup, and complete system control.',
    defaultPermissions: [
      'production:view',
      'production:create',
      'downtime:view',
      'downtime:create',
      'master:view',
      'user:view'
    ],
    badgeColor: { bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: 'rgba(239, 68, 68, 0.3)' }
  },
  tenant_admin: {
    id: 'tenant_admin',
    name: 'Tenant Admin',
    description: 'Full plant authority over schedules, outputs, downtime, masters, and team members.',
    defaultPermissions: [
      'production:view',
      'production:create',
      'downtime:view',
      'downtime:create',
      'master:view',
      'user:view'
    ],
    badgeColor: { bg: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', border: 'rgba(147, 51, 234, 0.3)' }
  },
  plant_manager: {
    id: 'plant_manager',
    name: 'Plant Manager',
    description: 'Supervises overall plant planning, schedules, production KPIs, downtime, and machine masters.',
    defaultPermissions: [
      'production:view',
      'production:create',
      'downtime:view',
      'downtime:create',
      'master:view'
    ],
    badgeColor: { bg: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', border: 'rgba(79, 70, 229, 0.3)' }
  },
  supervisor: {
    id: 'supervisor',
    name: 'Supervisor',
    description: 'Manages daily line operations, schedule execution, output logs, downtime events, and reports.',
    defaultPermissions: [
      'production:view',
      'production:create',
      'downtime:view',
      'downtime:create',
      'master:view'
    ],
    badgeColor: { bg: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.3)' }
  },
  operator: {
    id: 'operator',
    name: 'Operator',
    description: 'Shop floor operator responsible for daily output logging, downtime entries, and schedule visibility.',
    defaultPermissions: [
      'production:view',
      'production:create',
      'downtime:create'
    ],
    badgeColor: { bg: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: 'rgba(16, 185, 129, 0.3)' }
  },
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to portal dashboards, production charts, and downtime analytics.',
    defaultPermissions: [
      'production:view',
      'downtime:view'
    ],
    badgeColor: { bg: 'rgba(100, 116, 139, 0.1)', color: '#475569', border: 'rgba(100, 116, 139, 0.3)' }
  }
};

export const ROLE_MAP: Record<string, string> = {
  'super_admin': 'Super Admin',
  'tenant_admin': 'Tenant Admin',
  'plant_manager': 'Plant Manager',
  'supervisor': 'Supervisor',
  'operator': 'Operator',
  'viewer': 'Viewer'
};

const SCREEN_PERMISSIONS = [
  { id: 'production:view', name: 'Production & Planning View (Orders, Schedules, Analytics)' },
  { id: 'production:create', name: 'Planning & Output Entry (Schedule Creation, Daily Output)' },
  { id: 'downtime:view', name: 'Downtime Analytics (Dashboard & Reports)' },
  { id: 'downtime:create', name: 'Log Downtime Operations' },
  { id: 'master:view', name: 'Master Data (Machines, Categories/Sections, Calendar)' },
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
    queryKey: ['users', tenantId, isSuperAdmin],
    queryFn: () => isSuperAdmin ? getAllUsers() : getUsers(tenantId),
    enabled: !!tenantId || isSuperAdmin,
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
    company: string;
    permissions: string[];
  }>({
    name: '',
    email: '',
    password: '',
    roleId: 'operator',
    company: 'rileys',
    permissions: ROLE_DEFINITIONS.operator.defaultPermissions
  });
  const [creating, setCreating] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<{
    roleId: string;
    company: string;
    status: string;
    permissions: string[];
  }>({
    roleId: '',
    company: 'rileys',
    status: 'ACTIVE',
    permissions: []
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Filtering users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const company = (u.company || u.tenantId || '').toLowerCase();
      const match = search.toLowerCase();
      return name.includes(match) || email.includes(match) || company.includes(match);
    });
  }, [users, search]);

  const handleEditClick = (user: any) => {
    const roleId = user.roleId || 'viewer';
    const currentPerms = (user.permissions && user.permissions.length > 0)
      ? user.permissions
      : (ROLE_DEFINITIONS[roleId]?.defaultPermissions || ['production:view', 'downtime:view']);

    setEditingUser(user);
    setEditFormData({
      roleId,
      company: user.company || (user.tenantId === 'toyo' ? 'toyo' : 'rileys'),
      status: user.status || 'ACTIVE',
      permissions: currentPerms
    });
    setEditDialogOpen(true);
  };

  const createRoleDef = ROLE_DEFINITIONS[createFormData.roleId] || ROLE_DEFINITIONS.operator;
  const editRoleDef = ROLE_DEFINITIONS[editFormData.roleId] || ROLE_DEFINITIONS.viewer;

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
      
      const userDocRef = doc(db, 'users', editingUser.id);
      const targetTenant = editFormData.company === 'all' ? 'rileys' : editFormData.company;

      await updateDoc(userDocRef, {
        roleId: editFormData.roleId,
        company: editFormData.company,
        tenantId: targetTenant,
        status: editFormData.status,
        permissions: editFormData.permissions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditDialogOpen(false);
      setNotification({ open: true, message: 'User role & company access updated successfully!', severity: 'success' });
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
      queryClient.invalidateQueries({ queryKey: ['users'] });
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

      const targetTenant = createFormData.company === 'all' ? 'rileys' : createFormData.company;

      await setDoc(doc(db, 'users', newUid), {
        tenantId: targetTenant,
        company: createFormData.company,
        name: createFormData.name.trim(),
        email: emailLower,
        roleId: createFormData.roleId,
        status: 'ACTIVE',
        isFirstLogin: true,
        permissions: createFormData.permissions,
        createdAt: new Date()
      });

      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateDialogOpen(false);
      setCreateFormData({ 
        name: '', 
        email: '', 
        password: '', 
        roleId: 'operator', 
        company: 'rileys',
        permissions: ROLE_DEFINITIONS.operator.defaultPermissions 
      });
      setNotification({ open: true, message: 'User created successfully with company access! They will change their password on first login.', severity: 'success' });
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
                    <TableCell>Company Access</TableCell>
                    <TableCell align="center">Status</TableCell>
                    {isSuperAdmin && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => {
                      const isToyo = u.company === 'toyo' || u.tenantId === 'toyo';
                      const isAll = u.company === 'all' || u.email === 'admin@gmail.com';
                      const compLabel = isToyo ? 'Toyo' : isAll ? 'All Companies (Admin)' : "Riley's";

                      return (
                        <TableRow key={u.id} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                              <Avatar sx={{ bgcolor: isToyo ? '#0284c7' : '#6366f1', width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700 }}>
                                {u.name?.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                                {u.name} {u.id === userId && <span style={{ color: '#6366f1', fontSize: '0.75rem', fontWeight: 700 }}>(You)</span>}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ color: '#475569' }}>{u.email}</TableCell>
                          <TableCell>
                            {(() => {
                              const roleDef = ROLE_DEFINITIONS[u.roleId] || ROLE_DEFINITIONS.viewer;
                              const perms = u.permissions || roleDef.defaultPermissions || [];
                              const isFull = perms.length >= SCREEN_PERMISSIONS.length || u.roleId === 'super_admin';
                              return (
                                <Box>
                                  <Chip
                                    size="small"
                                    icon={<SecurityIcon sx={{ fontSize: '13px !important', color: `${roleDef.badgeColor.color} !important` }} />}
                                    label={roleDef.name}
                                    sx={{
                                      fontWeight: 800,
                                      fontSize: '0.725rem',
                                      bgcolor: roleDef.badgeColor.bg,
                                      color: roleDef.badgeColor.color,
                                      border: `1px solid ${roleDef.badgeColor.border}`,
                                      mb: 0.3
                                    }}
                                  />
                                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: '0.675rem', fontWeight: 600 }}>
                                    {isFull ? 'Full Access (All Modules)' : `${perms.length}/${SCREEN_PERMISSIONS.length} Modules Permitted`}
                                  </Typography>
                                </Box>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={compLabel}
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.725rem',
                                bgcolor: isToyo ? 'rgba(2, 132, 199, 0.1)' : isAll ? 'rgba(147, 51, 234, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                color: isToyo ? '#0284c7' : isAll ? '#9333ea' : '#4f46e5',
                                border: `1px solid ${isToyo ? 'rgba(2, 132, 199, 0.3)' : isAll ? 'rgba(147, 51, 234, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`
                              }}
                            />
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
                                  <Tooltip title="Modify Access & Company">
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
                      );
                    })
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
                  onChange={(e) => {
                    const newRole = e.target.value;
                    setCreateFormData({
                      ...createFormData,
                      roleId: newRole,
                      permissions: ROLE_DEFINITIONS[newRole]?.defaultPermissions || []
                    });
                  }}
                >
                  {isSuperAdmin && (
                    <MenuItem value="super_admin">
                      <Box sx={{ py: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626' }}>
                          Super Admin
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          {ROLE_DEFINITIONS.super_admin.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  )}
                  {Object.entries(ROLE_DEFINITIONS)
                    .filter(([key]) => key !== 'super_admin')
                    .map(([key, def]) => (
                      <MenuItem key={key} value={key}>
                        <Box sx={{ py: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: def.badgeColor.color }}>
                            {def.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                            {def.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {/* Selected Role Overview Box */}
              {createRoleDef && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: '10px',
                    bgcolor: createRoleDef.badgeColor.bg,
                    border: `1px solid ${createRoleDef.badgeColor.border}`,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: createRoleDef.badgeColor.color, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <SecurityIcon sx={{ fontSize: 16 }} />
                    {createRoleDef.name} Role Profile
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#334155', display: 'block', mt: 0.3 }}>
                    {createRoleDef.description}
                  </Typography>
                </Box>
              )}

              <FormControl fullWidth size="small" required>
                <InputLabel>Company Access</InputLabel>
                <Select
                  label="Company Access"
                  value={createFormData.company}
                  onChange={(e) => setCreateFormData({ ...createFormData, company: e.target.value })}
                >
                  <MenuItem value="rileys">Riley's Plant Operations</MenuItem>
                  <MenuItem value="toyo">Toyo Manufacturing</MenuItem>
                  {isSuperAdmin && <MenuItem value="all">All Companies (Super Admin)</MenuItem>}
                </Select>
              </FormControl>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Screen Access Permissions
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<RestartAltIcon sx={{ fontSize: 14 }} />}
                    onClick={() => {
                      setCreateFormData(prev => ({
                        ...prev,
                        permissions: ROLE_DEFINITIONS[prev.roleId]?.defaultPermissions || []
                      }));
                    }}
                    sx={{ fontSize: '0.72rem', textTransform: 'none', py: 0.2, px: 1, color: '#6366f1' }}
                  >
                    Reset to Role Defaults
                  </Button>
                </Box>
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
                  onChange={(e) => {
                    const newRole = e.target.value;
                    setEditFormData({
                      ...editFormData,
                      roleId: newRole,
                      permissions: ROLE_DEFINITIONS[newRole]?.defaultPermissions || editFormData.permissions
                    });
                  }}
                >
                  {isSuperAdmin && (
                    <MenuItem value="super_admin">
                      <Box sx={{ py: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626' }}>
                          Super Admin
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          {ROLE_DEFINITIONS.super_admin.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  )}
                  {Object.entries(ROLE_DEFINITIONS)
                    .filter(([key]) => key !== 'super_admin')
                    .map(([key, def]) => (
                      <MenuItem key={key} value={key}>
                        <Box sx={{ py: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: def.badgeColor.color }}>
                            {def.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                            {def.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {/* Edit Role Overview Box */}
              {editRoleDef && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: '10px',
                    bgcolor: editRoleDef.badgeColor.bg,
                    border: `1px solid ${editRoleDef.badgeColor.border}`,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: editRoleDef.badgeColor.color, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <SecurityIcon sx={{ fontSize: 16 }} />
                    {editRoleDef.name} Role Profile
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#334155', display: 'block', mt: 0.3 }}>
                    {editRoleDef.description}
                  </Typography>
                </Box>
              )}

              <FormControl fullWidth size="small" required>
                <InputLabel>Company Access</InputLabel>
                <Select
                  label="Company Access"
                  value={editFormData.company}
                  onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                >
                  <MenuItem value="rileys">Riley's Plant Operations</MenuItem>
                  <MenuItem value="toyo">Toyo Manufacturing</MenuItem>
                  {isSuperAdmin && <MenuItem value="all">All Companies (Super Admin)</MenuItem>}
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Screen Access Permissions
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<RestartAltIcon sx={{ fontSize: 14 }} />}
                    onClick={() => {
                      setEditFormData(prev => ({
                        ...prev,
                        permissions: ROLE_DEFINITIONS[prev.roleId]?.defaultPermissions || []
                      }));
                    }}
                    sx={{ fontSize: '0.72rem', textTransform: 'none', py: 0.2, px: 1, color: '#6366f1' }}
                  >
                    Reset to Role Defaults
                  </Button>
                </Box>
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
