import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getMachines,
  getPlants,
  createMachine,
  updateMachine,
  logActivity,
  type Machine
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
  Chip,
  InputAdornment
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import FactoryIcon from '@mui/icons-material/Factory';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import SearchIcon from '@mui/icons-material/Search';

export const Machines: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, profile } = useAuthStore();
  const tenantId = tenant?.id || '';
  const userId = profile?.id || '';
  const userName = profile?.name || '';

  // Notifications
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Queries
  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['machines', tenantId],
    queryFn: () => getMachines(tenantId),
    enabled: !!tenantId,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ['plants', tenantId],
    queryFn: () => getPlants(tenantId),
    enabled: !!tenantId,
  });

  // States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [formData, setFormData] = useState({
    machineCode: '',
    machineName: '',
    plantId: '',
    capacity: 0,
    status: 'ACTIVE'
  });
  const [search, setSearch] = useState('');

  // Local filtering
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const code = m.machineCode.toLowerCase();
      const name = m.machineName.toLowerCase();
      const match = search.toLowerCase();
      return code.includes(match) || name.includes(match);
    });
  }, [machines, search]);

  const handleOpenDialog = (machine?: Machine) => {
    if (machine) {
      setEditingMachine(machine);
      setFormData({
        machineCode: machine.machineCode,
        machineName: machine.machineName,
        plantId: machine.plantId,
        capacity: machine.capacity || 0,
        status: machine.status
      });
    } else {
      setEditingMachine(null);
      setFormData({
        machineCode: '',
        machineName: '',
        plantId: plants[0]?.id || '',
        capacity: 100,
        status: 'ACTIVE'
      });
    }
    setDialogOpen(true);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const newId = await createMachine({
        tenantId,
        plantId: data.plantId,
        machineCode: data.machineCode.trim().toUpperCase(),
        machineName: data.machineName.trim(),
        capacity: Number(data.capacity),
        status: data.status as any,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'CREATE_MACHINE',
        `Created machine ${data.machineCode}`,
        null,
        data
      );
      return newId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', tenantId] });
      setDialogOpen(false);
      setNotification({ open: true, message: 'Machine registered successfully!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to create machine: ${err.message}`, severity: 'error' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!editingMachine) return;
      await updateMachine(editingMachine.id, {
        plantId: data.plantId,
        machineCode: data.machineCode.trim().toUpperCase(),
        machineName: data.machineName.trim(),
        capacity: Number(data.capacity),
        status: data.status as any,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'UPDATE_MACHINE',
        `Updated machine ${editingMachine.machineCode}`,
        editingMachine,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', tenantId] });
      setDialogOpen(false);
      setNotification({ open: true, message: 'Machine updated successfully!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to update machine: ${err.message}`, severity: 'error' });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (machine: Machine) => {
      const nextStatus = machine.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateMachine(machine.id, { status: nextStatus as any });
      await logActivity(
        tenantId,
        userId,
        userName,
        'UPDATE_MACHINE_STATUS',
        `Toggled status of machine ${machine.machineCode} to ${nextStatus}`,
        machine,
        { status: nextStatus }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', tenantId] });
      setNotification({ open: true, message: 'Machine status updated!', severity: 'success' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.machineCode || !formData.machineName || !formData.plantId) {
      setNotification({ open: true, message: 'Please complete required fields.', severity: 'error' });
      return;
    }

    if (editingMachine) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <FactoryIcon sx={{ color: '#10b981' }} />
            Machines & Production Lines Master
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Configure production machinery, line codes, hourly speed capacities, and plant allocations.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
        >
          Add Machine
        </Button>
      </Box>

      <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ pb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search by code or machine name..."
              size="small"
              sx={{ width: { xs: '100%', sm: 320 } }}
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
                  <TableCell>Machine Code</TableCell>
                  <TableCell>Machine Name</TableCell>
                  <TableCell>Plant Location</TableCell>
                  <TableCell align="right">Hourly Capacity</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMachines.length > 0 ? (
                  filteredMachines.map((m) => {
                    const plantObj = plants.find((p) => p.id === m.plantId);
                    return (
                      <TableRow key={m.id} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#6366f1' }}>
                          {m.machineCode}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{m.machineName}</TableCell>
                        <TableCell>{plantObj?.plantName || 'Unknown'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#10b981' }}>
                          {m.capacity} units/hr
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={m.status}
                            sx={{
                              fontWeight: 700,
                              bgcolor: m.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: m.status === 'ACTIVE' ? '#059669' : '#dc2626',
                              fontSize: '0.7rem'
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                            <Tooltip title="Toggle Status">
                              <IconButton onClick={() => toggleStatusMutation.mutate(m)} size="small">
                                {m.status === 'ACTIVE' ? (
                                  <ToggleOnIcon sx={{ color: '#10b981', fontSize: 26 }} />
                                ) : (
                                  <ToggleOffIcon sx={{ color: '#94a3b8', fontSize: 26 }} />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Machine">
                              <IconButton onClick={() => handleOpenDialog(m)} size="small" sx={{ color: '#6366f1' }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#64748b' }}>
                      {loadingMachines ? <CircularProgress size={30} /> : 'No machines found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Machine Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
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
          {editingMachine ? 'Edit Machine Information' : 'Register New Machine'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Machine Code"
                placeholder="e.g. MC-01"
                size="small"
                required
                fullWidth
                value={formData.machineCode}
                onChange={(e) => setFormData({ ...formData, machineCode: e.target.value })}
              />
              <TextField
                label="Machine Name"
                placeholder="e.g. High-Speed Loom Line A"
                size="small"
                required
                fullWidth
                value={formData.machineName}
                onChange={(e) => setFormData({ ...formData, machineName: e.target.value })}
              />
              <FormControl fullWidth size="small" required>
                <InputLabel>Target Plant</InputLabel>
                <Select
                  label="Target Plant"
                  value={formData.plantId}
                  onChange={(e) => setFormData({ ...formData, plantId: e.target.value })}
                >
                  {plants.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.plantName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Hourly Output Capacity (units/hr)"
                type="number"
                size="small"
                required
                fullWidth
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
              />
              <FormControl fullWidth size="small" required>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                  <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={createMutation.isPending || updateMutation.isPending}
              sx={{ borderRadius: '8px', fontWeight: 700 }}
            >
              {editingMachine ? 'Save Changes' : 'Register Machine'}
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
