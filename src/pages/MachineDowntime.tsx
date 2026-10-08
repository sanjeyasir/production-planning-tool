import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  getDowntimeRecords,
  getPlants,
  getMachines,
  getDowntimeCategories,
  getHolidays,
  getProductionPlans,
  createDowntimeRecord,
  deleteDowntimeRecord,
  shiftMachinePlansByWorkingDays,
  hasActiveJobOnDate,
  toLocalDateString,
  parseLocalDate,
  type DowntimeCategory
} from '../services/db';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Stack,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';

import BuildIcon from '@mui/icons-material/Build';
import DownloadIcon from '@mui/icons-material/Download';
import TableViewIcon from '@mui/icons-material/TableView';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SearchIcon from '@mui/icons-material/Search';

// Handsontable
import { HotTable } from '@handsontable/react';
import * as XLSX from 'xlsx';

export const MachineDowntime: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, user, profile } = useAuthStore();
  const tenantId = tenant?.id || '';
  const operatorName = profile?.name || user?.displayName || profile?.email || user?.email || 'Operator';

  // ----------------------------------------------------
  // DATE RANGE FILTER & PRESETS (7 Days, 14 Days, 31 Days, All)
  // ----------------------------------------------------
  const today = new Date();
  const todayStr = toLocalDateString(today);

  const getPresetStartDate = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return toLocalDateString(d);
  };

  const [dateRangePreset, setDateRangePreset] = useState<'7' | '14' | '31' | 'all'>('31');
  const [fromDateStr, setFromDateStr] = useState<string>(getPresetStartDate(31));
  const [toDateStr, setToDateStr] = useState<string>(todayStr);
  const [appliedFromDate, setAppliedFromDate] = useState<string>(getPresetStartDate(31));
  const [appliedToDate, setAppliedToDate] = useState<string>(todayStr);

  const handlePresetChange = (_: React.MouseEvent<HTMLElement>, newPreset: '7' | '14' | '31' | 'all' | null) => {
    if (!newPreset) return;
    setDateRangePreset(newPreset);
    if (newPreset === 'all') {
      setFromDateStr('');
      setToDateStr('');
      setAppliedFromDate('');
      setAppliedToDate('');
    } else {
      const days = parseInt(newPreset, 10);
      const start = getPresetStartDate(days);
      setFromDateStr(start);
      setToDateStr(todayStr);
      setAppliedFromDate(start);
      setAppliedToDate(todayStr);
    }
  };

  const handleGetEntries = () => {
    setAppliedFromDate(fromDateStr);
    setAppliedToDate(toDateStr);
    showToast(`Showing downtime entries from ${fromDateStr || 'Start'} to ${toDateStr || 'Latest'}`, 'info');
  };

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
  // QUERIES
  // ----------------------------------------------------
  const { data: records = [] } = useQuery({
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

  // Category Lookup Map
  const categoryMap = useMemo(() => {
    const map: Record<string, DowntimeCategory> = {};
    categories.forEach(c => { map[c.id] = c; });
    return map;
  }, [categories]);

  // ----------------------------------------------------
  // DOWNTIME ENTRY FORM STATE (Machine, Category, Date, Remarks)
  // ----------------------------------------------------
  const [formData, setFormData] = useState({
    machineId: '',
    categoryId: '',
    date: todayStr,
    remarks: '',
  });

  // Set default machine and category once loaded
  React.useEffect(() => {
    if (machines.length > 0 && !formData.machineId) {
      setFormData(prev => ({ ...prev, machineId: machines[0].id }));
    }
  }, [machines, formData.machineId]);

  React.useEffect(() => {
    if (categories.length > 0 && !formData.categoryId) {
      setFormData(prev => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, formData.categoryId]);

  // Check if selected machine has an active job planned on the selected date
  const isJobActiveOnDate = useMemo(() => {
    if (!formData.machineId || !formData.date) return false;
    return hasActiveJobOnDate({
      machineId: formData.machineId,
      dateStr: formData.date,
      plans,
      holidays
    });
  }, [formData.machineId, formData.date, plans, holidays]);

  // ----------------------------------------------------
  // MUTATION: ADD DOWNTIME
  // ----------------------------------------------------
  const addDowntimeMutation = useMutation({
    mutationFn: async () => {
      if (!formData.machineId) throw new Error('Please select a machine.');
      if (!formData.date) throw new Error('Please select a date.');

      const mach = machines.find(m => m.id === formData.machineId);
      const plantId = mach?.plantId || plants[0]?.id || 'default_plant';
      const catId = formData.categoryId || (categories[0]?.id ?? 'downtime_event');
      const catObj = categoryMap[catId] || categories.find(c => c.id === catId);
      const catName = catObj?.name || 'General Downtime';

      const dDate = parseLocalDate(formData.date);
      const startTime = new Date(dDate.getTime() + 8 * 3600000); // 08:00 default
      const endTime = new Date(startTime.getTime() + 8 * 3600000); // full shift default (8 hrs)

      // 1. Create Downtime Record
      await createDowntimeRecord({
        tenantId,
        plantId,
        machineId: formData.machineId,
        categoryId: catId,
        shift: 'General',
        dateStr: formData.date,
        startTime,
        endTime,
        duration: 480, // standard duration (8 hrs)
        reason: formData.remarks || catName,
        remarks: formData.remarks || catName,
        createdBy: operatorName
      });

      // 2. Check if machine has active jobs on this specific date
      const jobOnDay = hasActiveJobOnDate({
        machineId: formData.machineId,
        dateStr: formData.date,
        plans,
        holidays
      });

      let shiftResult = null;
      if (jobOnDay) {
        // Shift active plans starting from this date forward by 1 working day (skipping factory holidays)
        shiftResult = await shiftMachinePlansByWorkingDays({
          machineId: formData.machineId,
          fromDateStr: formData.date,
          direction: 'forward',
          holidays,
          plans
        });
      }

      return { jobOnDay, shiftResult, machineCode: mach?.machineCode || 'Machine' };
    },
    onSuccess: ({ jobOnDay, shiftResult, machineCode }) => {
      queryClient.invalidateQueries({ queryKey: ['downtimeRecords', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionPlans', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });

      setFormData(prev => ({
        ...prev,
        remarks: ''
      }));

      if (jobOnDay && shiftResult && shiftResult.shiftedCount > 0) {
        showToast(`Downtime added. Active jobs detected on ${formData.date}: shifted ${shiftResult.shiftedCount} plan(s) on ${machineCode} forward by 1 working day (skipped factory holidays).`, 'success');
      } else {
        showToast(`Downtime added for ${machineCode} on ${formData.date}. No scheduled jobs were planned on this day, so no orders were shifted.`, 'info');
      }
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteDowntimeMutation = useMutation({
    mutationFn: deleteDowntimeRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtimeRecords', tenantId] });
      showToast('Downtime record removed.', 'info');
    },
    onError: (err: any) => showToast('Failed to delete downtime: ' + err.message, 'error')
  });

  // ----------------------------------------------------
  // FILTERED DOWNTIME RECORDS FOR HANDSONTABLE
  // ----------------------------------------------------
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const dStr = r.dateStr || (r.startTime ? toLocalDateString(r.startTime) : '');
      if (appliedFromDate && dStr < appliedFromDate) return false;
      if (appliedToDate && dStr > appliedToDate) return false;
      return true;
    }).sort((a, b) => {
      const tA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const tB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return tB - tA;
    });
  }, [records, appliedFromDate, appliedToDate]);

  // Handsontable Data Format (View-Only)
  const hotData = useMemo(() => {
    return filteredRecords.map((r, idx) => {
      const p = plants.find(plant => plant.id === r.plantId);
      const m = machines.find(mach => mach.id === r.machineId);
      const c = categoryMap[r.categoryId] || categories.find(cat => cat.id === r.categoryId);
      const dStr = toLocalDateString(r.startTime);

      return {
        rowNum: idx + 1,
        id: r.id,
        date: dStr,
        plantName: p?.plantName || 'Plant',
        machineCode: m?.machineCode || 'Line',
        machineName: m?.machineName || 'Machine',
        categoryName: c?.name || (r.categoryId === 'downtime_event' ? 'General Breakdown' : (r.categoryId || 'Uncategorized')),
        remarks: r.remarks || r.reason || '—',
        createdBy: r.createdBy || 'Operator',
        actions: 'DELETE'
      };
    });
  }, [filteredRecords, plants, machines, categoryMap, categories]);

  // ----------------------------------------------------
  // PROPERLY FORMATTED EXCEL REPORT EXPORT
  // ----------------------------------------------------
  const handleExportExcelReport = () => {
    const reportHeader = [
      ['MACHINE DOWNTIME LOG REPORT'],
      [`Company / Plant: ${tenant?.companyName || 'Main Facility'} | Exported At: ${new Date().toLocaleString()}`],
      [`Date Filter: ${fromDateStr || 'Start'} to ${toDateStr || 'Latest'} (${dateRangePreset.toUpperCase()} Presets)`],
      [`Total Recorded Downtime Incidents: ${filteredRecords.length}`],
      [], // blank line
      [
        '#',
        'Date',
        'Plant',
        'Machine Code',
        'Machine Name',
        'Downtime Category',
        'Remarks / Reason',
        'Logged By'
      ]
    ];

    const reportRows = filteredRecords.map((r, idx) => {
      const p = plants.find(plant => plant.id === r.plantId);
      const m = machines.find(mach => mach.id === r.machineId);
      const c = categoryMap[r.categoryId] || categories.find(cat => cat.id === r.categoryId);
      const dStr = toLocalDateString(r.startTime);

      return [
        idx + 1,
        dStr,
        p?.plantName || 'N/A',
        m?.machineCode || 'N/A',
        m?.machineName || 'N/A',
        c?.name || 'Uncategorized',
        r.remarks || r.reason || '—',
        r.createdBy || 'Operator'
      ];
    });

    const combinedData = [...reportHeader, ...reportRows];
    const ws = XLSX.utils.aoa_to_sheet(combinedData);

    // Column widths
    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 40 },
      { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Downtime Log');
    XLSX.writeFile(wb, `Downtime_Report_${fromDateStr || 'All'}_to_${toDateStr || 'Today'}.xlsx`);
    showToast('Formatted Downtime Report exported successfully!');
  };

  return (
    <Box sx={{ py: 1 }}>
      {/* HEADER */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <BuildIcon sx={{ color: '#ef4444', fontSize: 28 }} />
            Downtime Logging
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Log machine stoppages by category. If jobs exist on the downtime date, schedule is shifted forward by 1 working day (skipping holidays).
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportExcelReport}
            sx={{ borderRadius: '8px', fontWeight: 600, textTransform: 'none' }}
          >
            Export Excel Report
          </Button>
        </Stack>
      </Box>

      {/* SECTION 1: DOWNTIME ENTRY FORM */}
      <Card sx={{ mb: 3, borderRadius: '16px', border: '1.5px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlaylistAddIcon sx={{ color: '#ef4444' }} />
              Log Downtime Event
            </Typography>
            {formData.machineId && (
              <Chip
                label={isJobActiveOnDate ? `⚡ Active Job Scheduled on ${formData.date} — Will auto-shift by +1 day (skipping holidays)` : `ℹ️ No Jobs Scheduled on ${formData.date} — Schedule will remain unchanged`}
                size="small"
                sx={{
                  fontWeight: 700,
                  bgcolor: isJobActiveOnDate ? '#fef2f2' : '#f0fdf4',
                  color: isJobActiveOnDate ? '#b91c1c' : '#166534',
                  border: isJobActiveOnDate ? '1px solid #fecaca' : '1px solid #bbf7d0'
                }}
              />
            )}
          </Box>

          <form onSubmit={(e) => { e.preventDefault(); addDowntimeMutation.mutate(); }}>
            <Grid container spacing={2}>
              {/* Select Machine */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Select Machine</InputLabel>
                  <Select
                    label="Select Machine"
                    value={formData.machineId}
                    onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                  >
                    {machines.map(m => {
                      const p = plants.find(plant => plant.id === m.plantId);
                      return (
                        <MenuItem key={m.id} value={m.id}>
                          {m.machineCode} — {m.machineName} {p ? `(${p.plantName})` : ''}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>

              {/* Select Downtime Category */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Downtime Category</InputLabel>
                  <Select
                    label="Downtime Category"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    {categories.length > 0 ? (
                      categories.map(c => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem value="downtime_event">General Breakdown / Maintenance</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>

              {/* Select Date */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  label="Downtime Date"
                  type="date"
                  size="small"
                  fullWidth
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>

              {/* Remarks / Reason */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  label="Remarks / Specific Reason"
                  placeholder="e.g. Bearing failure, hydraulic leak"
                  size="small"
                  fullWidth
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </Grid>

              {/* Submit Button: Add Downtime */}
              <Grid size={{ xs: 12 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={addDowntimeMutation.isPending || !formData.machineId}
                  sx={{
                    bgcolor: '#ef4444',
                    '&:hover': { bgcolor: '#dc2626' },
                    color: '#ffffff',
                    fontWeight: 700,
                    px: 3.5,
                    py: 1,
                    borderRadius: '8px',
                    textTransform: 'none',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
                  }}
                >
                  {addDowntimeMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Add Downtime'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      {/* SECTION 2: VIEW OF DOWNTIME ENTRIES (HANDSONTABLE WITH DOWNTIME CATEGORY COLUMN) */}
      <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          {/* Table Header & Range Filters (7 Days, 14 Days, 31 Days, All) */}
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <TableViewIcon sx={{ color: '#475569' }} />
                Downtime Entries Log ({filteredRecords.length})
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                View-only spreadsheet with category details. Use quick presets or custom date filters below.
              </Typography>
            </Box>

            {/* Quick Presets (7 days, 14 days, 31 days, all) */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FilterAltIcon fontSize="inherit" /> Period:
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={dateRangePreset}
                exclusive
                onChange={handlePresetChange}
                sx={{ height: 32 }}
              >
                <ToggleButton value="7" sx={{ fontWeight: 700, fontSize: '0.75rem', px: 1.5 }}>
                  7 Days
                </ToggleButton>
                <ToggleButton value="14" sx={{ fontWeight: 700, fontSize: '0.75rem', px: 1.5 }}>
                  14 Days
                </ToggleButton>
                <ToggleButton value="31" sx={{ fontWeight: 700, fontSize: '0.75rem', px: 1.5 }}>
                  31 Days
                </ToggleButton>
                <ToggleButton value="all" sx={{ fontWeight: 700, fontSize: '0.75rem', px: 1.5 }}>
                  All
                </ToggleButton>
              </ToggleButtonGroup>

              {/* Custom Date Filters */}
              <TextField
                label="From"
                type="date"
                size="small"
                value={fromDateStr}
                onChange={(e) => { setFromDateStr(e.target.value); setDateRangePreset('all'); }}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 140, '& input': { py: 0.6, fontSize: '0.8rem' } }}
              />
              <TextField
                label="To"
                type="date"
                size="small"
                value={toDateStr}
                onChange={(e) => { setToDateStr(e.target.value); setDateRangePreset('all'); }}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 140, '& input': { py: 0.6, fontSize: '0.8rem' } }}
              />

              {/* Get Entries Button */}
              <Button
                variant="contained"
                size="small"
                onClick={handleGetEntries}
                startIcon={<SearchIcon />}
                sx={{
                  bgcolor: '#0f172a',
                  '&:hover': { bgcolor: '#1e293b' },
                  color: '#ffffff',
                  fontWeight: 700,
                  textTransform: 'none',
                  height: 34,
                  px: 1.8,
                  borderRadius: '8px'
                }}
              >
                Get Entries
              </Button>
            </Stack>
          </Box>

          {/* Handsontable View-Only Grid */}
          <Box
            sx={{
              width: '100%',
              overflow: 'hidden',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              '& .handsontable': {
                fontFamily: 'inherit',
                fontSize: '13px',
              },
              '& .handsontable th': {
                backgroundColor: '#f8fafc',
                color: '#1e293b',
                fontWeight: 700,
                fontSize: '12px',
                padding: '8px',
                borderRight: '1px solid #e2e8f0',
                borderBottom: '1px solid #cbd5e1',
              },
              '& .handsontable td': {
                padding: '6px 8px',
                color: '#334155',
                borderRight: '1px solid #f1f5f9',
                borderBottom: '1px solid #f1f5f9',
              }
            }}
          >
            {filteredRecords.length > 0 ? (
              <HotTable
                data={hotData}
                colHeaders={[
                  '#',
                  'Downtime Date',
                  'Plant',
                  'Machine Code',
                  'Machine Name',
                  'Downtime Category',
                  'Remarks / Reason',
                  'Logged By',
                  'Action'
                ]}
                columns={[
                  { data: 'rowNum', type: 'numeric', width: 45, className: 'htCenter htMiddle', readOnly: true },
                  { data: 'date', type: 'text', width: 110, className: 'htCenter htMiddle', readOnly: true },
                  { data: 'plantName', type: 'text', width: 130, className: 'htMiddle', readOnly: true },
                  { data: 'machineCode', type: 'text', width: 120, className: 'htCenter htMiddle', readOnly: true },
                  { data: 'machineName', type: 'text', width: 160, className: 'htMiddle', readOnly: true },
                  { data: 'categoryName', type: 'text', width: 170, className: 'htMiddle', readOnly: true },
                  { data: 'remarks', type: 'text', width: 260, className: 'htMiddle', readOnly: true },
                  { data: 'createdBy', type: 'text', width: 130, className: 'htCenter htMiddle', readOnly: true },
                  {
                    data: 'actions',
                    renderer: (_instance, td, row) => {
                      td.innerHTML = '';
                      const item = hotData[row];
                      if (!item) return td;
                      const btn = document.createElement('button');
                      btn.innerText = 'Delete';
                      btn.style.padding = '2px 8px';
                      btn.style.fontSize = '11px';
                      btn.style.color = '#ef4444';
                      btn.style.backgroundColor = '#fef2f2';
                      btn.style.border = '1px solid #fecaca';
                      btn.style.borderRadius = '4px';
                      btn.style.cursor = 'pointer';
                      btn.onclick = () => {
                        if (window.confirm(`Delete downtime record for ${item.machineCode} on ${item.date}?`)) {
                          deleteDowntimeMutation.mutate(item.id);
                        }
                      };
                      td.className = 'htCenter htMiddle';
                      td.appendChild(btn);
                      return td;
                    },
                    width: 80,
                    readOnly: true
                  }
                ]}
                rowHeaders={false}
                width="100%"
                height="auto"
                stretchH="all"
                licenseKey="non-commercial-and-evaluation"
                readOnly={true}
                contextMenu={false}
                manualColumnResize={true}
                autoWrapRow={true}
                autoWrapCol={true}
              />
            ) : (
              <Box sx={{ p: 4, textAlign: 'center', color: '#64748b' }}>
                <Typography variant="body2">No downtime records found for the selected period.</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Toast Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification(n => ({ ...n, open: false }))}
      >
        <Alert severity={notification.severity} variant="filled" sx={{ width: '100%', borderRadius: '10px' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MachineDowntime;
