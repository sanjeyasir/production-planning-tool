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

      // Handle overnight shift duration
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
      
      // If end time is before start time, it means overnight record
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
        `Deleted downtime record ID ${record.id} for machine ${record.machineId}`,
        record,
        null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtimeRecords', tenantId] });
      setNotification({ open: true, message: 'Downtime record deleted!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to delete record: ${err.message}`, severity: 'error' });
    }
  });

  // Export handlers
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
        Date: new Date(r.startTime).toLocaleDateString(),
        'Start Time': new Date(r.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'End Time': new Date(r.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Duration (Mins)': r.duration,
        Reason: r.reason,
        Remarks: r.remarks || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Downtime Logs');
    XLSX.writeFile(wb, `Downtime_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`MOIP - Downtime Operations Report (${tenant?.companyName})`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 22);

    const bodyRows = filteredLogs.map((r) => {
      const plantObj = plants.find((p) => p.id === r.plantId);
      const machObj = machines.find((m) => m.id === r.machineId);
      const catObj = categories.find((c) => c.id === r.categoryId);
      return [
        plantObj?.plantName || 'N/A',
        `${machObj?.machineCode || 'N/A'} - ${machObj?.machineName || 'N/A'}`,
        catObj?.name || 'N/A',
        r.shift,
        new Date(r.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        `${r.duration}m`,
        r.reason,
      ];
    });

    (doc as any).autoTable({
      startY: 28,
      head: [['Plant', 'Machine', 'Category', 'Shift', 'Time', 'Dur.', 'Reason']],
      body: bodyRows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`Downtime_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plantId || !formData.machineId || !formData.categoryId || !formData.reason) {
      setNotification({ open: true, message: 'Please fill in all required fields.', severity: 'error' });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.plantId || !editFormData.machineId || !editFormData.categoryId || !editFormData.reason) {
      setNotification({ open: true, message: 'Please fill in all required fields.', severity: 'error' });
      return;
    }
    updateMutation.mutate(editFormData);
  };

  // Get active machines for selection dropdown based on selected plant
  const formMachines = useMemo(() => {
    return machines.filter((m) => m.plantId === formData.plantId && m.status === 'ACTIVE');
  }, [machines, formData.plantId]);

  const editFormMachines = useMemo(() => {
    return machines.filter((m) => m.plantId === editFormData.plantId && m.status === 'ACTIVE');
  }, [machines, editFormData.plantId]);

  const canEdit = hasPermission('downtime', 'update');
  const canDelete = hasPermission('downtime', 'delete');

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
          Downtime Logs & Entry
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Log production stoppages, mechanical errors, or material delays instantly.
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Left Side: Logging Form */}
        {hasPermission('downtime', 'create') && (
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card sx={{ position: 'sticky', top: 90 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3, color: 'primary.light' }}>
                  <PlaylistAddIcon />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Log Stoppage Event
                  </Typography>
                </Stack>
                
                <form onSubmit={handleSubmit}>
                  <Stack spacing={2.5}>
                    <FormControl fullWidth size="medium" required>
                      <InputLabel>Select Plant</InputLabel>
                      <Select
                        label="Select Plant"
                        value={formData.plantId}
                        onChange={(e) => setFormData({ ...formData, plantId: e.target.value, machineId: '' })}
                      >
                        {plants.filter(p => p.status === 'ACTIVE').map((p) => (
                          <MenuItem key={p.id} value={p.id}>{p.plantName}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="medium" required disabled={!formData.plantId}>
                      <InputLabel>Select Machine</InputLabel>
                      <Select
                        label="Select Machine"
                        value={formData.machineId}
                        onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                      >
                        {formMachines.map((m) => (
                          <MenuItem key={m.id} value={m.id}>{m.machineCode} - {m.machineName}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="medium" required>
                      <InputLabel>Downtime Category</InputLabel>
                      <Select
                        label="Downtime Category"
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      >
                        {categories.filter(c => c.status === 'ACTIVE').map((c) => (
                          <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="medium">
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

                    <TextField
                      label="Event Date"
                      type="date"
                      fullWidth
                      slotProps={{ inputLabel: { shrink: true } }}
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />

                    <Grid container spacing={2}>
                      <Grid size={6}>
                        <TextField
                          label="Start Time"
                          type="time"
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
                          fullWidth
                          slotProps={{ inputLabel: { shrink: true } }}
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        />
                      </Grid>
                    </Grid>

                    <TextField
                      label="Duration (minutes)"
                      type="number"
                      fullWidth
                      disabled
                      value={formData.duration}
                      slotProps={{ input: { startAdornment: (
                          <InputAdornment position="start">
                            <AccessTimeIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                          </InputAdornment>
                        ) } }}
                    />

                    <TextField
                      label="Reason for Stoppage"
                      required
                      multiline
                      rows={2}
                      fullWidth
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    />

                    <TextField
                      label="Remarks (Optional)"
                      multiline
                      rows={2}
                      fullWidth
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    />

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      fullWidth
                      disabled={createMutation.isPending}
                      sx={{ py: 1.5 }}
                    >
                      {createMutation.isPending ? <CircularProgress size={24} /> : 'Submit Downtime Entry'}
                    </Button>
                  </Stack>
                </form>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Right Side: Logs Table / List */}
        <Grid size={{ xs: 12, lg: hasPermission('downtime', 'create') ? 8 : 12 }}>
          <Card>
            <CardContent sx={{ px: 0 }}>
              <Box sx={{ px: 3, pb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', color: 'primary.light' }}>
                  <HistoryIcon />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Operational Downtime Logs
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    size="small"
                    onClick={exportExcel}
                  >
                    Excel
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    size="small"
                    onClick={exportPDF}
                  >
                    PDF
                  </Button>
                </Stack>
              </Box>

              {/* Table Search & Local Filter */}
              <Box sx={{ px: 3, pb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  placeholder="Search by Machine code or Reason..."
                  size="small"
                  sx={{ width: { xs: '100%', sm: 300 } }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  slotProps={{ input: { startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'text.disabled' }} />
                      </InputAdornment>
                    ) } }}
                />
                <FormControl size="small" sx={{ width: 180 }}>
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

              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ pl: 3 }}>Date & Shift</TableCell>
                      <TableCell>Machine</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="center">Duration</TableCell>
                      <TableCell>Reason</TableCell>
                      {(canEdit || canDelete) && <TableCell align="right" sx={{ pr: 3 }}>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.length > 0 ? (
                      filteredLogs.map((r) => {
                        const machObj = machines.find((m) => m.id === r.machineId);
                        const catObj = categories.find((c) => c.id === r.categoryId);
                        return (
                          <TableRow key={r.id} hover>
                            <TableCell sx={{ pl: 3 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {new Date(r.startTime).toLocaleDateString()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {r.shift}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {machObj?.machineCode || 'N/A'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {machObj?.machineName || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>{catObj?.name || 'N/A'}</TableCell>
                            <TableCell align="center" sx={{ color: 'error.main', fontWeight: 700 }}>
                              {r.duration}m
                            </TableCell>
                            <TableCell sx={{ maxWidth: 200, wordWrap: 'break-word' }}>
                              {r.reason}
                            </TableCell>
                            {(canEdit || canDelete) && (
                              <TableCell align="right" sx={{ pr: 3 }}>
                                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                                  {canEdit && (
                                    <Tooltip title="Edit Record">
                                      <IconButton onClick={() => setEditRecord(r)} size="small" color="primary">
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  {canDelete && (
                                    <Tooltip title="Delete Record">
                                      <IconButton onClick={() => { if(confirm('Are you sure you want to delete this log?')) deleteMutation.mutate(r); }} size="small" color="error">
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
                        <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                          {loadingRecords ? (
                            <CircularProgress color="primary" />
                          ) : (
                            <Typography color="text.secondary">No downtime logs found.</Typography>
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
      <Dialog open={Boolean(editRecord)} onClose={() => setEditRecord(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Edit Downtime Event</DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <FormControl fullWidth required>
                <InputLabel>Plant</InputLabel>
                <Select
                  label="Plant"
                  value={editFormData.plantId}
                  onChange={(e) => setEditFormData({ ...editFormData, plantId: e.target.value, machineId: '' })}
                >
                  {plants.filter(p => p.status === 'ACTIVE').map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.plantName}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth required disabled={!editFormData.plantId}>
                <InputLabel>Machine</InputLabel>
                <Select
                  label="Machine"
                  value={editFormData.machineId}
                  onChange={(e) => setEditFormData({ ...editFormData, machineId: e.target.value })}
                >
                  {editFormMachines.map((m) => (
                    <MenuItem key={m.id} value={m.id}>{m.machineCode} - {m.machineName}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth required>
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

              <FormControl fullWidth>
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

              <TextField
                label="Event Date"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
              />

              <Grid container spacing={2}>
                <Grid size={6}>
                  <TextField
                    label="Start Time"
                    type="time"
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
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={editFormData.endTime}
                    onChange={(e) => setEditFormData({ ...editFormData, endTime: e.target.value })}
                  />
                </Grid>
              </Grid>

              <TextField
                label="Duration (minutes)"
                type="number"
                fullWidth
                disabled
                value={editFormData.duration}
              />

              <TextField
                label="Reason"
                required
                multiline
                rows={2}
                fullWidth
                value={editFormData.reason}
                onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
              />

              <TextField
                label="Remarks"
                multiline
                rows={2}
                fullWidth
                value={editFormData.remarks}
                onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setEditRecord(null)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
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
        <Alert severity={notification.severity} variant="filled" sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
