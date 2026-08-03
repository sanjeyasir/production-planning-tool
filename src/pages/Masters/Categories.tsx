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
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import CategoryIcon from '@mui/icons-material/Category';
import SettingsIcon from '@mui/icons-material/Settings';

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
  const saveMutation = useMutation({
    mutationFn: async () => {
      const type = tabValue === 0 ? 'PRODUCT_CATEGORY' : 'DOWNTIME_CATEGORY';
      if (editingItem) {
        if (tabValue === 0) {
          await updateProductionCategory(editingItem.id, {
            name: formData.name,
            description: formData.description,
            status: formData.status
          });
        } else {
          await updateDowntimeCategory(editingItem.id, {
            name: formData.name,
            description: formData.description,
            status: formData.status
          });
        }
        await logActivity(
          tenantId,
          userId,
          userName,
          `UPDATE_${type}`,
          `Updated category ${formData.name}`,
          editingItem,
          formData
        );
      } else {
        if (tabValue === 0) {
          await createProductionCategory({
            tenantId,
            name: formData.name,
            description: formData.description,
            status: formData.status
          });
        } else {
          await createDowntimeCategory({
            tenantId,
            name: formData.name,
            description: formData.description,
            status: formData.status
          });
        }
        await logActivity(
          tenantId,
          userId,
          userName,
          `CREATE_${type}`,
          `Created category ${formData.name}`,
          null,
          formData
        );
      }
    },
    onSuccess: () => {
      const qKey = tabValue === 0 ? 'productionCategories' : 'downtimeCategories';
      queryClient.invalidateQueries({ queryKey: [qKey, tenantId] });
      setDialogOpen(false);
      setNotification({
        open: true,
        message: editingItem ? 'Category updated!' : 'Category created!',
        severity: 'success'
      });
    },
    onError: (err: any) => {
      setNotification({
        open: true,
        message: `Error saving category: ${err.message}`,
        severity: 'error'
      });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (item: ProductionCategory | DowntimeCategory) => {
      const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const type = tabValue === 0 ? 'PRODUCT_CATEGORY' : 'DOWNTIME_CATEGORY';
      
      if (tabValue === 0) {
        await updateProductionCategory(item.id, { status: nextStatus });
      } else {
        await updateDowntimeCategory(item.id, { status: nextStatus });
      }
      
      await logActivity(
        tenantId,
        userId,
        userName,
        `TOGGLE_${type}_STATUS`,
        `Toggled category ${item.name} to ${nextStatus}`,
        item,
        { status: nextStatus }
      );
    },
    onSuccess: () => {
      const qKey = tabValue === 0 ? 'productionCategories' : 'downtimeCategories';
      queryClient.invalidateQueries({ queryKey: [qKey, tenantId] });
      setNotification({ open: true, message: 'Category status updated!', severity: 'success' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setNotification({ open: true, message: 'Please enter a name.', severity: 'error' });
      return;
    }
    saveMutation.mutate();
  };

  const isTabLoading = tabValue === 0 ? loadingProd : loadingDowntime;

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Categories Administration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage product lines and downtime logging categorizations.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Category
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, val) => { setTabValue(val); setSearch(''); }} color="primary">
          <Tab label="Product Categories" icon={<CategoryIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="Downtime Categories" icon={<SettingsIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600 }} />
        </Tabs>
      </Box>

      <Card>
        <CardContent sx={{ px: 0 }}>
          {/* Table Toolbar */}
          <Box sx={{ px: 3, pb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search categories by name..."
              size="small"
              sx={{ width: 320 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ pl: 3 }}>Category Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right" sx={{ pr: 3 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ pl: 3, fontWeight: 700 }}>{item.name}</TableCell>
                      <TableCell>{item.description || 'No description provided'}</TableCell>
                      <TableCell align="center">
                        <Box
                          sx={{
                            display: 'inline-flex',
                            bgcolor: item.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: item.status === 'ACTIVE' ? 'secondary.light' : 'error.light',
                            borderRadius: '6px',
                            px: 1.5,
                            py: 0.5,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {item.status}
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 3 }}>
                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
                          <Tooltip title="Toggle Status">
                            <IconButton onClick={() => toggleStatusMutation.mutate(item)} size="small">
                              {item.status === 'ACTIVE' ? (
                                <ToggleOnIcon sx={{ color: 'secondary.main', fontSize: 26 }} />
                              ) : (
                                <ToggleOffIcon sx={{ color: 'text.disabled', fontSize: 26 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Details">
                            <IconButton onClick={() => handleOpenDialog(item)} size="small" color="primary">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                      {isTabLoading ? (
                        <CircularProgress color="primary" />
                      ) : (
                        <Typography color="text.secondary">No categories registered.</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Entry Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingItem ? 'Edit Category' : 'Create Category'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                label="Category Name"
                placeholder={tabValue === 0 ? "e.g. Apparel" : "e.g. Mechanical"}
                required
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="Description"
                multiline
                rows={2}
                fullWidth
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                  <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setDialogOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              Save
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
