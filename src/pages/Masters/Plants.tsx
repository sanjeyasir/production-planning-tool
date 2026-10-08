import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getPlants,
  createPlant,
  updatePlant,
  deletePlant,
  logActivity,
  type Plant
} from '../../services/db';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
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
  Chip,
  InputAdornment
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import TableViewIcon from '@mui/icons-material/TableView';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CloudDoneIcon from '@mui/icons-material/CloudDone';

// Handsontable
import { HotTable } from '@handsontable/react';
import * as XLSX from 'xlsx';

export const Plants: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, profile } = useAuthStore();
  const tenantId = tenant?.id || '';
  const userId = profile?.id || '';
  const userName = profile?.name || '';

  // Notifications
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Local filtering
  const filteredPlants = useMemo(() => {
    return plants.filter((p) => {
      const name = p.plantName.toLowerCase();
      const loc = p.location.toLowerCase();
      const match = search.toLowerCase();
      const matchesSearch = name.includes(match) || loc.includes(match);
      const matchesStatus = statusFilter === 'ALL' || (p.status || 'ACTIVE') === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [plants, search, statusFilter]);

  // Handsontable Data
  const hotData = useMemo(() => {
    return filteredPlants.map((p, index) => ({
      rowNum: index + 1,
      id: p.id,
      name: p.plantName,
      location: p.location,
      status: p.status || 'ACTIVE',
      action: 'DELETE',
    }));
  }, [filteredPlants]);

  // Handsontable In-Place Cell Edit & Auto-Save Handler
  const handleAfterChange = async (changes: any[] | null, source: string) => {
    if (source === 'loadData' || !changes || changes.length === 0) return;

    for (const [row, prop, oldValue, newValue] of changes) {
      if (oldValue === newValue) continue;
      const rowData = hotData[row];
      if (!rowData || !rowData.id) continue;

      try {
        const updatePayload: any = {};
        if (prop === 'name') updatePayload.plantName = String(newValue || '').trim();
        if (prop === 'location') updatePayload.location = String(newValue || '').trim();
        if (prop === 'status') {
          const valUpper = String(newValue || '').trim().toUpperCase();
          updatePayload.status = valUpper === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
        }

        if (Object.keys(updatePayload).length > 0) {
          await updatePlant(rowData.id, updatePayload);
          queryClient.invalidateQueries({ queryKey: ['plants', tenantId] });
          setNotification({ open: true, message: `Plant "${rowData.name}" updated & autosaved!`, severity: 'success' });
        }
      } catch (err: any) {
        setNotification({ open: true, message: `Failed to autosave plant: ${err.message}`, severity: 'error' });
      }
    }
  };

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
          plantName: formData.plantName.trim(),
          location: formData.location.trim(),
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
          plantName: formData.plantName.trim(),
          location: formData.location.trim(),
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

  // Delete Confirmation Modal Popup State
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    plant: Plant | null;
  }>({
    open: false,
    plant: null
  });

  const deletePlantMutation = useMutation({
    mutationFn: async (plant: Plant) => {
      await deletePlant(plant.id);
      await logActivity(
        tenantId,
        userId,
        userName,
        'DELETE_PLANT',
        `Deleted plant ${plant.plantName}`,
        plant,
        null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants', tenantId] });
      setNotification({ open: true, message: 'Plant deleted successfully.', severity: 'success' });
      setDeleteModal({ open: false, plant: null });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Error deleting plant: ${err.message}`, severity: 'error' });
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

  const handleExportExcel = () => {
    const data = filteredPlants.map((p) => ({
      'Plant Name': p.plantName,
      'Location / Address': p.location,
      'Status': p.status
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Plants Master');
    XLSX.writeFile(wb, 'Plants_Master.xlsx');
    setNotification({ open: true, message: 'Plants master exported to Excel!', severity: 'success' });
  };

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon sx={{ color: '#10b981' }} />
            Plants Administration & Locations Master
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportExcel}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            Export Excel
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            Add New Plant
          </Button>
        </Stack>
      </Box>

      {/* Main Card with Handsontable and Controls */}
      <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ pb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TableViewIcon sx={{ color: '#0284c7' }} />
                  Plants Master Directory
                </Typography>
                <Chip
                  icon={<CloudDoneIcon sx={{ fontSize: '15px !important', color: '#16a34a' }} />}
                  label="In-place edit • Auto-saves instantly"
                  size="small"
                  sx={{ bgcolor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 600, fontSize: '0.75rem' }}
                />
              </Stack>
            </Box>

            <Stack direction="row" spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' }, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Filter Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Filter Status"
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  sx={{ borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  <MenuItem value="ALL">All Statuses</MenuItem>
                  <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                  <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                </Select>
              </FormControl>

              <TextField
                placeholder="Search plants by name or location..."
                size="small"
                sx={{ width: { xs: '100%', sm: 260 } }}
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
            </Stack>
          </Box>

          {/* Handsontable Grid Container */}
          <Box
            sx={{
              width: '100%',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              '& .handsontable': {
                fontFamily: 'inherit',
                fontSize: '0.85rem'
              },
              '& .htCore th': {
                bgcolor: '#f8fafc',
                color: '#0f172a',
                fontWeight: 700,
                py: 1.2
              },
              '& .htCore td': {
                py: 1,
                color: '#334155'
              }
            }}
          >
            {isLoading ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : hotData.length > 0 ? (
              <HotTable
                data={hotData}
                colHeaders={['#', 'Plant Name', 'Location / Facility Address', 'Status', 'Action']}
                columns={[
                  { data: 'rowNum', readOnly: true, width: 50, className: 'htCenter htMiddle' },
                  { data: 'name', type: 'text', width: 280, className: 'htMiddle' },
                  { data: 'location', type: 'text', width: 320, className: 'htMiddle' },
                  {
                    data: 'status',
                    type: 'dropdown',
                    source: ['ACTIVE', 'INACTIVE'],
                    width: 140,
                    className: 'htCenter htMiddle'
                  },
                  {
                    data: 'action',
                    readOnly: true,
                    width: 100,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement) => {
                      td.innerHTML = '<button type="button" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 6px; padding: 4px 12px; font-weight: 700; font-size: 11px; cursor: pointer;">Delete</button>';
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  }
                ]}
                afterChange={handleAfterChange}
                afterOnCellMouseDown={(event: any, coords: any) => {
                  if (coords.col === 4 && coords.row >= 0) {
                    event.stopImmediatePropagation();
                    const rowData = hotData[coords.row];
                    const plantObj = plants.find((p) => p.id === rowData?.id);
                    if (plantObj) {
                      setDeleteModal({ open: true, plant: plantObj });
                    }
                  }
                }}
                rowHeaders={true}
                height="auto"
                width="100%"
                colWidths={[50, 280, 320, 140, 100]}
                stretchH="all"
                autoWrapRow={true}
                autoWrapCol={true}
                columnSorting={true}
                filters={true}
                dropdownMenu={true}
                contextMenu={['copy']}
                licenseKey="non-commercial-and-evaluation"
              />
            ) : (
              <Box sx={{ py: 6, textAlign: 'center', color: '#64748b' }}>
                No plants registered. Click "Add New Plant" to register a factory facility.
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* CONFIRM DELETE MODAL POPUP (NOT BROWSER ALERT) */}
      <Dialog
        open={deleteModal.open}
        onClose={() => !deletePlantMutation.isPending && setDeleteModal({ open: false, plant: null })}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DeleteForeverIcon sx={{ color: '#dc2626' }} />
          </Box>
          Confirm Plant Deletion
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6 }}>
            Are you sure you want to delete plant <strong>"{deleteModal.plant?.plantName}"</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1 }}>
            This action cannot be undone and will permanently remove this factory plant facility.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={() => setDeleteModal({ open: false, plant: null })}
            variant="outlined"
            disabled={deletePlantMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => deleteModal.plant && deletePlantMutation.mutate(deleteModal.plant)}
            variant="contained"
            color="error"
            disabled={deletePlantMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, px: 2.5 }}
          >
            {deletePlantMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Yes, Delete Plant'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default Plants;
