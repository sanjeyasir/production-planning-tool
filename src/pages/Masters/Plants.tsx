import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getPlants,
  createPlant,
  updatePlant,
  logActivity,
  type Plant
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
  Avatar,
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
import BusinessIcon from '@mui/icons-material/Business';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import SearchIcon from '@mui/icons-material/Search';

export const Plants: React.FC = () => {
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
  const { data: plants = [], isLoading } = useQuery({
    queryKey: ['plants', tenantId],
    queryFn: () => getPlants(tenantId),
    enabled: !!tenantId,
  });

  // States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [formData, setFormData] = useState({
    plantName: '',
    location: '',
    status: 'ACTIVE'
  });
  const [search, setSearch] = useState('');

  // Local filtering
  const filteredPlants = useMemo(() => {
    return plants.filter((p) => {
      const name = p.plantName.toLowerCase();
      const loc = p.location.toLowerCase();
      const match = search.toLowerCase();
      return name.includes(match) || loc.includes(match);
    });
  }, [plants, search]);

  const handleOpenDialog = (plant?: Plant) => {
    if (plant) {
      setEditingPlant(plant);
      setFormData({
        plantName: plant.plantName,
        location: plant.location,
        status: plant.status
      });
    } else {
      setEditingPlant(null);
      setFormData({
        plantName: '',
        location: '',
        status: 'ACTIVE'
      });
    }
    setDialogOpen(true);
  };

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingPlant) {
        await updatePlant(editingPlant.id, {
          plantName: formData.plantName,
          location: formData.location,
          status: formData.status
        });
        await logActivity(
          tenantId,
          userId,
          userName,
          'UPDATE_PLANT',
          `Updated plant ${formData.plantName}`,
          editingPlant,
          formData
        );
      } else {
        await createPlant({
          tenantId,
          plantName: formData.plantName,
          location: formData.location,
          status: formData.status
        });
        await logActivity(
          tenantId,
          userId,
          userName,
          'CREATE_PLANT',
          `Created plant ${formData.plantName}`,
          null,
          formData
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants', tenantId] });
      setDialogOpen(false);
      setNotification({
        open: true,
        message: editingPlant ? 'Plant updated successfully!' : 'Plant created successfully!',
        severity: 'success'
      });
    },
    onError: (err: any) => {
      setNotification({
        open: true,
        message: `Error saving plant: ${err.message}`,
        severity: 'error'
      });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (plant: Plant) => {
      const nextStatus = plant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updatePlant(plant.id, { status: nextStatus });
      await logActivity(
        tenantId,
        userId,
        userName,
        'TOGGLE_PLANT_STATUS',
        `Toggled plant ${plant.plantName} status to ${nextStatus}`,
        plant,
        { status: nextStatus }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants', tenantId] });
      setNotification({ open: true, message: 'Status updated successfully!', severity: 'success' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plantName || !formData.location) {
      setNotification({ open: true, message: 'Please fill in all fields.', severity: 'error' });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon sx={{ color: '#10b981' }} />
            Plants Administration & Locations
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Manage physical factory units, facilities, and regional manufacturing operations.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
        >
          Add New Plant
        </Button>
      </Box>

      <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 2.5 }}>
          {/* Table Toolbar */}
          <Box sx={{ pb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search plants by name or location..."
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
                  <TableCell>Plant Name</TableCell>
                  <TableCell>Location / Facility Address</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPlants.length > 0 ? (
                  filteredPlants.map((plant) => (
                    <TableRow key={plant.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', width: 32, height: 32 }}>
                            <BusinessIcon sx={{ fontSize: 18 }} />
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                            {plant.plantName}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ color: '#475569', fontWeight: 500 }}>
                        {plant.location}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={plant.status}
                          sx={{
                            fontWeight: 700,
                            bgcolor: plant.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: plant.status === 'ACTIVE' ? '#059669' : '#dc2626',
                            fontSize: '0.7rem'
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Tooltip title="Toggle Status">
                            <IconButton onClick={() => toggleStatusMutation.mutate(plant)} size="small">
                              {plant.status === 'ACTIVE' ? (
                                <ToggleOnIcon sx={{ color: '#10b981', fontSize: 26 }} />
                              ) : (
                                <ToggleOffIcon sx={{ color: '#94a3b8', fontSize: 26 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Details">
                            <IconButton onClick={() => handleOpenDialog(plant)} size="small" sx={{ color: '#6366f1' }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6, color: '#64748b' }}>
                      {isLoading ? (
                        <CircularProgress size={30} color="primary" />
                      ) : (
                        'No plants registered.'
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Entry / Edit Dialog */}
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
          {editingPlant ? 'Edit Plant Details' : 'Register New Plant'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Plant Name"
                placeholder="e.g. Plant Alpha - Main Facility"
                size="small"
                required
                fullWidth
                value={formData.plantName}
                onChange={(e) => setFormData({ ...formData, plantName: e.target.value })}
              />
              <TextField
                label="Location / Facility Address"
                placeholder="e.g. Colombo Sector 4"
                size="small"
                required
                fullWidth
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
              <FormControl fullWidth size="small">
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
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
            <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748b', fontWeight: 600, textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saveMutation.isPending}
              sx={{ borderRadius: '8px', px: 3, fontWeight: 600, textTransform: 'none' }}
            >
              {saveMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Save Plant'}
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
