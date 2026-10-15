import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  getDailyProductions,
  getProductionPlans,
  getProductionOrders,
  getMachines,
  getProductionCategories,
  getSections,
  getPlants,
  getHolidays,
  toLocalDateString,
  parseLocalDate,
  type DailyProduction,
  type ProductionPlan,
  type Machine,
  type Plant,
  type Holiday
} from '../services/db';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Stack,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Tabs,
  Tab,
  InputAdornment
} from '@mui/material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar
} from 'recharts';

// Icons
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import DownloadIcon from '@mui/icons-material/Download';
import FilterListIcon from '@mui/icons-material/FilterList';
import TableViewIcon from '@mui/icons-material/TableView';
import CategoryIcon from '@mui/icons-material/Category';
import LayersIcon from '@mui/icons-material/Layers';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import SearchIcon from '@mui/icons-material/Search';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import VisibilityIcon from '@mui/icons-material/Visibility';

import * as XLSX from 'xlsx';

export const ProductionDashboard: React.FC = () => {
  const { tenant, activeCompany } = useAuthStore();
  const currentTenantId = activeCompany || tenant?.id || 'rileys';
  const isToyo = currentTenantId === 'toyo';

  // ----------------------------------------------------
  // DASHBOARD VIEW TAB STATE: 'machines' vs 'orders'
  // ----------------------------------------------------
  const [dashboardView, setDashboardView] = useState<'machines' | 'orders'>('machines');

  // ----------------------------------------------------
  // 1. DATA QUERIES
  // ----------------------------------------------------
  const { data: dailyLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['dailyProductions', currentTenantId],
    queryFn: () => getDailyProductions(currentTenantId),
    enabled: !!currentTenantId,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['productionPlans', currentTenantId],
    queryFn: () => getProductionPlans(currentTenantId),
    enabled: !!currentTenantId,
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['productionOrders', currentTenantId],
    queryFn: () => getProductionOrders(currentTenantId),
    enabled: !!currentTenantId,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ['machines', currentTenantId],
    queryFn: () => getMachines(currentTenantId),
    enabled: !!currentTenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['productionCategories', currentTenantId],
    queryFn: () => getProductionCategories(currentTenantId),
    enabled: !isToyo && !!currentTenantId,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections', currentTenantId],
    queryFn: () => getSections(currentTenantId),
    enabled: isToyo && !!currentTenantId,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ['plants', currentTenantId],
    queryFn: () => getPlants(currentTenantId),
    enabled: !!currentTenantId,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', currentTenantId],
    queryFn: () => getHolidays(currentTenantId),
    enabled: !!currentTenantId,
  });

  // ----------------------------------------------------
  // 2. FILTER CONSOLE STATE (Machine Curves)
  // ----------------------------------------------------
  const today = new Date();
  const todayStr = toLocalDateString(today);

  const getPresetStartDate = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return toLocalDateString(d);
  };

  const [datePreset, setDatePreset] = useState<'7' | '14' | '30' | 'this_month' | 'custom'>('14');
  const [fromDateStr, setFromDateStr] = useState<string>(getPresetStartDate(14));
  const [toDateStr, setToDateStr] = useState<string>(todayStr);

  // Active Applied Filters
  const [appliedFilters, setAppliedFilters] = useState({
    fromDate: getPresetStartDate(14),
    toDate: todayStr,
    plantId: 'all',
    groupId: 'all',
    machineId: 'all'
  });

  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedMachine, setSelectedMachine] = useState<string>('all');

  // Collapsed state for Category/Section groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // ----------------------------------------------------
  // 2B. ORDERS DASHBOARD FILTER & MODAL STATE
  // ----------------------------------------------------
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'BEHIND' | 'SCHEDULED' | 'PENDING'>('ALL');
  const [orderGroupFilter, setOrderGroupFilter] = useState<string>('all');

  const [orderDetailModal, setOrderDetailModal] = useState<{
    open: boolean;
    orderRow: any | null;
  }>({
    open: false,
    orderRow: null
  });

  // Modal for Viewing specific machine daily output logs
  const [dailyLogModal, setDailyLogModal] = useState<{
    open: boolean;
    machine: Machine | null;
    groupName: string;
    rows: any[];
  }>({
    open: false,
    machine: null,
    groupName: '',
    rows: []
  });

  const toggleGroupCollapse = (grpId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [grpId]: !prev[grpId] }));
  };

  // Quick Preset Handler
  const handlePresetChange = (_: React.MouseEvent<HTMLElement>, newPreset: '7' | '14' | '30' | 'this_month' | 'custom' | null) => {
    if (!newPreset) return;
    setDatePreset(newPreset);
    if (newPreset === '7') {
      const s = getPresetStartDate(7);
      setFromDateStr(s);
      setToDateStr(todayStr);
    } else if (newPreset === '14') {
      const s = getPresetStartDate(14);
      setFromDateStr(s);
      setToDateStr(todayStr);
    } else if (newPreset === '30') {
      const s = getPresetStartDate(30);
      setFromDateStr(s);
      setToDateStr(todayStr);
    } else if (newPreset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDateStr(toLocalDateString(firstDay));
      setToDateStr(todayStr);
    }
  };

  // Apply Filters / View Action
  const handleApplyFilter = () => {
    setAppliedFilters({
      fromDate: fromDateStr,
      toDate: toDateStr,
      plantId: selectedPlant,
      groupId: selectedGroup,
      machineId: selectedMachine
    });
  };

  // ----------------------------------------------------
  // 3. DATE LIST COMPUTATION (Columns & Series for Period)
  // ----------------------------------------------------
  const dateList = useMemo(() => {
    if (!appliedFilters.fromDate || !appliedFilters.toDate) return [];
    const list: Array<{ dateStr: string; label: string; dayName: string; isToday: boolean }> = [];
    const start = parseLocalDate(appliedFilters.fromDate);
    const end = parseLocalDate(appliedFilters.toDate);

    if (start > end) return [];

    const cur = new Date(start);
    while (cur <= end) {
      const dStr = toLocalDateString(cur);
      const dayLabel = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayName = cur.toLocaleDateString('en-US', { weekday: 'short' });
      list.push({
        dateStr: dStr,
        label: dayLabel,
        dayName,
        isToday: dStr === todayStr
      });
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  }, [appliedFilters.fromDate, appliedFilters.toDate, todayStr]);

  // Lookup Maps
  const plantMap = useMemo(() => {
    const map: Record<string, Plant> = {};
    plants.forEach(p => { map[p.id] = p; });
    return map;
  }, [plants]);

  const holidayMap = useMemo(() => {
    const map: Record<string, Holiday> = {};
    holidays.forEach(h => {
      const dStr = h.dateStr || toLocalDateString(h.date);
      map[dStr] = h;
    });
    return map;
  }, [holidays]);

  const confirmedPlans = useMemo(() => {
    return plans.filter(p => p.type === 'CONFIRMED' && p.status !== 'CANCELLED');
  }, [plans]);

  // ----------------------------------------------------
  // 4. GROUP (SECTION / CATEGORY) MACHINE-WISE PRODUCTION ANALYTICS CALCULATION
  // ----------------------------------------------------
  interface OutputGroupInfo {
    id: string;
    name: string;
    code?: string;
    description?: string;
    type: 'section' | 'category';
  }

  const groupMachineAnalytics = useMemo(() => {
    // 1. Determine relevant groups (Sections for Toyo, Categories for Riley's)
    let groupList: OutputGroupInfo[] = [];

    if (isToyo) {
      const activeSecs = sections.filter(s => {
        if (appliedFilters.groupId !== 'all' && s.id !== appliedFilters.groupId) return false;
        return true;
      });
      const knownSecIds = new Set(sections.map(s => s.id));
      const hasUnassigned = machines.some(m => !m.sectionId || !knownSecIds.has(m.sectionId));
      
      groupList = activeSecs.map(s => ({
        id: s.id,
        name: s.sectionName,
        code: s.sectionCode,
        description: s.description,
        type: 'section' as const
      }));

      if (hasUnassigned && appliedFilters.groupId === 'all') {
        groupList.push({
          id: 'unassigned',
          name: 'General / Unassigned Section',
          code: 'UNASSIGNED',
          description: 'Machines with unassigned manufacturing section',
          type: 'section' as const
        });
      }
    } else {
      const activeCats = categories.filter(c => {
        if (appliedFilters.groupId !== 'all' && c.id !== appliedFilters.groupId) return false;
        return true;
      });
      const knownCatIds = new Set(categories.map(c => c.id));
      const hasUnassigned = machines.some(m => !m.categoryId || !knownCatIds.has(m.categoryId));

      groupList = activeCats.map(c => ({
        id: c.id,
        name: c.name,
        code: undefined,
        description: c.description,
        type: 'category' as const
      }));

      if (hasUnassigned && appliedFilters.groupId === 'all') {
        groupList.push({
          id: 'unassigned',
          name: 'General / Unassigned Category',
          code: 'UNASSIGNED',
          description: 'Machines with unassigned product category',
          type: 'category' as const
        });
      }
    }

    // 2. Filter active machines
    const activeMachines = machines.filter(m => {
      if (m.status !== 'ACTIVE') return false;
      if (appliedFilters.plantId !== 'all' && m.plantId !== appliedFilters.plantId) return false;
      if (appliedFilters.machineId !== 'all' && m.id !== appliedFilters.machineId) return false;
      return true;
    });

    let grandTotalTarget = 0;
    let grandTotalAchieved = 0;
    let grandTodayAchieved = 0;
    let grandTotalAccepted = 0;
    let grandTotalRejected = 0;

    const result = groupList.map(grp => {
      // Find machines belonging to this section/category
      const machsInGroup = activeMachines.filter(m => {
        if (isToyo) {
          if (grp.id === 'unassigned') {
            const knownSecIds = new Set(sections.map(s => s.id));
            return !m.sectionId || !knownSecIds.has(m.sectionId);
          }
          return m.sectionId === grp.id;
        } else {
          if (grp.id === 'unassigned') {
            const knownCatIds = new Set(categories.map(c => c.id));
            return !m.categoryId || !knownCatIds.has(m.categoryId);
          }
          return m.categoryId === grp.id;
        }
      });

      const machineRows = machsInGroup.map(mach => {
        // Find plans for this machine
        const machPlans = confirmedPlans.filter(p => p.machineId === mach.id);
        const machLogs = dailyLogs.filter(l => l.machineId === mach.id);

        let runningCumTarget = 0;
        let runningCumAchieved = 0;
        let machPeriodTarget = 0;
        let machPeriodAchieved = 0;
        let machTodayAchieved = 0;
        let machTodayTarget = 0;
        let machAccepted = 0;
        let machRejected = 0;

        // Generate line graph daily data points
        const chartData = dateList.map(d => {
          const dStr = d.dateStr;
          const isHoliday = !!holidayMap[dStr];

          // 1. Calculate Target Volume for this day
          let dayTarget = 0;
          if (!isHoliday) {
            machPlans.forEach(p => {
              const pStart = toLocalDateString(p.startDate);
              const pEnd = toLocalDateString(p.endDate);
              if (p.dailyVolumeOverrides && p.dailyVolumeOverrides[dStr] !== undefined) {
                dayTarget += Number(p.dailyVolumeOverrides[dStr]) || 0;
              } else if (pStart <= dStr && dStr <= pEnd) {
                dayTarget += Number(p.plannedDailyRate) || 0;
              }
            });
          }

          // 2. Calculate Achieved Volume for this day
          const dayLogs = machLogs.filter(l => l.dateStr === dStr || toLocalDateString(l.date) === dStr);
          const dayAchieved = dayLogs.reduce((sum, l) => {
            const act = Number(l.actualVolume) || (Number(l.acceptedQuantity || 0) + Number(l.rejectedQuantity || 0));
            return sum + act;
          }, 0);

          const dayAccepted = dayLogs.reduce((sum, l) => sum + (Number(l.acceptedQuantity) || 0), 0);
          const dayRejected = dayLogs.reduce((sum, l) => sum + (Number(l.rejectedQuantity) || 0), 0);

          machPeriodTarget += dayTarget;
          machPeriodAchieved += dayAchieved;
          machAccepted += dayAccepted;
          machRejected += dayRejected;

          runningCumTarget += dayTarget;
          runningCumAchieved += dayAchieved;

          if (d.isToday) {
            machTodayAchieved = dayAchieved;
            machTodayTarget = dayTarget;
          }

          const dailyVariance = dayAchieved - dayTarget;
          const cumVariance = runningCumAchieved - runningCumTarget;

          return {
            dateStr: dStr,
            dateLabel: d.label,
            dayName: d.dayName,
            isHoliday,
            dailyTarget: dayTarget,
            dailyAchieved: dayAchieved,
            cumulativeTarget: runningCumTarget,
            cumulativeAchieved: runningCumAchieved,
            dailyVariance,
            cumVariance,
            dayLogs
          };
        });

        grandTotalTarget += machPeriodTarget;
        grandTotalAchieved += machPeriodAchieved;
        grandTodayAchieved += machTodayAchieved;
        grandTotalAccepted += machAccepted;
        grandTotalRejected += machRejected;

        const achievementRate = machPeriodTarget > 0 
          ? (machPeriodAchieved / machPeriodTarget) * 100 
          : (machPeriodAchieved > 0 ? 100 : 0);

        let status: 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'IDLE' = 'ON_TRACK';
        if (machPeriodTarget === 0 && machPeriodAchieved === 0) {
          status = 'IDLE';
        } else if (achievementRate >= 105) {
          status = 'AHEAD';
        } else if (achievementRate >= 90) {
          status = 'ON_TRACK';
        } else {
          status = 'BEHIND';
        }

        return {
          machine: mach,
          plant: plantMap[mach.plantId],
          group: grp,
          periodTarget: machPeriodTarget,
          periodAchieved: machPeriodAchieved,
          todayTarget: machTodayTarget,
          todayAchieved: machTodayAchieved,
          cumulativeVolume: machPeriodAchieved,
          acceptedQuantity: machAccepted,
          rejectedQuantity: machRejected,
          achievementRate,
          status,
          chartData
        };
      });

      const grpTotalTarget = machineRows.reduce((sum, m) => sum + m.periodTarget, 0);
      const grpTotalAchieved = machineRows.reduce((sum, m) => sum + m.periodAchieved, 0);
      const grpTodayAchieved = machineRows.reduce((sum, m) => sum + m.todayAchieved, 0);
      const grpAchievementRate = grpTotalTarget > 0 
        ? (grpTotalAchieved / grpTotalTarget) * 100 
        : (grpTotalAchieved > 0 ? 100 : 0);

      return {
        group: grp,
        totalTarget: grpTotalTarget,
        totalAchieved: grpTotalAchieved,
        todayAchieved: grpTodayAchieved,
        achievementRate: grpAchievementRate,
        machineRows
      };
    }).filter(g => g.machineRows.length > 0);

    const overallRate = grandTotalTarget > 0 
      ? (grandTotalAchieved / grandTotalTarget) * 100 
      : (grandTotalAchieved > 0 ? 100 : 0);

    const totalProduced = grandTotalAccepted + grandTotalRejected;
    const scrapRate = totalProduced > 0 ? (grandTotalRejected / totalProduced) * 100 : 0;

    return {
      groups: result,
      categoryGroups: result, // backward compatibility alias
      grandTotalTarget,
      grandTotalAchieved,
      grandTodayAchieved,
      grandTotalAccepted,
      grandTotalRejected,
      overallAchievementRate: overallRate,
      scrapRate,
      totalDays: dateList.length
    };
  }, [isToyo, sections, categories, machines, confirmedPlans, dailyLogs, holidayMap, dateList, appliedFilters, plantMap, currentTenantId]);

  // ----------------------------------------------------
  // 5. GROUP (SECTION / CATEGORY) COMPARISON CHART DATA
  // ----------------------------------------------------
  const groupBarData = useMemo(() => {
    return groupMachineAnalytics.groups.map(g => ({
      groupName: g.group.name,
      Target: g.totalTarget,
      Achieved: g.totalAchieved,
      Rate: Number(g.achievementRate.toFixed(1))
    }));
  }, [groupMachineAnalytics]);

  // Aggregate Daily Run Rate vs Target
  const aggregateDailyTrend = useMemo(() => {
    return dateList.map(d => {
      let targetSum = 0;
      let achievedSum = 0;
      groupMachineAnalytics.groups.forEach(g => {
        g.machineRows.forEach(mr => {
          const pt = mr.chartData.find(c => c.dateStr === d.dateStr);
          if (pt) {
            targetSum += pt.dailyTarget;
            achievedSum += pt.dailyAchieved;
          }
        });
      });
      return {
        date: d.label,
        Target: targetSum,
        Achieved: achievedSum,
        Variance: achievedSum - targetSum
      };
    });
  }, [dateList, groupMachineAnalytics]);

  // ----------------------------------------------------
  // 5B. ORDERS PLANNED VS ACTUALS BREAKDOWN CALCULATION
  // ----------------------------------------------------
  const ordersAnalytics = useMemo(() => {
    const machineMap: Record<string, Machine> = {};
    machines.forEach(m => { machineMap[m.id] = m; });

    const sectionMap: Record<string, any> = {};
    sections.forEach(s => { sectionMap[s.id] = s; });

    const categoryMap: Record<string, any> = {};
    categories.forEach(c => { categoryMap[c.id] = c; });

    let grandPlannedVolume = 0;
    let grandActualVolume = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let behindCount = 0;
    let pendingCount = 0;

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const rows = orders.map(order => {
      // Find plans linked to this order
      const orderPlans = plans.filter(p => p.orderId === order.id && p.status !== 'CANCELLED');

      // Target Quantity
      const orderTargetQty = Number(order.quantity) || 0;

      // Scheduled Planned Volume across plans
      const scheduledPlannedVolume = orderPlans.reduce((sum, p) => {
        if (p.dailyVolumeOverrides && Object.keys(p.dailyVolumeOverrides).length > 0) {
          return sum + Object.values(p.dailyVolumeOverrides).reduce((vSum, v) => vSum + (Number(v) || 0), 0);
        }
        return sum + (Number(p.totalPlannedVolume) || (Number(p.plannedDailyRate || 0) * (p.totalPlannedDays || 1)));
      }, 0);

      const targetPlanned = orderTargetQty > 0 ? orderTargetQty : scheduledPlannedVolume;

      // Actual production delivered for this order
      const orderPlanIds = new Set(orderPlans.map(p => p.id));
      const orderLogs = dailyLogs.filter(l => l.orderId === order.id || (l.planId && orderPlanIds.has(l.planId)));

      const actualDeliveredVolume = orderLogs.reduce((sum, l) => {
        return sum + (Number(l.actualVolume) || (Number(l.acceptedQuantity || 0) + Number(l.rejectedQuantity || 0)));
      }, 0);

      const acceptedVolume = orderLogs.reduce((sum, l) => sum + (Number(l.acceptedQuantity) || 0), 0);
      const rejectedVolume = orderLogs.reduce((sum, l) => sum + (Number(l.rejectedQuantity) || 0), 0);

      // Remaining volume
      const remainingVolume = Math.max(0, targetPlanned - actualDeliveredVolume);

      // Completion rate
      const completionRate = targetPlanned > 0
        ? Math.min(100, (actualDeliveredVolume / targetPlanned) * 100)
        : (actualDeliveredVolume > 0 ? 100 : 0);

      // Assigned machines
      const assignedMachines = Array.from(new Set(orderPlans.map(p => machineMap[p.machineId]).filter(Boolean)));

      // Section or Category determination
      let groupName = 'General / Unassigned';
      let groupCode = '';
      let groupId = 'unassigned';

      if (isToyo) {
        const secId = (order as any).sectionId || assignedMachines.find(m => m.sectionId)?.sectionId;
        if (secId && sectionMap[secId]) {
          groupId = secId;
          groupName = sectionMap[secId].sectionName;
          groupCode = sectionMap[secId].sectionCode;
        } else if (assignedMachines.length > 0 && assignedMachines[0].sectionName) {
          groupName = assignedMachines[0].sectionName;
        }
      } else {
        if (order.categoryId && categoryMap[order.categoryId]) {
          groupId = order.categoryId;
          groupName = categoryMap[order.categoryId].name;
        }
      }

      // Due date & Overdue check
      let dueDateStr = '—';
      let isOverdue = false;
      let daysRemaining: number | null = null;

      if (order.dueDate) {
        const dObj = new Date(order.dueDate);
        dueDateStr = toLocalDateString(dObj);
        const diffTime = dObj.getTime() - todayDate.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isOverdue = daysRemaining < 0 && completionRate < 100;
      }

      // Schedule window
      let scheduleStart = '—';
      let scheduleEnd = '—';
      if (orderPlans.length > 0) {
        const startDates = orderPlans.map(p => toLocalDateString(p.startDate)).sort();
        const endDates = orderPlans.map(p => toLocalDateString(p.endDate)).sort();
        scheduleStart = startDates[0];
        scheduleEnd = endDates[endDates.length - 1];
      }

      // Status
      let status: 'COMPLETED' | 'IN_PROGRESS' | 'BEHIND' | 'SCHEDULED' | 'PENDING' = 'PENDING';
      if (completionRate >= 100) {
        status = 'COMPLETED';
        completedCount++;
      } else if (actualDeliveredVolume > 0) {
        if (isOverdue) {
          status = 'BEHIND';
          behindCount++;
        } else {
          status = 'IN_PROGRESS';
          inProgressCount++;
        }
      } else if (orderPlans.length > 0) {
        if (isOverdue) {
          status = 'BEHIND';
          behindCount++;
        } else {
          status = 'SCHEDULED';
          pendingCount++;
        }
      } else {
        status = 'PENDING';
        pendingCount++;
      }

      grandPlannedVolume += targetPlanned;
      grandActualVolume += actualDeliveredVolume;

      return {
        order,
        targetPlanned,
        actualDeliveredVolume,
        acceptedVolume,
        rejectedVolume,
        remainingVolume,
        completionRate,
        status,
        isOverdue,
        daysRemaining,
        dueDateStr,
        scheduleStart,
        scheduleEnd,
        assignedMachines,
        groupId,
        groupName,
        groupCode,
        orderPlans,
        orderLogs
      };
    });

    const overallFulfillmentRate = grandPlannedVolume > 0 
      ? Math.min(100, (grandActualVolume / grandPlannedVolume) * 100) 
      : 0;

    return {
      orderRows: rows,
      grandPlannedVolume,
      grandActualVolume,
      completedCount,
      inProgressCount,
      behindCount,
      pendingCount,
      overallFulfillmentRate,
      totalOrders: orders.length
    };
  }, [orders, plans, dailyLogs, machines, sections, categories, isToyo]);

  // Filtered orders for Orders Dashboard
  const filteredOrderRows = useMemo(() => {
    return ordersAnalytics.orderRows.filter(r => {
      // 1. Search filter
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        const matchesOrder = r.order.orderNumber?.toLowerCase().includes(q);
        const matchesProduct = r.order.productName?.toLowerCase().includes(q);
        const matchesGroup = r.groupName?.toLowerCase().includes(q);
        if (!matchesOrder && !matchesProduct && !matchesGroup) return false;
      }
      // 2. Group / Section Filter
      if (orderGroupFilter !== 'all') {
        if (r.groupId !== orderGroupFilter) return false;
      }
      // 3. Status filter
      if (orderStatusFilter !== 'ALL') {
        if (r.status !== orderStatusFilter) return false;
      }
      return true;
    });
  }, [ordersAnalytics, orderSearch, orderGroupFilter, orderStatusFilter]);

  // Top Orders Bar Data (Planned vs Actuals comparison)
  const topOrdersBarData = useMemo(() => {
    return filteredOrderRows.slice(0, 10).map(r => ({
      orderNumber: r.order.orderNumber,
      productName: r.order.productName,
      label: r.order.orderNumber,
      Planned: r.targetPlanned,
      Actual: r.actualDeliveredVolume,
      Completion: Number(r.completionRate.toFixed(1))
    }));
  }, [filteredOrderRows]);

  // ----------------------------------------------------
  // 6. EXCEL EXPORT (Group-Machine Outputs, Orders & Graphs Data)
  // ----------------------------------------------------
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const groupColLabel = isToyo ? 'Section' : 'Category';

    // Sheet 1: Machine Summary
    const summaryRows: any[] = [];
    groupMachineAnalytics.groups.forEach(g => {
      g.machineRows.forEach(mr => {
        summaryRows.push({
          [groupColLabel]: g.group.name,
          ...(g.group.code ? { [`${groupColLabel} Code`]: g.group.code } : {}),
          'Machine Code': mr.machine.machineCode,
          'Machine Name': mr.machine.machineName,
          'Plant': mr.plant?.plantName || '—',
          'Period Target Volume': mr.periodTarget,
          'Period Achieved Volume': mr.periodAchieved,
          'Period Cumulative Output': mr.cumulativeVolume,
          'Realization Rate %': mr.achievementRate.toFixed(1) + '%',
          'Today Achieved': mr.todayAchieved,
          'Accepted Qty': mr.acceptedQuantity,
          'Scrap Qty': mr.rejectedQuantity,
          'Status': mr.status
        });
      });
    });
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Machines Summary');

    // Sheet 2: Orders Completion Breakdown
    const orderExportRows = ordersAnalytics.orderRows.map(r => ({
      'Order Number': r.order.orderNumber,
      'Product Name': r.order.productName,
      [groupColLabel]: r.groupName,
      'Assigned Machines': r.assignedMachines.map((m: any) => m.machineCode).join(', ') || 'Unassigned',
      'Target Planned Volume': r.targetPlanned,
      'Actual Delivered Volume': r.actualDeliveredVolume,
      'Remaining Balance': r.remainingVolume,
      'Completion %': r.completionRate.toFixed(1) + '%',
      'Due Date': r.dueDateStr,
      'Schedule Start': r.scheduleStart,
      'Schedule End': r.scheduleEnd,
      'Status': r.status,
      'Priority': r.order.priority || 'MEDIUM'
    }));
    const wsOrders = XLSX.utils.json_to_sheet(orderExportRows);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders Breakdown');

    // Sheet 3: Daily Matrix Output
    const dailyMatrixRows: any[] = [];
    groupMachineAnalytics.groups.forEach(g => {
      g.machineRows.forEach(mr => {
        mr.chartData.forEach(d => {
          dailyMatrixRows.push({
            [groupColLabel]: g.group.name,
            'Machine Code': mr.machine.machineCode,
            'Machine Name': mr.machine.machineName,
            'Date': d.dateStr,
            'Daily Target Volume': d.dailyTarget,
            'Daily Achieved Output': d.dailyAchieved,
            'Daily Variance': d.dailyVariance,
            'Cumulative Target': d.cumulativeTarget,
            'Cumulative Achieved': d.cumulativeAchieved,
            'Is Factory Holiday': d.isHoliday ? 'Yes' : 'No'
          });
        });
      });
    });
    const wsDaily = XLSX.utils.json_to_sheet(dailyMatrixRows);
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Time Series Output');

    XLSX.writeFile(wb, `Production_Analytics_${isToyo ? 'Toyo' : 'Rileys'}_${appliedFilters.fromDate}_to_${appliedFilters.toDate}.xlsx`);
  };

  const handleOpenDailyLogsModal = (machine: Machine, groupName: string, chartData: any[]) => {
    setDailyLogModal({
      open: true,
      machine,
      groupName,
      rows: chartData
    });
  };

  // Status Badge Helper
  const getStatusBadge = (status: 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'IDLE') => {
    if (status === 'AHEAD') {
      return (
        <Chip
          size="small"
          label="AHEAD (+5%)"
          sx={{ fontWeight: 800, bgcolor: 'rgba(16, 185, 129, 0.12)', color: '#059669', fontSize: '0.675rem' }}
        />
      );
    }
    if (status === 'ON_TRACK') {
      return (
        <Chip
          size="small"
          label="ON TARGET"
          sx={{ fontWeight: 800, bgcolor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', fontSize: '0.675rem' }}
        />
      );
    }
    if (status === 'BEHIND') {
      return (
        <Chip
          size="small"
          label="BEHIND TARGET"
          sx={{ fontWeight: 800, bgcolor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', fontSize: '0.675rem' }}
        />
      );
    }
    return (
      <Chip
        size="small"
        label="NO ACTIVE PLAN"
        sx={{ fontWeight: 700, bgcolor: '#f1f5f9', color: '#64748b', fontSize: '0.675rem' }}
      />
    );
  };

  // Custom Chart Tooltip (Clear 2-line Planned vs Actual focus)
  const CustomLineTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const planned = Number(data.dailyTarget) || 0;
      const actual = Number(data.dailyAchieved) || 0;
      const variance = actual - planned;
      const rate = planned > 0 ? (actual / planned) * 100 : (actual > 0 ? 100 : 0);

      return (
        <Paper
          elevation={4}
          sx={{
            p: 1.8,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            minWidth: 220,
            boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.15)'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, pb: 0.8, borderBottom: '1px solid #f1f5f9' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
              {data.dayName}, {data.dateLabel}
            </Typography>
            {data.isHoliday && (
              <Chip size="small" label="Factory Holiday" sx={{ height: 18, fontSize: '0.625rem', bgcolor: '#fef3c7', color: '#b45309', fontWeight: 700 }} />
            )}
          </Box>
          <Stack spacing={0.8}>
            {/* Planned Line 1 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box sx={{ width: 14, height: 3, borderTop: '2.5px dashed #2563eb' }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>
                  Planned Volume:
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.775rem', fontWeight: 800, color: '#1e293b' }}>
                {planned.toLocaleString()} <span style={{ fontSize: '0.65rem', color: '#64748b' }}>units</span>
              </Typography>
            </Box>

            {/* Actual Line 2 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box sx={{ width: 14, height: 3, bgcolor: '#10b981', borderRadius: '1.5px' }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                  Actual Volume:
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.775rem', fontWeight: 800, color: '#10b981' }}>
                {actual.toLocaleString()} <span style={{ fontSize: '0.65rem', color: '#64748b' }}>units</span>
              </Typography>
            </Box>

            <Divider sx={{ my: 0.4 }} />

            {/* Variance */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
                Daily Variance:
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: variance >= 0 ? '#059669' : '#dc2626'
                }}
              >
                {variance >= 0 ? `+${variance.toLocaleString()}` : variance.toLocaleString()} units
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
                Realization Rate:
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: rate >= 95 ? '#059669' : (rate >= 80 ? '#d97706' : '#dc2626')
                }}
              >
                {rate.toFixed(1)}%
              </Typography>
            </Box>
          </Stack>
        </Paper>
      );
    }
    return null;
  };

  if (loadingLogs || loadingOrders) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 14 }}>
        <CircularProgress color="primary" size={42} />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 1.5, pb: 6 }}>
      {/* ----------------------------------------------------
          PAGE HEADER
      ---------------------------------------------------- */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <BarChartIcon sx={{ color: '#10b981', fontSize: 28 }} />
            Production Analytics & Yield Overview
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            {isToyo 
              ? 'Toyo section and machine-wise daily performance graphs: Planned vs Actual production volumes presented in two distinct lines.' 
              : "Riley's category and machine-wise daily performance graphs: Planned vs Actual production volumes presented in two distinct lines."}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Chip
            icon={isToyo ? <LayersIcon sx={{ fontSize: 16 }} /> : <CategoryIcon sx={{ fontSize: 16 }} />}
            label={isToyo ? 'Toyo Manufacturing (Section Mode)' : "Riley's Plant (Category Mode)"}
            sx={{
              fontWeight: 800,
              bgcolor: isToyo ? 'rgba(2, 132, 199, 0.1)' : 'rgba(99, 102, 241, 0.1)',
              color: isToyo ? '#0284c7' : '#4f46e5',
              border: `1px solid ${isToyo ? 'rgba(2, 132, 199, 0.25)' : 'rgba(99, 102, 241, 0.25)'}`
            }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon fontSize="small" />}
            onClick={handleExportExcel}
            sx={{ fontWeight: 700, borderColor: '#cbd5e1', bgcolor: '#ffffff' }}
          >
            Export to Excel
          </Button>
        </Stack>
      </Box>

      {/* ----------------------------------------------------
          VIEW SWITCHER TABS: MACHINE CURVES vs ORDERS BREAKDOWN
      ---------------------------------------------------- */}
      <Box sx={{ mb: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 0.6,
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            bgcolor: '#f8fafc',
            display: 'inline-flex',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <Tabs
            value={dashboardView}
            onChange={(_, val) => setDashboardView(val)}
            sx={{
              minHeight: 42,
              '& .MuiTab-root': {
                minHeight: 42,
                py: 0.8,
                px: 2.5,
                fontWeight: 800,
                fontSize: '0.85rem',
                borderRadius: '10px',
                textTransform: 'none',
                color: '#64748b',
                transition: 'all 0.2s ease',
                '&.Mui-selected': {
                  bgcolor: '#ffffff',
                  color: '#0f172a',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)'
                }
              },
              '& .MuiTabs-indicator': {
                display: 'none'
              }
            }}
          >
            <Tab
              value="machines"
              icon={<PrecisionManufacturingIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={isToyo ? "Machine & Section Output Curves (2-Line)" : "Machine & Category Output Curves (2-Line)"}
            />
            <Tab
              value="orders"
              icon={<Inventory2Icon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Orders Planned vs Actuals Breakdown & Completion"
            />
          </Tabs>
        </Paper>
      </Box>

      {dashboardView === 'machines' ? (
        <>
          {/* ----------------------------------------------------
              FILTER CONSOLE
          ---------------------------------------------------- */}
      <Card
        sx={{
          p: 2.5,
          mb: 3.5,
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)'
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: '#10b981' }}>
            <FilterListIcon fontSize="small" />
            <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Production Filter Console
            </Typography>
          </Stack>

          {/* Quick Presets */}
          <ToggleButtonGroup
            size="small"
            value={datePreset}
            exclusive
            onChange={handlePresetChange}
            sx={{
              height: 30,
              '& .MuiToggleButton-root': {
                px: 1.2,
                py: 0.2,
                fontSize: '0.725rem',
                fontWeight: 700,
                textTransform: 'none',
                borderColor: '#e2e8f0',
                '&.Mui-selected': {
                  bgcolor: '#10b981',
                  color: '#ffffff',
                  '&:hover': { bgcolor: '#059669' }
                }
              }
            }}
          >
            <ToggleButton value="7">Last 7 Days</ToggleButton>
            <ToggleButton value="14">Last 14 Days</ToggleButton>
            <ToggleButton value="30">Last 30 Days</ToggleButton>
            <ToggleButton value="this_month">This Month</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <TextField
              label="From Date"
              type="date"
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={fromDateStr}
              onChange={(e) => {
                setFromDateStr(e.target.value);
                setDatePreset('custom');
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <TextField
              label="To Date"
              type="date"
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={toDateStr}
              onChange={(e) => {
                setToDateStr(e.target.value);
                setDatePreset('custom');
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Plant</InputLabel>
              <Select label="Plant" value={selectedPlant} onChange={(e) => setSelectedPlant(e.target.value)}>
                <MenuItem value="all">All Plants</MenuItem>
                {plants.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.plantName}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Section (for Toyo) or Category (for Riley's) Filter */}
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{isToyo ? 'Section' : 'Product Category'}</InputLabel>
              <Select
                label={isToyo ? 'Section' : 'Product Category'}
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <MenuItem value="all">{isToyo ? 'All Sections' : 'All Categories'}</MenuItem>
                {isToyo ? (
                  sections.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.sectionCode ? `${s.sectionCode} - ` : ''}{s.sectionName}
                    </MenuItem>
                  ))
                ) : (
                  categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Machine</InputLabel>
              <Select label="Machine" value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)}>
                <MenuItem value="all">All Machines</MenuItem>
                {machines
                  .filter((m) => selectedPlant === 'all' || m.plantId === selectedPlant)
                  .map((m) => (
                    <MenuItem key={m.id} value={m.id}>{m.machineCode} - {m.machineName}</MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<PlayArrowIcon />}
              onClick={handleApplyFilter}
              sx={{
                height: 40,
                fontWeight: 700,
                bgcolor: '#10b981',
                '&:hover': { bgcolor: '#059669' }
              }}
            >
              View Analytics
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* ----------------------------------------------------
          EXECUTIVE KPI SUMMARY CARDS
      ---------------------------------------------------- */}
      <Grid container spacing={2} sx={{ mb: 3.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ p: 2.2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Period Planned Target
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#2563eb' }}>
                    {groupMachineAnalytics.grandTotalTarget.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>units</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, mt: 0.2, display: 'block' }}>
                    Across {groupMachineAnalytics.totalDays} days in period
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', width: 40, height: 40 }}>
                  <AssignmentTurnedInIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ p: 2.2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Achieved Output Volume
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#10b981' }}>
                    {groupMachineAnalytics.grandTotalAchieved.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>units</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#059669', fontWeight: 700, mt: 0.2, display: 'block' }}>
                    Today's Output: {groupMachineAnalytics.grandTodayAchieved.toLocaleString()} units
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: 40, height: 40 }}>
                  <TrendingUpIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ p: 2.2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Period Realization Rate
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: groupMachineAnalytics.overallAchievementRate >= 95 ? '#10b981' : '#f59e0b' }}>
                    {groupMachineAnalytics.overallAchievementRate.toFixed(1)}<span style={{ fontSize: '1rem', fontWeight: 600 }}>%</span>
                  </Typography>
                  <Box sx={{ mt: 0.8, width: 130 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, groupMachineAnalytics.overallAchievementRate)}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: groupMachineAnalytics.overallAchievementRate >= 95 ? '#10b981' : '#f59e0b',
                          borderRadius: 3
                        }
                      }}
                    />
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: 40, height: 40 }}>
                  <ShowChartIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ p: 2.2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Cumulative Output Realized
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#8b5cf6' }}>
                    {groupMachineAnalytics.grandTotalAchieved.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>units</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mt: 0.2, display: 'block' }}>
                    Quality Scrap Rate: {groupMachineAnalytics.scrapRate.toFixed(2)}%
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', width: 40, height: 40 }}>
                  <CheckCircleIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ----------------------------------------------------
          PRIMARY VIEW: SECTION/CATEGORY MACHINE-WISE DAILY OUTPUT LINE GRAPHS (TWO LINES)
      ---------------------------------------------------- */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <PrecisionManufacturingIcon sx={{ color: '#10b981' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                {isToyo ? 'Section' : 'Category'} & Machine-Wise Output Performance ({appliedFilters.fromDate} to {appliedFilters.toDate})
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Each machine row compares <strong>Planned Volume</strong> and <strong>Actual Volume</strong> in two distinct lines on a unified scale.
              </Typography>
            </Box>
          </Stack>

          {/* Graph Legend Guide: Two Lines */}
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', bgcolor: '#ffffff', px: 2, py: 0.8, borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Box sx={{ width: 18, height: 3, borderTop: '2.5px dashed #2563eb' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>Planned Volume</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Box sx={{ width: 18, height: 3, bgcolor: '#10b981', borderRadius: '1.5px' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>Actual Volume</Typography>
            </Box>
          </Stack>
        </Box>

        {groupMachineAnalytics.groups.length === 0 ? (
          <Card sx={{ p: 6, textAlign: 'center', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <PrecisionManufacturingIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1, display: 'block', mx: 'auto' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
              No Active Machines Found
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              Please check your filter parameters or register machines and production plans.
            </Typography>
          </Card>
        ) : (
          groupMachineAnalytics.groups.map((group) => {
            const isCollapsed = !!collapsedGroups[group.group.id];

            return (
              <Box key={group.group.id} sx={{ mb: 3.5 }}>
                {/* SECTION / CATEGORY HEADER BAR */}
                <Card
                  sx={{
                    p: 1.8,
                    px: 2.5,
                    mb: 1.5,
                    borderRadius: '14px',
                    bgcolor: isToyo 
                      ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)'
                      : 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleGroupCollapse(group.group.id)}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <IconButton size="small" sx={{ p: 0.2, color: isToyo ? '#0284c7' : '#6366f1' }}>
                      {isCollapsed ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
                    </IconButton>
                    {isToyo ? (
                      <LayersIcon sx={{ color: '#0284c7' }} />
                    ) : (
                      <CategoryIcon sx={{ color: '#6366f1' }} />
                    )}
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        {isToyo ? 'Section: ' : 'Category: '}{group.group.name}
                      </Typography>
                      {group.group.code && (
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                          Code: {group.group.code}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      size="small"
                      label={`${group.machineRows.length} Line(s)`}
                      sx={{
                        height: 20,
                        fontSize: '0.675rem',
                        fontWeight: 700,
                        bgcolor: isToyo ? 'rgba(2, 132, 199, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        color: isToyo ? '#0284c7' : '#4f46e5'
                      }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                        Target: <strong>{group.totalTarget.toLocaleString()}</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: '#059669', fontWeight: 700, display: 'block' }}>
                        Output: <strong>{group.totalAchieved.toLocaleString()}</strong>
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={`${group.achievementRate.toFixed(1)}% Realized`}
                      sx={{
                        fontWeight: 800,
                        bgcolor: group.achievementRate >= 95 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        color: group.achievementRate >= 95 ? '#059669' : '#d97706',
                        fontSize: '0.725rem'
                      }}
                    />
                  </Stack>
                </Card>

                {/* MACHINE ROWS WITH TWO-LINE GRAPHS */}
                {!isCollapsed && (
                  <Stack spacing={2}>
                    {group.machineRows.map((mr) => {
                      const variance = mr.periodAchieved - mr.periodTarget;
                      const isPositive = variance >= 0;

                      return (
                        <Card
                          key={mr.machine.id}
                          sx={{
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            bgcolor: '#ffffff',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                            overflow: 'hidden',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: '#cbd5e1',
                              boxShadow: '0 6px 20px rgba(0,0,0,0.06)'
                            }
                          }}
                        >
                          <Grid container>
                            {/* LEFT PANEL: MACHINE SPECIFICATIONS & METRICS */}
                            <Grid
                              size={{ xs: 12, md: 4 }}
                              sx={{
                                p: 2.5,
                                borderRight: { xs: 'none', md: '1px solid #f1f5f9' },
                                borderBottom: { xs: '1px solid #f1f5f9', md: 'none' },
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                bgcolor: '#fafafa'
                              }}
                            >
                              <Box>
                                {/* Machine Identifier & Status */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                  <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                      {mr.machine.machineCode}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
                                      {mr.machine.machineName}
                                    </Typography>
                                    <Stack direction="row" spacing={0.8} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                                      <Chip
                                        size="small"
                                        icon={isToyo ? <LayersIcon sx={{ fontSize: 13 }} /> : <CategoryIcon sx={{ fontSize: 13 }} />}
                                        label={group.group.name}
                                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}
                                      />
                                      <Chip
                                        size="small"
                                        label={`${mr.machine.operatingHours || 24}h/day`}
                                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}
                                      />
                                    </Stack>
                                  </Box>
                                  {getStatusBadge(mr.status)}
                                </Box>

                                {/* Target vs Achieved Metric Grid */}
                                <Grid container spacing={1.5} sx={{ mt: 1 }}>
                                  <Grid size={{ xs: 6 }}>
                                    <Box sx={{ p: 1.2, bgcolor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                      <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 800, fontSize: '0.675rem', display: 'block' }}>
                                        Planned Target (Period)
                                      </Typography>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                        {mr.periodTarget.toLocaleString()} <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>units</span>
                                      </Typography>
                                    </Box>
                                  </Grid>

                                  <Grid size={{ xs: 6 }}>
                                    <Box sx={{ p: 1.2, bgcolor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                      <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, fontSize: '0.675rem', display: 'block' }}>
                                        Actual Achieved (Period)
                                      </Typography>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#10b981' }}>
                                        {mr.periodAchieved.toLocaleString()} <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>units</span>
                                      </Typography>
                                    </Box>
                                  </Grid>

                                  <Grid size={{ xs: 6 }}>
                                    <Box sx={{ p: 1.2, bgcolor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.675rem', display: 'block' }}>
                                        Today's Output
                                      </Typography>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                        {mr.todayAchieved.toLocaleString()} <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>units</span>
                                      </Typography>
                                    </Box>
                                  </Grid>

                                  <Grid size={{ xs: 6 }}>
                                    <Box sx={{ p: 1.2, bgcolor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.675rem', display: 'block' }}>
                                        Variance Balance
                                      </Typography>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: isPositive ? '#059669' : '#dc2626' }}>
                                        {isPositive ? '+' : ''}{variance.toLocaleString()} <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>units</span>
                                      </Typography>
                                    </Box>
                                  </Grid>
                                </Grid>
                              </Box>

                              {/* Action to view day-by-day table */}
                              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: mr.achievementRate >= 95 ? '#059669' : '#d97706' }}>
                                  {mr.achievementRate.toFixed(1)}% Realized
                                </Typography>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<TableViewIcon fontSize="small" />}
                                  onClick={() => handleOpenDailyLogsModal(mr.machine, group.group.name, mr.chartData)}
                                  sx={{ fontSize: '0.725rem', fontWeight: 700, py: 0.3, borderColor: '#cbd5e1', bgcolor: '#ffffff' }}
                                >
                                  View Day-by-Day Log
                                </Button>
                              </Box>
                            </Grid>

                            {/* RIGHT PANEL: TWO-LINE GRAPH ON UNIFIED SCALE */}
                            <Grid size={{ xs: 12, md: 8 }} sx={{ p: 2.5, bgcolor: '#ffffff' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                  Planned vs Actual Volume Curve • {appliedFilters.fromDate} to {appliedFilters.toDate}
                                </Typography>
                                
                                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                    <Box sx={{ width: 14, height: 2.5, borderTop: '2px dashed #2563eb' }} />
                                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb' }}>
                                      Planned ({mr.periodTarget.toLocaleString()})
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                    <Box sx={{ width: 14, height: 2.5, bgcolor: '#10b981', borderRadius: '1px' }} />
                                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>
                                      Actual ({mr.periodAchieved.toLocaleString()})
                                    </Typography>
                                  </Box>
                                  <Chip
                                    size="small"
                                    label={`${isPositive ? '+' : ''}${variance.toLocaleString()} units`}
                                    sx={{
                                      height: 20,
                                      fontSize: '0.675rem',
                                      fontWeight: 800,
                                      bgcolor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                      color: isPositive ? '#059669' : '#dc2626'
                                    }}
                                  />
                                </Stack>
                              </Box>

                              <Box sx={{ width: '100%', height: 220 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart
                                    data={mr.chartData}
                                    margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                      dataKey="dateLabel"
                                      stroke="#94a3b8"
                                      tickLine={false}
                                      style={{ fontSize: '0.7rem', fontWeight: 600 }}
                                    />
                                    {/* Unified Single Left Y-Axis for 1-to-1 visual comparability */}
                                    <YAxis
                                      stroke="#94a3b8"
                                      tickLine={false}
                                      style={{ fontSize: '0.7rem' }}
                                      tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                                    />
                                    <RechartsTooltip content={<CustomLineTooltip />} />
                                    <Legend
                                      verticalAlign="top"
                                      align="right"
                                      iconType="plainline"
                                      wrapperStyle={{ paddingBottom: 8, fontSize: '0.72rem', fontWeight: 700 }}
                                    />
                                    
                                    {/* Line 1: Planned Daily Volume (Indigo / Royal Blue dashed) */}
                                    <Line
                                      type="monotone"
                                      dataKey="dailyTarget"
                                      name="Planned Target Volume"
                                      stroke="#2563eb"
                                      strokeDasharray="5 5"
                                      strokeWidth={2.5}
                                      dot={{ r: 3, fill: '#ffffff', stroke: '#2563eb', strokeWidth: 2 }}
                                      activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                                    />

                                    {/* Line 2: Actual Daily Volume (Emerald Green solid) */}
                                    <Line
                                      type="monotone"
                                      dataKey="dailyAchieved"
                                      name="Actual Produced Volume"
                                      stroke="#10b981"
                                      strokeWidth={3}
                                      dot={{ r: 3.5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                                      activeDot={{ r: 6.5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </Box>
                            </Grid>
                          </Grid>
                        </Card>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {/* ----------------------------------------------------
          AGGREGATE OVERVIEWS & SECTION/CATEGORY PERFORMANCE
      ---------------------------------------------------- */}
      <Grid container spacing={3}>
        {/* Section/Category Target vs Achieved Bar Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: '16px', border: '1px solid #e2e8f0', p: 2.5, bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
              {isToyo ? 'Section' : 'Category'} Output vs Target Volume
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
              Planned budget targets vs actual output yield by {isToyo ? 'manufacturing section' : 'product category'}.
            </Typography>
            <Box sx={{ width: '100%', height: 260 }}>
              {groupBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupBarData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="groupName" stroke="#94a3b8" style={{ fontSize: '0.725rem' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '0.725rem' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', fontWeight: 600 }} />
                    <Bar dataKey="Target" fill="#2563eb" name="Planned Target" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Achieved" fill="#10b981" name="Actual Achieved" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">No {isToyo ? 'section' : 'category'} data available</Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Fleet Daily Run Rate Line Chart (Target vs Achieved) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: '16px', border: '1px solid #e2e8f0', p: 2.5, bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
              Fleet Aggregate Daily Run Rate Trend
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
              Total plant output pace compared against collective daily targets.
            </Typography>
            <Box sx={{ width: '100%', height: 260 }}>
              {aggregateDailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aggregateDailyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '0.725rem' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '0.725rem' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', fontWeight: 600 }} />
                    <Line type="monotone" dataKey="Target" name="Planned Target" stroke="#2563eb" strokeDasharray="5 5" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="Achieved" name="Actual Achieved" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">No trend data available</Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>
    </>
  ) : (
    /* ----------------------------------------------------
        SEPARATE DASHBOARD: ORDERS PLANNED VS ACTUALS BREAKDOWN & COMPLETION
    ---------------------------------------------------- */
    <Box>
      {/* ORDERS EXECUTIVE KPI ROW */}
      <Grid container spacing={2} sx={{ mb: 3.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ p: 2.2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Total Tracked Orders
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#4f46e5' }}>
                    {ordersAnalytics.totalOrders} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>orders</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mt: 0.2, display: 'block' }}>
                    {ordersAnalytics.completedCount} Completed • {ordersAnalytics.inProgressCount} In Progress
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', width: 40, height: 40 }}>
                  <Inventory2Icon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ p: 2.2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Planned Order Target
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#2563eb' }}>
                    {ordersAnalytics.grandPlannedVolume.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>units</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, mt: 0.2, display: 'block' }}>
                    Total committed scheduled volume
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', width: 40, height: 40 }}>
                  <AssignmentTurnedInIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ p: 2.2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Actual Produced Volume
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#10b981' }}>
                    {ordersAnalytics.grandActualVolume.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>units</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#059669', fontWeight: 700, mt: 0.2, display: 'block' }}>
                    Balance: {Math.max(0, ordersAnalytics.grandPlannedVolume - ordersAnalytics.grandActualVolume).toLocaleString()} units left
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: 40, height: 40 }}>
                  <TrendingUpIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ p: 2.2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ width: '100%', pr: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Overall Order Completion
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: ordersAnalytics.overallFulfillmentRate >= 95 ? '#10b981' : (ordersAnalytics.overallFulfillmentRate >= 70 ? '#3b82f6' : '#f59e0b') }}>
                    {ordersAnalytics.overallFulfillmentRate.toFixed(1)}<span style={{ fontSize: '1rem', fontWeight: 600 }}>%</span>
                  </Typography>
                  <Box sx={{ mt: 0.8, width: '100%' }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, ordersAnalytics.overallFulfillmentRate)}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: ordersAnalytics.overallFulfillmentRate >= 95 ? '#10b981' : (ordersAnalytics.overallFulfillmentRate >= 70 ? '#3b82f6' : '#f59e0b'),
                          borderRadius: 3
                        }
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: ordersAnalytics.behindCount > 0 ? '#dc2626' : '#059669', fontWeight: 700, mt: 0.5, display: 'block' }}>
                    {ordersAnalytics.behindCount > 0 ? `${ordersAnalytics.behindCount} Order(s) Overdue / Behind` : 'All Active Orders On Schedule'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: 40, height: 40 }}>
                  <CheckCircleIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ORDERS FILTER & SEARCH TOOLBAR */}
      <Card
        sx={{
          p: 2.2,
          mb: 3,
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
        }}
      >
        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={`Search by Order #, Item, or ${isToyo ? 'Section' : 'Category'}...`}
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                    </InputAdornment>
                  )
                }
              }}
            />
          </Grid>

          {/* Section (Toyo) or Category (Riley's) Filter */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{isToyo ? 'Filter by Section' : 'Filter by Category'}</InputLabel>
              <Select
                label={isToyo ? 'Filter by Section' : 'Filter by Category'}
                value={orderGroupFilter}
                onChange={(e) => setOrderGroupFilter(e.target.value)}
              >
                <MenuItem value="all">{isToyo ? 'All Sections' : 'All Categories'}</MenuItem>
                {isToyo ? (
                  sections.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.sectionCode ? `${s.sectionCode} - ` : ''}{s.sectionName}
                    </MenuItem>
                  ))
                ) : (
                  categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Grid>

          {/* Status Filter Chips */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.6 }}>
              <Chip
                label={`All (${ordersAnalytics.totalOrders})`}
                onClick={() => setOrderStatusFilter('ALL')}
                color={orderStatusFilter === 'ALL' ? 'primary' : 'default'}
                variant={orderStatusFilter === 'ALL' ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
              />
              <Chip
                label={`Completed (${ordersAnalytics.completedCount})`}
                onClick={() => setOrderStatusFilter('COMPLETED')}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  bgcolor: orderStatusFilter === 'COMPLETED' ? '#10b981' : 'transparent',
                  color: orderStatusFilter === 'COMPLETED' ? '#ffffff' : '#059669',
                  border: '1px solid #10b981'
                }}
              />
              <Chip
                label={`In Progress (${ordersAnalytics.inProgressCount})`}
                onClick={() => setOrderStatusFilter('IN_PROGRESS')}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  bgcolor: orderStatusFilter === 'IN_PROGRESS' ? '#2563eb' : 'transparent',
                  color: orderStatusFilter === 'IN_PROGRESS' ? '#ffffff' : '#2563eb',
                  border: '1px solid #2563eb'
                }}
              />
              <Chip
                label={`Behind (${ordersAnalytics.behindCount})`}
                onClick={() => setOrderStatusFilter('BEHIND')}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  bgcolor: orderStatusFilter === 'BEHIND' ? '#ef4444' : 'transparent',
                  color: orderStatusFilter === 'BEHIND' ? '#ffffff' : '#dc2626',
                  border: '1px solid #ef4444'
                }}
              />
              <Chip
                label={`Scheduled (${ordersAnalytics.pendingCount})`}
                onClick={() => setOrderStatusFilter('SCHEDULED')}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  bgcolor: orderStatusFilter === 'SCHEDULED' ? '#8b5cf6' : 'transparent',
                  color: orderStatusFilter === 'SCHEDULED' ? '#ffffff' : '#8b5cf6',
                  border: '1px solid #8b5cf6'
                }}
              />
            </Stack>
          </Grid>
        </Grid>
      </Card>

      {/* TOP ORDERS COMPARISON BAR CHART WITH CLEAR LEGEND */}
      <Card
        sx={{
          p: 2.5,
          mb: 3.5,
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Orders Planned Target vs Actual Delivered Volumes
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Side-by-side volume realization and fulfillment completion for active orders.
            </Typography>
          </Box>

          {/* Chart Legend Guide */}
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', bgcolor: '#f8fafc', px: 2, py: 0.8, borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Box sx={{ width: 14, height: 14, bgcolor: '#2563eb', borderRadius: '3px' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>Planned Volume</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Box sx={{ width: 14, height: 14, bgcolor: '#10b981', borderRadius: '3px' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>Actual Delivered</Typography>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ width: '100%', height: 280 }}>
          {topOrdersBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topOrdersBarData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" style={{ fontSize: '0.725rem', fontWeight: 600 }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '0.725rem' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const planned = payload.find(p => p.dataKey === 'Planned')?.value as number || 0;
                      const actual = payload.find(p => p.dataKey === 'Actual')?.value as number || 0;
                      const rate = planned > 0 ? (actual / planned) * 100 : 0;
                      const orderItem = topOrdersBarData.find(d => d.label === label);
                      return (
                        <Paper sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: '10px', bgcolor: '#ffffff', minWidth: 200, boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                            Order #{label}
                          </Typography>
                          {orderItem?.productName && (
                            <Typography sx={{ fontSize: '0.7rem', color: '#64748b', mb: 1 }}>
                              {orderItem.productName}
                            </Typography>
                          )}
                          <Stack spacing={0.6} sx={{ mt: 0.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography sx={{ fontSize: '0.725rem', color: '#2563eb', fontWeight: 700 }}>Planned Target:</Typography>
                              <Typography sx={{ fontSize: '0.725rem', fontWeight: 800 }}>{planned.toLocaleString()} units</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography sx={{ fontSize: '0.725rem', color: '#10b981', fontWeight: 700 }}>Actual Produced:</Typography>
                              <Typography sx={{ fontSize: '0.725rem', fontWeight: 800 }}>{actual.toLocaleString()} units</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography sx={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 700 }}>Completion Rate:</Typography>
                              <Typography sx={{ fontSize: '0.725rem', fontWeight: 800, color: rate >= 95 ? '#059669' : '#d97706' }}>{rate.toFixed(1)}%</Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 10, fontSize: '0.75rem', fontWeight: 700 }} />
                <Bar dataKey="Planned" name="Planned Target Volume" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" name="Actual Delivered Volume" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="text.secondary">No order comparison data available for current filters.</Typography>
            </Box>
          )}
        </Box>
      </Card>

      {/* ORDERS BREAKDOWN DATA TABLE */}
      <Card
        sx={{
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 2, px: 2.5, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Orders Planned vs Actuals Breakdown & Realization
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Showing {filteredOrderRows.length} of {ordersAnalytics.totalOrders} production orders with line allocation and fulfillment tracking.
            </Typography>
          </Box>
        </Box>

        <TableContainer sx={{ maxHeight: 560 }}>
          <Table size="small" stickyHeader>
            <TableHead sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: '0.75rem' } }}>
              <TableRow>
                <TableCell>Order #</TableCell>
                <TableCell>Product / Item</TableCell>
                <TableCell>{isToyo ? 'Section' : 'Category'}</TableCell>
                <TableCell>Assigned Line(s)</TableCell>
                <TableCell align="right">Planned Target</TableCell>
                <TableCell align="right">Actual Produced</TableCell>
                <TableCell align="right">Balance Left</TableCell>
                <TableCell align="center" sx={{ width: 160 }}>Completion %</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrderRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                    <Inventory2Icon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#475569' }}>
                      No Orders Match the Selected Criteria
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      Try clearing the search query or adjusting your status / {isToyo ? 'section' : 'category'} filter.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrderRows.map((r) => {
                  const rate = r.completionRate;
                  const isComplete = rate >= 100;
                  const barColor = isComplete ? '#10b981' : (rate >= 75 ? '#059669' : (rate >= 40 ? '#2563eb' : (rate > 0 ? '#f59e0b' : '#94a3b8')));

                  return (
                    <TableRow key={r.order.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{r.order.orderNumber}</span>
                          {r.order.priority && r.order.priority !== 'MEDIUM' && (
                            <Chip
                              size="small"
                              label={r.order.priority}
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                bgcolor: r.order.priority === 'HIGH' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                color: r.order.priority === 'HIGH' ? '#dc2626' : '#d97706'
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#334155' }}>
                        {r.order.productName || '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={isToyo ? <LayersIcon sx={{ fontSize: 13 }} /> : <CategoryIcon sx={{ fontSize: 13 }} />}
                          label={r.groupName}
                          sx={{
                            height: 22,
                            fontSize: '0.675rem',
                            fontWeight: 700,
                            bgcolor: isToyo ? 'rgba(2, 132, 199, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                            color: isToyo ? '#0284c7' : '#4f46e5'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {r.assignedMachines.length > 0 ? (
                            r.assignedMachines.map((m: any) => (
                              <Chip
                                key={m.id}
                                size="small"
                                label={m.machineCode}
                                sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#f1f5f9' }}
                              />
                            ))
                          ) : (
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>Unscheduled</Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#2563eb' }}>
                        {r.targetPlanned.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: r.actualDeliveredVolume > 0 ? '#10b981' : '#64748b' }}>
                        {r.actualDeliveredVolume.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: r.remainingVolume > 0 ? '#64748b' : '#10b981' }}>
                        {r.remainingVolume > 0 ? r.remainingVolume.toLocaleString() : '0'}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={rate}
                              sx={{
                                height: 7,
                                borderRadius: 3.5,
                                bgcolor: '#e2e8f0',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: barColor,
                                  borderRadius: 3.5
                                }
                              }}
                            />
                          </Box>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, minWidth: 42, color: barColor }}>
                            {rate.toFixed(0)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600, color: r.isOverdue ? '#dc2626' : '#475569' }}>
                            {r.dueDateStr}
                          </Typography>
                          {r.isOverdue && (
                            <Chip
                              size="small"
                              label="Overdue"
                              sx={{ height: 18, fontSize: '0.6rem', fontWeight: 800, bgcolor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        {r.status === 'COMPLETED' ? (
                          <Chip size="small" label="Completed" sx={{ height: 22, fontSize: '0.675rem', fontWeight: 800, bgcolor: 'rgba(16, 185, 129, 0.12)', color: '#059669' }} />
                        ) : r.status === 'IN_PROGRESS' ? (
                          <Chip size="small" label="In Progress" sx={{ height: 22, fontSize: '0.675rem', fontWeight: 800, bgcolor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }} />
                        ) : r.status === 'BEHIND' ? (
                          <Chip size="small" label="Behind" sx={{ height: 22, fontSize: '0.675rem', fontWeight: 800, bgcolor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' }} />
                        ) : r.status === 'SCHEDULED' ? (
                          <Chip size="small" label="Scheduled" sx={{ height: 22, fontSize: '0.675rem', fontWeight: 800, bgcolor: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed' }} />
                        ) : (
                          <Chip size="small" label="Pending" sx={{ height: 22, fontSize: '0.675rem', fontWeight: 800, bgcolor: '#f1f5f9', color: '#64748b' }} />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon fontSize="small" />}
                          onClick={() => setOrderDetailModal({ open: true, orderRow: r })}
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            py: 0.3,
                            px: 1,
                            borderColor: '#cbd5e1',
                            bgcolor: '#ffffff'
                          }}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  )}

      {/* ----------------------------------------------------
          MODAL: DAY-BY-DAY DAILY OUTPUT BREAKDOWN TABLE
      ---------------------------------------------------- */}
      <Dialog
        open={dailyLogModal.open}
        onClose={() => setDailyLogModal(prev => ({ ...prev, open: false }))}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Day-by-Day Daily Output Log • {dailyLogModal.machine?.machineCode} ({dailyLogModal.machine?.machineName})
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            {isToyo ? 'Section' : 'Category'}: {dailyLogModal.groupName} • Period: {appliedFilters.fromDate} to {appliedFilters.toDate}
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          <TableContainer sx={{ maxHeight: 460 }}>
            <Table size="small" stickyHeader>
              <TableHead sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: '0.75rem' } }}>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Day</TableCell>
                  <TableCell align="right">Planned Target</TableCell>
                  <TableCell align="right">Achieved Output</TableCell>
                  <TableCell align="right">Daily Variance</TableCell>
                  <TableCell align="right">Cum. Target</TableCell>
                  <TableCell align="right">Cum. Achieved</TableCell>
                  <TableCell align="center">Realization</TableCell>
                  <TableCell>Notes / Stoppages</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailyLogModal.rows.map((r) => {
                  const percent = r.dailyTarget > 0 ? (r.dailyAchieved / r.dailyTarget) * 100 : (r.dailyAchieved > 0 ? 100 : 0);
                  const isPositive = r.dailyVariance >= 0;

                  return (
                    <TableRow key={r.dateStr} hover sx={{ bgcolor: r.isHoliday ? 'rgba(236, 72, 153, 0.04)' : 'inherit' }}>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {r.dateStr}
                        {r.isHoliday && (
                          <Chip size="small" label="Holiday" sx={{ ml: 1, height: 18, fontSize: '0.625rem', bgcolor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', fontWeight: 700 }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ color: '#64748b' }}>{r.dayName}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#2563eb' }}>
                        {r.dailyTarget?.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: r.dailyAchieved > 0 ? '#10b981' : '#64748b' }}>
                        {r.dailyAchieved?.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: isPositive ? '#059669' : '#dc2626' }}>
                        {isPositive ? '+' : ''}{r.dailyVariance?.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#64748b' }}>
                        {r.cumulativeTarget?.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: '#8b5cf6' }}>
                        {r.cumulativeAchieved?.toLocaleString()}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={`${percent.toFixed(0)}%`}
                          sx={{
                            height: 20,
                            fontWeight: 700,
                            fontSize: '0.675rem',
                            bgcolor: percent >= 95 ? 'rgba(16, 185, 129, 0.1)' : (percent >= 80 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                            color: percent >= 95 ? '#059669' : (percent >= 80 ? '#d97706' : '#dc2626')
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.725rem', color: '#64748b' }}>
                        {r.dayLogs && r.dayLogs.length > 0 ? (
                          r.dayLogs.map((log: DailyProduction, i: number) => (
                            <span key={log.id || i}>
                              {log.notes ? `"${log.notes}" ` : ''}
                              {log.downtimeMinutes ? `(DT: ${log.downtimeMinutes}m)` : ''}
                            </span>
                          ))
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="contained"
            onClick={() => setDailyLogModal(prev => ({ ...prev, open: false }))}
            sx={{ fontWeight: 700, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ----------------------------------------------------
          MODAL: ORDER DAILY PRODUCTION BREAKDOWN & SCHEDULE DETAILS
      ---------------------------------------------------- */}
      <Dialog
        open={orderDetailModal.open}
        onClose={() => setOrderDetailModal({ open: false, orderRow: null })}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        {orderDetailModal.orderRow && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Order Breakdown: #{orderDetailModal.orderRow.order.orderNumber}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {orderDetailModal.orderRow.order.productName} • {isToyo ? 'Section' : 'Category'}: {orderDetailModal.orderRow.groupName}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip
                    size="small"
                    label={`${orderDetailModal.orderRow.completionRate.toFixed(1)}% Completed`}
                    sx={{
                      fontWeight: 800,
                      bgcolor: orderDetailModal.orderRow.completionRate >= 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                      color: orderDetailModal.orderRow.completionRate >= 100 ? '#059669' : '#2563eb'
                    }}
                  />
                  <Chip
                    size="small"
                    label={orderDetailModal.orderRow.status}
                    sx={{
                      fontWeight: 800,
                      bgcolor: orderDetailModal.orderRow.status === 'COMPLETED' ? '#10b981' : (orderDetailModal.orderRow.status === 'BEHIND' ? '#ef4444' : '#2563eb'),
                      color: '#ffffff'
                    }}
                  />
                </Stack>
              </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 2.5 }}>
              {/* Key Metrics Grid */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper sx={{ p: 1.5, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 800, fontSize: '0.675rem' }}>
                      Target Planned Volume
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {orderDetailModal.orderRow.targetPlanned.toLocaleString()} units
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper sx={{ p: 1.5, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, fontSize: '0.675rem' }}>
                      Delivered Output
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#10b981' }}>
                      {orderDetailModal.orderRow.actualDeliveredVolume.toLocaleString()} units
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper sx={{ p: 1.5, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, fontSize: '0.675rem' }}>
                      Remaining Balance
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: orderDetailModal.orderRow.remainingVolume > 0 ? '#475569' : '#059669' }}>
                      {orderDetailModal.orderRow.remainingVolume.toLocaleString()} units
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper sx={{ p: 1.5, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 800, fontSize: '0.675rem' }}>
                      Due Date & Window
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: orderDetailModal.orderRow.isOverdue ? '#dc2626' : '#0f172a', mt: 0.5 }}>
                      {orderDetailModal.orderRow.dueDateStr} {orderDetailModal.orderRow.isOverdue ? '(Overdue)' : ''}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* SECTION A: DAILY PRODUCTION LOGS DELIVERED FOR THIS ORDER */}
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon sx={{ color: '#10b981', fontSize: 18 }} />
                Daily Output Logs Recorded for this Order ({orderDetailModal.orderRow.orderLogs.length} entries)
              </Typography>
              <TableContainer sx={{ mb: 3, border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <Table size="small">
                  <TableHead sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: '0.725rem' } }}>
                    <TableRow>
                      <TableCell>Production Date</TableCell>
                      <TableCell>Recorded By</TableCell>
                      <TableCell align="right">Delivered Volume</TableCell>
                      <TableCell align="right">Accepted Qty</TableCell>
                      <TableCell align="right">Scrap / Rejected</TableCell>
                      <TableCell align="right">Downtime (min)</TableCell>
                      <TableCell>Notes / Observations</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orderDetailModal.orderRow.orderLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: '#94a3b8' }}>
                          No daily production entries recorded yet for this order.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orderDetailModal.orderRow.orderLogs.map((log: DailyProduction) => (
                        <TableRow key={log.id} hover>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {log.dateStr || (log.date ? toLocalDateString(log.date) : '—')}
                          </TableCell>
                          <TableCell sx={{ color: '#64748b' }}>
                            {log.enteredBy || log.enteredByEmail || '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: '#10b981' }}>
                            {Number(log.actualVolume || 0).toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: '#059669' }}>
                            {Number(log.acceptedQuantity || 0).toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: Number(log.rejectedQuantity || 0) > 0 ? '#dc2626' : '#64748b' }}>
                            {Number(log.rejectedQuantity || 0).toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#64748b' }}>
                            {log.downtimeMinutes ? `${log.downtimeMinutes}m` : '0m'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {log.notes || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* SECTION B: LINKED PRODUCTION PLANS & SCHEDULES */}
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrecisionManufacturingIcon sx={{ color: '#2563eb', fontSize: 18 }} />
                Scheduled Production Plans ({orderDetailModal.orderRow.orderPlans.length} plans)
              </Typography>
              <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <Table size="small">
                  <TableHead sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: '0.725rem' } }}>
                    <TableRow>
                      <TableCell>Plan Code / ID</TableCell>
                      <TableCell>Assigned Machine</TableCell>
                      <TableCell>Start Date</TableCell>
                      <TableCell>End Date</TableCell>
                      <TableCell align="right">Daily Target Rate</TableCell>
                      <TableCell align="right">Total Planned Volume</TableCell>
                      <TableCell align="center">Plan Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orderDetailModal.orderRow.orderPlans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: '#94a3b8' }}>
                          No production schedule created for this order yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orderDetailModal.orderRow.orderPlans.map((p: ProductionPlan) => {
                        const mach = machines.find(m => m.id === p.machineId);
                        return (
                          <TableRow key={p.id} hover>
                            <TableCell sx={{ fontWeight: 700 }}>
                              {p.id.slice(0, 8)}...
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>
                              {mach ? `${mach.machineCode} - ${mach.machineName}` : p.machineId}
                            </TableCell>
                            <TableCell sx={{ color: '#64748b' }}>{toLocalDateString(p.startDate)}</TableCell>
                            <TableCell sx={{ color: '#64748b' }}>{toLocalDateString(p.endDate)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {p.plannedDailyRate?.toLocaleString() || '—'} / day
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: '#2563eb' }}>
                              {p.totalPlannedVolume?.toLocaleString() || '—'}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={p.status || 'CONFIRMED'}
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  bgcolor: p.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                                  color: p.status === 'COMPLETED' ? '#059669' : '#2563eb'
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
              <Button
                variant="contained"
                onClick={() => setOrderDetailModal({ open: false, orderRow: null })}
                sx={{ fontWeight: 700, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};
