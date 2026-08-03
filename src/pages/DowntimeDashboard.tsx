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
  Legend,
} from 'recharts';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ErrorIcon from '@mui/icons-material/Error';
import PercentIcon from '@mui/icons-material/Percent';
import FilterListIcon from '@mui/icons-material/FilterList';

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
    
    // Total duration in filtered set
    const totalDowntime = filteredRecords.reduce((sum, r) => sum + r.duration, 0);
    
    // Today's total downtime
    const todayStr = new Date().toDateString();
    const todayDowntime = records
      .filter((r) => new Date(r.startTime).toDateString() === todayStr)
      .reduce((sum, r) => sum + r.duration, 0);

    // MTD (Month To Date) total downtime
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const mtdDowntime = records
      .filter((r) => {
        const d = new Date(r.startTime);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, r) => sum + r.duration, 0);

    // Machine Availability Calculation:
    // Scheduled time = Days in filter * active machines * 24 hours
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

    // Pre-populate days range with 0s
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
    
    // Initialize active machines
    machines.forEach((m) => {
      if (selectedPlant === 'all' || m.plantId === selectedPlant) {
        machMap[m.id] = { name: m.machineName, code: m.machineCode, duration: 0 };
      }
    });

    filteredRecords.forEach((r) => {
      if (machMap[r.machineId]) {
        machMap[r.machineId].duration += r.duration;
      } else {
        // Fallback for deleted or unseeded machines in the list
        const mObj = machines.find(m => m.id === r.machineId);
        machMap[r.machineId] = { 
          name: mObj?.machineName || 'Unknown Machine', 
          code: mObj?.machineCode || 'N/A', 
          duration: r.duration 
        };
      }
    });

    // Calculate availability for each
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
      .sort((a, b) => b.downtime - a.downtime); // Rank by highest downtime
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

    // Sort categories descending by duration
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
        <CircularProgress color="primary" size={50} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
            Downtime Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Analyze machine efficiency, downtime events, and cumulative operational losses.
          </Typography>
        </Box>
      </Box>

      {/* Filter Panel */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 4,
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2, color: 'primary.light' }}>
          <FilterListIcon fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
      </Paper>

      {/* KPI Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Downtime Today
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#f87171' }}>
                    {kpis.todayDowntime} <span style={{ fontSize: '1rem', fontWeight: 500 }}>mins</span>
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                  <AccessTimeIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Downtime MTD
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#f87171' }}>
                    {kpis.mtdDowntime} <span style={{ fontSize: '1rem', fontWeight: 500 }}>mins</span>
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                  <AccessTimeIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Downtime Events
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#fbbf24' }}>
                    {kpis.totalEvents}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <ErrorIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Machine Availability
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#34d399' }}>
                    {kpis.availability.toFixed(2)}<span style={{ fontSize: '1.2rem', fontWeight: 600 }}>%</span>
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                  <PercentIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Trend Area Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                Daily Downtime Trend
              </Typography>
              <Box sx={{ width: '100%', height: 300 }}>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                      <YAxis stroke="#64748b" style={{ fontSize: '0.75rem' }} unit="m" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8 }}
                        labelStyle={{ color: '#fff', fontWeight: 600 }}
                      />
                      <Area type="monotone" dataKey="minutes" name="Downtime Minutes" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMinutes)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="text.secondary">No trend data available for filters</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Pareto Chart */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                Downtime Pareto Analysis
              </Typography>
              <Box sx={{ width: '100%', height: 300 }}>
                {paretoData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={paretoData} margin={{ top: 10, right: -5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                      <XAxis dataKey="category" stroke="#64748b" style={{ fontSize: '0.675rem' }} />
                      <YAxis yAxisId="left" stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#64748b" style={{ fontSize: '0.75rem' }} unit="%" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8 }}
                      />
                      <Bar yAxisId="left" dataKey="downtime" name="Minutes" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        {paretoData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative %" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} />
                      <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="text.secondary">No category data available</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Machine Performance Table / Rankings */}
      <Card>
        <CardContent sx={{ px: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, px: 3 }}>
            Machine Performance & Availability Ranking
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                  <TableCell sx={{ pl: 3, fontWeight: 700, color: 'text.secondary' }}>Machine Code</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Machine Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>Total Downtime</TableCell>
                  <TableCell align="right" sx={{ pr: 3, fontWeight: 700, color: 'text.secondary' }}>Availability Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {machineRankings.length > 0 ? (
                  machineRankings.map((item) => (
                    <TableRow 
                      key={item.id}
                      sx={{ 
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)' 
                      }}
                    >
                      <TableCell sx={{ pl: 3, fontWeight: 600 }}>{item.code}</TableCell>
                      <TableCell>{item.machine}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: item.downtime > 0 ? '#ef4444' : 'text.primary' }}>
                        {item.downtime} mins
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 3, fontWeight: 700, color: item.availability > 95 ? '#10b981' : item.availability > 85 ? '#f59e0b' : '#ef4444' }}>
                        {item.availability.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">No machines found for filters.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};
