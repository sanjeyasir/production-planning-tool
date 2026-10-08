import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Avatar,
  Stack,
  Chip,
} from '@mui/material';
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

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { profile, tenant, role, hasPermission } = useAuthStore();

  const welcomeName = profile?.name || 'User';
  const companyName = tenant?.companyName || 'Main Plant Operations';
  const roleName = role?.name || 'Viewer';

  const cards = [
    {
      title: 'Production Orders Queue',
      description: 'Manage incoming batches, order priorities, and run automated schedule generation.',
      icon: <AssignmentIcon sx={{ fontSize: 32, color: '#6366f1' }} />,
      bg: 'rgba(99, 102, 241, 0.08)',
      path: '/production-orders',
      module: 'production',
      action: 'view',
      actionText: 'View Orders Queue'
    },
    {
      title: 'Schedule Creation & Capacity',
      description: 'Multi-machine schedule planner, date range auto-fill, and capacity clash detector.',
      icon: <DateRangeIcon sx={{ fontSize: 32, color: '#4f46e5' }} />,
      bg: 'rgba(79, 70, 229, 0.08)',
      path: '/schedule-creation',
      module: 'production',
      action: 'create',
      actionText: 'Create Schedule'
    },
    {
      title: 'Daily Schedule Matrix',
      description: 'Interactive Gantt board for multi-line daily production schedules, holidays, and live tracking.',
      icon: <CalendarMonthIcon sx={{ fontSize: 32, color: '#10b981' }} />,
      bg: 'rgba(16, 185, 129, 0.08)',
      path: '/production-schedule',
      module: 'production',
      action: 'view',
      actionText: 'Open Daily Schedule'
    },
    {
      title: 'Daily Output Entry',
      description: 'Log daily completed volume, scrap parts, and operator shift notes for active jobs.',
      icon: <TrendingUpIcon sx={{ fontSize: 32, color: '#06b6d4' }} />,
      bg: 'rgba(6, 182, 212, 0.08)',
      path: '/daily-output-entry',
      module: 'production',
      action: 'create',
      actionText: 'Record Daily Output'
    },
    {
      title: 'Enter Downtime Incident',
      description: 'Record machine stoppages, breakdown durations, and categorization in real time.',
      icon: <ReportProblemIcon sx={{ fontSize: 32, color: '#ef4444' }} />,
      bg: 'rgba(239, 68, 68, 0.08)',
      path: '/downtime-entry',
      module: 'downtime',
      action: 'create',
      actionText: 'Log Downtime Event'
    },
    {
      title: 'Production Analytics',
      description: 'Monitor actual output yield vs planned budgets, scrap rates, and line efficiency.',
      icon: <BarChartIcon sx={{ fontSize: 32, color: '#3b82f6' }} />,
      bg: 'rgba(59, 130, 246, 0.08)',
      path: '/production-dashboard',
      module: 'production',
      action: 'view',
      actionText: 'View Production Dashboard'
    },
    {
      title: 'Downtime Analytics',
      description: 'Analyze machine stoppage root causes, breakdown trends, and line availability.',
      icon: <DashboardIcon sx={{ fontSize: 32, color: '#f97316' }} />,
      bg: 'rgba(249, 115, 22, 0.08)',
      path: '/downtime-dashboard',
      module: 'downtime',
      action: 'view',
      actionText: 'View Downtime Dashboard'
    },
    {
      title: 'Factory Calendar',
      description: 'Manage national holidays and scheduled factory shutdown days for planning.',
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
          borderRadius: '20px', 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(16, 185, 129, 0.05) 100%)',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.04)',
          mb: 3.5
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: '#10b981', 
                width: { xs: 48, sm: 56 }, 
                height: { xs: 48, sm: 56 }, 
                fontSize: { xs: '1.25rem', sm: '1.5rem' }, 
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}
            >
              {welcomeName.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                Welcome, {welcomeName}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
                Manufacturing Operations Intelligence Platform (MOIP)
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Chip 
              icon={<FactoryIcon sx={{ fontSize: '16px !important', color: '#10b981 !important' }} />}
              label={companyName} 
              variant="outlined" 
              sx={{ color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)', bgcolor: 'rgba(16, 185, 129, 0.06)', fontWeight: 600, fontSize: '0.8rem' }}
            />
            <Chip 
              label={`Role: ${roleName}`} 
              color="primary"
              sx={{ fontWeight: 600, fontSize: '0.8rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
            />
          </Stack>
        </Stack>
      </Card>

      {/* Grid of Authorized Modules */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
          Authorized Operations Modules
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 2.5 }}>
          Select a quick action below to monitor telemetry, review schedules, or record shop-floor logs.
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
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.04)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 10px 20px -3px rgba(0, 0, 0, 0.08)',
                  borderColor: '#cbd5e1'
                }
              }}
            >
              <CardContent sx={{ p: 2.5, pb: 1 }}>
                <Box 
                  sx={{ 
                    mb: 2, 
                    display: 'inline-flex', 
                    p: 1.25, 
                    borderRadius: '12px', 
                    bgcolor: card.bg 
                  }}
                >
                  {card.icon}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.75, fontSize: '1rem' }}>
                  {card.title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.5, fontSize: '0.825rem' }}>
                  {card.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ p: 2.5, pt: 1 }}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  fullWidth
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                  onClick={() => navigate(card.path)}
                  sx={{ 
                    textTransform: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 600,
                    borderColor: '#e2e8f0',
                    color: '#334155',
                    '&:hover': {
                      borderColor: '#6366f1',
                      color: '#6366f1',
                      bgcolor: 'rgba(99, 102, 241, 0.04)'
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
