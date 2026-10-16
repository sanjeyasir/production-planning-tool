import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  getMachines,
  getDowntimeCategories,
  createDowntimeCategory,
  updateDowntimeCategory,
  deleteDowntimeCategory,
  toLocalDateString,
  type Section,
  type Machine,
  type DowntimeCategory
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
  Grid,
  Tabs,
  Tab,
  OutlinedInput
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LayersIcon from '@mui/icons-material/Layers';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

import * as XLSX from 'xlsx';

export const Sections: React.FC = () => {
  const queryClient = useQueryClient();
  const toyoTenantId = 'toyo';

  // Active Tab: 0 = Sections, 1 = Downtime Categories
  const [tabValue, setTabValue] = useState<number>(0);

  // Notifications
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Search & Filter State (Tab 0: Sections)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Search & Filter State (Tab 1: Downtime Categories)
  const [dtSearch, setDtSearch] = useState('');
  const [dtStatusFilter, setDtStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Dialog State: Add / Edit Section
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState({
    sectionCode: '',
    sectionName: '',
    description: '',
    downtimeCategoryIds: [] as string[],
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });

  // Dialog State: Add / Edit Downtime Category
  const [dtDialogOpen, setDtDialogOpen] = useState(false);
  const [editingDt, setEditingDt] = useState<DowntimeCategory | null>(null);
  const [dtFormData, setDtFormData] = useState({
    name: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });

  // Delete Confirmation State: Section
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; section: Section | null }>({
    open: false,
    section: null
  });

  // Delete Confirmation State: Downtime Category
  const [deleteDtModal, setDeleteDtModal] = useState<{ open: boolean; category: DowntimeCategory | null }>({
    open: false,
    category: null
  });

  // ----------------------------------------------------
  // QUERIES
  // ----------------------------------------------------
  const { data: sections = [], isLoading: loadingSections } = useQuery({
    queryKey: ['sections', toyoTenantId],
    queryFn: () => getSections(toyoTenantId),
  });

  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['machines', toyoTenantId],
    queryFn: () => getMachines(toyoTenantId),
  });

  const { data: dtCategories = [], isLoading: loadingDowntime } = useQuery({
    queryKey: ['downtimeCategories', toyoTenantId],
    queryFn: () => getDowntimeCategories(toyoTenantId),
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

  // Filtered Downtime Categories
  const filteredDtCategories = useMemo(() => {
    const term = dtSearch.trim().toLowerCase();
    return dtCategories.filter(cat => {
      const matchSearch = !term ||
        cat.name.toLowerCase().includes(term) ||
        (cat.description || '').toLowerCase().includes(term);

      const matchStatus = dtStatusFilter === 'ALL' || cat.status === dtStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [dtCategories, dtSearch, dtStatusFilter]);

  // ----------------------------------------------------
  // MUTATIONS: SECTIONS
  // ----------------------------------------------------
  const saveSectionMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      if (editingSection) {
        await updateSection(editingSection.id, {
          sectionCode: payload.sectionCode.trim().toUpperCase(),
          sectionName: payload.sectionName.trim(),
          description: payload.description.trim(),
          downtimeCategoryIds: payload.downtimeCategoryIds || [],
          status: payload.status
        });
      } else {
        await createSection({
          tenantId: toyoTenantId,
          sectionCode: payload.sectionCode.trim().toUpperCase(),
          sectionName: payload.sectionName.trim(),
          description: payload.description.trim(),
          downtimeCategoryIds: payload.downtimeCategoryIds || [],
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

  // ----------------------------------------------------
  // MUTATIONS: DOWNTIME CATEGORIES
  // ----------------------------------------------------
  const saveDtMutation = useMutation({
    mutationFn: async (payload: typeof dtFormData) => {
      if (editingDt) {
        await updateDowntimeCategory(editingDt.id, {
          name: payload.name.trim(),
          description: payload.description.trim(),
          status: payload.status
        });
      } else {
        await createDowntimeCategory({
          tenantId: toyoTenantId,
          name: payload.name.trim(),
          description: payload.description.trim(),
          status: payload.status
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtimeCategories', toyoTenantId] });
      queryClient.invalidateQueries({ queryKey: ['sections', toyoTenantId] });
      setDtDialogOpen(false);
      setNotification({
        open: true,
        message: editingDt ? 'Downtime category updated successfully!' : 'New downtime category created successfully!',
        severity: 'success'
      });
    },
    onError: (err: any) => {
      setNotification({
        open: true,
        message: `Failed to save downtime category: ${err.message}`,
        severity: 'error'
      });
    }
  });

  const deleteDtMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await deleteDowntimeCategory(categoryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtimeCategories', toyoTenantId] });
      queryClient.invalidateQueries({ queryKey: ['sections', toyoTenantId] });
      setDeleteDtModal({ open: false, category: null });
      setNotification({
        open: true,
        message: 'Downtime category removed successfully!',
        severity: 'info'
      });
    },
    onError: (err: any) => {
      setNotification({
        open: true,
        message: `Failed to delete downtime category: ${err.message}`,
        severity: 'error'
      });
    }
  });

  // Handlers: Section Dialog
  const handleOpenDialog = (section?: Section) => {
    if (section) {
      setEditingSection(section);
      setFormData({
        sectionCode: section.sectionCode || '',
        sectionName: section.sectionName || '',
        description: section.description || '',
        downtimeCategoryIds: section.downtimeCategoryIds || [],
        status: section.status || 'ACTIVE'
      });
    } else {
      setEditingSection(null);
      setFormData({
        sectionCode: '',
        sectionName: '',
        description: '',
        downtimeCategoryIds: [],
        status: 'ACTIVE'
      });
    }
    setDialogOpen(true);
  };

  // Handlers: Downtime Category Dialog
  const handleOpenDtDialog = (category?: DowntimeCategory) => {
    if (category) {
      setEditingDt(category);
      setDtFormData({
        name: category.name || '',
        description: category.description || '',
        status: (category.status as any) || 'ACTIVE'
      });
    } else {
      setEditingDt(null);
      setDtFormData({
        name: '',
        description: '',
        status: 'ACTIVE'
      });
    }
    setDtDialogOpen(true);
  };

  // Export Sections Excel
  const handleExportSectionsExcel = () => {
    if (sections.length === 0) return;
    const exportRows = sections.map((sec, idx) => {
      const assigned = sectionMachineMap.get(sec.id) || [];
      const assignedDtNames = (sec.downtimeCategoryIds || [])
        .map(id => dtCategories.find(c => c.id === id)?.name || id)
        .join(', ');

      return {
        '#': idx + 1,
        'Section Code': sec.sectionCode || '',
        'Section Name': sec.sectionName,
        'Description': sec.description || '',
        'Assigned Machines Count': assigned.length,
        'Assigned Machine Codes': assigned.map(m => m.machineCode).join(', '),
        'Applicable Downtime Categories': assignedDtNames || 'All',
        'Status': sec.status
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Toyo_Sections');
    XLSX.writeFile(wb, `Toyo_Section_Master_${toLocalDateString(new Date())}.xlsx`);
    setNotification({ open: true, message: 'Sections exported to Excel!', severity: 'success' });
  };

  // Export Downtime Categories Excel
  const handleExportDtExcel = () => {
    if (dtCategories.length === 0) return;
    const exportRows = dtCategories.map((cat, idx) => ({
      '#': idx + 1,
      'Downtime Category': cat.name,
      'Description / Breakdown Scope': cat.description || '',
      'Status': cat.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Toyo_Downtime_Categories');
    XLSX.writeFile(wb, `Toyo_Downtime_Categories_${toLocalDateString(new Date())}.xlsx`);
    setNotification({ open: true, message: 'Downtime categories exported to Excel!', severity: 'success' });
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
              {tabValue === 0 ? <LayersIcon sx={{ fontSize: 24 }} /> : <ReportProblemIcon sx={{ fontSize: 24 }} />}
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', fontFamily: '"Outfit", sans-serif' }}>
                Toyo Section & Downtime Master
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                Manufacturing sections, department allocations, and downtime categories for Toyo.
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
            onClick={tabValue === 0 ? handleExportSectionsExcel : handleExportDtExcel}
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

          {tabValue === 0 ? (
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
          ) : (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDtDialog()}
              sx={{
                bgcolor: '#f59e0b',
                color: '#ffffff',
                '&:hover': { bgcolor: '#d97706' },
                fontWeight: 700,
                borderRadius: '10px',
                textTransform: 'none',
                px: 2.5
              }}
            >
              Add Downtime Category
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Tabs: Sections & Downtime Categories */}
      <Box sx={{ borderBottom: 1, borderColor: '#e2e8f0', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_e, v) => setTabValue(v)}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: '0.95rem',
              textTransform: 'none',
              minHeight: 48,
              gap: 1
            }
          }}
        >
          <Tab
            icon={<LayersIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label={`Sections (${sections.length})`}
          />
          <Tab
            icon={<ReportProblemIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label={`Downtime Categories (${dtCategories.length})`}
          />
        </Tabs>
      </Box>

      {/* KPI Ribbon */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {tabValue === 0 ? (
          <>
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
          </>
        ) : (
          <>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Total Downtime Categories
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                    {dtCategories.length} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Classifications</span>
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Active Categories
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#16a34a', mt: 0.5 }}>
                    {dtCategories.filter(c => c.status === 'ACTIVE').length}{' '}
                    <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 500 }}>In Use</span>
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Toyo Department Coverage
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#f59e0b', mt: 0.5 }}>
                    {sections.length}{' '}
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Sections Connected</span>
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      {/* TAB 0: SECTIONS TABLE */}
      {tabValue === 0 && (
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
                    <TableCell sx={{ width: 220 }}>Section Name</TableCell>
                    <TableCell>Description / Department Scope</TableCell>
                    <TableCell sx={{ width: 160 }}>Assigned Machines</TableCell>
                    <TableCell sx={{ width: 200 }}>Downtime Categories</TableCell>
                    <TableCell sx={{ width: 110 }}>Status</TableCell>
                    <TableCell align="center" sx={{ width: 120 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingSections || loadingMachines ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={30} sx={{ color: '#0284c7', mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          Loading Toyo Section Master...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredSections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#334155' }}>
                          No sections found.
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
                          Click "Add Section" to configure manufacturing departments.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSections.map((sec, idx) => {
                      const assigned = sectionMachineMap.get(sec.id) || [];
                      const isActive = sec.status === 'ACTIVE';
                      const assignedDtList = (sec.downtimeCategoryIds || [])
                        .map(id => dtCategories.find(c => c.id === id))
                        .filter(Boolean) as DowntimeCategory[];

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

                          {/* Downtime Categories */}
                          <TableCell>
                            {assignedDtList.length > 0 ? (
                              <Tooltip
                                title={
                                  <Box sx={{ p: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                                      Applicable Downtime Categories:
                                    </Typography>
                                    {assignedDtList.map(c => (
                                      <Typography key={c.id} variant="caption" sx={{ display: 'block' }}>
                                        • {c.name}
                                      </Typography>
                                    ))}
                                  </Box>
                                }
                              >
                                <Chip
                                  size="small"
                                  icon={<ReportProblemIcon sx={{ fontSize: '13px !important' }} />}
                                  label={`${assignedDtList.length} categories`}
                                  sx={{
                                    bgcolor: '#fef3c7',
                                    color: '#92400e',
                                    border: '1px solid #fde68a',
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    cursor: 'pointer'
                                  }}
                                />
                              </Tooltip>
                            ) : (
                              <Chip
                                size="small"
                                label="All Categories"
                                sx={{
                                  bgcolor: '#f1f5f9',
                                  color: '#64748b',
                                  fontSize: '0.7rem',
                                  fontWeight: 600
                                }}
                              />
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
      )}

      {/* TAB 1: DOWNTIME CATEGORIES TABLE */}
      {tabValue === 1 && (
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
                  placeholder="Search downtime categories..."
                  value={dtSearch}
                  onChange={(e) => setDtSearch(e.target.value)}
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
                    value={dtStatusFilter}
                    label="Status"
                    onChange={(e) => setDtStatusFilter(e.target.value as any)}
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
                    <TableCell sx={{ width: 260 }}>Category Name</TableCell>
                    <TableCell>Description / Breakdown Scope</TableCell>
                    <TableCell sx={{ width: 140 }}>Status</TableCell>
                    <TableCell align="center" sx={{ width: 120 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingDowntime ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={30} sx={{ color: '#f59e0b', mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          Loading Toyo Downtime Categories...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredDtCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#64748b' }}>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#334155' }}>
                          No downtime categories found for Toyo.
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
                          Click "Add Downtime Category" to register breakdown reasons (e.g. Mechanical, Electrical, Changeover).
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDtCategories.map((cat, idx) => {
                      const isActive = cat.status === 'ACTIVE';

                      return (
                        <TableRow
                          key={cat.id}
                          hover
                          sx={{ '&:last-child td': { borderBottom: 0 } }}
                        >
                          <TableCell align="center" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>
                            {idx + 1}
                          </TableCell>

                          {/* Category Name */}
                          <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ReportProblemIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                              {cat.name}
                            </Box>
                          </TableCell>

                          {/* Description */}
                          <TableCell sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                            {cat.description || '—'}
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
                              <Tooltip title="Edit Category">
                                <IconButton size="small" onClick={() => handleOpenDtDialog(cat)}>
                                  <EditIcon sx={{ fontSize: 17, color: '#0284c7' }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Category">
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteDtModal({ open: true, category: cat })}
                                >
                                  <DeleteForeverIcon sx={{ fontSize: 18, color: '#ef4444' }} />
                                </IconButton>
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
      )}

      {/* DIALOG: ADD / EDIT SECTION */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
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
            rows={2}
            fullWidth
            placeholder="Describe operations, equipment types or location in the plant..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          {/* Applicable Downtime Categories Multi-Select */}
          <FormControl fullWidth>
            <InputLabel id="applicable-dt-cats-label">Applicable Downtime Categories</InputLabel>
            <Select
              labelId="applicable-dt-cats-label"
              multiple
              value={formData.downtimeCategoryIds}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({
                  ...formData,
                  downtimeCategoryIds: typeof val === 'string' ? val.split(',') : val
                });
              }}
              input={<OutlinedInput label="Applicable Downtime Categories" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((catId) => {
                    const cat = dtCategories.find(c => c.id === catId);
                    return (
                      <Chip
                        key={catId}
                        label={cat?.name || catId}
                        size="small"
                        sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600, fontSize: '0.72rem' }}
                      />
                    );
                  })}
                </Box>
              )}
            >
              {dtCategories.length === 0 ? (
                <MenuItem disabled value="">
                  <em>No downtime categories configured. Add them in the Downtime Categories tab.</em>
                </MenuItem>
              ) : (
                dtCategories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name} {cat.status === 'INACTIVE' ? '(Inactive)' : ''}
                  </MenuItem>
                ))
              )}
            </Select>
            <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
              Leave blank to allow all downtime categories in this section.
            </Typography>
          </FormControl>

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

      {/* DIALOG: ADD / EDIT DOWNTIME CATEGORY */}
      <Dialog
        open={dtDialogOpen}
        onClose={() => setDtDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px' } } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingDt ? 'Edit Downtime Category' : 'Create Downtime Category'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Box sx={{ p: 1.5, bgcolor: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
            <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700, display: 'block' }}>
              ⚠️ Toyo Downtime Classification:
            </Typography>
            <Typography variant="caption" sx={{ color: '#92400e', display: 'block', mt: 0.3 }}>
              Downtime categories classify reasons for line stops (e.g. Mechanical, Electrical, Mold Change, Material Shortage).
            </Typography>
          </Box>

          <TextField
            label="Category Name"
            required
            fullWidth
            placeholder="e.g. Mechanical Breakdown"
            value={dtFormData.name}
            onChange={(e) => setDtFormData({ ...dtFormData, name: e.target.value })}
          />

          <TextField
            label="Description / Scope"
            multiline
            rows={3}
            fullWidth
            placeholder="Details on what issues belong in this downtime classification..."
            value={dtFormData.description}
            onChange={(e) => setDtFormData({ ...dtFormData, description: e.target.value })}
          />

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={dtFormData.status}
              label="Status"
              onChange={(e) => setDtFormData({ ...dtFormData, status: e.target.value as any })}
            >
              <MenuItem value="ACTIVE">ACTIVE</MenuItem>
              <MenuItem value="INACTIVE">INACTIVE</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setDtDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!dtFormData.name.trim() || saveDtMutation.isPending}
            onClick={() => saveDtMutation.mutate(dtFormData)}
            sx={{
              bgcolor: '#f59e0b',
              color: '#ffffff',
              '&:hover': { bgcolor: '#d97706' },
              fontWeight: 700,
              textTransform: 'none'
            }}
          >
            {saveDtMutation.isPending ? 'Saving...' : editingDt ? 'Update Category' : 'Save Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: DELETE CONFIRMATION - SECTION */}
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

      {/* DIALOG: DELETE CONFIRMATION - DOWNTIME CATEGORY */}
      <Dialog
        open={deleteDtModal.open}
        onClose={() => setDeleteDtModal({ open: false, category: null })}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px' } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#dc2626' }}>
          Delete Downtime Category?
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Are you sure you want to delete the downtime category{' '}
            <strong>{deleteDtModal.category?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setDeleteDtModal({ open: false, category: null })} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteDtMutation.isPending}
            onClick={() => {
              if (deleteDtModal.category) {
                deleteDtMutation.mutate(deleteDtModal.category.id);
              }
            }}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            {deleteDtMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
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
