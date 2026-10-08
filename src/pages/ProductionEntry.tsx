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
  toLocalDateString,
  parseLocalDate,
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
    date: toLocalDateString(new Date()),
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

  // Automatically compute actual volume when accepted + rejected changes
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
        date: toLocalDateString(editRecord.date),
        budgetVolume: editRecord.budgetVolume,
        plannedVolume: editRecord.plannedVolume,
        actualVolume: editRecord.actualVolume,
        acceptedQuantity: editRecord.acceptedQuantity,
        rejectedQuantity: editRecord.rejectedQuantity,
      });
    }
  }, [editRecord]);

  // Live MTD Calculation
  const liveMtdStats = useMemo(() => {
    if (!formData.plantId || !formData.categoryId || !formData.date) {
      return { mtd: 0, balance: 0, achievement: 0 };
    }

    const selectedDate = parseLocalDate(formData.date);
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

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
        date: parseLocalDate(data.date),
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
        date: toLocalDateString(new Date()),
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
        date: parseLocalDate(data.date),
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
        (r.budgetVolume ?? 0).toLocaleString(),
        (r.plannedVolume ?? 0).toLocaleString(),
        (r.actualVolume ?? 0).toLocaleString(),
        (r.acceptedQuantity ?? 0).toLocaleString(),
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
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
          <PrecisionManufacturingIcon sx={{ color: '#10b981' }} />
          Production Logs & Output Entry
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
          Record actual volumes, scrap quantities, and monitor monthly balance targets directly.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Side: Logging Form */}
        {hasPermission('production', 'create') && (
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2.5, color: '#10b981' }}>
                  <Box sx={{ p: 0.8, borderRadius: '8px', bgcolor: 'rgba(16, 185, 129, 0.1)', display: 'flex' }}>
                    <PrecisionManufacturingIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Log Production Run
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
                      size="small"
                      fullWidth
                      slotProps={{ inputLabel: { shrink: true } }}
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />

                    <Grid container spacing={1.5}>
                      <Grid size={6}>
                        <TextField
                          label="Budget Volume"
                          type="number"
                          size="small"
                          fullWidth
                          value={formData.budgetVolume || ''}
                          onChange={(e) => setFormData({ ...formData, budgetVolume: Number(e.target.value) })}
                        />
                      </Grid>
                      <Grid size={6}>
                        <TextField
                          label="Planned Volume"
                          type="number"
                          size="small"
                          fullWidth
                          value={formData.plannedVolume || ''}
                          onChange={(e) => setFormData({ ...formData, plannedVolume: Number(e.target.value) })}
                        />
                      </Grid>
                    </Grid>

                    <Grid container spacing={1.5}>
                      <Grid size={6}>
                        <TextField
                          label="Accepted Qty"
                          type="number"
                          size="small"
                          fullWidth
                          value={formData.acceptedQuantity || ''}
                          onChange={(e) => setFormData({ ...formData, acceptedQuantity: Number(e.target.value) })}
                        />
                      </Grid>
                      <Grid size={6}>
                        <TextField
                          label="Rejected Qty"
                          type="number"
                          size="small"
                          fullWidth
                          value={formData.rejectedQuantity || ''}
                          onChange={(e) => setFormData({ ...formData, rejectedQuantity: Number(e.target.value) })}
                        />
                      </Grid>
                    </Grid>

                    <TextField
                      label="Actual Produced Volume"
                      type="number"
                      size="small"
                      fullWidth
                      disabled
                      value={formData.actualVolume}
                      helperText="Calculated automatically (Accepted + Rejected)"
                    />

                    {/* Live Calculations Preview Box */}
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        bgcolor: '#f8fafc',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 1, color: '#64748b', fontSize: '0.675rem' }}>
                        Live Metrics Preview
                      </Typography>
                      <Grid container spacing={1.5}>
                        <Grid size={6}>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Reject Rate:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: liveRejectRate > 3 ? '#ef4444' : '#10b981' }}>
                            {liveRejectRate.toFixed(2)}%
                          </Typography>
                        </Grid>
                        <Grid size={6}>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Yield Rate:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#10b981' }}>
                            {formData.actualVolume > 0 ? (100 - liveRejectRate).toFixed(2) : 0}%
                          </Typography>
                        </Grid>
                        <Grid size={6}>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>MTD Volume:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                            {(liveMtdStats.mtd ?? 0).toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid size={6}>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Remaining Balance:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#d97706' }}>
                            {(liveMtdStats.balance ?? 0).toLocaleString()}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>

                    <Button
                      type="submit"
                      variant="contained"
                      color="secondary"
                      size="medium"
                      fullWidth
                      disabled={createMutation.isPending}
                      sx={{ py: 1.2, fontWeight: 700, borderRadius: '8px' }}
                    >
                      {createMutation.isPending ? <CircularProgress size={22} color="inherit" /> : 'Submit Production Log'}
                    </Button>
                  </Stack>
                </form>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Right Side: Logs Table */}
        <Grid size={{ xs: 12, lg: hasPermission('production', 'create') ? 8 : 12 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ pb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <HistoryIcon sx={{ color: '#6366f1' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Production Activity History
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

              {/* Table Filters */}
              <Box sx={{ pb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  placeholder="Search Category name..."
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
                      <TableCell>Date & Plant</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Budget / Planned</TableCell>
                      <TableCell align="right">Produced</TableCell>
                      <TableCell align="right">Accepted / Rejected</TableCell>
                      <TableCell align="center">Reject Rate</TableCell>
                      {(canEdit || canDelete) && <TableCell align="right">Actions</TableCell>}
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
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                {new Date(r.date).toLocaleDateString()}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                {plantObj?.plantName || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{catObj?.name || 'N/A'}</TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{(r.budgetVolume ?? 0).toLocaleString()}</Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>Plan: {(r.plannedVolume ?? 0).toLocaleString()}</Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: '#10b981' }}>
                              {(r.actualVolume ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#059669' }}>{(r.acceptedQuantity ?? 0).toLocaleString()}</Typography>
                              <Typography variant="caption" sx={{ color: '#dc2626' }}>Rej: {(r.rejectedQuantity ?? 0).toLocaleString()}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={`${rejRate.toFixed(1)}%`}
                                sx={{
                                  fontWeight: 700,
                                  bgcolor: rejRate > 3 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                  color: rejRate > 3 ? '#dc2626' : '#059669',
                                  fontSize: '0.7rem'
                                }}
                              />
                            </TableCell>
                            {(canEdit || canDelete) && (
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                                  {canEdit && (
                                    <Tooltip title="Edit Log">
                                      <IconButton onClick={() => setEditRecord(r)} size="small" sx={{ color: '#6366f1' }}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  {canDelete && (
                                    <Tooltip title="Delete Log">
                                      <IconButton onClick={() => { if(confirm('Are you sure you want to delete this log?')) deleteMutation.mutate(r); }} size="small" sx={{ color: '#ef4444' }}>
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
                        <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#64748b' }}>
                          {loadingRecords ? (
                            <CircularProgress size={30} />
                          ) : (
                            'No production runs logged.'
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
          Edit Production Record
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
                size="small"
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
                    size="small"
                    fullWidth
                    value={editFormData.budgetVolume}
                    onChange={(e) => setEditFormData({ ...editFormData, budgetVolume: Number(e.target.value) })}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="Planned Volume"
                    type="number"
                    size="small"
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
                    size="small"
                    fullWidth
                    value={editFormData.acceptedQuantity}
                    onChange={(e) => setEditFormData({ ...editFormData, acceptedQuantity: Number(e.target.value) })}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="Rejected Quantity"
                    type="number"
                    size="small"
                    fullWidth
                    value={editFormData.rejectedQuantity}
                    onChange={(e) => setEditFormData({ ...editFormData, rejectedQuantity: Number(e.target.value) })}
                  />
                </Grid>
              </Grid>

              <TextField
                label="Actual Produced Volume"
                type="number"
                size="small"
                fullWidth
                disabled
                value={editFormData.actualVolume}
              />

              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Calculated Reject Rate: <strong style={{ color: editLiveRejectRate > 3 ? '#ef4444' : '#10b981' }}>{editLiveRejectRate.toFixed(2)}%</strong>
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditRecord(null)} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="secondary" disabled={updateMutation.isPending} sx={{ borderRadius: '8px', fontWeight: 700 }}>
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
