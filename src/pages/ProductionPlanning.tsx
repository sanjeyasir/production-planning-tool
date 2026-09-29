import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  getMachines,
  getProductionCategories,
  getDowntimeRecords,
  getProductionOrders,
  createProductionOrder,
  updateProductionOrder,
  deleteProductionOrder,
  getHolidays,
  createHoliday,
  deleteHoliday,
  getProductionPlans,
  createProductionPlan,
  updateProductionPlan,
  deleteProductionPlan,
  getHourlyProductions,
  createHourlyProduction,
  updateHourlyProduction,
  type ProductionOrder,
  type ProductionPlan
} from '../services/db';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Tabs,
  Tab,
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
  Paper,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Switch,
  FormControlLabel,
  Tooltip,
  CircularProgress,
  Stack,
  Divider,
  Chip
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Icons
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FlagIcon from '@mui/icons-material/Flag';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import WarningIcon from '@mui/icons-material/Warning';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DeleteIcon from '@mui/icons-material/Delete';
import PublishIcon from '@mui/icons-material/Publish';
import UndoIcon from '@mui/icons-material/Undo';
import BlockIcon from '@mui/icons-material/Block';
import InfoIcon from '@mui/icons-material/Info';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import * as XLSX from 'xlsx';

// Color definitions for visual planner timeline matching costing-sample-tracking
const PLAN_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  CONFIRMED: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid #10b981',
    text: '#065f46',
    label: 'Live Confirmed'
  },
  SIMULATED: {
    bg: 'rgba(245, 158, 11, 0.12)',
    border: '1px dashed #f59e0b',
    text: '#92400e',
    label: 'Simulation Draft'
  },
  DOWNTIME: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid #ef4444',
    text: '#991b1b',
    label: 'Line Downtime'
  },
  HOLIDAY: {
    bg: 'rgba(168, 85, 247, 0.12)',
    border: '1px solid #a855f7',
    text: '#6b21a8',
    label: 'Factory Holiday'
  }
};

// Format Date cleanly
const parseDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d?.toDate) return d.toDate();
  return new Date(d);
};

