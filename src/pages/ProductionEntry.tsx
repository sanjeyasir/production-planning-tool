import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  getProductionRecords,
  getPlants,
  getProductionCategories,
  createProductionRecord,
  updateProductionRecord,
  deleteProductionRecord,
  logActivity,
  type ProductionRecord
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
  Paper,
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
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const ProductionEntry: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, profile, hasPermission } = useAuthStore();
  const tenantId = tenant?.id || '';
  const userId = profile?.id || '';
  const userName = profile?.name || '';

  // Notification Banner
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Queries
  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['productionRecords', tenantId],
    queryFn: () => getProductionRecords(tenantId),
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

  // Create Form State
  const [formData, setFormData] = useState({
    plantId: '',
    categoryId: '',
    date: new Date().toISOString().split('T')[0],
    budgetVolume: 0,
    plannedVolume: 0,
    actualVolume: 0,
    acceptedQuantity: 0,
    rejectedQuantity: 0,
  });

  // Edit dialog state
  const [editRecord, setEditRecord] = useState<ProductionRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    plantId: '',
    categoryId: '',
    date: '',
    budgetVolume: 0,
    plannedVolume: 0,
    actualVolume: 0,
    acceptedQuantity: 0,
    rejectedQuantity: 0,
  });

  // Live reject rate calculation for creation form
  const liveRejectRate = useMemo(() => {
    const total = formData.actualVolume;
    if (total <= 0) return 0;
    return (formData.rejectedQuantity / total) * 100;
  }, [formData.actualVolume, formData.rejectedQuantity]);

  // Live reject rate for edit form
  const editLiveRejectRate = useMemo(() => {
    const total = editFormData.actualVolume;
    if (total <= 0) return 0;
    return (editFormData.rejectedQuantity / total) * 100;
  }, [editFormData.actualVolume, editFormData.rejectedQuantity]);

  // Automatically compute actual volume when accepted + rejected changes (convenience)
  useEffect(() => {
    const sum = Number(formData.acceptedQuantity) + Number(formData.rejectedQuantity);
    if (sum > 0) {
      setFormData(prev => ({ ...prev, actualVolume: sum }));
    }
  }, [formData.acceptedQuantity, formData.rejectedQuantity]);

  useEffect(() => {
    const sum = Number(editFormData.acceptedQuantity) + Number(editFormData.rejectedQuantity);
    if (sum > 0) {
      setEditFormData(prev => ({ ...prev, actualVolume: sum }));
    }
  }, [editFormData.acceptedQuantity, editFormData.rejectedQuantity]);

  // Populate edit form data
  useEffect(() => {
    if (editRecord) {
      setEditFormData({
        plantId: editRecord.plantId,
        categoryId: editRecord.categoryId,
        date: new Date(editRecord.date).toISOString().split('T')[0],
        budgetVolume: editRecord.budgetVolume,
        plannedVolume: editRecord.plannedVolume,
        actualVolume: editRecord.actualVolume,
        acceptedQuantity: editRecord.acceptedQuantity,
        rejectedQuantity: editRecord.rejectedQuantity,
      });
    }
  }, [editRecord]);

  // Live MTD Calculation (Month-To-Date sum for matching plant/category up to selected date)
  const liveMtdStats = useMemo(() => {
    if (!formData.plantId || !formData.categoryId || !formData.date) {
      return { mtd: 0, balance: 0, achievement: 0 };
    }

    const selectedDate = new Date(formData.date);
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

    // Sum historical records from the same month up to (and including) the selected date
    const historicalSum = records
      .filter((r) => {
        const recDate = new Date(r.date);
        return (
          r.plantId === formData.plantId &&
          r.categoryId === formData.categoryId &&
          recDate >= startOfMonth &&
          recDate <= selectedDate
        );
      })
      .reduce((sum, r) => sum + r.actualVolume, 0);

    // MTD includes current form entries
    const mtdTotal = historicalSum + Number(formData.actualVolume);
    const balance = Math.max(0, Number(formData.budgetVolume) - mtdTotal);
    const achievement = formData.budgetVolume > 0 ? (mtdTotal / formData.budgetVolume) * 100 : 0;

    return {
      mtd: mtdTotal,
      balance,
      achievement,
    };
  }, [records, formData.plantId, formData.categoryId, formData.date, formData.actualVolume, formData.budgetVolume]);

  // Search and Table Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [listPlant, setListPlant] = useState('all');

  const filteredLogs = useMemo(() => {
    return records
      .filter((r) => {
        if (listPlant !== 'all' && r.plantId !== listPlant) return false;
        const catObj = categories.find((c) => c.id === r.categoryId);
        const catName = catObj?.name?.toLowerCase() || '';
        const match = searchTerm.toLowerCase();
        return catName.includes(match);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, searchTerm, listPlant, categories]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const recordId = await createProductionRecord({
        tenantId,
        plantId: data.plantId,
        categoryId: data.categoryId,
        date: new Date(data.date),
        budgetVolume: Number(data.budgetVolume),
        plannedVolume: Number(data.plannedVolume),
        actualVolume: Number(data.actualVolume),
        acceptedQuantity: Number(data.acceptedQuantity),
        rejectedQuantity: Number(data.rejectedQuantity),
        createdBy: userId,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'CREATE_PRODUCTION',
        `Logged production log for Category ${data.categoryId}: Actual ${data.actualVolume} units`,
        null,
        data
      );
      return recordId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionRecords', tenantId] });
      setFormData({
        plantId: '',
        categoryId: '',
        date: new Date().toISOString().split('T')[0],
        budgetVolume: 0,
        plannedVolume: 0,
        actualVolume: 0,
        acceptedQuantity: 0,
        rejectedQuantity: 0,
      });
      setNotification({ open: true, message: 'Production log saved!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to save production log: ${err.message}`, severity: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editFormData) => {
      if (!editRecord) return;

      await updateProductionRecord(editRecord.id, {
        plantId: data.plantId,
        categoryId: data.categoryId,
        date: new Date(data.date),
        budgetVolume: Number(data.budgetVolume),
        plannedVolume: Number(data.plannedVolume),
        actualVolume: Number(data.actualVolume),
        acceptedQuantity: Number(data.acceptedQuantity),
        rejectedQuantity: Number(data.rejectedQuantity),
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'UPDATE_PRODUCTION',
        `Updated production record ID ${editRecord.id}`,
        editRecord,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionRecords', tenantId] });
      setEditRecord(null);
      setNotification({ open: true, message: 'Production log updated!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to update production log: ${err.message}`, severity: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (record: ProductionRecord) => {
      await deleteProductionRecord(record.id);
      await logActivity(
        tenantId,
        userId,
        userName,
        'DELETE_PRODUCTION',
        `Deleted production record ID ${record.id}`,
        record,
        null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionRecords', tenantId] });
      setNotification({ open: true, message: 'Production record deleted!', severity: 'success' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to delete record: ${err.message}`, severity: 'error' });
    },
  });

  // Export files
  const exportExcel = () => {
    const dataToExport = filteredLogs.map((r) => {
      const plantObj = plants.find((p) => p.id === r.plantId);
      const catObj = categories.find((c) => c.id === r.categoryId);
      return {
        Plant: plantObj?.plantName || 'N/A',
        Category: catObj?.name || 'N/A',
        Date: new Date(r.date).toLocaleDateString(),
        'Budget Volume': r.budgetVolume,
        'Planned Volume': r.plannedVolume,
        'Actual Volume': r.actualVolume,
        'Accepted Quantity': r.acceptedQuantity,
        'Rejected Quantity': r.rejectedQuantity,
        'Reject Rate %': r.actualVolume > 0 ? ((r.rejectedQuantity / r.actualVolume) * 100).toFixed(2) : '0.00',
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production Logs');
    XLSX.writeFile(wb, `Production_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`MOIP - Production Overview Report (${tenant?.companyName})`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 22);

    const bodyRows = filteredLogs.map((r) => {
      const plantObj = plants.find((p) => p.id === r.plantId);
      const catObj = categories.find((c) => c.id === r.categoryId);
      const rejRate = r.actualVolume > 0 ? ((r.rejectedQuantity / r.actualVolume) * 100).toFixed(1) : '0.0';
      return [
        plantObj?.plantName || 'N/A',
        catObj?.name || 'N/A',
        new Date(r.date).toLocaleDateString(),
        r.budgetVolume.toLocaleString(),
        r.plannedVolume.toLocaleString(),
        r.actualVolume.toLocaleString(),
        r.acceptedQuantity.toLocaleString(),
        `${rejRate}%`,
      ];
    });

    (doc as any).autoTable({
      startY: 28,
      head: [['Plant', 'Category', 'Date', 'Budget', 'Planned', 'Actual', 'Accepted', 'Reject %']],
      body: bodyRows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(`Production_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plantId || !formData.categoryId || !formData.date) {
      setNotification({ open: true, message: 'Please fill in all required fields.', severity: 'error' });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.plantId || !editFormData.categoryId || !editFormData.date) {
      setNotification({ open: true, message: 'Please fill in all required fields.', severity: 'error' });
      return;
    }
    updateMutation.mutate(editFormData);
  };

  const canEdit = hasPermission('production', 'update');
  const canDelete = hasPermission('production', 'delete');

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
          Production Logs & Entry
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track budgeted versus actual volumes, inspect quality yield, and check monthly balance logs.
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Left Side: Logging Form */}
        {hasPermission('production', 'create') && (
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card sx={{ position: 'sticky', top: 90 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3, color: 'secondary.light' }}>
                  <PrecisionManufacturingIcon />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Log Production Run
                  </Typography>
                </Stack>

                <form onSubmit={handleSubmit}>
                  <Stack spacing={2.5}>
                    <FormControl fullWidth required>
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

                    <FormControl fullWidth required>
                      <InputLabel>Product Category</InputLabel>
                      <Select
                        label="Product Category"
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      >
                        {categories.filter(c => c.status === 'ACTIVE').map((c) => (
                          <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="Run Date"
                      type="date"
                      fullWidth
                      slotProps={{ inputLabel: { shrink: true } }}
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />

                    <Grid container spacing={2}>
                      <Grid size={6}>
                        <TextField
                          label="Budgeted Volume"
                          type="number"
                          fullWidth
                          value={formData.budgetVolume || ''}
                          onChange={(e) => setFormData({ ...formData, budgetVolume: Number(e.target.value) })}
                        />
                      </Grid>
                      <Grid size={6}>
                        <TextField
                          label="Planned Volume"
                          type="number"
                          fullWidth
                          value={formData.plannedVolume || ''}
                          onChange={(e) => setFormData({ ...formData, plannedVolume: Number(e.target.value) })}
                        />
                      </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                      <Grid size={6}>
                        <TextField
                          label="Accepted Qty"
                          type="number"
                          fullWidth
                          value={formData.acceptedQuantity || ''}
                          onChange={(e) => setFormData({ ...formData, acceptedQuantity: Number(e.target.value) })}
                        />
                      </Grid>
                      <Grid size={6}>
                        <TextField
                          label="Rejected Qty"
                          type="number"
                          fullWidth
                          value={formData.rejectedQuantity || ''}
                          onChange={(e) => setFormData({ ...formData, rejectedQuantity: Number(e.target.value) })}
                        />
                      </Grid>
                    </Grid>

                    <TextField
                      label="Actual Produced Volume"
                      type="number"
                      fullWidth
                      disabled
                      value={formData.actualVolume}
                    />

                    {/* Live Calculations Display Panel */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        bgcolor: 'rgba(255,255,255,0.01)',
                      }}
                    >
                      <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 1 }}>
                        Live Calculations Preview
                      </Typography>
                      <Grid container spacing={1.5}>
                        <Grid size={6}>
                          <Typography variant="caption" color="text.secondary">Reject Rate:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: liveRejectRate > 3 ? 'error.main' : 'secondary.main' }}>
                            {liveRejectRate.toFixed(2)}%
                          </Typography>
                        </Grid>
                        <Grid size={6}>
                          <Typography variant="caption" color="text.secondary">Yield Rate:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'secondary.light' }}>
                            {formData.actualVolume > 0 ? (100 - liveRejectRate).toFixed(2) : 0}%
                          </Typography>
                        </Grid>
                        <Grid size={6}>
                          <Typography variant="caption" color="text.secondary">MTD Total Volume:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {liveMtdStats.mtd.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid size={6}>
                          <Typography variant="caption" color="text.secondary">Remaining Balance:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {liveMtdStats.balance.toLocaleString()}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>

                    <Button
                      type="submit"
                      variant="contained"
                      color="secondary"
                      size="large"
                      fullWidth
                      disabled={createMutation.isPending}
                      sx={{ py: 1.5 }}
                    >
                      {createMutation.isPending ? <CircularProgress size={24} /> : 'Submit Production Run'}
                    </Button>
                  </Stack>
                </form>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Right Side: Logs Table */}
        <Grid size={{ xs: 12, lg: hasPermission('production', 'create') ? 8 : 12 }}>
          <Card>
            <CardContent sx={{ px: 0 }}>
              <Box sx={{ px: 3, pb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', color: 'secondary.light' }}>
                  <HistoryIcon />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Operational Production Logs
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

              {/* Table Filters */}
              <Box sx={{ px: 3, pb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  placeholder="Search Category name..."
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
                      <TableCell sx={{ pl: 3 }}>Date & Plant</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Budget / Planned</TableCell>
                      <TableCell align="right">Produced (Actual)</TableCell>
                      <TableCell align="right">Accepted / Rejected</TableCell>
                      <TableCell align="center">Reject Rate</TableCell>
                      {(canEdit || canDelete) && <TableCell align="right" sx={{ pr: 3 }}>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.length > 0 ? (
                      filteredLogs.map((r) => {
                        const plantObj = plants.find((p) => p.id === r.plantId);
                        const catObj = categories.find((c) => c.id === r.categoryId);
                        const rejRate = r.actualVolume > 0 ? (r.rejectedQuantity / r.actualVolume) * 100 : 0;
                        return (
                          <TableRow key={r.id} hover>
                            <TableCell sx={{ pl: 3 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {new Date(r.date).toLocaleDateString()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {plantObj?.plantName || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>{catObj?.name || 'N/A'}</TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">{r.budgetVolume.toLocaleString()}</Typography>
                              <Typography variant="caption" color="text.secondary">{r.plannedVolume.toLocaleString()}</Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: 'secondary.light' }}>
                              {r.actualVolume.toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="secondary.main">{r.acceptedQuantity.toLocaleString()}</Typography>
                              <Typography variant="caption" color="error.light">{r.rejectedQuantity.toLocaleString()}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" sx={{ fontWeight: 700, color: rejRate > 3 ? 'error.main' : 'secondary.main' }}>
                                {rejRate.toFixed(1)}%
                              </Typography>
                            </TableCell>
                            {(canEdit || canDelete) && (
                              <TableCell align="right" sx={{ pr: 3 }}>
                                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                                  {canEdit && (
                                    <Tooltip title="Edit Log">
                                      <IconButton onClick={() => setEditRecord(r)} size="small" color="primary">
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  {canDelete && (
                                    <Tooltip title="Delete Log">
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
                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                          {loadingRecords ? (
                            <CircularProgress color="primary" />
                          ) : (
                            <Typography color="text.secondary">No production runs logged.</Typography>
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
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Production Record</DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <FormControl fullWidth required>
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

              <FormControl fullWidth required>
                <InputLabel>Product Category</InputLabel>
                <Select
                  label="Product Category"
                  value={editFormData.categoryId}
                  onChange={(e) => setEditFormData({ ...editFormData, categoryId: e.target.value })}
                >
                  {categories.filter(c => c.status === 'ACTIVE').map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Date"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
              />

              <Grid container spacing={2}>
                <Grid size={6}>
                  <TextField
                    label="Budgeted Volume"
                    type="number"
                    fullWidth
                    value={editFormData.budgetVolume}
                    onChange={(e) => setEditFormData({ ...editFormData, budgetVolume: Number(e.target.value) })}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="Planned Volume"
                    type="number"
                    fullWidth
                    value={editFormData.plannedVolume}
                    onChange={(e) => setEditFormData({ ...editFormData, plannedVolume: Number(e.target.value) })}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={6}>
                  <TextField
                    label="Accepted Quantity"
                    type="number"
                    fullWidth
                    value={editFormData.acceptedQuantity}
                    onChange={(e) => setEditFormData({ ...editFormData, acceptedQuantity: Number(e.target.value) })}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="Rejected Quantity"
                    type="number"
                    fullWidth
                    value={editFormData.rejectedQuantity}
                    onChange={(e) => setEditFormData({ ...editFormData, rejectedQuantity: Number(e.target.value) })}
                  />
                </Grid>
              </Grid>

              <TextField
                label="Actual Produced Volume"
                type="number"
                fullWidth
                disabled
                value={editFormData.actualVolume}
              />

              <Typography variant="body2" color="text.secondary">
                Calculated Reject Rate: <span style={{ fontWeight: 700, color: editLiveRejectRate > 3 ? '#ef4444' : '#10b981' }}>{editLiveRejectRate.toFixed(2)}%</span>
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setEditRecord(null)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="secondary" disabled={updateMutation.isPending}>
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
