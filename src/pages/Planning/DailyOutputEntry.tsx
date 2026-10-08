import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getMachines,
  getProductionOrders,
  getProductionPlans,
  getDailyProductions,
  createDailyProduction,
  deleteDailyProduction,
  toLocalDateString,
  parseLocalDate,
  type ProductionPlan
} from '../../services/db';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  TextField,
  Snackbar,
  Alert,
  Stack,
  Chip,
  Paper,
  CircularProgress,
  LinearProgress
} from '@mui/material';

// Icons
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import DownloadIcon from '@mui/icons-material/Download';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TableViewIcon from '@mui/icons-material/TableView';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';

// Handsontable
import { HotTable } from '@handsontable/react';
import * as XLSX from 'xlsx';

export const DailyOutputEntry: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, profile, tenant } = useAuthStore();
  const tenantId = tenant?.id || '';
  const operatorName = profile?.name || user?.displayName || profile?.email || user?.email || 'Operator';

  // ----------------------------------------------------
  // DATE RANGE FILTER STATE (Default: Today)
  // ----------------------------------------------------
  const todayStr = toLocalDateString(new Date());
  const [fromDateStr, setFromDateStr] = useState<string>(todayStr);
  const [toDateStr, setToDateStr] = useState<string>(todayStr);

  // Selected Active Job from Horizontal Overflow Row (null means All Jobs)
  const [selectedJobKey, setSelectedJobKey] = useState<string | null>(null);

  // ----------------------------------------------------
  // QUERIES
  // ----------------------------------------------------
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

  const { data: dailyLogs = [], isLoading: loadingDailyLogs } = useQuery({
    queryKey: ['dailyProductions', tenantId],
    queryFn: () => getDailyProductions(tenantId),
    enabled: !!tenantId,
  });

  // Confirmed live plans
  const confirmedPlans = useMemo(() => {
    return plans.filter(p => p.type === 'CONFIRMED' && p.status !== 'CANCELLED');
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

  // Helper to format Firestore timestamp/Date to human readable timestamp
  const formatTimestamp = (val: any): string => {
    if (!val) return '—';
    let d: Date;
    if (val.toDate && typeof val.toDate === 'function') {
      d = val.toDate();
    } else if (val instanceof Date) {
      d = val;
    } else if (typeof val === 'string' || typeof val === 'number') {
      d = new Date(val);
    } else if (val.seconds) {
      d = new Date(val.seconds * 1000);
    } else {
      return '—';
    }
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // ----------------------------------------------------
  // EXTRACT ALL ACTIVE CONFIRMED JOBS IN SELECTED DATE RANGE
  // ----------------------------------------------------
  const activeScheduledJobs = useMemo(() => {
    const list: Array<{
      key: string;
      planId: string;
      plan: ProductionPlan;
      orderId: string;
      orderNumber: string;
      productName: string;
      machineId: string;
      machineCode: string;
      machineName: string;
      dateStr: string;
      targetVolume: number;
      actualProduced: number;
      acceptedQuantity: number;
      rejectedQuantity: number;
      logsCount: number;
    }> = [];

    if (!fromDateStr || !toDateStr) return list;

    const start = parseLocalDate(fromDateStr);
    const end = parseLocalDate(toDateStr);
    if (start > end) return list;

    const cur = new Date(start);
    while (cur <= end) {
      const dStr = toLocalDateString(cur);

      confirmedPlans.forEach(plan => {
        const pStart = toLocalDateString(plan.startDate);
        const pEnd = toLocalDateString(plan.endDate);

        if (dStr >= pStart && dStr <= pEnd) {
          const hasOverrides = !!(plan.dailyVolumeOverrides && Object.keys(plan.dailyVolumeOverrides).length > 0);
          const dayTarget = hasOverrides
            ? (plan.dailyVolumeOverrides && plan.dailyVolumeOverrides[dStr] !== undefined
                ? Number(plan.dailyVolumeOverrides[dStr]) || 0
                : 0)
            : (Number(plan.plannedDailyRate) || 0);

          if (dayTarget > 0) {
            const order = orders.find(o => o.id === plan.orderId);
            const machine = machines.find(m => m.id === plan.machineId);
            const matchingLogs = dailyLogs.filter(
              l => l.planId === plan.id && (l.dateStr === dStr || toLocalDateString(l.date) === dStr)
            );

            const actualProduced = matchingLogs.reduce((sum, l) => sum + (Number(l.actualVolume) || 0), 0);
            const acceptedQuantity = matchingLogs.reduce((sum, l) => sum + (Number(l.acceptedQuantity) || 0), 0);
            const rejectedQuantity = matchingLogs.reduce((sum, l) => sum + (Number(l.rejectedQuantity) || 0), 0);

            list.push({
              key: `${plan.id}_${dStr}`,
              planId: plan.id,
              plan,
              orderId: plan.orderId,
              orderNumber: order?.orderNumber || 'Order',
              productName: order?.productName || 'Planned Item',
              machineId: plan.machineId,
              machineCode: machine?.machineCode || 'Line',
              machineName: machine?.machineName || 'Machine',
              dateStr: dStr,
              targetVolume: dayTarget,
              actualProduced,
              acceptedQuantity,
              rejectedQuantity,
              logsCount: matchingLogs.length
            });
          }
        }
      });

      cur.setDate(cur.getDate() + 1);
    }

    return list;
  }, [confirmedPlans, orders, machines, dailyLogs, fromDateStr, toDateStr]);

  // Active Selected Job Details
  const activeJob = useMemo(() => {
    if (!selectedJobKey) return null;
    return activeScheduledJobs.find(j => j.key === selectedJobKey) || null;
  }, [selectedJobKey, activeScheduledJobs]);

  // ----------------------------------------------------
  // INLINE ENTRY FORM STATE (Bound to Active Selected Job)
  // ----------------------------------------------------
  const [entryForm, setEntryForm] = useState({
    acceptedQuantity: '' as number | '',
    rejectedQuantity: 0 as number | '',
    downtimeMinutes: 0 as number | '',
    notes: ''
  });

  // Prepopulate form when active job changes
  React.useEffect(() => {
    if (activeJob) {
      const remainingTarget = Math.max(0, activeJob.targetVolume - activeJob.actualProduced);
      setEntryForm({
        acceptedQuantity: remainingTarget > 0 ? remainingTarget : '',
        rejectedQuantity: 0,
        downtimeMinutes: 0,
        notes: ''
      });
    }
  }, [activeJob?.key, activeJob?.targetVolume, activeJob?.actualProduced]);

  // ----------------------------------------------------
  // MUTATIONS: CREATE & DELETE LOGS
  // ----------------------------------------------------
  const saveOutputMutation = useMutation({
    mutationFn: async () => {
      if (!activeJob) throw new Error('Please select an active scheduled job first.');
      const accepted = Number(entryForm.acceptedQuantity) || 0;
      const rejected = Number(entryForm.rejectedQuantity) || 0;
      const actual = accepted + rejected;

      if (actual <= 0) {
        throw new Error('Please enter a valid accepted or rejected quantity greater than 0.');
      }

      await createDailyProduction({
        tenantId,
        planId: activeJob.planId,
        orderId: activeJob.orderId,
        machineId: activeJob.machineId,
        date: parseLocalDate(activeJob.dateStr),
        dateStr: activeJob.dateStr,
        targetVolume: activeJob.targetVolume,
        actualVolume: actual,
        acceptedQuantity: accepted,
        rejectedQuantity: rejected,
        downtimeMinutes: Number(entryForm.downtimeMinutes || 0),
        notes: entryForm.notes,
        enteredBy: operatorName,
        enteredByEmail: profile?.email || user?.email || ''
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyProductions', tenantId] });
      setEntryForm({
        acceptedQuantity: '',
        rejectedQuantity: 0,
        downtimeMinutes: 0,
        notes: ''
      });
      showToast('Production output log recorded successfully!', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteLogMutation = useMutation({
    mutationFn: deleteDailyProduction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyProductions', tenantId] });
      showToast('Output log record removed.', 'info');
    },
    onError: (err: any) => showToast('Failed to delete log: ' + err.message, 'error')
  });

  // ----------------------------------------------------
  // FILTERED DAILY LOGS FOR HANDSONTABLE
  // ----------------------------------------------------
  const filteredDailyLogs = useMemo(() => {
    return dailyLogs.filter(log => {
      const logDateStr = log.dateStr || toLocalDateString(log.date);

      // 1. Date Range Filter
      if (fromDateStr && logDateStr < fromDateStr) return false;
      if (toDateStr && logDateStr > toDateStr) return false;

      // 2. Specific Job Selection Filter
      if (activeJob) {
        if (log.planId !== activeJob.planId) return false;
        if (logDateStr !== activeJob.dateStr) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort by newest createdAt or date descending
      const tA = a.createdAt ? new Date((a.createdAt as any).toDate ? (a.createdAt as any).toDate() : a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date((b.createdAt as any).toDate ? (b.createdAt as any).toDate() : b.createdAt).getTime() : 0;
      return tB - tA;
    });
  }, [dailyLogs, fromDateStr, toDateStr, activeJob]);

  // Handsontable Data Formatting
  const hotData = useMemo(() => {
    return filteredDailyLogs.map((log, idx) => {
      const plan = plans.find(p => p.id === log.planId);
      const order = orders.find(o => o.id === (log.orderId || plan?.orderId));
      const machine = machines.find(m => m.id === (log.machineId || plan?.machineId));
      const target = log.targetVolume || 0;
      const actual = log.actualVolume || 0;
      const accepted = log.acceptedQuantity || 0;
      const rejected = log.rejectedQuantity || 0;
      const downtime = log.downtimeMinutes || 0;
      const eff = target > 0 ? (actual / target) * 100 : 0;
      const timestampStr = formatTimestamp(log.createdAt || log.updatedAt);
      const dateStr = log.dateStr || toLocalDateString(log.date);

      const enteredByStr = log.enteredBy || log.enteredByEmail || 'Operator';

      return {
        rowNum: idx + 1,
        id: log.id,
        timestamp: timestampStr,
        enteredBy: enteredByStr,
        productionDate: dateStr,
        orderNumber: order?.orderNumber || 'N/A',
        productName: order?.productName || 'N/A',
        machine: machine ? `${machine.machineCode} - ${machine.machineName}` : 'N/A',
        targetVolume: target,
        acceptedQuantity: accepted,
        rejectedQuantity: rejected,
        actualVolume: actual,
        efficiency: eff,
        downtimeMinutes: downtime,
        notes: log.notes || '—',
        actions: 'DELETE'
      };
    });
  }, [filteredDailyLogs, plans, orders, machines]);

  // Export to Excel
  const handleExportExcel = () => {
    const logsData = filteredDailyLogs.map(l => {
      const p = plans.find(plan => plan.id === l.planId);
      const o = orders.find(ord => ord.id === (l.orderId || p?.orderId));
      const m = machines.find(mach => mach.id === (l.machineId || p?.machineId));
      const target = l.targetVolume || 0;
      const actual = l.actualVolume || 0;
      return {
        'Logged Timestamp': formatTimestamp(l.createdAt || l.updatedAt),
        'Entered By': l.enteredBy || l.enteredByEmail || 'Operator',
        'Production Date': l.dateStr || toLocalDateString(l.date),
        'Order Number': o?.orderNumber || 'N/A',
        'Product': o?.productName || 'N/A',
        'Machine Line': m?.machineCode || 'N/A',
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

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logsData), 'Daily Output Logs');
    XLSX.writeFile(wb, `Daily_Production_Output_${fromDateStr}_to_${toDateStr}.xlsx`);
    showToast('Daily output logs exported to Excel!');
  };

  return (
    <Box sx={{ py: 1 }}>
      {/* HEADER WITH CONTROLS BAR: Date Range From & To, Preset Filters */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon sx={{ color: '#10b981', fontSize: 28 }} />
            Daily Production Output & Actuals Entry
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant={fromDateStr === todayStr && toDateStr === todayStr ? 'contained' : 'outlined'}
            onClick={() => {
              setFromDateStr(todayStr);
              setToDateStr(todayStr);
            }}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
          >
            Today's Orders
          </Button>

          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              const start = new Date();
              const end = new Date();
              end.setDate(start.getDate() + 6);
              setFromDateStr(toLocalDateString(start));
              setToDateStr(toLocalDateString(end));
            }}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            Next 7 Days
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportExcel}
            sx={{ borderRadius: '8px', fontWeight: 600, textTransform: 'none' }}
          >
            Export Excel
          </Button>
        </Stack>
      </Box>

      {/* CONTROLS BAR: DATE RANGE FROM & TO */}
      <Card sx={{ mb: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <TextField
                label="Date Range: From"
                type="date"
                size="small"
                fullWidth
                value={fromDateStr}
                onChange={(e) => {
                  setFromDateStr(e.target.value);
                  setSelectedJobKey(null);
                }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <TextField
                label="Date Range: To"
                type="date"
                size="small"
                fullWidth
                value={toDateStr}
                onChange={(e) => {
                  setToDateStr(e.target.value);
                  setSelectedJobKey(null);
                }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, gap: 1.5 }}>
                <Chip
                  icon={<CalendarMonthIcon sx={{ fontSize: '15px !important' }} />}
                  label={`Showing: ${fromDateStr === toDateStr ? `Single Day (${fromDateStr})` : `${fromDateStr} → ${toDateStr}`}`}
                  size="small"
                  sx={{ fontWeight: 700, bgcolor: '#e0e7ff', color: '#3730a3' }}
                />
                <Chip
                  icon={<PrecisionManufacturingIcon sx={{ fontSize: '15px !important' }} />}
                  label={`${activeScheduledJobs.length} Planned Confirmed Job(s)`}
                  size="small"
                  sx={{ fontWeight: 700, bgcolor: '#dcfce7', color: '#166534' }}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* SECTION 1: ACTIVE CONFIRMED SCHEDULES (HORIZONTAL OVERFLOW ROW) */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 0.8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <PrecisionManufacturingIcon sx={{ color: '#6366f1', fontSize: 18 }} />
            Active Confirmed Schedules ({activeScheduledJobs.length})
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Click any scheduled job card to log output directly and filter logs history below.
          </Typography>
        </Box>

        {/* Horizontal Scrollable Row Container */}
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            overflowX: 'auto',
            pb: 1.5,
            pt: 0.5,
            px: 0.5,
            '::-webkit-scrollbar': { height: 8 },
            '::-webkit-scrollbar-track': { bgcolor: '#f1f5f9', borderRadius: 4 },
            '::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 4 }
          }}
        >
          {/* Card 0: All Jobs selector */}
          <Paper
            onClick={() => setSelectedJobKey(null)}
            sx={{
              minWidth: 180,
              maxWidth: 200,
              p: 1.8,
              borderRadius: '12px',
              border: selectedJobKey === null ? '2px solid #4f46e5' : '1px solid #e2e8f0',
              bgcolor: selectedJobKey === null ? 'rgba(99, 102, 241, 0.08)' : '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: '#6366f1', transform: 'translateY(-2px)' }
            }}
          >
            <Box>
              <Chip
                label="ALL JOBS"
                size="small"
                sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, bgcolor: selectedJobKey === null ? '#4f46e5' : '#f1f5f9', color: selectedJobKey === null ? '#fff' : '#475569', mb: 1 }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                All Date Range Logs
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                {filteredDailyLogs.length} total entries recorded
              </Typography>
            </Box>
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" sx={{ color: '#4f46e5', fontWeight: 700, fontSize: '0.72rem' }}>
                {selectedJobKey === null ? '✓ Active Filter' : 'Click to View All'}
              </Typography>
            </Box>
          </Paper>

          {/* Individual Job Cards */}
          {activeScheduledJobs.length > 0 ? (
            activeScheduledJobs.map((job) => {
              const isSelected = selectedJobKey === job.key;
              const isComplete = job.actualProduced >= job.targetVolume;
              const progressPct = job.targetVolume > 0 ? Math.min(100, Math.round((job.actualProduced / job.targetVolume) * 100)) : 0;

              return (
                <Paper
                  key={job.key}
                  onClick={() => setSelectedJobKey(job.key)}
                  sx={{
                    minWidth: 260,
                    maxWidth: 290,
                    p: 1.8,
                    borderRadius: '12px',
                    border: isSelected ? '2px solid #10b981' : '1px solid #e2e8f0',
                    bgcolor: isSelected ? 'rgba(16, 185, 129, 0.06)' : '#ffffff',
                    boxShadow: isSelected ? '0 4px 12px rgba(16, 185, 129, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    '&:hover': { borderColor: '#10b981', transform: 'translateY(-2px)' }
                  }}
                >
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#4f46e5' }}>
                        {job.machineCode}
                      </Typography>
                      <Chip
                        label={job.dateStr}
                        size="small"
                        sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                      />
                    </Box>

                    <Typography variant="subtitle2" noWrap sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {job.orderNumber}
                    </Typography>
                    <Typography variant="caption" noWrap sx={{ color: '#475569', display: 'block', fontWeight: 600 }}>
                      {job.productName}
                    </Typography>

                    <Box sx={{ mt: 1, p: 0.8, borderRadius: '8px', bgcolor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.675rem' }}>
                          Target: <strong>{job.targetVolume.toLocaleString()} u</strong>
                        </Typography>
                        <Typography variant="caption" sx={{ color: isComplete ? '#16a34a' : '#4f46e5', fontWeight: 800, fontSize: '0.7rem' }}>
                          {progressPct}% ({job.actualProduced.toLocaleString()} u)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={progressPct}
                        sx={{ height: 5, borderRadius: 3, bgcolor: '#e2e8f0' }}
                        color={isComplete ? 'success' : 'primary'}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip
                      size="small"
                      label={`${job.logsCount} Log Entry(ies)`}
                      sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: job.logsCount > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)', color: job.logsCount > 0 ? '#059669' : '#d97706' }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 800, color: isSelected ? '#059669' : '#64748b', fontSize: '0.72rem' }}>
                      {isSelected ? '✓ Selected' : 'Click to Log'}
                    </Typography>
                  </Box>
                </Paper>
              );
            })
          ) : (
            <Paper sx={{ p: 2.5, borderRadius: '12px', border: '1px dashed #cbd5e1', bgcolor: '#f8fafc', textAlign: 'center', width: '100%' }}>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                No active confirmed production orders scheduled for the selected date range ({fromDateStr} → {toDateStr}).
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>

      {/* SECTION 2: INLINE QUICK OUTPUT ENTRY PANEL (WHEN JOB IS SELECTED) */}
      {activeJob && (
        <Card sx={{ mb: 3, borderRadius: '14px', border: '1.5px solid #10b981', bgcolor: '#ffffff', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.08)' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PlaylistAddCheckIcon sx={{ color: '#10b981' }} />
                  Record Output for: {activeJob.orderNumber} ({activeJob.productName})
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Machine: <strong>{activeJob.machineCode} ({activeJob.machineName})</strong> • Production Date: <strong>{activeJob.dateStr}</strong> • Daily Target: <strong>{activeJob.targetVolume.toLocaleString()} Units</strong> • Produced So Far: <strong>{activeJob.actualProduced.toLocaleString()} Units</strong>
                </Typography>
              </Box>

              <Chip
                label={`Remaining: ${(Math.max(0, activeJob.targetVolume - activeJob.actualProduced)).toLocaleString()} u`}
                color="primary"
                sx={{ fontWeight: 800 }}
              />
            </Box>

            <form onSubmit={(e) => { e.preventDefault(); saveOutputMutation.mutate(); }}>
              <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    label="Accepted / Good Units"
                    type="number"
                    size="small"
                    required
                    fullWidth
                    value={entryForm.acceptedQuantity}
                    onChange={(e) => setEntryForm({ ...entryForm, acceptedQuantity: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                    placeholder="e.g. 500"
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <TextField
                    label="Scrap / Rejected Units"
                    type="number"
                    size="small"
                    fullWidth
                    value={entryForm.rejectedQuantity}
                    onChange={(e) => setEntryForm({ ...entryForm, rejectedQuantity: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <TextField
                    label="Downtime (Minutes)"
                    type="number"
                    size="small"
                    fullWidth
                    value={entryForm.downtimeMinutes}
                    onChange={(e) => setEntryForm({ ...entryForm, downtimeMinutes: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    label="Operator / Shift Notes"
                    size="small"
                    fullWidth
                    placeholder="Optional operator notes"
                    value={entryForm.notes}
                    onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 2 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={saveOutputMutation.isPending || (Number(entryForm.acceptedQuantity) + Number(entryForm.rejectedQuantity) <= 0)}
                    sx={{
                      borderRadius: '8px',
                      fontWeight: 700,
                      py: 0.9,
                      textTransform: 'none',
                      bgcolor: '#10b981',
                      '&:hover': { bgcolor: '#059669' }
                    }}
                  >
                    {saveOutputMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Record Output'}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      )}

      {/* SECTION 3: VIEW-ONLY HANDSONTABLE OUTPUT LOGS HISTORY WITH TIMESTAMPS */}
      <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <TableViewIcon sx={{ color: '#6366f1' }} />
                Production Output History Log ({hotData.length} Records)
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                {activeJob
                  ? `Filtered to active job: ${activeJob.orderNumber} on ${activeJob.machineCode} (${activeJob.dateStr})`
                  : `Showing all logs for date range: ${fromDateStr} to ${toDateStr}`}
              </Typography>
            </Box>

            {activeJob && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setSelectedJobKey(null)}
                sx={{ borderRadius: '6px', fontSize: '0.75rem', textTransform: 'none', fontWeight: 600 }}
              >
                Clear Job Filter (Show All Logs)
              </Button>
            )}
          </Box>

          {/* Handsontable View-Only Grid */}
          <Box
            sx={{
              width: '100%',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              '& .handsontable': { fontFamily: 'inherit', fontSize: '0.85rem' },
              '& .htCore th': { bgcolor: '#f8fafc', color: '#0f172a', fontWeight: 700, py: 1 },
              '& .htCore td': { py: 0.8, color: '#334155' }
            }}
          >
            {loadingDailyLogs ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress size={28} />
              </Box>
            ) : hotData.length > 0 ? (
              <HotTable
                data={hotData}
                readOnly={true}
                colHeaders={[
                  '#',
                  'Logged Timestamp',
                  'Entered By',
                  'Run Date',
                  'Order Number',
                  'Product Name',
                  'Machine Line',
                  'Day Target',
                  'Accepted Qty',
                  'Scrap / Rej',
                  'Actual Total',
                  'Yield / Eff %',
                  'Downtime',
                  'Shift Notes',
                  'Actions'
                ]}
                columns={[
                  { data: 'rowNum', readOnly: true, width: 40, className: 'htCenter htMiddle' },
                  {
                    data: 'timestamp',
                    readOnly: true,
                    width: 155,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any) => {
                      td.innerHTML = `<span style="font-weight: 700; color: #4338ca; font-size: 11px;">${value || '—'}</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'enteredBy',
                    readOnly: true,
                    width: 125,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any) => {
                      td.innerHTML = `<span style="font-weight: 700; color: #0f172a; font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 6px;">${value || 'Operator'}</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  { data: 'productionDate', readOnly: true, width: 95, className: 'htCenter htMiddle font-semibold' },
                  { data: 'orderNumber', readOnly: true, width: 120, className: 'htCenter htMiddle font-semibold' },
                  { data: 'productName', readOnly: true, width: 160, className: 'htMiddle' },
                  { data: 'machine', readOnly: true, width: 130, className: 'htMiddle font-semibold' },
                  {
                    data: 'targetVolume',
                    readOnly: true,
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 95,
                    className: 'htCenter htMiddle'
                  },
                  {
                    data: 'acceptedQuantity',
                    readOnly: true,
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 100,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any) => {
                      td.innerHTML = `<span style="color: #166534; font-weight: 700;">${(Number(value) || 0).toLocaleString()} u</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'rejectedQuantity',
                    readOnly: true,
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 90,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any) => {
                      const val = Number(value) || 0;
                      td.innerHTML = `<span style="color: ${val > 0 ? '#dc2626' : '#94a3b8'}; font-weight: ${val > 0 ? '700' : '500'};">${val.toLocaleString()} u</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'actualVolume',
                    readOnly: true,
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 105,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any) => {
                      td.innerHTML = `<span style="font-weight: 800; color: #0f172a;">${(Number(value) || 0).toLocaleString()} u</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'efficiency',
                    readOnly: true,
                    width: 100,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any) => {
                      const eff = Number(value) || 0;
                      let bg = 'rgba(239, 68, 68, 0.1)';
                      let color = '#dc2626';
                      if (eff >= 95) { bg = 'rgba(16, 185, 129, 0.1)'; color = '#059669'; }
                      else if (eff >= 80) { bg = 'rgba(245, 158, 11, 0.1)'; color = '#d97706'; }

                      td.innerHTML = `<span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; background: ${bg}; color: ${color};">${eff.toFixed(1)}%</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'downtimeMinutes',
                    readOnly: true,
                    width: 90,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any) => {
                      const val = Number(value) || 0;
                      td.innerHTML = `<span style="color: ${val > 0 ? '#b45309' : '#94a3b8'}; font-weight: ${val > 0 ? '700' : '500'};">${val > 0 ? `${val} mins` : '—'}</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  { data: 'notes', readOnly: true, width: 140, className: 'htMiddle' },
                  {
                    data: 'actions',
                    readOnly: true,
                    width: 80,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, _value: any) => {
                      td.innerHTML = `
                        <button type="button" class="btn-delete-log" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 6px; padding: 2px 6px; font-weight: 700; font-size: 11px; cursor: pointer;">
                          Delete
                        </button>
                      `;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  }
                ]}
                afterOnCellMouseDown={(event: any, coords: any) => {
                  if (coords.col === 14 && coords.row >= 0) {
                    event.stopImmediatePropagation();
                    const targetEl = event.target as HTMLElement;
                    const logObj = filteredDailyLogs[coords.row];
                    if (!logObj) return;

                    if (targetEl.classList.contains('btn-delete-log')) {
                      if (confirm('Delete this output log entry?')) {
                        deleteLogMutation.mutate(logObj.id);
                      }
                    }
                  }
                }}
                rowHeaders={true}
                height="auto"
                width="100%"
                colWidths={[40, 155, 125, 95, 120, 160, 130, 95, 100, 90, 105, 100, 90, 140, 80]}
                stretchH="all"
                licenseKey="non-commercial-and-evaluation"
              />
            ) : (
              <Box sx={{ py: 6, textAlign: 'center', color: '#64748b' }}>
                No output logs found for the selected filter.
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Toast Notification */}
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

export default DailyOutputEntry;
