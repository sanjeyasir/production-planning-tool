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
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import SettingsIcon from '@mui/icons-material/Settings';
import FactoryIcon from '@mui/icons-material/Factory';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { profile, tenant, role, hasPermission } = useAuthStore();

  const welcomeName = profile?.name || 'User';
  const companyName = tenant?.companyName || 'Main Plant Operations';
  const roleName = role?.name || 'Viewer';

  const cards = [
    {
      title: 'Downtime Analytics',
      description: 'Monitor factory line downtimes, analyze root causes of delay, and generate summary PDF/Excel reports.',
      icon: <DashboardIcon sx={{ fontSize: 40, color: '#6366f1' }} />,
      path: '/downtime-dashboard',
      module: 'downtime',
      action: 'view',
      actionText: 'View Downtime Dashboard'
    },
    {
      title: 'Production Analytics',
      description: 'Track hourly/daily production output against planned budgets, calculate scrap rates, and view overall plant OEE.',
      icon: <BarChartIcon sx={{ fontSize: 40, color: '#10b981' }} />,
      path: '/production-dashboard',
      module: 'production',
      action: 'view',
      actionText: 'View Production Dashboard'
    },
    {
      title: 'Enter Downtime',
      description: 'Log new machine breakdown events, specify durations, and categorization reasons directly from the shop floor.',
      icon: <PrecisionManufacturingIcon sx={{ fontSize: 40, color: '#f59e0b' }} />,
      path: '/downtime-entry',
      module: 'downtime',
      action: 'create',
      actionText: 'Log Downtime'
    },
    {
      title: 'Enter Production',
      description: 'Log actual output volumes, rejected scrap parts, and shift budgets directly from manufacturing operations.',
      icon: <PrecisionManufacturingIcon sx={{ fontSize: 40, color: '#ec4899' }} />,
      path: '/production-entry',
      module: 'production',
      action: 'create',
      actionText: 'Log Production Output'
    },
    {
      title: 'System Masters & Admin',
      description: 'Configure plants, machines, product categories, and manage individual user screen access permissions.',
      icon: <SettingsIcon sx={{ fontSize: 40, color: '#a855f7' }} />,
      path: '/users',
      module: 'user',
      action: 'view',
      actionText: 'Manage Users & Masters'
    }
  ];

  // Filter cards based on permissions
  const allowedCards = cards.filter(c => hasPermission(c.module, c.action));

  return (
    <Box sx={{ py: 2 }}>
      {/* Welcome Header */}
      <Box 
        sx={{ 
          p: 4, 
          borderRadius: '24px', 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(8, 12, 21, 0.4) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          mb: 4
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                width: 64, 
                height: 64, 
                fontSize: '1.75rem', 
                fontWeight: 700,
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
              }}
            >
              {welcomeName.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff' }}>
                Welcome to MOIP
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                Hello, <strong>{welcomeName}</strong>. You are logged into <strong>{companyName}</strong>.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <Chip 
              icon={<FactoryIcon sx={{ fontSize: 16, color: '#10b981 !important' }} />}
              label={companyName} 
              variant="outlined" 
              sx={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)', bgcolor: 'rgba(16, 185, 129, 0.05)', fontWeight: 600 }}
            />
            <Chip 
              label={`Role: ${roleName}`} 
              color="primary"
              sx={{ fontWeight: 600 }}
            />
          </Stack>
        </Stack>
      </Box>

      {/* Info Card */}
      <Card 
        sx={{ 
          mb: 4, 
          borderRadius: '16px', 
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.4) 0%, rgba(8, 12, 21, 0.8) 100%)'
        }}
      >
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
            About Manufacturing Operations Intelligence Platform (MOIP)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            MOIP is designed to help plant operations teams visualize line downtimes, track production yield targets, and analyze performance data. Use the navigation menu on the left, or select one of the authorized modules below to begin your workflow.
          </Typography>
        </CardContent>
      </Card>

      {/* Grid of Authorized Modules */}
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 3 }}>
        Authorized Operations Modules
      </Typography>
      <Grid container spacing={3}>
        {allowedCards.map((card, idx) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                bgcolor: 'rgba(15, 23, 42, 0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  borderColor: 'rgba(255,255,255,0.12)'
                }
              }}
            >
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ mb: 2, display: 'inline-flex', p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
                  {card.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                  {card.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {card.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => navigate(card.path)}
                  sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
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
