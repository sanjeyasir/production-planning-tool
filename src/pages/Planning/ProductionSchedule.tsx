import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getMachines,
  getProductionOrders,
  getProductionCategories,
  getHolidays,
  getProductionPlans,
  getDailyProductions,
  getDowntimeRecords,
  createDailyProduction,
  shiftMachinePlansByWorkingDays,
  toLocalDateString,
  parseLocalDate,
  type Machine,
  type ProductionPlan,
  type Holiday
} from '../../services/db';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Chip,
  LinearProgress,
  CircularProgress,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';

// Icons
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CategoryIcon from '@mui/icons-material/Category';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';

export const ProductionSchedule: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, profile, tenant } = useAuthStore();
  const tenantId = tenant?.id || '';

  // Queries
  const { data: machines = [] } = useQuery({
    queryKey: ['machines', tenantId],
    queryFn: () => getMachines(tenantId),
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['productionCategories', tenantId],
    queryFn: () => getProductionCategories(tenantId),
    enabled: !!tenantId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['productionOrders', tenantId],
    queryFn: () => getProductionOrders(tenantId),
    enabled: !!tenantId,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', tenantId],
    queryFn: () => getHolidays(tenantId),
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

  const { data: downtimeRecords = [] } = useQuery({
    queryKey: ['downtimeRecords', tenantId],
    queryFn: () => getDowntimeRecords(tenantId),
    enabled: !!tenantId,
  });

  const activeMachines = useMemo(() => {
    return machines.filter(m => m.status === 'ACTIVE');
  }, [machines]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => {
      map[c.id] = c.name;
    });
    return map;
  }, [categories]);

  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('all');
  const [startDateStr, setStartDateStr] = useState<string>(toLocalDateString(new Date()));
  const [timelineDaysCount, setTimelineDaysCount] = useState<number>(14);

  // Available machine options matching the selected category
  const filteredMachinesForSelect = useMemo(() => {
    if (selectedCategoryId === 'all') return activeMachines;
    if (selectedCategoryId === 'uncategorized') return activeMachines.filter(m => !m.categoryId || !categoryMap[m.categoryId]);
    return activeMachines.filter(m => m.categoryId === selectedCategoryId);
  }, [activeMachines, selectedCategoryId, categoryMap]);

  // Group active machines by Category for category-machine wise presentation
  const groupedMachinesByCategory = useMemo(() => {
    const filtered = activeMachines.filter(m => {
      if (selectedCategoryId !== 'all') {
        if (selectedCategoryId === 'uncategorized') {
          if (m.categoryId && categoryMap[m.categoryId]) return false;
        } else if (m.categoryId !== selectedCategoryId) {
          return false;
        }
      }
      if (selectedMachineId !== 'all' && m.id !== selectedMachineId) return false;
      return true;
    });

    const groups: Array<{
      categoryId: string;
      categoryName: string;
      machines: typeof activeMachines;
      totalDailyCapacity: number;
    }> = [];

    // 1. Group by existing categories
    categories.forEach(cat => {
      if (selectedCategoryId !== 'all' && selectedCategoryId !== cat.id) return;
      const machs = filtered.filter(m => m.categoryId === cat.id);
      if (machs.length > 0) {
        const totalDailyCapacity = machs.reduce((sum, m) => {
          const op = Number(m.operatingHours) || 24;
          return sum + (Number(m.dailyCapacity) || ((Number(m.capacity) || 0) * op));
        }, 0);
        groups.push({
          categoryId: cat.id,
          categoryName: cat.name,
          machines: machs,
          totalDailyCapacity
        });
      }
    });

    // 2. Uncategorized machines
    const uncategorized = filtered.filter(m => !m.categoryId || !categoryMap[m.categoryId]);
    if (uncategorized.length > 0 && (selectedCategoryId === 'all' || selectedCategoryId === 'uncategorized')) {
      const totalDailyCapacity = uncategorized.reduce((sum, m) => {
        const op = Number(m.operatingHours) || 24;
        return sum + (Number(m.dailyCapacity) || ((Number(m.capacity) || 0) * op));
      }, 0);
      groups.push({
        categoryId: 'uncategorized',
        categoryName: 'General / Uncategorized Operations',
        machines: uncategorized,
        totalDailyCapacity
      });
    }

    return groups;
  }, [activeMachines, categories, selectedCategoryId, selectedMachineId, categoryMap]);

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

  // Quick Daily Log Dialog
  const [isDailyLogDialogOpen, setIsDailyLogDialogOpen] = useState(false);
  const [dailyLogForm, setDailyLogForm] = useState({
    planId: '',
    orderId: '',
    machineId: '',
    dateStr: toLocalDateString(new Date()),
    targetVolume: 0,
    cumulativeAlreadyLogged: 0,
    logsCount: 0,
    orderNumber: '',
    productName: '',
    machineCode: '',
    acceptedQuantity: '' as number | '',
    rejectedQuantity: 0 as number | '',
    downtimeMinutes: 0 as number | '',
    notes: ''
  });

  const saveDailyLogMutation = useMutation({
    mutationFn: async (data: typeof dailyLogForm) => {
      const accepted = Number(data.acceptedQuantity) || 0;
      const rejected = Number(data.rejectedQuantity) || 0;
      const actual = accepted + rejected;

      if (actual <= 0) {
        throw new Error('Please enter accepted or rejected quantity greater than 0.');
      }

      const operatorName = profile?.name || user?.displayName || profile?.email || user?.email || 'Operator';
      await createDailyProduction({
        tenantId,
        planId: data.planId,
        orderId: data.orderId,
        machineId: data.machineId,
        date: parseLocalDate(data.dateStr),
        dateStr: data.dateStr,
        targetVolume: Number(data.targetVolume),
        actualVolume: actual,
        acceptedQuantity: accepted,
        rejectedQuantity: rejected,
        downtimeMinutes: Number(data.downtimeMinutes || 0),
        notes: data.notes,
        enteredBy: operatorName,
        enteredByEmail: profile?.email || user?.email || ''
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyProductions', tenantId] });
      setIsDailyLogDialogOpen(false);
      showToast('Daily production output logged successfully', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  // Shift Machine Orders Modal State (Bidirectional: Forward +1 or Left -1 Day)
  const [shiftOrdersModal, setShiftOrdersModal] = useState<{
    open: boolean;
    machine: Machine | null;
    fromDateStr: string;
    direction: 'forward' | 'backward';
    affectedPlans: ProductionPlan[];
    reason: string;
  }>({
    open: false,
    machine: null,
    fromDateStr: '',
    direction: 'forward',
    affectedPlans: [],
    reason: 'Operational delay / Line stoppage'
  });

  const shiftMachineOrdersMutation = useMutation({
    mutationFn: async () => {
      if (!shiftOrdersModal.machine || !shiftOrdersModal.fromDateStr) {
        throw new Error('Please select a valid machine and start date.');
      }
      return await shiftMachinePlansByWorkingDays({
        machineId: shiftOrdersModal.machine.id,
        fromDateStr: shiftOrdersModal.fromDateStr,
        direction: shiftOrdersModal.direction,
        holidays,
        plans
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      setShiftOrdersModal(prev => ({ ...prev, open: false }));
      const dirText = shiftOrdersModal.direction === 'forward' ? 'forward (+1 day)' : 'to the left / backward (-1 day)';
      if (res && res.shiftedCount > 0) {
        showToast(`Shifted ${res.shiftedCount} active plan(s) on ${shiftOrdersModal.machine?.machineCode} ${dirText} (skipping factory holidays).`, 'success');
      } else {
        showToast('No active plans required shifting from this date.', 'info');
      }
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const handleOpenShiftModal = (machine: Machine, fromDateStr: string, direction: 'forward' | 'backward' = 'forward') => {
    const affected = plans.filter(p => {
      if (p.machineId !== machine.id || p.status === 'CANCELLED') return false;
      const pEnd = toLocalDateString(p.endDate);
      return pEnd >= fromDateStr;
    });

    setShiftOrdersModal({
      open: true,
      machine,
      fromDateStr,
      direction,
      affectedPlans: affected,
      reason: direction === 'forward' ? 'Operational delay / Line stoppage' : 'Schedule acceleration / Advanced production'
    });
  };

  // Timeline dates array
  const timelineDates = useMemo(() => {
    const list: string[] = [];
    const start = parseLocalDate(startDateStr);
    for (let i = 0; i < timelineDaysCount; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      list.push(toLocalDateString(d));
    }
    return list;
  }, [startDateStr, timelineDaysCount]);

  // Holiday map
  const holidayMap = useMemo(() => {
    const map: Record<string, Holiday> = {};
    holidays.forEach(h => {
      const dStr = h.dateStr || toLocalDateString(h.date);
      map[dStr] = h;
    });
    return map;
  }, [holidays]);

  // Downtimes map
  const downtimeMap = useMemo(() => {
    const map: Record<string, typeof downtimeRecords> = {};
    downtimeRecords.forEach(dt => {
      const dtDateStr = toLocalDateString(dt.startTime);
      const key = `${dt.machineId}_${dtDateStr}`;
      if (!map[key]) map[key] = [];
      map[key].push(dt);
    });
    return map;
  }, [downtimeRecords]);

  const handleOpenDailyLog = (plan: ProductionPlan, targetDateStr?: string) => {
    const dateStr = targetDateStr || toLocalDateString(new Date());
    const matchingLogs = dailyLogs.filter(
      l => l.planId === plan.id && (l.dateStr === dateStr || toLocalDateString(l.date) === dateStr)
    );
    const cumulativeActual = matchingLogs.reduce(
      (sum, l) => sum + (Number(l.actualVolume) || (Number(l.acceptedQuantity || 0) + Number(l.rejectedQuantity || 0))),
      0
    );
    const order = orders.find(o => o.id === plan.orderId);
    const machine = machines.find(m => m.id === plan.machineId);

    const dayTarget = (plan.dailyVolumeOverrides && plan.dailyVolumeOverrides[dateStr] !== undefined)
      ? Number(plan.dailyVolumeOverrides[dateStr]) || 0
      : (Number(plan.plannedDailyRate) || 0);

    const rawOrderQty = order
      ? ((order as any).quantity ??
         (order as any).targetVolume ??
         (order as any).targetQuantity ??
         (order as any)['Target Volume'] ??
         (order as any)['Target Quantity (Units)'] ??
         (order as any).qty ??
         plan.totalPlannedVolume)
      : plan.totalPlannedVolume;

    const parsedOrderTarget = Number(rawOrderQty);
    const effectiveTarget = dayTarget > 0 ? dayTarget : (Number.isFinite(parsedOrderTarget) && parsedOrderTarget > 0 ? parsedOrderTarget : 100);
    const remainingToTarget = Math.max(0, effectiveTarget - cumulativeActual);

    setDailyLogForm({
      planId: plan.id,
      orderId: plan.orderId,
      machineId: plan.machineId,
      dateStr,
      targetVolume: effectiveTarget,
      cumulativeAlreadyLogged: cumulativeActual,
      logsCount: matchingLogs.length,
      orderNumber: order?.orderNumber || 'Order',
      productName: order?.productName || 'Product',
      machineCode: machine?.machineCode || 'Machine',
      acceptedQuantity: remainingToTarget > 0 ? remainingToTarget : '',
      rejectedQuantity: 0,
      downtimeMinutes: 0,
      notes: ''
    });
    setIsDailyLogDialogOpen(true);
  };

  return (
    <Box sx={{ py: 1 }}>
      {/* Header */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonthIcon sx={{ color: '#6366f1' }} />
          Daily Production Schedule & Gantt Matrix
        </Typography>
      </Box>

      {/* Controls Bar: Category Filter, Machine Filter, Date Range & Horizon */}
      <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', p: 0.5, mb: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            {/* Category Filter */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="gantt-category-select">Category</InputLabel>
                <Select
                  labelId="gantt-category-select"
                  label="Category"
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value);
                    setSelectedMachineId('all');
                  }}
                >
                  <MenuItem value="all">All Categories ({categories.length})</MenuItem>
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                  <MenuItem value="uncategorized">General / Uncategorized</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Machine Filter */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="gantt-machine-select">Machine Line</InputLabel>
                <Select
                  labelId="gantt-machine-select"
                  label="Machine Line"
                  value={selectedMachineId}
                  onChange={(e) => setSelectedMachineId(e.target.value)}
                >
                  <MenuItem value="all">All Lines in Category ({filteredMachinesForSelect.length})</MenuItem>
                  {filteredMachinesForSelect.map((m) => {
                    const opHours = m.operatingHours || 24;
                    const dailyCap = m.dailyCapacity || ((m.capacity || 0) * opHours);
                    return (
                      <MenuItem key={m.id} value={m.id}>
                        {m.machineCode} - {m.machineName} ({(dailyCap || 0).toLocaleString()} u/d)
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>

            {/* View From Date */}
            <Grid size={{ xs: 6, sm: 3, md: 3 }}>
              <TextField
                label="View From Date"
                type="date"
                size="small"
                fullWidth
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            {/* Timeline Horizon */}
            <Grid size={{ xs: 6, sm: 3, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Timeline Horizon</InputLabel>
                <Select
                  label="Timeline Horizon"
                  value={timelineDaysCount}
                  onChange={(e) => setTimelineDaysCount(Number(e.target.value))}
                >
                  <MenuItem value={7}>Next 7 Days (1 Wk)</MenuItem>
                  <MenuItem value={14}>Next 14 Days (2 Wks)</MenuItem>
                  <MenuItem value={21}>Next 21 Days (3 Wks)</MenuItem>
                  <MenuItem value={30}>Next 30 Days (1 Month)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Color legend bar */}
          <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Legend:
            </Typography>
            <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: '#10b981' }} />
              <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 600 }}>Confirmed Live Plan</Typography>
            </Stack>
            <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: '#f59e0b', border: '1px dashed #d97706' }} />
              <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 600 }}>Draft Simulation</Typography>
            </Stack>
            <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: '#8b5cf6' }} />
              <Typography variant="caption" sx={{ color: '#6b21a8', fontWeight: 600 }}>Factory Holiday</Typography>
            </Stack>
            <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: '#ef4444' }} />
              <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 600 }}>Machine Downtime</Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Daily Schedule Gantt Grid Table - Presented Category-Machine Wise */}
      <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 680, overflowX: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 200, fontWeight: 800, bgcolor: '#f8fafc', zIndex: 10 }}>
                  Machine Line & Category
                </TableCell>
                {timelineDates.map((dateStr) => {
                  const d = parseLocalDate(dateStr);
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = dateStr === toLocalDateString(new Date());
                  const hol = holidayMap[dateStr];

                  return (
                    <TableCell
                      key={dateStr}
                      align="center"
                      sx={{
                        minWidth: 155,
                        maxWidth: 210,
                        bgcolor: isToday ? 'rgba(99, 102, 241, 0.08)' : hol ? 'rgba(139, 92, 246, 0.08)' : isWeekend ? '#f1f5f9' : '#f8fafc',
                        borderBottom: '2px solid #e2e8f0',
                        px: 1,
                        py: 1
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 800, color: isToday ? '#4f46e5' : isWeekend ? '#64748b' : '#0f172a', display: 'block' }}>
                        {dayName}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: isToday ? '#4f46e5' : '#334155' }}>
                        {dateStr.slice(5)}
                      </Typography>
                      {hol && (
                        <Typography noWrap variant="caption" sx={{ fontSize: '0.65rem', color: '#7c3aed', fontWeight: 700, display: 'block' }}>
                          Holiday: {hol.name}
                        </Typography>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedMachinesByCategory.length > 0 ? (
                groupedMachinesByCategory.map((group) => (
                  <React.Fragment key={group.categoryId}>
                    {/* Category Group Section Header Row */}
                    <TableRow sx={{ bgcolor: '#f1f5f9', borderTop: '2px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                      <TableCell
                        colSpan={1 + timelineDates.length}
                        sx={{
                          py: 1.2,
                          px: 2,
                          bgcolor: 'rgba(99, 102, 241, 0.06)',
                          borderLeft: '4px solid #4f46e5'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CategoryIcon sx={{ color: '#4f46e5', fontSize: 19 }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e1b4b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Category: {group.categoryName}
                            </Typography>
                            <Chip
                              label={`${group.machines.length} ${group.machines.length === 1 ? 'Line' : 'Lines'}`}
                              size="small"
                              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#e0e7ff', color: '#3730a3' }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700 }}>
                            Category Daily Capacity: <strong>{group.totalDailyCapacity.toLocaleString()} Units/Day</strong>
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* Machine Rows for this Category */}
                    {group.machines.map((machine) => {
                      const opHours = Number(machine.operatingHours) || 24;
                      const dailyCap = Number(machine.dailyCapacity) || ((Number(machine.capacity) || 0) * opHours);
                      const catName = categoryMap[machine.categoryId || ''] || group.categoryName;

                      return (
                        <TableRow key={machine.id} hover>
                          {/* Machine info column */}
                          <TableCell sx={{ fontWeight: 700, bgcolor: '#ffffff', borderRight: '1px solid #e2e8f0', minWidth: 200, p: 1.2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.3 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#4f46e5' }}>
                                {machine.machineCode}
                              </Typography>
                              <Chip
                                label={catName}
                                size="small"
                                sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ color: '#334155', display: 'block', fontWeight: 600 }}>
                              {machine.machineName}
                            </Typography>
                            <Chip
                              size="small"
                              label={`${opHours}h/day • ${(dailyCap || 0).toLocaleString()} u/d`}
                              sx={{ mt: 0.5, fontSize: '0.65rem', height: 18, fontWeight: 700, bgcolor: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5' }}
                            />
                          </TableCell>

                          {/* Days Cells */}
                          {timelineDates.map((dateStr) => {
                            const hol = holidayMap[dateStr];
                            const dtKey = `${machine.id}_${dateStr}`;
                            const dts = downtimeMap[dtKey];

                            // If Holiday, strictly render Holiday block and no allocation
                            if (hol) {
                              return (
                                <TableCell key={dateStr} align="center" sx={{ bgcolor: 'rgba(139, 92, 246, 0.06)', p: 1, borderRight: '1px solid #f1f5f9' }}>
                                  <Box sx={{ p: 1, borderRadius: '8px', bgcolor: 'rgba(139, 92, 246, 0.15)', border: '1px solid #8b5cf6' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#6b21a8', display: 'block' }}>
                                      HOLIDAY
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#5b21b6' }}>
                                      {hol.name}
                                    </Typography>
                                  </Box>
                                </TableCell>
                              );
                            }

                            // If Downtime
                            if (dts && dts.length > 0) {
                              const dtText = dts[0].remarks || dts[0].reason || 'Line Stoppage';
                              return (
                                <TableCell key={dateStr} align="center" sx={{ bgcolor: 'rgba(239, 68, 68, 0.05)', p: 1, borderRight: '1px solid #f1f5f9' }}>
                                  <Box sx={{ p: 1, borderRadius: '8px', bgcolor: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#991b1b', display: 'block' }}>
                                      DOWNTIME
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#b91c1c', display: 'block' }}>
                                      {dtText}
                                    </Typography>
                                  </Box>
                                </TableCell>
                              );
                            }

                            // Find all active plans on this date for this machine
                            const activePlansOnDate = plans.filter((p) => {
                              if (p.machineId !== machine.id || p.status === 'CANCELLED') return false;
                              const pStart = toLocalDateString(p.startDate);
                              const pEnd = toLocalDateString(p.endDate);
                              if (dateStr < pStart || dateStr > pEnd) return false;

                              const hasOverrides = !!(p.dailyVolumeOverrides && Object.keys(p.dailyVolumeOverrides).length > 0);
                              const dailyTarget = hasOverrides
                                ? (p.dailyVolumeOverrides && p.dailyVolumeOverrides[dateStr] !== undefined
                                    ? Number(p.dailyVolumeOverrides[dateStr]) || 0
                                    : 0)
                                : (Number(p.plannedDailyRate) || 0);

                              return dailyTarget > 0;
                            });

                            // If there are active plans with positive daily volume
                            if (activePlansOnDate.length > 0) {
                              return (
                                <TableCell
                                  key={dateStr}
                                  align="center"
                                  sx={{
                                    p: 0.8,
                                    borderRight: '1px solid #f1f5f9',
                                    verticalAlign: 'top'
                                  }}
                                >
                                  {/* Day-Wise Bidirectional Shift Action Buttons (Left / -1 Day & Right / +1 Day) */}
                                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
                                    <Tooltip title={`Shift orders on ${machine.machineCode} from ${dateStr} to the LEFT (-1 working day)`}>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenShiftModal(machine, dateStr, 'backward');
                                        }}
                                        sx={{
                                          width: 18,
                                          height: 18,
                                          p: 0,
                                          color: '#0284c7',
                                          bgcolor: 'rgba(2, 132, 199, 0.08)',
                                          '&:hover': { bgcolor: '#0284c7', color: '#ffffff' }
                                        }}
                                      >
                                        <FastRewindIcon sx={{ fontSize: 11 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title={`Shift orders on ${machine.machineCode} from ${dateStr} FORWARD (+1 working day)`}>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenShiftModal(machine, dateStr, 'forward');
                                        }}
                                        sx={{
                                          width: 18,
                                          height: 18,
                                          p: 0,
                                          color: '#6366f1',
                                          bgcolor: 'rgba(99, 102, 241, 0.08)',
                                          '&:hover': { bgcolor: '#4f46e5', color: '#ffffff' }
                                        }}
                                      >
                                        <FastForwardIcon sx={{ fontSize: 11 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>

                                  <Stack spacing={0.8}>
                                    {activePlansOnDate.map((activePlan) => {
                                      const isConfirmed = activePlan.type === 'CONFIRMED';
                                      const order = orders.find(o => o.id === activePlan.orderId);

                                      // Calculate cumulative actual output across all log entries for that day for that job
                                      const matchingLogs = dailyLogs.filter(
                                        l => l.planId === activePlan.id && (l.dateStr === dateStr || toLocalDateString(l.date) === dateStr)
                                      );
                                      const actualProduced = matchingLogs.reduce(
                                        (sum, l) => sum + (Number(l.actualVolume) || (Number(l.acceptedQuantity || 0) + Number(l.rejectedQuantity || 0))),
                                        0
                                      );
                                      const logsCount = matchingLogs.length;

                                      const hasOverrides = !!(activePlan.dailyVolumeOverrides && Object.keys(activePlan.dailyVolumeOverrides).length > 0);
                                      const dailyTarget = hasOverrides
                                        ? (activePlan.dailyVolumeOverrides && activePlan.dailyVolumeOverrides[dateStr] !== undefined
                                            ? Number(activePlan.dailyVolumeOverrides[dateStr]) || 0
                                            : 0)
                                        : (Number(activePlan.plannedDailyRate) || 0);

                                      const rawTarget = order
                                        ? ((order as any).quantity ??
                                           (order as any).targetVolume ??
                                           (order as any).targetQuantity ??
                                           (order as any)['Target Volume'] ??
                                           (order as any)['Target Quantity (Units)'] ??
                                           (order as any).qty ??
                                           (order as any).volume ??
                                           activePlan.totalPlannedVolume)
                                        : activePlan.totalPlannedVolume;

                                      const parsedNum = Number(rawTarget);
                                      const orderTargetVolume = Number.isFinite(parsedNum) && parsedNum > 0
                                        ? parsedNum
                                        : (Number(activePlan.totalPlannedVolume) || dailyTarget);

                                      const displayOrderNumber = order?.orderNumber || (activePlan.notes ? activePlan.notes.slice(0, 16) : 'Order');
                                      const displayProductName = order?.productName || 'Planned Batch';

                                      const isComplete = actualProduced >= dailyTarget && dailyTarget > 0;
                                      const progressPct = dailyTarget > 0 ? Math.min(100, Math.round((actualProduced / dailyTarget) * 100)) : 0;

                                      return (
                                        <Box
                                          key={activePlan.id}
                                          sx={{
                                            p: 1,
                                            borderRadius: '8px',
                                            bgcolor: isConfirmed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                            border: isConfirmed ? '1px solid #10b981' : '1px dashed #f59e0b',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            '&:hover': {
                                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                              borderColor: isConfirmed ? '#059669' : '#d97706',
                                              transform: 'translateY(-1px)'
                                            }
                                          }}
                                          onClick={() => {
                                            if (isConfirmed) {
                                              handleOpenDailyLog(activePlan, dateStr);
                                            } else {
                                              showToast(`Order ${displayOrderNumber} is in Draft Simulation. Confirm schedule via Schedule Creation page.`, 'info');
                                            }
                                          }}
                                        >
                                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography variant="caption" sx={{ fontWeight: 800, color: isConfirmed ? '#065f46' : '#92400e' }}>
                                              {displayOrderNumber}
                                            </Typography>
                                            <Chip
                                              size="small"
                                              label={isConfirmed ? 'LIVE' : 'DRAFT'}
                                              sx={{
                                                height: 16,
                                                fontSize: '0.6rem',
                                                fontWeight: 800,
                                                bgcolor: isConfirmed ? '#10b981' : '#f59e0b',
                                                color: '#ffffff'
                                              }}
                                            />
                                          </Box>
                                          <Typography variant="caption" noWrap sx={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.7rem' }}>
                                            {displayProductName}
                                          </Typography>
                                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.675rem', display: 'block', mt: 0.3 }}>
                                            Day Target: <strong>{dailyTarget.toLocaleString()} u</strong>
                                          </Typography>
                                          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.62rem', display: 'block' }}>
                                            Order Target: {orderTargetVolume.toLocaleString()} u
                                          </Typography>
                                          {isConfirmed && (
                                            <Box sx={{ mt: 0.5 }}>
                                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Typography variant="caption" sx={{ color: actualProduced > 0 ? '#059669' : '#94a3b8', fontWeight: 700, fontSize: '0.675rem' }}>
                                                  Actual: {actualProduced > 0 ? `${actualProduced.toLocaleString()} u` : 'Not logged'}
                                                </Typography>
                                                {logsCount > 1 && (
                                                  <Chip
                                                    size="small"
                                                    label={`${logsCount} logs`}
                                                    sx={{ height: 14, fontSize: '0.55rem', fontWeight: 800, bgcolor: '#dcfce7', color: '#15803d' }}
                                                  />
                                                )}
                                              </Box>
                                              <LinearProgress
                                                variant="determinate"
                                                value={progressPct}
                                                sx={{ height: 4, borderRadius: 2, mt: 0.3, bgcolor: 'rgba(0,0,0,0.08)' }}
                                                color={isComplete ? 'success' : 'primary'}
                                              />
                                            </Box>
                                          )}
                                        </Box>
                                      );
                                    })}
                                  </Stack>
                                </TableCell>
                              );
                            }

                            // Free Available Slot
                            const hasFuturePlans = plans.some(p => p.machineId === machine.id && p.status !== 'CANCELLED' && toLocalDateString(p.endDate) >= dateStr);
                            return (
                              <TableCell
                                key={dateStr}
                                align="center"
                                sx={{
                                  p: 0.8,
                                  borderRight: '1px solid #f1f5f9',
                                  verticalAlign: 'top'
                                }}
                              >
                                {hasFuturePlans && (
                                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
                                    <Tooltip title={`Pull upcoming orders on ${machine.machineCode} backwards to the LEFT (-1 day)`}>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenShiftModal(machine, dateStr, 'backward');
                                        }}
                                        sx={{
                                          width: 18,
                                          height: 18,
                                          p: 0,
                                          color: '#64748b',
                                          bgcolor: 'rgba(100, 116, 139, 0.08)',
                                          '&:hover': { bgcolor: '#0284c7', color: '#ffffff' }
                                        }}
                                      >
                                        <FastRewindIcon sx={{ fontSize: 11 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title={`Shift future orders on ${machine.machineCode} forward (+1 day)`}>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenShiftModal(machine, dateStr, 'forward');
                                        }}
                                        sx={{
                                          width: 18,
                                          height: 18,
                                          p: 0,
                                          color: '#64748b',
                                          bgcolor: 'rgba(100, 116, 139, 0.08)',
                                          '&:hover': { bgcolor: '#4f46e5', color: '#ffffff' }
                                        }}
                                      >
                                        <FastForwardIcon sx={{ fontSize: 11 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                )}
                                <Typography variant="caption" sx={{ color: '#cbd5e1', fontSize: '0.7rem', display: 'block', mt: hasFuturePlans ? 0 : 1 }}>
                                  — Free —
                                </Typography>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={1 + timelineDates.length} align="center" sx={{ py: 4, color: '#64748b' }}>
                    No active machines found for the selected category filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Quick Daily Log Dialog */}
      <Dialog
        open={isDailyLogDialogOpen}
        onClose={() => setIsDailyLogDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 0.5 }}>
          Record Daily Production Output Log
        </DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); saveDailyLogMutation.mutate(dailyLogForm); }}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2}>
              {/* Order & Machine context info */}
              <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e1b4b' }}>
                  {dailyLogForm.orderNumber} — {dailyLogForm.productName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.3 }}>
                  Machine: <strong>{dailyLogForm.machineCode}</strong> • Run Date: <strong>{dailyLogForm.dateStr}</strong>
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    label={`Daily Target: ${dailyLogForm.targetVolume.toLocaleString()} u`}
                    sx={{ fontWeight: 700, bgcolor: '#e0e7ff', color: '#3730a3' }}
                  />
                  <Chip
                    size="small"
                    label={`Already Logged: ${dailyLogForm.cumulativeAlreadyLogged.toLocaleString()} u (${dailyLogForm.logsCount} entries)`}
                    sx={{ fontWeight: 700, bgcolor: dailyLogForm.cumulativeAlreadyLogged > 0 ? '#dcfce7' : '#f1f5f9', color: dailyLogForm.cumulativeAlreadyLogged > 0 ? '#166534' : '#475569' }}
                  />
                  <Chip
                    size="small"
                    label={`Remaining: ${Math.max(0, dailyLogForm.targetVolume - dailyLogForm.cumulativeAlreadyLogged).toLocaleString()} u`}
                    sx={{ fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e' }}
                  />
                </Box>
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Accepted / Good Units"
                    type="number"
                    size="small"
                    required
                    fullWidth
                    value={dailyLogForm.acceptedQuantity}
                    onChange={(e) => setDailyLogForm({ ...dailyLogForm, acceptedQuantity: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Rejected / Scrap Units"
                    type="number"
                    size="small"
                    fullWidth
                    value={dailyLogForm.rejectedQuantity}
                    onChange={(e) => setDailyLogForm({ ...dailyLogForm, rejectedQuantity: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  />
                </Grid>
              </Grid>

              {/* Total Actual Computed for this entry & New Cumulative */}
              <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>This Entry Actual:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#10b981' }}>
                    {((Number(dailyLogForm.acceptedQuantity) || 0) + (Number(dailyLogForm.rejectedQuantity) || 0)).toLocaleString()} units
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>New Day Cumulative Total:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#4f46e5' }}>
                    {(dailyLogForm.cumulativeAlreadyLogged + (Number(dailyLogForm.acceptedQuantity) || 0) + (Number(dailyLogForm.rejectedQuantity) || 0)).toLocaleString()} / {dailyLogForm.targetVolume.toLocaleString()} units
                  </Typography>
                </Box>
              </Box>

              <TextField
                label="Unplanned Downtime (Minutes)"
                type="number"
                size="small"
                fullWidth
                value={dailyLogForm.downtimeMinutes}
                onChange={(e) => setDailyLogForm({ ...dailyLogForm, downtimeMinutes: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
              />

              <TextField
                label="Shift Notes / Operator Remarks"
                placeholder="Optional shift notes"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={dailyLogForm.notes}
                onChange={(e) => setDailyLogForm({ ...dailyLogForm, notes: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setIsDailyLogDialogOpen(false)} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={saveDailyLogMutation.isPending || ((Number(dailyLogForm.acceptedQuantity) || 0) + (Number(dailyLogForm.rejectedQuantity) || 0) <= 0)}
              sx={{ borderRadius: '8px', fontWeight: 700, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
            >
              {saveDailyLogMutation.isPending ? <CircularProgress size={22} color="inherit" /> : 'Record Output Log'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Shift Machine Schedule Dialog (Bidirectional: Left / Right) */}
      <Dialog
        open={shiftOrdersModal.open}
        onClose={() => !shiftMachineOrdersMutation.isPending && setShiftOrdersModal(prev => ({ ...prev, open: false }))}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          {shiftOrdersModal.direction === 'forward' ? <FastForwardIcon sx={{ color: '#4f46e5' }} /> : <FastRewindIcon sx={{ color: '#0284c7' }} />}
          Shift Machine Schedule {shiftOrdersModal.direction === 'forward' ? 'Forward (+1 Day)' : 'to the Left (-1 Day)'}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {/* Direction Toggle Selector */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.5 }}>
              Select Shift Direction:
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={shiftOrdersModal.direction}
              exclusive
              onChange={(_, newDir) => newDir && setShiftOrdersModal(prev => ({ ...prev, direction: newDir }))}
              fullWidth
            >
              <ToggleButton value="backward" sx={{ fontWeight: 700, py: 0.8, color: '#0284c7' }}>
                <FastRewindIcon sx={{ mr: 0.8, fontSize: 18 }} /> Shift Left (-1 Day)
              </ToggleButton>
              <ToggleButton value="forward" sx={{ fontWeight: 700, py: 0.8, color: '#4f46e5' }}>
                <FastForwardIcon sx={{ mr: 0.8, fontSize: 18 }} /> Shift Right (+1 Day)
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
            {shiftOrdersModal.direction === 'forward'
              ? 'Push all scheduled production orders on this machine line forward by 1 working day starting from the selected date. Factory holidays will be automatically skipped.'
              : 'Pull scheduled production orders on this machine line backward (to the left) by 1 working day starting from the selected date. Factory holidays will be automatically skipped.'}
          </Typography>

          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.2)', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e1b4b' }}>
              Machine: {shiftOrdersModal.machine?.machineCode} ({shiftOrdersModal.machine?.machineName})
            </Typography>
            <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5 }}>
              Shift Starting Date: <strong>{shiftOrdersModal.fromDateStr}</strong>
            </Typography>
            <Typography variant="caption" sx={{ color: shiftOrdersModal.direction === 'forward' ? '#4338ca' : '#0369a1', fontWeight: 700, display: 'block', mt: 0.5 }}>
              {shiftOrdersModal.affectedPlans.length} active scheduled plan(s) found on or after this date.
            </Typography>
          </Box>

          {shiftOrdersModal.affectedPlans.length > 0 ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', mb: 0.8 }}>
                Affected Production Plans:
              </Typography>
              <Stack spacing={0.8} sx={{ maxHeight: 180, overflowY: 'auto' }}>
                {shiftOrdersModal.affectedPlans.map(plan => {
                  const order = orders.find(o => o.id === plan.orderId);
                  const startStr = toLocalDateString(plan.startDate);
                  const endStr = toLocalDateString(plan.endDate);
                  return (
                    <Box key={plan.id} sx={{ p: 1, borderRadius: '8px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                      <Box>
                        <strong>{order?.orderNumber || 'Order'}:</strong> {order?.productName || 'Product'}
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          Current window: {startStr} → {endStr} ({plan.totalPlannedVolume.toLocaleString()} u)
                        </Typography>
                      </Box>
                      <Chip size="small" label={plan.type} sx={{ fontWeight: 700, height: 20, fontSize: '0.65rem' }} />
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          ) : (
            <Alert severity="info" sx={{ mb: 2, borderRadius: '8px' }}>
              No active orders found on or after {shiftOrdersModal.fromDateStr} on this machine.
            </Alert>
          )}

          <TextField
            label="Reason / Notes for Shift"
            placeholder="e.g. Line maintenance, breakdown, or upstream material delay"
            size="small"
            fullWidth
            value={shiftOrdersModal.reason}
            onChange={(e) => setShiftOrdersModal({ ...shiftOrdersModal, reason: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setShiftOrdersModal(prev => ({ ...prev, open: false }))}
            variant="outlined"
            disabled={shiftMachineOrdersMutation.isPending}
            sx={{ borderRadius: '8px' }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => shiftMachineOrdersMutation.mutate()}
            variant="contained"
            disabled={shiftMachineOrdersMutation.isPending || shiftOrdersModal.affectedPlans.length === 0}
            sx={{
              borderRadius: '8px',
              fontWeight: 700,
              bgcolor: shiftOrdersModal.direction === 'forward' ? '#4f46e5' : '#0284c7',
              '&:hover': { bgcolor: shiftOrdersModal.direction === 'forward' ? '#4338ca' : '#0369a1' }
            }}
          >
            {shiftMachineOrdersMutation.isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : shiftOrdersModal.direction === 'forward' ? (
              'Shift Orders Forward (+1 Day)'
            ) : (
              'Shift Orders Left (-1 Day)'
            )}
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
