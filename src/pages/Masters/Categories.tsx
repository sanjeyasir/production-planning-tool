import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getProductionCategories,
  getDowntimeCategories,
  createProductionCategory,
  updateProductionCategory,
  deleteProductionCategory,
  createDowntimeCategory,
  updateDowntimeCategory,
  deleteDowntimeCategory,
  logActivity,
  type ProductionCategory,
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
  Tabs,
  Tab,
  Chip,
  InputAdornment
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import CategoryIcon from '@mui/icons-material/Category';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import TableViewIcon from '@mui/icons-material/TableView';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CloudDoneIcon from '@mui/icons-material/CloudDone';

// Handsontable
import { HotTable } from '@handsontable/react';
import * as XLSX from 'xlsx';

export const Categories: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, profile } = useAuthStore();
  const tenantId = tenant?.id || '';
  const userId = profile?.id || '';
  const userName = profile?.name || '';

  // Tab State: 0 for Product Categories, 1 for Downtime Categories
  const [tabValue, setTabValue] = useState(0);

  // Notifications
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Queries
  const { data: prodCats = [], isLoading: loadingProd } = useQuery({
    queryKey: ['productionCategories', tenantId],
    queryFn: () => getProductionCategories(tenantId),
    enabled: !!tenantId,
  });

  const { data: dtCats = [], isLoading: loadingDowntime } = useQuery({
    queryKey: ['downtimeCategories', tenantId],
    queryFn: () => getDowntimeCategories(tenantId),
    enabled: !!tenantId,
  });

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionCategory | DowntimeCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'ACTIVE'
  });
  const [search, setSearch] = useState('');

  // Filtering
  const filteredItems = useMemo(() => {
    const list = tabValue === 0 ? prodCats : dtCats;
    return list.filter((item) => {
      const name = item.name.toLowerCase();
      const desc = item.description?.toLowerCase() || '';
      const match = search.toLowerCase();
      return name.includes(match) || desc.includes(match);
    });
  }, [prodCats, dtCats, tabValue, search]);

  // Handsontable Data
  const hotData = useMemo(() => {
    return filteredItems.map((item, index) => ({
      rowNum: index + 1,
      id: item.id,
      name: item.name,
      description: item.description || '',
      status: item.status || 'ACTIVE',
      action: 'DELETE',
    }));
  }, [filteredItems]);

  // Handsontable In-Place Cell Edit & Auto-Save Handler
  const handleAfterChange = async (changes: any[] | null, source: string) => {
    if (source === 'loadData' || !changes || changes.length === 0) return;

    for (const [row, prop, oldValue, newValue] of changes) {
      if (oldValue === newValue) continue;
      const rowData = hotData[row];
      if (!rowData || !rowData.id) continue;

      try {
        const updatePayload: any = {};
        if (prop === 'name') updatePayload.name = String(newValue || '').trim();
        if (prop === 'description') updatePayload.description = String(newValue || '').trim();
        if (prop === 'status') updatePayload.status = newValue === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

        if (Object.keys(updatePayload).length > 0) {
          if (tabValue === 0) {
            await updateProductionCategory(rowData.id, updatePayload);
            queryClient.invalidateQueries({ queryKey: ['productionCategories', tenantId] });
          } else {
            await updateDowntimeCategory(rowData.id, updatePayload);
            queryClient.invalidateQueries({ queryKey: ['downtimeCategories', tenantId] });
          }
          setNotification({ open: true, message: `Category "${rowData.name}" updated & autosaved!`, severity: 'success' });
        }
      } catch (err: any) {
        setNotification({ open: true, message: `Failed to autosave category: ${err.message}`, severity: 'error' });
      }
    }
  };

  const handleOpenDialog = (item?: ProductionCategory | DowntimeCategory) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        status: item.status
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        status: 'ACTIVE'
      });
    }
    setDialogOpen(true);
  };

  // Mutations
  const createProdMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const newId = await createProductionCategory({
        tenantId,
        name: data.name.trim(),
        description: data.description.trim(),
        status: data.status as any,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'CREATE_PROD_CATEGORY',
        `Created product category ${data.name}`,
        null,
        data
      );
      return newId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionCategories', tenantId] });
      setDialogOpen(false);
      setNotification({ open: true, message: 'Product category added!', severity: 'success' });
    }
  });

  const updateProdMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!editingItem) return;
      await updateProductionCategory(editingItem.id, {
        name: data.name.trim(),
        description: data.description.trim(),
        status: data.status as any,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'UPDATE_PROD_CATEGORY',
        `Updated product category ${editingItem.name}`,
        editingItem,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionCategories', tenantId] });
      setDialogOpen(false);
      setNotification({ open: true, message: 'Product category updated!', severity: 'success' });
    }
  });

  // Delete Confirmation Modal Popup State
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    item: ProductionCategory | DowntimeCategory | null;
  }>({
    open: false,
    item: null
  });

  const deleteProdMutation = useMutation({
    mutationFn: async (item: ProductionCategory) => {
      await deleteProductionCategory(item.id);
      await logActivity(
        tenantId,
        userId,
        userName,
        'DELETE_PROD_CATEGORY',
        `Deleted product category ${item.name}`,
        item,
        null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionCategories', tenantId] });
      setNotification({ open: true, message: 'Product category deleted.', severity: 'success' });
      setDeleteModal({ open: false, item: null });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to delete: ${err.message}`, severity: 'error' });
    }
  });

  const createDtMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const newId = await createDowntimeCategory({
        tenantId,
        name: data.name.trim(),
        description: data.description.trim(),
        status: data.status as any,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'CREATE_DT_CATEGORY',
        `Created downtime category ${data.name}`,
        null,
        data
      );
      return newId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtimeCategories', tenantId] });
      setDialogOpen(false);
      setNotification({ open: true, message: 'Downtime category added!', severity: 'success' });
    }
  });

  const updateDtMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!editingItem) return;
      await updateDowntimeCategory(editingItem.id, {
        name: data.name.trim(),
        description: data.description.trim(),
        status: data.status as any,
      });

      await logActivity(
        tenantId,
        userId,
        userName,
        'UPDATE_DT_CATEGORY',
        `Updated downtime category ${editingItem.name}`,
        editingItem,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtimeCategories', tenantId] });
      setDialogOpen(false);
      setNotification({ open: true, message: 'Downtime category updated!', severity: 'success' });
    }
  });

  const deleteDtMutation = useMutation({
    mutationFn: async (item: DowntimeCategory) => {
      await deleteDowntimeCategory(item.id);
      await logActivity(
        tenantId,
        userId,
        userName,
        'DELETE_DT_CATEGORY',
        `Deleted downtime category ${item.name}`,
        item,
        null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtimeCategories', tenantId] });
      setNotification({ open: true, message: 'Downtime category deleted.', severity: 'success' });
      setDeleteModal({ open: false, item: null });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to delete: ${err.message}`, severity: 'error' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setNotification({ open: true, message: 'Category Name is required.', severity: 'error' });
      return;
    }

    if (tabValue === 0) {
      if (editingItem) updateProdMutation.mutate(formData);
      else createProdMutation.mutate(formData);
    } else {
      if (editingItem) updateDtMutation.mutate(formData);
      else createDtMutation.mutate(formData);
    }
  };

  const handleExportExcel = () => {
    const sheetName = tabValue === 0 ? 'Product Categories' : 'Downtime Categories';
    const data = filteredItems.map((item) => ({
      'Category Name': item.name,
      'Description': item.description || '',
      'Status': item.status
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName.replace(/\s+/g, '_')}_Master.xlsx`);
    setNotification({ open: true, message: `${sheetName} exported to Excel!`, severity: 'success' });
  };

  const isPending = createProdMutation.isPending || updateProdMutation.isPending || createDtMutation.isPending || updateDtMutation.isPending;
  const isLoading = tabValue === 0 ? loadingProd : loadingDowntime;

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CategoryIcon sx={{ color: '#6366f1' }} />
            Category Definitions Master
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
            {tabValue === 0 ? 'Add Product Category' : 'Add Downtime Category'}
          </Button>
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: '#e2e8f0', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, val) => setTabValue(val)}
          sx={{
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: '0.9rem',
              textTransform: 'none',
              minHeight: 48,
              color: '#64748b',
              '&.Mui-selected': {
                color: '#6366f1',
              },
            },
            '& .MuiTabs-indicator': {
              bgcolor: '#6366f1',
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab icon={<CategoryIcon sx={{ fontSize: 18, mr: 0.5 }} />} iconPosition="start" label={`Product Categories (${prodCats.length})`} />
          <Tab icon={<SettingsIcon sx={{ fontSize: 18, mr: 0.5 }} />} iconPosition="start" label={`Downtime Categories (${dtCats.length})`} />
        </Tabs>
      </Box>

      {/* Main Card with Handsontable */}
      {/* Main Card with Handsontable and Controls */}
      <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ pb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TableViewIcon sx={{ color: '#6366f1' }} />
                  {tabValue === 0 ? 'Product Categories Directory' : 'Downtime Categories Directory'}
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
              placeholder="Search category name or description..."
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
                colHeaders={['#', 'Category Name', 'Description / Details', 'Status', 'Action']}
                columns={[
                  { data: 'rowNum', readOnly: true, width: 50, className: 'htCenter htMiddle' },
                  { data: 'name', type: 'text', width: 280, className: 'htMiddle' },
                  { data: 'description', type: 'text', width: 340, className: 'htMiddle' },
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
                    const itemObj = filteredItems.find((i) => i.id === rowData?.id);
                    if (itemObj) {
                      setDeleteModal({ open: true, item: itemObj });
                    }
                  }
                }}
                rowHeaders={true}
                height="auto"
                width="100%"
                colWidths={[50, 280, 340, 140, 100]}
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
                No categories found. Click button above to create a new category.
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* CONFIRM DELETE MODAL POPUP (NOT BROWSER ALERT) */}
      <Dialog
        open={deleteModal.open}
        onClose={() => !(deleteProdMutation.isPending || deleteDtMutation.isPending) && setDeleteModal({ open: false, item: null })}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DeleteForeverIcon sx={{ color: '#dc2626' }} />
          </Box>
          Confirm Category Deletion
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6 }}>
            Are you sure you want to delete {tabValue === 0 ? 'product category' : 'downtime reason category'} <strong>"{deleteModal.item?.name}"</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1 }}>
            This action cannot be undone and will permanently remove this category master record.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={() => setDeleteModal({ open: false, item: null })}
            variant="outlined"
            disabled={deleteProdMutation.isPending || deleteDtMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!deleteModal.item) return;
              if (tabValue === 0) {
                deleteProdMutation.mutate(deleteModal.item as ProductionCategory);
              } else {
                deleteDtMutation.mutate(deleteModal.item as DowntimeCategory);
              }
            }}
            variant="contained"
            color="error"
            disabled={deleteProdMutation.isPending || deleteDtMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, px: 2.5 }}
          >
            {deleteProdMutation.isPending || deleteDtMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Yes, Delete Category'}
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
          {editingItem
            ? `Edit ${tabValue === 0 ? 'Product Category' : 'Downtime Category'}`
            : `Add ${tabValue === 0 ? 'Product Category' : 'Downtime Category'}`}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Category Name"
                placeholder={tabValue === 0 ? 'e.g. Cotton Fabrics' : 'e.g. Mechanical Jam'}
                size="small"
                required
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="Description / Remarks"
                placeholder="Optional details or specifications"
                size="small"
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <FormControl fullWidth size="small">
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
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
            <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748b', fontWeight: 600, textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isPending}
              sx={{ borderRadius: '8px', px: 3, fontWeight: 600, textTransform: 'none' }}
            >
              {isPending ? <CircularProgress size={20} color="inherit" /> : 'Save Category'}
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

export default Categories;
