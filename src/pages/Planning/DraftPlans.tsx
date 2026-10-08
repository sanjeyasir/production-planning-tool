import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getMachines,
  getProductionOrders,
  getProductionPlans,
  updateProductionPlan,
  deleteProductionPlan,
  updateProductionOrder,
  toLocalDateString,
  parseDate,
  type ProductionPlan
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
  Snackbar,
  Alert,
  Stack,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';

// Icons
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export const DraftPlans: React.FC = () => {
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

  // Filter draft plans
  const draftPlans = useMemo(() => {
    return plans.filter(p => p.type === 'DRAFT' || p.type === 'SIMULATED');
  }, [plans]);

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

  // Mutations
  const confirmDraftPlanMutation = useMutation({
    mutationFn: async (plan: ProductionPlan) => {
      await updateProductionPlan(plan.id, { type: 'CONFIRMED', status: 'PLANNED' });
      await updateProductionOrder(plan.orderId, { status: 'SCHEDULED' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      showToast('Plan officially confirmed and committed to production schedule!');
    },
    onError: (err: any) => showToast('Error confirming plan: ' + err.message, 'error')
  });

  const deletePlanMutation = useMutation({
    mutationFn: deleteProductionPlan,
    onSuccess: (_, deletedPlanId) => {
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      showToast('Scheduled plan deleted.');

      const plan = plans.find(p => p.id === deletedPlanId);
      if (plan) {
        const otherPlans = plans.filter(p => p.orderId === plan.orderId && p.id !== deletedPlanId);
        if (otherPlans.length === 0) {
          updateProductionOrder(plan.orderId, { status: 'PENDING' });
        }
      }
    }
  });

  return (
    <Box sx={{ py: 1 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
          <HourglassEmptyIcon sx={{ color: '#f59e0b' }} />
          Draft Plans & Approvals Hub
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
          Review unconfirmed sandbox simulations, check projected delivery dates, and confirm live machine commitments.
        </Typography>
      </Box>

      {/* Informational Banner */}
      <Alert
        severity="info"
        variant="outlined"
        icon={<HourglassEmptyIcon />}
        sx={{ borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.04)', borderColor: 'rgba(99, 102, 241, 0.3)', mb: 3 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4338ca' }}>
          Sandbox Draft Rules
        </Typography>
        <Typography variant="body2" sx={{ color: '#475569', mt: 0.2 }}>
          Draft plans do not commit factory machine lines or lock production capacity. Associated orders remain in <strong>Pending Planning</strong> until you confirm them below.
        </Typography>
      </Alert>

      {/* Draft Plans Table Card */}
      <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Pending Draft Plans ({draftPlans.length})
            </Typography>
            {draftPlans.length > 0 && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<CheckCircleIcon />}
                onClick={() => {
                  draftPlans.forEach(p => confirmDraftPlanMutation.mutate(p));
                }}
                sx={{ borderRadius: '8px', fontWeight: 700 }}
              >
                Confirm All Drafts
              </Button>
            )}
          </Box>

          <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order Number</TableCell>
                  <TableCell>Product Name</TableCell>
                  <TableCell>Assigned Machine</TableCell>
                  <TableCell align="center">Daily Schedule</TableCell>
                  <TableCell align="right">Daily Target Rate</TableCell>
                  <TableCell align="center">Planned Horizon</TableCell>
                  <TableCell align="center">Due Date Match</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {draftPlans.length > 0 ? (
                  draftPlans.map((plan) => {
                    const order = orders.find(o => o.id === plan.orderId);
                    const machine = machines.find(m => m.id === plan.machineId);
                    const dueDate = order ? parseDate(order.dueDate) : null;
                    const endDate = parseDate(plan.endDate);
                    const isLate = dueDate && endDate > dueDate;

                    return (
                      <TableRow key={plan.id} hover>
                        <TableCell sx={{ fontWeight: 800, color: '#d97706' }}>
                          {order?.orderNumber || 'Unknown'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{order?.productName || 'N/A'}</TableCell>
                        <TableCell>{machine ? `${machine.machineCode} - ${machine.machineName}` : 'N/A'}</TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={`${plan.operatingHoursPerDay || 24} Hours / Day`}
                            sx={{ fontWeight: 700, fontSize: '0.675rem', bgcolor: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5' }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: '#10b981' }}>
                          {(plan.plannedDailyRate || 0).toLocaleString()} units/day
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: '#334155' }}>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                            {toLocalDateString(plan.startDate)}
                            <ArrowForwardIcon sx={{ fontSize: 13, color: '#94a3b8' }} />
                            {toLocalDateString(plan.endDate)} ({plan.totalPlannedDays || 0} days)
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            icon={isLate ? <WarningIcon sx={{ fontSize: '14px !important' }} /> : <CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                            label={isLate ? 'Projected Late' : 'On-Time'}
                            sx={{
                              fontWeight: 800,
                              fontSize: '0.675rem',
                              bgcolor: isLate ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: isLate ? '#dc2626' : '#059669'
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => confirmDraftPlanMutation.mutate(plan)}
                              sx={{ fontSize: '0.75rem', py: 0.4, px: 1.5, borderRadius: '6px', fontWeight: 700 }}
                            >
                              Confirm & Lock Plan
                            </Button>
                            <Tooltip title="Discard Draft">
                              <IconButton
                                onClick={() => {
                                  if (confirm('Discard this draft simulation?')) {
                                    deletePlanMutation.mutate(plan.id);
                                  }
                                }}
                                size="small"
                                sx={{ color: '#ef4444' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>
                      No draft plans awaiting confirmation. Use the Plan Generator on the Orders page to simulate new job schedules.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

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
