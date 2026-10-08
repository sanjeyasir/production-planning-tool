import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  toLocalDateString,
  parseLocalDate
} from '../../services/db';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Snackbar,
  Alert,
  Stack,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material';

// Icons
import FlagIcon from '@mui/icons-material/Flag';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import DateRangeIcon from '@mui/icons-material/DateRange';
import TableViewIcon from '@mui/icons-material/TableView';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// Handsontable
import { HotTable } from '@handsontable/react';
import * as XLSX from 'xlsx';

export const FactoryCalendar: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';

  // File input ref for Excel import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: holidays = [], isLoading: loadingHolidays } = useQuery({
    queryKey: ['holidays', tenantId],
    queryFn: () => getHolidays(tenantId),
    enabled: !!tenantId,
  });

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

  // Date Range Defaults: "This Month"
  const defaultMonthRange = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: toLocalDateString(firstDay),
      to: toLocalDateString(lastDay)
    };
  }, []);

  const [fromDateStr, setFromDateStr] = useState<string>(defaultMonthRange.from);
  const [toDateStr, setToDateStr] = useState<string>(defaultMonthRange.to);
  const [activePreset, setActivePreset] = useState<'this_month' | 'next_month' | 'year' | 'all'>('this_month');
  const [searchTerm, setSearchTerm] = useState('');

  // Single Holiday Entry Form
  const [holidayForm, setHolidayForm] = useState({
    dateStr: toLocalDateString(new Date()),
    name: ''
  });

  // Bulk Upload Preview State
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [parsedUploadHolidays, setParsedUploadHolidays] = useState<{ dateStr: string; name: string }[]>([]);
  const [uploadProcessing, setUploadProcessing] = useState(false);

  // Delete Confirmation Modal Popup State
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    id: string;
    name: string;
    dateStr: string;
  }>({
    open: false,
    id: '',
    name: '',
    dateStr: ''
  });

  // Mutations
  const createHolidayMutation = useMutation({
    mutationFn: createHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', tenantId] });
      showToast('Factory holiday registered successfully!');
      setHolidayForm({
        dateStr: toLocalDateString(new Date()),
        name: ''
      });
    },
    onError: (err: any) => showToast('Error adding holiday: ' + err.message, 'error')
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', tenantId] });
      showToast('Holiday deleted successfully.');
      setDeleteModal({ open: false, id: '', name: '', dateStr: '' });
    },
    onError: (err: any) => showToast('Error deleting holiday: ' + err.message, 'error')
  });

  // Presets Handlers
  const handlePresetSelect = (preset: 'this_month' | 'next_month' | 'year' | 'all') => {
    setActivePreset(preset);
    const now = new Date();

    if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFromDateStr(toLocalDateString(firstDay));
      setToDateStr(toLocalDateString(lastDay));
    } else if (preset === 'next_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      setFromDateStr(toLocalDateString(firstDay));
      setToDateStr(toLocalDateString(lastDay));
    } else if (preset === 'year') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      setFromDateStr(toLocalDateString(firstDay));
      setToDateStr(toLocalDateString(lastDay));
    } else {
      setFromDateStr('');
      setToDateStr('');
    }
  };

  // Filtered Holidays by From/To Date Range & Search Term
  const filteredHolidays = useMemo(() => {
    const list = [...holidays].sort((a, b) => {
      const d1 = a.dateStr || toLocalDateString(a.date);
      const d2 = b.dateStr || toLocalDateString(b.date);
      return d1.localeCompare(d2);
    });

    return list.filter(h => {
      const dStr = h.dateStr || toLocalDateString(h.date);
      
      // Date Range filter
      if (fromDateStr && dStr < fromDateStr) return false;
      if (toDateStr && dStr > toDateStr) return false;

      // Search keyword filter
      if (searchTerm.trim()) {
        const match = searchTerm.toLowerCase();
        const name = (h.name || '').toLowerCase();
        if (!dStr.includes(match) && !name.includes(match)) return false;
      }

      return true;
    });
  }, [holidays, fromDateStr, toDateStr, searchTerm]);

  // Handsontable Data Format
  const hotData = useMemo(() => {
    return filteredHolidays.map((h, index) => {
      const dStr = h.dateStr || toLocalDateString(h.date);
      const d = parseLocalDate(dStr);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

      return {
        rowNum: index + 1,
        id: h.id,
        dateStr: dStr,
        name: h.name,
        dayOfWeek: dayName,
        action: 'DELETE',
      };
    });
  }, [filteredHolidays]);

  // Handsontable In-Place Cell Edit & Auto-Save Handler
  const handleAfterChange = async (changes: any[] | null, source: string) => {
    if (source === 'loadData' || !changes || changes.length === 0) return;

    for (const [row, prop, oldValue, newValue] of changes) {
      if (oldValue === newValue) continue;
      const rowData = hotData[row];
      if (!rowData || !rowData.id) continue;

      try {
        if (prop === 'dateStr') {
          const newDateStr = String(newValue || '').trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) {
            await updateHoliday(rowData.id, { date: newDateStr });
            queryClient.invalidateQueries({ queryKey: ['holidays', tenantId] });
            showToast(`Holiday date updated to ${newDateStr} & autosaved!`, 'success');
          } else {
            showToast('Invalid date format. Please use YYYY-MM-DD.', 'warning');
          }
        } else if (prop === 'name') {
          const newName = String(newValue || '').trim();
          if (newName) {
            await updateHoliday(rowData.id, { name: newName });
            queryClient.invalidateQueries({ queryKey: ['holidays', tenantId] });
            showToast(`Holiday occasion updated to "${newName}" & autosaved!`, 'success');
          }
        }
      } catch (err: any) {
        showToast(`Failed to autosave changes: ${err.message}`, 'error');
      }
    }
  };

  // Handle single manual addition
  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name.trim()) {
      showToast('Please enter a holiday occasion name', 'warning');
      return;
    }

    const existing = holidays.find(h => (h.dateStr || toLocalDateString(h.date)) === holidayForm.dateStr);
    if (existing) {
      showToast(`A holiday is already scheduled on ${holidayForm.dateStr} (${existing.name})`, 'warning');
      return;
    }

    createHolidayMutation.mutate({
      tenantId,
      date: parseLocalDate(holidayForm.dateStr),
      name: holidayForm.name.trim()
    });
  };

  // Export holidays to Excel
  const handleExportExcel = () => {
    if (filteredHolidays.length === 0) {
      showToast('No holidays in current date range to export', 'warning');
      return;
    }

    const exportData = filteredHolidays.map(h => {
      const dStr = h.dateStr || toLocalDateString(h.date);
      const d = parseLocalDate(dStr);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      return {
        'Holiday Date': dStr,
        'Occasion / Holiday Name': h.name,
        'Day of Week': dayName,
        'Calendar Status': 'Non-Working Factory Day'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Factory Holidays');
    XLSX.writeFile(wb, `Factory_Holidays_${fromDateStr || 'All'}_to_${toDateStr || 'All'}.xlsx`);
    showToast('Factory holidays exported successfully!');
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      { 'Holiday Date': '2026-10-11', 'Holiday Name': 'Poya Day / National Holiday' },
      { 'Holiday Date': '2026-10-25', 'Holiday Name': 'Scheduled Plant Maintenance Shutdown' },
      { 'Holiday Date': '2026-12-25', 'Holiday Name': 'Christmas Day' },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, 'Holidays Template');
    XLSX.writeFile(wb, 'Factory_Holidays_Upload_Template.xlsx');
    showToast('Sample upload template downloaded!');
  };

  // Handle Excel file selection & parse
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const binaryStr = evt.target?.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!jsonData || jsonData.length === 0) {
          showToast('The uploaded file contains no data rows.', 'warning');
          return;
        }

        const parsedList: { dateStr: string; name: string }[] = [];
        const seenDates = new Set<string>();

        jsonData.forEach((row) => {
          const rawDate = row['Holiday Date'] || row['Date'] || row['date'] || row['holiday date'] || row['HOLIDAY DATE'];
          const rawName = row['Holiday Name'] || row['Occasion'] || row['Name'] || row['name'] || row['occasion'] || row['HOLIDAY NAME'];

          if (!rawDate) return;

          let dateStr = '';
          if (rawDate instanceof Date) {
            dateStr = toLocalDateString(rawDate);
          } else if (typeof rawDate === 'string') {
            const cleanStr = rawDate.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
              dateStr = cleanStr;
            } else {
              const d = new Date(cleanStr);
              if (!isNaN(d.getTime())) {
                dateStr = toLocalDateString(d);
              }
            }
          } else if (typeof rawDate === 'number') {
            const parsedD = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
            if (!isNaN(parsedD.getTime())) {
              dateStr = toLocalDateString(parsedD);
            }
          }

          const holidayName = String(rawName || `Holiday on ${dateStr}`).trim();

          if (dateStr && !seenDates.has(dateStr)) {
            seenDates.add(dateStr);
            parsedList.push({ dateStr, name: holidayName });
          }
        });

        if (parsedList.length === 0) {
          showToast('Could not find valid dates. Please ensure column "Holiday Date" exists in format YYYY-MM-DD.', 'error');
          return;
        }

        setParsedUploadHolidays(parsedList);
        setIsUploadDialogOpen(true);
      } catch (err: any) {
        showToast('Error reading Excel file: ' + err.message, 'error');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  // Confirm and batch import parsed holidays
  const handleConfirmImport = async () => {
    if (parsedUploadHolidays.length === 0) return;

    setUploadProcessing(true);
    let addedCount = 0;
    let skippedCount = 0;

    try {
      const existingDateMap = new Set(holidays.map(h => h.dateStr || toLocalDateString(h.date)));

      for (const item of parsedUploadHolidays) {
        if (existingDateMap.has(item.dateStr)) {
          skippedCount++;
        } else {
          await createHoliday({
            tenantId,
            date: parseLocalDate(item.dateStr),
            name: item.name
          });
          existingDateMap.add(item.dateStr);
          addedCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['holidays', tenantId] });
      setIsUploadDialogOpen(false);
      setParsedUploadHolidays([]);

      showToast(
        `Import Complete: ${addedCount} holidays added${skippedCount > 0 ? `, ${skippedCount} duplicate dates skipped` : ''}!`,
        'success'
      );
    } catch (err: any) {
      showToast('Error saving bulk holidays: ' + err.message, 'error');
    } finally {
      setUploadProcessing(false);
    }
  };

  return (
    <Box sx={{ py: 1 }}>
      {/* Hidden File Input for Excel Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".xlsx, .xls, .csv"
        style={{ display: 'none' }}
      />

      {/* Header & Main Actions */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlagIcon sx={{ color: '#8b5cf6' }} />
            Factory Calendar & Non-Working Days Master
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<FileDownloadIcon />}
            onClick={handleDownloadTemplate}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.825rem' }}
          >
            Sample Template
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.825rem' }}
          >
            Upload Excel
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleExportExcel}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.825rem' }}
          >
            Export Excel
          </Button>
        </Stack>
      </Box>

      {/* SECTION 1: TOP FULL-WIDTH VERTICAL ENTRY CARD */}
      <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventAvailableIcon sx={{ color: '#8b5cf6' }} />
            Register Single Factory Holiday
          </Typography>

          <form onSubmit={handleAddHoliday}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
              <TextField
                label="Holiday Date"
                type="date"
                size="small"
                required
                sx={{ width: { xs: '100%', sm: 220 } }}
                slotProps={{ inputLabel: { shrink: true } }}
                value={holidayForm.dateStr}
                onChange={(e) => setHolidayForm({ ...holidayForm, dateStr: e.target.value })}
              />

              <TextField
                label="Occasion / Holiday Name"
                placeholder="e.g. National Poya Day / Factory Annual Maintenance"
                size="small"
                required
                fullWidth
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              />

              <Button
                type="submit"
                variant="contained"
                color="secondary"
                startIcon={<AddIcon />}
                disabled={createHolidayMutation.isPending}
                sx={{
                  borderRadius: '8px',
                  fontWeight: 700,
                  px: 3,
                  py: 0.9,
                  whiteSpace: 'nowrap',
                  textTransform: 'none'
                }}
              >
                {createHolidayMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Add Holiday'}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>

      {/* SECTION 2: FROM-TO DATE RANGE FILTER CONTROLS */}
      <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <DateRangeIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                Filter Range:
              </Typography>
              <Chip
                label="This Month"
                size="small"
                clickable
                onClick={() => handlePresetSelect('this_month')}
                color={activePreset === 'this_month' ? 'primary' : 'default'}
                sx={{ fontWeight: 700, borderRadius: '8px' }}
              />
              <Chip
                label="Next Month"
                size="small"
                clickable
                onClick={() => handlePresetSelect('next_month')}
                color={activePreset === 'next_month' ? 'primary' : 'default'}
                sx={{ fontWeight: 700, borderRadius: '8px' }}
              />
              <Chip
                label="Full Year"
                size="small"
                clickable
                onClick={() => handlePresetSelect('year')}
                color={activePreset === 'year' ? 'primary' : 'default'}
                sx={{ fontWeight: 700, borderRadius: '8px' }}
              />
              <Chip
                label="All Time"
                size="small"
                clickable
                onClick={() => handlePresetSelect('all')}
                color={activePreset === 'all' ? 'primary' : 'default'}
                sx={{ fontWeight: 700, borderRadius: '8px' }}
              />
            </Box>

            {/* From - To Date Pickers */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                label="From Date"
                type="date"
                size="small"
                sx={{ width: 170 }}
                slotProps={{ inputLabel: { shrink: true } }}
                value={fromDateStr}
                onChange={(e) => {
                  setFromDateStr(e.target.value);
                  setActivePreset('all');
                }}
              />
              <ArrowForwardIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
              <TextField
                label="To Date"
                type="date"
                size="small"
                sx={{ width: 170 }}
                slotProps={{ inputLabel: { shrink: true } }}
                value={toDateStr}
                onChange={(e) => {
                  setToDateStr(e.target.value);
                  setActivePreset('all');
                }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* SECTION 3: HANDSONTABLE SPREADSHEET VIEW */}
      <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ pb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TableViewIcon sx={{ color: '#8b5cf6' }} />
                  Factory Holidays Directory
                </Typography>
                <Chip
                  icon={<CloudDoneIcon sx={{ fontSize: '15px !important', color: '#16a34a' }} />}
                  label="In-place edit • Auto-saves instantly"
                  size="small"
                  sx={{ bgcolor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 600, fontSize: '0.75rem' }}
                />
              </Stack>
            </Box>

            <TextField
              placeholder="Search in grid..."
              size="small"
              sx={{ width: { xs: '100%', sm: 260 } }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          {/* Handsontable Grid Container */}
          <Box
            sx={{
              width: '100%',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              '& .handsontable': {
                fontFamily: 'inherit',
                fontSize: '0.85rem'
              },
              '& .htCore th': {
                bgcolor: '#f8fafc',
                color: '#0f172a',
                fontWeight: 700,
                py: 1.2
              },
              '& .htCore td': {
                py: 1,
                color: '#334155'
              }
            }}
          >
            {loadingHolidays ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : hotData.length > 0 ? (
              <HotTable
                data={hotData}
                colHeaders={['#', 'Holiday Date', 'Occasion / Holiday Description', 'Day of Week', 'Action']}
                columns={[
                  { data: 'rowNum', readOnly: true, width: 45, className: 'htCenter htMiddle' },
                  {
                    data: 'dateStr',
                    type: 'date',
                    dateFormat: 'YYYY-MM-DD' as any,
                    correctFormat: true,
                    datePickerConfig: {
                      firstDay: 1,
                      showWeekNumber: true,
                      numberOfMonths: 1
                    } as any,
                    width: 170,
                    className: 'htCenter htMiddle'
                  },
                  { data: 'name', type: 'text', width: 280, className: 'htMiddle' },
                  { data: 'dayOfWeek', readOnly: true, width: 140, className: 'htCenter htMiddle' },
                  {
                    data: 'action',
                    readOnly: true,
                    width: 100,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement) => {
                      td.innerHTML = '<button type="button" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 6px; padding: 4px 12px; font-weight: 700; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">Delete</button>';
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  }
                ]}
                afterChange={handleAfterChange}
                afterOnCellMouseDown={(event: any, coords: any) => {
                  if (coords.col === 4 && coords.row >= 0) {
                    event.stopImmediatePropagation();
                    const rowData = hotData[coords.row];
                    if (rowData && rowData.id) {
                      setDeleteModal({
                        open: true,
                        id: rowData.id,
                        name: rowData.name,
                        dateStr: rowData.dateStr
                      });
                    }
                  }
                }}
                rowHeaders={true}
                height="auto"
                width="100%"
                colWidths={[45, 170, 280, 140, 100]}
                stretchH="all"
                autoWrapRow={true}
                autoWrapCol={true}
                columnSorting={true}
                filters={true}
                dropdownMenu={true}
                contextMenu={['copy']}
                licenseKey="non-commercial-and-evaluation"
              />
            ) : (
              <Box sx={{ py: 6, textAlign: 'center', color: '#64748b' }}>
                No factory holidays found for this month / date range. Add one above or select "Full Year" / "All Time".
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* CONFIRM DELETE MODAL POPUP (NOT BROWSER ALERT) */}
      <Dialog
        open={deleteModal.open}
        onClose={() => !deleteHolidayMutation.isPending && setDeleteModal({ open: false, id: '', name: '', dateStr: '' })}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DeleteForeverIcon sx={{ color: '#dc2626' }} />
          </Box>
          Confirm Holiday Deletion
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6 }}>
            Are you sure you want to permanently delete the holiday <strong>"{deleteModal.name}"</strong> on <strong>{deleteModal.dateStr}</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1 }}>
            This day will be reverted to a normal working day in the production planner.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={() => setDeleteModal({ open: false, id: '', name: '', dateStr: '' })}
            variant="outlined"
            disabled={deleteHolidayMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => deleteHolidayMutation.mutate(deleteModal.id)}
            variant="contained"
            color="error"
            disabled={deleteHolidayMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, px: 2.5 }}
          >
            {deleteHolidayMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Yes, Delete Holiday'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: BULK EXCEL UPLOAD PREVIEW */}
      <Dialog
        open={isUploadDialogOpen}
        onClose={() => !uploadProcessing && setIsUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <UploadFileIcon sx={{ color: '#8b5cf6' }} />
          Confirm Bulk Holidays Import
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Found <strong>{parsedUploadHolidays.length}</strong> holiday entries from your uploaded Excel sheet. Review before importing:
          </Typography>

          <Paper sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Occasion / Holiday Name</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsedUploadHolidays.map((row, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontWeight: 700, color: '#7c3aed' }}>{row.dateStr}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setIsUploadDialogOpen(false)}
            variant="outlined"
            disabled={uploadProcessing}
            sx={{ borderRadius: '8px' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmImport}
            variant="contained"
            color="secondary"
            disabled={uploadProcessing}
            sx={{ borderRadius: '8px', fontWeight: 700 }}
          >
            {uploadProcessing ? <CircularProgress size={22} color="inherit" /> : `Import ${parsedUploadHolidays.length} Holidays`}
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

export default FactoryCalendar;
