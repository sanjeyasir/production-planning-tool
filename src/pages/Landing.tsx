import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import {
  getMachines,
  getProductionOrders,
  getProductionPlans,
  getDailyProductions,
  toLocalDateString
} from '../services/db';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Stack,
  Chip,
} from '@mui/material';
import { RileysLogo } from '../components/RileysLogo';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import FactoryIcon from '@mui/icons-material/Factory';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DateRangeIcon from '@mui/icons-material/DateRange';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FlagIcon from '@mui/icons-material/Flag';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { profile, tenant, role, hasPermission } = useAuthStore();
  const tenantId = tenant?.id || '';

  const welcomeName = profile?.name || 'Operator';
  const companyName = tenant?.companyName || "Production Operations";
  const roleName = role?.name || 'Administrator';

  // Live Metric Telemetry
  const { data: machines = [] } = useQuery({
    queryKey: ['machines', tenantId],
    queryFn: () => getMachines(tenantId),
    enabled: !!tenantId,
  });

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

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['dailyProductions', tenantId],
    queryFn: () => getDailyProductions(tenantId),
    enabled: !!tenantId,
  });

  // Calculate Quick Live Metrics
  const activeMachinesCount = machines.filter(m => m.status === 'ACTIVE').length;
  const activePlansCount = plans.filter(p => p.type === 'CONFIRMED' && p.status !== 'CANCELLED').length;
  const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;

  const todayStr = toLocalDateString(new Date());
  const todayOutput = dailyLogs
    .filter(l => l.dateStr === todayStr || toLocalDateString(l.date) === todayStr)
    .reduce((sum, l) => sum + (Number(l.actualVolume) || (Number(l.acceptedQuantity || 0) + Number(l.rejectedQuantity || 0))), 0);

  const cards = [
    {
      title: 'Production Orders Queue',
      description: 'Manage customer orders, SKU batches, prioritization, and run automated schedule creation.',
      icon: <AssignmentIcon sx={{ fontSize: 32, color: '#6366f1' }} />,
      bg: 'rgba(99, 102, 241, 0.08)',
      path: '/production-orders',
      module: 'production',
      action: 'view',
      actionText: 'View Orders Queue'
    },
    {
      title: 'Schedule Creation & Capacity',
      description: 'Multi-machine schedule builder, date range allocation, and capacity conflict detection.',
      icon: <DateRangeIcon sx={{ fontSize: 32, color: '#4f46e5' }} />,
      bg: 'rgba(79, 70, 229, 0.08)',
      path: '/schedule-creation',
      module: 'production',
      action: 'create',
      actionText: 'Create Schedule'
    },
    {
      title: 'Daily Production Schedule',
      description: 'Interactive Gantt board for multi-line daily production schedules, holidays, and job shifting.',
      icon: <CalendarMonthIcon sx={{ fontSize: 32, color: '#10b981' }} />,
      bg: 'rgba(16, 185, 129, 0.08)',
      path: '/production-schedule',
      module: 'production',
      action: 'view',
      actionText: 'Open Daily Schedule'
    },
    {
      title: 'Daily Output Entry',
      description: 'Record daily actual output volumes, accepted parts, scrap, and operator shift notes.',
      icon: <TrendingUpIcon sx={{ fontSize: 32, color: '#06b6d4' }} />,
      bg: 'rgba(6, 182, 212, 0.08)',
      path: '/daily-output-entry',
      module: 'production',
      action: 'create',
      actionText: 'Record Daily Output'
    },
    {
      title: 'Log Machine Downtime',
      description: 'Log breakdown events by downtime category with automatic 1-day schedule shift protection.',
      icon: <ReportProblemIcon sx={{ fontSize: 32, color: '#ef4444' }} />,
      bg: 'rgba(239, 68, 68, 0.08)',
      path: '/downtime',
      module: 'downtime',
      action: 'create',
      actionText: 'Log Downtime Event'
    },
    {
      title: 'Production Analytics',
      description: 'Category & machine-wise daily output line graphs against daily targets and cumulative volumes.',
      icon: <BarChartIcon sx={{ fontSize: 32, color: '#3b82f6' }} />,
      bg: 'rgba(59, 130, 246, 0.08)',
      path: '/production-dashboard',
      module: 'production',
      action: 'view',
      actionText: 'View Production Dashboard'
    },
    {
      title: 'Downtime Analytics',
      description: 'Category-wise machine downtime date matrix, fleet availability rates, and Pareto root causes.',
      icon: <DashboardIcon sx={{ fontSize: 32, color: '#f97316' }} />,
      bg: 'rgba(249, 115, 22, 0.08)',
      path: '/downtime-dashboard',
      module: 'downtime',
      action: 'view',
      actionText: 'View Downtime Dashboard'
    },
    {
      title: 'Factory Calendar & Holidays',
      description: 'Manage national holidays and factory shutdown days to ensure accurate scheduling.',
      icon: <FlagIcon sx={{ fontSize: 32, color: '#ec4899' }} />,
      bg: 'rgba(236, 72, 153, 0.08)',
      path: '/factory-calendar',
      module: 'master',
      action: 'view',
      actionText: 'Manage Calendar'
    }
  ];

  // Filter cards based on permissions
  const allowedCards = cards.filter(c => hasPermission(c.module, c.action));

  return (
    <Box sx={{ py: 1 }}>
      {/* Welcome Hero Banner */}
      <Card 
        sx={{ 
          p: { xs: 2.5, sm: 3.5 }, 
          borderRadius: '24px', 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 30px -10px rgba(99, 102, 241, 0.1)',
          mb: 3.5,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2.2} sx={{ alignItems: 'center' }}>
            <RileysLogo size="lg" variant="icon" themeMode="sidebar" />

            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', fontSize: { xs: '1.4rem', sm: '1.75rem' }, fontFamily: '"Outfit", sans-serif' }}>
                Production Planning & Operations
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3, fontWeight: 500 }}>
                Welcome back, {welcomeName} • Operations Dashboard & Manufacturing Suite
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.2} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Chip 
              icon={<FactoryIcon sx={{ fontSize: '16px !important', color: '#6366f1 !important' }} />}
              label={companyName} 
              variant="outlined" 
              sx={{ color: '#4338ca', borderColor: 'rgba(99, 102, 241, 0.3)', bgcolor: 'rgba(99, 102, 241, 0.06)', fontWeight: 700, fontSize: '0.8rem' }}
            />
            <Chip 
              icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: '#10b981 !important' }} />}
              label={`Shift A • ${roleName}`} 
              sx={{ fontWeight: 800, fontSize: '0.8rem', bgcolor: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)' }}
            />
          </Stack>
        </Stack>

        {/* Live Operational Metrics Ribbon */}
        <Grid container spacing={2} sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid rgba(226, 232, 240, 0.8)' }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
              Active Machines
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.2 }}>
              {activeMachinesCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>Lines Online</span>
            </Typography>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
              Confirmed Plans
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#4f46e5', mt: 0.2 }}>
              {activePlansCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Active Jobs</span>
            </Typography>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
              Today's Output Realized
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#10b981', mt: 0.2 }}>
              {todayOutput.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Units</span>
            </Typography>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
              Pending Orders
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: pendingOrdersCount > 0 ? '#f59e0b' : '#10b981', mt: 0.2 }}>
              {pendingOrdersCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>In Queue</span>
            </Typography>
          </Grid>
        </Grid>
      </Card>

      {/* Operations Hub Navigation Modules */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5, fontFamily: '"Outfit", sans-serif' }}>
          Production & Planning Modules
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 2.5 }}>
          Launch planning workspaces, track live daily outputs, inspect downtime telemetry, and configure master data.
        </Typography>
      </Box>

      <Grid container spacing={{ xs: 2, sm: 2.5 }}>
        {allowedCards.map((card, idx) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                borderRadius: '18px',
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 28px -6px rgba(15, 23, 42, 0.09)',
                  borderColor: '#cbd5e1'
                }
              }}
            >
              <CardContent sx={{ p: 2.8, pb: 1 }}>
                <Box 
                  sx={{ 
                    mb: 2, 
                    display: 'inline-flex', 
                    p: 1.3, 
                    borderRadius: '14px', 
                    bgcolor: card.bg 
                  }}
                >
                  {card.icon}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.75, fontSize: '1.025rem' }}>
                  {card.title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.55, fontSize: '0.825rem' }}>
                  {card.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ p: 2.8, pt: 1 }}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  fullWidth
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                  onClick={() => navigate(card.path)}
                  sx={{ 
                    textTransform: 'none', 
                    borderRadius: '10px', 
                    fontWeight: 700,
                    borderColor: '#e2e8f0',
                    color: '#334155',
                    py: 0.8,
                    '&:hover': {
                      borderColor: '#6366f1',
                      color: '#4338ca',
                      bgcolor: 'rgba(99, 102, 241, 0.05)'
                    }
                  }}
                >
                  {card.actionText}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Landing;
