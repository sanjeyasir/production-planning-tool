import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  getDowntimeRecords,
  getPlants,
  getMachines,
  getDowntimeCategories
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
  Chip
} from '@mui/material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Bar,
  ComposedChart,
  Line,
  Cell,
} from 'recharts';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ErrorIcon from '@mui/icons-material/Error';
import PercentIcon from '@mui/icons-material/Percent';
import FilterListIcon from '@mui/icons-material/FilterList';
import DashboardIcon from '@mui/icons-material/Dashboard';

export const DowntimeDashboard: React.FC = () => {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';

  // 1. Fetch data from Firestore via React Query
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

  // 2. Filter states
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  
  // Date filter: default to last 30 days
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);
  const defaultEndDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);

  // 3. Filter records locally
  const filteredRecords = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return records.filter((r) => {
      const recDate = new Date(r.startTime);
      if (recDate < start || recDate > end) return false;
      if (selectedPlant !== 'all' && r.plantId !== selectedPlant) return false;
      if (selectedMachine !== 'all' && r.machineId !== selectedMachine) return false;
      if (selectedCategory !== 'all' && r.categoryId !== selectedCategory) return false;
      if (selectedShift !== 'all' && r.shift !== selectedShift) return false;
      return true;
    });
  }, [records, selectedPlant, selectedMachine, selectedCategory, selectedShift, startDate, endDate]);

  // 4. Calculate KPIs
  const kpis = useMemo(() => {
    const totalEvents = filteredRecords.length;
    const totalDowntime = filteredRecords.reduce((sum, r) => sum + r.duration, 0);
    
    const todayStr = new Date().toDateString();
    const todayDowntime = records
      .filter((r) => new Date(r.startTime).toDateString() === todayStr)
      .reduce((sum, r) => sum + r.duration, 0);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const mtdDowntime = records
      .filter((r) => {
        const d = new Date(r.startTime);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, r) => sum + r.duration, 0);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    
    const activeMachinesCount = selectedMachine !== 'all' 
      ? 1 
      : (selectedPlant !== 'all' 
          ? machines.filter(m => m.plantId === selectedPlant && m.status === 'ACTIVE').length 
          : machines.filter(m => m.status === 'ACTIVE').length) || 1;
          
    const totalScheduledMinutes = diffDays * activeMachinesCount * 24 * 60;
    const availability = Math.max(0, Math.min(100, ((totalScheduledMinutes - totalDowntime) / totalScheduledMinutes) * 100));

    return {
      todayDowntime,
      mtdDowntime,
      totalEvents,
      availability,
      totalDowntime
    };
  }, [filteredRecords, records, startDate, endDate, selectedMachine, selectedPlant, machines]);

  // 5. Chart Data: Daily Trend
  const trendData = useMemo(() => {
    const daysMap: { [key: string]: number } = {};
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daysMap[key] = 0;
    }

    filteredRecords.forEach((r) => {
      const key = new Date(r.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (daysMap[key] !== undefined) {
        daysMap[key] += r.duration;
      }
    });

    return Object.keys(daysMap).map((date) => ({
      date,
      minutes: daysMap[date],
    }));
  }, [filteredRecords, startDate, endDate]);

  // 6. Chart Data: Machine Rankings
  const machineRankings = useMemo(() => {
    const machMap: { [id: string]: { name: string; code: string; duration: number } } = {};
    
    machines.forEach((m) => {
      if (selectedPlant === 'all' || m.plantId === selectedPlant) {
        machMap[m.id] = { name: m.machineName, code: m.machineCode, duration: 0 };
      }
    });

    filteredRecords.forEach((r) => {
      if (machMap[r.machineId]) {
        machMap[r.machineId].duration += r.duration;
      } else {
        const mObj = machines.find(m => m.id === r.machineId);
        machMap[r.machineId] = { 
          name: mObj?.machineName || 'Unknown Machine', 
          code: mObj?.machineCode || 'N/A', 
          duration: r.duration 
        };
      }
    });

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const schedMinutesPerMachine = diffDays * 24 * 60;

    return Object.keys(machMap)
      .map((id) => {
        const item = machMap[id];
        const av = Math.max(0, Math.min(100, ((schedMinutesPerMachine - item.duration) / schedMinutesPerMachine) * 100));
        return {
          id,
          machine: item.name,
          code: item.code,
          downtime: item.duration,
          availability: av,
        };
      })
      .sort((a, b) => b.downtime - a.downtime);
  }, [filteredRecords, machines, selectedPlant, startDate, endDate]);

  // 7. Chart Data: Pareto Chart
  const paretoData = useMemo(() => {
    const catMap: { [id: string]: { name: string; duration: number } } = {};

    categories.forEach((c) => {
      catMap[c.id] = { name: c.name, duration: 0 };
    });

    filteredRecords.forEach((r) => {
      if (catMap[r.categoryId]) {
        catMap[r.categoryId].duration += r.duration;
      }
    });

    const sortedCats = Object.values(catMap)
      .filter((c) => c.duration > 0)
      .sort((a, b) => b.duration - a.duration);

    const totalDowntime = sortedCats.reduce((sum, c) => sum + c.duration, 0) || 1;

    let cumulativeSum = 0;
    return sortedCats.map((c) => {
      cumulativeSum += c.duration;
      const percentage = Math.round((c.duration / totalDowntime) * 100);
      const cumulativePercentage = Math.round((cumulativeSum / totalDowntime) * 100);
      return {
        category: c.name,
        downtime: c.duration,
        percentage,
        cumulative: cumulativePercentage,
      };
    });
  }, [filteredRecords, categories]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

  if (loadingRecords) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
        <CircularProgress color="primary" size={40} />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 1 }}>
      {/* Title & Description */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DashboardIcon sx={{ color: '#ef4444' }} />
          Machine Downtime Analytics
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
          Analyze line availability, stoppage durations, Pareto root causes, and machine reliability metrics.
        </Typography>
      </Box>

      {/* Filter Panel */}
      <Card
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2, color: '#6366f1' }}>
          <FilterListIcon fontSize="small" />
          <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Filter Console
          </Typography>
        </Stack>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select label="Category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Shift</InputLabel>
              <Select label="Shift" value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)}>
                <MenuItem value="all">All Shifts</MenuItem>
                <MenuItem value="Shift A">Shift A</MenuItem>
                <MenuItem value="Shift B">Shift B</MenuItem>
                <MenuItem value="Shift C">Shift C</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 6, sm: 6, md: 2 }}>
            <TextField
              label="Start Date"
              type="date"
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 6, md: 2 }}>
            <TextField
              label="End Date"
              type="date"
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Grid>
        </Grid>
      </Card>

      {/* KPI Section */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Downtime Today
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#ef4444' }}>
                    {kpis.todayDowntime} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>mins</span>
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: 36, height: 36 }}>
                  <AccessTimeIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Downtime MTD
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#ef4444' }}>
                    {kpis.mtdDowntime} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>mins</span>
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: 36, height: 36 }}>
                  <AccessTimeIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Stoppage Events
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>
                    {kpis.totalEvents}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', width: 36, height: 36 }}>
                  <ErrorIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '0.675rem', display: 'block' }}>
                    Machine Availability
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#10b981' }}>
                    {kpis.availability.toFixed(2)}<span style={{ fontSize: '1rem', fontWeight: 600 }}>%</span>
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: 36, height: 36 }}>
                  <PercentIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Trend Area Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
                Daily Downtime Occurrence Trend
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '0.75rem' }} />
                      <YAxis stroke="#94a3b8" style={{ fontSize: '0.75rem' }} unit="m" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }}
                      />
                      <Area type="monotone" dataKey="minutes" name="Downtime (mins)" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMinutes)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="text.secondary">No downtime trend data found</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Pareto Chart */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
                Pareto Analysis (Top Stoppage Reasons)
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                {paretoData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={paretoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="category" stroke="#94a3b8" style={{ fontSize: '0.7rem' }} />
                      <YAxis yAxisId="left" stroke="#94a3b8" style={{ fontSize: '0.7rem' }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#94a3b8" style={{ fontSize: '0.7rem' }} unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                      <Bar yAxisId="left" dataKey="downtime" name="Minutes" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        {paretoData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative %" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="text.secondary">No downtime category records</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Machine Availability Table */}
      <Card sx={{ borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
            Machine Availability & Performance Ranking
          </Typography>
          <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', borderRadius: '12px', bgcolor: '#ffffff' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Machine Code</TableCell>
                  <TableCell>Machine Name</TableCell>
                  <TableCell align="right">Downtime (Mins)</TableCell>
                  <TableCell align="right">Availability Rate</TableCell>
                  <TableCell align="center">Status Indicator</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {machineRankings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#64748b' }}>
                      No machines registered or found.
                    </TableCell>
                  </TableRow>
                ) : (
                  machineRankings.map((m) => (
                    <TableRow key={m.id} hover>
                      <TableCell sx={{ fontWeight: 700, color: '#6366f1' }}>{m.code}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{m.machine}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: m.downtime > 0 ? '#ef4444' : '#10b981' }}>
                        {m.downtime.toLocaleString()} mins
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: m.availability >= 90 ? '#10b981' : '#f59e0b' }}>
                        {m.availability.toFixed(1)}%
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={m.availability >= 90 ? 'HEALTHY' : (m.availability >= 75 ? 'MODERATE' : 'CRITICAL')}
                          sx={{
                            fontWeight: 700,
                            bgcolor: m.availability >= 90 ? 'rgba(16, 185, 129, 0.1)' : (m.availability >= 75 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                            color: m.availability >= 90 ? '#059669' : (m.availability >= 75 ? '#d97706' : '#dc2626'),
                            fontSize: '0.675rem'
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
    </Box>
  );
};
