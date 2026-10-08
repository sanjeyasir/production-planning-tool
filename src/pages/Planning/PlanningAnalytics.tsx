import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getMachines,
  getProductionOrders,
  getProductionPlans,
  getDailyProductions,
  getHolidays,
  getProductionCategories,
  clearTenantTransactionalData,
  toLocalDateString
} from '../../services/db';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  CircularProgress
} from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Icons
import SpeedIcon from '@mui/icons-material/Speed';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import * as XLSX from 'xlsx';

export const PlanningAnalytics: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';

  // Queries
  const { data: machines = [] } = useQuery({
    queryKey: ['machines', tenantId],
    queryFn: () => getMachines(tenantId),
    enabled: !!tenantId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['productionOrders', tenantId],
    queryFn: () => getProductionOrders(tenantId),
    enabled: !!tenantId,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['productionPlans', tenantId],
    queryFn: () => getProductionPlans(tenantId),
    enabled: !!tenantId,
  });

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['dailyProductions', tenantId],
    queryFn: () => getDailyProductions(tenantId),
    enabled: !!tenantId,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', tenantId],
    queryFn: () => getHolidays(tenantId),
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['productionCategories', tenantId],
    queryFn: () => getProductionCategories(tenantId),
    enabled: !!tenantId,
  });

  const activeMachines = useMemo(() => {
    return machines.filter(m => m.status === 'ACTIVE');
  }, [machines]);

  // Notifications
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'warning' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const showToast = (message: string, severity: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    setNotification({ open: true, message, severity });
  };

  // Reset Modal
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Reset Mutation
  const resetDataMutation = useMutation({
    mutationFn: () => clearTenantTransactionalData(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['dailyProductions', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionRecords', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['downtimeRecords', tenantId] });
      setIsResetConfirmOpen(false);
      showToast('Irrelevant transactional data successfully cleared! Master data preserved.', 'success');
    },
    onError: (err: any) => showToast('Error clearing data: ' + err.message, 'error')
  });

  // Order stats
  const orderStats = useMemo(() => {
    const pending = orders.filter(o => o.status === 'PENDING').length;
    const draft = orders.filter(o => o.status === 'DRAFT_PLANNED').length;
    const scheduled = orders.filter(o => o.status === 'SCHEDULED').length;
    const completed = orders.filter(o => o.status === 'COMPLETED').length;
    return { pending, draft, scheduled, completed };
  }, [orders]);

  // Export full Excel workbook
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Orders
    const ordersData = orders.map(o => ({
      'Order Number': o.orderNumber,
      'Product Name': o.productName,
      'Category': categories.find(c => c.id === o.categoryId)?.name || 'N/A',
      'Target Quantity': o.quantity || 0,
      'Due Date': toLocalDateString(o.dueDate),
      'Priority': o.priority || 'MEDIUM',
      'Planning Status': o.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersData), 'Orders');

    // 2. Daily Plans
    const plansData = plans.map(p => {
      const m = machines.find(mach => mach.id === p.machineId);
      const o = orders.find(ord => ord.id === p.orderId);
      return {
        'Plan Type': p.type,
        'Order Number': o?.orderNumber || 'N/A',
        'Product': o?.productName || 'N/A',
        'Machine': m ? `${m.machineCode} - ${m.machineName}` : 'N/A',
        'Daily Target (units/day)': p.plannedDailyRate || 0,
        'Operating Hours': `${p.operatingHoursPerDay || 24}h/day`,
        'Start Date': toLocalDateString(p.startDate),
        'End Date': toLocalDateString(p.endDate),
        'Total Planned Days': p.totalPlannedDays || 0,
        'Total Volume': p.totalPlannedVolume || 0,
        'Status': p.status
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plansData), 'Daily Production Plans');

    // 3. Daily Actual Logs
    const logsData = dailyLogs.map(l => {
      const p = plans.find(plan => plan.id === l.planId);
      const o = orders.find(ord => ord.id === (l.orderId || p?.orderId));
      const m = machines.find(mach => mach.id === (l.machineId || p?.machineId));
      const target = l.targetVolume || 0;
      const actual = l.actualVolume || 0;
      return {
        'Date': l.dateStr || toLocalDateString(l.date),
        'Order Number': o?.orderNumber || 'N/A',
        'Product': o?.productName || 'N/A',
        'Machine': m?.machineCode || 'N/A',
        'Daily Target': target,
        'Actual Output': actual,
        'Accepted Qty': l.acceptedQuantity || 0,
        'Rejected / Scrap': l.rejectedQuantity || 0,
        'Variance': actual - target,
        'Efficiency %': target > 0 ? ((actual / target) * 100).toFixed(1) + '%' : '0%',
        'Downtime Mins': l.downtimeMinutes || 0,
        'Notes': l.notes || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logsData), 'Daily Output Logs');

    // 4. Holidays
    const holidaysData = holidays.map(h => ({
      'Date': h.dateStr || toLocalDateString(h.date),
      'Holiday Name': h.name
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(holidaysData), 'Factory Holidays');

    XLSX.writeFile(wb, `Production_Planning_Full_Report_${toLocalDateString(new Date())}.xlsx`);
    showToast('Comprehensive multi-sheet planning report exported to Excel!');
  };

  return (
    <Box sx={{ py: 1 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <SpeedIcon sx={{ color: '#6366f1' }} />
            Planning Analytics & Machine Load Tools
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Factory line capacity analytics, order fulfillment distributions, multi-sheet exports, and transactional maintenance.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExportExcel}
          sx={{ borderRadius: '8px', fontWeight: 600 }}
        >
          Export Full Planning Workbook
        </Button>
      </Box>

      <Stack spacing={3}>
        {/* Charts Row */}
        <Grid container spacing={3}>
          {/* Machine Daily Capacity Load */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', p: 1 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
                  Machine Daily Output Capacities (12h vs 24h)
                </Typography>
                <Box sx={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeMachines.map(m => ({
                      code: m.machineCode,
                      dailyCap: m.dailyCapacity || ((m.capacity || 0) * (m.operatingHours || 24)),
                      hours: m.operatingHours || 24
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="code" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <ChartTooltip contentStyle={{ borderRadius: 8 }} />
                      <Bar dataKey="dailyCap" name="Daily Capacity (units/day)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Order Status Distribution */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', p: 1 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
                  Orders Queue Breakdown
                </Typography>
                <Box sx={{ width: '100%', height: 260, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Pending Planning', value: orderStats.pending, color: '#ef4444' },
                          { name: 'Draft Sandbox', value: orderStats.draft, color: '#f59e0b' },
                          { name: 'Confirmed Live', value: orderStats.scheduled, color: '#10b981' },
                          { name: 'Completed', value: orderStats.completed, color: '#6366f1' },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#ef4444" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#10b981" />
                        <Cell fill="#6366f1" />
                      </Pie>
                      <ChartTooltip contentStyle={{ borderRadius: 8 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Database Maintenance & Transactional Data Reset Tool */}
        <Card sx={{ borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.3)', bgcolor: 'rgba(239, 68, 68, 0.02)' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
                <DeleteSweepIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#991b1b' }}>
                  Clean Irrelevant Transactional Records
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3, maxWidth: 700 }}>
                  Clear old test schedules, hourly production logs, daily production actuals, and historical analytics from Firebase while <strong>strictly preserving all Master Data</strong> (Plants, Machines, Categories, Holidays, Users, and Roles).
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<DeleteSweepIcon />}
                  onClick={() => setIsResetConfirmOpen(true)}
                  sx={{ mt: 2, borderRadius: '8px', fontWeight: 700, textTransform: 'none' }}
                >
                  Clear Transactional Data & Reset Orders
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* DIALOG: CONFIRM TRANSACTIONAL DATA CLEANUP */}
      <Dialog
        open={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#dc2626', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon />
          Clear Transactional Data?
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#334155' }}>
            This operation will permanently delete all:
          </Typography>
          <Box component="ul" sx={{ pl: 2.5, my: 1, color: '#64748b', fontSize: '0.85rem' }}>
            <li>Production Schedules & Plans</li>
            <li>Hourly & Daily Output Performance Logs</li>
            <li>Production & Downtime Analytics Records</li>
          </Box>
          <Typography variant="body2" sx={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircleIcon sx={{ fontSize: 16, color: '#059669' }} />
            All Masters (Plants, Machines, Categories, Holidays, Users) will be strictly preserved.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsResetConfirmOpen(false)} variant="outlined" sx={{ borderRadius: '8px' }}>
            Cancel
          </Button>
          <Button
            onClick={() => resetDataMutation.mutate()}
            variant="contained"
            color="error"
            disabled={resetDataMutation.isPending}
            sx={{ borderRadius: '8px', fontWeight: 700 }}
          >
            {resetDataMutation.isPending ? <CircularProgress size={22} color="inherit" /> : 'Yes, Clear & Reset'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
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
