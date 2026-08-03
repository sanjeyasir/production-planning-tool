import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  getProductionRecords,
  getPlants,
  getProductionCategories
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
  Avatar,
  Stack,
} from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FlagIcon from '@mui/icons-material/Flag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import StarIcon from '@mui/icons-material/Star';
import DangerousIcon from '@mui/icons-material/Dangerous';
import FilterListIcon from '@mui/icons-material/FilterList';

export const ProductionDashboard: React.FC = () => {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';

  // 1. Fetch data from Firestore via React Query
  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['productionRecords', tenantId],
    queryFn: () => getProductionRecords(tenantId),
    enabled: !!tenantId,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ['plants', tenantId],
    queryFn: () => getPlants(tenantId),
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['productionCategories', tenantId],
    queryFn: () => getProductionCategories(tenantId),
    enabled: !!tenantId,
  });

  // 2. Filter states
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Date filters (Default to last 30 days)
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
      const recDate = new Date(r.date);
      if (recDate < start || recDate > end) return false;
      if (selectedPlant !== 'all' && r.plantId !== selectedPlant) return false;
      if (selectedCategory !== 'all' && r.categoryId !== selectedCategory) return false;
      return true;
    });
  }, [records, selectedPlant, selectedCategory, startDate, endDate]);

  // 4. Calculate KPIs
  const kpis = useMemo(() => {
    let budget = 0;
    let planned = 0;
    let actual = 0;
    let accepted = 0;
    let rejected = 0;

    filteredRecords.forEach((r) => {
      budget += r.budgetVolume;
      planned += r.plannedVolume;
      actual += r.actualVolume;
      accepted += r.acceptedQuantity;
      rejected += r.rejectedQuantity;
    });

    const balance = Math.max(0, budget - actual);
    const achievementPercent = budget > 0 ? (actual / budget) * 100 : 0;
    const totalVolume = accepted + rejected;
    const rejectRate = totalVolume > 0 ? (rejected / totalVolume) * 100 : 0;

    return {
      budget,
      planned,
      actual,
      balance,
      achievementPercent,
      rejectRate,
      accepted,
      rejected
    };
  }, [filteredRecords]);

  // 5. Chart Data: Production Progress (Budget vs Planned vs Actual)
  const progressData = useMemo(() => {
    const daysMap: { [key: string]: { date: string; budget: number; planned: number; actual: number } } = {};
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Pre-populate days range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daysMap[key] = { date: key, budget: 0, planned: 0, actual: 0 };
    }

    filteredRecords.forEach((r) => {
      const key = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (daysMap[key]) {
        daysMap[key].budget += r.budgetVolume;
        daysMap[key].planned += r.plannedVolume;
        daysMap[key].actual += r.actualVolume;
      }
    });

    return Object.values(daysMap);
  }, [filteredRecords, startDate, endDate]);

  // 6. Chart Data: Category Performance
  const categoryPerformance = useMemo(() => {
    const catMap: { [id: string]: { category: string; target: number; actual: number } } = {};

    categories.forEach((c) => {
      catMap[c.id] = { category: c.name, target: 0, actual: 0 };
    });

    filteredRecords.forEach((r) => {
      if (catMap[r.categoryId]) {
        catMap[r.categoryId].target += r.plannedVolume;
        catMap[r.categoryId].actual += r.actualVolume;
      }
    });

    return Object.values(catMap).filter(item => item.target > 0 || item.actual > 0);
  }, [filteredRecords, categories]);

  // 7. Chart Data: Quality Analysis
  const qualityData = useMemo(() => {
    return [
      { name: 'Accepted Quantity', value: kpis.accepted, color: '#10b981' },
      { name: 'Rejected Quantity', value: kpis.rejected, color: '#ef4444' }
    ];
  }, [kpis.accepted, kpis.rejected]);

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
            Production Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor manufacturing output against targets and inspect overall product quality.
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
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
        {/* KPI: Budget */}
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Budget
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#3b82f6' }}>
                    {kpis.budget.toLocaleString()}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: 36, height: 36 }}>
                  <CalendarMonthIcon sx={{ fontSize: 18 }} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* KPI: Planned */}
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Planned Volume
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#fbbf24' }}>
                    {kpis.planned.toLocaleString()}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', width: 36, height: 36 }}>
                  <FlagIcon sx={{ fontSize: 18 }} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* KPI: Actual Production */}
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Actual Output
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#10b981' }}>
                    {kpis.actual.toLocaleString()}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: 36, height: 36 }}>
                  <CheckCircleIcon sx={{ fontSize: 18 }} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* KPI: Remaining Balance */}
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Remaining Bal.
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: kpis.balance > 0 ? '#fbbf24' : 'text.primary' }}>
                    {kpis.balance.toLocaleString()}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.04)', color: 'text.secondary', width: 36, height: 36 }}>
                  <RemoveCircleIcon sx={{ fontSize: 18 }} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* KPI: Achievement Rate */}
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Achievement
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: kpis.achievementPercent >= 90 ? '#10b981' : '#f59e0b' }}>
                    {kpis.achievementPercent.toFixed(1)}%
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', width: 36, height: 36 }}>
                  <StarIcon sx={{ fontSize: 18 }} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* KPI: Reject Rate */}
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Reject Rate
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: kpis.rejectRate > 2.5 ? '#ef4444' : '#10b981' }}>
                    {kpis.rejectRate.toFixed(2)}%
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: 36, height: 36 }}>
                  <DangerousIcon sx={{ fontSize: 18 }} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3}>
        {/* Trend Area Chart (Planned vs Actual) */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                Daily Production Output vs Targets
              </Typography>
              <Box sx={{ width: '100%', height: 300 }}>
                {progressData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                      <YAxis stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="budget" name="Budget" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="planned" name="Planned" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="actual" name="Actual Produced" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="text.secondary">No production trend data available</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quality Pie Chart */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Quality Ratio analysis
              </Typography>
              <Box sx={{ width: '100%', height: 260, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                {kpis.actual > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={qualityData.filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {qualityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary">No quality data available</Typography>
                )}
                {kpis.actual > 0 && (
                  <Box sx={{ position: 'absolute', textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#10b981' }}>
                      {(100 - kpis.rejectRate).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Yield Rate
                    </Typography>
                  </Box>
                )}
              </Box>
              {/* Custom Legend */}
              {kpis.actual > 0 && (
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#10b981' }} />
                      <Typography variant="body2" color="text.secondary">Accepted</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {kpis.accepted.toLocaleString()} units
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ef4444' }} />
                      <Typography variant="body2" color="text.secondary">Rejected</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {kpis.rejected.toLocaleString()} units
                    </Typography>
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Category Performance Targets */}
        <Grid size={12}>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                Production Output vs Plan by Category
              </Typography>
              <Box sx={{ width: '100%', height: 320 }}>
                {categoryPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryPerformance} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="category" stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                      <YAxis stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
                      <Bar dataKey="target" name="Target Plan" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      <Bar dataKey="actual" name="Actual Production" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="text.secondary">No category performance data found for the date range</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
