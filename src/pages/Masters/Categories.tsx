import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getProductionCategories,
  getDowntimeCategories,
  createProductionCategory,
  updateProductionCategory,
  createDowntimeCategory,
  updateDowntimeCategory,
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
  Tabs,
  Tab,
  Chip,
  Paper,
  InputAdornment
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import CategoryIcon from '@mui/icons-material/Category';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';

export const Categories: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, profile } = useAuthStore();
  const tenantId = tenant?.id || '';
  const userId = profile?.id || '';
  const userName = profile?.name || '';

  // Tab State: 0 for Product Categories, 1 for Downtime Categories
  const [tabValue, setTabValue] = useState(0);

  // Notifications
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
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

  const toggleStatusMutation = useMutation({
    mutationFn: async (item: ProductionCategory | DowntimeCategory) => {
      const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (tabValue === 0) {
        await updateProductionCategory(item.id, { status: nextStatus as any });
      } else {
        await updateDowntimeCategory(item.id, { status: nextStatus as any });
      }

      await logActivity(
        tenantId,
        userId,
        userName,
        'TOGGLE_CATEGORY_STATUS',
        `Toggled status of ${item.name} to ${nextStatus}`,
        item,
        { status: nextStatus }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionCategories', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['downtimeCategories', tenantId] });
      setNotification({ open: true, message: 'Status updated!', severity: 'success' });
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

  const isPending = createProdMutation.isPending || updateProdMutation.isPending || createDtMutation.isPending || updateDtMutation.isPending;

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CategoryIcon sx={{ color: '#6366f1' }} />
            Category Definitions Master
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Manage manufacturing product classifications and shop-floor downtime root causes.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
        >
          {tabValue === 0 ? 'Add Product Category' : 'Add Downtime Category'}
        </Button>
      </Box>

      {/* Tabs Menu */}
      <Paper
        sx={{
          mb: 3,
          borderRadius: '12px',
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}
      >
        <Tabs
          value={tabValue}
          onChange={(_, val) => {
            setTabValue(val);
            setSearch('');
          }}
          sx={{
            px: 1.5,
            '& .MuiTab-root': { minHeight: 48, fontSize: '0.85rem' }
          }}
        >
          <Tab icon={<CategoryIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Product Categories" />
          <Tab icon={<SettingsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Downtime Stoppage Categories" />
        </Tabs>
      </Paper>

      {/* Main Table Card */}
      <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ pb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search categories by title..."
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

          <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Category Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {item.name}
                      </TableCell>
                      <TableCell sx={{ color: '#64748b' }}>
                        {item.description || 'No description provided'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={item.status}
                          sx={{
                            fontWeight: 700,
                            bgcolor: item.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: item.status === 'ACTIVE' ? '#059669' : '#dc2626',
                            fontSize: '0.7rem'
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Tooltip title="Toggle Status">
                            <IconButton onClick={() => toggleStatusMutation.mutate(item)} size="small">
                              {item.status === 'ACTIVE' ? (
                                <ToggleOnIcon sx={{ color: '#10b981', fontSize: 26 }} />
                              ) : (
                                <ToggleOffIcon sx={{ color: '#94a3b8', fontSize: 26 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Category">
                            <IconButton onClick={() => handleOpenDialog(item)} size="small" sx={{ color: '#6366f1' }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6, color: '#64748b' }}>
                      {loadingProd || loadingDowntime ? <CircularProgress size={30} /> : 'No categories configured.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Category Dialog */}
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
          {editingItem ? 'Edit Category' : `Create ${tabValue === 0 ? 'Product' : 'Downtime'} Category`}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Category Name"
                placeholder={tabValue === 0 ? 'e.g. Cotton Fabrics' : 'e.g. Electrical Power Fluctuation'}
                size="small"
                required
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="Description"
                placeholder="Optional notes or classification details"
                multiline
                rows={3}
                size="small"
                fullWidth
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
              disabled={isPending}
              sx={{ borderRadius: '8px', fontWeight: 700 }}
            >
              {editingItem ? 'Save Changes' : 'Create Category'}
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
