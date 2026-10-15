import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  getMachines,
  toLocalDateString,
  type Section,
  type Machine
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
  IconButton,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  Grid
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LayersIcon from '@mui/icons-material/Layers';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';

import * as XLSX from 'xlsx';

export const Sections: React.FC = () => {
  const queryClient = useQueryClient();
  const toyoTenantId = 'toyo';

  // Notifications
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Dialog State: Add / Edit Section
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState({
    sectionCode: '',
    sectionName: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });

  // Delete Confirmation State
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; section: Section | null }>({
    open: false,
    section: null
  });

  // Queries: Sections for Toyo
  const { data: sections = [], isLoading: loadingSections } = useQuery({
    queryKey: ['sections', toyoTenantId],
    queryFn: () => getSections(toyoTenantId),
  });

  // Queries: Toyo Machines to compute machine assignments
  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['machines', toyoTenantId],
    queryFn: () => getMachines(toyoTenantId),
  });

  // Map each section to assigned machine list
  const sectionMachineMap = useMemo(() => {
    const map = new Map<string, Machine[]>();
    machines.forEach(m => {
      if (m.sectionId) {
        const list = map.get(m.sectionId) || [];
        list.push(m);
        map.set(m.sectionId, list);
      }
    });
    return map;
  }, [machines]);

  // Filtered Sections
  const filteredSections = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sections.filter(sec => {
      const matchSearch = !term ||
        sec.sectionName.toLowerCase().includes(term) ||
        (sec.sectionCode || '').toLowerCase().includes(term) ||
        (sec.description || '').toLowerCase().includes(term);

      const matchStatus = statusFilter === 'ALL' || sec.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [sections, search, statusFilter]);

  // Save / Update Mutation
  const saveSectionMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      if (editingSection) {
        await updateSection(editingSection.id, {
          sectionCode: payload.sectionCode.trim().toUpperCase(),
          sectionName: payload.sectionName.trim(),
          description: payload.description.trim(),
          status: payload.status
        });
      } else {
        await createSection({
          tenantId: toyoTenantId,
          sectionCode: payload.sectionCode.trim().toUpperCase(),
          sectionName: payload.sectionName.trim(),
          description: payload.description.trim(),
          status: payload.status
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', toyoTenantId] });
      queryClient.invalidateQueries({ queryKey: ['machines', toyoTenantId] });
      setDialogOpen(false);
      setNotification({
        open: true,
        message: editingSection ? 'Section updated successfully!' : 'New section created successfully!',
        severity: 'success'
      });
    },
    onError: (err: any) => {
      setNotification({
        open: true,
        message: `Failed to save section: ${err.message}`,
        severity: 'error'
      });
    }
  });

  // Delete Mutation
  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      await deleteSection(sectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', toyoTenantId] });
      queryClient.invalidateQueries({ queryKey: ['machines', toyoTenantId] });
      setDeleteModal({ open: false, section: null });
      setNotification({
        open: true,
        message: 'Section removed successfully!',
        severity: 'info'
      });
    },
    onError: (err: any) => {
      setNotification({
        open: true,
        message: `Failed to delete section: ${err.message}`,
        severity: 'error'
      });
    }
  });

  const handleOpenDialog = (section?: Section) => {
    if (section) {
      setEditingSection(section);
      setFormData({
        sectionCode: section.sectionCode || '',
        sectionName: section.sectionName || '',
        description: section.description || '',
        status: section.status || 'ACTIVE'
      });
    } else {
      setEditingSection(null);
      setFormData({
        sectionCode: '',
        sectionName: '',
        description: '',
        status: 'ACTIVE'
      });
    }
    setDialogOpen(true);
  };

  const handleExportExcel = () => {
    if (sections.length === 0) return;
    const exportRows = sections.map((sec, idx) => {
      const assigned = sectionMachineMap.get(sec.id) || [];
      return {
        '#': idx + 1,
        'Section Code': sec.sectionCode || '',
        'Section Name': sec.sectionName,
        'Description': sec.description || '',
        'Assigned Machines Count': assigned.length,
        'Assigned Machine Codes': assigned.map(m => m.machineCode).join(', '),
        'Status': sec.status
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Toyo_Sections');
    XLSX.writeFile(wb, `Toyo_Section_Master_${toLocalDateString(new Date())}.xlsx`);
    setNotification({ open: true, message: 'Sections exported to Excel!', severity: 'success' });
  };


  const totalAssignedMachines = useMemo(() => {
    let count = 0;
    sectionMachineMap.forEach(list => {
      count += list.length;
    });
    return count;
  }, [sectionMachineMap]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1600, margin: '0 auto' }}>

      {/* Top Header Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: '16px',
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                bgcolor: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
              }}
            >
              <LayersIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', fontFamily: '"Outfit", sans-serif' }}>
                Toyo Section Master
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                Manufacturing sections, production departments, and machine allocations for Toyo.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            label="Toyo Manufacturing"
            size="medium"
            sx={{
              bgcolor: 'rgba(2, 132, 199, 0.1)',
              color: '#0284c7',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              fontWeight: 800,
              fontSize: '0.8rem'
            }}
          />

          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportExcel}
            sx={{
              borderRadius: '10px',
              fontWeight: 700,
              textTransform: 'none',
              color: '#334155',
              borderColor: '#cbd5e1'
            }}
          >
            Export Excel
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              bgcolor: '#0284c7',
              '&:hover': { bgcolor: '#0369a1' },
              fontWeight: 700,
              borderRadius: '10px',
              textTransform: 'none',
              px: 2.5
            }}
          >
            Add Section
          </Button>
        </Stack>
      </Paper>

      {/* KPI Ribbon */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Sections
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                {sections.length} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Departments</span>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Active Sections
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#16a34a', mt: 0.5 }}>
                {sections.filter(s => s.status === 'ACTIVE').length}{' '}
                <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 500 }}>Operational</span>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Assigned Machines
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0284c7', mt: 0.5 }}>
                {totalAssignedMachines}{' '}
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>of {machines.length} Machines</span>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table Card */}
      <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          {/* Filter Toolbar */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 2,
              mb: 2.5
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search sections by name, code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                      </InputAdornment>
                    )
                  }
                }}
                sx={{ bgcolor: '#ffffff', minWidth: 260 }}
              />

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <MenuItem value="ALL">All Status</MenuItem>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Stack>

          </Box>

          {/* Table Container */}
          <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow sx={{ '& th': { fontWeight: 800, color: '#0f172a', py: 1.5, fontSize: '0.8rem' } }}>
                  <TableCell sx={{ width: 60, textAlign: 'center' }}>#</TableCell>
                  <TableCell sx={{ width: 140 }}>Section Code</TableCell>
                  <TableCell sx={{ width: 240 }}>Section Name</TableCell>
                  <TableCell>Description / Department Scope</TableCell>
                  <TableCell sx={{ width: 180 }}>Assigned Machines</TableCell>
                  <TableCell sx={{ width: 120 }}>Status</TableCell>
                  <TableCell align="center" sx={{ width: 130 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingSections || loadingMachines ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={30} sx={{ color: '#0284c7', mb: 1 }} />
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Loading Toyo Section Master...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredSections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#64748b' }}>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#334155' }}>
                        No sections found.
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
                        Click "Add Section" or "Seed Default Toyo Sections" to configure manufacturing departments.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSections.map((sec, idx) => {
                    const assigned = sectionMachineMap.get(sec.id) || [];
                    const isActive = sec.status === 'ACTIVE';

                    return (
                      <TableRow
                        key={sec.id}
                        hover
                        sx={{ '&:last-child td': { borderBottom: 0 } }}
                      >
                        <TableCell align="center" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>
                          {idx + 1}
                        </TableCell>

                        {/* Code */}
                        <TableCell>
                          {sec.sectionCode ? (
                            <Chip
                              size="small"
                              label={sec.sectionCode}
                              sx={{
                                bgcolor: '#e0f2fe',
                                color: '#0369a1',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                borderRadius: '6px'
                              }}
                            />
                          ) : (
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                              -
                            </Typography>
                          )}
                        </TableCell>

                        {/* Name */}
                        <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                          {sec.sectionName}
                        </TableCell>

                        {/* Description */}
                        <TableCell sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                          {sec.description || '—'}
                        </TableCell>

                        {/* Assigned Machines */}
                        <TableCell>
                          {assigned.length > 0 ? (
                            <Tooltip
                              title={
                                <Box sx={{ p: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                                    Assigned Machines ({assigned.length}):
                                  </Typography>
                                  {assigned.map(m => (
                                    <Typography key={m.id} variant="caption" sx={{ display: 'block' }}>
                                      • {m.machineCode} - {m.machineName}
                                    </Typography>
                                  ))}
                                </Box>
                              }
                            >
                              <Chip
                                size="small"
                                icon={<PrecisionManufacturingIcon sx={{ fontSize: '14px !important' }} />}
                                label={`${assigned.length} machine(s)`}
                                sx={{
                                  bgcolor: '#f0fdf4',
                                  color: '#166534',
                                  border: '1px solid #bbf7d0',
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  cursor: 'pointer'
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                              0 machines
                            </Typography>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Chip
                            size="small"
                            label={isActive ? 'ACTIVE' : 'INACTIVE'}
                            sx={{
                              bgcolor: isActive ? 'rgba(22, 163, 74, 0.1)' : '#f1f5f9',
                              color: isActive ? '#15803d' : '#64748b',
                              fontWeight: 800,
                              fontSize: '0.68rem',
                              border: isActive ? '1px solid rgba(22, 163, 74, 0.25)' : '1px solid #e2e8f0'
                            }}
                          />
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center' }}>
                            <Tooltip title="Edit Section">
                              <IconButton size="small" onClick={() => handleOpenDialog(sec)}>
                                <EditIcon sx={{ fontSize: 17, color: '#0284c7' }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={assigned.length > 0 ? "Cannot delete section with assigned machines" : "Delete Section"}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={assigned.length > 0}
                                  onClick={() => setDeleteModal({ open: true, section: sec })}
                                >
                                  <DeleteForeverIcon sx={{ fontSize: 18, color: assigned.length > 0 ? '#cbd5e1' : '#ef4444' }} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* DIALOG: ADD / EDIT SECTION */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px' } } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingSection ? 'Edit Toyo Section' : 'Create Toyo Section'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Box sx={{ p: 1.5, bgcolor: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
            <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700, display: 'block' }}>
              ℹ️ Toyo Section Definition:
            </Typography>
            <Typography variant="caption" sx={{ color: '#0284c7', display: 'block', mt: 0.3 }}>
              Sections represent departments or production cells in Toyo. Machines registered in Toyo Machine Master link directly to these sections.
            </Typography>
          </Box>

          <TextField
            label="Section Code"
            required
            fullWidth
            placeholder="e.g. SEC-EXT"
            value={formData.sectionCode}
            onChange={(e) => setFormData({ ...formData, sectionCode: e.target.value.toUpperCase() })}
            helperText="Short code identifier (e.g. SEC-EXT, SEC-MOLD)"
          />

          <TextField
            label="Section Name"
            required
            fullWidth
            placeholder="e.g. Extrusion Section"
            value={formData.sectionName}
            onChange={(e) => setFormData({ ...formData, sectionName: e.target.value })}
          />

          <TextField
            label="Description / Department Scope"
            multiline
            rows={3}
            fullWidth
            placeholder="Describe operations, equipment types or location in the plant..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={formData.status}
              label="Status"
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            >
              <MenuItem value="ACTIVE">ACTIVE</MenuItem>
              <MenuItem value="INACTIVE">INACTIVE</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!formData.sectionName.trim() || saveSectionMutation.isPending}
            onClick={() => saveSectionMutation.mutate(formData)}
            sx={{
              bgcolor: '#0284c7',
              '&:hover': { bgcolor: '#0369a1' },
              fontWeight: 700,
              textTransform: 'none'
            }}
          >
            {saveSectionMutation.isPending ? 'Saving...' : editingSection ? 'Update Section' : 'Save Section'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: DELETE CONFIRMATION */}
      <Dialog
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, section: null })}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px' } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#dc2626' }}>
          Delete Section?
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Are you sure you want to permanently delete section{' '}
            <strong>{deleteModal.section?.sectionName}</strong> ({deleteModal.section?.sectionCode})?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setDeleteModal({ open: false, section: null })} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteSectionMutation.isPending}
            onClick={() => {
              if (deleteModal.section) {
                deleteSectionMutation.mutate(deleteModal.section.id);
              }
            }}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            {deleteSectionMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert severity={notification.severity} onClose={() => setNotification({ ...notification, open: false })}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Sections;
