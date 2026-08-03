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
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';

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
        message: editingPlant ? 'Plant updated!' : 'Plant created!',
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
      setNotification({ open: true, message: 'Status updated!', severity: 'success' });
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
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Plants Administration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your physical plant locations and toggle manufacturing operations contexts.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add New Plant
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ px: 0 }}>
          {/* Table Toolbar */}
          <Box sx={{ px: 3, pb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search plants by name or location..."
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
                  <TableCell sx={{ pl: 3 }}>Plant Name</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right" sx={{ pr: 3 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPlants.length > 0 ? (
                  filteredPlants.map((plant) => (
                    <TableRow key={plant.id} hover>
                      <TableCell sx={{ pl: 3 }}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: 'primary.light', width: 34, height: 34 }}>
                            <BusinessIcon sx={{ fontSize: 18 }} />
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {plant.plantName}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{plant.location}</TableCell>
                      <TableCell align="center">
                        <Box
                          sx={{
                            display: 'inline-flex',
                            bgcolor: plant.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: plant.status === 'ACTIVE' ? 'secondary.light' : 'error.light',
                            borderRadius: '6px',
                            px: 1.5,
                            py: 0.5,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {plant.status}
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 3 }}>
                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
                          <Tooltip title="Toggle Status">
                            <IconButton onClick={() => toggleStatusMutation.mutate(plant)} size="small">
                              {plant.status === 'ACTIVE' ? (
                                <ToggleOnIcon sx={{ color: 'secondary.main', fontSize: 26 }} />
                              ) : (
                                <ToggleOffIcon sx={{ color: 'text.disabled', fontSize: 26 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Details">
                            <IconButton onClick={() => handleOpenDialog(plant)} size="small" color="primary">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                      {isLoading ? (
                        <CircularProgress color="primary" />
                      ) : (
                        <Typography color="text.secondary">No plants registered.</Typography>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingPlant ? 'Edit Plant Details' : 'Register New Plant'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                label="Plant Name"
                required
                fullWidth
                value={formData.plantName}
                onChange={(e) => setFormData({ ...formData, plantName: e.target.value })}
              />
              <TextField
                label="Location"
                required
                fullWidth
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
