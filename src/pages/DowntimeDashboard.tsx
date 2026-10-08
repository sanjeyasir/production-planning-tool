import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  getDowntimeRecords,
  getPlants,
  getMachines,
  getDowntimeCategories,
  toLocalDateString,
  parseLocalDate,
  type DowntimeRecord,
  type Machine,
  type Plant,
  type DowntimeCategory
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
  Tooltip as MuiTooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Bar,
  ComposedChart,
  Line,
  Cell
} from 'recharts';

// Icons
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ErrorIcon from '@mui/icons-material/Error';
import PercentIcon from '@mui/icons-material/Percent';
import FilterListIcon from '@mui/icons-material/FilterList';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BuildIcon from '@mui/icons-material/Build';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import DownloadIcon from '@mui/icons-material/Download';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TableViewIcon from '@mui/icons-material/TableView';
import CategoryIcon from '@mui/icons-material/Category';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import * as XLSX from 'xlsx';

export const DowntimeDashboard: React.FC = () => {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';

  // ----------------------------------------------------
  // 1. DATA QUERIES
  // ----------------------------------------------------
  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['downtimeRecords', tenantId],
    queryFn: () => getDowntimeRecords(tenantId),
    enabled: !!tenantId,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ['plants', tenantId],
    queryFn: () => getPlants(tenantId),
    enabled: !!tenantId,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ['machines', tenantId],
    queryFn: () => getMachines(tenantId),
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['downtimeCategories', tenantId],
    queryFn: () => getDowntimeCategories(tenantId),
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
    machineId: 'all',
    shift: 'all'
  });

  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [selectedShift, setSelectedShift] = useState<string>('all');

  // Collapsed state for Category groups
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Modal for Viewing specific machine incidents log
  const [incidentModal, setIncidentModal] = useState<{
    open: boolean;
    categoryName: string;
    machine: Machine | null;
    records: DowntimeRecord[];
  }>({
    open: false,
    categoryName: '',
    machine: null,
    records: []
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
      machineId: selectedMachine,
      shift: selectedShift
    });
  };

  // ----------------------------------------------------
  // 3. DATE LIST COMPUTATION (Columns for Period)
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

  // Lookup maps
  const plantMap = useMemo(() => {
    const map: Record<string, Plant> = {};
    plants.forEach(p => { map[p.id] = p; });
    return map;
  }, [plants]);

  const machineMap = useMemo(() => {
    const map: Record<string, Machine> = {};
    machines.forEach(m => { map[m.id] = m; });
    return map;
  }, [machines]);

  const categoryMap = useMemo(() => {
    const map: Record<string, DowntimeCategory> = {};
    categories.forEach(c => { map[c.id] = c; });
    return map;
  }, [categories]);

  // ----------------------------------------------------
  // 4. FILTERED RECORDS
  // ----------------------------------------------------
  const filteredRecords = useMemo(() => {
    if (!appliedFilters.fromDate || !appliedFilters.toDate) return [];
    const start = parseLocalDate(appliedFilters.fromDate);
    start.setHours(0, 0, 0, 0);
    const end = parseLocalDate(appliedFilters.toDate);
    end.setHours(23, 59, 59, 999);

    return records.filter(r => {
      const rDate = r.startTime instanceof Date ? r.startTime : new Date(r.startTime);
      if (rDate < start || rDate > end) return false;
      if (appliedFilters.plantId !== 'all' && r.plantId !== appliedFilters.plantId) return false;
      if (appliedFilters.categoryId !== 'all' && r.categoryId !== appliedFilters.categoryId) return false;
      if (appliedFilters.machineId !== 'all' && r.machineId !== appliedFilters.machineId) return false;
      if (appliedFilters.shift !== 'all' && r.shift !== appliedFilters.shift) return false;
      return true;
    });
  }, [records, appliedFilters]);

  // ----------------------------------------------------
  // 5. CATEGORY-WISE MACHINE DOWNTIME MATRIX CALCULATION
  // ----------------------------------------------------
  const categoryMachineMatrix = useMemo(() => {
    // 1. Determine relevant categories
    const activeCats = categories.filter(c => {
      if (appliedFilters.categoryId !== 'all' && c.id !== appliedFilters.categoryId) return false;
      return true;
    });

    // Also include an 'Uncategorized' virtual bucket if any records have missing/unknown category
    const knownCatIds = new Set(categories.map(c => c.id));
    const hasUncategorized = filteredRecords.some(r => !r.categoryId || !knownCatIds.has(r.categoryId));

    const categoryList = [...activeCats];
    if (hasUncategorized) {
      categoryList.push({
        id: 'uncategorized',
        tenantId,
        name: 'Uncategorized / General',
        description: 'Records without assigned category',
        status: 'ACTIVE',
        createdAt: new Date()
      });
    }

    // 2. Filter relevant machines
    const activeMachines = machines.filter(m => {
      if (appliedFilters.plantId !== 'all' && m.plantId !== appliedFilters.plantId) return false;
      if (appliedFilters.machineId !== 'all' && m.id !== appliedFilters.machineId) return false;
      return true;
    });

    const diffDays = Math.max(1, dateList.length);
    const scheduledMinutesPerMachine = diffDays * 24 * 60;

    let grandTotalDowntimeMins = 0;
    let grandTotalIncidents = 0;

    // Build the hierarchical structure: Category -> Machines
    const result = categoryList.map(cat => {
      // Find all records belonging to this category
      const catRecords = filteredRecords.filter(r => {
        if (cat.id === 'uncategorized') {
          return !r.categoryId || !knownCatIds.has(r.categoryId);
        }
        return r.categoryId === cat.id;
      });

      // Find machines that have downtime in this category (or show all active machines if only 1 category selected)
      const machineRows = activeMachines
        .map(mach => {
          const machRecords = catRecords.filter(r => r.machineId === mach.id);
          const totalDowntimeMins = machRecords.reduce((sum, r) => sum + (Number(r.duration) || 0), 0);
          const totalIncidents = machRecords.length;

          // Compute daily downtime breakdown across dateList
          const dailyBreakdown: Record<string, { minutes: number; records: DowntimeRecord[] }> = {};
          dateList.forEach(d => {
            dailyBreakdown[d.dateStr] = { minutes: 0, records: [] };
          });

          machRecords.forEach(r => {
            const dStr = r.dateStr || toLocalDateString(r.startTime);
            if (dailyBreakdown[dStr]) {
              dailyBreakdown[dStr].minutes += Number(r.duration) || 0;
              dailyBreakdown[dStr].records.push(r);
            }
          });

          const availabilityRate = Math.max(
            0,
            Math.min(100, ((scheduledMinutesPerMachine - totalDowntimeMins) / scheduledMinutesPerMachine) * 100)
          );
          const avgDuration = totalIncidents > 0 ? Math.round(totalDowntimeMins / totalIncidents) : 0;

          return {
            machine: mach,
            plant: plantMap[mach.plantId],
            totalDowntimeMins,
            totalIncidents,
            avgDuration,
            availabilityRate,
            dailyBreakdown,
            records: machRecords
          };
        })
        .filter(row => row.totalDowntimeMins > 0 || appliedFilters.categoryId !== 'all' || activeMachines.length <= 6);

      const catTotalDowntimeMins = machineRows.reduce((sum, m) => sum + m.totalDowntimeMins, 0);
      const catTotalIncidents = machineRows.reduce((sum, m) => sum + m.totalIncidents, 0);

      grandTotalDowntimeMins += catTotalDowntimeMins;
      grandTotalIncidents += catTotalIncidents;

      // Daily totals for the category
      const catDailyTotals: Record<string, number> = {};
      dateList.forEach(d => {
        catDailyTotals[d.dateStr] = machineRows.reduce((sum, m) => sum + (m.dailyBreakdown[d.dateStr]?.minutes || 0), 0);
      });

      return {
        category: cat,
        totalDowntimeMins: catTotalDowntimeMins,
        totalIncidents: catTotalIncidents,
        dailyTotals: catDailyTotals,
        machineRows
      };
    }).filter(catGroup => catGroup.totalDowntimeMins > 0 || appliedFilters.categoryId !== 'all' || categoryList.length <= 4);

    return {
      categoryGroups: result,
      grandTotalDowntimeMins,
      grandTotalIncidents,
      totalDays: diffDays
    };
  }, [categories, machines, filteredRecords, dateList, appliedFilters, plantMap, tenantId]);

  // ----------------------------------------------------
  // 6. EXECUTIVE KPIS
  // ----------------------------------------------------
  const kpis = useMemo(() => {
    const totalDowntime = categoryMachineMatrix.grandTotalDowntimeMins;
    const totalEvents = categoryMachineMatrix.grandTotalIncidents;

    const diffDays = Math.max(1, dateList.length);
    const totalActiveMachines = (appliedFilters.machineId !== 'all' ? 1 : machines.filter(m => m.status === 'ACTIVE').length) || 1;
    const totalScheduledMinutes = diffDays * totalActiveMachines * 24 * 60;

    const availability = Math.max(0, Math.min(100, ((totalScheduledMinutes - totalDowntime) / totalScheduledMinutes) * 100));

    // Top Downtime Category
    let topCategory = '—';
    let topCategoryMins = 0;
    categoryMachineMatrix.categoryGroups.forEach(g => {
      if (g.totalDowntimeMins > topCategoryMins) {
        topCategoryMins = g.totalDowntimeMins;
        topCategory = g.category.name;
      }
    });

    // Most Affected Machine
    let topMachine = '—';
    let topMachineMins = 0;
    machines.forEach(m => {
      const machDowntime = filteredRecords
        .filter(r => r.machineId === m.id)
        .reduce((sum, r) => sum + (Number(r.duration) || 0), 0);
      if (machDowntime > topMachineMins) {
        topMachineMins = machDowntime;
        topMachine = `${m.machineCode} - ${m.machineName}`;
      }
    });

    return {
      totalDowntimeMinutes: totalDowntime,
      totalDowntimeHours: (totalDowntime / 60).toFixed(1),
      totalEvents,
      availability: availability.toFixed(1),
      topCategory,
      topCategoryMins,
      topMachine,
      topMachineMins
    };
  }, [categoryMachineMatrix, dateList, machines, filteredRecords, appliedFilters]);

  // ----------------------------------------------------
  // 7. CHARTS DATA (Trend & Pareto)
  // ----------------------------------------------------
  const trendData = useMemo(() => {
    return dateList.map(d => {
      const dayMins = filteredRecords
        .filter(r => (r.dateStr || toLocalDateString(r.startTime)) === d.dateStr)
        .reduce((sum, r) => sum + (Number(r.duration) || 0), 0);
      return {
        date: d.label,
        minutes: dayMins,
        hours: Number((dayMins / 60).toFixed(1))
      };
    });
  }, [dateList, filteredRecords]);

  const paretoData = useMemo(() => {
    const sorted = [...categoryMachineMatrix.categoryGroups]
      .filter(g => g.totalDowntimeMins > 0)
      .sort((a, b) => b.totalDowntimeMins - a.totalDowntimeMins);

    const total = categoryMachineMatrix.grandTotalDowntimeMins || 1;
    let cum = 0;
    return sorted.map(g => {
      cum += g.totalDowntimeMins;
      return {
        category: g.category.name,
        minutes: g.totalDowntimeMins,
        hours: Number((g.totalDowntimeMins / 60).toFixed(1)),
        percentage: Math.round((g.totalDowntimeMins / total) * 100),
        cumulative: Math.round((cum / total) * 100)
      };
    });
  }, [categoryMachineMatrix]);

  const CHART_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];

  // ----------------------------------------------------
  // 8. EXCEL EXPORT (Category-Machine Matrix & Log)
  // ----------------------------------------------------
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Matrix
    const matrixRows: any[] = [];
    categoryMachineMatrix.categoryGroups.forEach(g => {
      g.machineRows.forEach(mr => {
        const rowObj: any = {
          'Downtime Category': g.category.name,
          'Machine Code': mr.machine.machineCode,
          'Machine Name': mr.machine.machineName,
          'Plant': mr.plant?.plantName || '—',
          'Total Downtime (Mins)': mr.totalDowntimeMins,
          'Total Downtime (Hours)': (mr.totalDowntimeMins / 60).toFixed(2),
          'Stoppage Events': mr.totalIncidents,
          'Avg Duration (Mins)': mr.avgDuration,
          'Availability Rate %': mr.availabilityRate.toFixed(1) + '%'
        };
        dateList.forEach(d => {
          rowObj[d.dateStr] = mr.dailyBreakdown[d.dateStr]?.minutes || 0;
        });
        matrixRows.push(rowObj);
      });
    });

    const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Category Machine Downtimes');

    // Sheet 2: Detailed Logs
    const detailedLogs = filteredRecords.map(r => {
      const mach = machineMap[r.machineId];
      const plant = plantMap[r.plantId];
      const cat = categoryMap[r.categoryId];
      return {
        'Date': r.dateStr || toLocalDateString(r.startTime),
        'Category': cat?.name || 'Uncategorized',
        'Machine Code': mach?.machineCode || 'N/A',
        'Machine Name': mach?.machineName || 'N/A',
        'Plant': plant?.plantName || 'N/A',
        'Shift': r.shift || '—',
        'Start Time': r.startTime ? new Date(r.startTime).toLocaleTimeString() : '—',
        'End Time': r.endTime ? new Date(r.endTime).toLocaleTimeString() : '—',
        'Duration (Minutes)': r.duration || 0,
        'Stoppage Reason': r.reason || '—',
        'Remarks': r.remarks || '—',
        'Logged By': r.createdBy || '—'
      };
    });

    const wsLogs = XLSX.utils.json_to_sheet(detailedLogs);
    XLSX.utils.book_append_sheet(wb, wsLogs, 'Detailed Incidents Log');

    XLSX.writeFile(wb, `Downtime_Analytics_${appliedFilters.fromDate}_to_${appliedFilters.toDate}.xlsx`);
  };

  const handleOpenIncidentModal = (categoryName: string, machine: Machine, recordsList: DowntimeRecord[]) => {
    setIncidentModal({
      open: true,
      categoryName,
      machine,
      records: [...recordsList].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    });
  };

  // Helper for Heatmap cell styling
  const getDowntimeCellBg = (minutes: number) => {
    if (!minutes || minutes <= 0) return 'transparent';
    if (minutes <= 30) return '#fef3c7'; // soft amber
    if (minutes <= 90) return '#ffedd5'; // light orange
    if (minutes <= 180) return '#fee2e2'; // light red
    return '#fecaca'; // deep red
  };

  const getDowntimeCellColor = (minutes: number) => {
    if (!minutes || minutes <= 0) return '#94a3b8';
    if (minutes <= 30) return '#b45309';
    if (minutes <= 90) return '#c2410c';
    return '#b91c1c';
  };

  if (loadingRecords) {
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
            <DashboardIcon sx={{ color: '#ef4444', fontSize: 28 }} />
            Machine Downtime Analytics
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            Category-wise machine downtime matrix, fleet availability rates, and date-range stoppage trends.
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
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: '#6366f1' }}>
            <FilterListIcon fontSize="small" />
            <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Downtime Filter Console
            </Typography>
          </Stack>

          {/* Preset Chips */}
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
                  bgcolor: '#6366f1',
                  color: '#ffffff',
                  '&:hover': { bgcolor: '#4f46e5' }
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
              <InputLabel>Downtime Category</InputLabel>
              <Select label="Downtime Category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
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

          <Grid size={{ xs: 6, sm: 4, md: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Shift</InputLabel>
              <Select label="Shift" value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="Shift A">A</MenuItem>
                <MenuItem value="Shift B">B</MenuItem>
                <MenuItem value="Shift C">C</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 6, sm: 4, md: 1 }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<PlayArrowIcon />}
              onClick={handleApplyFilter}
              sx={{
                height: 40,
                fontWeight: 700,
                bgcolor: '#6366f1',
                '&:hover': { bgcolor: '#4f46e5' }
              }}
            >
              View
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
                    Total Period Downtime
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#ef4444' }}>
                    {kpis.totalDowntimeMinutes.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>mins</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, mt: 0.2, display: 'block' }}>
                    ≈ {kpis.totalDowntimeHours} hours across {categoryMachineMatrix.totalDays} days
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: 40, height: 40 }}>
                  <AccessTimeIcon sx={{ fontSize: 22 }} />
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
                    Stoppage Incidents
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>
                    {kpis.totalEvents.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>events</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, mt: 0.2, display: 'block' }}>
                    Avg {(kpis.totalEvents / Math.max(1, categoryMachineMatrix.totalDays)).toFixed(1)} stops / day
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', width: 40, height: 40 }}>
                  <ErrorIcon sx={{ fontSize: 22 }} />
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
                    Fleet Availability
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: Number(kpis.availability) >= 90 ? '#10b981' : '#f59e0b' }}>
                    {kpis.availability}<span style={{ fontSize: '1rem', fontWeight: 600 }}>%</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, mt: 0.2, display: 'block' }}>
                    {Number(kpis.availability) >= 90 ? 'Healthy performance' : 'Requires line attention'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: 40, height: 40 }}>
                  <PercentIcon sx={{ fontSize: 22 }} />
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
                    Highest Stoppage Impact
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 0.5, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>
                    {kpis.topCategory}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 700, mt: 0.2, display: 'block' }}>
                    {kpis.topCategoryMins} mins ({kpis.totalDowntimeMinutes > 0 ? Math.round((kpis.topCategoryMins / kpis.totalDowntimeMinutes) * 100) : 0}% of total)
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', width: 40, height: 40 }}>
                  <CategoryIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ----------------------------------------------------
          PRIMARY VIEW: CATEGORY-WISE MACHINE DOWNTIME MATRIX (ROWS ON DATE RANGE)
      ---------------------------------------------------- */}
      <Card
        sx={{
          mb: 4,
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 2.5, bgcolor: '#fafafa', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <TableViewIcon sx={{ color: '#6366f1' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Category-Wise Machine Downtimes (Period: {appliedFilters.fromDate} to {appliedFilters.toDate})
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                All machine downtime minutes broken down across the date range by stoppage category.
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip
              size="small"
              label={`${categoryMachineMatrix.categoryGroups.length} Categories`}
              sx={{ fontWeight: 700, bgcolor: 'rgba(99, 102, 241, 0.08)', color: '#6366f1' }}
            />
            <Chip
              size="small"
              label={`${dateList.length} Days in Period`}
              sx={{ fontWeight: 700, bgcolor: 'rgba(16, 185, 129, 0.08)', color: '#059669' }}
            />
          </Stack>
        </Box>

        <TableContainer sx={{ maxHeight: 680, overflowX: 'auto' }}>
          <Table size="small" stickyHeader sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, color: '#334155', fontSize: '0.75rem', py: 1.2, borderBottom: '2px solid #e2e8f0' } }}>
                <TableCell sx={{ minWidth: 220, position: 'sticky', left: 0, bgcolor: '#f8fafc', zIndex: 3 }}>
                  Category / Machine
                </TableCell>
                <TableCell sx={{ minWidth: 110 }}>Plant</TableCell>

                {/* Daily Columns */}
                {dateList.map(d => (
                  <TableCell
                    key={d.dateStr}
                    align="center"
                    sx={{
                      minWidth: 54,
                      px: 0.5,
                      bgcolor: d.isToday ? 'rgba(99, 102, 241, 0.06)' : '#f8fafc'
                    }}
                  >
                    <Typography sx={{ fontSize: '0.675rem', fontWeight: 800, color: d.isToday ? '#6366f1' : '#64748b' }}>
                      {d.dayName}
                    </Typography>
                    <Typography sx={{ fontSize: '0.725rem', fontWeight: 800, color: d.isToday ? '#4338ca' : '#0f172a' }}>
                      {d.label}
                    </Typography>
                  </TableCell>
                ))}

                <TableCell align="right" sx={{ minWidth: 110, bgcolor: '#f1f5f9', fontWeight: 800 }}>Total Downtime</TableCell>
                <TableCell align="center" sx={{ minWidth: 80 }}>Events</TableCell>
                <TableCell align="right" sx={{ minWidth: 90 }}>Availability</TableCell>
                <TableCell align="center" sx={{ minWidth: 90 }}>Details</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {categoryMachineMatrix.categoryGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={dateList.length + 6} align="center" sx={{ py: 6, color: '#64748b' }}>
                    <CheckCircleIcon sx={{ fontSize: 40, color: '#10b981', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                      No Downtime Records Found
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      There are zero machine stoppages logged for the selected filter parameters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                categoryMachineMatrix.categoryGroups.map((group) => {
                  const isCollapsed = !!collapsedCategories[group.category.id];
                  const catPercent = categoryMachineMatrix.grandTotalDowntimeMins > 0
                    ? Math.round((group.totalDowntimeMins / categoryMachineMatrix.grandTotalDowntimeMins) * 100)
                    : 0;

                  return (
                    <React.Fragment key={group.category.id}>
                      {/* CATEGORY SECTION HEADER ROW */}
                      <TableRow
                        sx={{
                          bgcolor: 'rgba(99, 102, 241, 0.04)',
                          borderTop: '2px solid #e2e8f0',
                          '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.08)' }
                        }}
                      >
                        <TableCell
                          sx={{
                            fontWeight: 800,
                            color: '#1e293b',
                            fontSize: '0.825rem',
                            position: 'sticky',
                            left: 0,
                            bgcolor: '#f1f5f9',
                            zIndex: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => toggleCategoryCollapse(group.category.id)}
                            sx={{ p: 0.2, color: '#6366f1' }}
                          >
                            {isCollapsed ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowUpIcon fontSize="small" />}
                          </IconButton>
                          <BuildIcon sx={{ fontSize: 16, color: '#6366f1' }} />
                          <span>{group.category.name}</span>
                          <Chip
                            size="small"
                            label={`${catPercent}% of total`}
                            sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700, bgcolor: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5' }}
                          />
                        </TableCell>

                        <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                          {group.machineRows.length} machine(s)
                        </TableCell>

                        {/* Category Daily Subtotals */}
                        {dateList.map(d => {
                          const mins = group.dailyTotals[d.dateStr] || 0;
                          return (
                            <TableCell
                              key={d.dateStr}
                              align="center"
                              sx={{
                                fontWeight: 800,
                                fontSize: '0.725rem',
                                color: mins > 0 ? '#ef4444' : '#94a3b8',
                                bgcolor: mins > 0 ? 'rgba(239, 68, 68, 0.04)' : 'transparent'
                              }}
                            >
                              {mins > 0 ? `${mins}m` : '—'}
                            </TableCell>
                          );
                        })}

                        <TableCell align="right" sx={{ fontWeight: 800, color: '#ef4444', fontSize: '0.8rem', bgcolor: '#f1f5f9' }}>
                          {group.totalDowntimeMins.toLocaleString()} mins
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.8rem' }}>
                          {group.totalIncidents}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem' }}>
                          —
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label="Category"
                            sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700, bgcolor: '#e2e8f0' }}
                          />
                        </TableCell>
                      </TableRow>

                      {/* MACHINE ROWS UNDER THIS CATEGORY */}
                      {!isCollapsed && group.machineRows.map((mr) => (
                        <TableRow
                          key={`${group.category.id}_${mr.machine.id}`}
                          hover
                          sx={{
                            '&:hover': { bgcolor: '#f8fafc' },
                            '& td': { py: 0.9, fontSize: '0.775rem' }
                          }}
                        >
                          <TableCell
                            sx={{
                              pl: 4.5,
                              position: 'sticky',
                              left: 0,
                              bgcolor: '#ffffff',
                              zIndex: 1,
                              borderRight: '1px solid #f1f5f9'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PrecisionManufacturingIcon sx={{ fontSize: 16, color: '#64748b' }} />
                              <Box>
                                <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.8rem' }}>
                                  {mr.machine.machineCode}
                                </Typography>
                                <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  {mr.machine.machineName}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>

                          <TableCell sx={{ color: '#475569', fontWeight: 600 }}>
                            {mr.plant?.plantName || '—'}
                          </TableCell>

                          {/* Machine Daily Cells */}
                          {dateList.map(d => {
                            const dayData = mr.dailyBreakdown[d.dateStr];
                            const mins = dayData?.minutes || 0;
                            const stopsCount = dayData?.records?.length || 0;

                            if (mins <= 0) {
                              return (
                                <TableCell key={d.dateStr} align="center" sx={{ color: '#cbd5e1', fontSize: '0.7rem' }}>
                                  —
                                </TableCell>
                              );
                            }

                            // Tooltip content for multiple or single stops
                            const tooltipTitle = (
                              <Box sx={{ p: 0.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.5 }}>
                                  {mr.machine.machineCode} • {d.label} ({mins} mins total)
                                </Typography>
                                {dayData?.records.map((r, i) => (
                                  <Box key={r.id || i} sx={{ mb: 0.5, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.2)' : 'none', pt: i > 0 ? 0.5 : 0 }}>
                                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                                      • {r.duration}m ({r.shift || 'Shift'}) - Reason: {r.reason}
                                    </Typography>
                                    {r.remarks && (
                                      <Typography variant="caption" sx={{ color: '#e2e8f0', fontStyle: 'italic', display: 'block' }}>
                                        "{r.remarks}"
                                      </Typography>
                                    )}
                                  </Box>
                                ))}
                              </Box>
                            );

                            return (
                              <TableCell
                                key={d.dateStr}
                                align="center"
                                sx={{
                                  p: 0.3,
                                  bgcolor: getDowntimeCellBg(mins)
                                }}
                              >
                                <MuiTooltip title={tooltipTitle} arrow placement="top">
                                  <Box
                                    sx={{
                                      display: 'inline-block',
                                      px: 0.6,
                                      py: 0.2,
                                      borderRadius: '4px',
                                      fontWeight: 800,
                                      fontSize: '0.725rem',
                                      color: getDowntimeCellColor(mins),
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {mins}m
                                    {stopsCount > 1 && (
                                      <span style={{ fontSize: '0.6rem', marginLeft: '2px', opacity: 0.75 }}>
                                        ({stopsCount})
                                      </span>
                                    )}
                                  </Box>
                                </MuiTooltip>
                              </TableCell>
                            );
                          })}

                          <TableCell align="right" sx={{ fontWeight: 800, color: mr.totalDowntimeMins > 0 ? '#ef4444' : '#10b981', bgcolor: '#f8fafc' }}>
                            {mr.totalDowntimeMins.toLocaleString()} mins
                          </TableCell>

                          <TableCell align="center" sx={{ fontWeight: 700, color: mr.totalIncidents > 0 ? '#f59e0b' : '#64748b' }}>
                            {mr.totalIncidents}
                          </TableCell>

                          <TableCell align="right" sx={{ fontWeight: 800, color: mr.availabilityRate >= 90 ? '#10b981' : '#f59e0b' }}>
                            {mr.availabilityRate.toFixed(1)}%
                          </TableCell>

                          <TableCell align="center">
                            {mr.records.length > 0 ? (
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => handleOpenIncidentModal(group.category.name, mr.machine, mr.records)}
                                sx={{ fontSize: '0.675rem', fontWeight: 700, py: 0.2, minWidth: 'auto', color: '#6366f1' }}
                              >
                                View ({mr.records.length})
                              </Button>
                            ) : (
                              <Typography variant="caption" sx={{ color: '#cbd5e1' }}>—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ----------------------------------------------------
          VISUAL CHARTS (Trend & Pareto Distribution)
      ---------------------------------------------------- */}
      <Grid container spacing={3}>
        {/* Trend Area Chart */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%', borderRadius: '16px', border: '1px solid #e2e8f0', p: 2.5, bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
              Daily Fleet Downtime Trend (Period: {appliedFilters.fromDate} to {appliedFilters.toDate})
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
              Total downtime minutes recorded across all active plant machines per day.
            </Typography>
            <Box sx={{ width: '100%', height: 280 }}>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDtMinutes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '0.725rem' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '0.725rem' }} unit="m" />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }}
                    />
                    <Area type="monotone" dataKey="minutes" name="Downtime (mins)" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDtMinutes)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">No trend records found</Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Pareto Analysis Chart */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%', borderRadius: '16px', border: '1px solid #e2e8f0', p: 2.5, bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
              Category Pareto Distribution
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
              Downtime duration and cumulative impact % by stoppage category.
            </Typography>
            <Box sx={{ width: '100%', height: 280 }}>
              {paretoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="category" stroke="#94a3b8" style={{ fontSize: '0.7rem' }} />
                    <YAxis yAxisId="left" stroke="#94a3b8" style={{ fontSize: '0.7rem' }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#94a3b8" style={{ fontSize: '0.7rem' }} unit="%" />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                    <Bar yAxisId="left" dataKey="minutes" name="Minutes" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      {paretoData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative %" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">No category data available</Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* ----------------------------------------------------
          MODAL: DETAILED INCIDENTS DIALOG
      ---------------------------------------------------- */}
      <Dialog
        open={incidentModal.open}
        onClose={() => setIncidentModal(prev => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Downtime Stoppage Logs • {incidentModal.machine?.machineCode} ({incidentModal.machine?.machineName})
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Category: {incidentModal.categoryName} • Total Incidents: {incidentModal.records.length}
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem' }}>Date & Shift</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem' }}>Time Range</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem' }} align="right">Duration</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem' }}>Reason & Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem' }}>Logged By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incidentModal.records.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {r.dateStr || toLocalDateString(r.startTime)}
                      <Chip size="small" label={r.shift || 'Shift A'} sx={{ ml: 1, height: 18, fontSize: '0.625rem', fontWeight: 700 }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: '#475569' }}>
                      {r.startTime ? new Date(r.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      {' - '}
                      {r.endTime ? new Date(r.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: '#ef4444' }}>
                      {r.duration} mins
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.775rem', color: '#0f172a' }}>
                        {r.reason}
                      </Typography>
                      {r.remarks && (
                        <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>
                          "{r.remarks}"
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {r.createdBy || 'Operator'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="contained"
            onClick={() => setIncidentModal(prev => ({ ...prev, open: false }))}
            sx={{ fontWeight: 700, bgcolor: '#6366f1' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