export const ProductionPlanning: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';

  // ----------------------------------------------------
  // DATA QUERIES
  // ----------------------------------------------------
  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['machines', tenantId],
    queryFn: () => getMachines(tenantId),
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['productionCategories', tenantId],
    queryFn: () => getProductionCategories(tenantId),
    enabled: !!tenantId,
  });

  const { data: downtimeRecords = [] } = useQuery({
    queryKey: ['downtimeRecords', tenantId],
    queryFn: () => getDowntimeRecords(tenantId),
    enabled: !!tenantId,
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['productionOrders', tenantId],
    queryFn: () => getProductionOrders(tenantId),
    enabled: !!tenantId,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', tenantId],
    queryFn: () => getHolidays(tenantId),
    enabled: !!tenantId,
  });

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['productionPlans', tenantId],
    queryFn: () => getProductionPlans(tenantId),
    enabled: !!tenantId,
  });

  const { data: hourlyLogs = [] } = useQuery({
    queryKey: ['hourlyProductions', tenantId],
    queryFn: () => getHourlyProductions(tenantId),
    enabled: !!tenantId,
  });

  // Active machines
  const activeMachines = useMemo(() => {
    return machines.filter(m => m.status === 'ACTIVE');
  }, [machines]);

  // Sort orders by priority and due date
  const sortedOrders = useMemo(() => {
    const priorityWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return [...orders].sort((a, b) => {
      const weightA = priorityWeight[a.priority || 'MEDIUM'] || 2;
      const weightB = priorityWeight[b.priority || 'MEDIUM'] || 2;
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime();
    });
  }, [orders]);

  // 1. Navigation / Tabs State
  const [activeTab, setActiveTab] = useState(0);

  // 2. Filter states for Timeline
  const [startDateStr, setStartDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 9); // Defaults to 10 days
    return d.toISOString().split('T')[0];
  });
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [isWhatIfMode, setIsWhatIfMode] = useState<boolean>(false);

  // Set default machine once loaded
  React.useEffect(() => {
    if (activeMachines.length > 0 && !selectedMachineId) {
      setSelectedMachineId(activeMachines[0].id);
    }
  }, [activeMachines, selectedMachineId]);

  // Notifications State
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'warning' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Modal / Dialog States
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isHourlyLogOpen, setIsHourlyLogOpen] = useState(false);

  // Active Selected Item States
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);

  // Forms State
  const [orderForm, setOrderForm] = useState({
    orderNumber: '',
    productName: '',
    categoryId: '',
    quantity: 1000,
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW'
  });

  const [scheduleForm, setScheduleForm] = useState({
    orderId: '',
    machineId: '',
    startDateStr: new Date().toISOString().split('T')[0],
    startHour: 8,
    isSimulated: false
  });

  const [hourlyLogsForm, setHourlyLogsForm] = useState<{ [hour: number]: number }>({});

  // ----------------------------------------------------
  // MUTATIONS
  // ----------------------------------------------------
  const showToast = (message: string, severity: 'success' | 'warning' | 'error' = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const createOrderMutation = useMutation({
    mutationFn: createProductionOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      setIsOrderDialogOpen(false);
      showToast('Production order created successfully!');
      setOrderForm({
        orderNumber: '',
        productName: '',
        categoryId: '',
        quantity: 1000,
        dueDate: new Date().toISOString().split('T')[0],
        priority: 'MEDIUM'
      });
    },
    onError: (err: any) => showToast('Error creating order: ' + err.message, 'error')
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateProductionOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      showToast('Order updated successfully!');
    }
  });

  const deleteOrderMutation = useMutation({
    mutationFn: deleteProductionOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      showToast('Order deleted successfully!');
    }
  });

  const createPlanMutation = useMutation({
    mutationFn: createProductionPlan,
    onSuccess: (_newPlanId, variables) => {
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      setIsScheduleDialogOpen(false);
      showToast(`Job successfully scheduled as ${variables.type}!`);

      updateOrderMutation.mutate({
        id: variables.orderId,
        data: { status: 'SCHEDULED' }
      });
    },
    onError: (err: any) => showToast('Error scheduling plan: ' + err.message, 'error')
  });

  const deletePlanMutation = useMutation({
    mutationFn: deleteProductionPlan,
    onSuccess: (_, deletedPlanId) => {
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      showToast('Scheduled job deleted.');

      const plan = plans.find(p => p.id === deletedPlanId);
      if (plan) {
        const otherPlans = plans.filter(p => p.orderId === plan.orderId && p.id !== deletedPlanId);
        if (otherPlans.length === 0) {
          updateOrderMutation.mutate({
            id: plan.orderId,
            data: { status: 'PENDING' }
          });
        }
      }
    }
  });

  const updatePlanTypeMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'CONFIRMED' | 'SIMULATED' }) =>
      updateProductionPlan(id, { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
    }
  });

  const createHolidayMutation = useMutation({
    mutationFn: createHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', tenantId] });
      showToast('Holiday added successfully!');
    }
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', tenantId] });
      showToast('Holiday removed.');
    }
  });

  const logHourlyMutation = useMutation({
    mutationFn: async ({ planId, date, logs }: { planId: string; date: Date; logs: { [hour: number]: number } }) => {
      const plan = plans.find(p => p.id === planId);
      if (!plan) throw new Error('Plan not found');

      for (const hourStr of Object.keys(logs)) {
        const hour = Number(hourStr);
        const actual = logs[hour];

        const existing = hourlyLogs.find(
          l => l.planId === planId && l.hour === hour
        );

        if (existing) {
          await updateHourlyProduction(existing.id, { actual });
        } else {
          await createHourlyProduction({
            tenantId,
            planId,
            date,
            hour,
            budget: plan.plannedHourlyRate,
            actual
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hourlyProductions', tenantId] });
      setIsHourlyLogOpen(false);
      showToast('Hourly production output saved!');
    },
    onError: (err: any) => showToast('Error saving hourly logs: ' + err.message, 'error')
  });

  const seedDemoDataMutation = useMutation({
    mutationFn: async () => {
      const order1Id = await createProductionOrder({
        tenantId,
        orderNumber: 'ORD-101',
        productName: 'Premium Cotton Shirts',
        categoryId: categories[0]?.id || '',
        quantity: 3500,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'SCHEDULED',
        priority: 'HIGH'
      });

      const order2Id = await createProductionOrder({
        tenantId,
        orderNumber: 'ORD-102',
        productName: 'Slim Fit Denim Pants',
        categoryId: categories[0]?.id || '',
        quantity: 1800,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'SCHEDULED',
        priority: 'MEDIUM'
      });

      await createProductionOrder({
        tenantId,
        orderNumber: 'ORD-103',
        productName: 'Wool Crewneck Sweaters',
        categoryId: categories[0]?.id || '',
        quantity: 2400,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: 'PENDING',
        priority: 'LOW'
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      await createHoliday({
        tenantId,
        date: tomorrow,
        name: 'National Manufacturing Day'
      });

      if (activeMachines.length > 0) {
        const m1 = activeMachines[0];
        const start1 = new Date();
        start1.setHours(8, 0, 0, 0);
        const duration1 = Math.ceil(3500 / m1.capacity);
        const end1 = new Date(start1.getTime() + duration1 * 60 * 60 * 1000);

        const plan1Id = await createProductionPlan({
          tenantId,
          orderId: order1Id,
          machineId: m1.id,
          startTime: start1,
          endTime: end1,
          type: 'CONFIRMED',
          plannedHourlyRate: m1.capacity
        });

        for (let h = 8; h < 8 + Math.min(6, duration1); h++) {
          await createHourlyProduction({
            tenantId,
            planId: plan1Id,
            date: start1,
            hour: h,
            budget: m1.capacity,
            actual: m1.capacity - Math.floor(Math.random() * 40)
          });
        }
      }

      if (activeMachines.length > 1) {
        const m2 = activeMachines[1];
        const start2 = new Date();
        start2.setHours(10, 0, 0, 0);
        const duration2 = Math.ceil(1800 / m2.capacity);
        const end2 = new Date(start2.getTime() + duration2 * 60 * 60 * 1000);

        await createProductionPlan({
          tenantId,
          orderId: order2Id,
          machineId: m2.id,
          startTime: start2,
          endTime: end2,
          type: 'SIMULATED',
          plannedHourlyRate: m2.capacity
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['holidays', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['hourlyProductions', tenantId] });
      showToast('Demo production planning data successfully loaded!');
    },
    onError: (err: any) => showToast('Error seeding demo data: ' + err.message, 'error')
  });

  const getMachineName = (id: string) => {
    const mach = machines.find(m => m.id === id);
    return mach ? `${mach.machineCode} - ${mach.machineName}` : 'Unknown Machine';
  };

  const getOrderLabel = (id: string) => {
    const o = orders.find(ord => ord.id === id);
    return o ? `${o.orderNumber} (${o.productName})` : 'Unknown Order';
  };

  // Generate list of days in the selected range
  const dateRangeDays = useMemo(() => {
    const days: string[] = [];
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    const limitDate = new Date(start);
    limitDate.setDate(limitDate.getDate() + 31);
    const actualEnd = end > limitDate ? limitDate : end;

    const current = new Date(start);
    while (current <= actualEnd) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [startDateStr, endDateStr]);

  const adjustedTimelineData = useMemo(() => {
    if (!selectedMachineId) {
      return { adjustedPlans: [], timelineCells: {}, conflicts: [] };
    }

    const machinePlans = plans.filter((p) => {
      if (p.machineId !== selectedMachineId) return false;
      if (!isWhatIfMode && p.type === 'SIMULATED') return false;
      return true;
    });

    const priorityWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const sortedMachinePlans = [...machinePlans].sort((a, b) => {
      const startA = parseDate(a.startTime).getTime();
      const startB = parseDate(b.startTime).getTime();
      if (startA !== startB) {
        return startA - startB;
      }
      const ordA = orders.find((o) => o.id === a.orderId);
      const ordB = orders.find((o) => o.id === b.orderId);
      const wA = priorityWeight[ordA?.priority || 'MEDIUM'] || 2;
      const wB = priorityWeight[ordB?.priority || 'MEDIUM'] || 2;
      return wB - wA;
    });

    interface AdjustedPlan {
      plan: ProductionPlan;
      adjustedStartTime: Date;
      adjustedEndTime: Date;
      plannedHourlyRate: number;
    }

    const adjustedPlans: AdjustedPlan[] = [];
    let previousEndTime: Date | null = null;

    const isHolidayAtTime = (date: Date): { name: string } | null => {
      const dStr = date.toISOString().split('T')[0];
      const match = holidays.find((h) => {
        const hDate = parseDate(h.date);
        return hDate.toISOString().split('T')[0] === dStr;
      });
      return match ? { name: match.name } : null;
    };

    const isDowntimeAtTime = (date: Date): { reason: string; duration: number } | null => {
      const match = downtimeRecords.find((dt) => {
        if (dt.machineId !== selectedMachineId) return false;
        const dtStart = parseDate(dt.startTime);
        const dtEnd = parseDate(dt.endTime);
        return date >= dtStart && date < dtEnd;
      });
      return match ? { reason: match.reason, duration: match.duration } : null;
    };

    for (const plan of sortedMachinePlans) {
      const order = orders.find((o) => o.id === plan.orderId);
      if (!order) continue;

      const schedStart = parseDate(plan.startTime);
      let adjustedStart = schedStart;
      if (previousEndTime && previousEndTime > adjustedStart) {
        adjustedStart = new Date(previousEndTime);
      }

      const totalQuantity = order.quantity;
      const hourlyRate = Math.max(1, plan.plannedHourlyRate || 1);
      
      let accumulated = 0;
      const timeCursor = new Date(adjustedStart);
      timeCursor.setMinutes(0, 0, 0);

      let safetyCounter = 0;
      while (accumulated < totalQuantity && safetyCounter < 1000) {
        safetyCounter++;
        const hol = isHolidayAtTime(timeCursor);
        const dt = isDowntimeAtTime(timeCursor);

        if (hol || dt) {
          timeCursor.setHours(timeCursor.getHours() + 1);
          continue;
        }

        const hourVal = timeCursor.getHours();
        const dateStr = timeCursor.toISOString().split('T')[0];
        
        const log = hourlyLogs.find((l) => {
          if (l.planId !== plan.id) return false;
          if (l.hour !== hourVal) return false;
          const lDateStr = parseDate(l.date).toISOString().split('T')[0];
          return lDateStr === dateStr;
        });

        if (log) {
          accumulated += log.actual;
        } else {
          accumulated += hourlyRate;
        }

        timeCursor.setHours(timeCursor.getHours() + 1);
      }

      const adjustedEnd = new Date(timeCursor);
      adjustedPlans.push({
        plan,
        adjustedStartTime: adjustedStart,
        adjustedEndTime: adjustedEnd,
        plannedHourlyRate: hourlyRate
      });

      previousEndTime = adjustedEnd;
    }

    interface TimelineCell {
      type: 'FREE' | 'CONFIRMED' | 'SIMULATED' | 'DOWNTIME' | 'HOLIDAY';
      label?: string;
      details?: string;
      plan?: ProductionPlan;
      downtime?: any;
    }

    const cells: Record<string, Record<number, TimelineCell>> = {};

    for (const dayStr of dateRangeDays) {
      cells[dayStr] = {};
      const dayDate = new Date(dayStr);
      dayDate.setHours(0,0,0,0);

      for (let h = 0; h < 24; h++) {
        const cellTime = new Date(dayDate);
        cellTime.setHours(h, 0, 0, 0);

        const hol = isHolidayAtTime(cellTime);
        if (hol) {
          cells[dayStr][h] = {
            type: 'HOLIDAY',
            label: 'HOLIDAY',
            details: `Holiday: ${hol.name}`
          };
          continue;
        }

        const dt = isDowntimeAtTime(cellTime);
        if (dt) {
          cells[dayStr][h] = {
            type: 'DOWNTIME',
            label: 'DOWNTIME',
            details: `Downtime: ${dt.reason} (${dt.duration} mins)`,
            downtime: dt
          };
          continue;
        }

        const activePlan = adjustedPlans.find((ap) => {
          return cellTime >= ap.adjustedStartTime && cellTime < ap.adjustedEndTime;
        });

        if (activePlan) {
          const ord = orders.find((o) => o.id === activePlan.plan.orderId);
          cells[dayStr][h] = {
            type: activePlan.plan.type,
            label: ord ? ord.orderNumber : 'Scheduled',
            details: ord ? `${ord.productName} (${ord.quantity} units, priority: ${ord.priority || 'MEDIUM'})` : 'Planned run',
            plan: activePlan.plan
          };
          continue;
        }

        cells[dayStr][h] = { type: 'FREE' };
      }
    }

    const conflicts: string[] = [];
    for (const ap of adjustedPlans) {
      const ord = orders.find((o) => o.id === ap.plan.orderId);
      if (ord) {
        const dueDate = parseDate(ord.dueDate);
        if (ap.adjustedEndTime > dueDate) {
          conflicts.push(
            `Order ${ord.orderNumber} is projected to finish late! Adjusted End: ${ap.adjustedEndTime.toLocaleDateString()} ${ap.adjustedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Due Date: ${dueDate.toLocaleDateString()}`
          );
        }
      }
    }

    return {
      adjustedPlans,
      timelineCells: cells,
      conflicts
    };
  }, [selectedMachineId, plans, orders, holidays, downtimeRecords, hourlyLogs, dateRangeDays, isWhatIfMode]);

  const timelineCells = adjustedTimelineData.timelineCells;
  const schedulingConflicts = adjustedTimelineData.conflicts;

  const simulatedJobsCount = useMemo(() => {
    return plans.filter(p => p.type === 'SIMULATED').length;
  }, [plans]);

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.orderNumber || !orderForm.productName || !orderForm.categoryId) {
      showToast('Please fill out all fields', 'warning');
      return;
    }

    createOrderMutation.mutate({
      tenantId,
      orderNumber: orderForm.orderNumber,
      productName: orderForm.productName,
      categoryId: orderForm.categoryId,
      quantity: Number(orderForm.quantity),
      dueDate: new Date(orderForm.dueDate),
      status: 'PENDING',
      priority: orderForm.priority
    });
  };

  const handleOpenSchedule = (
    order: ProductionOrder | null = null, 
    prefillMachineId: string = '', 
    prefillHour: number = 8,
    prefillDateStr: string = ''
  ) => {
    setSelectedOrder(order);
    setScheduleForm({
      orderId: order ? order.id : '',
      machineId: prefillMachineId || selectedMachineId || (machines[0]?.id || ''),
      startDateStr: prefillDateStr || startDateStr,
      startHour: prefillHour,
      isSimulated: isWhatIfMode
    });
    setIsScheduleDialogOpen(true);
  };

  const handleCellClick = (cell: any) => {
    if (!cell.plan) return;
    const action = window.confirm(
      `Manage Scheduled Run for ${cell.label}:\n\n` +
      `[OK] -> Log Hourly Production Volumes.\n` +
      `[Cancel] -> Delete / Cancel Scheduled Run.`
    );
    if (action) {
      handleOpenHourlyLog(cell.plan);
    } else {
      if (window.confirm(`Are you sure you want to delete the scheduled plan for ${cell.label}?`)) {
        deletePlanMutation.mutate(cell.plan.id);
      }
    }
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const ordId = selectedOrder ? selectedOrder.id : scheduleForm.orderId;
    const orderObj = orders.find(o => o.id === ordId);
    const machObj = machines.find(m => m.id === scheduleForm.machineId);

    if (!orderObj || !machObj) {
      showToast('Select a valid order and machine', 'warning');
      return;
    }

    const durationHours = Math.ceil(orderObj.quantity / machObj.capacity);

    const start = new Date(scheduleForm.startDateStr);
    start.setHours(scheduleForm.startHour, 0, 0, 0);
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    createPlanMutation.mutate({
      tenantId,
      orderId: ordId,
      machineId: scheduleForm.machineId,
      startTime: start,
      endTime: end,
      type: scheduleForm.isSimulated ? 'SIMULATED' : 'CONFIRMED',
      plannedHourlyRate: machObj.capacity
    });
  };

  const handlePromoteSimulation = () => {
    const simulated = plans.filter(p => p.type === 'SIMULATED');
    if (simulated.length === 0) {
      showToast('No simulated jobs to promote.', 'warning');
      return;
    }

    simulated.forEach((p) => {
      updatePlanTypeMutation.mutate({ id: p.id, type: 'CONFIRMED' });
    });
    showToast(`Successfully promoted ${simulated.length} sandbox jobs to Confirmed Live Plan!`);
  };

  const handleClearSimulation = () => {
    const simulated = plans.filter(p => p.type === 'SIMULATED');
    simulated.forEach((p) => {
      deletePlanMutation.mutate(p.id);
    });
    showToast('Simulated schedule drafts cleared.');
  };

  const handleOpenHourlyLog = (plan: ProductionPlan) => {
    setSelectedPlan(plan);
    const initialLogs: { [h: number]: number } = {};
    const planStart = parseDate(plan.startTime);
    const planEnd = parseDate(plan.endTime);

    const durationHours = Math.ceil(
      (planEnd.getTime() - planStart.getTime()) / (1000 * 60 * 60)
    );

    for (let i = 0; i < durationHours; i++) {
      const logHour = new Date(planStart.getTime() + i * 60 * 60 * 1000);
      const hourVal = logHour.getHours();
      const logObj = hourlyLogs.find(
        l => l.planId === plan.id && l.hour === hourVal
      );
      initialLogs[hourVal] = logObj ? logObj.actual : 0;
    }

    setHourlyLogsForm(initialLogs);
    setIsHourlyLogOpen(true);
  };

  const handleSaveHourlyLogs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    logHourlyMutation.mutate({
      planId: selectedPlan.id,
      date: parseDate(selectedPlan.startTime),
      logs: hourlyLogsForm
    });
  };

  const handleExcelExport = () => {
    const ordersData = orders.map(o => ({
      'Order Number': o.orderNumber,
      'Product Name': o.productName,
      'Category': categories.find(c => c.id === o.categoryId)?.name || 'Unknown',
      'Quantity': o.quantity,
      'Due Date': parseDate(o.dueDate).toISOString().split('T')[0],
      'Status': o.status,
      'Created At': parseDate(o.createdAt).toISOString().split('T')[0],
    }));

    const plansData = plans.map(p => {
      const start = parseDate(p.startTime);
      const end = parseDate(p.endTime);
      return {
        'Plan Type': p.type,
        'Order Code': orders.find(o => o.id === p.orderId)?.orderNumber || 'Unknown',
        'Product': orders.find(o => o.id === p.orderId)?.productName || 'Unknown',
        'Machine': getMachineName(p.machineId),
        'Start Time': start.toLocaleString(),
        'End Time': end.toLocaleString(),
        'Planned Capacity (U/Hr)': p.plannedHourlyRate,
        'Quantity': orders.find(o => o.id === p.orderId)?.quantity || 0,
      };
    });

    const hourlyData = hourlyLogs.map(l => {
      const planObj = plans.find(p => p.id === l.planId);
      const orderObj = planObj ? orders.find(o => o.id === planObj.orderId) : null;
      return {
        'Date': parseDate(l.date).toISOString().split('T')[0],
        'Hour': `${l.hour}:00`,
        'Order': orderObj ? orderObj.orderNumber : 'N/A',
        'Product': orderObj ? orderObj.productName : 'N/A',
        'Machine': planObj ? getMachineName(planObj.machineId) : 'N/A',
        'Budget (Capacity)': l.budget,
        'Actual Output': l.actual,
        'Variance': l.actual - l.budget,
        'Efficiency %': l.budget > 0 ? ((l.actual / l.budget) * 100).toFixed(1) + '%' : '0%'
      };
    });

    const wb = XLSX.utils.book_new();
    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Production Orders');
    const wsPlans = XLSX.utils.json_to_sheet(plansData);
    XLSX.utils.book_append_sheet(wb, wsPlans, 'Schedules & Plans');
    const wsHourly = XLSX.utils.json_to_sheet(hourlyData);
    XLSX.utils.book_append_sheet(wb, wsHourly, 'Hourly Performance Logs');

    XLSX.writeFile(wb, `MOIP_Production_Planning_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Excel report downloaded successfully!');
  };

  const [holidayForm, setHolidayForm] = useState({
    dateStr: new Date().toISOString().split('T')[0],
    name: ''
  });

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name) {
      showToast('Please enter a holiday name', 'warning');
      return;
    }

    const hDate = new Date(holidayForm.dateStr);
    hDate.setHours(0, 0, 0, 0);
    const existing = holidays.find(h => {
      const d = parseDate(h.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === hDate.getTime();
    });

    if (existing) {
      showToast('Holiday already exists on this date', 'warning');
      return;
    }

    createHolidayMutation.mutate({
      tenantId,
      date: hDate,
      name: holidayForm.name
    });
    setHolidayForm({
      dateStr: new Date().toISOString().split('T')[0],
      name: ''
    });
  };

  // ----------------------------------------------------
  // ANALYTICS & DASHBOARD COMPUTATIONS
  // ----------------------------------------------------
  const orderStatusData = useMemo(() => {
    const counts = { PENDING: 0, SCHEDULED: 0, COMPLETED: 0 };
    orders.forEach(o => {
      if (counts[o.status as keyof typeof counts] !== undefined) {
        counts[o.status as keyof typeof counts]++;
      }
    });
    return [
      { name: 'Pending Orders', value: counts.PENDING, color: '#f59e0b' },
      { name: 'Scheduled Orders', value: counts.SCHEDULED, color: '#10b981' },
      { name: 'Completed Orders', value: counts.COMPLETED, color: '#6366f1' }
    ].filter(item => item.value > 0);
  }, [orders]);

  const machineUtilization = useMemo(() => {
    const totalHoursWindow = 30 * 24;
    return activeMachines.map((m) => {
      const mPlans = plans.filter(p => p.machineId === m.id);
      let scheduledHours = 0;
      mPlans.forEach((p) => {
        const start = parseDate(p.startTime);
        const end = parseDate(p.endTime);
        const diffMs = end.getTime() - start.getTime();
        scheduledHours += diffMs / (1000 * 60 * 60);
      });

      const mDowntimes = downtimeRecords.filter(dt => dt.machineId === m.id);
      let downtimeHours = 0;
      mDowntimes.forEach((dt) => {
        downtimeHours += dt.duration / 60;
      });

      const schedRate = Math.min(100, Number(((scheduledHours / totalHoursWindow) * 100).toFixed(1)));
      const dtRate = Math.min(100, Number(((downtimeHours / totalHoursWindow) * 100).toFixed(1)));
      const idleRate = Math.max(0, 100 - schedRate - dtRate);

      return {
        machineName: m.machineCode,
        'Scheduled %': schedRate,
        'Downtime %': dtRate,
        'Idle %': idleRate
      };
    });
  }, [activeMachines, plans, downtimeRecords]);

  const [performancePlanId, setPerformancePlanId] = useState<string>('all');
  const performanceChartData = useMemo(() => {
    const selectedLogs = hourlyLogs.filter(
      l => performancePlanId === 'all' || l.planId === performancePlanId
    );

    const hourlyGroups: { [hour: number]: { hourLabel: string; Budget: number; Actual: number } } = {};
    for (let h = 0; h < 24; h++) {
      hourlyGroups[h] = {
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        Budget: 0,
        Actual: 0
      };
    }

    selectedLogs.forEach((l) => {
      hourlyGroups[l.hour].Budget += l.budget;
      hourlyGroups[l.hour].Actual += l.actual;
    });

    return Object.values(hourlyGroups);
  }, [hourlyLogs, performancePlanId]);

  // KPI Stat cards summary
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;
  const scheduledOrdersCount = orders.filter(o => o.status === 'SCHEDULED').length;
  const completedOrdersCount = orders.filter(o => o.status === 'COMPLETED').length;
  const confirmedPlansCount = plans.filter(p => p.type === 'CONFIRMED').length;

  const kpis = [
    { title: 'Total Orders', value: totalOrdersCount, color: '#6366f1', icon: <AssignmentIcon fontSize="small" /> },
    { title: 'Pending Orders', value: pendingOrdersCount, color: '#f59e0b', icon: <PlaylistAddIcon fontSize="small" /> },
    { title: 'Scheduled Jobs', value: scheduledOrdersCount, color: '#10b981', icon: <CalendarMonthIcon fontSize="small" /> },
    { title: 'Completed', value: completedOrdersCount, color: '#3b82f6', icon: <CheckCircleIcon fontSize="small" /> },
    { title: 'Live Runs', value: confirmedPlansCount, color: '#10b981', icon: <TrendingUpIcon fontSize="small" /> },
    { title: 'Draft Sandbox', value: simulatedJobsCount, color: '#ec4899', icon: <PublishIcon fontSize="small" /> },
  ];

  return (
    <Box sx={{ py: 1 }}>
      {/* Page Title & Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonthIcon sx={{ color: '#6366f1' }} />
            Production Planning & Gantt Scheduler
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Manage order queues, simulate what-if sequence scenarios, and record hourly output performance.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setIsOrderDialogOpen(true)}
            sx={{ borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem' }}
          >
            Create Order
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExcelExport}
            sx={{ borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem' }}
          >
            Export Excel
          </Button>
        </Stack>
      </Box>

      {/* KPI Cards Grid */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map((card, i) => (
          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={i}>
            <Card
              sx={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'transform 0.15s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)'
                }
              }}
            >
              <CardContent sx={{ p: '14px 12px !important', textAlign: 'center' }}>
                <Box sx={{ color: card.color, display: 'inline-flex', p: 0.8, borderRadius: '8px', bgcolor: `${card.color}15`, mb: 0.5 }}>
                  {card.icon}
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.675rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', letterSpacing: '0.04em' }}>
                  {card.title}
                </Typography>
                <Typography variant="h6" sx={{ margin: '2px 0 0 0', color: '#0f172a', fontWeight: 800, fontSize: '1.2rem' }}>
                  {card.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs Navigation */}
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
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1.5,
            '& .MuiTab-root': {
              minHeight: 48,
              fontSize: '0.85rem',
            }
          }}
        >
          <Tab icon={<CalendarMonthIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Interactive Timeline Grid" />
          <Tab icon={<PlaylistAddIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Pending Orders (${pendingOrdersCount})`} />
          <Tab icon={<TrendingUpIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Hourly Performance Log" />
          <Tab icon={<FlagIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Holidays & Downtimes" />
          <Tab icon={<InfoIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Dashboards & Analytics" />
        </Tabs>
      </Paper>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: INTERACTIVE TIMELINE SCHEDULER */}
      {/* ---------------------------------------------------- */}
      {activeTab === 0 && (
        <Stack spacing={2.5}>
          {/* Controls Bar Card */}
          <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', p: 0.5 }}>
            <CardContent sx={{ p: 2 }}>
              <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="timeline-machine-label">Select Machine</InputLabel>
                    <Select
                      labelId="timeline-machine-label"
                      label="Select Machine"
                      value={selectedMachineId}
                      onChange={(e) => setSelectedMachineId(e.target.value)}
                    >
                      {activeMachines.map((m) => (
                        <MenuItem key={m.id} value={m.id}>
                          {m.machineCode} - {m.machineName} (Cap: {m.capacity}/hr)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
                  <TextField
                    label="From Date"
                    type="date"
                    size="small"
                    fullWidth
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
                  <TextField
                    label="To Date"
                    type="date"
                    size="small"
                    fullWidth
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1 }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    startIcon={<CalendarMonthIcon />}
                    onClick={() => handleOpenSchedule(null, selectedMachineId, 8, startDateStr)}
                    sx={{ borderRadius: '8px', fontWeight: 600, textTransform: 'none', py: 0.9, px: 2 }}
                  >
                    Schedule Job
                  </Button>
                </Grid>
              </Grid>

              {/* What-If Simulation Row */}
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isWhatIfMode}
                      onChange={(e) => setIsWhatIfMode(e.target.checked)}
                      color="warning"
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: isWhatIfMode ? '#d97706' : '#334155' }}>
                        What-If Simulation Sandbox
                      </Typography>
                      {isWhatIfMode && (
                        <Chip label="SANDBOX ACTIVE" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }} />
                      )}
                    </Box>
                  }
                />

                {isWhatIfMode && simulatedJobsCount > 0 && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      color="warning"
                      size="small"
                      startIcon={<PublishIcon />}
                      onClick={handlePromoteSimulation}
                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                    >
                      Promote Drafts ({simulatedJobsCount})
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<UndoIcon />}
                      onClick={handleClearSimulation}
                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                    >
                      Clear Draft
                    </Button>
                  </Stack>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Simulated Mode Alert Banner */}
          {isWhatIfMode && (
            <Alert severity="warning" sx={{ borderRadius: '10px' }}>
              <strong>What-If Sandbox Mode is Active.</strong> Draft jobs appear in amber with dashed borders. Click <strong>Promote Drafts</strong> to confirm them into the live schedule.
            </Alert>
          )}

          {/* Scheduling Warnings */}
          {schedulingConflicts.length > 0 && (
            <Alert severity="error" icon={<WarningIcon />} sx={{ borderRadius: '10px' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Projected Delivery Date Delays:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {schedulingConflicts.map((c, i) => (
                  <li key={i}><Typography variant="body2" sx={{ fontSize: '0.825rem' }}>{c}</Typography></li>
                ))}
              </ul>
            </Alert>
          )}

          {orders.length === 0 && (
            <Alert
              severity="info"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => seedDemoDataMutation.mutate()}
                  disabled={seedDemoDataMutation.isPending}
                  sx={{ fontWeight: 700, borderRadius: '6px' }}
                >
                  Load Demo Data
                </Button>
              }
              sx={{ borderRadius: '10px' }}
            >
              No orders found in your production planner. Press "Load Demo Data" to load realistic sample schedules and performance logs.
            </Alert>
          )}

          {/* Timeline Grid Table */}
          {loadingMachines || loadingPlans ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : !selectedMachineId ? (
            <Alert severity="warning" sx={{ borderRadius: '10px' }}>
              Please select a machine to view its schedule.
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', overflowX: 'auto', bgcolor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <Table size="small" stickyHeader sx={{ minWidth: 1000 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 100, fontWeight: 800, bgcolor: '#f1f5f9', color: '#334155', borderRight: '1px solid #e2e8f0' }}>Hour / Day</TableCell>
                    {dateRangeDays.map((dayStr) => {
                      const dayDate = new Date(dayStr);
                      const formattedDate = dayDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                      return (
                        <TableCell key={dayStr} align="center" sx={{ fontWeight: 700, bgcolor: '#f1f5f9', color: '#334155', minWidth: 110, borderRight: '1px solid #e2e8f0' }}>
                          {formattedDate}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dateRangeDays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={dateRangeDays.length + 1} align="center" sx={{ py: 6, color: '#64748b' }}>
                        No days found in range. Please select a valid date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    Array.from({ length: 24 }).map((_, h) => (
                      <TableRow key={h} hover sx={{ '&:hover': { bgcolor: '#f8fafc !important' } }}>
                        <TableCell sx={{ fontWeight: 700, borderRight: '1px solid #e2e8f0', bgcolor: '#f8fafc', color: '#475569', fontSize: '0.8rem', py: 1 }}>
                          {String(h).padStart(2, '0')}:00
                        </TableCell>

                        {dateRangeDays.map((dayStr) => {
                          const cell = timelineCells[dayStr]?.[h] || { type: 'FREE' };
                          let cellContent = null;

                          if (cell.type === 'CONFIRMED') {
                            cellContent = (
                              <Tooltip title={`${cell.details} | Start: ${h}:00 (Click to Log Output / Manage)`} arrow>
                                <Box sx={{ py: 0.8, px: 0.5, height: '100%', cursor: 'pointer', transition: 'all 0.1s', '&:hover': { transform: 'scale(1.02)' } }}>
                                  <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', fontSize: '0.75rem', color: '#065f46' }}>
                                    {cell.label}
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#047857', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                    Live Confirmed
                                  </Typography>
                                </Box>
                              </Tooltip>
                            );
                          } else if (cell.type === 'SIMULATED') {
                            cellContent = (
                              <Tooltip title={`${cell.details} | Simulation Draft (Click to Log Output / Manage)`} arrow>
                                <Box sx={{ py: 0.8, px: 0.5, height: '100%', cursor: 'pointer', transition: 'all 0.1s', '&:hover': { transform: 'scale(1.02)' } }}>
                                  <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', fontSize: '0.75rem', color: '#92400e' }}>
                                    {cell.label} *
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#b45309', display: 'block' }}>
                                    Draft Sandbox
                                  </Typography>
                                </Box>
                              </Tooltip>
                            );
                          } else if (cell.type === 'DOWNTIME') {
                            cellContent = (
                              <Tooltip title={cell.details} arrow>
                                <Box sx={{ py: 0.8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <BlockIcon sx={{ fontSize: 14, mb: 0.2, color: '#ef4444' }} />
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#b91c1c' }}>
                                    DOWN
                                  </Typography>
                                </Box>
                              </Tooltip>
                            );
                          } else if (cell.type === 'HOLIDAY') {
                            cellContent = (
                              <Tooltip title={cell.details} arrow>
                                <Box sx={{ py: 0.8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <FlagIcon sx={{ fontSize: 14, mb: 0.2, color: '#a855f7' }} />
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#7e22ce' }}>
                                    HOLIDAY
                                  </Typography>
                                </Box>
                              </Tooltip>
                            );
                          } else {
                            // Free slot
                            cellContent = (
                              <IconButton
                                size="small"
                                onClick={() => handleOpenSchedule(null, selectedMachineId, h, dayStr)}
                                sx={{ color: '#cbd5e1', '&:hover': { color: '#6366f1', bgcolor: 'rgba(99, 102, 241, 0.08)' } }}
                              >
                                <AddIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            );
                          }

                          const colorConfig = cell.type ? PLAN_COLORS[cell.type] : undefined;

                          return (
                            <TableCell
                              key={dayStr}
                              align="center"
                              onClick={() => {
                                if (cell.plan) {
                                  handleCellClick(cell);
                                }
                              }}
                              sx={{
                                p: 0,
                                borderRight: '1px solid #f1f5f9',
                                borderBottom: '1px solid #f1f5f9',
                                bgcolor: colorConfig?.bg || 'transparent',
                                borderTop: colorConfig?.border || 'inherit',
                                color: colorConfig?.text || 'inherit',
                                transition: 'all 0.15s'
                              }}
                            >
                              {cellContent}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Timeline legend details card */}
          <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                Scheduler Status Legend:
              </Typography>
              <Stack direction="row" spacing={2.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'rgba(16, 185, 129, 0.18)', border: '1px solid #10b981' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>Confirmed Live Run</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'rgba(245, 158, 11, 0.18)', border: '1px dashed #f59e0b' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>What-If Sandbox Draft</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'rgba(239, 68, 68, 0.18)', border: '1px solid #ef4444' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>Machine Downtime</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'rgba(168, 85, 247, 0.18)', border: '1px solid #a855f7' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>Factory Holiday</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: PENDING ORDERS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 1 && (
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Pending & Scheduled Production Orders
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Queue of client customer orders awaiting assignment to shop-floor lines.
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setIsOrderDialogOpen(true)}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
            >
              Add New Order
            </Button>
          </Box>

          <TableContainer component={Paper} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order Number</TableCell>
                  <TableCell>Product Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingOrders ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>
                      No orders logged yet. Click "Add New Order" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedOrders.map((ord) => {
                    const catName = categories.find(c => c.id === ord.categoryId)?.name || 'Unknown';
                    const dueDateObj = parseDate(ord.dueDate);

                    let chipColor: 'default' | 'primary' | 'success' | 'warning' = 'default';
                    if (ord.status === 'PENDING') chipColor = 'warning';
                    else if (ord.status === 'SCHEDULED') chipColor = 'primary';
                    else if (ord.status === 'COMPLETED') chipColor = 'success';

                    let priorityColor: 'default' | 'error' | 'primary' | 'secondary' = 'default';
                    if (ord.priority === 'HIGH') priorityColor = 'error';
                    else if (ord.priority === 'MEDIUM') priorityColor = 'primary';
                    else if (ord.priority === 'LOW') priorityColor = 'default';

                    return (
                      <TableRow key={ord.id} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#6366f1' }}>{ord.orderNumber}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{ord.productName}</TableCell>
                        <TableCell>{catName}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{ord.quantity.toLocaleString()}</TableCell>
                        <TableCell>{dueDateObj.toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Chip size="small" label={ord.priority || 'MEDIUM'} color={priorityColor} sx={{ fontWeight: 700 }} />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={ord.status} color={chipColor} sx={{ fontWeight: 700 }} />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
                            {ord.status === 'PENDING' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<CalendarMonthIcon sx={{ fontSize: 14 }} />}
                                onClick={() => handleOpenSchedule(ord)}
                                sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.75rem', py: 0.4 }}
                              >
                                Schedule
                              </Button>
                            )}
                            {ord.status === 'SCHEDULED' && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="info"
                                onClick={() => {
                                  if (window.confirm('Mark this order as COMPLETED?')) {
                                    updateOrderMutation.mutate({ id: ord.id, data: { status: 'COMPLETED' } });
                                  }
                                }}
                                sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.75rem', py: 0.4 }}
                              >
                                Complete
                              </Button>
                            )}
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this order?')) {
                                  deleteOrderMutation.mutate(ord.id);
                                }
                              }}
                            >
                              <DeleteIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: HOURLY PERFORMANCE LOG */}
      {/* ---------------------------------------------------- */}
      {activeTab === 2 && (
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Hourly Output Performance Tracking
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Select a confirmed scheduled job and record hourly production volumes against planned machine capacity.
            </Typography>
          </Box>

          <TableContainer component={Paper} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order Number</TableCell>
                  <TableCell>Product Name</TableCell>
                  <TableCell>Scheduled Machine</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>End Time</TableCell>
                  <TableCell>Hourly Capacity</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingPlans ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : plans.filter(p => p.type === 'CONFIRMED').length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#64748b' }}>
                      No confirmed active scheduled plans. Go to "Timeline Grid" or "Pending Orders" to schedule a plan.
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.filter(p => p.type === 'CONFIRMED').map((plan) => {
                    const ord = orders.find(o => o.id === plan.orderId);
                    if (!ord) return null;
                    const pStart = parseDate(plan.startTime);
                    const pEnd = parseDate(plan.endTime);

                    return (
                      <TableRow key={plan.id} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#6366f1' }}>{ord.orderNumber}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{ord.productName}</TableCell>
                        <TableCell>{getMachineName(plan.machineId)}</TableCell>
                        <TableCell>{pStart.toLocaleString()}</TableCell>
                        <TableCell>{pEnd.toLocaleString()}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{plan.plannedHourlyRate} units/hr</TableCell>
                        <TableCell align="center">
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<TrendingUpIcon />}
                            onClick={() => handleOpenHourlyLog(plan)}
                            sx={{ textTransform: 'none', borderRadius: '6px', fontWeight: 600 }}
                          >
                            Log Output
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: HOLIDAYS & DOWNTIMES */}
      {/* ---------------------------------------------------- */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          {/* Holidays panel */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
                  Factory Holidays Master
                </Typography>

                {/* Form */}
                <form onSubmit={handleAddHoliday} style={{ marginBottom: 20 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'flex-end' }}>
                    <Box sx={{ flexGrow: 1, width: '100%' }}>
                      <TextField
                        label="Holiday Date"
                        type="date"
                        size="small"
                        fullWidth
                        value={holidayForm.dateStr}
                        onChange={(e) => setHolidayForm({ ...holidayForm, dateStr: e.target.value })}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Box>
                    <Box sx={{ flexGrow: 2, width: '100%' }}>
                      <TextField
                        label="Holiday Name"
                        placeholder="e.g. National Day"
                        size="small"
                        fullWidth
                        value={holidayForm.name}
                        onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                      />
                    </Box>
                    <Button
                      type="submit"
                      variant="contained"
                      color="secondary"
                      sx={{ height: 40, borderRadius: '8px', textTransform: 'none', px: 2.5, fontWeight: 700, width: { xs: '100%', sm: 'auto' } }}
                    >
                      Add
                    </Button>
                  </Stack>
                </form>

                <Divider sx={{ mb: 2 }} />

                <TableContainer component={Paper} sx={{ bgcolor: 'transparent', border: 'none', maxHeight: 350 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Holiday Description</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {holidays.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ py: 4, color: '#64748b' }}>
                            No factory holidays registered yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        holidays.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell>{parseDate(h.date).toLocaleDateString()}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{h.name}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => deleteHolidayMutation.mutate(h.id)}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Downtimes panel */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                  Machine Breakdown Downtimes (Active)
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
                  Read-only view of recorded breakages affecting planning. Log entries via the Downtime portal.
                </Typography>

                <Divider sx={{ mb: 2 }} />

                <TableContainer component={Paper} sx={{ bgcolor: 'transparent', border: 'none', maxHeight: 400 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Machine</TableCell>
                        <TableCell>Start Time</TableCell>
                        <TableCell>End Time</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell align="right">Duration</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {downtimeRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#64748b' }}>
                            No active downtime logs recorded.
                          </TableCell>
                        </TableRow>
                      ) : (
                        downtimeRecords.map((dt) => {
                          const start = parseDate(dt.startTime);
                          const end = parseDate(dt.endTime);
                          return (
                            <TableRow key={dt.id}>
                              <TableCell sx={{ fontWeight: 700, color: '#6366f1' }}>{getMachineName(dt.machineId).split(' - ')[0]}</TableCell>
                              <TableCell sx={{ fontSize: '0.75rem' }}>{start.toLocaleString()}</TableCell>
                              <TableCell sx={{ fontSize: '0.75rem' }}>{end.toLocaleString()}</TableCell>
                              <TableCell>{dt.reason}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: '#ef4444' }}>{dt.duration}m</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 5: DASHBOARDS & ANALYTICS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 4 && (
        <Stack spacing={3}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
                    Production Orders Status Funnel
                  </Typography>
                  <Box sx={{ height: 260, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {orderStatusData.length === 0 ? (
                      <Typography color="text.secondary">No order data available.</Typography>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={orderStatusData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={5}
                          >
                            {orderStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <ChartTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
                    30-Day Machine Scheduling & Downtime Load
                  </Typography>
                  <Box sx={{ height: 260 }}>
                    {machineUtilization.length === 0 ? (
                      <Typography color="text.secondary" align="center" sx={{ pt: 10 }}>No machine data loaded.</Typography>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={machineUtilization} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis type="number" stroke="#94a3b8" domain={[0, 100]} />
                          <YAxis dataKey="machineName" type="category" stroke="#94a3b8" />
                          <ChartTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                          <Legend />
                          <Bar dataKey="Scheduled %" stackId="a" fill="#10b981" />
                          <Bar dataKey="Downtime %" stackId="a" fill="#ef4444" />
                          <Bar dataKey="Idle %" stackId="a" fill="#cbd5e1" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Hourly Performance Line Chart */}
          <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Hourly Actual Output vs. Planned Target
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Track production volume variances on an hour-by-hour resolution.
                  </Typography>
                </Box>

                <FormControl size="small" sx={{ minWidth: 260 }}>
                  <InputLabel id="perf-plan-label">Select Scheduled Plan</InputLabel>
                  <Select
                    labelId="perf-plan-label"
                    value={performancePlanId}
                    label="Select Scheduled Plan"
                    onChange={(e) => setPerformancePlanId(e.target.value)}
                  >
                    <MenuItem value="all">All Scheduled Runs</MenuItem>
                    {plans.filter(p => p.type === 'CONFIRMED').map((p) => {
                      const ord = orders.find(o => o.id === p.orderId);
                      return (
                        <MenuItem key={p.id} value={p.id}>
                          {ord ? `${ord.orderNumber} on ${getMachineName(p.machineId).split(' - ')[0]}` : p.id}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="hourLabel" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <ChartTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                    <Legend />
                    <Line type="monotone" dataKey="Budget" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Actual" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* ---------------------------------------------------- */}
      {/* DIALOG: CREATE ORDER */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={isOrderDialogOpen}
        onClose={() => setIsOrderDialogOpen(false)}
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
          Create New Production Order
        </DialogTitle>
        <form onSubmit={handleCreateOrder}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Order Number / Code"
                placeholder="e.g. ORD-1092"
                fullWidth
                required
                value={orderForm.orderNumber}
                onChange={(e) => setOrderForm({ ...orderForm, orderNumber: e.target.value })}
              />
              <TextField
                label="Product Name / SKU"
                placeholder="e.g. Premium Cotton Shirt"
                fullWidth
                required
                value={orderForm.productName}
                onChange={(e) => setOrderForm({ ...orderForm, productName: e.target.value })}
              />
              <FormControl fullWidth required>
                <InputLabel id="order-cat-label">Product Category</InputLabel>
                <Select
                  labelId="order-cat-label"
                  label="Product Category"
                  value={orderForm.categoryId}
                  onChange={(e) => setOrderForm({ ...orderForm, categoryId: e.target.value })}
                >
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel id="order-priority-label">Order Priority</InputLabel>
                <Select
                  labelId="order-priority-label"
                  label="Order Priority"
                  value={orderForm.priority}
                  onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value as any })}
                >
                  <MenuItem value="HIGH">High Priority</MenuItem>
                  <MenuItem value="MEDIUM">Medium Priority</MenuItem>
                  <MenuItem value="LOW">Low Priority</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Required Quantity (units)"
                type="number"
                fullWidth
                required
                value={orderForm.quantity}
                onChange={(e) => setOrderForm({ ...orderForm, quantity: Number(e.target.value) })}
              />
              <TextField
                label="Delivery Due Date"
                type="date"
                fullWidth
                required
                value={orderForm.dueDate}
                onChange={(e) => setOrderForm({ ...orderForm, dueDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setIsOrderDialogOpen(false)} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="secondary" disabled={createOrderMutation.isPending} sx={{ borderRadius: '8px', fontWeight: 700 }}>
              Create Order
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* DIALOG: SCHEDULE JOB */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={isScheduleDialogOpen}
        onClose={() => setIsScheduleDialogOpen(false)}
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
          {selectedOrder ? `Schedule Order ${selectedOrder.orderNumber}` : 'Schedule Production Plan Job'}
        </DialogTitle>
        <form onSubmit={handleCreateSchedule}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              {!selectedOrder && (
                <FormControl fullWidth required>
                  <InputLabel id="sched-ord-label">Select Pending Order</InputLabel>
                  <Select
                    labelId="sched-ord-label"
                    label="Select Pending Order"
                    value={scheduleForm.orderId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, orderId: e.target.value })}
                  >
                    {sortedOrders.filter(o => o.status === 'PENDING').map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        [{o.priority || 'MEDIUM'}] {o.orderNumber} - {o.productName} ({o.quantity} units)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <FormControl fullWidth required>
                <InputLabel id="sched-mach-label">Target Machine</InputLabel>
                <Select
                  labelId="sched-mach-label"
                  label="Target Machine"
                  value={scheduleForm.machineId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, machineId: e.target.value })}
                >
                  {activeMachines.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.machineCode} - {m.machineName} (Capacity: {m.capacity}/hr)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Start Date"
                type="date"
                fullWidth
                required
                value={scheduleForm.startDateStr}
                onChange={(e) => setScheduleForm({ ...scheduleForm, startDateStr: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                label="Start Hour (0 - 23)"
                type="number"
                slotProps={{ htmlInput: { min: 0, max: 23 } }}
                fullWidth
                required
                value={scheduleForm.startHour}
                onChange={(e) => setScheduleForm({ ...scheduleForm, startHour: Number(e.target.value) })}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={scheduleForm.isSimulated}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, isSimulated: e.target.checked })}
                    color="warning"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Schedule as Simulated "What-If" Draft
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Simulated jobs do not alter live timelines until promoted.
                    </Typography>
                  </Box>
                }
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setIsScheduleDialogOpen(false)} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="secondary" disabled={createPlanMutation.isPending} sx={{ borderRadius: '8px', fontWeight: 700 }}>
              Confirm Schedule
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* DIALOG: LOG HOURLY ACTUALS */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={isHourlyLogOpen}
        onClose={() => setIsHourlyLogOpen(false)}
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
          Log Hourly Output
        </DialogTitle>
        <form onSubmit={handleSaveHourlyLogs}>
          <DialogContent sx={{ pt: 1 }}>
            {selectedPlan && (
              <Box sx={{ mb: 2.5, p: 2, bgcolor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Order: {getOrderLabel(selectedPlan.orderId)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Machine: {getMachineName(selectedPlan.machineId)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700, display: 'block', mt: 0.5 }}>
                  Target Capacity: {selectedPlan.plannedHourlyRate} units/hr
                </Typography>
              </Box>
            )}

            <Stack spacing={2} sx={{ maxHeight: 350, overflowY: 'auto', pr: 0.5 }}>
              {Object.keys(hourlyLogsForm).map((hourStr) => {
                const hour = Number(hourStr);
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }} key={hour}>
                    <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 90, color: '#475569' }}>
                      {String(hour).padStart(2, '0')}:00 - {String(hour + 1).padStart(2, '0')}:00
                    </Typography>
                    <TextField
                      label="Actual Volume"
                      type="number"
                      size="small"
                      value={hourlyLogsForm[hour]}
                      onChange={(e) => setHourlyLogsForm({
                        ...hourlyLogsForm,
                        [hour]: Number(e.target.value)
                      })}
                    />
                  </Box>
                );
              })}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setIsHourlyLogOpen(false)} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="secondary" disabled={logHourlyMutation.isPending} sx={{ borderRadius: '8px', fontWeight: 700 }}>
              Save Hourly Logs
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Snackbar alerts */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={notification.severity} variant="filled" sx={{ width: '100%', borderRadius: '10px' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
