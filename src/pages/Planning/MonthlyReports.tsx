import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getProductionOrders,
  getProductionPlans,
  getMachines,
  getSections,
  getProductionCategories,
  getDailyProductions,
  getTargetUnmetReasons,
  getMonthlyArchives,
  createMonthlyArchive,
  deleteMonthlyArchive,
  uploadArchiveExcelToStorage,
  toLocalDateString,
  parseLocalDate,
  type MonthlyArchive
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
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  InputAdornment
} from '@mui/material';

// Icons
import AssessmentIcon from '@mui/icons-material/Assessment';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import TableViewIcon from '@mui/icons-material/TableView';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import SearchIcon from '@mui/icons-material/Search';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

import * as XLSX from 'xlsx';

export const MonthlyReports: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, profile, tenant, activeCompany, activeMonthArchive, setActiveMonthArchive } = useAuthStore();
  const tenantId = activeCompany || tenant?.id || 'rileys';
  const isToyo = tenantId === 'toyo';
  const operatorName = profile?.name || user?.displayName || profile?.email || user?.email || 'Planner';

  // ----------------------------------------------------
  // MONTH & DATE RANGE SELECTION
  // ----------------------------------------------------
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Month selector (Default: activeMonthArchive from header or current month)
  const [selectedMonth, setSelectedMonth] = useState<string>(activeMonthArchive || currentMonthKey);
  const [useCustomRange, setUseCustomRange] = useState<boolean>(false);

  // Month date range computation
  const monthDateRange = useMemo(() => {
    const [yStr, mStr] = selectedMonth.split('-');
    const year = Number(yStr) || now.getFullYear();
    const month = Number(mStr) || now.getMonth() + 1;
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    return {
      year,
      month,
      monthLabel: firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      startDateStr: toLocalDateString(firstDay),
      endDateStr: toLocalDateString(lastDay)
    };
  }, [selectedMonth]);

  const [customFromDate, setCustomFromDate] = useState<string>(monthDateRange.startDateStr);
  const [customToDate, setCustomToDate] = useState<string>(monthDateRange.endDateStr);

  const effectiveStartDate = useCustomRange ? customFromDate : monthDateRange.startDateStr;
  const effectiveEndDate = useCustomRange ? customToDate : monthDateRange.endDateStr;

  // Active Tab: 0 = Flattened Reconciliation, 1 = Order Level Fulfillment, 2 = Cloud Archives Vault
  const [activeTab, setActiveTab] = useState<number>(0);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MET' | 'PARTIAL' | 'SHORTFALL' | 'NO_OUTPUT'>('ALL');

  // Archive Confirm Modal
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archivingInProgress, setArchivingInProgress] = useState(false);

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

  // Sync when activeMonthArchive in store changes
  React.useEffect(() => {
    if (activeMonthArchive) {
      setSelectedMonth(activeMonthArchive);
      setUseCustomRange(false);
    }
  }, [activeMonthArchive]);

  // ----------------------------------------------------
  // QUERIES
  // ----------------------------------------------------
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

  const { data: machines = [] } = useQuery({
    queryKey: ['machines', tenantId],
    queryFn: () => getMachines(tenantId),
    enabled: !!tenantId,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections', tenantId],
    queryFn: () => getSections(tenantId),
    enabled: isToyo && !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['productionCategories', tenantId],
    queryFn: () => getProductionCategories(tenantId),
    enabled: !isToyo && !!tenantId,
  });

  const { data: dailyLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['dailyProductions', tenantId],
    queryFn: () => getDailyProductions(tenantId),
    enabled: !!tenantId,
  });

  const { data: unmetReasons = [] } = useQuery({
    queryKey: ['targetUnmetReasons', tenantId],
    queryFn: () => getTargetUnmetReasons(tenantId),
    enabled: !!tenantId,
  });

  const { data: monthlyArchives = [], isLoading: loadingArchives } = useQuery({
    queryKey: ['monthlyArchives', tenantId],
    queryFn: () => getMonthlyArchives(tenantId),
    enabled: !!tenantId,
  });

  // Section / Category Maps
  const sectionMap = useMemo(() => {
    const map: Record<string, string> = {};
    sections.forEach(s => { map[s.id] = s.sectionName; });
    return map;
  }, [sections]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  // Available past months list for dropdown (last 12 months)
  const pastMonthsList = useMemo(() => {
    const list: Array<{ key: string; label: string }> = [];
    const base = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const l = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      list.push({ key: k, label: i === 0 ? `${l} (Current)` : l });
    }
    return list;
  }, []);

  // ----------------------------------------------------
  // FLATTENED MONTHLY RECONCILIATION DATA GENERATOR
  // ----------------------------------------------------
  interface FlattenedRow {
    key: string;
    dateStr: string;
    orderId: string;
    orderNumber: string;
    productName: string;
    groupName: string;
    machineId: string;
    machineCode: string;
    machineName: string;
    orderTargetVolume: number;
    plannedDailyVolume: number;
    actualVolume: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    variance: number;
    fulfillmentPercent: number;
    status: 'MET' | 'PARTIAL' | 'SHORTFALL' | 'NO_OUTPUT';
    downtimeMinutes: number;
    unmetReasonsText: string;
    unmetLostUnits: number;
    notes: string;
  }

  const flattenedMonthlyData = useMemo(() => {
    const rows: FlattenedRow[] = [];
    if (!effectiveStartDate || !effectiveEndDate) return rows;

    const start = parseLocalDate(effectiveStartDate);
    const end = parseLocalDate(effectiveEndDate);
    if (start > end) return rows;

    const confirmedPlans = plans.filter(p => p.type === 'CONFIRMED' && p.status !== 'CANCELLED');

    const cur = new Date(start);
    while (cur <= end) {
      const dStr = toLocalDateString(cur);

      confirmedPlans.forEach(plan => {
        const pStart = toLocalDateString(plan.startDate);
        const pEnd = toLocalDateString(plan.endDate);

        if (dStr >= pStart && dStr <= pEnd) {
          const hasOverrides = !!(plan.dailyVolumeOverrides && Object.keys(plan.dailyVolumeOverrides).length > 0);
          const plannedDaily = hasOverrides
            ? (plan.dailyVolumeOverrides && plan.dailyVolumeOverrides[dStr] !== undefined
                ? Number(plan.dailyVolumeOverrides[dStr]) || 0
                : 0)
            : (Number(plan.plannedDailyRate) || 0);

          if (plannedDaily > 0) {
            const order = orders.find(o => o.id === plan.orderId);
            const machine = machines.find(m => m.id === plan.machineId);

            // Matching actual output logs
            const matchingLogs = dailyLogs.filter(
              l => l.planId === plan.id && (l.dateStr === dStr || toLocalDateString(l.date) === dStr)
            );

            const actualVol = matchingLogs.reduce((sum, l) => sum + (Number(l.actualVolume) || 0), 0);
            const acceptedQty = matchingLogs.reduce((sum, l) => sum + (Number(l.acceptedQuantity) || 0), 0);
            const rejectedQty = matchingLogs.reduce((sum, l) => sum + (Number(l.rejectedQuantity) || 0), 0);
            const dtMins = matchingLogs.reduce((sum, l) => sum + (Number(l.downtimeMinutes) || 0), 0);
            const notesArr = matchingLogs.map(l => l.notes).filter(Boolean);

            // Matching Target Unmet Reasons
            const dayUnmetReasons = unmetReasons.filter(
              r => r.planId === plan.id && r.dateStr === dStr
            );
            const reasonsText = dayUnmetReasons.map(r => `[${r.hour}] ${r.reason}`).join('; ');
            const lostUnits = dayUnmetReasons.reduce((sum, r) => sum + (Number(r.lostUnits) || 0), 0);

            // Target Met Status
            let status: 'MET' | 'PARTIAL' | 'SHORTFALL' | 'NO_OUTPUT' = 'NO_OUTPUT';
            const eff = plannedDaily > 0 ? (actualVol / plannedDaily) * 100 : 0;
            if (actualVol === 0) {
              status = 'NO_OUTPUT';
            } else if (eff >= 100) {
              status = 'MET';
            } else if (eff >= 80) {
              status = 'PARTIAL';
            } else {
              status = 'SHORTFALL';
            }

            const groupName = isToyo
              ? (order?.sectionName || (order?.sectionId && sectionMap[order.sectionId]) || machine?.sectionName || 'Toyo Section')
              : (categoryMap[order?.categoryId || ''] || 'General');

            rows.push({
              key: `${plan.id}_${dStr}`,
              dateStr: dStr,
              orderId: plan.orderId,
              orderNumber: order?.orderNumber || 'Planned Order',
              productName: order?.productName || 'Item',
              groupName,
              machineId: plan.machineId,
              machineCode: machine?.machineCode || 'Line',
              machineName: machine?.machineName || 'Machine',
              orderTargetVolume: Number(order?.quantity || 0),
              plannedDailyVolume: plannedDaily,
              actualVolume: actualVol,
              acceptedQuantity: acceptedQty,
              rejectedQuantity: rejectedQty,
              variance: actualVol - plannedDaily,
              fulfillmentPercent: eff,
              status,
              downtimeMinutes: dtMins,
              unmetReasonsText: reasonsText,
              unmetLostUnits: lostUnits,
              notes: notesArr.join('; ')
            });
          }
        }
      });

      cur.setDate(cur.getDate() + 1);
    }

    return rows.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [effectiveStartDate, effectiveEndDate, plans, orders, machines, dailyLogs, unmetReasons, isToyo, sectionMap, categoryMap]);

  // Filtered rows for Tab 0 view
  const filteredFlattenedRows = useMemo(() => {
    return flattenedMonthlyData.filter(r => {
      // 1. Search term
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const mOrder = r.orderNumber.toLowerCase().includes(q);
        const mProd = r.productName.toLowerCase().includes(q);
        const mMach = r.machineCode.toLowerCase().includes(q) || r.machineName.toLowerCase().includes(q);
        const mGroup = r.groupName.toLowerCase().includes(q);
        const mReason = r.unmetReasonsText.toLowerCase().includes(q);
        if (!mOrder && !mProd && !mMach && !mGroup && !mReason) return false;
      }

      // 2. Status filter
      if (statusFilter !== 'ALL') {
        if (r.status !== statusFilter) return false;
      }

      return true;
    });
  }, [flattenedMonthlyData, searchTerm, statusFilter]);

  // ----------------------------------------------------
  // ORDER-LEVEL FULFILLMENT AGGREGATIONS (TAB 1)
  // ----------------------------------------------------
  interface OrderFulfillmentSummary {
    orderId: string;
    orderNumber: string;
    productName: string;
    groupName: string;
    totalTargetVolume: number;
    monthPlannedVolume: number;
    monthActualVolume: number;
    monthVariance: number;
    fulfillmentRate: number;
    scheduledDays: number;
    status: string;
  }

  const orderLevelSummaries = useMemo(() => {
    const map = new Map<string, {
      orderId: string;
      orderNumber: string;
      productName: string;
      groupName: string;
      totalTargetVolume: number;
      monthPlannedVolume: number;
      monthActualVolume: number;
      scheduledDays: number;
      status: string;
    }>();

    flattenedMonthlyData.forEach(r => {
      const existing = map.get(r.orderId) || {
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        productName: r.productName,
        groupName: r.groupName,
        totalTargetVolume: r.orderTargetVolume,
        monthPlannedVolume: 0,
        monthActualVolume: 0,
        scheduledDays: 0,
        status: 'PENDING'
      };

      existing.monthPlannedVolume += r.plannedDailyVolume;
      existing.monthActualVolume += r.actualVolume;
      existing.scheduledDays += 1;
      map.set(r.orderId, existing);
    });

    const summaries: OrderFulfillmentSummary[] = [];
    map.forEach(item => {
      const order = orders.find(o => o.id === item.orderId);
      const fulfillmentRate = item.monthPlannedVolume > 0
        ? (item.monthActualVolume / item.monthPlannedVolume) * 100
        : 0;

      summaries.push({
        ...item,
        status: order?.status || 'SCHEDULED',
        monthVariance: item.monthActualVolume - item.monthPlannedVolume,
        fulfillmentRate
      });
    });

    return summaries.sort((a, b) => b.monthPlannedVolume - a.monthPlannedVolume);
  }, [flattenedMonthlyData, orders]);

  // ----------------------------------------------------
  // MONTHLY KPI SUMMARY STATS
  // ----------------------------------------------------
  const kpiStats = useMemo(() => {
    const totalPlanned = flattenedMonthlyData.reduce((sum, r) => sum + r.plannedDailyVolume, 0);
    const totalActual = flattenedMonthlyData.reduce((sum, r) => sum + r.actualVolume, 0);
    const totalAccepted = flattenedMonthlyData.reduce((sum, r) => sum + r.acceptedQuantity, 0);
    const totalRejected = flattenedMonthlyData.reduce((sum, r) => sum + r.rejectedQuantity, 0);
    const totalDowntime = flattenedMonthlyData.reduce((sum, r) => sum + r.downtimeMinutes, 0);
    const totalLostUnits = flattenedMonthlyData.reduce((sum, r) => sum + r.unmetLostUnits, 0);
    const metCount = flattenedMonthlyData.filter(r => r.status === 'MET').length;
    const shortfallCount = flattenedMonthlyData.filter(r => r.status === 'SHORTFALL' || r.status === 'NO_OUTPUT').length;

    const attainmentPct = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
    const variance = totalActual - totalPlanned;

    return {
      totalPlanned,
      totalActual,
      totalAccepted,
      totalRejected,
      totalDowntime,
      totalLostUnits,
      attainmentPct,
      variance,
      metCount,
      shortfallCount,
      totalSchedules: flattenedMonthlyData.length,
      uniqueOrdersCount: orderLevelSummaries.length
    };
  }, [flattenedMonthlyData, orderLevelSummaries]);

  // ----------------------------------------------------
  // EXCEL REPORT BUILDER (MULTI-TAB WORKBOOK)
  // ----------------------------------------------------
  const buildMonthlyWorkbook = () => {
    const wb = XLSX.utils.book_new();

    // SHEET 1: Flattened Daily Reconciliation
    const sheet1Rows = flattenedMonthlyData.map((r, idx) => ({
      '#': idx + 1,
      'Run Date': r.dateStr,
      'Order Number': r.orderNumber,
      'Product Name': r.productName,
      [isToyo ? 'Section' : 'Category']: r.groupName,
      'Machine Code': r.machineCode,
      'Machine Name': r.machineName,
      'Order Target Total (u)': r.orderTargetVolume,
      'Daily Planned Volume (u)': r.plannedDailyVolume,
      'Actual Output (u)': r.actualVolume,
      'Accepted Good Units (u)': r.acceptedQuantity,
      'Scrap Rejected Units (u)': r.rejectedQuantity,
      'Variance (u)': r.variance,
      'Attainment %': `${r.fulfillmentPercent.toFixed(1)}%`,
      'Target Met Status': r.status,
      'Downtime (Mins)': r.downtimeMinutes,
      'Target Unmet Reasons': r.unmetReasonsText || '—',
      'Lost Units': r.unmetLostUnits || 0,
      'Shift Notes': r.notes || '—'
    }));
    const ws1 = XLSX.utils.json_to_sheet(sheet1Rows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Daily_Reconciliation');

    // SHEET 2: Order Level Summary
    const sheet2Rows = orderLevelSummaries.map((o, idx) => ({
      '#': idx + 1,
      'Order Number': o.orderNumber,
      'Product Name': o.productName,
      [isToyo ? 'Section' : 'Category']: o.groupName,
      'Order Total Target': o.totalTargetVolume,
      'Month Scheduled Volume': o.monthPlannedVolume,
      'Month Actual Produced': o.monthActualVolume,
      'Variance (u)': o.monthVariance,
      'Fulfillment Rate': `${o.fulfillmentRate.toFixed(1)}%`,
      'Scheduled Days': o.scheduledDays,
      'Planning Status': o.status
    }));
    const ws2 = XLSX.utils.json_to_sheet(sheet2Rows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Order_Fulfillment_Summary');

    // SHEET 3: Target Unmet Incidents
    const rangeUnmetReasons = unmetReasons.filter(
      r => r.dateStr >= effectiveStartDate && r.dateStr <= effectiveEndDate
    );
    const sheet3Rows = rangeUnmetReasons.map((u, idx) => ({
      '#': idx + 1,
      'Date': u.dateStr,
      'Hour Slot': u.hour,
      'Order Number': u.orderNumber || '—',
      'Product Name': u.productName || '—',
      'Machine Line': u.machineCode || '—',
      'Reason for Shortfall': u.reason,
      'Estimated Lost Units': u.lostUnits || 0,
      'Logged By': u.enteredBy || u.enteredByEmail || 'Operator'
    }));
    const ws3 = XLSX.utils.json_to_sheet(sheet3Rows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Target_Unmet_Incidents');

    return wb;
  };

  // Direct Download Excel
  const handleDownloadExcel = () => {
    if (flattenedMonthlyData.length === 0) {
      showToast('No schedule or production data found in selected period.', 'warning');
      return;
    }
    const wb = buildMonthlyWorkbook();
    const fileName = `${tenantId.toUpperCase()}_Monthly_Operations_Report_${effectiveStartDate}_to_${effectiveEndDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('Flattened Monthly Excel downloaded successfully!');
  };

  // ----------------------------------------------------
  // CLOUD ARCHIVAL ENGINE: RUN & STORE TO STORAGE
  // ----------------------------------------------------
  const handleRunMonthlyArchival = async () => {
    if (flattenedMonthlyData.length === 0) {
      showToast('Cannot archive an empty period with 0 schedules.', 'warning');
      return;
    }

    setArchivingInProgress(true);
    try {
      const wb = buildMonthlyWorkbook();
      const fileName = `${tenantId.toUpperCase()}_Monthly_Archive_${monthDateRange.year}_${String(monthDateRange.month).padStart(2, '0')}.xlsx`;

      // Convert workbook to array buffer and Blob
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Upload to Firebase Storage
      const { fileUrl, storagePath } = await uploadArchiveExcelToStorage(tenantId, fileName, blob);

      // Save metadata to Firestore collection 'monthly_archives'
      await createMonthlyArchive({
        tenantId,
        year: monthDateRange.year,
        month: monthDateRange.month,
        monthKey: selectedMonth,
        monthLabel: monthDateRange.monthLabel,
        fileName,
        fileUrl,
        storagePath,
        orderCount: orderLevelSummaries.length,
        scheduleCount: flattenedMonthlyData.length,
        totalPlannedVolume: kpiStats.totalPlanned,
        totalActualVolume: kpiStats.totalActual,
        variance: kpiStats.variance,
        targetMetPercent: Number(kpiStats.attainmentPct.toFixed(1)),
        unmetReasonsCount: kpiStats.shortfallCount,
        createdBy: operatorName
      });

      queryClient.invalidateQueries({ queryKey: ['monthlyArchives', tenantId] });
      setArchiveModalOpen(false);
      showToast(`Successfully archived ${monthDateRange.monthLabel} Excel to Cloud Storage!`, 'success');
      setActiveTab(2); // Switch to Cloud Archives Vault
    } catch (err: any) {
      showToast(`Error archiving to Cloud Storage: ${err.message}`, 'error');
    } finally {
      setArchivingInProgress(false);
    }
  };

  // Delete Archive from Cloud
  const deleteArchiveMutation = useMutation({
    mutationFn: async (archive: MonthlyArchive) => {
      await deleteMonthlyArchive(archive.id, archive.storagePath);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyArchives', tenantId] });
      showToast('Archived Excel removed from Cloud Storage.', 'info');
    },
    onError: (err: any) => showToast(`Failed to delete archive: ${err.message}`, 'error')
  });

  return (
    <Box sx={{ py: 1, maxWidth: 1600, margin: '0 auto' }}>
      {/* TOP HEADER CARD */}
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
                bgcolor: isToyo ? '#0284c7' : '#4f46e5',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
              }}
            >
              <AssessmentIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', fontFamily: '"Outfit", sans-serif' }}>
                {isToyo ? 'Toyo' : "Riley's"} Monthly Flattened Reports & Cloud Archives
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                Comprehensive reconciliation of planned vs actual volumes, shortfall reasons, and persistent cloud Excel archives.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Download Flattened Excel Button */}
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadExcel}
            disabled={flattenedMonthlyData.length === 0}
            sx={{
              borderRadius: '10px',
              fontWeight: 700,
              textTransform: 'none',
              color: '#334155',
              borderColor: '#cbd5e1'
            }}
          >
            Download Flattened Excel
          </Button>

          {/* Cloud Archive Action Button */}
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => setArchiveModalOpen(true)}
            disabled={flattenedMonthlyData.length === 0}
            sx={{
              borderRadius: '10px',
              fontWeight: 700,
              textTransform: 'none',
              bgcolor: isToyo ? '#0284c7' : '#4f46e5',
              '&:hover': { bgcolor: isToyo ? '#0369a1' : '#4338ca' }
            }}
          >
            Archive Month to Cloud
          </Button>
        </Stack>
      </Paper>

      {/* CONTROLS BAR: MONTH / PAST MONTH ARCHIVE SELECTOR & RANGE */}
      <Card sx={{ mb: 3, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="month-select-label">Select Operations Month</InputLabel>
                <Select
                  labelId="month-select-label"
                  label="Select Operations Month"
                  value={selectedMonth}
                  onChange={(e) => {
                    const mKey = e.target.value;
                    setSelectedMonth(mKey);
                    setActiveMonthArchive(mKey === currentMonthKey ? null : mKey);
                    setUseCustomRange(false);
                  }}
                >
                  {pastMonthsList.map((m) => (
                    <MenuItem key={m.key} value={m.key}>
                      {m.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 2 }}>
              <Button
                size="small"
                variant={useCustomRange ? 'contained' : 'outlined'}
                onClick={() => setUseCustomRange(!useCustomRange)}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, width: '100%', height: 38 }}
              >
                {useCustomRange ? 'Using Custom Range' : 'Custom Date Range'}
              </Button>
            </Grid>

            {useCustomRange && (
              <>
                <Grid size={{ xs: 6, sm: 2, md: 2 }}>
                  <TextField
                    label="From Date"
                    type="date"
                    size="small"
                    fullWidth
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2, md: 2 }}>
                  <TextField
                    label="To Date"
                    type="date"
                    size="small"
                    fullWidth
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </>
            )}

            <Grid size={{ xs: 12, sm: useCustomRange ? 12 : 4, md: useCustomRange ? 3 : 7 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, gap: 1.5, flexWrap: 'wrap' }}>
                <Chip
                  icon={<CalendarMonthIcon sx={{ fontSize: '15px !important' }} />}
                  label={`Period: ${effectiveStartDate} → ${effectiveEndDate}`}
                  size="small"
                  sx={{ fontWeight: 700, bgcolor: '#f1f5f9', color: '#334155' }}
                />
                {selectedMonth !== currentMonthKey && (
                  <Chip
                    label="Past Month Archive"
                    size="small"
                    sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 800 }}
                  />
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* KPI RIBBON */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Planned Volume
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                {kpiStats.totalPlanned.toLocaleString()}{' '}
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>units</span>
              </Typography>
              <Typography variant="caption" sx={{ color: '#4f46e5', fontWeight: 600, display: 'block', mt: 0.5 }}>
                Across {kpiStats.totalSchedules} daily schedule slots
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Actual Output
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#16a34a', mt: 0.5 }}>
                {kpiStats.totalActual.toLocaleString()}{' '}
                <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 500 }}>units produced</span>
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.round(kpiStats.attainmentPct))}
                  sx={{ height: 6, borderRadius: 3, flex: 1, bgcolor: '#e2e8f0' }}
                  color={kpiStats.attainmentPct >= 95 ? 'success' : kpiStats.attainmentPct >= 80 ? 'primary' : 'warning'}
                />
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  {kpiStats.attainmentPct.toFixed(1)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Volume Variance
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: kpiStats.variance >= 0 ? '#16a34a' : '#dc2626', mt: 0.5 }}>
                {kpiStats.variance >= 0 ? '+' : ''}{kpiStats.variance.toLocaleString()}{' '}
                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>units</span>
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                {kpiStats.metCount} Met (100%+) • {kpiStats.shortfallCount} Shortfall/Unrun
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Downtime & Lost Units
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#b45309', mt: 0.5 }}>
                {kpiStats.totalDowntime.toLocaleString()}{' '}
                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>mins</span>
              </Typography>
              <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 700, display: 'block', mt: 0.5 }}>
                {kpiStats.totalLostUnits.toLocaleString()} units lost across incidents
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* TABS HEADER */}
      <Box sx={{ borderBottom: 1, borderColor: '#e2e8f0', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: '0.92rem',
              textTransform: 'none',
              minHeight: 48,
              gap: 1
            }
          }}
        >
          <Tab
            icon={<TableViewIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Flattened Daily Reconciliation (${flattenedMonthlyData.length})`}
          />
          <Tab
            icon={<AssignmentTurnedInIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Order-Level Fulfillment (${orderLevelSummaries.length})`}
          />
          <Tab
            icon={<CloudDoneIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Cloud Archives Vault (${monthlyArchives.length} Excels)`}
          />
        </Tabs>
      </Box>

      {/* TAB 0: FLATTENED DAILY RECONCILIATION */}
      {activeTab === 0 && (
        <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          <CardContent sx={{ p: 2.5 }}>
            {/* Filter Toolbar */}
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search order, product, machine, reasons..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      )
                    }
                  }}
                  sx={{ bgcolor: '#ffffff', minWidth: 280 }}
                />

                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Target Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Target Status"
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    <MenuItem value="MET">✓ Met (100%+)</MenuItem>
                    <MenuItem value="PARTIAL">⚠️ Partial (80-99%)</MenuItem>
                    <MenuItem value="SHORTFALL">❌ Shortfall (&lt;80%)</MenuItem>
                    <MenuItem value="NO_OUTPUT">⚪ No Output</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                Showing {filteredFlattenedRows.length} of {flattenedMonthlyData.length} records
              </Typography>
            </Box>

            {/* Table Container */}
            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow sx={{ '& th': { fontWeight: 800, color: '#0f172a', py: 1.2, fontSize: '0.78rem' } }}>
                    <TableCell sx={{ width: 45, textAlign: 'center' }}>#</TableCell>
                    <TableCell sx={{ width: 105 }}>Run Date</TableCell>
                    <TableCell sx={{ width: 130 }}>Order Number</TableCell>
                    <TableCell sx={{ width: 160 }}>Product</TableCell>
                    <TableCell sx={{ width: 130 }}>{isToyo ? 'Section' : 'Category'}</TableCell>
                    <TableCell sx={{ width: 110 }}>Machine</TableCell>
                    <TableCell sx={{ width: 105, textAlign: 'right' }}>Plan Target</TableCell>
                    <TableCell sx={{ width: 105, textAlign: 'right' }}>Actual Output</TableCell>
                    <TableCell sx={{ width: 95, textAlign: 'right' }}>Variance</TableCell>
                    <TableCell sx={{ width: 110, textAlign: 'center' }}>Status</TableCell>
                    <TableCell sx={{ width: 85, textAlign: 'right' }}>Downtime</TableCell>
                    <TableCell>Unmet Target Reasons & Root Causes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingLogs ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : filteredFlattenedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 6, color: '#64748b' }}>
                        No schedule or output records found for this period filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFlattenedRows.map((r, idx) => (
                      <TableRow key={r.key} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell align="center" sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                          {idx + 1}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
                          {r.dateStr}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>
                          {r.orderNumber}
                        </TableCell>
                        <TableCell sx={{ color: '#475569', fontSize: '0.8rem' }}>
                          {r.productName}
                        </TableCell>
                        <TableCell sx={{ color: '#64748b', fontSize: '0.78rem' }}>
                          {r.groupName}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#4338ca', fontSize: '0.8rem' }}>
                          {r.machineCode}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                          {r.plannedDailyVolume.toLocaleString()} u
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: r.actualVolume > 0 ? '#166534' : '#94a3b8', fontSize: '0.82rem' }}>
                          {r.actualVolume.toLocaleString()} u
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: r.variance >= 0 ? '#16a34a' : '#dc2626', fontSize: '0.8rem' }}>
                          {r.variance >= 0 ? '+' : ''}{r.variance.toLocaleString()} u
                        </TableCell>
                        <TableCell align="center">
                          {r.status === 'MET' && (
                            <Chip size="small" label={`✓ Met (${r.fulfillmentPercent.toFixed(0)}%)`} sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 800, fontSize: '0.7rem' }} />
                          )}
                          {r.status === 'PARTIAL' && (
                            <Chip size="small" label={`⚠️ ${r.fulfillmentPercent.toFixed(0)}%`} sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: '0.7rem' }} />
                          )}
                          {r.status === 'SHORTFALL' && (
                            <Chip size="small" label={`Shortfall (${r.fulfillmentPercent.toFixed(0)}%)`} sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 800, fontSize: '0.7rem' }} />
                          )}
                          {r.status === 'NO_OUTPUT' && (
                            <Chip size="small" label="No Run" sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: '0.7rem' }} />
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ color: r.downtimeMinutes > 0 ? '#b45309' : '#94a3b8', fontWeight: 700, fontSize: '0.78rem' }}>
                          {r.downtimeMinutes > 0 ? `${r.downtimeMinutes}m` : '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.78rem', color: r.unmetReasonsText ? '#b45309' : '#94a3b8' }}>
                          {r.unmetReasonsText || '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* TAB 1: ORDER-LEVEL FULFILLMENT */}
      {activeTab === 1 && (
        <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          <CardContent sx={{ p: 2.5 }}>
            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow sx={{ '& th': { fontWeight: 800, color: '#0f172a', py: 1.2, fontSize: '0.78rem' } }}>
                    <TableCell sx={{ width: 45, textAlign: 'center' }}>#</TableCell>
                    <TableCell sx={{ width: 140 }}>Order Number</TableCell>
                    <TableCell sx={{ width: 220 }}>Product Name</TableCell>
                    <TableCell sx={{ width: 150 }}>{isToyo ? 'Section' : 'Category'}</TableCell>
                    <TableCell sx={{ width: 130, textAlign: 'right' }}>Total Target</TableCell>
                    <TableCell sx={{ width: 130, textAlign: 'right' }}>Month Planned</TableCell>
                    <TableCell sx={{ width: 130, textAlign: 'right' }}>Month Produced</TableCell>
                    <TableCell sx={{ width: 120, textAlign: 'right' }}>Variance</TableCell>
                    <TableCell sx={{ width: 180 }}>Fulfillment %</TableCell>
                    <TableCell sx={{ width: 110, textAlign: 'center' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orderLevelSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 6, color: '#64748b' }}>
                        No orders scheduled in the selected month.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orderLevelSummaries.map((o, idx) => (
                      <TableRow key={o.orderId} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell align="center" sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                          {idx + 1}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>
                          {o.orderNumber}
                        </TableCell>
                        <TableCell sx={{ color: '#475569', fontSize: '0.8rem' }}>
                          {o.productName}
                        </TableCell>
                        <TableCell sx={{ color: '#64748b', fontSize: '0.78rem' }}>
                          {o.groupName}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                          {o.totalTargetVolume.toLocaleString()} u
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#4f46e5', fontSize: '0.82rem' }}>
                          {o.monthPlannedVolume.toLocaleString()} u
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: '#166534', fontSize: '0.82rem' }}>
                          {o.monthActualVolume.toLocaleString()} u
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: o.monthVariance >= 0 ? '#16a34a' : '#dc2626', fontSize: '0.8rem' }}>
                          {o.monthVariance >= 0 ? '+' : ''}{o.monthVariance.toLocaleString()} u
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, Math.round(o.fulfillmentRate))}
                              sx={{ height: 6, borderRadius: 3, flex: 1, bgcolor: '#e2e8f0' }}
                              color={o.fulfillmentRate >= 95 ? 'success' : o.fulfillmentRate >= 80 ? 'primary' : 'warning'}
                            />
                            <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a', minWidth: 42 }}>
                              {o.fulfillmentRate.toFixed(1)}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={o.status}
                            sx={{
                              bgcolor: o.status === 'COMPLETED' ? '#dcfce7' : o.status === 'SCHEDULED' ? '#e0e7ff' : '#f1f5f9',
                              color: o.status === 'COMPLETED' ? '#166534' : o.status === 'SCHEDULED' ? '#3730a3' : '#475569',
                              fontWeight: 800,
                              fontSize: '0.68rem'
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: CLOUD ARCHIVES VAULT */}
      {activeTab === 2 && (
        <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CloudDoneIcon sx={{ color: '#10b981' }} />
                  Cloud Storage Monthly Excels Vault ({monthlyArchives.length} Archived Files)
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Persistent monthly Excel snapshots stored in Firebase Storage. Download anytime for auditing and historical access.
                </Typography>
              </Box>

              <Button
                variant="contained"
                size="small"
                startIcon={<CloudUploadIcon />}
                onClick={() => setArchiveModalOpen(true)}
                sx={{ borderRadius: '8px', fontWeight: 700, textTransform: 'none' }}
              >
                Archive Current Month Now
              </Button>
            </Box>

            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow sx={{ '& th': { fontWeight: 800, color: '#0f172a', py: 1.2, fontSize: '0.78rem' } }}>
                    <TableCell sx={{ width: 45, textAlign: 'center' }}>#</TableCell>
                    <TableCell sx={{ width: 140 }}>Month & Year</TableCell>
                    <TableCell sx={{ width: 280 }}>Archived Excel File Name</TableCell>
                    <TableCell sx={{ width: 100, textAlign: 'center' }}>Orders</TableCell>
                    <TableCell sx={{ width: 100, textAlign: 'center' }}>Schedules</TableCell>
                    <TableCell sx={{ width: 120, textAlign: 'right' }}>Planned Vol</TableCell>
                    <TableCell sx={{ width: 120, textAlign: 'right' }}>Actual Vol</TableCell>
                    <TableCell sx={{ width: 110, textAlign: 'center' }}>Attainment %</TableCell>
                    <TableCell sx={{ width: 130 }}>Archived By</TableCell>
                    <TableCell align="center" sx={{ width: 140 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingArchives ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : monthlyArchives.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 6, color: '#64748b' }}>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#334155' }}>
                          No monthly archives stored yet in Cloud Storage.
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
                          Click "Archive Month to Cloud" to generate and store your first monthly operations workbook.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyArchives.map((arch, idx) => (
                      <TableRow key={arch.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell align="center" sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                          {idx + 1}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>
                          {arch.monthLabel}
                        </TableCell>
                        <TableCell sx={{ color: '#4338ca', fontWeight: 600, fontSize: '0.8rem' }}>
                          {arch.fileName}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {arch.orderCount}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {arch.scheduleCount}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {arch.totalPlannedVolume.toLocaleString()} u
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: '#166534', fontSize: '0.8rem' }}>
                          {arch.totalActualVolume.toLocaleString()} u
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={`${arch.targetMetPercent}%`}
                            sx={{
                              bgcolor: arch.targetMetPercent >= 95 ? '#dcfce7' : arch.targetMetPercent >= 80 ? '#e0e7ff' : '#fee2e2',
                              color: arch.targetMetPercent >= 95 ? '#166534' : arch.targetMetPercent >= 80 ? '#3730a3' : '#991b1b',
                              fontWeight: 800,
                              fontSize: '0.7rem'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {arch.createdBy}
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<DownloadIcon sx={{ fontSize: '14px !important' }} />}
                              onClick={() => {
                                if (arch.fileUrl) {
                                  window.open(arch.fileUrl, '_blank');
                                } else {
                                  showToast('Download URL unavailable', 'error');
                                }
                              }}
                              sx={{ borderRadius: '6px', fontSize: '0.72rem', textTransform: 'none', fontWeight: 700, py: 0.3 }}
                            >
                              Download
                            </Button>
                            <Tooltip title="Delete Archive from Cloud Storage">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  if (confirm(`Permanently delete archive for ${arch.monthLabel}?`)) {
                                    deleteArchiveMutation.mutate(arch);
                                  }
                                }}
                              >
                                <DeleteForeverIcon sx={{ fontSize: 17, color: '#ef4444' }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* DIALOG: CONFIRM ARCHIVE TO CLOUD */}
      <Dialog
        open={archiveModalOpen}
        onClose={() => !archivingInProgress && setArchiveModalOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px' } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUploadIcon sx={{ color: '#4f46e5' }} />
          Archive {monthDateRange.monthLabel} to Cloud Storage?
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            This process compiles all production orders, schedules, actual outputs, downtime records, and shortfall root causes for{' '}
            <strong>{monthDateRange.monthLabel}</strong> ({isToyo ? 'Toyo Manufacturing' : "Riley's"}).
          </Typography>

          <Paper sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', mb: 1 }}>
              Archive Contents Summary:
            </Typography>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" sx={{ color: '#0f172a' }}>
                  • <strong>{orderLevelSummaries.length}</strong> Orders
                </Typography>
                <Typography variant="body2" sx={{ color: '#0f172a' }}>
                  • <strong>{flattenedMonthlyData.length}</strong> Daily Slots
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" sx={{ color: '#0f172a' }}>
                  • <strong>{kpiStats.totalPlanned.toLocaleString()} u</strong> Planned
                </Typography>
                <Typography variant="body2" sx={{ color: '#16a34a', fontWeight: 700 }}>
                  • <strong>{kpiStats.totalActual.toLocaleString()} u</strong> Actual Produced
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          <Typography variant="caption" sx={{ color: '#64748b' }}>
            The generated Excel will be stored under <code>archives/{tenantId}/</code> in Firebase Cloud Storage with public download access for authorised team members.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button
            onClick={() => setArchiveModalOpen(false)}
            disabled={archivingInProgress}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRunMonthlyArchival}
            disabled={archivingInProgress}
            sx={{
              bgcolor: '#4f46e5',
              '&:hover': { bgcolor: '#4338ca' },
              fontWeight: 700,
              textTransform: 'none',
              px: 2.5
            }}
          >
            {archivingInProgress ? <CircularProgress size={20} color="inherit" /> : 'Confirm & Upload to Cloud'}
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

export default MonthlyReports;
