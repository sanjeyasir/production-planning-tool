import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getMachines,
  getPlants,
  getProductionCategories,
  createMachine,
  updateMachine,
  deleteMachine,
  logActivity,
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
  InputAdornment
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import FactoryIcon from '@mui/icons-material/Factory';
import SearchIcon from '@mui/icons-material/Search';
import TableViewIcon from '@mui/icons-material/TableView';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CloudDoneIcon from '@mui/icons-material/CloudDone';

// Handsontable
import { HotTable } from '@handsontable/react';
import * as XLSX from 'xlsx';

export const Machines: React.FC = () => {
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

  const { data: categories = [] } = useQuery({
    queryKey: ['productionCategories', tenantId],
    queryFn: () => getProductionCategories(tenantId),
    enabled: !!tenantId,
  });

  // Category Maps
  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const plantMap = useMemo(() => {
    const map: Record<string, string> = {};
    plants.forEach(p => { map[p.id] = p.plantName; });
    return map;
  }, [plants]);

  // States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [formData, setFormData] = useState({
    machineCode: '',
    machineName: '',
    plantId: '',
    categoryId: '',
    dailyCapacity: 2400,
    operatingHours: 24, // 12 or 24
    status: 'ACTIVE'
  });
  const [search, setSearch] = useState('');

  // Local filtering
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const code = (m.machineCode || '').toLowerCase();
      const name = (m.machineName || '').toLowerCase();
      const plant = (plantMap[m.plantId] || '').toLowerCase();
      const cat = (categoryMap[m.categoryId || ''] || '').toLowerCase();
      const match = search.toLowerCase();
      return code.includes(match) || name.includes(match) || plant.includes(match) || cat.includes(match);
    });
  }, [machines, search, plantMap, categoryMap]);

  // Handsontable Data Format
  const hotData = useMemo(() => {
    return filteredMachines.map((m, index) => {
      const plantName = plantMap[m.plantId] || plants[0]?.plantName || 'Main Plant';
      const catName = categoryMap[m.categoryId || ''] || 'General / All';
      const opHours = m.operatingHours || 24;
      const dailyCap = m.dailyCapacity ?? ((m.capacity || 0) * opHours);

      return {
        rowNum: index + 1,
        id: m.id,
        code: m.machineCode,
        name: m.machineName,
        category: catName,
        plant: plantName,
        schedule: opHours === 12 ? '12 Hours/Day' : '24 Hours/Day',
        dailyCapacity: dailyCap,
        status: m.status || 'ACTIVE',
        action: 'DELETE'
      };
    });
  }, [filteredMachines, plantMap, categoryMap, plants]);

  // Handsontable In-Place Cell Edit & Auto-Save Handler
  const handleAfterChange = async (changes: any[] | null, source: string) => {
    if (source === 'loadData' || !changes || changes.length === 0) return;

    for (const [row, prop, oldValue, newValue] of changes) {
      if (oldValue === newValue) continue;
      const rowData = hotData[row];
      if (!rowData || !rowData.id) continue;

      try {
        const updatePayload: any = {};
        if (prop === 'code') updatePayload.machineCode = String(newValue || '').trim().toUpperCase();
        if (prop === 'name') updatePayload.machineName = String(newValue || '').trim();
        if (prop === 'category') {
          const foundCat = categories.find(c => c.name === newValue);
          updatePayload.categoryId = foundCat ? foundCat.id : '';
        }
        if (prop === 'plant') {
          const foundPlant = plants.find(p => p.plantName === newValue);
          if (foundPlant) updatePayload.plantId = foundPlant.id;
        }
        if (prop === 'schedule') {
          updatePayload.operatingHours = String(newValue).includes('12') ? 12 : 24;
        }
        if (prop === 'dailyCapacity') {
          updatePayload.dailyCapacity = Math.max(0, Number(newValue) || 0);
        }
        if (prop === 'status') {
          updatePayload.status = newValue === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
        }

        if (Object.keys(updatePayload).length > 0) {
          await updateMachine(rowData.id, updatePayload);
          queryClient.invalidateQueries({ queryKey: ['machines', tenantId] });
          setNotification({ open: true, message: `Machine ${rowData.code} updated & autosaved!`, severity: 'success' });
        }
      } catch (err: any) {
        setNotification({ open: true, message: `Failed to autosave machine: ${err.message}`, severity: 'error' });
      }
    }
  };

  const handleOpenDialog = (machine?: Machine) => {
    if (machine) {
      setEditingMachine(machine);
      setFormData({
        machineCode: machine.machineCode,
        machineName: machine.machineName,
        plantId: machine.plantId,
        categoryId: machine.categoryId || '',
        dailyCapacity: machine.dailyCapacity || ((machine.capacity || 100) * (machine.operatingHours || 24)),
        operatingHours: machine.operatingHours || 24,
        status: machine.status
      });
    } else {
      setEditingMachine(null);
      setFormData({
        machineCode: '',
        machineName: '',
        plantId: plants[0]?.id || '',
        categoryId: categories[0]?.id || '',
        dailyCapacity: 2400,
        operatingHours: 24,
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
        categoryId: data.categoryId || '',
        machineCode: data.machineCode.trim().toUpperCase(),
        machineName: data.machineName.trim(),
        dailyCapacity: Number(data.dailyCapacity),
        operatingHours: Number(data.operatingHours) || 24,
        status: data.status as any,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'CREATE_MACHINE',
        `Created machine ${data.machineCode} (Category: ${categoryMap[data.categoryId] || 'General'}, ${data.operatingHours}h/day, Daily Cap: ${data.dailyCapacity} units)`,
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
        categoryId: data.categoryId || '',
        machineCode: data.machineCode.trim().toUpperCase(),
        machineName: data.machineName.trim(),
        dailyCapacity: Number(data.dailyCapacity),
        operatingHours: Number(data.operatingHours) || 24,
        status: data.status as any,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'UPDATE_MACHINE',
        `Updated machine ${editingMachine.machineCode} (Category: ${categoryMap[data.categoryId] || 'General'}, Daily Cap: ${data.dailyCapacity} units)`,
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

  // Delete Confirmation Modal Popup State
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    machine: Machine | null;
  }>({
    open: false,
    machine: null
  });

  const deleteMutation = useMutation({
    mutationFn: async (machine: Machine) => {
      await deleteMachine(machine.id);
      await logActivity(
        tenantId,
        userId,
        userName,
        'DELETE_MACHINE',
        `Deleted machine ${machine.machineCode} (${machine.machineName})`,
        machine,
        null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', tenantId] });
      setNotification({ open: true, message: 'Machine deleted successfully.', severity: 'success' });
      setDeleteModal({ open: false, machine: null });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to delete machine: ${err.message}`, severity: 'error' });
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

  const handleExportExcel = () => {
    const data = filteredMachines.map((m) => {
      const plantName = plantMap[m.plantId] || 'Unknown Plant';
      const catName = categoryMap[m.categoryId || ''] || 'General / All';
      const opHours = m.operatingHours || 24;
      const dailyCap = m.dailyCapacity ?? ((m.capacity || 0) * opHours);
      return {
        'Machine Code': m.machineCode,
        'Machine Name': m.machineName,
        'Production Category': catName,
        'Plant Location': plantName,
        'Operating Schedule': `${opHours} Hours/Day`,
        'Daily Output Capacity': dailyCap,
        'Status': m.status
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Machines Master');
    XLSX.writeFile(wb, 'Machines_Master.xlsx');
    setNotification({ open: true, message: 'Machines master exported to Excel!', severity: 'success' });
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
            Manage factory machine lines, assign production categories, plant locations, and daily operating capacities.
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
            Add Machine
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
                  <TableViewIcon sx={{ color: '#10b981' }} />
                  Machines Master Directory
                </Typography>
                <Chip
                  icon={<CloudDoneIcon sx={{ fontSize: '15px !important', color: '#16a34a' }} />}
                  label="In-place edit • Auto-saves instantly"
                  size="small"
                  sx={{ bgcolor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 600, fontSize: '0.75rem' }}
                />
              </Stack>
            </Box>

            <TextField
              placeholder="Search code, machine, category, plant..."
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
            {loadingMachines ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : hotData.length > 0 ? (
              <HotTable
                data={hotData}
                colHeaders={[
                  '#',
                  'Machine Code',
                  'Machine Name',
                  'Production Category',
                  'Plant Location',
                  'Operating Schedule',
                  'Daily Capacity (Units/Day)',
                  'Status',
                  'Action'
                ]}
                columns={[
                  { data: 'rowNum', readOnly: true, width: 45, className: 'htCenter htMiddle' },
                  { data: 'code', type: 'text', width: 130, className: 'htCenter htMiddle font-semibold' },
                  { data: 'name', type: 'text', width: 200, className: 'htMiddle' },
                  {
                    data: 'category',
                    type: 'dropdown',
                    source: ['General / All', ...categories.map((c) => c.name)],
                    width: 170,
                    className: 'htMiddle'
                  },
                  {
                    data: 'plant',
                    type: 'dropdown',
                    source: plants.map((p) => p.plantName),
                    width: 160,
                    className: 'htMiddle'
                  },
                  {
                    data: 'schedule',
                    type: 'dropdown',
                    source: ['12 Hours/Day', '24 Hours/Day'],
                    width: 150,
                    className: 'htCenter htMiddle'
                  },
                  {
                    data: 'dailyCapacity',
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 160,
                    className: 'htCenter htMiddle'
                  },
                  {
                    data: 'status',
                    type: 'dropdown',
                    source: ['ACTIVE', 'INACTIVE'],
                    width: 100,
                    className: 'htCenter htMiddle'
                  },
                  {
                    data: 'action',
                    readOnly: true,
                    width: 90,
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
                  if (coords.col === 8 && coords.row >= 0) {
                    event.stopImmediatePropagation();
                    const rowData = hotData[coords.row];
                    const machineObj = machines.find((m) => m.id === rowData?.id);
                    if (machineObj) {
                      setDeleteModal({ open: true, machine: machineObj });
                    }
                  }
                }}
                rowHeaders={true}
                height="auto"
                width="100%"
                colWidths={[45, 130, 200, 170, 160, 150, 160, 100, 90]}
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
                No machines found matching search criteria. Click "Add Machine" above to register a new line.
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* CONFIRM DELETE MODAL POPUP */}
      <Dialog
        open={deleteModal.open}
        onClose={() => !deleteMutation.isPending && setDeleteModal({ open: false, machine: null })}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DeleteForeverIcon sx={{ color: '#dc2626' }} />
          </Box>
          Confirm Machine Deletion
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6 }}>
            Are you sure you want to delete machine <strong>"{deleteModal.machine?.machineCode} - {deleteModal.machine?.machineName}"</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1 }}>
            This action cannot be undone and will permanently remove this machine master record.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={() => setDeleteModal({ open: false, machine: null })}
            variant="outlined"
            disabled={deleteMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => deleteModal.machine && deleteMutation.mutate(deleteModal.machine)}
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, px: 2.5 }}
          >
            {deleteMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Yes, Delete Machine'}
          </Button>
        </DialogActions>
      </Dialog>

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

              <FormControl fullWidth size="small">
                <InputLabel>Production Category</InputLabel>
                <Select
                  label="Production Category"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                >
                  <MenuItem value=""><em>General / All Categories</em></MenuItem>
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" required>
                <InputLabel>Target Plant Location</InputLabel>
                <Select
                  label="Target Plant Location"
                  value={formData.plantId}
                  onChange={(e) => setFormData({ ...formData, plantId: e.target.value })}
                >
                  {plants.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.plantName}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" required>
                <InputLabel>Daily Operating Schedule</InputLabel>
                <Select
                  label="Daily Operating Schedule"
                  value={formData.operatingHours}
                  onChange={(e) => setFormData({ ...formData, operatingHours: Number(e.target.value) })}
                >
                  <MenuItem value={12}>12 Hours / Day (1-2 Shifts / Single Line)</MenuItem>
                  <MenuItem value={24}>24 Hours / Day (Continuous 3-Shift Operation)</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Daily Output Capacity (Units / Day)"
                type="number"
                size="small"
                required
                fullWidth
                value={formData.dailyCapacity}
                onChange={(e) => setFormData({ ...formData, dailyCapacity: Number(e.target.value) })}
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

export default Machines;
