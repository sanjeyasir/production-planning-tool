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
  Avatar,
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import FactoryIcon from '@mui/icons-material/Factory';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';

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
        capacity: machine.capacity,
        status: machine.status
      });
    } else {
      setEditingMachine(null);
      setFormData({
        machineCode: '',
        machineName: '',
        plantId: plants.length > 0 ? plants[0].id : '',
        capacity: 100,
        status: 'ACTIVE'
      });
    }
    setDialogOpen(true);
  };

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingMachine) {
        await updateMachine(editingMachine.id, {
          machineCode: formData.machineCode,
          machineName: formData.machineName,
          plantId: formData.plantId,
          capacity: Number(formData.capacity),
          status: formData.status
        });
        await logActivity(
          tenantId,
          userId,
          userName,
          'UPDATE_MACHINE',
          `Updated machine ${formData.machineCode}`,
          editingMachine,
          formData
        );
      } else {
        await createMachine({
          tenantId,
          machineCode: formData.machineCode,
          machineName: formData.machineName,
          plantId: formData.plantId,
          capacity: Number(formData.capacity),
          status: formData.status
        });
        await logActivity(
          tenantId,
          userId,
          userName,
          'CREATE_MACHINE',
          `Created machine ${formData.machineCode}`,
          null,
          formData
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', tenantId] });
      setDialogOpen(false);
      setNotification({
        open: true,
        message: editingMachine ? 'Machine updated!' : 'Machine created!',
        severity: 'success'
      });
    },
    onError: (err: any) => {
      setNotification({
        open: true,
        message: `Error saving machine: ${err.message}`,
        severity: 'error'
      });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (machine: Machine) => {
      const nextStatus = machine.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateMachine(machine.id, { status: nextStatus });
      await logActivity(
        tenantId,
        userId,
        userName,
        'TOGGLE_MACHINE_STATUS',
        `Toggled machine ${machine.machineCode} status to ${nextStatus}`,
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
    if (!formData.machineCode || !formData.machineName || !formData.plantId || formData.capacity <= 0) {
      setNotification({ open: true, message: 'Please fill in all required fields.', severity: 'error' });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Machines Administration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your industrial machinery list, operational speeds, and associated locations.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={plants.length === 0}
        >
          Add New Machine
        </Button>
      </Box>

      {plants.length === 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No active plants found. You must register at least one plant before adding machines.
        </Alert>
      )}

      <Card>
        <CardContent sx={{ px: 0 }}>
          {/* Table Toolbar */}
          <Box sx={{ px: 3, pb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search by code or name..."
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
                  <TableCell sx={{ pl: 3 }}>Machine Code</TableCell>
                  <TableCell>Machine Name</TableCell>
                  <TableCell>Plant Location</TableCell>
                  <TableCell align="right">Hourly Capacity</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right" sx={{ pr: 3 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMachines.length > 0 ? (
                  filteredMachines.map((m) => {
                    const plantObj = plants.find((p) => p.id === m.plantId);
                    return (
                      <TableRow key={m.id} hover>
                        <TableCell sx={{ pl: 3, fontWeight: 700 }}>{m.machineCode}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                            <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: 'secondary.light', width: 34, height: 34 }}>
                              <FactoryIcon sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {m.machineName}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>{plantObj?.plantName || 'Unknown'}</TableCell>
                        <TableCell align="right">{m.capacity.toLocaleString()} units/hr</TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              display: 'inline-flex',
                              bgcolor: m.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: m.status === 'ACTIVE' ? 'secondary.light' : 'error.light',
                              borderRadius: '6px',
                              px: 1.5,
                              py: 0.5,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {m.status}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 3 }}>
                          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
                            <Tooltip title="Toggle Status">
                              <IconButton onClick={() => toggleStatusMutation.mutate(m)} size="small">
                                {m.status === 'ACTIVE' ? (
                                  <ToggleOnIcon sx={{ color: 'secondary.main', fontSize: 26 }} />
                                ) : (
                                  <ToggleOffIcon sx={{ color: 'text.disabled', fontSize: 26 }} />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Details">
                              <IconButton onClick={() => handleOpenDialog(m)} size="small" color="primary">
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
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      {loadingMachines ? (
                        <CircularProgress color="primary" />
                      ) : (
                        <Typography color="text.secondary">No machinery registered.</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Entry Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingMachine ? 'Edit Machine Details' : 'Register New Machine'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                label="Machine Code"
                placeholder="e.g. CNC-01"
                required
                fullWidth
                value={formData.machineCode}
                onChange={(e) => setFormData({ ...formData, machineCode: e.target.value })}
              />
              <TextField
                label="Machine Name"
                placeholder="e.g. 5-Axis Milling Station"
                required
                fullWidth
                value={formData.machineName}
                onChange={(e) => setFormData({ ...formData, machineName: e.target.value })}
              />
              <FormControl fullWidth required>
                <InputLabel>Associated Plant</InputLabel>
                <Select
                  label="Associated Plant"
                  value={formData.plantId}
                  onChange={(e) => setFormData({ ...formData, plantId: e.target.value })}
                >
                  {plants.filter(p => p.status === 'ACTIVE').map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.plantName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Production Capacity (units/hr)"
                type="number"
                required
                fullWidth
                value={formData.capacity || ''}
                onChange={(e) => setFormData({ ...formData, capacity: Math.max(0, Number(e.target.value)) })}
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                  <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setDialogOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              Save
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
