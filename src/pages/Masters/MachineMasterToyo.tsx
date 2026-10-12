import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getMachines,
  getMachineDailyCapacities,
  setMachineDailyCapacity,
  batchSetMachineDailyCapacities,
  createMachine,
  updateMachine,
  deleteMachine,
  toLocalDateString,
  type Machine,
  type MachineDailyCapacity
} from '../../services/db';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
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
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  Tabs,
  Tab
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import EditIcon from '@mui/icons-material/Edit';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TableViewIcon from '@mui/icons-material/TableView';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import * as XLSX from 'xlsx';

// Date utility to parse local YYYY-MM-DD safely
const parseDateStr = (str: string): Date => {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const MachineMasterToyo: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canAccessCompany } = useAuthStore();
  const toyoTenantId = 'toyo';

  const canViewRileys = canAccessCompany('rileys');

  // Mode: 0 = Daily Machine Master (Day-to-Day Capacity), 1 = Multi-Day Timeline Matrix
  const [activeTab, setActiveTab] = useState<number>(0);

  // Single-day Target Date (Primary Daily Entry View)
  const [singleDate, setSingleDate] = useState<string>(() => toLocalDateString(new Date()));

  // Multi-day Date Range Navigation (Matrix View)
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [daysCount, setDaysCount] = useState<number>(10); // 7, 10, or 14 days

  const [search, setSearch] = useState('');

  // Notifications
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Queries for Toyo Machines
  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['machines', toyoTenantId],
    queryFn: () => getMachines(toyoTenantId),
  });

  // Query Daily Dynamic Capacities
  const { data: dailyCapacities = [], isLoading: loadingCapacities } = useQuery({
    queryKey: ['toyoDailyCapacities', toyoTenantId],
    queryFn: () => getMachineDailyCapacities(toyoTenantId),
  });

  // Capacity lookup map: `${machineId}_${dateStr}` => MachineDailyCapacity
  const capacityMap = useMemo(() => {
    const map = new Map<string, MachineDailyCapacity>();
    dailyCapacities.forEach(dc => {
      map.set(`${dc.machineId}_${dc.dateStr}`, dc);
    });
    return map;
  }, [dailyCapacities]);

  // Filtered Machines by Code or Name
  const filteredMachines = useMemo(() => {
    const match = search.trim().toLowerCase();
    if (!match) return machines;
    return machines.filter(m => {
      const code = (m.machineCode || '').toLowerCase();
      const name = (m.machineName || '').toLowerCase();
      return code.includes(match) || name.includes(match);
    });
  }, [machines, search]);

  // State for Daily Capacity Entry Sheet (local edits before batch save for singleDate)
  const [dailySheetRows, setDailySheetRows] = useState<Record<string, {
    dailyCapacity: number;
    operatingHours: number; // 12 or 24
    reason: string;
    isModified?: boolean;
  }>>({});

  // Sync dailySheetRows whenever machines, singleDate, or capacityMap updates
  useEffect(() => {
    const initial: Record<string, { dailyCapacity: number; operatingHours: number; reason: string; isModified?: boolean }> = {};
    machines.forEach(m => {
      const existing = capacityMap.get(`${m.id}_${singleDate}`);
      initial[m.id] = {
        dailyCapacity: existing !== undefined ? existing.dailyCapacity : m.dailyCapacity,
        operatingHours: existing !== undefined ? (existing.operatingHours === 12 ? 12 : 24) : (m.operatingHours === 12 ? 12 : 24),
        reason: existing?.reason || '',
        isModified: false
      };
    });
    setDailySheetRows(initial);
  }, [machines, singleDate, capacityMap]);

  // Count modified rows for current singleDate
  const modifiedCount = useMemo(() => {
    return Object.values(dailySheetRows).filter(r => r.isModified).length;
  }, [dailySheetRows]);

  // Dialog State: Edit Daily Capacity for a Specific Day & Machine
  const [dayCapacityDialogOpen, setDayCapacityDialogOpen] = useState(false);
  const [selectedDayCapacity, setSelectedDayCapacity] = useState<{
    machine: Machine;
    dateStr: string;
    dayLabel: string;
    currentCapacity: number;
    operatingHours: number; // strictly 12 or 24
    reason: string;
    notes: string;
  } | null>(null);

  // Dialog State: Add / Edit Toyo Machine Definition
  const [machineDialogOpen, setMachineDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [machineFormData, setMachineFormData] = useState({
    machineCode: '',
    machineName: '',
    dateStr: toLocalDateString(new Date()),
    dailyCapacity: 3500,
    operatingHours: 24, // strictly 12 or 24
    status: 'ACTIVE'
  });

  // Calculate start & end date strings for Matrix View
  const dateList = useMemo(() => {
    const list: { date: Date; dateStr: string; dayLabel: string; isWeekend: boolean }[] = [];
    for (let i = 0; i < daysCount; i++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i);
      const dateStr = toLocalDateString(cur);
      const dayOfWeek = cur.getDay();
      const dayLabel = cur.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      list.push({
        date: cur,
        dateStr,
        dayLabel,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      });
    }
    return list;
  }, [startDate, daysCount]);

  // Save Single Day Capacity Mutation
  const saveDayCapacityMutation = useMutation({
    mutationFn: async (payload: {
      machineId: string;
      machineCode: string;
      dateStr: string;
      operatingHours: number;
      dailyCapacity: number;
      reason: string;
      notes: string;
      baseDailyCapacity: number;
    }) => {
      const variance = payload.dailyCapacity - payload.baseDailyCapacity;
      const plannedEfficiency = payload.baseDailyCapacity > 0 
        ? Math.round((payload.dailyCapacity / payload.baseDailyCapacity) * 100) 
        : 100;

      await setMachineDailyCapacity({
        tenantId: toyoTenantId,
        machineId: payload.machineId,
        machineCode: payload.machineCode,
        dateStr: payload.dateStr,
        operatingHours: payload.operatingHours === 12 ? 12 : 24,
        dailyCapacity: payload.dailyCapacity,
        baseDailyCapacity: payload.baseDailyCapacity,
        variance,
        plannedEfficiency,
        reason: payload.reason,
        notes: payload.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toyoDailyCapacities', toyoTenantId] });
      setDayCapacityDialogOpen(false);
      setNotification({
        open: true,
        message: 'Day-to-day capacity saved successfully for this date!',
        severity: 'success'
      });
    },
    onError: (err: any) => {
      setNotification({
        open: true,
        message: `Failed to save daily capacity: ${err.message}`,
        severity: 'error'
      });
    }
  });

  // Batch Save Single-Day Sheet Mutation
  const saveBatchDailySheetMutation = useMutation({
    mutationFn: async () => {
      const recordsToSave: any[] = [];
      machines.forEach(m => {
        const row = dailySheetRows[m.id];
        if (!row) return;
        const variance = row.dailyCapacity - m.dailyCapacity;
        const plannedEfficiency = m.dailyCapacity > 0 
          ? Math.round((row.dailyCapacity / m.dailyCapacity) * 100) 
          : 100;

        recordsToSave.push({
          tenantId: toyoTenantId,
          machineId: m.id,
          machineCode: m.machineCode,
          dateStr: singleDate,
          operatingHours: row.operatingHours === 12 ? 12 : 24,
          dailyCapacity: row.dailyCapacity,
          baseDailyCapacity: m.dailyCapacity,
          variance,
          plannedEfficiency,
          reason: row.reason || (variance !== 0 ? 'Custom Schedule' : 'Standard Baseline')
        });
      });

      await batchSetMachineDailyCapacities(recordsToSave);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toyoDailyCapacities', toyoTenantId] });
      setNotification({
        open: true,
        message: `Daily machine capacities for ${singleDate} saved successfully!`,
        severity: 'success'
      });
    },
    onError: (err: any) => {
      setNotification({
        open: true,
        message: `Failed to save daily capacities: ${err.message}`,
        severity: 'error'
      });
    }
  });

  // Save / Update Machine Mutation (With automatic forward dynamic capacity schedule initialization!)
  const saveMachineMutation = useMutation({
    mutationFn: async (payload: typeof machineFormData) => {
      const opHours = Number(payload.operatingHours) === 12 ? 12 : 24;
      if (editingMachine) {
        await updateMachine(editingMachine.id, {
          machineCode: payload.machineCode.trim().toUpperCase(),
          machineName: payload.machineName.trim(),
          dailyCapacity: Number(payload.dailyCapacity),
          operatingHours: opHours,
          status: payload.status
        });
      } else {
        const newMachineId = await createMachine({
          tenantId: toyoTenantId,
          plantId: 'toyo-main',
          categoryId: 'general',
          machineCode: payload.machineCode.trim().toUpperCase(),
          machineName: payload.machineName.trim(),
          dailyCapacity: Number(payload.dailyCapacity),
          operatingHours: opHours,
          status: payload.status
        });

        // Initialize upcoming 14 days of dynamic capacities starting from selected date
        const baseDate = parseDateStr(payload.dateStr || singleDate);
        baseDate.setHours(0, 0, 0, 0);

        const initBatch: any[] = [];
        for (let i = 0; i < 14; i++) {
          const d = new Date(baseDate);
          d.setDate(baseDate.getDate() + i);
          initBatch.push({
            tenantId: toyoTenantId,
            machineId: newMachineId,
            machineCode: payload.machineCode.trim().toUpperCase(),
            dateStr: toLocalDateString(d),
            operatingHours: opHours,
            dailyCapacity: Number(payload.dailyCapacity),
            baseDailyCapacity: Number(payload.dailyCapacity),
            variance: 0,
            plannedEfficiency: 100,
            reason: 'Standard Baseline'
          });
        }
        await batchSetMachineDailyCapacities(initBatch);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', toyoTenantId] });
      queryClient.invalidateQueries({ queryKey: ['toyoDailyCapacities', toyoTenantId] });
      setMachineDialogOpen(false);
      setNotification({
        open: true,
        message: editingMachine ? 'Toyo machine updated successfully!' : 'Toyo machine created & day-to-day capacity initialized!',
        severity: 'success'
      });
    },
    onError: (err: any) => {
      setNotification({
        open: true,
        message: `Failed to save machine: ${err.message}`,
        severity: 'error'
      });
    }
  });

  // Delete Machine Mutation
  const deleteMachineMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteMachine(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', toyoTenantId] });
      queryClient.invalidateQueries({ queryKey: ['toyoDailyCapacities', toyoTenantId] });
      setNotification({ open: true, message: 'Machine deleted from Toyo Master', severity: 'info' });
    },
    onError: (err: any) => {
      setNotification({ open: true, message: `Failed to delete machine: ${err.message}`, severity: 'error' });
    }
  });

  // Handle cell click on date in Matrix view
  const handleCellClick = (m: Machine, d: { dateStr: string; dayLabel: string }) => {
    const existing = capacityMap.get(`${m.id}_${d.dateStr}`);
    const currentCapacity = existing !== undefined ? existing.dailyCapacity : m.dailyCapacity;
    const opHours = existing !== undefined ? (existing.operatingHours === 12 ? 12 : 24) : (m.operatingHours === 12 ? 12 : 24);
    const reason = existing?.reason || '';
    const notes = existing?.notes || '';

    setSelectedDayCapacity({
      machine: m,
      dateStr: d.dateStr,
      dayLabel: d.dayLabel,
      currentCapacity,
      operatingHours: opHours,
      reason,
      notes
    });
    setDayCapacityDialogOpen(true);
  };

  // Open Machine Dialog (Add or Edit)
  const handleOpenMachineDialog = (machine?: Machine) => {
    if (machine) {
      setEditingMachine(machine);
      setMachineFormData({
        machineCode: machine.machineCode,
        machineName: machine.machineName,
        dateStr: singleDate,
        dailyCapacity: machine.dailyCapacity,
        operatingHours: machine.operatingHours === 12 ? 12 : 24,
        status: machine.status || 'ACTIVE'
      });
    } else {
      setEditingMachine(null);
      setMachineFormData({
        machineCode: '',
        machineName: '',
        dateStr: singleDate,
        dailyCapacity: 3500,
        operatingHours: 24,
        status: 'ACTIVE'
      });
    }
    setMachineDialogOpen(true);
  };

  // Date Shift Helper for Matrix View
  const handleShiftDate = (days: number) => {
    const next = new Date(startDate);
    next.setDate(startDate.getDate() + days);
    setStartDate(next);
  };

  const handleResetToToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setStartDate(d);
  };

  // Date Shift Helper for Single Day View
  const handleShiftSingleDate = (days: number) => {
    const d = parseDateStr(singleDate);
    d.setDate(d.getDate() + days);
    setSingleDate(toLocalDateString(d));
  };

  // Export Daily sheet to Excel
  const handleExportDailyExcel = () => {
    if (filteredMachines.length === 0) return;

    const exportRows = filteredMachines.map(m => {
      const row = dailySheetRows[m.id] || {
        dailyCapacity: m.dailyCapacity,
        operatingHours: m.operatingHours === 12 ? 12 : 24,
        reason: ''
      };
      const variance = row.dailyCapacity - m.dailyCapacity;

      return {
        'Machine Code': m.machineCode,
        'Machine Name': m.machineName,
        'Scheduled Date': singleDate,
        'Operating Hours': `${row.operatingHours === 12 ? 12 : 24} Hours/Day`,
        'Scheduled Capacity (Units/Day)': row.dailyCapacity,
        'Base Capacity (Units/Day)': m.dailyCapacity,
        'Capacity Variance': variance > 0 ? `+${variance}` : variance,
        'Variance Reason / Note': row.reason || (variance !== 0 ? 'Adjusted' : 'Standard Baseline')
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Toyo_Capacities_${singleDate}`);
    XLSX.writeFile(workbook, `Toyo_Machine_Master_${singleDate}.xlsx`);
  };

  // Export matrix to Excel
  const handleExportExcel = () => {
    if (filteredMachines.length === 0) return;

    const exportRows = filteredMachines.map(m => {
      const rowObj: Record<string, any> = {
        'Machine Code': m.machineCode,
        'Machine Name': m.machineName,
        'Base Schedule': `${m.operatingHours === 12 ? 12 : 24}h/day`,
        'Base Capacity (Units/Day)': m.dailyCapacity
      };

      dateList.forEach(d => {
        const dc = capacityMap.get(`${m.id}_${d.dateStr}`);
        const cap = dc !== undefined ? dc.dailyCapacity : m.dailyCapacity;
        const op = dc !== undefined ? dc.operatingHours : m.operatingHours;
        rowObj[`${d.dateStr} (${op}h)`] = cap;
      });

      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Toyo_Matrix');
    XLSX.writeFile(workbook, `Toyo_Machine_Matrix_${toLocalDateString(new Date())}.xlsx`);
  };

  // Formatted display date for singleDate
  const singleDateDisplay = useMemo(() => {
    const d = parseDateStr(singleDate);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, [singleDate]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1600, margin: '0 auto' }}>
      {/* Top Header Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: '16px',
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                bgcolor: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
              }}
            >
              <PrecisionManufacturingIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', fontFamily: '"Outfit", sans-serif' }}>
                Toyo Machine Master
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                Equipment registered in Toyo Master with day-to-day dynamic capacity (12 Hours / 24 Hours schedule config).
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            label="Toyo Manufacturing"
            size="medium"
            sx={{
              bgcolor: 'rgba(2, 132, 199, 0.1)',
              color: '#0284c7',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              fontWeight: 800,
              fontSize: '0.8rem'
            }}
          />

          {canViewRileys && (
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon fontSize="small" />}
              onClick={() => navigate('/machines')}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 700,
                color: '#dc2626',
                borderColor: '#fca5a5',
                bgcolor: '#fff1f2',
                '&:hover': {
                  borderColor: '#dc2626',
                  bgcolor: '#ffe4e6'
                }
              }}
            >
              Riley's Machine Master
            </Button>
          )}

          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={activeTab === 0 ? handleExportDailyExcel : handleExportExcel}
            sx={{
              borderRadius: '10px',
              fontWeight: 700,
              textTransform: 'none',
              color: '#334155',
              borderColor: '#cbd5e1'
            }}
          >
            {activeTab === 0 ? 'Export Daily Sheet' : 'Export Matrix'}
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenMachineDialog()}
            sx={{
              bgcolor: '#0284c7',
              '&:hover': { bgcolor: '#0369a1' },
              fontWeight: 700,
              borderRadius: '10px',
              textTransform: 'none',
              px: 2.5
            }}
          >
            Add Toyo Machine
          </Button>
        </Stack>
      </Paper>

      {/* Tabs: Daily Capacity Master (Default) vs Multi-Day Timeline Matrix */}
      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        sx={{
          mb: 2.5,
          borderBottom: '1px solid #e2e8f0',
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 800,
            fontSize: '0.9rem',
            minHeight: 46,
            '&.Mui-selected': { color: '#0284c7' }
          },
          '& .MuiTabs-indicator': { bgcolor: '#0284c7', height: 3 }
        }}
      >
        <Tab
          icon={<CalendarMonthIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Toyo Machine Master (Daily Capacity View)"
          value={0}
        />
        <Tab
          icon={<TableViewIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Multi-Day Horizon Matrix (Timeline View)"
          value={1}
        />
      </Tabs>

      {/* ========================================================================= */}
      {/* TAB 0: DAILY MACHINE MASTER (DAY-TO-DAY CAPACITY VIEW) - DEFAULT           */}
      {/* ========================================================================= */}
      {activeTab === 0 && (
        <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Top Date Selection & Batch Save Toolbar */}
            <Box
              sx={{
                p: 2,
                mb: 3,
                borderRadius: '12px',
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'stretch', md: 'center' },
                justifyContent: 'space-between',
                gap: 2
              }}
            >
              {/* Date Navigation */}
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#334155', mr: 0.5 }}>
                  📅 Scheduled Date:
                </Typography>
                <IconButton onClick={() => handleShiftSingleDate(-1)} size="small" sx={{ border: '1px solid #cbd5e1', bgcolor: '#ffffff' }}>
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <TextField
                  type="date"
                  size="small"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ bgcolor: '#ffffff', width: 170 }}
                />
                <IconButton onClick={() => handleShiftSingleDate(1)} size="small" sx={{ border: '1px solid #cbd5e1', bgcolor: '#ffffff' }}>
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSingleDate(toLocalDateString(new Date()))}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', bgcolor: '#ffffff' }}
                >
                  Today
                </Button>

                <Chip
                  label={singleDateDisplay}
                  size="small"
                  sx={{
                    ml: { xs: 0, sm: 1 },
                    bgcolor: '#e0f2fe',
                    color: '#0369a1',
                    fontWeight: 700,
                    fontSize: '0.78rem'
                  }}
                />
              </Box>

              {/* Controls: Search & Save All */}
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: { xs: 'space-between', md: 'flex-end' } }}>
                <TextField
                  size="small"
                  placeholder="Filter machines..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      )
                    }
                  }}
                  sx={{ bgcolor: '#ffffff', width: { xs: 150, sm: 200 } }}
                />

                <Button
                  variant="contained"
                  startIcon={saveBatchDailySheetMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  disabled={saveBatchDailySheetMutation.isPending}
                  onClick={() => saveBatchDailySheetMutation.mutate()}
                  sx={{
                    bgcolor: '#0284c7',
                    '&:hover': { bgcolor: '#0369a1' },
                    fontWeight: 800,
                    borderRadius: '10px',
                    textTransform: 'none',
                    px: 2.5,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {saveBatchDailySheetMutation.isPending ? 'Saving...' : `Save Capacities for ${singleDate}`}
                </Button>
              </Stack>
            </Box>

            {/* Explanatory Banner */}
            <Box
              sx={{
                mb: 2.5,
                p: 1.5,
                borderRadius: '10px',
                bgcolor: '#f0f9ff',
                border: '1px solid #bae6fd',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5
              }}
            >
              <CheckCircleIcon sx={{ color: '#0284c7', fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: '#0369a1', fontWeight: 600, fontSize: '0.85rem' }}>
                Toyo machines have variable capacity on a day-to-day basis. Edit capacity or operating hours below for{' '}
                <strong>{singleDate}</strong> and click "Save Capacities".
                {modifiedCount > 0 && (
                  <Chip
                    size="small"
                    label={`${modifiedCount} pending change(s)`}
                    sx={{ ml: 1, bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Typography>
            </Box>

            {/* Daily Entry Table */}
            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow sx={{ '& th': { fontWeight: 800, color: '#0f172a', py: 1.5, fontSize: '0.8rem' } }}>
                    <TableCell sx={{ width: 50, textAlign: 'center' }}>#</TableCell>
                    <TableCell sx={{ width: 150 }}>Machine Code</TableCell>
                    <TableCell sx={{ width: 200 }}>Machine Name</TableCell>
                    <TableCell sx={{ width: 130 }}>Scheduled Date</TableCell>
                    <TableCell sx={{ width: 180 }}>Schedule Config</TableCell>
                    <TableCell sx={{ width: 220 }}>Day Capacity (Units/Day)</TableCell>
                    <TableCell sx={{ width: 140 }}>Base Standard</TableCell>
                    <TableCell sx={{ width: 140 }}>Day Status / Variance</TableCell>
                    <TableCell>Reason / Shift Note</TableCell>
                    <TableCell align="center" sx={{ width: 160 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingMachines || loadingCapacities ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={30} sx={{ color: '#0284c7', mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          Loading Toyo Machines and daily capacities...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredMachines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 6, color: '#64748b' }}>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#334155' }}>
                          No Toyo machines registered.
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
                          Click "Add Toyo Machine" to register production equipment.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMachines.map((m, index) => {
                      const currentRow = dailySheetRows[m.id] || {
                        dailyCapacity: m.dailyCapacity,
                        operatingHours: m.operatingHours === 12 ? 12 : 24,
                        reason: '',
                        isModified: false
                      };
                      const variance = currentRow.dailyCapacity - m.dailyCapacity;
                      const isDown = currentRow.dailyCapacity === 0;

                      return (
                        <TableRow
                          key={m.id}
                          hover
                          sx={{
                            bgcolor: currentRow.isModified ? 'rgba(254, 243, 199, 0.25)' : 'inherit',
                            '&:last-child td': { borderBottom: 0 }
                          }}
                        >
                          {/* Row Index */}
                          <TableCell align="center" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>
                            {index + 1}
                          </TableCell>

                          {/* Machine Code */}
                          <TableCell sx={{ fontWeight: 800, color: '#0284c7', fontSize: '0.85rem' }}>
                            {m.machineCode}
                          </TableCell>

                          {/* Machine Name */}
                          <TableCell sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                            {m.machineName}
                          </TableCell>

                          {/* Scheduled Date */}
                          <TableCell sx={{ color: '#475569', fontWeight: 600, fontSize: '0.8rem' }}>
                            {singleDate}
                          </TableCell>

                          {/* Operating Hours Toggle: strictly 12h or 24h */}
                          <TableCell>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={currentRow.operatingHours}
                                sx={{ fontSize: '0.8rem' }}
                                onChange={(e) => {
                                  setDailySheetRows({
                                    ...dailySheetRows,
                                    [m.id]: {
                                      ...currentRow,
                                      operatingHours: Number(e.target.value) === 12 ? 12 : 24,
                                      isModified: true
                                    }
                                  });
                                }}
                              >
                                <MenuItem value={12}>12 Hours / Day</MenuItem>
                                <MenuItem value={24}>24 Hours / Day</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>

                          {/* Scheduled Capacity for this Date (Inline Editable) */}
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              fullWidth
                              value={currentRow.dailyCapacity}
                              slotProps={{
                                htmlInput: { min: 0, step: 50, style: { fontWeight: 700 } }
                              }}
                              onChange={(e) => {
                                setDailySheetRows({
                                  ...dailySheetRows,
                                  [m.id]: {
                                    ...currentRow,
                                    dailyCapacity: Math.max(0, Number(e.target.value) || 0),
                                    isModified: true
                                  }
                                });
                              }}
                            />
                          </TableCell>

                          {/* Base Standard */}
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                              {m.dailyCapacity.toLocaleString()} u/day
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                              {m.operatingHours === 12 ? '12h config' : '24h config'}
                            </Typography>
                          </TableCell>

                          {/* Status / Variance Badge */}
                          <TableCell>
                            {isDown ? (
                              <Chip
                                size="small"
                                label="DOWNTIME (0)"
                                sx={{ bgcolor: '#fee2e2', color: '#b91c1c', fontWeight: 800, fontSize: '0.65rem' }}
                              />
                            ) : variance > 0 ? (
                              <Chip
                                size="small"
                                label={`+${variance} (Surge)`}
                                sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: '0.65rem' }}
                              />
                            ) : variance < 0 ? (
                              <Chip
                                size="small"
                                label={`${variance} (Reduced)`}
                                sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: '0.65rem' }}
                              />
                            ) : (
                              <Chip
                                size="small"
                                label="Standard Base"
                                sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '0.65rem' }}
                              />
                            )}
                          </TableCell>

                          {/* Reason / Notes */}
                          <TableCell>
                            <TextField
                              size="small"
                              fullWidth
                              placeholder="e.g. Mold change, maintenance..."
                              value={currentRow.reason}
                              onChange={(e) => {
                                setDailySheetRows({
                                  ...dailySheetRows,
                                  [m.id]: {
                                    ...currentRow,
                                    reason: e.target.value,
                                    isModified: true
                                  }
                                });
                              }}
                            />
                          </TableCell>

                          {/* Row Actions */}
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center' }}>
                              <Tooltip title="Reset to standard baseline capacity">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setDailySheetRows({
                                      ...dailySheetRows,
                                      [m.id]: {
                                        ...currentRow,
                                        dailyCapacity: m.dailyCapacity,
                                        operatingHours: m.operatingHours === 12 ? 12 : 24,
                                        reason: 'Standard Baseline',
                                        isModified: true
                                      }
                                    });
                                  }}
                                >
                                  <RestartAltIcon sx={{ fontSize: 18, color: '#0284c7' }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Mark 0 (Scheduled Downtime)">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setDailySheetRows({
                                      ...dailySheetRows,
                                      [m.id]: {
                                        ...currentRow,
                                        dailyCapacity: 0,
                                        reason: 'Scheduled Downtime',
                                        isModified: true
                                      }
                                    });
                                  }}
                                >
                                  <BlockIcon sx={{ fontSize: 18, color: '#ef4444' }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit Machine Definition">
                                <IconButton size="small" onClick={() => handleOpenMachineDialog(m)}>
                                  <EditIcon sx={{ fontSize: 17, color: '#64748b' }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Machine">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    if (window.confirm(`Delete ${m.machineCode} from Toyo Master?`)) {
                                      deleteMachineMutation.mutate(m.id);
                                    }
                                  }}
                                >
                                  <DeleteForeverIcon sx={{ fontSize: 17, color: '#ef4444' }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: MULTI-DAY HORIZON MATRIX (TIMELINE VIEW)                            */}
      {/* ========================================================================= */}
      {activeTab === 1 && (
        <>
          {/* Date Navigation & Controls Bar */}
          <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: 'none', mb: 2.5 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', gap: 2 }}>
                {/* Search */}
                <Box sx={{ width: { xs: '100%', sm: 280 } }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search machine code or name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                          </InputAdornment>
                        )
                      }
                    }}
                    sx={{ bgcolor: '#ffffff', '& fieldset': { borderColor: '#e2e8f0' } }}
                  />
                </Box>

                {/* Date Shifter */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <IconButton onClick={() => handleShiftDate(-daysCount)} size="small" sx={{ border: '1px solid #e2e8f0' }}>
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleResetToToday}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', borderRadius: '8px' }}
                  >
                    Today
                  </Button>
                  <IconButton onClick={() => handleShiftDate(daysCount)} size="small" sx={{ border: '1px solid #e2e8f0' }}>
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>

                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', ml: 1 }}>
                    {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' — '}
                    {new Date(dateList[dateList.length - 1]?.date || startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Typography>
                </Box>

                {/* View Window Selection */}
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: { xs: 'center', md: 'flex-end' } }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                    Horizon:
                  </Typography>
                  {[7, 10, 14].map((cnt) => (
                    <Chip
                      key={cnt}
                      label={`${cnt} Days`}
                      size="small"
                      clickable
                      onClick={() => setDaysCount(cnt)}
                      color={daysCount === cnt ? 'primary' : 'default'}
                      variant={daysCount === cnt ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                    />
                  ))}
                </Stack>
              </Box>
            </CardContent>
          </Card>

          {/* Dynamic Day-to-Day Variable Capacity Matrix */}
          <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 680 }}>
              <Table stickyHeader size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, color: '#0f172a', py: 1.5, fontSize: '0.8rem' } }}>
                    <TableCell sx={{ minWidth: 240, borderRight: '2px solid #e2e8f0', bgcolor: '#f8fafc !important' }}>
                      Toyo Machine Specification
                    </TableCell>
                    <TableCell sx={{ minWidth: 150, borderRight: '1px solid #e2e8f0' }}>
                      Base Capacity / Config
                    </TableCell>
                    {dateList.map((d) => (
                      <TableCell
                        key={d.dateStr}
                        align="center"
                        sx={{
                          minWidth: 105,
                          borderLeft: '1px solid #e2e8f0',
                          bgcolor: d.isWeekend ? '#f1f5f9 !important' : '#f8fafc !important',
                          color: d.isWeekend ? '#64748b' : '#0f172a'
                        }}
                      >
                        {d.dayLabel}
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ fontWeight: 800, bgcolor: '#f8fafc', width: 90 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingMachines || loadingCapacities ? (
                    <TableRow>
                      <TableCell colSpan={daysCount + 3} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={32} sx={{ color: '#0284c7', mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          Loading Toyo Machines and daily capacities...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredMachines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={daysCount + 3} align="center" sx={{ py: 6 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#334155' }}>
                          No Toyo machines found.
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
                          Click "Add Toyo Machine" to register production equipment.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMachines.map((m) => {
                      const baseOpHours = m.operatingHours === 12 ? 12 : 24;

                      return (
                        <TableRow key={m.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                          {/* Machine Details (Code & Name) */}
                          <TableCell sx={{ py: 1.2, borderRight: '2px solid #f1f5f9' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '8px',
                                  bgcolor: 'rgba(2, 132, 199, 0.1)',
                                  color: '#0284c7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: '0.75rem'
                                }}
                              >
                                {m.machineCode.slice(-2)}
                              </Box>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                                  {m.machineCode}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>
                                  {m.machineName}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>

                          {/* Base Capacity / Config (12h or 24h) */}
                          <TableCell sx={{ py: 1.2, borderRight: '1px solid #f1f5f9' }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#334155' }}>
                              {m.dailyCapacity.toLocaleString()} units
                            </Typography>
                            <Chip
                              label={`${baseOpHours}h/day`}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: baseOpHours === 12 ? '#fef3c7' : '#e0f2fe',
                                color: baseOpHours === 12 ? '#b45309' : '#0369a1',
                                mt: 0.2
                              }}
                            />
                          </TableCell>

                          {/* Day-to-Day Date Columns */}
                          {dateList.map((d) => {
                            const capRecord = capacityMap.get(`${m.id}_${d.dateStr}`);
                            const dailyCap = capRecord !== undefined ? capRecord.dailyCapacity : m.dailyCapacity;
                            const opHours = capRecord !== undefined ? (capRecord.operatingHours === 12 ? 12 : 24) : baseOpHours;
                            const variance = dailyCap - m.dailyCapacity;
                            const reason = capRecord?.reason || (variance !== 0 ? 'Adjusted' : 'Standard');

                            const isSurge = variance > 0;
                            const isReduced = variance < 0 && dailyCap > 0;
                            const isDown = dailyCap === 0;

                            return (
                              <TableCell
                                key={d.dateStr}
                                align="center"
                                onClick={() => handleCellClick(m, d)}
                                sx={{
                                  borderLeft: '1px solid #f1f5f9',
                                  cursor: 'pointer',
                                  py: 1,
                                  px: 0.8,
                                  bgcolor: isDown
                                    ? 'rgba(239, 68, 68, 0.08)'
                                    : isSurge
                                    ? 'rgba(16, 185, 129, 0.08)'
                                    : isReduced
                                    ? 'rgba(245, 158, 11, 0.08)'
                                    : d.isWeekend
                                    ? '#fcfcfc'
                                    : 'transparent',
                                  transition: 'all 0.15s ease',
                                  '&:hover': {
                                    bgcolor: 'rgba(2, 132, 199, 0.15)',
                                    transform: 'scale(1.02)'
                                  }
                                }}
                              >
                                <Tooltip
                                  title={
                                    <Box sx={{ p: 0.5 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 800, display: 'block' }}>
                                        {d.dayLabel} • {m.machineCode}
                                      </Typography>
                                      <Typography variant="caption" sx={{ display: 'block' }}>
                                        Capacity: {dailyCap.toLocaleString()} units ({opHours}h config)
                                      </Typography>
                                      {variance !== 0 && (
                                        <Typography variant="caption" sx={{ color: isSurge ? '#86efac' : '#fde047', display: 'block' }}>
                                          Variance: {variance > 0 ? `+${variance}` : variance} ({reason})
                                        </Typography>
                                      )}
                                      <Typography variant="caption" sx={{ color: '#93c5fd', fontStyle: 'italic', display: 'block', mt: 0.5 }}>
                                        Click to configure date capacity &amp; hours
                                      </Typography>
                                    </Box>
                                  }
                                >
                                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: 800,
                                        fontSize: '0.825rem',
                                        color: isDown ? '#ef4444' : isSurge ? '#16a34a' : isReduced ? '#d97706' : '#0f172a'
                                      }}
                                    >
                                      {dailyCap === 0 ? 'DOWN' : dailyCap.toLocaleString()}
                                    </Typography>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.2 }}>
                                      <Chip
                                        label={`${opHours}h`}
                                        size="small"
                                        sx={{
                                          height: 16,
                                          fontSize: '0.62rem',
                                          fontWeight: 700,
                                          px: 0.3,
                                          bgcolor: opHours === 12 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                                          color: opHours === 12 ? '#b45309' : '#0284c7'
                                        }}
                                      />
                                      {variance !== 0 && (
                                        <Chip
                                          label={variance > 0 ? `+${variance}` : `${variance}`}
                                          size="small"
                                          sx={{
                                            height: 16,
                                            fontSize: '0.6rem',
                                            fontWeight: 800,
                                            bgcolor: isSurge ? '#dcfce7' : '#fee2e2',
                                            color: isSurge ? '#15803d' : '#b91c1c'
                                          }}
                                        />
                                      )}
                                    </Box>
                                  </Box>
                                </Tooltip>
                              </TableCell>
                            );
                          })}

                          {/* Action Edit Definition */}
                          <TableCell align="center" sx={{ py: 1 }}>
                            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center' }}>
                              <Tooltip title="Edit Machine Specs">
                                <IconButton size="small" onClick={() => handleOpenMachineDialog(m)}>
                                  <EditIcon sx={{ fontSize: 16, color: '#64748b' }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Machine">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    if (window.confirm(`Delete ${m.machineCode} from Toyo Master?`)) {
                                      deleteMachineMutation.mutate(m.id);
                                    }
                                  }}
                                >
                                  <DeleteForeverIcon sx={{ fontSize: 16, color: '#ef4444' }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {/* ========================================================================= */}
      {/* DIALOG: CONFIGURE DATE CAPACITY & SCHEDULE (FROM MATRIX CLICK)           */}
      {/* ========================================================================= */}
      <Dialog
        open={dayCapacityDialogOpen}
        onClose={() => setDayCapacityDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px' } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          Configure Date Capacity &amp; Schedule
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {selectedDayCapacity && (
            <>
              <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  {selectedDayCapacity.machine.machineCode} — {selectedDayCapacity.machine.machineName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 800, display: 'block', mt: 0.3 }}>
                  Scheduled Date: {selectedDayCapacity.dayLabel} ({selectedDayCapacity.dateStr})
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mt: 0.2 }}>
                  Standard Baseline: {selectedDayCapacity.machine.dailyCapacity.toLocaleString()} units / {selectedDayCapacity.machine.operatingHours === 12 ? 12 : 24}h
                </Typography>
              </Box>

              {/* Date Output Capacity */}
              <TextField
                label="Date Output Capacity (Units/Day)"
                type="number"
                fullWidth
                value={selectedDayCapacity.currentCapacity}
                onChange={(e) => setSelectedDayCapacity({
                  ...selectedDayCapacity,
                  currentCapacity: Math.max(0, Number(e.target.value) || 0)
                })}
                helperText={`Variance vs baseline: ${selectedDayCapacity.currentCapacity - selectedDayCapacity.machine.dailyCapacity} units`}
              />

              {/* Just 24 hrs and 12 hrs config */}
              <FormControl fullWidth required>
                <InputLabel>Operating Hours Config</InputLabel>
                <Select
                  value={selectedDayCapacity.operatingHours}
                  label="Operating Hours Config"
                  onChange={(e) => setSelectedDayCapacity({
                    ...selectedDayCapacity,
                    operatingHours: Number(e.target.value) === 12 ? 12 : 24
                  })}
                >
                  <MenuItem value={12}>12 Hours / Day</MenuItem>
                  <MenuItem value={24}>24 Hours / Day</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Reason for Variation / Shift Notes (Optional)"
                fullWidth
                placeholder="e.g. Maintenance, mold change, surge order..."
                value={selectedDayCapacity.reason}
                onChange={(e) => setSelectedDayCapacity({
                  ...selectedDayCapacity,
                  reason: e.target.value
                })}
              />

              {/* Quick Actions */}
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectedDayCapacity({
                    ...selectedDayCapacity,
                    currentCapacity: selectedDayCapacity.machine.dailyCapacity,
                    operatingHours: selectedDayCapacity.machine.operatingHours === 12 ? 12 : 24,
                    reason: 'Restored to standard baseline'
                  })}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  Reset to Base
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => setSelectedDayCapacity({
                    ...selectedDayCapacity,
                    currentCapacity: 0,
                    reason: 'Scheduled Downtime'
                  })}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  Mark 0 / Down
                </Button>
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setDayCapacityDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={saveDayCapacityMutation.isPending}
            onClick={() => {
              if (!selectedDayCapacity) return;
              saveDayCapacityMutation.mutate({
                machineId: selectedDayCapacity.machine.id,
                machineCode: selectedDayCapacity.machine.machineCode,
                dateStr: selectedDayCapacity.dateStr,
                operatingHours: selectedDayCapacity.operatingHours,
                dailyCapacity: selectedDayCapacity.currentCapacity,
                reason: selectedDayCapacity.reason,
                notes: selectedDayCapacity.notes,
                baseDailyCapacity: selectedDayCapacity.machine.dailyCapacity
              });
            }}
            sx={{
              bgcolor: '#0284c7',
              '&:hover': { bgcolor: '#0369a1' },
              fontWeight: 700,
              textTransform: 'none'
            }}
          >
            {saveDayCapacityMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG: ADD / EDIT TOYO MACHINE DEFINITION                                */}
      {/* Machine Code, Machine Name, Date, 12h/24h config, Daily Capacity, Status  */}
      {/* ========================================================================= */}
      <Dialog
        open={machineDialogOpen}
        onClose={() => setMachineDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px' } } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingMachine ? 'Edit Toyo Machine' : 'Register Toyo Machine'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.2, pt: 2 }}>
          <Box sx={{ p: 1.5, bgcolor: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
            <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700, display: 'block' }}>
              ℹ️ Toyo Dynamic Daily Capacity:
            </Typography>
            <Typography variant="caption" sx={{ color: '#0284c7', display: 'block', mt: 0.3 }}>
              Toyo machine capacities change dynamically on a day-to-day basis. Specify the initial scheduled date and capacity below.
            </Typography>
          </Box>

          <TextField
            label="Machine Code"
            required
            fullWidth
            placeholder="e.g. TOYO-EXT-01"
            value={machineFormData.machineCode}
            onChange={(e) => setMachineFormData({ ...machineFormData, machineCode: e.target.value })}
          />

          <TextField
            label="Machine Name"
            required
            fullWidth
            placeholder="e.g. Precision Extruder Line 1"
            value={machineFormData.machineName}
            onChange={(e) => setMachineFormData({ ...machineFormData, machineName: e.target.value })}
          />

          {/* Scheduled Date picker */}
          {!editingMachine && (
            <TextField
              label="Scheduled Date"
              type="date"
              required
              fullWidth
              value={machineFormData.dateStr}
              onChange={(e) => setMachineFormData({ ...machineFormData, dateStr: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Date from which day-to-day capacity scheduling begins"
            />
          )}

          {/* Strictly 12 hrs and 24 hrs config */}
          <FormControl fullWidth required>
            <InputLabel>Operating Hours Config</InputLabel>
            <Select
              value={machineFormData.operatingHours}
              label="Operating Hours Config"
              onChange={(e) => setMachineFormData({ ...machineFormData, operatingHours: Number(e.target.value) === 12 ? 12 : 24 })}
            >
              <MenuItem value={12}>12 Hours / Day</MenuItem>
              <MenuItem value={24}>24 Hours / Day</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label={editingMachine ? "Baseline Daily Capacity (Units/Day)" : "Daily Capacity (Units/Day)"}
            type="number"
            required
            fullWidth
            value={machineFormData.dailyCapacity}
            onChange={(e) => setMachineFormData({ ...machineFormData, dailyCapacity: Number(e.target.value) })}
            helperText="Machine capacity that can be adjusted dynamically day-by-day"
          />

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={machineFormData.status}
              label="Status"
              onChange={(e) => setMachineFormData({ ...machineFormData, status: e.target.value })}
            >
              <MenuItem value="ACTIVE">ACTIVE</MenuItem>
              <MenuItem value="INACTIVE">INACTIVE</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setMachineDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!machineFormData.machineCode.trim() || !machineFormData.machineName.trim() || saveMachineMutation.isPending}
            onClick={() => saveMachineMutation.mutate(machineFormData)}
            sx={{
              bgcolor: '#0284c7',
              '&:hover': { bgcolor: '#0369a1' },
              fontWeight: 700,
              textTransform: 'none'
            }}
          >
            {saveMachineMutation.isPending ? 'Saving...' : editingMachine ? 'Update Machine' : 'Register Machine & Schedule'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert severity={notification.severity} onClose={() => setNotification({ ...notification, open: false })}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MachineMasterToyo;
