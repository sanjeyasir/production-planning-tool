import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getMachines,
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
  InputAdornment,
  Paper
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
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
  const { profile } = useAuthStore();
  const tenantId = 'rileys';
  const userId = profile?.id || '';
  const userName = profile?.name || '';

  // Notifications
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Queries: Only Riley's machines (no plants, no categories needed)
  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['machines', tenantId],
    queryFn: () => getMachines(tenantId),
    enabled: !!tenantId,
  });

  // States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [formData, setFormData] = useState({
    machineCode: '',
    machineName: '',
    dailyCapacity: 2400,
    operatingHours: 24, // strictly 12 or 24
    status: 'ACTIVE'
  });
  const [search, setSearch] = useState('');

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; machine: Machine | null }>({
    open: false,
    machine: null,
  });

  // Local filtering: machineCode or machineName
  const filteredMachines = useMemo(() => {
    const match = search.trim().toLowerCase();
    if (!match) return machines;
    return machines.filter((m) => {
      const code = (m.machineCode || '').toLowerCase();
      const name = (m.machineName || '').toLowerCase();
      return code.includes(match) || name.includes(match);
    });
  }, [machines, search]);

  // Handsontable Data Format
  const hotData = useMemo(() => {
    return filteredMachines.map((m, index) => {
      const opHours = m.operatingHours === 12 ? 12 : 24;
      const dailyCap = m.dailyCapacity ?? ((m.capacity || 0) * opHours);

      return {
        rowNum: index + 1,
        id: m.id,
        code: m.machineCode,
        name: m.machineName,
        schedule: opHours === 12 ? '12 Hours/Day' : '24 Hours/Day',
        dailyCapacity: dailyCap,
        status: m.status || 'ACTIVE',
        action: 'DELETE'
      };
    });
  }, [filteredMachines]);

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
        dailyCapacity: machine.dailyCapacity || ((machine.capacity || 100) * (machine.operatingHours === 12 ? 12 : 24)),
        operatingHours: machine.operatingHours === 12 ? 12 : 24,
        status: machine.status
      });
    } else {
      setEditingMachine(null);
      setFormData({
        machineCode: '',
        machineName: '',
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
        plantId: 'rileys-main',
        categoryId: 'general',
        machineCode: data.machineCode.trim().toUpperCase(),
        machineName: data.machineName.trim(),
        dailyCapacity: Number(data.dailyCapacity),
        operatingHours: Number(data.operatingHours) === 12 ? 12 : 24,
        status: data.status as any,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'CREATE_MACHINE',
        `Created machine ${data.machineCode} (${data.operatingHours}h/day, Daily Cap: ${data.dailyCapacity} units)`,
        'machines',
        newId
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', tenantId] });
      setDialogOpen(false);
      setNotification({ open: true, message: 'Machine added successfully!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to create machine: ${err.message}`, severity: 'error' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      await updateMachine(id, {
        machineCode: data.machineCode.trim().toUpperCase(),
        machineName: data.machineName.trim(),
        dailyCapacity: Number(data.dailyCapacity),
        operatingHours: Number(data.operatingHours) === 12 ? 12 : 24,
        status: data.status as any,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'UPDATE_MACHINE',
        `Updated machine ${data.machineCode}`,
        'machines',
        id
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

  const deleteMutation = useMutation({
    mutationFn: async (machine: Machine) => {
      await deleteMachine(machine.id);
      await logActivity(
        tenantId,
        userId,
        userName,
        'DELETE_MACHINE',
        `Deleted machine ${machine.machineCode}`,
        'machines',
        machine.id
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', tenantId] });
      setDeleteModal({ open: false, machine: null });
      setNotification({ open: true, message: 'Machine deleted successfully', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to delete machine: ${err.message}`, severity: 'error' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.machineCode.trim() || !formData.machineName.trim()) {
      setNotification({ open: true, message: 'Machine Code and Name are required.', severity: 'warning' });
      return;
    }

    if (editingMachine) {
      updateMutation.mutate({ id: editingMachine.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleExportExcel = () => {
    if (filteredMachines.length === 0) {
      setNotification({ open: true, message: 'No data to export', severity: 'warning' });
      return;
    }

    const data = filteredMachines.map((m, index) => {
      const opHours = m.operatingHours === 12 ? 12 : 24;
      const dailyCap = m.dailyCapacity ?? ((m.capacity || 0) * opHours);
      return {
        '#': index + 1,
        'Machine Code': m.machineCode,
        'Machine Name': m.machineName,
        'Operating Hours': `${opHours} Hours/Day`,
        'Daily Capacity (Units/Day)': dailyCap,
        'Status': m.status || 'ACTIVE'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Rileys_Machines');
    XLSX.writeFile(wb, 'Rileys_Machine_Master.xlsx');
    setNotification({ open: true, message: "Riley's machine master exported to Excel!", severity: 'success' });
  };

  return (
    <Box sx={{ py: 1 }}>
      {/* Dedicated View Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #f8fafc 0%, #fef2f2 50%, #f0fdf4 100%)',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 0.8 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
                fontWeight: 900,
                fontSize: '1.2rem',
                fontFamily: '"Outfit", sans-serif'
              }}
            >
              R
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', fontFamily: '"Outfit", sans-serif' }}>
                Riley's Machine Master
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                Machine specs, standard operating schedule (12h / 24h), and daily capacity targets.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            label="Riley's Operations"
            size="medium"
            sx={{
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.3)',
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
              bgcolor: '#dc2626',
              '&:hover': { bgcolor: '#b91c1c' },
              fontWeight: 700,
              borderRadius: '10px',
              textTransform: 'none',
              px: 2.5
            }}
          >
            Add Machine
          </Button>
        </Stack>
      </Paper>

      {/* Main Card with Handsontable Directory */}
      <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ pb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <TableViewIcon sx={{ color: '#dc2626' }} />
                Riley's Machinery Directory
              </Typography>
              <Chip
                icon={<CloudDoneIcon sx={{ fontSize: '15px !important', color: '#16a34a' }} />}
                label="In-place edit • Auto-saves instantly"
                size="small"
                sx={{ bgcolor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 600, fontSize: '0.75rem' }}
              />
            </Stack>

            <TextField
              placeholder="Search machine code or name..."
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

          {/* Handsontable Grid */}
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
                  'Operating Schedule (12h / 24h)',
                  'Daily Capacity (Units/Day)',
                  'Status',
                  'Action'
                ]}
                columns={[
                  { data: 'rowNum', readOnly: true, width: 50, className: 'htCenter htMiddle' },
                  { data: 'code', type: 'text', width: 160, className: 'htCenter htMiddle font-semibold' },
                  { data: 'name', type: 'text', width: 300, className: 'htMiddle' },
                  {
                    data: 'schedule',
                    type: 'dropdown',
                    source: ['12 Hours/Day', '24 Hours/Day'],
                    width: 200,
                    className: 'htCenter htMiddle'
                  },
                  {
                    data: 'dailyCapacity',
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 200,
                    className: 'htCenter htMiddle'
                  },
                  {
                    data: 'status',
                    type: 'dropdown',
                    source: ['ACTIVE', 'INACTIVE'],
                    width: 120,
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
                  if (coords.col === 6 && coords.row >= 0) {
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
                colWidths={[50, 160, 300, 200, 200, 120, 100]}
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
                No Riley's machines found. Click "Add Machine" above to register a new line.
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* CONFIRM DELETE MODAL */}
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

      {/* Machine Create / Edit Dialog (Simplified: Machine Code, Machine Name, 12h/24h schedule, Daily Capacity, Status) */}
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
          {editingMachine ? "Edit Riley's Machine" : "Register Riley's Machine"}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.2}>
              <TextField
                label="Machine Code"
                placeholder="e.g. MC-01, EXT-02"
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

              {/* Just 24 hrs and 12 hrs */}
              <FormControl fullWidth size="small" required>
                <InputLabel>Operating Hours (12h / 24h)</InputLabel>
                <Select
                  label="Operating Hours (12h / 24h)"
                  value={formData.operatingHours}
                  onChange={(e) => setFormData({ ...formData, operatingHours: Number(e.target.value) })}
                >
                  <MenuItem value={12}>12 Hours / Day</MenuItem>
                  <MenuItem value={24}>24 Hours / Day</MenuItem>
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
              disabled={createMutation.isPending || updateMutation.isPending}
              sx={{
                bgcolor: '#dc2626',
                '&:hover': { bgcolor: '#b91c1c' },
                borderRadius: '8px',
                fontWeight: 700
              }}
            >
              {editingMachine ? 'Save Changes' : 'Register Machine'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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

export default Machines;
