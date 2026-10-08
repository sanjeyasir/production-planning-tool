import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getProductionCategories,
  getProductionOrders,
  createProductionOrder,
  updateProductionOrder,
  deleteProductionOrder,
  toLocalDateString,
  parseLocalDate,
  type ProductionOrder
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
  InputAdornment,
  Grid
} from '@mui/material';

// Icons
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import SearchIcon from '@mui/icons-material/Search';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import TableViewIcon from '@mui/icons-material/TableView';

// Handsontable, XLSX & ExcelJS
import { HotTable } from '@handsontable/react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export const ProductionOrders: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper date ranges
  const getThisWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diffToMon);
    const sunday = new Date(now.getFullYear(), now.getMonth(), diffToMon + 6);
    return {
      start: toLocalDateString(monday),
      end: toLocalDateString(sunday)
    };
  };

  const getThisMonthRange = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: toLocalDateString(first),
      end: toLocalDateString(last)
    };
  };

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ['productionCategories', tenantId],
    queryFn: () => getProductionCategories(tenantId),
    enabled: !!tenantId,
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['productionOrders', tenantId],
    queryFn: () => getProductionOrders(tenantId),
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

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [datePreset, setDatePreset] = useState<'CURRENT_WEEK' | 'THIS_MONTH' | 'ALL_TIME' | 'CUSTOM'>('CURRENT_WEEK');
  const [fromDate, setFromDate] = useState<string>(getThisWeekRange().start);
  const [toDate, setToDate] = useState<string>(getThisWeekRange().end);

  // Modals State
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; order: ProductionOrder | null }>({
    open: false,
    order: null
  });

  // Form State for Create / Edit Order Modal
  const [orderForm, setOrderForm] = useState({
    orderNumber: '',
    productName: '',
    categoryId: '',
    quantity: 1000,
    dueDate: toLocalDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    priority: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
    status: 'PENDING' as 'PENDING' | 'DRAFT_PLANNED' | 'SCHEDULED' | 'COMPLETED',
    notes: ''
  });

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: createProductionOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      setIsOrderDialogOpen(false);
      setEditingOrder(null);
      showToast('Production order created successfully!');
      setOrderForm({
        orderNumber: '',
        productName: '',
        categoryId: categories[0]?.id || '',
        quantity: 1000,
        dueDate: toLocalDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        priority: 'MEDIUM',
        status: 'PENDING',
        notes: ''
      });
    },
    onError: (err: any) => showToast('Error creating order: ' + err.message, 'error')
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateProductionOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      setIsOrderDialogOpen(false);
      setEditingOrder(null);
      showToast('Order updated successfully!');
    },
    onError: (err: any) => showToast('Error updating order: ' + err.message, 'error')
  });

  const deleteOrderMutation = useMutation({
    mutationFn: deleteProductionOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
      setDeleteModal({ open: false, order: null });
      showToast('Order deleted successfully!');
    },
    onError: (err: any) => showToast('Error deleting order: ' + err.message, 'error')
  });

  // Category Maps
  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => {
      map[c.id] = c.name;
    });
    return map;
  }, [categories]);

  const categoryNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => {
      map[c.name.toLowerCase().trim()] = c.id;
    });
    return map;
  }, [categories]);

  // Date Preset Switcher
  const handleApplyPreset = (preset: 'CURRENT_WEEK' | 'THIS_MONTH' | 'ALL_TIME') => {
    setDatePreset(preset);
    if (preset === 'CURRENT_WEEK') {
      const range = getThisWeekRange();
      setFromDate(range.start);
      setToDate(range.end);
    } else if (preset === 'THIS_MONTH') {
      const range = getThisMonthRange();
      setFromDate(range.start);
      setToDate(range.end);
    } else if (preset === 'ALL_TIME') {
      setFromDate('');
      setToDate('');
    }
  };

  // Filtered orders list (Defaults to current week)
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Status Filter
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;

      // 2. Search query Filter
      if (search) {
        const match = search.toLowerCase();
        const num = (o.orderNumber || '').toLowerCase();
        const prod = (o.productName || '').toLowerCase();
        const catName = (categoryMap[o.categoryId] || '').toLowerCase();
        if (!num.includes(match) && !prod.includes(match) && !catName.includes(match)) {
          return false;
        }
      }

      // 3. Date Range Filter
      if (fromDate || toDate) {
        const dueStr = toLocalDateString(o.dueDate);
        if (fromDate && dueStr < fromDate) return false;
        if (toDate && dueStr > toDate) return false;
      }

      return true;
    });
  }, [orders, statusFilter, search, fromDate, toDate, categoryMap]);

  // Handsontable Data Format
  const hotData = useMemo(() => {
    return filteredOrders.map((o, index) => {
      const catName = categoryMap[o.categoryId] || 'General';
      const dueStr = toLocalDateString(o.dueDate);

      return {
        rowNum: index + 1,
        id: o.id,
        orderNumber: o.orderNumber || '',
        productName: o.productName || '',
        category: catName,
        quantity: o.quantity || 0,
        dueDate: dueStr,
        priority: o.priority || 'MEDIUM',
        status: o.status || 'PENDING',
        actions: 'ACTIONS'
      };
    });
  }, [filteredOrders, categoryMap]);

  // Open Create Order Modal
  const handleOpenCreateOrder = () => {
    setEditingOrder(null);
    setOrderForm({
      orderNumber: `ORD-${Math.floor(100 + Math.random() * 900)}`,
      productName: '',
      categoryId: categories[0]?.id || '',
      quantity: 2000,
      dueDate: toLocalDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      priority: 'MEDIUM',
      status: 'PENDING',
      notes: ''
    });
    setIsOrderDialogOpen(true);
  };

  // Open Edit Order Modal
  const handleOpenEditOrder = (order: ProductionOrder) => {
    setEditingOrder(order);
    setOrderForm({
      orderNumber: order.orderNumber,
      productName: order.productName,
      categoryId: order.categoryId || categories[0]?.id || '',
      quantity: order.quantity,
      dueDate: toLocalDateString(order.dueDate),
      priority: order.priority || 'MEDIUM',
      status: (order.status || 'PENDING') as 'PENDING' | 'DRAFT_PLANNED' | 'SCHEDULED' | 'COMPLETED',
      notes: order.notes || ''
    });
    setIsOrderDialogOpen(true);
  };

  // Submit Create / Edit Order Form
  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.orderNumber || !orderForm.productName || !orderForm.categoryId) {
      showToast('Please fill out all required fields', 'warning');
      return;
    }

    if (editingOrder) {
      updateOrderMutation.mutate({
        id: editingOrder.id,
        data: {
          orderNumber: orderForm.orderNumber.trim(),
          productName: orderForm.productName.trim(),
          categoryId: orderForm.categoryId,
          quantity: Number(orderForm.quantity),
          dueDate: parseLocalDate(orderForm.dueDate),
          priority: orderForm.priority,
          status: orderForm.status,
          notes: orderForm.notes.trim()
        }
      });
    } else {
      createOrderMutation.mutate({
        tenantId,
        orderNumber: orderForm.orderNumber.trim(),
        productName: orderForm.productName.trim(),
        categoryId: orderForm.categoryId,
        quantity: Number(orderForm.quantity),
        dueDate: parseLocalDate(orderForm.dueDate),
        status: orderForm.status || 'PENDING',
        priority: orderForm.priority,
        notes: orderForm.notes.trim()
      });
    }
  };

  // Download Sample Excel Template with Real In-Cell Dropdowns (Data Validation)
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Production Planning Tool';
      workbook.created = new Date();

      // Live categories from database
      const activeCategoryNames = categories.length > 0 
        ? categories.map(c => c.name.trim()).filter(Boolean)
        : ['Standard Assembly', 'General'];
      const sampleCategory1 = activeCategoryNames[0] || 'General';
      const sampleCategory2 = activeCategoryNames[1] || activeCategoryNames[0] || 'General';

      // 1. FIRST SHEET: Main Production Orders Template Sheet (Active Primary Tab)
      const worksheet = workbook.addWorksheet('Production_Orders');

      worksheet.columns = [
        { header: 'Order Number', key: 'orderNumber', width: 18 },
        { header: 'Product Name', key: 'productName', width: 34 },
        { header: 'Category', key: 'category', width: 24 },
        { header: 'Quantity', key: 'quantity', width: 16 },
        { header: 'Due Date', key: 'dueDate', width: 18 },
        { header: 'Priority', key: 'priority', width: 16 },
        { header: 'Planning Status', key: 'status', width: 22 },
        { header: 'Notes', key: 'notes', width: 38 }
      ];

      // Header row styling
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4338CA' } // Premium Indigo
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 26;

      // Add Sample Rows
      worksheet.addRow({
        orderNumber: 'ORD-101',
        productName: 'Premium Cotton Crew T-Shirt',
        category: sampleCategory1,
        quantity: 2500,
        dueDate: toLocalDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        priority: 'HIGH',
        status: 'PENDING',
        notes: 'Export shipment for summer campaign'
      });

      worksheet.addRow({
        orderNumber: 'ORD-102',
        productName: 'Slim Fit Pique Polo Shirt',
        category: sampleCategory2,
        quantity: 4000,
        dueDate: toLocalDateString(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
        priority: 'MEDIUM',
        status: 'PENDING',
        notes: 'Standard bulk retail run'
      });

      // 2. SECOND SHEET: Reference Sheet for Dropdowns
      const refSheet = workbook.addWorksheet('Allowed_Options', { state: 'visible' });
      refSheet.columns = [
        { header: 'Allowed Categories', key: 'categories', width: 28 },
        { header: 'Allowed Priorities', key: 'priorities', width: 20 },
        { header: 'Allowed Statuses', key: 'statuses', width: 24 }
      ];

      const refHeaderRow = refSheet.getRow(1);
      refHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      refHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' }
      };

      const priorities = ['HIGH', 'MEDIUM', 'LOW'];
      const statuses = ['PENDING', 'DRAFT_PLANNED', 'SCHEDULED', 'COMPLETED'];
      const maxRows = Math.max(activeCategoryNames.length, priorities.length, statuses.length);

      for (let i = 0; i < maxRows; i++) {
        refSheet.addRow({
          categories: activeCategoryNames[i] || '',
          priorities: priorities[i] || '',
          statuses: statuses[i] || ''
        });
      }

      // Data validation ranges pointing to sheet 'Allowed_Options'
      const categoryRange = `Allowed_Options!$A$2:$A$${activeCategoryNames.length + 1}`;
      const priorityList = '"HIGH,MEDIUM,LOW"';
      const statusList = '"PENDING,DRAFT_PLANNED,SCHEDULED,COMPLETED"';

      // Apply in-cell dropdowns and formatting for rows 2 to 500 on Production_Orders
      for (let r = 2; r <= 500; r++) {
        const row = worksheet.getRow(r);
        row.alignment = { vertical: 'middle' };

        // Category dropdown (Col C / 3)
        row.getCell(3).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [categoryRange],
          showErrorMessage: true,
          errorTitle: 'Invalid Category',
          error: 'Please select a valid category from the dropdown list.'
        };

        // Quantity formatting (Col D / 4)
        row.getCell(4).numFmt = '#,##0';
        row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

        // Due Date formatting (Col E / 5)
        row.getCell(5).numFmt = 'yyyy-mm-dd';
        row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

        // Priority dropdown (Col F / 6)
        row.getCell(6).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [priorityList],
          showErrorMessage: true,
          errorTitle: 'Invalid Priority',
          error: 'Please select HIGH, MEDIUM, or LOW from the dropdown.'
        };
        row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

        // Planning Status dropdown (Col G / 7)
        row.getCell(7).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [statusList],
          showErrorMessage: true,
          errorTitle: 'Invalid Planning Status',
          error: 'Please select PENDING, DRAFT_PLANNED, SCHEDULED, or COMPLETED from the dropdown.'
        };
        row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Ensure first sheet is selected as active tab
      worksheet.views = [{ state: 'normal', activeCell: 'A2' }];

      // Generate buffer and trigger browser download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Production_Orders_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('Template downloaded with Production Orders as primary sheet and live dropdowns!', 'success');
    } catch (err: any) {
      showToast(`Error generating template: ${err.message}`, 'error');
    }
  };

  // Upload Excel / CSV File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        // Select the primary orders sheet (ignore the reference Allowed_Options sheet)
        const targetSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('order') || n.toLowerCase().includes('prod'))
          || wb.SheetNames.find(n => !n.toLowerCase().includes('allow') && !n.toLowerCase().includes('option') && !n.toLowerCase().includes('list'))
          || wb.SheetNames[0];

        const ws = wb.Sheets[targetSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rows || rows.length === 0) {
          showToast('The uploaded sheet contains no data.', 'warning');
          return;
        }

        let importedCount = 0;
        const defaultCatId = categories[0]?.id || '';
        const timestampSeed = Date.now().toString().slice(-4);

        for (const row of rows) {
          // 1. Order Number: use provided or generate appropriately
          let orderNum = String(
            row['Order Number'] ||
            row['Order ID'] ||
            row['OrderID'] ||
            row['orderNumber'] ||
            row['order_id'] ||
            row['Order #'] ||
            row['Order Code'] ||
            row['Order No'] ||
            ''
          ).trim();

          const prodName = String(
            row['Product Name'] ||
            row['productName'] ||
            row['Product'] ||
            row['Description'] ||
            row['Item Name'] ||
            row['Item'] ||
            ''
          ).trim();

          // Skip row only if it is completely empty
          if (!orderNum && !prodName && !row['Category'] && !row['category'] && !row['Quantity'] && !row['quantity']) {
            continue;
          }

          if (!orderNum) {
            orderNum = `ORD-${timestampSeed}-${String(importedCount + 1).padStart(3, '0')}`;
          }

          const finalProdName = prodName || `Production Item ${importedCount + 1}`;

          // 2. Category
          const catName = String(row['Category'] || row['category'] || row['Category Name'] || '').toLowerCase().trim();
          const categoryId = categoryNameToId[catName] || defaultCatId;

          // 3. Quantity
          const rawQty = row['Quantity'] || row['quantity'] || row['Target Volume'] || row['Units'] || row['Target Quantity (Units)'];
          const numQty = Number(rawQty);
          const finalQty = (!isNaN(numQty) && numQty > 0) ? numQty : 1000;

          // 4. Due Date
          let dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const rawDate = row['Due Date'] || row['dueDate'] || row['Date'] || row['Exp. Delivery Date'] || row['Delivery Date'] || row['Expected Delivery Date'];
          if (rawDate) {
            const parsed = typeof rawDate === 'number' 
              ? new Date((rawDate - (25567 + 2)) * 86400 * 1000) 
              : parseLocalDate(String(rawDate));
            if (!isNaN(parsed.getTime())) dueDate = parsed;
          }

          // 5. Priority
          const rawPriority = String(row['Priority'] || row['priority'] || 'MEDIUM').toUpperCase().trim();
          const priority = (['HIGH', 'MEDIUM', 'LOW'].includes(rawPriority) ? rawPriority : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW';

          // 6. Planning Status
          const rawStatus = String(row['Planning Status'] || row['Status'] || row['status'] || row['planningStatus'] || row['Planning status'] || 'PENDING')
            .toUpperCase()
            .replace(/\s+/g, '_')
            .trim();
          
          let status: 'PENDING' | 'DRAFT_PLANNED' | 'SCHEDULED' | 'COMPLETED' = 'PENDING';
          if (rawStatus.includes('DRAFT')) status = 'DRAFT_PLANNED';
          else if (rawStatus.includes('SCHED')) status = 'SCHEDULED';
          else if (rawStatus.includes('COMPLET')) status = 'COMPLETED';
          else status = 'PENDING';

          // 7. Notes
          const notes = String(row['Notes'] || row['notes'] || row['Instructions'] || '').trim();

          await createProductionOrder({
            tenantId,
            orderNumber: orderNum,
            productName: finalProdName,
            categoryId,
            quantity: finalQty,
            dueDate,
            status,
            priority,
            notes
          });
          importedCount++;
        }

        queryClient.invalidateQueries({ queryKey: ['productionOrders', tenantId] });
        showToast(`Successfully uploaded ${importedCount} production orders!`, 'success');
      } catch (err: any) {
        showToast(`Error processing file: ${err.message}`, 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Export Current Filtered Orders to Excel
  const handleExportExcel = () => {
    const exportData = filteredOrders.map((o, idx) => ({
      '#': idx + 1,
      'Order Number': o.orderNumber,
      'Product Name': o.productName,
      'Category': categoryMap[o.categoryId] || 'General',
      'Target Quantity (Units)': o.quantity || 0,
      'Due Date': toLocalDateString(o.dueDate),
      'Priority': o.priority || 'MEDIUM',
      'Planning Status': o.status || 'PENDING',
      'Notes': o.notes || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Production_Orders');
    XLSX.writeFile(wb, 'Production_Orders_Export.xlsx');
    showToast('Orders exported to Excel successfully!', 'success');
  };

  return (
    <Box sx={{ py: 1 }}>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlaylistAddIcon sx={{ color: '#6366f1' }} />
            Production Orders Management
          </Typography>
        </Box>

        {/* Action Buttons in Header */}
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleDownloadTemplate}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            Template
          </Button>

          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            Upload Excel
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            style={{ display: 'none' }}
          />

          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportExcel}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            Export
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateOrder}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
          >
            Create Order
          </Button>
        </Stack>
      </Box>

      {/* Main Card with Controls & Handsontable Grid */}
      <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          {/* Controls Bar: Quick Date Range & Filters */}
          <Box sx={{ pb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            {/* Title */}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <TableViewIcon sx={{ color: '#6366f1' }} />
                Production Orders Directory
              </Typography>
            </Box>

            {/* Date Range & Status Filters */}
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1.2 }}>
              {/* Expected Delivery Date Presets */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, bgcolor: '#f8fafc', p: 0.5, borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, px: 0.8, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Exp. Delivery:
                </Typography>
                <Chip
                  label="Current Week"
                  size="small"
                  clickable
                  color={datePreset === 'CURRENT_WEEK' ? 'primary' : 'default'}
                  variant={datePreset === 'CURRENT_WEEK' ? 'filled' : 'outlined'}
                  onClick={() => handleApplyPreset('CURRENT_WEEK')}
                  sx={{ fontWeight: 700, fontSize: '0.75rem', height: '24px' }}
                />
                <Chip
                  label="This Month"
                  size="small"
                  clickable
                  color={datePreset === 'THIS_MONTH' ? 'primary' : 'default'}
                  variant={datePreset === 'THIS_MONTH' ? 'filled' : 'outlined'}
                  onClick={() => handleApplyPreset('THIS_MONTH')}
                  sx={{ fontWeight: 700, fontSize: '0.75rem', height: '24px' }}
                />
                <Chip
                  label="All Time"
                  size="small"
                  clickable
                  color={datePreset === 'ALL_TIME' ? 'primary' : 'default'}
                  variant={datePreset === 'ALL_TIME' ? 'filled' : 'outlined'}
                  onClick={() => handleApplyPreset('ALL_TIME')}
                  sx={{ fontWeight: 700, fontSize: '0.75rem', height: '24px' }}
                />
              </Box>

              {/* From Date (Expected Delivery) */}
              <TextField
                label="From (Exp. Delivery Date)"
                placeholder="Expected Delivery From"
                type="date"
                size="small"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { title: 'Select start of expected delivery date' }
                }}
                sx={{ width: 175 }}
              />

              {/* To Date (Expected Delivery) */}
              <TextField
                label="To (Exp. Delivery Date)"
                placeholder="Expected Delivery To"
                type="date"
                size="small"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { title: 'Select end of expected delivery date' }
                }}
                sx={{ width: 175 }}
              />

              {/* Status Filter */}
              <FormControl size="small" sx={{ width: 160 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="PENDING">Pending Planning</MenuItem>
                  <MenuItem value="DRAFT_PLANNED">Draft Planned</MenuItem>
                  <MenuItem value="SCHEDULED">Confirmed Scheduled</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                </Select>
              </FormControl>

              {/* Search */}
              <TextField
                placeholder="Search order or product..."
                size="small"
                sx={{ width: { xs: '100%', sm: 200 } }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>
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
            {loadingOrders ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : hotData.length > 0 ? (
              <HotTable
                data={hotData}
                readOnly={true}
                colHeaders={[
                  '#',
                  'Order Number',
                  'Product Name',
                  'Category',
                  'Target Volume (Units)',
                  'Exp. Delivery Date',
                  'Priority',
                  'Planning Status',
                  'Actions'
                ]}
                columns={[
                  { data: 'rowNum', readOnly: true, width: 45, className: 'htCenter htMiddle' },
                  { data: 'orderNumber', readOnly: true, type: 'text', width: 130, className: 'htCenter htMiddle' },
                  { data: 'productName', readOnly: true, type: 'text', width: 230, className: 'htMiddle' },
                  { data: 'category', readOnly: true, type: 'text', width: 150, className: 'htMiddle' },
                  {
                    data: 'quantity',
                    readOnly: true,
                    type: 'numeric',
                    numericFormat: { pattern: '0,0' },
                    width: 150,
                    className: 'htCenter htMiddle'
                  },
                  {
                    data: 'dueDate',
                    readOnly: true,
                    type: 'text',
                    width: 140,
                    className: 'htCenter htMiddle'
                  },
                  {
                    data: 'priority',
                    readOnly: true,
                    width: 110,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any) => {
                      const val = String(value || '').toUpperCase();
                      let bg = '#f1f5f9';
                      let color = '#475569';
                      let border = '#cbd5e1';
                      const label = val || 'MEDIUM';

                      if (val === 'HIGH') {
                        bg = '#fee2e2';
                        color = '#b91c1c';
                        border = '#fca5a5';
                      } else if (val === 'MEDIUM') {
                        bg = '#fef3c7';
                        color = '#b45309';
                        border = '#fde68a';
                      } else if (val === 'LOW') {
                        bg = '#f1f5f9';
                        color = '#475569';
                        border = '#e2e8f0';
                      }

                      td.innerHTML = `<span style="display:inline-block; padding:2px 8px; font-weight:700; font-size:11px; border-radius:12px; background:${bg}; color:${color}; border:1px solid ${border};">${label}</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'status',
                    readOnly: true,
                    width: 160,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, value: any) => {
                      const val = String(value || '').toUpperCase();
                      let bg = '#f1f5f9';
                      let color = '#475569';
                      let border = '#cbd5e1';
                      let label = val || 'PENDING';

                      if (val === 'PENDING') {
                        bg = '#fef3c7';
                        color = '#92400e';
                        border = '#fde68a';
                        label = 'Pending Planning';
                      } else if (val === 'DRAFT_PLANNED') {
                        bg = '#e0f2fe';
                        color = '#0369a1';
                        border = '#bae6fd';
                        label = 'Draft Planned';
                      } else if (val === 'SCHEDULED') {
                        bg = '#dcfce7';
                        color = '#15803d';
                        border = '#bbf7d0';
                        label = 'Scheduled';
                      } else if (val === 'COMPLETED') {
                        bg = '#f3e8ff';
                        color = '#6b21a8';
                        border = '#e9d5ff';
                        label = 'Completed';
                      }

                      td.innerHTML = `<span style="display:inline-block; padding:2px 8px; font-weight:700; font-size:11px; border-radius:12px; background:${bg}; color:${color}; border:1px solid ${border};">${label}</span>`;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  },
                  {
                    data: 'actions',
                    readOnly: true,
                    width: 220,
                    className: 'htCenter htMiddle',
                    renderer: (_instance: any, td: HTMLTableCellElement, _row: number, _col: number, _prop: any, _value: any, cellProperties: any) => {
                      const rowIdx = cellProperties.row;
                      const orderItem = filteredOrders[rowIdx];
                      const isPending = orderItem?.status === 'PENDING' || orderItem?.status === 'DRAFT_PLANNED';

                      td.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 2px 0;">
                          ${
                            isPending
                              ? `<button type="button" class="btn-schedule" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 6px; padding: 3px 8px; font-weight: 700; font-size: 11px; cursor: pointer;">Schedule</button>`
                              : ''
                          }
                          <button type="button" class="btn-edit" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; padding: 3px 8px; font-weight: 700; font-size: 11px; cursor: pointer;">Edit</button>
                          <button type="button" class="btn-delete" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 6px; padding: 3px 8px; font-weight: 700; font-size: 11px; cursor: pointer;">Delete</button>
                        </div>
                      `;
                      td.className = 'htCenter htMiddle';
                      return td;
                    }
                  }
                ]}
                afterOnCellMouseDown={(event: any, coords: any) => {
                  if (coords.col === 8 && coords.row >= 0) {
                    event.stopImmediatePropagation();
                    const targetEl = event.target as HTMLElement;
                    const rowData = hotData[coords.row];
                    const orderObj = orders.find(o => o.id === rowData?.id) || filteredOrders[coords.row];

                    if (!orderObj) return;

                    if (targetEl.classList.contains('btn-schedule')) {
                      navigate('/schedule-creation');
                    } else if (targetEl.classList.contains('btn-edit')) {
                      handleOpenEditOrder(orderObj);
                    } else if (targetEl.classList.contains('btn-delete')) {
                      setDeleteModal({ open: true, order: orderObj });
                    }
                  }
                }}
                rowHeaders={true}
                height="auto"
                width="100%"
                colWidths={[45, 130, 230, 150, 150, 140, 110, 160, 220]}
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
                No production orders found with Expected Delivery Date between {fromDate || 'Start'} and {toDate || 'End'}. Click "Create Order" or select "All Time".
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* CONFIRM DELETE MODAL POPUP (NOT BROWSER ALERT) */}
      <Dialog
        open={deleteModal.open}
        onClose={() => !deleteOrderMutation.isPending && setDeleteModal({ open: false, order: null })}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DeleteForeverIcon sx={{ color: '#dc2626' }} />
          </Box>
          Confirm Order Deletion
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6 }}>
            Are you sure you want to delete order <strong>"{deleteModal.order?.orderNumber}"</strong> ({deleteModal.order?.productName})?
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1 }}>
            This action cannot be undone and will permanently remove this production order from the system.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={() => setDeleteModal({ open: false, order: null })}
            variant="outlined"
            disabled={deleteOrderMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => deleteModal.order && deleteOrderMutation.mutate(deleteModal.order.id)}
            variant="contained"
            color="error"
            disabled={deleteOrderMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, px: 2.5 }}
          >
            {deleteOrderMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Yes, Delete Order'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: CREATE / EDIT PRODUCTION ORDER INPUT FORM */}
      <Dialog
        open={isOrderDialogOpen}
        onClose={() => setIsOrderDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1 }}>
          {editingOrder ? 'Edit Production Order' : 'Create New Production Order'}
        </DialogTitle>
        <form onSubmit={handleSaveOrder}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <TextField
                    label="Order Code"
                    placeholder="e.g. ORD-202"
                    size="small"
                    required
                    fullWidth
                    value={orderForm.orderNumber}
                    onChange={(e) => setOrderForm({ ...orderForm, orderNumber: e.target.value })}
                  />
                </Grid>
                <Grid size={6}>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      label="Priority"
                      value={orderForm.priority}
                      onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value as any })}
                    >
                      <MenuItem value="HIGH">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />
                          High Priority
                        </Box>
                      </MenuItem>
                      <MenuItem value="MEDIUM">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f59e0b' }} />
                          Medium Priority
                        </Box>
                      </MenuItem>
                      <MenuItem value="LOW">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#94a3b8' }} />
                          Low Priority
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <TextField
                label="Product Name / Description"
                placeholder="e.g. Premium Cotton Polo Shirt"
                size="small"
                required
                fullWidth
                value={orderForm.productName}
                onChange={(e) => setOrderForm({ ...orderForm, productName: e.target.value })}
              />

              <Grid container spacing={2}>
                <Grid size={6}>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Category</InputLabel>
                    <Select
                      label="Category"
                      value={orderForm.categoryId}
                      onChange={(e) => setOrderForm({ ...orderForm, categoryId: e.target.value })}
                    >
                      {categories.map((c) => (
                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="Target Quantity (Units)"
                    type="number"
                    size="small"
                    required
                    fullWidth
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm({ ...orderForm, quantity: Number(e.target.value) })}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={6}>
                  <TextField
                    label="Due Date (Exp. Delivery)"
                    type="date"
                    size="small"
                    required
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={orderForm.dueDate}
                    onChange={(e) => setOrderForm({ ...orderForm, dueDate: e.target.value })}
                  />
                </Grid>
                <Grid size={6}>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Planning Status</InputLabel>
                    <Select
                      label="Planning Status"
                      value={orderForm.status}
                      onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value as any })}
                    >
                      <MenuItem value="PENDING">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f59e0b' }} />
                          Pending Planning
                        </Box>
                      </MenuItem>
                      <MenuItem value="DRAFT_PLANNED">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3b82f6' }} />
                          Draft Planned
                        </Box>
                      </MenuItem>
                      <MenuItem value="SCHEDULED">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981' }} />
                          Scheduled
                        </Box>
                      </MenuItem>
                      <MenuItem value="COMPLETED">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#8b5cf6' }} />
                          Completed
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <TextField
                label="Notes / Instructions"
                placeholder="Optional customer requirements or special notes"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={orderForm.notes}
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setIsOrderDialogOpen(false)} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
              sx={{ borderRadius: '8px', fontWeight: 700 }}
            >
              {createOrderMutation.isPending || updateOrderMutation.isPending ? (
                <CircularProgress size={20} color="inherit" />
              ) : editingOrder ? (
                'Save Changes'
              ) : (
                'Create Order'
              )}
            </Button>
          </DialogActions>
        </form>
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

export default ProductionOrders;
