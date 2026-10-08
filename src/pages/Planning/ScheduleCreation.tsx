import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getMachines,
  getProductionOrders,
  getHolidays,
  getProductionPlans,
  getDowntimeRecords,
  getProductionCategories,
  getPlants,
  createProductionPlan,
  updateProductionPlan,
  updateProductionOrder,
  toLocalDateString,
  parseLocalDate,
  type Machine,
  type ProductionOrder,
  type Holiday,
  type ProductionPlan
} from '../../services/db';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Stack,
  Chip,
  IconButton,
  Paper,
  LinearProgress,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip
} from '@mui/material';

// Icons
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TableViewIcon from '@mui/icons-material/TableView';
import DateRangeIcon from '@mui/icons-material/DateRange';
import CategoryIcon from '@mui/icons-material/Category';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import LockIcon from '@mui/icons-material/Lock';
import BuildIcon from '@mui/icons-material/Build';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import TuneIcon from '@mui/icons-material/Tune';

// Handsontable
import { HotTable } from '@handsontable/react';

// Color Palette for Orders in Timeline
const ORDER_COLORS = [
  { bg: '#e0e7ff', text: '#3730a3', border: '#818cf8' },
  { bg: '#dcfce7', text: '#166534', border: '#4ade80' },
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f472b6' },
  { bg: '#e0f2fe', text: '#075985', border: '#38bdf8' },
  { bg: '#f3e8ff', text: '#6b21a8', border: '#c084fc' },
  { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
];

export interface TentativeAllocation {
  id: string; // unique temp id
  orderId: string;
  orderNumber: string;
  productName: string;
  categoryId: string;
  machineId: string;
  machineCode: string;
  dateStr: string; // YYYY-MM-DD
  allocatedVolume: number;
}

export const ScheduleCreation: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';

  // ----------------------------------------------------
  // QUERIES
  // ----------------------------------------------------
  const { data: machines = [] } = useQuery({
    queryKey: ['machines', tenantId],
    queryFn: () => getMachines(tenantId),
    enabled: !!tenantId,
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['productionOrders', tenantId],
    queryFn: () => getProductionOrders(tenantId),
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['productionCategories', tenantId],
    queryFn: () => getProductionCategories(tenantId),
    enabled: !!tenantId,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ['plants', tenantId],
    queryFn: () => getPlants(tenantId),
    enabled: !!tenantId,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', tenantId],
    queryFn: () => getHolidays(tenantId),
    enabled: !!tenantId,
  });

  const { data: existingPlans = [] } = useQuery({
    queryKey: ['productionPlans', tenantId],
    queryFn: () => getProductionPlans(tenantId),
    enabled: !!tenantId,
  });

  const { data: downtimeRecords = [] } = useQuery({
    queryKey: ['downtimeRecords', tenantId],
    queryFn: () => getDowntimeRecords(tenantId),
    enabled: !!tenantId,
  });

  // ----------------------------------------------------
  // STATE
  // ----------------------------------------------------
  // Timeline Window
  const [windowStartDate, setWindowStartDate] = useState<string>(toLocalDateString(new Date()));
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedOrderToAllocate, setSelectedOrderToAllocate] = useState<ProductionOrder | null>(null);

  // Tentative Allocations in Simulation
  const [tentativeAllocations, setTentativeAllocations] = useState<TentativeAllocation[]>([]);

  // 1. Single Slot Allocator Modal
  const [slotModal, setSlotModal] = useState<{
    open: boolean;
    machine: Machine | null;
    dateStr: string;
    existingAllocations: TentativeAllocation[];
    availableCap: number;
    effectiveCap: number;
  }>({
    open: false,
    machine: null,
    dateStr: '',
    existingAllocations: [],
    availableCap: 0,
    effectiveCap: 0
  });

  const [slotForm, setSlotForm] = useState<{
    orderId: string;
    volume: number | '';
  }>({
    orderId: '',
    volume: 1000,
  });

  // 2. Multi-Machine & Date Range Planning Modal
  const [rangePlannerOpen, setRangePlannerOpen] = useState(false);
  const [rangePlanOrder, setRangePlanOrder] = useState<ProductionOrder | null>(null);
  const [rangeSelectedMachineIds, setRangeSelectedMachineIds] = useState<string[]>([]);
  const [rangeStartDate, setRangeStartDate] = useState<string>(toLocalDateString(new Date()));
  const [rangeEndDate, setRangeEndDate] = useState<string>(toLocalDateString(new Date(Date.now() + 6 * 86400000)));
  const [rangeDailyVolumes, setRangeDailyVolumes] = useState<Record<string, number | ''>>({});

  // 3. Delete Production Unit Count Modal
  const [deleteUnitModal, setDeleteUnitModal] = useState<{
    open: boolean;
    type: 'TENTATIVE' | 'CONFIRMED_PLAN';
    allocId?: string;
    plan?: ProductionPlan | null;
    dateStr: string;
    orderNumber: string;
    productName: string;
    machineCode: string;
    volume: number;
  }>({
    open: false,
    type: 'TENTATIVE',
    dateStr: '',
    orderNumber: '',
    productName: '',
    machineCode: '',
    volume: 0
  });

  // Confirmation Creation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [planType, setPlanType] = useState<'CONFIRMED' | 'DRAFT'>('CONFIRMED');

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

  // ----------------------------------------------------
  // COMPUTED MAPS & TIMELINE
  // ----------------------------------------------------
  const activeMachines = useMemo(() => {
    return machines.filter(m => {
      if (m.status !== 'ACTIVE') return false;
      if (selectedPlantFilter !== 'all' && m.plantId !== selectedPlantFilter) return false;
      return true;
    });
  }, [machines, selectedPlantFilter]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const plantMap = useMemo(() => {
    const map: Record<string, string> = {};
    plants.forEach(p => { map[p.id] = p.plantName; });
    return map;
  }, [plants]);

  // Group active machines by Category for category-machine wise split & timeline presentation
  const groupedMachinesByCategory = useMemo(() => {
    const filtered = activeMachines.filter(m => {
      if (selectedCategoryId !== 'all') {
        if (selectedCategoryId === 'uncategorized') {
          if (m.categoryId && categoryMap[m.categoryId]) return false;
        } else if (m.categoryId !== selectedCategoryId) {
          return false;
        }
      }
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
  }, [activeMachines, categories, selectedCategoryId, categoryMap]);

  const holidayMap = useMemo(() => {
    const map: Record<string, Holiday> = {};
    holidays.forEach(h => {
      const dStr = toLocalDateString(h.date);
      map[dStr] = h;
    });
    return map;
  }, [holidays]);

  // Downtime minutes grouped by machineId_dateStr
  const downtimeMap = useMemo(() => {
    const map: Record<string, number> = {};
    downtimeRecords.forEach(d => {
      const dStr = toLocalDateString(d.startTime);
      const key = `${d.machineId}_${dStr}`;
      const dur = Number(d.duration) || 0;
      map[key] = (map[key] || 0) + (Number.isFinite(dur) ? dur : 0);
    });
    return map;
  }, [downtimeRecords]);

  // Existing confirmed/draft plans volume grouped by machineId_dateStr (with dailyVolumeOverrides support)
  const existingPlanVolumeMap = useMemo(() => {
    const map: Record<string, number> = {};
    existingPlans.forEach(plan => {
      if (plan.status === 'CANCELLED') return;
      const startStr = toLocalDateString(plan.startDate);
      const endStr = toLocalDateString(plan.endDate);

      const cur = parseLocalDate(startStr);
      const end = parseLocalDate(endStr);
      const defaultRate = Number(plan.plannedDailyRate) || 0;
      const hasOverrides = !!(plan.dailyVolumeOverrides && Object.keys(plan.dailyVolumeOverrides).length > 0);

      while (cur <= end) {
        const dStr = toLocalDateString(cur);
        const isHol = !!holidayMap[dStr];
        const key = `${plan.machineId}_${dStr}`;

        let dayVol = 0;
        if (isHol) {
          dayVol = 0; // Strictly 0 on holidays
        } else if (hasOverrides) {
          dayVol = (plan.dailyVolumeOverrides && plan.dailyVolumeOverrides[dStr] !== undefined)
            ? Number(plan.dailyVolumeOverrides[dStr]) || 0
            : 0;
        } else {
          dayVol = defaultRate;
        }

        if (dayVol > 0) {
          map[key] = (map[key] || 0) + dayVol;
        }
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [existingPlans, holidayMap]);

  // Generate Date List for Timeline Horizon
  const timelineDates = useMemo(() => {
    const dates: Array<{ date: Date; dateStr: string; dayName: string; formatted: string; isWeekend: boolean }> = [];
    const base = parseLocalDate(windowStartDate);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < horizonDays; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const dStr = toLocalDateString(d);
      const dayOfWeek = d.getDay();
      dates.push({
        date: d,
        dateStr: dStr,
        dayName: dayNames[dayOfWeek],
        formatted: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      });
    }
    return dates;
  }, [windowStartDate, horizonDays]);

  // Order Colors Assignment
  const orderColorMap = useMemo(() => {
    const map: Record<string, { bg: string; text: string; border: string }> = {};
    orders.forEach((o, index) => {
      map[o.id] = ORDER_COLORS[index % ORDER_COLORS.length];
    });
    return map;
  }, [orders]);

  // Existing allocated volume per order from database plans (considering daily overrides)
  const existingOrderPlanVolumeMap = useMemo(() => {
    const map: Record<string, number> = {};
    existingPlans.forEach(plan => {
      if (plan.status === 'CANCELLED') return;
      let totalVol = 0;
      if (plan.dailyVolumeOverrides && Object.keys(plan.dailyVolumeOverrides).length > 0) {
        totalVol = Object.values(plan.dailyVolumeOverrides).reduce((s, v) => s + (Number(v) || 0), 0);
      } else {
        totalVol = Number(plan.totalPlannedVolume) || (Number(plan.plannedDailyRate || 0) * Number(plan.totalPlannedDays || 1)) || 0;
      }
      if (Number.isFinite(totalVol) && totalVol > 0) {
        map[plan.orderId] = (map[plan.orderId] || 0) + totalVol;
      }
    });
    return map;
  }, [existingPlans]);

  // Sum of Tentative Allocations per Order in current simulation
  const tentativeOrderAllocatedMap = useMemo(() => {
    const map: Record<string, number> = {};
    tentativeAllocations.forEach(a => {
      const vol = Number(a.allocatedVolume) || 0;
      if (Number.isFinite(vol) && vol > 0) {
        map[a.orderId] = (map[a.orderId] || 0) + vol;
      }
    });
    return map;
  }, [tentativeAllocations]);

  // Total Allocated Volume per Order (Existing active plans + Tentative simulation allocations)
  const totalOrderAllocatedMap = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      const existing = existingOrderPlanVolumeMap[o.id] || 0;
      const tentative = tentativeOrderAllocatedMap[o.id] || 0;
      map[o.id] = (Number.isFinite(existing) ? existing : 0) + (Number.isFinite(tentative) ? tentative : 0);
    });
    return map;
  }, [orders, existingOrderPlanVolumeMap, tentativeOrderAllocatedMap]);

  // Helper to get order target volume reliably from all sales order quantity fields or fallback plans
  const getOrderTargetVolume = (o?: ProductionOrder | null, fallbackPlans?: ProductionPlan[]): number => {
    if (!o) return 0;
    const raw =
      (o as any).quantity ??
      (o as any).targetVolume ??
      (o as any).targetQuantity ??
      (o as any)['Target Volume'] ??
      (o as any)['Target Quantity'] ??
      (o as any)['Target Volume (Units)'] ??
      (o as any)['Target Quantity (Units)'] ??
      (o as any)['Quantity'] ??
      (o as any).qty ??
      (o as any).volume ??
      (o as any).totalVolume ??
      (o as any).orderQuantity ??
      (o as any).salesTargetVolume ??
      (o as any).salesOrderVolume ??
      (o as any).orderQty ??
      (o as any).units ??
      0;

    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }

    // Fallback: If order.quantity is 0 / undefined, check if any existing plans exist for this order
    if (fallbackPlans && fallbackPlans.length > 0) {
      const plansForOrder = fallbackPlans.filter(p => p.orderId === o.id && p.status !== 'CANCELLED');
      if (plansForOrder.length > 0) {
        const planSum = plansForOrder.reduce((sum, p) => {
          if (p.dailyVolumeOverrides && Object.keys(p.dailyVolumeOverrides).length > 0) {
            return sum + Object.values(p.dailyVolumeOverrides).reduce((s, v) => s + (Number(v) || 0), 0);
          }
          return sum + (Number(p.totalPlannedVolume) || (Number(p.plannedDailyRate || 0) * Number(p.totalPlannedDays || 1)) || 0);
        }, 0);
        if (planSum > 0) return planSum;
      }
    }

    return 0;
  };

  // Auto-calculated Unallocated Remaining Quantity Map per Order
  const orderRemainingMap = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      const totalQty = getOrderTargetVolume(o, existingPlans);
      const allocated = totalOrderAllocatedMap[o.id] || 0;
      map[o.id] = Math.max(0, totalQty - allocated);
    });
    return map;
  }, [orders, totalOrderAllocatedMap, existingPlans]);

  // Orders Directory for Handsontable (Shows all registered orders)
  const pendingOrders = useMemo(() => {
    return orders;
  }, [orders]);

  // Handsontable Data Format
  const hotOrdersData = useMemo(() => {
    return pendingOrders.map((o, idx) => {
      const catName = categoryMap[o.categoryId] || 'General';
      const targetQty = getOrderTargetVolume(o, existingPlans);
      const simAllocated = tentativeOrderAllocatedMap[o.id] || 0;
      const totalAllocated = totalOrderAllocatedMap[o.id] || 0;
      const remaining = Math.max(0, targetQty - totalAllocated);
      const dueStr = toLocalDateString(o.dueDate);

      return {
        rowNum: idx + 1,
        id: o.id,
        orderNumber: o.orderNumber || 'N/A',
        productName: o.productName || 'N/A',
        category: catName,
        targetVolume: targetQty,
        allocatedQuantity: totalAllocated,
        currentlySimAllocation: simAllocated,
        remainingQuantity: remaining,
        dueDate: dueStr,
        priority: o.priority || 'MEDIUM',
        status: o.status,
        actions: 'ACTIONS'
      };
    });
  }, [pendingOrders, categoryMap, tentativeOrderAllocatedMap, totalOrderAllocatedMap, existingPlans]);

  // ----------------------------------------------------
  // FEASIBILITY & CLASH DETECTION ENGINE
  // ----------------------------------------------------
  const feasibilityAnalysis = useMemo(() => {
    const clashes: Array<{
      type: 'CAPACITY_OVERLOAD' | 'HOLIDAY_OVERLAP' | 'DUE_DATE_BREACH' | 'MACHINE_INACTIVE';
      severity: 'ERROR' | 'WARNING';
      title: string;
      description: string;
      machineCode?: string;
      orderNumber?: string;
      dateStr?: string;
    }> = [];

    let totalAllocatedVol = 0;
    let totalCapacityAcrossWindow = 0;

    activeMachines.forEach(machine => {
      timelineDates.forEach(({ dateStr }) => {
        const holiday = holidayMap[dateStr];
        const downtimeMins = Number(downtimeMap[`${machine.id}_${dateStr}`]) || 0;
        const opHours = Number(machine.operatingHours) || 24;
        const dailyCap = Number(machine.dailyCapacity) || 1000;
        
        let effectiveCapacity = dailyCap;
        if (holiday) {
          effectiveCapacity = 0;
        } else if (downtimeMins > 0) {
          const lostHours = downtimeMins / 60;
          const availableHours = Math.max(0, opHours - lostHours);
          effectiveCapacity = Math.round((availableHours / opHours) * dailyCap);
        }

        totalCapacityAcrossWindow += (Number.isFinite(effectiveCapacity) ? effectiveCapacity : 0);

        const existingVol = Number(existingPlanVolumeMap[`${machine.id}_${dateStr}`]) || 0;
        const tentativeForSlot = tentativeAllocations.filter(
          a => a.machineId === machine.id && a.dateStr === dateStr
        );
        const tentativeVol = tentativeForSlot.reduce((sum, a) => sum + (Number(a.allocatedVolume) || 0), 0);
        const totalUsed = existingVol + tentativeVol;

        totalAllocatedVol += tentativeVol;

        // 1. Holiday Clash Check
        if (holiday && tentativeVol > 0) {
          clashes.push({
            type: 'HOLIDAY_OVERLAP',
            severity: 'ERROR',
            title: `Holiday Overlap on ${machine.machineCode}`,
            description: `${tentativeVol.toLocaleString()} units scheduled on ${dateStr} which is marked as holiday "${holiday.name}".`,
            machineCode: machine.machineCode,
            dateStr
          });
        }

        // 2. Capacity Overload Clash Check
        if (totalUsed > effectiveCapacity && effectiveCapacity >= 0) {
          const over = totalUsed - effectiveCapacity;
          clashes.push({
            type: 'CAPACITY_OVERLOAD',
            severity: 'ERROR',
            title: `Capacity Exceeded on ${machine.machineCode}`,
            description: `Total allocated (${totalUsed.toLocaleString()} u) exceeds daily capacity (${effectiveCapacity.toLocaleString()} u) by ${over.toLocaleString()} units on ${dateStr}.`,
            machineCode: machine.machineCode,
            dateStr
          });
        }
      });
    });

    // 3. Due Date Breach Check
    tentativeAllocations.forEach(alloc => {
      const orderObj = orders.find(o => o.id === alloc.orderId);
      if (orderObj) {
        const dueStr = toLocalDateString(orderObj.dueDate);
        if (alloc.dateStr > dueStr) {
          clashes.push({
            type: 'DUE_DATE_BREACH',
            severity: 'WARNING',
            title: `Due Date Violation: ${orderObj.orderNumber}`,
            description: `Scheduled on ${alloc.dateStr} which is AFTER the expected delivery date ${dueStr}.`,
            orderNumber: orderObj.orderNumber,
            dateStr: alloc.dateStr
          });
        }
      }
    });

    const isDoable = clashes.length === 0 && tentativeAllocations.length > 0;
    const hasCriticalClashes = clashes.some(c => c.severity === 'ERROR');

    return {
      isDoable,
      hasCriticalClashes,
      clashes,
      totalAllocatedVol,
      totalCapacityAcrossWindow,
      allocationCount: tentativeAllocations.length
    };
  }, [
    activeMachines,
    timelineDates,
    holidayMap,
    downtimeMap,
    existingPlanVolumeMap,
    tentativeAllocations,
    orders
  ]);

  // ----------------------------------------------------
  // MULTI-MACHINE & DATE RANGE PLANNER ENGINE
  // ----------------------------------------------------
  // Open Multi-Machine Range Planner Dialog
  const handleOpenRangePlanner = (order?: ProductionOrder) => {
    const targetOrder = order || selectedOrderToAllocate || null;
    setRangePlanOrder(targetOrder);
    const initialMachines = activeMachines.map(m => m.id);
    setRangeSelectedMachineIds(initialMachines);
    
    const start = windowStartDate;
    const due = targetOrder?.dueDate ? toLocalDateString(targetOrder.dueDate) : toLocalDateString(new Date(Date.now() + 6 * 86400000));
    const end = due >= start ? due : toLocalDateString(new Date(parseLocalDate(start).getTime() + 6 * 86400000));
    
    setRangeStartDate(start);
    setRangeEndDate(end);

    // Initial Auto-Fill calculation if order is chosen
    if (targetOrder) {
      calculateRangeAutoFill(targetOrder, initialMachines, start, end);
    } else {
      setRangeDailyVolumes({});
    }
    setRangePlannerOpen(true);
  };

  // Helper to compute range dates array
  const getRangeDates = (startStr: string, endStr: string) => {
    const list: Array<{ dateStr: string; dayName: string; isHoliday: boolean; holidayName?: string }> = [];
    if (!startStr || !endStr) return list;
    const cur = parseLocalDate(startStr);
    const end = parseLocalDate(endStr);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    while (cur <= end) {
      const dStr = toLocalDateString(cur);
      const hol = holidayMap[dStr];
      list.push({
        dateStr: dStr,
        dayName: dayNames[cur.getDay()],
        isHoliday: !!hol,
        holidayName: hol?.name
      });
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  };

  // Auto-Fill range daily plan map based on working days and available capacities
  const calculateRangeAutoFill = (
    order: ProductionOrder,
    machineIds: string[],
    startStr: string,
    endStr: string,
    mode: 'CAPACITY' | 'EVEN' | 'MAX' | 'CLEAR' = 'CAPACITY'
  ) => {
    const totalOrderQty = getOrderTargetVolume(order);
    const unallocated = orderRemainingMap[order.id] ?? Math.max(0, totalOrderQty - (totalOrderAllocatedMap[order.id] || 0));
    const dates = getRangeDates(startStr, endStr).filter(d => !d.isHoliday);
    const targetMachines = activeMachines.filter(m => machineIds.includes(m.id));

    if (mode === 'CLEAR') {
      const emptyMap: Record<string, number> = {};
      targetMachines.forEach(m => {
        dates.forEach(d => {
          emptyMap[`${m.id}_${d.dateStr}`] = 0;
        });
      });
      setRangeDailyVolumes(emptyMap);
      return;
    }

    const newVolumes: Record<string, number> = {};
    let remainingToPlan = unallocated;

    if (mode === 'EVEN') {
      const totalSlots = Math.max(1, targetMachines.length * dates.length);
      const evenVol = Math.floor(unallocated / totalSlots);
      let remainderAcc = unallocated % totalSlots;

      targetMachines.forEach(m => {
        dates.forEach(d => {
          const key = `${m.id}_${d.dateStr}`;
          const extra = remainderAcc > 0 ? 1 : 0;
          if (remainderAcc > 0) remainderAcc--;
          newVolumes[key] = Math.max(0, evenVol + extra);
        });
      });
      setRangeDailyVolumes(newVolumes);
      return;
    }

    if (mode === 'MAX') {
      targetMachines.forEach(m => {
        dates.forEach(d => {
          const key = `${m.id}_${d.dateStr}`;
          const downtimeMins = Number(downtimeMap[`${m.id}_${d.dateStr}`]) || 0;
          const opHours = Number(m.operatingHours) || 24;
          const dailyCap = Number(m.dailyCapacity) || 1000;
          let effectiveCap = dailyCap;
          if (downtimeMins > 0) {
            const lost = downtimeMins / 60;
            effectiveCap = Math.round((Math.max(0, opHours - lost) / opHours) * dailyCap);
          }
          const existing = Number(existingPlanVolumeMap[`${m.id}_${d.dateStr}`]) || 0;
          const tentative = tentativeAllocations
            .filter(a => a.machineId === m.id && a.dateStr === d.dateStr)
            .reduce((s, a) => s + (Number(a.allocatedVolume) || 0), 0);
          const avail = Math.max(0, effectiveCap - (existing + tentative));
          newVolumes[key] = avail;
        });
      });
      setRangeDailyVolumes(newVolumes);
      return;
    }

    // Default: 'CAPACITY' proportional auto-fill
    for (const d of dates) {
      if (remainingToPlan <= 0) break;

      for (const m of targetMachines) {
        if (remainingToPlan <= 0) break;

        const key = `${m.id}_${d.dateStr}`;
        const downtimeMins = Number(downtimeMap[`${m.id}_${d.dateStr}`]) || 0;
        const opHours = Number(m.operatingHours) || 24;
        const dailyCap = Number(m.dailyCapacity) || 1000;
        let effectiveCap = dailyCap;
        if (downtimeMins > 0) {
          const lost = downtimeMins / 60;
          effectiveCap = Math.round((Math.max(0, opHours - lost) / opHours) * dailyCap);
        }
        const existing = Number(existingPlanVolumeMap[`${m.id}_${d.dateStr}`]) || 0;
        const tentative = tentativeAllocations
          .filter(a => a.machineId === m.id && a.dateStr === d.dateStr)
          .reduce((s, a) => s + (Number(a.allocatedVolume) || 0), 0);
        const avail = Math.max(0, effectiveCap - (existing + tentative));

        if (avail > 0) {
          const chunk = Math.min(remainingToPlan, avail);
          newVolumes[key] = chunk;
          remainingToPlan -= chunk;
        } else {
          newVolumes[key] = 0;
        }
      }
    }

    // Fill zeroes for remaining slots
    targetMachines.forEach(m => {
      dates.forEach(d => {
        const key = `${m.id}_${d.dateStr}`;
        if (newVolumes[key] === undefined) {
          newVolumes[key] = 0;
        }
      });
    });

    setRangeDailyVolumes(newVolumes);
  };

  // Apply Range Plan to Tentative Simulation Allocations
  const handleApplyRangePlan = () => {
    if (!rangePlanOrder) return;
    const newAllocs: TentativeAllocation[] = [];

    for (const key in rangeDailyVolumes) {
      const vol = Number(rangeDailyVolumes[key]) || 0;
      if (vol <= 0) continue;

      const [machineId, dateStr] = key.split('_');
      const machineObj = machines.find(m => m.id === machineId);
      if (!machineObj) continue;

      newAllocs.push({
        id: `range_${Date.now()}_${Math.floor(Math.random() * 100000)}_${key}`,
        orderId: rangePlanOrder.id,
        orderNumber: rangePlanOrder.orderNumber,
        productName: rangePlanOrder.productName,
        categoryId: rangePlanOrder.categoryId,
        machineId: machineObj.id,
        machineCode: machineObj.machineCode,
        dateStr,
        allocatedVolume: vol
      });
    }

    if (newAllocs.length === 0) {
      showToast('No daily volumes entered to allocate.', 'warning');
      return;
    }

    setTentativeAllocations(prev => [...prev, ...newAllocs]);
    setRangePlannerOpen(false);

    const totalApplied = newAllocs.reduce((s, a) => s + a.allocatedVolume, 0);
    const orderRem = orderRemainingMap[rangePlanOrder.id] ?? 0;
    const remAfter = Math.max(0, orderRem - totalApplied);

    showToast(
      `Planned ${totalApplied.toLocaleString()} units of ${rangePlanOrder.orderNumber} across ${newAllocs.length} slot(s). (${remAfter.toLocaleString()} units unallocated remaining)`,
      'success'
    );
  };

  // ----------------------------------------------------
  // SINGLE SLOT & EDIT ALLOCATION ACTIONS
  // ----------------------------------------------------
  // Quick Slot Allocator Opener
  const handleOpenSlotModal = (machine: Machine, dateStr: string) => {
    const holiday = holidayMap[dateStr];
    if (holiday) {
      showToast(`Cannot allocate on ${dateStr}: Factory Holiday (${holiday.name})`, 'warning');
      return;
    }

    const downtimeMins = Number(downtimeMap[`${machine.id}_${dateStr}`]) || 0;
    const opHours = Number(machine.operatingHours) || 24;
    const dailyCap = Number(machine.dailyCapacity) || 1000;

    let effectiveCap = dailyCap;
    if (downtimeMins > 0) {
      const lostHours = downtimeMins / 60;
      const availableHours = Math.max(0, opHours - lostHours);
      effectiveCap = Math.round((availableHours / opHours) * dailyCap);
    }

    const existingVol = Number(existingPlanVolumeMap[`${machine.id}_${dateStr}`]) || 0;
    const existingTentative = tentativeAllocations.filter(
      a => a.machineId === machine.id && a.dateStr === dateStr
    );
    const tentativeVol = existingTentative.reduce((sum, a) => sum + (Number(a.allocatedVolume) || 0), 0);
    const availableCap = Math.max(0, effectiveCap - (existingVol + tentativeVol));

    const defaultOrder = (selectedOrderToAllocate && (orderRemainingMap[selectedOrderToAllocate.id] || 0) > 0)
      ? selectedOrderToAllocate
      : null;

    const remainingForOrder = defaultOrder
      ? (orderRemainingMap[defaultOrder.id] ?? Math.max(0, (Number(defaultOrder.quantity) || 0) - (totalOrderAllocatedMap[defaultOrder.id] || 0)))
      : 0;

    const initialVolume = defaultOrder && remainingForOrder > 0
      ? (availableCap > 0 ? Math.min(availableCap, remainingForOrder) : remainingForOrder)
      : 0;

    setSlotForm({
      orderId: defaultOrder?.id || '',
      volume: Number.isFinite(initialVolume) && initialVolume > 0 ? initialVolume : 0
    });

    setSlotModal({
      open: true,
      machine,
      dateStr,
      existingAllocations: existingTentative,
      availableCap,
      effectiveCap
    });
  };

  // Add Tentative Allocation from Modal
  const handleAddSlotAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    const vol = Number(slotForm.volume);
    if (!slotModal.machine || !slotForm.orderId || !Number.isFinite(vol) || vol <= 0) {
      showToast('Please select an order and enter a valid positive volume number.', 'warning');
      return;
    }

    const orderObj = orders.find(o => o.id === slotForm.orderId);
    if (!orderObj) {
      showToast('Selected order not found.', 'error');
      return;
    }

    const currentRemaining = orderRemainingMap[orderObj.id] ?? Math.max(0, getOrderTargetVolume(orderObj) - (totalOrderAllocatedMap[orderObj.id] || 0));

    const newAlloc: TentativeAllocation = {
      id: `alloc_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      orderId: orderObj.id,
      orderNumber: orderObj.orderNumber,
      productName: orderObj.productName,
      categoryId: orderObj.categoryId,
      machineId: slotModal.machine.id,
      machineCode: slotModal.machine.machineCode,
      dateStr: slotModal.dateStr,
      allocatedVolume: vol
    };

    setTentativeAllocations(prev => [...prev, newAlloc]);
    setSlotModal(prev => ({ ...prev, open: false }));

    const updatedRemaining = Math.max(0, currentRemaining - vol);
    showToast(
      `Allocated ${vol.toLocaleString()} units of ${orderObj.orderNumber} on ${slotModal.dateStr}. (${updatedRemaining.toLocaleString()} units unallocated remaining)`,
      'success'
    );
  };

  // Delete Confirmed or Draft Plan Daily Volume Mutation
  const deletePlanDayMutation = useMutation({
    mutationFn: async ({ plan, dateStr }: { plan: ProductionPlan; dateStr: string }) => {
      const dailyOverrides: Record<string, number> = { ...(plan.dailyVolumeOverrides || {}) };
      dailyOverrides[dateStr] = 0; // Clear / delete this day's unit count

      // Recompute total planned volume across start & end dates
      const cur = parseLocalDate(toLocalDateString(plan.startDate));
      const end = parseLocalDate(toLocalDateString(plan.endDate));
      let totalVol = 0;
      let dayCount = 0;

      while (cur <= end) {
        const dStr = toLocalDateString(cur);
        const dayV = dailyOverrides[dStr] !== undefined ? dailyOverrides[dStr] : (plan.plannedDailyRate || 0);
        totalVol += Math.max(0, dayV);
        dayCount++;
        cur.setDate(cur.getDate() + 1);
      }

      const avgDailyRate = Math.round(totalVol / Math.max(1, dayCount));

      await updateProductionPlan(plan.id, {
        dailyVolumeOverrides: dailyOverrides,
        totalPlannedVolume: totalVol,
        plannedDailyRate: avgDailyRate
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      setDeleteUnitModal(prev => ({ ...prev, open: false }));
      showToast('Production unit count deleted and removed from schedule.', 'success');
    },
    onError: (err: any) => {
      showToast(`Failed to delete plan units: ${err.message}`, 'error');
    }
  });

  // Confirm Delete Handler (both Tentative and Confirmed)
  const handleConfirmDeleteUnits = () => {
    if (deleteUnitModal.type === 'TENTATIVE' && deleteUnitModal.allocId) {
      const allocId = deleteUnitModal.allocId;
      const vol = deleteUnitModal.volume;
      const ordNum = deleteUnitModal.orderNumber;
      setTentativeAllocations(prev => prev.filter(a => a.id !== allocId));
      setDeleteUnitModal(prev => ({ ...prev, open: false }));
      showToast(`Deleted allocation of ${vol.toLocaleString()} units for ${ordNum}.`, 'info');
    } else if (deleteUnitModal.type === 'CONFIRMED_PLAN' && deleteUnitModal.plan) {
      deletePlanDayMutation.mutate({
        plan: deleteUnitModal.plan,
        dateStr: deleteUnitModal.dateStr
      });
    }
  };

  // Clear Simulation
  const handleClearSimulation = () => {
    setTentativeAllocations([]);
    setSelectedOrderToAllocate(null);
    showToast('Simulation cleared. All tentative allocations reset.', 'info');
  };

  // ----------------------------------------------------
  // MUTATION: CONFIRM & CREATE SCHEDULE
  // ----------------------------------------------------
  const confirmScheduleMutation = useMutation({
    mutationFn: async () => {
      if (tentativeAllocations.length === 0) {
        throw new Error('No tentative allocations to create.');
      }

      const planGroups: Record<string, TentativeAllocation[]> = {};
      tentativeAllocations.forEach(a => {
        const key = `${a.orderId}_${a.machineId}`;
        if (!planGroups[key]) planGroups[key] = [];
        planGroups[key].push(a);
      });

      const affectedOrderIds = new Set<string>();

      for (const groupKey in planGroups) {
        const items = planGroups[groupKey];
        if (items.length === 0) continue;

        const first = items[0];
        const machineObj = machines.find(m => m.id === first.machineId);

        items.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
        const startDate = parseLocalDate(items[0].dateStr);
        const endDate = parseLocalDate(items[items.length - 1].dateStr);

        const totalPlannedVolume = items.reduce((sum, item) => sum + (Number(item.allocatedVolume) || 0), 0);
        const totalPlannedDays = Math.max(1, items.length);
        const avgDailyRate = Math.round(totalPlannedVolume / totalPlannedDays);
        const opHours = Number(machineObj?.operatingHours) || 24;

        // Construct dailyVolumeOverrides
        const dailyOverrides: Record<string, number> = {};
        items.forEach(item => {
          dailyOverrides[item.dateStr] = Number(item.allocatedVolume) || 0;
        });

        await createProductionPlan({
          tenantId,
          orderId: first.orderId,
          machineId: first.machineId,
          startDate,
          endDate,
          type: planType,
          plannedDailyRate: avgDailyRate,
          plannedHourlyRate: Math.round(avgDailyRate / opHours),
          totalPlannedDays,
          totalPlannedVolume,
          operatingHoursPerDay: opHours,
          dailyVolumeOverrides: dailyOverrides,
          status: 'PLANNED',
          notes: `Created via Schedule Creation simulation (${items.map(i => `${i.dateStr}:${i.allocatedVolume}u`).join(', ')})`
        });

        affectedOrderIds.add(first.orderId);
      }

      for (const orderId of affectedOrderIds) {
        await updateProductionOrder(orderId, {
          status: planType === 'CONFIRMED' ? 'SCHEDULED' : 'DRAFT_PLANNED'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      setConfirmModalOpen(false);
      setTentativeAllocations([]);
      showToast('Schedule created and confirmed successfully!', 'success');
      navigate('/production-schedule');
    },
    onError: (err: any) => {
      showToast(`Failed to create schedule: ${err.message}`, 'error');
    }
  });

  // Calculate Range Planner summary numbers
  const rangePlanDatesList = useMemo(() => {
    return getRangeDates(rangeStartDate, rangeEndDate);
  }, [rangeStartDate, rangeEndDate, holidayMap]);

  const rangePlanTotalBatch = useMemo((): number => {
    return Object.values(rangeDailyVolumes).reduce((sum: number, v) => sum + (Number(v) || 0), 0);
  }, [rangeDailyVolumes]);

  const rangePlanOrderRem = useMemo((): number => {
    if (!rangePlanOrder) return 0;
    const totalOrderQty = getOrderTargetVolume(rangePlanOrder);
    return (orderRemainingMap[rangePlanOrder.id] ?? Math.max(0, totalOrderQty - (totalOrderAllocatedMap[rangePlanOrder.id] || 0))) as number;
  }, [rangePlanOrder, orderRemainingMap, totalOrderAllocatedMap]);

  return (
    <Box sx={{ py: 1 }}>
      {/* HEADER */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonthIcon sx={{ color: '#4f46e5', fontSize: 30 }} />
            Schedule Creation & Capacity Simulator
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<TuneIcon />}
            onClick={() => handleOpenRangePlanner()}
            sx={{
              borderRadius: '10px',
              fontWeight: 700,
              textTransform: 'none',
              bgcolor: '#6366f1',
              color: '#ffffff',
              '&:hover': { bgcolor: '#4f46e5' }
            }}
          >
            Plan
          </Button>

          <Button
            variant="outlined"
            color="inherit"
            startIcon={<DeleteIcon />}
            onClick={handleClearSimulation}
            disabled={tentativeAllocations.length === 0}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, color: '#64748b' }}
          >
            Clear
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<AssignmentTurnedInIcon />}
            onClick={() => setConfirmModalOpen(true)}
            disabled={tentativeAllocations.length === 0 || feasibilityAnalysis.hasCriticalClashes}
            sx={{
              borderRadius: '10px',
              fontWeight: 700,
              textTransform: 'none',
              px: 2.5,
              py: 1,
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
            }}
          >
            Confirm
          </Button>
        </Stack>
      </Box>

      {/* FEASIBILITY & CLASH BANNER */}
      {tentativeAllocations.length > 0 && (
        <Card
          sx={{
            mb: 3,
            borderRadius: '16px',
            border: `1.5px solid ${
              feasibilityAnalysis.hasCriticalClashes
                ? '#f87171'
                : feasibilityAnalysis.clashes.length > 0
                ? '#fbbf24'
                : '#86efac'
            }`,
            bgcolor: feasibilityAnalysis.hasCriticalClashes
              ? '#fff5f5'
              : feasibilityAnalysis.clashes.length > 0
              ? '#fffbeb'
              : '#f0fdf4',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {feasibilityAnalysis.hasCriticalClashes ? (
                  <ErrorIcon sx={{ color: '#dc2626', fontSize: 32 }} />
                ) : feasibilityAnalysis.clashes.length > 0 ? (
                  <WarningIcon sx={{ color: '#d97706', fontSize: 32 }} />
                ) : (
                  <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 32 }} />
                )}
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {feasibilityAnalysis.hasCriticalClashes
                      ? 'Capacity / Calendar Clash Detected'
                      : feasibilityAnalysis.clashes.length > 0
                      ? 'Tentative Schedule has Warnings'
                      : 'Tentative Schedule is 100% Feasible & Doable!'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#475569' }}>
                    {feasibilityAnalysis.hasCriticalClashes
                      ? `${feasibilityAnalysis.clashes.length} critical capacity or holiday conflict(s) must be resolved before confirming.`
                      : feasibilityAnalysis.clashes.length > 0
                      ? 'Schedule fits machine capacity, but please review delivery due date warnings.'
                      : `All ${feasibilityAnalysis.totalAllocatedVol.toLocaleString()} units fit perfectly within daily operating capacities across active working days.`}
                  </Typography>
                </Box>
              </Box>

              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Chip
                  label={`Allocated: ${feasibilityAnalysis.totalAllocatedVol.toLocaleString()} Units`}
                  size="small"
                  sx={{ fontWeight: 700, bgcolor: '#ffffff', border: '1px solid #cbd5e1' }}
                />
                <Chip
                  label={`Jobs: ${feasibilityAnalysis.allocationCount}`}
                  size="small"
                  sx={{ fontWeight: 700, bgcolor: '#ffffff', border: '1px solid #cbd5e1' }}
                />
              </Stack>
            </Box>

            {/* List of Clashes if any */}
            {feasibilityAnalysis.clashes.length > 0 && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #e2e8f0' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                  Issues to Resolve:
                </Typography>
                <Stack spacing={0.8} sx={{ mt: 0.5 }}>
                  {feasibilityAnalysis.clashes.map((c, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.8rem', color: c.severity === 'ERROR' ? '#991b1b' : '#92400e' }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.severity === 'ERROR' ? '#ef4444' : '#f59e0b' }} />
                      <strong>{c.title}:</strong> {c.description}
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 1: PRODUCTION ORDERS DIRECTORY (HANDSONTABLE) */}
      <Card sx={{ mb: 3, borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <TableViewIcon sx={{ color: '#6366f1' }} />
                1. Select Production Orders to Schedule
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Review auto-calculated unallocated remaining volume. Click "Multi-Machine Plan" to select multiple lines & date range, or "Select" to allocate into specific machine slots below.
              </Typography>
            </Box>

            {selectedOrderToAllocate && (
              <Chip
                label={`Active Selection: ${selectedOrderToAllocate.orderNumber} (${selectedOrderToAllocate.productName}) - Remaining: ${(orderRemainingMap[selectedOrderToAllocate.id] ?? 0).toLocaleString()} u`}
                color="primary"
                onDelete={() => setSelectedOrderToAllocate(null)}
                sx={{ fontWeight: 700 }}
              />
            )}
          </Box>

          {/* Handsontable Grid */}
          <Box
            sx={{
              width: '100%',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              '& .handsontable': { fontFamily: 'inherit', fontSize: '0.85rem' },
              '& .htCore th': { bgcolor: '#f8fafc', color: '#0f172a', fontWeight: 700, py: 1 },
              '& .htCore td': { py: 0.8, color: '#334155' }
            }}
          >
            {loadingOrders ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <CircularProgress size={28} />
              </Box>
            ) : hotOrdersData.length > 0 ? (
              <HotTable
                data={hotOrdersData}
                readOnly={true}
                colHeaders={[
                  '#',
                  'Order Number',
                  'Product Name',
                  'Category',
                  'Target Volume',
                  'Allocated Volume',
                  'Currently Sim Allocation',
                  'Remaining Volume',
                  'Exp. Delivery Date',
                  'Priority',
                  'Actions'
                ]}
                columns={[
                  { data: 'rowNum', readOnly: true, width: 45, className: 'htCenter htMiddle' },
                  { data: 'orderNumber', readOnly: true, width: 130, className: 'htCenter htMiddle font-semibold' },
                  { data: 'productName', readOnly: true, width: 200, className: 'htMiddle' },
                  { data: 'category', readOnly: true, width: 130, className: 'htMiddle' },
                  {
                    data: 'targetVolume',
                    readOnly: true,
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 130,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any, cellProperties: any) => {
                      const rowIdx = cellProperties.row;
                      const orderObj = pendingOrders[rowIdx];
                      const orderTarget = getOrderTargetVolume(orderObj, existingPlans);
                      const val = (Number.isFinite(Number(value)) && Number(value) > 0) ? Number(value) : (orderTarget > 0 ? orderTarget : 0);
                      td.innerHTML = `<span style="font-weight: 800; color: #0f172a;">${val.toLocaleString()} u</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'allocatedQuantity',
                    readOnly: true,
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 130,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any, cellProperties: any) => {
                      const rowIdx = cellProperties.row;
                      const orderObj = pendingOrders[rowIdx];
                      const totalAlloc = orderObj ? (totalOrderAllocatedMap[orderObj.id] ?? (Number(value) || 0)) : (Number(value) || 0);
                      td.innerHTML = `<span style="color: ${totalAlloc > 0 ? '#166534' : '#64748b'}; font-weight: 700;">${totalAlloc.toLocaleString()} u</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'currentlySimAllocation',
                    readOnly: true,
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 160,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any, cellProperties: any) => {
                      const rowIdx = cellProperties.row;
                      const orderObj = pendingOrders[rowIdx];
                      const simAlloc = orderObj ? (tentativeOrderAllocatedMap[orderObj.id] ?? (Number(value) || 0)) : (Number(value) || 0);
                      td.innerHTML = `<span style="color: ${simAlloc > 0 ? '#4338ca' : '#94a3b8'}; font-weight: 700;">${simAlloc.toLocaleString()} u</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'remainingQuantity',
                    readOnly: true,
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 150,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any, cellProperties: any) => {
                      const rowIdx = cellProperties.row;
                      const orderObj = pendingOrders[rowIdx];
                      const target = orderObj ? getOrderTargetVolume(orderObj, existingPlans) : (Number(value) || 0);
                      const totalAlloc = orderObj ? (totalOrderAllocatedMap[orderObj.id] ?? 0) : 0;
                      const rem = Math.max(0, target - totalAlloc);
                      const isComplete = rem === 0;
                      td.innerHTML = `<span style="color: ${isComplete ? '#16a34a' : '#b45309'}; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">${rem.toLocaleString()} u ${isComplete ? '<span style="color: #16a34a; font-weight: 800; font-size: 11px;">(Complete)</span>' : ''}</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  { data: 'dueDate', readOnly: true, width: 130, className: 'htCenter htMiddle' },
                  {
                    data: 'priority',
                    readOnly: true,
                    width: 100,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any) => {
                      const val = String(value || '').toUpperCase();
                      let bg = '#f1f5f9';
                      let color = '#475569';
                      if (val === 'HIGH') { bg = '#fee2e2'; color = '#b91c1c'; }
                      else if (val === 'MEDIUM') { bg = '#fef3c7'; color = '#b45309'; }
                      else if (val === 'LOW') { bg = '#f0fdf4'; color = '#15803d'; }
                      td.innerHTML = `<span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: ${bg}; color: ${color};">${val || 'MEDIUM'}</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'actions',
                    readOnly: true,
                    width: 240,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, _value: any, cellProperties: any) => {
                      const rowIdx = cellProperties.row;
                      const orderObj = pendingOrders[rowIdx];
                      const isSelected = selectedOrderToAllocate?.id === orderObj?.id;
                      const rem = orderRemainingMap[orderObj?.id] ?? 0;
                      const isComplete = rem === 0;

                      td.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                          <button type="button" class="btn-select-order" style="background: ${isSelected ? '#4338ca' : '#eef2ff'}; color: ${isSelected ? '#ffffff' : '#4338ca'}; border: 1px solid #c7d2fe; border-radius: 6px; padding: 3px 8px; font-weight: 700; font-size: 11px; cursor: pointer;">
                            ${isSelected ? 'Selected' : 'Select'}
                          </button>
                          <button type="button" class="btn-range-plan" style="background: ${isComplete ? '#f1f5f9' : '#eff6ff'}; color: ${isComplete ? '#64748b' : '#1d4ed8'}; border: 1px solid ${isComplete ? '#cbd5e1' : '#bfdbfe'}; border-radius: 6px; padding: 3px 8px; font-weight: 700; font-size: 11px; cursor: pointer;">
                            ${isComplete ? 'Adjust Plan' : 'Multi-Machine Plan'}
                          </button>
                        </div>
                      `;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  }
                ]}
                afterOnCellMouseDown={(event: any, coords: any) => {
                  if (coords.col === 10 && coords.row >= 0) {
                    event.stopImmediatePropagation();
                    const targetEl = event.target as HTMLElement;
                    const orderObj = pendingOrders[coords.row];
                    if (!orderObj) return;

                    if (targetEl.classList.contains('btn-select-order')) {
                      setSelectedOrderToAllocate(orderObj);
                      const rem = orderRemainingMap[orderObj.id] ?? 0;
                      showToast(`Selected ${orderObj.orderNumber} (${rem.toLocaleString()} units unallocated). Click any slot below or use Multi-Machine Plan!`, 'info');
                    } else if (targetEl.classList.contains('btn-range-plan')) {
                      handleOpenRangePlanner(orderObj);
                    }
                  }
                }}
                rowHeaders={true}
                height="auto"
                width="100%"
                colWidths={[45, 130, 200, 130, 130, 130, 160, 150, 130, 100, 240]}
                stretchH="all"
                licenseKey="non-commercial-and-evaluation"
              />
            ) : (
              <Box sx={{ py: 4, textAlign: 'center', color: '#64748b' }}>
                No pending orders found. Create orders in Production Orders first.
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* SECTION 2: TENTATIVE MACHINE CAPACITY TIMELINE VIEW */}
      <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          {/* Controls Bar: Window Date & Plant Filter */}
          <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <DateRangeIcon sx={{ color: '#6366f1' }} />
                2. Machine Capacity & Timeline Simulator
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Color-coded daily headroom. Click on any job or slot to adjust individual daily volumes in simulation or confirmed plans.
              </Typography>
            </Box>

            {/* Horizon & Navigation Controls */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              {/* Category Filter */}
              <FormControl size="small" sx={{ width: 170 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  label="Category"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                >
                  <MenuItem value="all">All Categories ({categories.length})</MenuItem>
                  {categories.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                  <MenuItem value="uncategorized">General / Uncategorized</MenuItem>
                </Select>
              </FormControl>

              {/* Plant Filter */}
              <FormControl size="small" sx={{ width: 150 }}>
                <InputLabel>Plant</InputLabel>
                <Select
                  label="Plant"
                  value={selectedPlantFilter}
                  onChange={(e) => setSelectedPlantFilter(e.target.value)}
                >
                  <MenuItem value="all">All Plants</MenuItem>
                  {plants.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.plantName}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Start Date */}
              <TextField
                label="Timeline Start Date"
                type="date"
                size="small"
                value={windowStartDate}
                onChange={(e) => setWindowStartDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 165 }}
              />

              {/* Window Horizon (7 / 14 / 21 Days) */}
              <FormControl size="small" sx={{ width: 130 }}>
                <InputLabel>Days View</InputLabel>
                <Select
                  label="Days View"
                  value={horizonDays}
                  onChange={(e) => setHorizonDays(Number(e.target.value))}
                >
                  <MenuItem value={7}>7 Days (1 Wk)</MenuItem>
                  <MenuItem value={14}>14 Days (2 Wks)</MenuItem>
                  <MenuItem value={21}>21 Days (3 Wks)</MenuItem>
                </Select>
              </FormControl>

              {/* Pagination Shift */}
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  onClick={() => {
                    const cur = parseLocalDate(windowStartDate);
                    cur.setDate(cur.getDate() - horizonDays);
                    setWindowStartDate(toLocalDateString(cur));
                  }}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}
                >
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setWindowStartDate(toLocalDateString(new Date()))}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
                >
                  Today
                </Button>
                <IconButton
                  size="small"
                  onClick={() => {
                    const cur = parseLocalDate(windowStartDate);
                    cur.setDate(cur.getDate() + horizonDays);
                    setWindowStartDate(toLocalDateString(cur));
                  }}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}
                >
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          </Box>

          {/* COLOR LEGEND */}
          <Box sx={{ mb: 2, p: 1.5, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              Capacity Legend:
            </Typography>
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>
                <Box sx={{ width: 14, height: 14, borderRadius: '4px', bgcolor: '#22c55e' }} />
                Available Headroom
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '0.75rem', color: '#3730a3', fontWeight: 600 }}>
                <Box sx={{ width: 14, height: 14, borderRadius: '4px', bgcolor: '#6366f1' }} />
                Tentative / Scheduled Job
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                <Box sx={{ width: 14, height: 14, borderRadius: '4px', bgcolor: '#f59e0b' }} />
                Near Full (&gt;85%)
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>
                <Box sx={{ width: 14, height: 14, borderRadius: '4px', bgcolor: '#ef4444' }} />
                Over-Capacity / Clash
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                <Box sx={{ width: 14, height: 14, borderRadius: '4px', bgcolor: '#cbd5e1' }} />
                Factory Holiday / Maintenance
              </Box>
            </Stack>
          </Box>

          {/* TIMELINE MATRIX GRID */}
          <Box sx={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <Box sx={{ minWidth: 900 }}>
              {/* Table Header: Machine Col + Date Columns */}
              <Box sx={{ display: 'flex', bgcolor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <Box sx={{ width: 220, minWidth: 220, p: 1.5, fontWeight: 800, color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                  Machine Details
                </Box>
                {timelineDates.map(({ dateStr, dayName, formatted, isWeekend }) => {
                  const holiday = holidayMap[dateStr];
                  return (
                    <Box
                      key={dateStr}
                      sx={{
                        flex: 1,
                        minWidth: 140,
                        p: 1.2,
                        textAlign: 'center',
                        borderRight: '1px solid #e2e8f0',
                        bgcolor: holiday ? '#fef2f2' : isWeekend ? '#f8fafc' : '#f1f5f9'
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 800, color: holiday ? '#dc2626' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, textTransform: 'uppercase' }}>
                        {dayName} {holiday && <EventBusyIcon sx={{ fontSize: 13, color: '#dc2626' }} />}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: holiday ? '#dc2626' : '#0f172a' }}>
                        {formatted}
                      </Typography>
                      {holiday && (
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#b91c1c', display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {holiday.name}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* Machine Rows Grouped by Category */}
              {groupedMachinesByCategory.length > 0 ? (
                groupedMachinesByCategory.map(group => (
                  <React.Fragment key={group.categoryId}>
                    {/* Category Group Header Row */}
                    <Box
                      sx={{
                        display: 'flex',
                        bgcolor: 'rgba(99, 102, 241, 0.06)',
                        borderLeft: '4px solid #4f46e5',
                        borderTop: '2px solid #cbd5e1',
                        borderBottom: '1px solid #cbd5e1',
                        py: 1.2,
                        px: 2,
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CategoryIcon sx={{ color: '#4f46e5', fontSize: 18 }} />
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

                    {/* Machine Rows for this Category */}
                    {group.machines.map(machine => {
                      const plantName = plantMap[machine.plantId] || 'Main Plant';
                      const opHours = Number(machine.operatingHours) || 24;
                      const dailyCap = Number(machine.dailyCapacity) || 1000;
                      const catName = categoryMap[machine.categoryId || ''] || group.categoryName;

                      return (
                        <Box
                          key={machine.id}
                          sx={{
                            display: 'flex',
                            borderBottom: '1px solid #e2e8f0',
                            '&:hover': { bgcolor: '#fcfcfc' }
                          }}
                        >
                          {/* Machine Info Column */}
                          <Box
                            sx={{
                              width: 220,
                              minWidth: 220,
                              p: 1.5,
                              borderRight: '1px solid #e2e8f0',
                              bgcolor: '#fafafa',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.3 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#4f46e5' }}>
                                {machine.machineCode}
                              </Typography>
                              <Chip
                                label={catName}
                                size="small"
                                sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                              {machine.machineName} ({plantName})
                            </Typography>
                            <Box sx={{ mt: 0.8, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              <Chip
                                label={`${dailyCap.toLocaleString()} u/day`}
                                size="small"
                                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#e0e7ff', color: '#3730a3' }}
                              />
                              <Chip
                                label={`${opHours}h`}
                                size="small"
                                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                              />
                            </Box>
                          </Box>

                          {/* Date Cells */}
                          {timelineDates.map(({ dateStr }) => {
                            const holiday = holidayMap[dateStr];
                            const downtimeMins = Number(downtimeMap[`${machine.id}_${dateStr}`]) || 0;

                            let effectiveCap = dailyCap;
                            if (holiday) {
                              effectiveCap = 0;
                            } else if (downtimeMins > 0) {
                              const lostHours = downtimeMins / 60;
                              const availableHours = Math.max(0, opHours - lostHours);
                              effectiveCap = Math.round((availableHours / opHours) * dailyCap);
                            }

                            // Existing plans active on this machine & date (strictly 0 on holidays)
                            const plansOnDate = holiday ? [] : existingPlans.filter(p => {
                              if (p.status === 'CANCELLED' || p.machineId !== machine.id) return false;
                              const pStart = toLocalDateString(p.startDate);
                              const pEnd = toLocalDateString(p.endDate);
                              if (dateStr < pStart || dateStr > pEnd) return false;

                              const hasOverrides = !!(p.dailyVolumeOverrides && Object.keys(p.dailyVolumeOverrides).length > 0);
                              const v = hasOverrides
                                ? (p.dailyVolumeOverrides && p.dailyVolumeOverrides[dateStr] !== undefined ? Number(p.dailyVolumeOverrides[dateStr]) || 0 : 0)
                                : (Number(p.plannedDailyRate) || 0);
                              return v > 0;
                            });

                            const existingVol = plansOnDate.reduce((sum, p) => {
                              const hasOverrides = !!(p.dailyVolumeOverrides && Object.keys(p.dailyVolumeOverrides).length > 0);
                              const v = hasOverrides
                                ? (p.dailyVolumeOverrides && p.dailyVolumeOverrides[dateStr] !== undefined ? Number(p.dailyVolumeOverrides[dateStr]) || 0 : 0)
                                : (Number(p.plannedDailyRate) || 0);
                              return sum + v;
                            }, 0);

                            const slotTentativeAllocations = tentativeAllocations.filter(
                              a => a.machineId === machine.id && a.dateStr === dateStr
                            );
                            const tentativeVol = slotTentativeAllocations.reduce((sum, a) => sum + (Number(a.allocatedVolume) || 0), 0);
                            const totalUsed = existingVol + tentativeVol;
                            const availableRemaining = Math.max(0, effectiveCap - totalUsed);
                            const isOverloaded = totalUsed > effectiveCap;
                            const isHolidayClash = holiday && tentativeVol > 0;
                            const utilizationRatio = effectiveCap > 0 ? (totalUsed / effectiveCap) : (totalUsed > 0 ? 1.5 : 0);

                            return (
                              <Box
                                key={dateStr}
                                sx={{
                                  flex: 1,
                                  minWidth: 140,
                                  p: 1,
                                  borderRight: '1px solid #e2e8f0',
                                  bgcolor: isOverloaded || isHolidayClash
                                    ? '#fee2e2'
                                    : holiday
                                    ? '#f8fafc'
                                    : utilizationRatio > 0.85
                                    ? '#fffbeb'
                                    : '#ffffff',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  position: 'relative'
                                }}
                              >
                                {/* Cell Header: Capacity status badge */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8, gap: 0.5, flexWrap: 'wrap' }}>
                                  {holiday ? (
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>
                                      Closed (Holiday)
                                    </Typography>
                                  ) : (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontSize: '0.7rem',
                                          fontWeight: 800,
                                          color: isOverloaded ? '#b91c1c' : utilizationRatio > 0.85 ? '#b45309' : '#15803d'
                                        }}
                                      >
                                        {isOverloaded
                                          ? `+${(totalUsed - effectiveCap).toLocaleString()} u CLASH`
                                          : `${availableRemaining.toLocaleString()} u free`}
                                      </Typography>
                                      {downtimeMins > 0 && (
                                        <Tooltip title={`Recorded Maintenance/Downtime: ${Math.round(downtimeMins / 60 * 10) / 10} hrs (${downtimeMins} mins)`}>
                                          <Chip
                                            icon={<BuildIcon sx={{ fontSize: '11px !important', color: '#b45309 !important' }} />}
                                            label={`${Math.round(downtimeMins / 60)}h Maint`}
                                            size="small"
                                            sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                                          />
                                        </Tooltip>
                                      )}
                                    </Box>
                                  )}

                                  {!holiday && (
                                    <IconButton
                                      size="small"
                                      onClick={() => handleOpenSlotModal(machine, dateStr)}
                                      sx={{
                                        width: 22,
                                        height: 22,
                                        bgcolor: '#eef2ff',
                                        color: '#4338ca',
                                        border: '1px solid #c7d2fe',
                                        '&:hover': { bgcolor: '#4338ca', color: '#ffffff' }
                                      }}
                                      title="Add Job to this slot"
                                    >
                                      <AddIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  )}
                                </Box>

                                {/* Capacity Visual Progress Bar */}
                                {!holiday && effectiveCap > 0 && (
                                  <Box sx={{ mb: 1 }}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={Math.min(100, Math.max(0, utilizationRatio * 100))}
                                      sx={{
                                        height: 6,
                                        borderRadius: 3,
                                        bgcolor: '#dcfce7',
                                        '& .MuiLinearProgress-bar': {
                                          bgcolor: isOverloaded
                                            ? '#ef4444'
                                            : utilizationRatio > 0.85
                                            ? '#f59e0b'
                                            : '#6366f1'
                                        }
                                      }}
                                    />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.4 }}>
                                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#64748b' }}>
                                        {totalUsed.toLocaleString()} / {effectiveCap.toLocaleString()} u
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, color: isOverloaded ? '#ef4444' : '#64748b' }}>
                                        {Math.round(Math.min(100, Math.max(0, utilizationRatio * 100)))}%
                                      </Typography>
                                    </Box>
                                  </Box>
                                )}

                                {/* Existing Confirmed / Draft Plans with Delete Option */}
                                {plansOnDate.map(plan => {
                                  const orderObj = orders.find(o => o.id === plan.orderId);
                                  const dayVol = (plan.dailyVolumeOverrides && plan.dailyVolumeOverrides[dateStr] !== undefined)
                                    ? Number(plan.dailyVolumeOverrides[dateStr]) || 0
                                    : (Number(plan.plannedDailyRate) || 0);

                                  return (
                                    <Box
                                      key={plan.id}
                                      sx={{
                                        mb: 0.6,
                                        p: 0.5,
                                        borderRadius: '5px',
                                        bgcolor: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.68rem',
                                        color: '#334155',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                      }}
                                    >
                                      <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 0.5 }}>
                                        <LockIcon sx={{ fontSize: 11, verticalAlign: 'middle', mr: 0.3, color: '#64748b' }} />
                                        <strong>{orderObj?.orderNumber || 'Plan'}:</strong> {dayVol.toLocaleString()} u
                                      </Box>
                                      <Tooltip title="Delete production unit count">
                                        <IconButton
                                          size="small"
                                          onClick={() => setDeleteUnitModal({
                                            open: true,
                                            type: 'CONFIRMED_PLAN',
                                            plan,
                                            dateStr,
                                            orderNumber: orderObj?.orderNumber || 'Plan',
                                            productName: orderObj?.productName || '',
                                            machineCode: machine.machineCode,
                                            volume: dayVol
                                          })}
                                          sx={{ width: 18, height: 18, p: 0, color: '#dc2626', '&:hover': { bgcolor: '#fee2e2' } }}
                                        >
                                          <DeleteIcon sx={{ fontSize: 13 }} />
                                        </IconButton>
                                      </Tooltip>
                                    </Box>
                                  );
                                })}

                                {/* Allocated Jobs in Simulation with Delete Option */}
                                <Stack spacing={0.6}>
                                  {slotTentativeAllocations.map(alloc => {
                                    const colors = orderColorMap[alloc.orderId] || ORDER_COLORS[0];
                                    return (
                                      <Box
                                        key={alloc.id}
                                        sx={{
                                          p: 0.6,
                                          borderRadius: '6px',
                                          bgcolor: colors.bg,
                                          border: `1px solid ${colors.border}`,
                                          color: colors.text,
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          fontSize: '0.72rem'
                                        }}
                                      >
                                        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 0.5 }}>
                                          <strong>{alloc.orderNumber}:</strong> {(Number(alloc.allocatedVolume) || 0).toLocaleString()} u
                                        </Box>
                                        <Tooltip title="Delete production unit count">
                                          <IconButton
                                            size="small"
                                            onClick={() => setDeleteUnitModal({
                                              open: true,
                                              type: 'TENTATIVE',
                                              allocId: alloc.id,
                                              dateStr: alloc.dateStr,
                                              orderNumber: alloc.orderNumber,
                                              productName: alloc.productName,
                                              machineCode: alloc.machineCode,
                                              volume: Number(alloc.allocatedVolume) || 0
                                            })}
                                            sx={{ width: 18, height: 18, p: 0, color: colors.text, '&:hover': { color: '#dc2626' } }}
                                          >
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                    );
                                  })}
                                </Stack>

                                {/* Downtime Warning */}
                                {downtimeMins > 0 && !holiday && (
                                  <Box sx={{ mt: 0.5, p: 0.4, borderRadius: '4px', bgcolor: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', fontSize: '0.65rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <BuildIcon sx={{ fontSize: 12, color: '#b45309' }} />
                                    {downtimeMins}m Maint
                                  </Box>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      );
                    })}
                  </React.Fragment>
                ))
              ) : (
                <Box sx={{ p: 4, textAlign: 'center', color: '#64748b' }}>
                  No active machines found for the selected category or plant filter.
                </Box>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* DIALOG 1: MULTI-MACHINE & DATE RANGE SMART PLANNER */}
      <Dialog
        open={rangePlannerOpen}
        onClose={() => setRangePlannerOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon sx={{ color: '#4f46e5' }} />
          Multi-Machine & Date Range Schedule Planner
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Select target production order, multiple machine lines, and date range. Units are auto-calculated across working days, with each day's volume fully customizable.
          </Typography>

          {/* Controls: Order Select, Machines Multi-Select, Date Range */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {/* Order Selection */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Target Production Order</InputLabel>
                <Select
                  label="Target Production Order"
                  value={rangePlanOrder?.id || ''}
                  onChange={(e) => {
                    const oId = e.target.value;
                    const o = orders.find(ord => ord.id === oId) || null;
                    setRangePlanOrder(o);
                    if (o) {
                      calculateRangeAutoFill(o, rangeSelectedMachineIds, rangeStartDate, rangeEndDate);
                    } else {
                      setRangeDailyVolumes({});
                    }
                  }}
                >
                  <MenuItem value=""><em>-- Please select a production order --</em></MenuItem>
                  {pendingOrders.map(o => {
                    const targetVol = getOrderTargetVolume(o, existingPlans);
                    const rem = orderRemainingMap[o.id] ?? Math.max(0, targetVol - (totalOrderAllocatedMap[o.id] || 0));
                    return (
                      <MenuItem key={o.id} value={o.id}>
                        {o.orderNumber} - {o.productName} (Target: {targetVol.toLocaleString()} u | Remaining: {rem.toLocaleString()} u)
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>

            {/* Multi-Select Machines */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Select Machine Lines (Multi-Select)</InputLabel>
                <Select
                  multiple
                  label="Select Machine Lines (Multi-Select)"
                  value={rangeSelectedMachineIds}
                  onChange={(e) => {
                    const ids = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                    setRangeSelectedMachineIds(ids);
                    if (rangePlanOrder) {
                      calculateRangeAutoFill(rangePlanOrder, ids, rangeStartDate, rangeEndDate);
                    }
                  }}
                  input={<OutlinedInput label="Select Machine Lines (Multi-Select)" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((id) => {
                        const m = machines.find(mach => mach.id === id);
                        return <Chip key={id} label={m?.machineCode || id} size="small" sx={{ height: 22, fontWeight: 700 }} />;
                      })}
                    </Box>
                  )}
                >
                  {activeMachines.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      <Checkbox checked={rangeSelectedMachineIds.indexOf(m.id) > -1} size="small" />
                      <ListItemText
                        primary={`${m.machineCode} - ${m.machineName} (${categoryMap[m.categoryId || ''] || 'General'})`}
                        secondary={`Category: ${categoryMap[m.categoryId || ''] || 'General'} • Daily Cap: ${(Number(m.dailyCapacity) || 1000).toLocaleString()} u/day`}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Date Range Start */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Plan Start Date"
                type="date"
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={rangeStartDate}
                onChange={(e) => {
                  const s = e.target.value;
                  setRangeStartDate(s);
                  if (rangePlanOrder) {
                    calculateRangeAutoFill(rangePlanOrder, rangeSelectedMachineIds, s, rangeEndDate);
                  }
                }}
              />
            </Grid>

            {/* Date Range End */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Plan End Date"
                type="date"
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={rangeEndDate}
                onChange={(e) => {
                  const end = e.target.value;
                  setRangeEndDate(end);
                  if (rangePlanOrder) {
                    calculateRangeAutoFill(rangePlanOrder, rangeSelectedMachineIds, rangeStartDate, end);
                  }
                }}
              />
            </Grid>
          </Grid>

          {/* Quick Distribution Helper Buttons */}
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              Daily Volume Breakdown ({rangePlanDatesList.length} working days, {rangeSelectedMachineIds.length} machines):
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => rangePlanOrder && calculateRangeAutoFill(rangePlanOrder, rangeSelectedMachineIds, rangeStartDate, rangeEndDate, 'CAPACITY')}
                sx={{ borderRadius: '6px', fontSize: '0.72rem', textTransform: 'none', fontWeight: 700 }}
              >
                Auto-Fill Remainder
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => rangePlanOrder && calculateRangeAutoFill(rangePlanOrder, rangeSelectedMachineIds, rangeStartDate, rangeEndDate, 'EVEN')}
                sx={{ borderRadius: '6px', fontSize: '0.72rem', textTransform: 'none', fontWeight: 700 }}
              >
                Distribute Evenly
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => rangePlanOrder && calculateRangeAutoFill(rangePlanOrder, rangeSelectedMachineIds, rangeStartDate, rangeEndDate, 'MAX')}
                sx={{ borderRadius: '6px', fontSize: '0.72rem', textTransform: 'none', fontWeight: 700 }}
              >
                Max Headroom
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={() => rangePlanOrder && calculateRangeAutoFill(rangePlanOrder, rangeSelectedMachineIds, rangeStartDate, rangeEndDate, 'CLEAR')}
                sx={{ borderRadius: '6px', fontSize: '0.72rem', textTransform: 'none' }}
              >
                Clear
              </Button>
            </Stack>
          </Box>

          {/* Editable Daily Volume Breakdown Table */}
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px', maxHeight: 260, overflowY: 'auto', mb: 2.5 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Date & Day</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Machine Line</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Daily Capacity</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Available Headroom</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, bgcolor: '#f8fafc', width: 170 }}>Planned Volume (Units)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rangePlanDatesList.length > 0 && rangeSelectedMachineIds.length > 0 ? (
                  rangePlanDatesList.map(d => {
                    if (d.isHoliday) {
                      return (
                        <TableRow key={`holiday_${d.dateStr}`} sx={{ bgcolor: '#fef2f2' }}>
                          <TableCell sx={{ fontWeight: 700, color: '#b91c1c' }}>
                            {d.dateStr} ({d.dayName})
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, color: '#b91c1c' }}>
                            All Lines (Closed)
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#b91c1c', fontWeight: 600 }}>
                            0 u (Holiday)
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#b91c1c', fontWeight: 600 }}>
                            <Chip
                              icon={<EventBusyIcon sx={{ fontSize: '13px !important', color: '#b91c1c !important' }} />}
                              label={d.holidayName || 'Factory Holiday'}
                              size="small"
                              sx={{ height: 22, bgcolor: '#fee2e2', color: '#b91c1c', fontWeight: 700, border: '1px solid #fecaca' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip label="Closed" size="small" sx={{ height: 22, bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600 }} />
                          </TableCell>
                        </TableRow>
                      );
                    }
                    const targetMachines = activeMachines.filter(m => rangeSelectedMachineIds.includes(m.id));
                    return targetMachines.map(m => {
                      const key = `${m.id}_${d.dateStr}`;
                      const downtimeMins = Number(downtimeMap[key]) || 0;
                      const opHours = Number(m.operatingHours) || 24;
                      const dailyCap = Number(m.dailyCapacity) || 1000;
                      let effectiveCap = dailyCap;
                      if (downtimeMins > 0) {
                        const lost = downtimeMins / 60;
                        effectiveCap = Math.round((Math.max(0, opHours - lost) / opHours) * dailyCap);
                      }
                      const existing = Number(existingPlanVolumeMap[key]) || 0;
                      const tentative = tentativeAllocations
                        .filter(a => a.machineId === m.id && a.dateStr === d.dateStr)
                        .reduce((s, a) => s + (Number(a.allocatedVolume) || 0), 0);
                      const availableHeadroom = Math.max(0, effectiveCap - (existing + tentative));
                      const curVal = rangeDailyVolumes[key] ?? 0;
                      const isExceeding = Number(curVal) > availableHeadroom;

                      return (
                        <TableRow key={key} hover sx={{ bgcolor: downtimeMins > 0 ? '#fffdfa' : 'inherit' }}>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {d.dateStr} ({d.dayName})
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, color: '#4338ca' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                              {m.machineCode}
                              {downtimeMins > 0 && (
                                <Tooltip title={`Downtime recorded: ${Math.round(downtimeMins / 60 * 10) / 10} hrs (${downtimeMins} mins)`}>
                                  <Chip
                                    icon={<BuildIcon sx={{ fontSize: '11px !important', color: '#b45309 !important' }} />}
                                    label={`${Math.round(downtimeMins / 60)}h Maint`}
                                    size="small"
                                    sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#64748b' }}>
                            {effectiveCap.toLocaleString()} u
                            {downtimeMins > 0 && (
                              <Typography variant="caption" sx={{ color: '#b45309', display: 'block', fontSize: '0.62rem' }}>
                                (Lost {dailyCap - effectiveCap} u)
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: availableHeadroom > 0 ? '#16a34a' : '#dc2626' }}>
                            {availableHeadroom.toLocaleString()} u
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="number"
                              value={curVal}
                              disabled={effectiveCap <= 0}
                              onChange={(e) => {
                                const v = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                                setRangeDailyVolumes(prev => ({ ...prev, [key]: isNaN(v as number) ? 0 : v }));
                              }}
                              error={isExceeding}
                              slotProps={{
                                htmlInput: {
                                  style: { textAlign: 'center', fontWeight: 700, padding: '4px 8px', fontSize: '0.85rem' }
                                }
                              }}
                              sx={{ width: 130 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#64748b' }}>
                      No machines selected or empty date range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Dynamic Summary Balance Bar */}
          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Grid container spacing={2} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                  ORDER TARGET VOLUME
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  {rangePlanOrder ? (getOrderTargetVolume(rangePlanOrder, existingPlans)).toLocaleString() : 0} Units
                </Typography>
              </Grid>

              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                  TOTAL ALLOCATED
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#166534' }}>
                  {rangePlanOrder ? (totalOrderAllocatedMap[rangePlanOrder.id] || 0).toLocaleString() : 0} Units
                </Typography>
              </Grid>

              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                  PLANNED IN THIS RANGE
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#4338ca' }}>
                  {rangePlanTotalBatch.toLocaleString()} Units
                </Typography>
              </Grid>

              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                  REMAINING UNALLOCATED
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: Math.max(0, Number(rangePlanOrderRem) - Number(rangePlanTotalBatch)) === 0 ? '#16a34a' : '#d97706' }}>
                  {Math.max(0, Number(rangePlanOrderRem) - Number(rangePlanTotalBatch)).toLocaleString()} Units
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRangePlannerOpen(false)} variant="outlined" sx={{ borderRadius: '8px' }}>
            Cancel
          </Button>
          <Button
            onClick={handleApplyRangePlan}
            variant="contained"
            color="primary"
            disabled={!rangePlanOrder || Number(rangePlanTotalBatch) <= 0}
            sx={{ borderRadius: '8px', fontWeight: 700, px: 3 }}
          >
            Plan ({Number(rangePlanTotalBatch).toLocaleString()} Units)
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 2: QUICK SINGLE SLOT ALLOCATOR */}
      <Dialog
        open={slotModal.open}
        onClose={() => setSlotModal(prev => ({ ...prev, open: false }))}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PrecisionManufacturingIcon sx={{ color: '#4f46e5' }} />
          Allocate Order to Slot
        </DialogTitle>
        <form onSubmit={handleAddSlotAllocation}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                  TARGET MACHINE & DATE
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  {slotModal.machine?.machineCode} ({slotModal.machine?.machineName}) • {slotModal.dateStr}
                </Typography>
                <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 700, display: 'block', mt: 0.5 }}>
                  Available Remaining Capacity: {slotModal.availableCap.toLocaleString()} Units
                </Typography>
              </Box>

              {slotModal.machine && downtimeMap[`${slotModal.machine.id}_${slotModal.dateStr}`] > 0 && (
                <Alert severity="warning" icon={<BuildIcon sx={{ fontSize: 18 }} />} sx={{ py: 0.5, fontSize: '0.75rem' }}>
                  Machine has {Math.round(downtimeMap[`${slotModal.machine.id}_${slotModal.dateStr}`] / 60 * 10) / 10} hrs recorded downtime on this date. Effective capacity is reduced to {slotModal.effectiveCap.toLocaleString()} u.
                </Alert>
              )}

              <FormControl fullWidth size="small" required>
                <InputLabel>Select Production Order</InputLabel>
                <Select
                  label="Select Production Order"
                  value={slotForm.orderId}
                  onChange={(e) => {
                    const oId = e.target.value;
                    const orderObj = orders.find(o => o.id === oId);
                    const unalloc = orderObj ? (orderRemainingMap[orderObj.id] ?? Math.max(0, getOrderTargetVolume(orderObj, existingPlans) - (totalOrderAllocatedMap[orderObj.id] || 0))) : 0;
                    const suggestVol = unalloc > 0
                      ? (slotModal.availableCap > 0 ? Math.min(slotModal.availableCap, unalloc) : unalloc)
                      : 0;
                    setSlotForm({
                      orderId: oId,
                      volume: Number.isFinite(suggestVol) && suggestVol > 0 ? suggestVol : 0
                    });
                  }}
                >
                  <MenuItem value=""><em>-- Please select a production order --</em></MenuItem>
                  {pendingOrders.map(o => {
                    const targetVol = getOrderTargetVolume(o, existingPlans);
                    const rem = orderRemainingMap[o.id] ?? Math.max(0, targetVol - (totalOrderAllocatedMap[o.id] || 0));
                    return (
                      <MenuItem key={o.id} value={o.id}>
                        {o.orderNumber} - {o.productName} (Target: {targetVol.toLocaleString()} u | Remaining: {rem.toLocaleString()} u)
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              <TextField
                label="Allocated Volume for this Day (Units)"
                type="number"
                size="small"
                required
                fullWidth
                value={slotForm.volume}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setSlotForm({ ...slotForm, volume: val as any });
                }}
                helperText={
                  Number(slotForm.volume) > slotModal.availableCap
                    ? `Warning: Exceeds available capacity by ${(Math.max(0, (Number(slotForm.volume) || 0) - slotModal.availableCap)).toLocaleString()} units!`
                    : `Fits within daily machine capacity.`
                }
                error={Number(slotForm.volume) > slotModal.availableCap}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setSlotModal(prev => ({ ...prev, open: false }))} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={!slotForm.orderId || Number(slotForm.volume) <= 0}
              sx={{ borderRadius: '8px', fontWeight: 700 }}
            >
              Add to Slot
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* DIALOG 3: DELETE PRODUCTION UNIT COUNT MODAL */}
      <Dialog
        open={deleteUnitModal.open}
        onClose={() => !deletePlanDayMutation.isPending && setDeleteUnitModal(prev => ({ ...prev, open: false }))}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon sx={{ color: '#dc2626' }} />
          Delete Production Unit Count
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
            Are you sure you want to delete the scheduled production volume for this day?
          </Typography>
          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#991b1b' }}>
              {deleteUnitModal.orderNumber} {deleteUnitModal.productName ? `— ${deleteUnitModal.productName}` : ''}
            </Typography>
            <Typography variant="caption" sx={{ color: '#7f1d1d', display: 'block', mt: 0.5 }}>
              Machine: <strong>{deleteUnitModal.machineCode}</strong> • Date: <strong>{deleteUnitModal.dateStr}</strong>
            </Typography>
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 700 }}>
                Unit Count to Delete:
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#dc2626' }}>
                {deleteUnitModal.volume.toLocaleString()} Units
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteUnitModal(prev => ({ ...prev, open: false }))}
            variant="outlined"
            disabled={deletePlanDayMutation.isPending}
            sx={{ borderRadius: '8px' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteUnits}
            variant="contained"
            color="error"
            disabled={deletePlanDayMutation.isPending}
            sx={{ borderRadius: '8px', fontWeight: 700, bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
          >
            {deletePlanDayMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Delete Units'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CONFIRMATION MODAL: CREATE SCHEDULE */}
      <Dialog
        open={confirmModalOpen}
        onClose={() => !confirmScheduleMutation.isPending && setConfirmModalOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentTurnedInIcon sx={{ color: '#4338ca' }} />
          Confirm Schedule Creation
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
            Review simulated job allocations below. Each day's configured volume will be committed and orders will transition to scheduled status.
          </Typography>

          {/* Allocation Breakdown Table */}
          <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', mb: 2.5 }}>
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              <Box sx={{ display: 'flex', bgcolor: '#f8fafc', p: 1.5, borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '0.8rem', color: '#0f172a' }}>
                <Box sx={{ flex: 1.5 }}>Order Number</Box>
                <Box sx={{ flex: 2 }}>Product Name</Box>
                <Box sx={{ flex: 1.5 }}>Machine</Box>
                <Box sx={{ flex: 1.5, textAlign: 'center' }}>Date</Box>
                <Box sx={{ flex: 1.5, textAlign: 'right' }}>Scheduled Volume</Box>
              </Box>
              {tentativeAllocations.map((alloc, idx) => (
                <Box
                  key={alloc.id}
                  sx={{
                    display: 'flex',
                    p: 1.2,
                    borderBottom: idx < tentativeAllocations.length - 1 ? '1px solid #f1f5f9' : 'none',
                    fontSize: '0.82rem',
                    color: '#334155'
                  }}
                >
                  <Box sx={{ flex: 1.5, fontWeight: 700 }}>{alloc.orderNumber}</Box>
                  <Box sx={{ flex: 2 }}>{alloc.productName}</Box>
                  <Box sx={{ flex: 1.5, fontWeight: 600 }}>{alloc.machineCode}</Box>
                  <Box sx={{ flex: 1.5, textAlign: 'center' }}>{alloc.dateStr}</Box>
                  <Box sx={{ flex: 1.5, textAlign: 'right', fontWeight: 800, color: '#4338ca' }}>
                    {(Number(alloc.allocatedVolume) || 0).toLocaleString()} Units
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Total Summary */}
          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                SCHEDULE STATUS
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: feasibilityAnalysis.isDoable ? '#16a34a' : '#d97706', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {feasibilityAnalysis.isDoable ? (
                  <>
                    <CheckCircleIcon sx={{ fontSize: 18, color: '#16a34a' }} />
                    Verified Feasible & Within Capacity
                  </>
                ) : (
                  <>
                    <WarningIcon sx={{ fontSize: 18, color: '#d97706' }} />
                    Has Warnings
                  </>
                )}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                TOTAL SCHEDULED VOLUME
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#4338ca' }}>
                {(Number(feasibilityAnalysis.totalAllocatedVol) || 0).toLocaleString()} Units
              </Typography>
            </Box>
          </Box>

          {/* Plan Type Selection */}
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Plan Type</InputLabel>
              <Select
                label="Plan Type"
                value={planType}
                onChange={(e) => setPlanType(e.target.value as any)}
              >
                <MenuItem value="CONFIRMED">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 18, color: '#16a34a' }} />
                    CONFIRMED Plan (Locks order into SCHEDULED status)
                  </Box>
                </MenuItem>
                <MenuItem value="DRAFT">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HourglassEmptyIcon sx={{ fontSize: 18, color: '#3b82f6' }} />
                    DRAFT Plan (Leaves for draft review approval)
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setConfirmModalOpen(false)}
            variant="outlined"
            disabled={confirmScheduleMutation.isPending}
            sx={{ borderRadius: '8px' }}
          >
            Back to Edit
          </Button>
          <Button
            onClick={() => confirmScheduleMutation.mutate()}
            variant="contained"
            color="primary"
            disabled={confirmScheduleMutation.isPending}
            sx={{ borderRadius: '8px', fontWeight: 700, px: 3 }}
          >
            {confirmScheduleMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default ScheduleCreation;
