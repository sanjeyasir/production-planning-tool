import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  getDailyProductions,
  getProductionPlans,
  getMachines,
  getProductionCategories,
  getPlants,
  getHolidays,
  toLocalDateString,
  parseLocalDate,
  type DailyProduction,
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
  Divider
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
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';

import * as XLSX from 'xlsx';

export const ProductionDashboard: React.FC = () => {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';

  // ----------------------------------------------------
  // 1. DATA QUERIES
  // ----------------------------------------------------
  const { data: dailyLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['dailyProductions', tenantId],
    queryFn: () => getDailyProductions(tenantId),
    enabled: !!tenantId,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['productionPlans', tenantId],
    queryFn: () => getProductionPlans(tenantId),
    enabled: !!tenantId,
  });

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

  // ----------------------------------------------------
  // 2. FILTER CONSOLE STATE
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
    categoryId: 'all',
    machineId: 'all'
  });

  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMachine, setSelectedMachine] = useState<string>('all');

  // Collapsed state for Category groups
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Modal for Viewing specific machine daily output logs
  const [dailyLogModal, setDailyLogModal] = useState<{
    open: boolean;
    machine: Machine | null;
    categoryName: string;
    rows: any[];
  }>({
    open: false,
    machine: null,
    categoryName: '',
    rows: []
  });

  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
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
      categoryId: selectedCategory,
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
  // 4. CATEGORY MACHINE-WISE PRODUCTION ANALYTICS CALCULATION
  // ----------------------------------------------------
  const categoryMachineAnalytics = useMemo(() => {
    // 1. Determine relevant categories
    const activeCats = categories.filter(c => {
      if (appliedFilters.categoryId !== 'all' && c.id !== appliedFilters.categoryId) return false;
      return true;
    });

    const knownCatIds = new Set(categories.map(c => c.id));
    const hasUnassigned = machines.some(m => !m.categoryId || !knownCatIds.has(m.categoryId));

    const categoryList = [...activeCats];
    if (hasUnassigned && appliedFilters.categoryId === 'all') {
      categoryList.push({
        id: 'unassigned',
        tenantId,
        name: 'General / Unassigned',
        description: 'Machines with unassigned production category',
        status: 'ACTIVE',
        createdAt: new Date()
      });
    }

    // 2. Filter machines
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

    const result = categoryList.map(cat => {
      // Find machines belonging to this category
      const machsInCat = activeMachines.filter(m => {
        if (cat.id === 'unassigned') {
          return !m.categoryId || !knownCatIds.has(m.categoryId);
        }
        return m.categoryId === cat.id;
      });

      const machineRows = machsInCat.map(mach => {
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
          category: cat,
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

      const catTotalTarget = machineRows.reduce((sum, m) => sum + m.periodTarget, 0);
      const catTotalAchieved = machineRows.reduce((sum, m) => sum + m.periodAchieved, 0);
      const catTodayAchieved = machineRows.reduce((sum, m) => sum + m.todayAchieved, 0);
      const catAchievementRate = catTotalTarget > 0 
        ? (catTotalAchieved / catTotalTarget) * 100 
        : (catTotalAchieved > 0 ? 100 : 0);

      return {
        category: cat,
        totalTarget: catTotalTarget,
        totalAchieved: catTotalAchieved,
        todayAchieved: catTodayAchieved,
        achievementRate: catAchievementRate,
        machineRows
      };
    }).filter(g => g.machineRows.length > 0);

    const overallRate = grandTotalTarget > 0 
      ? (grandTotalAchieved / grandTotalTarget) * 100 
      : (grandTotalAchieved > 0 ? 100 : 0);

    const totalProduced = grandTotalAccepted + grandTotalRejected;
    const scrapRate = totalProduced > 0 ? (grandTotalRejected / totalProduced) * 100 : 0;

    return {
      categoryGroups: result,
      grandTotalTarget,
      grandTotalAchieved,
      grandTodayAchieved,
      grandTotalAccepted,
      grandTotalRejected,
      overallAchievementRate: overallRate,
      scrapRate,
      totalDays: dateList.length
    };
  }, [categories, machines, confirmedPlans, dailyLogs, holidayMap, dateList, appliedFilters, plantMap, tenantId]);

  // ----------------------------------------------------
  // 5. CATEGORY COMPARISON CHART DATA
  // ----------------------------------------------------
  const categoryBarData = useMemo(() => {
    return categoryMachineAnalytics.categoryGroups.map(g => ({
      category: g.category.name,
      Target: g.totalTarget,
      Achieved: g.totalAchieved,
      Rate: Number(g.achievementRate.toFixed(1))
    }));
  }, [categoryMachineAnalytics]);

  // Aggregate Daily Run Rate vs Target
  const aggregateDailyTrend = useMemo(() => {
    return dateList.map(d => {
      let targetSum = 0;
      let achievedSum = 0;
      categoryMachineAnalytics.categoryGroups.forEach(g => {
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
  }, [dateList, categoryMachineAnalytics]);

  // ----------------------------------------------------
  // 6. EXCEL EXPORT (Category-Machine Outputs & Graphs Data)
  // ----------------------------------------------------
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Machine Summary
    const summaryRows: any[] = [];
    categoryMachineAnalytics.categoryGroups.forEach(g => {
      g.machineRows.forEach(mr => {
        summaryRows.push({
          'Category': g.category.name,
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

    // Sheet 2: Daily Matrix Output
    const dailyMatrixRows: any[] = [];
    categoryMachineAnalytics.categoryGroups.forEach(g => {
      g.machineRows.forEach(mr => {
        mr.chartData.forEach(d => {
          dailyMatrixRows.push({
            'Category': g.category.name,
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

    XLSX.writeFile(wb, `Production_Analytics_${appliedFilters.fromDate}_to_${appliedFilters.toDate}.xlsx`);
  };

  const handleOpenDailyLogsModal = (machine: Machine, categoryName: string, chartData: any[]) => {
    setDailyLogModal({
      open: true,
      machine,
      categoryName,
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
          sx={{ fontWeight: 800, bgcolor: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', fontSize: '0.675rem' }}
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

  // Custom Chart Tooltip
  const CustomLineTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a', display: 'block', mb: 0.5 }}>
            {data.dayName}, {data.dateLabel} {data.isHoliday && '• (Holiday)'}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
            <Typography variant="caption" sx={{ color: '#4f46e5', fontWeight: 700 }}>
              • Daily Target: <strong>{data.dailyTarget?.toLocaleString()}</strong> units
            </Typography>
            <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700 }}>
              • Achieved Today: <strong>{data.dailyAchieved?.toLocaleString()}</strong> units 
              <span style={{ color: data.dailyVariance >= 0 ? '#059669' : '#dc2626', marginLeft: '4px' }}>
                ({data.dailyVariance >= 0 ? '+' : ''}{data.dailyVariance?.toLocaleString()})
              </span>
            </Typography>
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 700 }}>
              • Cumulative Achieved: <strong>{data.cumulativeAchieved?.toLocaleString()}</strong> units
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
              • Cumulative Target: <strong>{data.cumulativeTarget?.toLocaleString()}</strong> units
            </Typography>
          </Box>
        </Paper>
      );
    }
    return null;
  };

  if (loadingLogs) {
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
            Category and machine-wise daily output line graphs against daily target volume, achieved current volume, and cumulative output.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
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

          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Product Category</InputLabel>
              <Select label="Product Category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
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
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#4f46e5' }}>
                    {categoryMachineAnalytics.grandTotalTarget.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>units</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, mt: 0.2, display: 'block' }}>
                    Across {categoryMachineAnalytics.totalDays} days in period
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', width: 40, height: 40 }}>
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
                    {categoryMachineAnalytics.grandTotalAchieved.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>units</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#059669', fontWeight: 700, mt: 0.2, display: 'block' }}>
                    Today's Output: {categoryMachineAnalytics.grandTodayAchieved.toLocaleString()} units
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
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: categoryMachineAnalytics.overallAchievementRate >= 95 ? '#10b981' : '#f59e0b' }}>
                    {categoryMachineAnalytics.overallAchievementRate.toFixed(1)}<span style={{ fontSize: '1rem', fontWeight: 600 }}>%</span>
                  </Typography>
                  <Box sx={{ mt: 0.8, width: 130 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, categoryMachineAnalytics.overallAchievementRate)}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: categoryMachineAnalytics.overallAchievementRate >= 95 ? '#10b981' : '#f59e0b',
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
                    {categoryMachineAnalytics.grandTotalAchieved.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>units</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mt: 0.2, display: 'block' }}>
                    Quality Scrap Rate: {categoryMachineAnalytics.scrapRate.toFixed(2)}%
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
          PRIMARY VIEW: CATEGORY MACHINE-WISE DAILY OUTPUT LINE GRAPHS (IN ROWS)
      ---------------------------------------------------- */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <PrecisionManufacturingIcon sx={{ color: '#10b981' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Category & Machine-Wise Output Performance (Date Range: {appliedFilters.fromDate} to {appliedFilters.toDate})
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Each row displays daily target volume, achieved volume of the day, and cumulative volume trajectory over time.
              </Typography>
            </Box>
          </Stack>

          {/* Graph Legend Guide */}
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', bgcolor: '#ffffff', px: 2, py: 0.8, borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Box sx={{ width: 14, height: 3, borderTop: '2px dashed #4f46e5' }} />
              <Typography sx={{ fontSize: '0.725rem', fontWeight: 700, color: '#4f46e5' }}>Daily Target</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Box sx={{ width: 14, height: 3, bgcolor: '#10b981' }} />
              <Typography sx={{ fontSize: '0.725rem', fontWeight: 700, color: '#10b981' }}>Achieved Today</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Box sx={{ width: 14, height: 3, bgcolor: '#8b5cf6' }} />
              <Typography sx={{ fontSize: '0.725rem', fontWeight: 700, color: '#8b5cf6' }}>Cumulative Output</Typography>
            </Box>
          </Stack>
        </Box>

        {categoryMachineAnalytics.categoryGroups.length === 0 ? (
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
          categoryMachineAnalytics.categoryGroups.map((group) => {
            const isCollapsed = !!collapsedCategories[group.category.id];

            return (
              <Box key={group.category.id} sx={{ mb: 3.5 }}>
                {/* CATEGORY HEADER BAR */}
                <Card
                  sx={{
                    p: 1.8,
                    px: 2.5,
                    mb: 1.5,
                    borderRadius: '14px',
                    bgcolor: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleCategoryCollapse(group.category.id)}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <IconButton size="small" sx={{ p: 0.2, color: '#6366f1' }}>
                      {isCollapsed ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
                    </IconButton>
                    <CategoryIcon sx={{ color: '#6366f1' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {group.category.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${group.machineRows.length} Line(s)`}
                      sx={{ height: 20, fontSize: '0.675rem', fontWeight: 700, bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5' }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                        Category Target: <strong>{group.totalTarget.toLocaleString()}</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: '#059669', fontWeight: 700, display: 'block' }}>
                        Category Output: <strong>{group.totalAchieved.toLocaleString()}</strong>
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

                {/* MACHINE ROWS WITH LINE GRAPHS */}
                {!isCollapsed && (
                  <Stack spacing={2}>
                    {group.machineRows.map((mr) => (
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
                                  <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                                    {mr.plant?.plantName || 'Plant'} • {mr.machine.operatingHours || 24}h Shift/Day
                                  </Typography>
                                </Box>
                                {getStatusBadge(mr.status)}
                              </Box>

                              {/* Target vs Achieved vs Cumulative Metrics Grid */}
                              <Grid container spacing={1.5} sx={{ mt: 1 }}>
                                <Grid size={{ xs: 6 }}>
                                  <Box sx={{ p: 1.2, bgcolor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.675rem', display: 'block' }}>
                                      Period Target Volume
                                    </Typography>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#4f46e5' }}>
                                      {mr.periodTarget.toLocaleString()} <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>units</span>
                                    </Typography>
                                  </Box>
                                </Grid>

                                <Grid size={{ xs: 6 }}>
                                  <Box sx={{ p: 1.2, bgcolor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.675rem', display: 'block' }}>
                                      Achieved (Period)
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
                                      Cumulative Volume
                                    </Typography>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#8b5cf6' }}>
                                      {mr.cumulativeVolume.toLocaleString()} <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>units</span>
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
                                onClick={() => handleOpenDailyLogsModal(mr.machine, group.category.name, mr.chartData)}
                                sx={{ fontSize: '0.725rem', fontWeight: 700, py: 0.3, borderColor: '#cbd5e1', bgcolor: '#ffffff' }}
                              >
                                View Day-by-Day Log
                              </Button>
                            </Box>
                          </Grid>

                          {/* RIGHT PANEL: INTERACTIVE MULTI-LINE GRAPH ON EACH ROW */}
                          <Grid size={{ xs: 12, md: 8 }} sx={{ p: 2.5, bgcolor: '#ffffff' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                Output Progress Curve • {appliedFilters.fromDate} to {appliedFilters.toDate}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                Left Axis: Daily Volume | Right Axis: Cumulative Volume
                              </Typography>
                            </Box>

                            <Box sx={{ width: '100%', height: 210 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={mr.chartData}
                                  margin={{ top: 10, right: 20, left: -15, bottom: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                  <XAxis
                                    dataKey="dateLabel"
                                    stroke="#94a3b8"
                                    style={{ fontSize: '0.7rem', fontWeight: 600 }}
                                  />
                                  {/* Left Y-Axis: Daily Target & Daily Achieved */}
                                  <YAxis
                                    yAxisId="left"
                                    stroke="#94a3b8"
                                    style={{ fontSize: '0.7rem' }}
                                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                                  />
                                  {/* Right Y-Axis: Cumulative Volume */}
                                  <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#8b5cf6"
                                    style={{ fontSize: '0.7rem' }}
                                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                                  />
                                  <RechartsTooltip content={<CustomLineTooltip />} />
                                  
                                  {/* Line 1: Daily Target Volume */}
                                  <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="dailyTarget"
                                    name="Daily Target"
                                    stroke="#4f46e5"
                                    strokeDasharray="4 4"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                  />

                                  {/* Line 2: Achieved Current Volume of the Day */}
                                  <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="dailyAchieved"
                                    name="Achieved Today"
                                    stroke="#10b981"
                                    strokeWidth={2.5}
                                    dot={{ r: 3, fill: '#10b981' }}
                                    activeDot={{ r: 5 }}
                                  />

                                  {/* Line 3: Cumulative Volume */}
                                  <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="cumulativeAchieved"
                                    name="Cumulative Output"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </Box>
                          </Grid>
                        </Grid>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {/* ----------------------------------------------------
          AGGREGATE OVERVIEWS & CATEGORY PERFORMANCE
      ---------------------------------------------------- */}
      <Grid container spacing={3}>
        {/* Category Target vs Achieved Bar Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: '16px', border: '1px solid #e2e8f0', p: 2.5, bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
              Category Output vs Target Volume
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
              Planned budget targets vs actual output yield by product category.
            </Typography>
            <Box sx={{ width: '100%', height: 260 }}>
              {categoryBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBarData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="category" stroke="#94a3b8" style={{ fontSize: '0.725rem' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '0.725rem' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', fontWeight: 600 }} />
                    <Bar dataKey="Target" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Achieved" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">No category data available</Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Fleet Daily Run Rate Line Chart */}
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
                    <Line type="monotone" dataKey="Target" stroke="#6366f1" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Achieved" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
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
            Category: {dailyLogModal.categoryName} • Period: {appliedFilters.fromDate} to {appliedFilters.toDate}
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          <TableContainer sx={{ maxHeight: 460 }}>
            <Table size="small" stickyHeader>
              <TableHead sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: '0.75rem' } }}>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Day</TableCell>
                  <TableCell align="right">Daily Target</TableCell>
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
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#4f46e5' }}>
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
    </Box>
  );
};
