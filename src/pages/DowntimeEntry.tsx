import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  getDowntimeRecords,
  getPlants,
  getMachines,
  getDowntimeCategories,
  createDowntimeRecord,
  updateDowntimeRecord,
  deleteDowntimeRecord,
  logActivity,
  type DowntimeRecord
} from '../services/db';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
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
  Alert,
  Tooltip,
  CircularProgress,
  Snackbar,
  InputAdornment,
  Chip
} from '@mui/material';

// Icons
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import HistoryIcon from '@mui/icons-material/History';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const DowntimeEntry: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, profile, hasPermission } = useAuthStore();
  const tenantId = tenant?.id || '';
  const userId = profile?.id || '';
  const userName = profile?.name || '';

  // SnackBar / Alert Notification states
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Query database
  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['downtimeRecords', tenantId],
    queryFn: () => getDowntimeRecords(tenantId),
    enabled: !!tenantId,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ['plants', tenantId],
    queryFn: () => getPlants(tenantId),
    enabled: !!tenantId,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ['machines', tenantId],
    queryFn: () => getMachines(tenantId),
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['downtimeCategories', tenantId],
    queryFn: () => getDowntimeCategories(tenantId),
    enabled: !!tenantId,
  });

  // New Record Form State
  const [formData, setFormData] = useState({
    plantId: '',
    machineId: '',
    categoryId: '',
    shift: 'Shift A',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '09:00',
    duration: 60,
    reason: '',
    remarks: '',
  });

  // Calculated duration helper
  useEffect(() => {
    if (formData.startTime && formData.endTime) {
      const [startH, startM] = formData.startTime.split(':').map(Number);
      const [endH, endM] = formData.endTime.split(':').map(Number);
      
      const startMinutes = startH * 60 + startM;
      let endMinutes = endH * 60 + endM;

      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }

      setFormData((prev) => ({ ...prev, duration: endMinutes - startMinutes }));
    }
  }, [formData.startTime, formData.endTime]);

  // Edit dialog state
  const [editRecord, setEditRecord] = useState<DowntimeRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    plantId: '',
    machineId: '',
    categoryId: '',
    shift: 'Shift A',
    date: '',
    startTime: '',
    endTime: '',
    duration: 0,
    reason: '',
    remarks: '',
  });

  useEffect(() => {
    if (editRecord) {
      const start = new Date(editRecord.startTime);
      const end = new Date(editRecord.endTime);
      
      const pad = (num: number) => num.toString().padStart(2, '0');
      const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      
      setEditFormData({
        plantId: editRecord.plantId,
        machineId: editRecord.machineId,
        categoryId: editRecord.categoryId,
        shift: editRecord.shift,
        date: start.toISOString().split('T')[0],
        startTime: timeStr(start),
        endTime: timeStr(end),
        duration: editRecord.duration,
        reason: editRecord.reason,
        remarks: editRecord.remarks || '',
      });
    }
  }, [editRecord]);

  // Handle edit time updates
  useEffect(() => {
    if (editFormData.startTime && editFormData.endTime) {
      const [startH, startM] = editFormData.startTime.split(':').map(Number);
      const [endH, endM] = editFormData.endTime.split(':').map(Number);
      
      const startMinutes = startH * 60 + startM;
      let endMinutes = endH * 60 + endM;

      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }

      setEditFormData((prev) => ({ ...prev, duration: endMinutes - startMinutes }));
    }
  }, [editFormData.startTime, editFormData.endTime]);

  // Search and Table Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [listPlant, setListPlant] = useState('all');

  const filteredLogs = useMemo(() => {
    return records
      .filter((r) => {
        if (listPlant !== 'all' && r.plantId !== listPlant) return false;
        
        const machObj = machines.find((m) => m.id === r.machineId);
        const code = machObj?.machineCode?.toLowerCase() || '';
        const name = machObj?.machineName?.toLowerCase() || '';
        const reason = r.reason.toLowerCase();
        
        const match = searchTerm.toLowerCase();
        return code.includes(match) || name.includes(match) || reason.includes(match);
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [records, searchTerm, listPlant, machines]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const start = new Date(`${data.date}T${data.startTime}`);
      let end = new Date(`${data.date}T${data.endTime}`);
      
      if (end < start) {
        end.setDate(end.getDate() + 1);
      }

      const recordId = await createDowntimeRecord({
        tenantId,
        plantId: data.plantId,
        machineId: data.machineId,
        categoryId: data.categoryId,
        shift: data.shift,
        startTime: start,
        endTime: end,
        duration: data.duration,
        reason: data.reason,
        remarks: data.remarks,
        createdBy: userId,
      });

      await logActivity(
        tenantId, 
        userId, 
        userName, 
        'CREATE_DOWNTIME', 
        `Added downtime event for machine ID ${data.machineId} lasting ${data.duration} mins`,
        null,
        data
      );
      return recordId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtimeRecords', tenantId] });
      setFormData({
        plantId: '',
        machineId: '',
        categoryId: '',
        shift: 'Shift A',
        date: new Date().toISOString().split('T')[0],
        startTime: '08:00',
        endTime: '09:00',
        duration: 60,
        reason: '',
        remarks: '',
      });
      setNotification({ open: true, message: 'Downtime logged successfully!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to log record: ${err.message}`, severity: 'error' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editFormData) => {
      if (!editRecord) return;
      const start = new Date(`${data.date}T${data.startTime}`);
      let end = new Date(`${data.date}T${data.endTime}`);

      if (end < start) {
        end.setDate(end.getDate() + 1);
      }

      await updateDowntimeRecord(editRecord.id, {
        plantId: data.plantId,
        machineId: data.machineId,
        categoryId: data.categoryId,
        shift: data.shift,
        startTime: start,
        endTime: end,
        duration: data.duration,
        reason: data.reason,
        remarks: data.remarks,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'UPDATE_DOWNTIME',
        `Updated downtime record ID ${editRecord.id}`,
        editRecord,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtimeRecords', tenantId] });
      setEditRecord(null);
      setNotification({ open: true, message: 'Downtime record updated!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to update record: ${err.message}`, severity: 'error' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (record: DowntimeRecord) => {
      await deleteDowntimeRecord(record.id);
      await logActivity(
        tenantId,
        userId,
        userName,
        'DELETE_DOWNTIME',
        `Deleted downtime event ID ${record.id}`,
        record,
        null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtimeRecords', tenantId] });
      setNotification({ open: true, message: 'Downtime event removed!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to remove record: ${err.message}`, severity: 'error' });
    }
  });

  const exportExcel = () => {
    const dataToExport = filteredLogs.map((r) => {
      const plantObj = plants.find((p) => p.id === r.plantId);
      const machObj = machines.find((m) => m.id === r.machineId);
      const catObj = categories.find((c) => c.id === r.categoryId);
      return {
        Plant: plantObj?.plantName || 'N/A',
        'Machine Code': machObj?.machineCode || 'N/A',
        'Machine Name': machObj?.machineName || 'N/A',
        Category: catObj?.name || 'N/A',
        Shift: r.shift,
        'Start Time': new Date(r.startTime).toLocaleString(),
        'End Time': new Date(r.endTime).toLocaleString(),
        'Duration (Minutes)': r.duration,
        'Downtime Reason': r.reason,
        'Remarks / Notes': r.remarks || 'None',
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Downtime Incidents');
    XLSX.writeFile(wb, `Downtime_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`MOIP - Machine Downtime Report (${tenant?.companyName})`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 22);

    const bodyRows = filteredLogs.map((r) => {
      const machObj = machines.find((m) => m.id === r.machineId);
      const catObj = categories.find((c) => c.id === r.categoryId);
      return [
        machObj?.machineCode || 'N/A',
        catObj?.name || 'N/A',
        r.shift,
        new Date(r.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        new Date(r.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        `${r.duration} mins`,
        r.reason,
      ];
    });

    (doc as any).autoTable({
      startY: 28,
      head: [['Machine', 'Category', 'Shift', 'Start', 'End', 'Duration', 'Reason']],
      body: bodyRows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] },
    });

    doc.save(`Downtime_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plantId || !formData.machineId || !formData.categoryId || !formData.reason) {
      setNotification({ open: true, message: 'Please complete all required fields.', severity: 'error' });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.plantId || !editFormData.machineId || !editFormData.categoryId || !editFormData.reason) {
      setNotification({ open: true, message: 'Please complete all required fields.', severity: 'error' });
      return;
    }
    updateMutation.mutate(editFormData);
  };

  const canEdit = hasPermission('downtime', 'update');
  const canDelete = hasPermission('downtime', 'delete');

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlaylistAddIcon sx={{ color: '#ef4444' }} />
          Machine Downtime Entry & Log
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
          Log machine breakdown incidents, maintenance delays, and shift occurrences directly.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Side: Entry Form */}
        {hasPermission('downtime', 'create') && (
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2.5, color: '#ef4444' }}>
                  <Box sx={{ p: 0.8, borderRadius: '8px', bgcolor: 'rgba(239, 68, 68, 0.1)', display: 'flex' }}>
                    <AccessTimeIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Record Downtime Incident
                  </Typography>
                </Stack>

                <form onSubmit={handleSubmit}>
                  <Stack spacing={2}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Select Plant</InputLabel>
                      <Select
                        label="Select Plant"
                        value={formData.plantId}
                        onChange={(e) => setFormData({ ...formData, plantId: e.target.value })}
                      >
                        {plants.filter(p => p.status === 'ACTIVE').map((p) => (
                          <MenuItem key={p.id} value={p.id}>{p.plantName}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small" required>
                      <InputLabel>Target Machine</InputLabel>
                      <Select
                        label="Target Machine"
                        value={formData.machineId}
                        onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                      >
                        {machines
                          .filter(m => (!formData.plantId || m.plantId === formData.plantId) && m.status === 'ACTIVE')
                          .map((m) => (
                            <MenuItem key={m.id} value={m.id}>{m.machineCode} - {m.machineName}</MenuItem>
                          ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small" required>
                      <InputLabel>Downtime Reason Category</InputLabel>
                      <Select
                        label="Downtime Reason Category"
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      >
                        {categories.filter(c => c.status === 'ACTIVE').map((c) => (
                          <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Grid container spacing={1.5}>
                      <Grid size={6}>
                        <FormControl fullWidth size="small" required>
                          <InputLabel>Shift</InputLabel>
                          <Select
                            label="Shift"
                            value={formData.shift}
                            onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                          >
                            <MenuItem value="Shift A">Shift A</MenuItem>
                            <MenuItem value="Shift B">Shift B</MenuItem>
                            <MenuItem value="Shift C">Shift C</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={6}>
                        <TextField
                          label="Incident Date"
                          type="date"
                          size="small"
                          fullWidth
                          slotProps={{ inputLabel: { shrink: true } }}
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                      </Grid>
                    </Grid>

                    <Grid container spacing={1.5}>
                      <Grid size={6}>
                        <TextField
                          label="Start Time"
                          type="time"
                          size="small"
                          fullWidth
                          slotProps={{ inputLabel: { shrink: true } }}
                          value={formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        />
                      </Grid>
                      <Grid size={6}>
                        <TextField
                          label="End Time"
                          type="time"
                          size="small"
                          fullWidth
                          slotProps={{ inputLabel: { shrink: true } }}
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        />
                      </Grid>
                    </Grid>

                    <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Total Duration:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#ef4444' }}>{formData.duration} Minutes</Typography>
                    </Box>

                    <TextField
                      label="Root Cause / Stoppage Reason"
                      placeholder="e.g. Needle jam in feeder assembly"
                      required
                      multiline
                      rows={2}
                      size="small"
                      fullWidth
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    />

                    <TextField
                      label="Corrective Action / Remarks"
                      placeholder="e.g. Technician replaced assembly unit"
                      multiline
                      rows={2}
                      size="small"
                      fullWidth
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    />

                    <Button
                      type="submit"
                      variant="contained"
                      color="error"
                      size="medium"
                      fullWidth
                      disabled={createMutation.isPending}
                      sx={{ py: 1.2, fontWeight: 700, borderRadius: '8px' }}
                    >
                      {createMutation.isPending ? <CircularProgress size={22} color="inherit" /> : 'Log Stoppage Event'}
                    </Button>
                  </Stack>
                </form>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Right Side: Log Entries Table */}
        <Grid size={{ xs: 12, lg: hasPermission('downtime', 'create') ? 8 : 12 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ pb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <HistoryIcon sx={{ color: '#ef4444' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Downtime Incident History
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    size="small"
                    onClick={exportExcel}
                    sx={{ borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem' }}
                  >
                    Excel
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    size="small"
                    onClick={exportPDF}
                    sx={{ borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem' }}
                  >
                    PDF
                  </Button>
                </Stack>
              </Box>

              {/* Table Search & Filter */}
              <Box sx={{ pb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  placeholder="Search Machine / Reason..."
                  size="small"
                  sx={{ width: { xs: '100%', sm: 260 } }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  slotProps={{ input: { startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                      </InputAdornment>
                    ) } }}
                />
                <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 } }}>
                  <InputLabel>Filter by Plant</InputLabel>
                  <Select
                    label="Filter by Plant"
                    value={listPlant}
                    onChange={(e) => setListPlant(e.target.value)}
                  >
                    <MenuItem value="all">All Plants</MenuItem>
                    {plants.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.plantName}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <TableContainer sx={{ maxHeight: 540, border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Machine & Shift</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Time Window</TableCell>
                      <TableCell align="right">Duration</TableCell>
                      <TableCell>Reason & Remarks</TableCell>
                      {(canEdit || canDelete) && <TableCell align="right">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.length > 0 ? (
                      filteredLogs.map((r) => {
                        const machObj = machines.find((m) => m.id === r.machineId);
                        const catObj = categories.find((c) => c.id === r.categoryId);
                        return (
                          <TableRow key={r.id} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#6366f1' }}>
                                {machObj?.machineCode || 'N/A'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {machObj?.machineName || 'N/A'} • {r.shift}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={catObj?.name || 'Uncategorized'}
                                sx={{ bgcolor: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5', fontWeight: 600, fontSize: '0.7rem' }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                {new Date(r.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(r.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(r.startTime).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: '#ef4444' }}>
                              {r.duration}m
                            </TableCell>
                            <TableCell sx={{ maxWidth: 220 }}>
                              <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: '#0f172a' }}>
                                {r.reason}
                              </Typography>
                              {r.remarks && (
                                <Typography variant="caption" noWrap sx={{ color: '#64748b', display: 'block' }}>
                                  {r.remarks}
                                </Typography>
                              )}
                            </TableCell>
                            {(canEdit || canDelete) && (
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                                  {canEdit && (
                                    <Tooltip title="Edit Incident">
                                      <IconButton onClick={() => setEditRecord(r)} size="small" sx={{ color: '#6366f1' }}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  {canDelete && (
                                    <Tooltip title="Delete Incident">
                                      <IconButton onClick={() => { if (confirm('Are you sure you want to delete this downtime entry?')) deleteMutation.mutate(r); }} size="small" sx={{ color: '#ef4444' }}>
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Stack>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#64748b' }}>
                          {loadingRecords ? (
                            <CircularProgress size={30} />
                          ) : (
                            'No downtime events logged.'
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Dialog */}
      <Dialog
        open={Boolean(editRecord)}
        onClose={() => setEditRecord(null)}
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
          Edit Downtime Record
        </DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Plant</InputLabel>
                <Select
                  label="Plant"
                  value={editFormData.plantId}
                  onChange={(e) => setEditFormData({ ...editFormData, plantId: e.target.value })}
                >
                  {plants.filter(p => p.status === 'ACTIVE').map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.plantName}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" required>
                <InputLabel>Machine</InputLabel>
                <Select
                  label="Machine"
                  value={editFormData.machineId}
                  onChange={(e) => setEditFormData({ ...editFormData, machineId: e.target.value })}
                >
                  {machines
                    .filter(m => (!editFormData.plantId || m.plantId === editFormData.plantId) && m.status === 'ACTIVE')
                    .map((m) => (
                      <MenuItem key={m.id} value={m.id}>{m.machineCode} - {m.machineName}</MenuItem>
                    ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" required>
                <InputLabel>Category</InputLabel>
                <Select
                  label="Category"
                  value={editFormData.categoryId}
                  onChange={(e) => setEditFormData({ ...editFormData, categoryId: e.target.value })}
                >
                  {categories.filter(c => c.status === 'ACTIVE').map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Grid container spacing={2}>
                <Grid size={6}>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Shift</InputLabel>
                    <Select
                      label="Shift"
                      value={editFormData.shift}
                      onChange={(e) => setEditFormData({ ...editFormData, shift: e.target.value })}
                    >
                      <MenuItem value="Shift A">Shift A</MenuItem>
                      <MenuItem value="Shift B">Shift B</MenuItem>
                      <MenuItem value="Shift C">Shift C</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="Date"
                    type="date"
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={6}>
                  <TextField
                    label="Start Time"
                    type="time"
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={editFormData.startTime}
                    onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="End Time"
                    type="time"
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={editFormData.endTime}
                    onChange={(e) => setEditFormData({ ...editFormData, endTime: e.target.value })}
                  />
                </Grid>
              </Grid>

              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#ef4444' }}>
                  Calculated Duration: {editFormData.duration} Minutes
                </Typography>
              </Box>

              <TextField
                label="Root Cause Reason"
                required
                multiline
                rows={2}
                size="small"
                fullWidth
                value={editFormData.reason}
                onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
              />

              <TextField
                label="Remarks"
                multiline
                rows={2}
                size="small"
                fullWidth
                value={editFormData.remarks}
                onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditRecord(null)} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="error" disabled={updateMutation.isPending} sx={{ borderRadius: '8px', fontWeight: 700 }}>
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
