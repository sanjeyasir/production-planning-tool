import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Chip,
  useTheme,
  useMediaQuery,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Button,
  Stack,
} from '@mui/material';

// Icons
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FactoryIcon from '@mui/icons-material/Factory';
import HomeIcon from '@mui/icons-material/Home';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LockResetIcon from '@mui/icons-material/LockReset';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import DateRangeIcon from '@mui/icons-material/DateRange';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FlagIcon from '@mui/icons-material/Flag';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const DRAWER_WIDTH = 264;
const COLLAPSED_DRAWER_WIDTH = 72;

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  
  const { profile, tenant, role, hasPermission, clearAuth } = useAuthStore();
  
  const [open, setOpen] = useState(true); // Desktop sidebar open state
  const [mobileOpen, setMobileOpen] = useState(false); // Mobile drawer open state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const handleDrawerToggle = () => {
    if (isDesktop) {
      setOpen(!open);
    } else {
      setMobileOpen(!mobileOpen);
    }
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    await signOut(auth);
    clearAuth();
    navigate('/login');
  };

  const todayStrFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const menuItems = [
    {
      title: 'Overview',
      subheader: true,
    },
    {
      title: 'Portal Overview',
      path: '/',
      icon: <HomeIcon fontSize="small" />,
    },
    {
      title: 'Planning & Operations',
      subheader: true,
    },
    {
      title: 'Production Orders',
      path: '/production-orders',
      icon: <AssignmentIcon fontSize="small" />,
      module: 'production',
      action: 'view',
    },
    {
      title: 'Schedule Creation',
      path: '/schedule-creation',
      icon: <DateRangeIcon fontSize="small" />,
      module: 'production',
      action: 'create',
    },
    {
      title: 'Daily Schedule',
      path: '/production-schedule',
      icon: <CalendarMonthIcon fontSize="small" />,
      module: 'production',
      action: 'view',
    },
    {
      title: 'Daily Output Entry',
      path: '/daily-output-entry',
      icon: <TrendingUpIcon fontSize="small" />,
      module: 'production',
      action: 'create',
    },
    {
      title: 'Log Downtime',
      path: '/downtime',
      icon: <ReportProblemIcon fontSize="small" />,
      module: 'downtime',
      action: 'create',
    },
    {
      title: 'Analytics & Reports',
      subheader: true,
    },
    {
      title: 'Production Analytics',
      path: '/production-dashboard',
      icon: <BarChartIcon fontSize="small" />,
      module: 'production',
      action: 'view',
    },
    {
      title: 'Downtime Analytics',
      path: '/downtime-dashboard',
      icon: <DashboardIcon fontSize="small" />,
      module: 'downtime',
      action: 'view',
    },
    {
      title: 'Masters & Setup',
      subheader: true,
      adminOnly: true,
    },
    {
      title: 'Factory Calendar',
      path: '/factory-calendar',
      icon: <FlagIcon fontSize="small" />,
      module: 'master',
      action: 'view',
      adminOnly: true,
    },
    {
      title: 'Machines Master',
      path: '/machines',
      icon: <FactoryIcon fontSize="small" />,
      module: 'master',
      action: 'view',
      adminOnly: true,
    },
    {
      title: 'Plants Master',
      path: '/plants',
      icon: <BusinessIcon fontSize="small" />,
      module: 'master',
      action: 'view',
      adminOnly: true,
    },
    {
      title: 'Categories Master',
      path: '/categories',
      icon: <CategoryIcon fontSize="small" />,
      module: 'master',
      action: 'view',
      adminOnly: true,
    },
    {
      title: 'Users Management',
      path: '/users',
      icon: <PeopleIcon fontSize="small" />,
      module: 'user',
      action: 'view',
      adminOnly: true,
    },
  ];

  // Filter items based on user permissions
  const filteredMenuItems = menuItems.filter((item) => {
    if (item.subheader) {
      if (item.adminOnly && profile?.email !== 'admin@gmail.com' && role?.name !== 'Super Admin' && role?.name !== 'Tenant Admin') {
        return false;
      }
      return true;
    }
    if (item.adminOnly && profile?.email !== 'admin@gmail.com' && role?.name !== 'Super Admin' && role?.name !== 'Tenant Admin') {
      return false;
    }
    if (item.module && item.action) {
      return hasPermission(item.module, item.action);
    }
    return true;
  });

  // Mobile Bottom Navigation shortcuts
  const mobileShortcuts = [
    { label: 'Orders', icon: <AssignmentIcon />, path: '/production-orders' },
    { label: 'Schedule', icon: <CalendarMonthIcon />, path: '/production-schedule' },
    { label: 'Output', icon: <TrendingUpIcon />, path: '/daily-output-entry' },
    { label: 'Downtime', icon: <ReportProblemIcon />, path: '/downtime' },
    { label: 'Menu', icon: <MoreHorizIcon />, path: 'MENU_TRIGGER' },
  ];

  const getActiveMobileNavIndex = () => {
    const idx = mobileShortcuts.findIndex(s => s.path === location.pathname);
    return idx === -1 ? (mobileOpen ? 4 : 0) : idx;
  };

  const currentDrawerWidth = open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH;

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#ffffff', color: '#0f172a' }}>
      {/* Brand Header */}
      <Box
        sx={{
          height: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          px: open ? 2.5 : 1,
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        }}
      >
        {open ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Riley's Monogram */}
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '11px',
                background: 'linear-gradient(135deg, #6366f1 0%, #10b981 100%)',
                p: '1.5px',
                display: 'flex',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  bgcolor: '#0f172a',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ fontWeight: 900, fontSize: '1.15rem', fontFamily: '"Outfit", sans-serif', color: '#ffffff', letterSpacing: '-0.03em' }}>
                  R
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 900,
                  color: '#0f172a',
                  lineHeight: 1.1,
                  fontSize: '1.05rem',
                  fontFamily: '"Outfit", sans-serif',
                  letterSpacing: '-0.02em',
                }}
              >
                Riley’s
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#6366f1',
                  fontSize: '0.65rem',
                  letterSpacing: '0.06em',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  display: 'block'
                }}
              >
                Production OS
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #10b981 100%)',
              p: '1.5px',
              display: 'flex',
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: '#0f172a',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#ffffff' }}>
                R
              </Typography>
            </Box>
          </Box>
        )}

        {isDesktop && open && (
          <IconButton onClick={handleDrawerToggle} size="small" sx={{ color: '#64748b' }}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Facility Status Strip (When Open) */}
      {open && (
        <Box sx={{ px: 2, pt: 1.8, pb: 0.5 }}>
          <Box
            sx={{
              p: 1.2,
              borderRadius: '10px',
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
              <FactoryIcon sx={{ fontSize: 16, color: '#6366f1' }} />
              <Typography variant="caption" noWrap sx={{ fontWeight: 800, color: '#1e293b', fontSize: '0.75rem' }}>
                {tenant?.companyName || "Riley's Plant Operations"}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <FiberManualRecordIcon sx={{ fontSize: 10, color: '#10b981' }} />
              <Typography variant="caption" sx={{ fontSize: '0.625rem', fontWeight: 800, color: '#059669' }}>
                LIVE
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation List */}
      <List sx={{ px: 1.25, py: 1.5, flexGrow: 1, overflowY: 'auto' }}>
        {filteredMenuItems.map((item, index) => {
          if (item.subheader) {
            return open ? (
              <Typography
                key={`sub-${index}`}
                variant="caption"
                sx={{
                  display: 'block',
                  px: 1.5,
                  mt: 2,
                  mb: 0.6,
                  color: '#94a3b8',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  fontSize: '0.65rem',
                  letterSpacing: '0.08em',
                }}
              >
                {item.title}
              </Typography>
            ) : (
              <Divider key={`div-${index}`} sx={{ my: 1.5, borderColor: '#f1f5f9' }} />
            );
          }

          const isActive = location.pathname === item.path;
          
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.4 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path || '/');
                  if (!isDesktop) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: '10px',
                  minHeight: 40,
                  justifyContent: open ? 'initial' : 'center',
                  px: open ? 1.5 : 1,
                  bgcolor: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
                  color: isActive ? '#4338ca' : '#475569',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: isActive ? 'rgba(99, 102, 241, 0.12)' : '#f8fafc',
                    color: '#0f172a',
                  },
                }}
              >
                <Tooltip title={!open ? item.title : ''} placement="right">
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: open ? 1.5 : 'auto',
                      justifyContent: 'center',
                      color: isActive ? '#6366f1' : '#64748b',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                </Tooltip>
                {open && (
                  <ListItemText>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 800 : 500,
                        color: isActive ? '#4338ca' : '#334155',
                      }}
                    >
                      {item.title}
                    </Typography>
                  </ListItemText>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* User Footer Profile */}
      <Box
        sx={{
          p: open ? 2 : 1,
          borderTop: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: open ? 'stretch' : 'center',
          gap: 1.2,
        }}
      >
        {open ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Avatar
                sx={{
                  bgcolor: '#6366f1',
                  width: 36,
                  height: 36,
                  fontSize: '0.875rem',
                  fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
                }}
              >
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
              <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>
                  {profile?.name || 'Riley Operator'}
                </Typography>
                <Typography variant="caption" noWrap sx={{ display: 'block', color: '#64748b', fontSize: '0.725rem', fontWeight: 600 }}>
                  {role?.name || profile?.email}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleLogout}
              startIcon={<ExitToAppIcon sx={{ fontSize: 16 }} />}
              fullWidth
              sx={{
                borderRadius: '8px',
                borderColor: 'rgba(239, 68, 68, 0.2)',
                bgcolor: 'rgba(239, 68, 68, 0.04)',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.8rem',
                py: 0.6,
                '&:hover': {
                  borderColor: 'error.main',
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                },
              }}
            >
              Sign Out
            </Button>
          </>
        ) : (
          <Tooltip title="Sign Out" placement="right">
            <IconButton color="error" onClick={handleLogout} size="small" sx={{ borderRadius: 2 }}>
              <ExitToAppIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* Top AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: isDesktop ? `calc(100% - ${currentDrawerWidth}px)` : '100%',
          ml: isDesktop ? `${currentDrawerWidth}px` : 0,
          borderBottom: '1px solid #e2e8f0',
          bgcolor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          color: '#0f172a',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 3 }, minHeight: '66px !important' }}>
          {/* Left Title & Breadcrumb */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {!isDesktop && (
              <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 0.5 }}>
                <MenuIcon sx={{ color: '#0f172a' }} />
              </IconButton>
            )}
            
            {isDesktop && !open && (
              <IconButton onClick={handleDrawerToggle} size="small" sx={{ mr: 1, color: '#64748b' }}>
                <ChevronRightIcon />
              </IconButton>
            )}

            {/* Riley's Hub Header */}
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 900,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontFamily: '"Outfit", sans-serif',
                letterSpacing: '-0.02em',
                fontSize: { xs: '1rem', sm: '1.15rem' }
              }}
            >
              <PrecisionManufacturingIcon sx={{ fontSize: 22, color: '#6366f1' }} />
              Riley’s Operations Hub
            </Typography>

            {/* Active Shift Indicator */}
            <Chip
              icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: '#10b981 !important' }} />}
              label="Shift A (Active)"
              size="small"
              sx={{
                bgcolor: 'rgba(16, 185, 129, 0.1)',
                color: '#059669',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                fontWeight: 700,
                fontSize: '0.725rem',
                display: { xs: 'none', md: 'inline-flex' }
              }}
            />
          </Box>

          {/* Right Controls & Info */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            {/* Live Calendar Badge */}
            <Chip
              icon={<CalendarMonthIcon sx={{ fontSize: '15px !important', color: '#64748b !important' }} />}
              label={todayStrFormatted}
              size="small"
              sx={{
                bgcolor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #e2e8f0',
                fontWeight: 700,
                fontSize: '0.75rem',
                display: { xs: 'none', sm: 'inline-flex' }
              }}
            />

            {/* Plant Chip */}
            {tenant && (
              <Chip
                icon={<FactoryIcon sx={{ fontSize: '15px !important', color: '#6366f1 !important' }} />}
                label={tenant.companyName || "Riley's Main Plant"}
                size="small"
                variant="outlined"
                sx={{
                  color: '#4338ca',
                  borderColor: 'rgba(99, 102, 241, 0.3)',
                  bgcolor: 'rgba(99, 102, 241, 0.05)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  display: { xs: 'none', sm: 'inline-flex' }
                }}
              />
            )}

            {/* Role Chip */}
            {role?.name && (
              <Chip
                label={role.name.toUpperCase()}
                size="small"
                sx={{
                  bgcolor: role?.name === 'Super Admin' || role?.name === 'Tenant Admin' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                  color: role?.name === 'Super Admin' || role?.name === 'Tenant Admin' ? '#dc2626' : '#4338ca',
                  fontWeight: 800,
                  fontSize: '0.675rem',
                  letterSpacing: '0.04em',
                  display: { xs: 'none', sm: 'inline-flex' }
                }}
              />
            )}

            {/* User Profile Avatar */}
            <Tooltip title="Riley's User Profile">
              <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0.5 }}>
                <Avatar
                  sx={{
                    bgcolor: '#6366f1',
                    width: 36,
                    height: 36,
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                  }}
                >
                  {profile?.name?.charAt(0).toUpperCase() || 'R'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* User Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.2,
              borderRadius: '16px',
              minWidth: 230,
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0',
              p: 0.5,
            }
          }
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
            {profile?.name || 'Riley Administrator'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
            {profile?.email}
          </Typography>
          <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 700, mt: 0.4, display: 'block' }}>
            {role?.name} • {tenant?.companyName || "Riley's Operations"}
          </Typography>
        </Box>

        <MenuItem
          onClick={() => {
            handleProfileMenuClose();
            navigate('/change-password');
          }}
          sx={{ py: 1.2, fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px', my: 0.2 }}
        >
          <ListItemIcon sx={{ color: '#64748b', minWidth: 32 }}>
            <LockResetIcon fontSize="small" />
          </ListItemIcon>
          Change Password
        </MenuItem>

        <MenuItem
          onClick={handleLogout}
          sx={{
            py: 1.2,
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#ef4444',
            borderRadius: '8px',
            my: 0.2,
            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' },
          }}
        >
          <ListItemIcon sx={{ color: '#ef4444', minWidth: 32 }}>
            <ExitToAppIcon fontSize="small" />
          </ListItemIcon>
          Sign Out
        </MenuItem>
      </Menu>

      {/* Desktop Sidebar Drawer */}
      {isDesktop && (
        <Drawer
          variant="permanent"
          open={open}
          sx={{
            width: currentDrawerWidth,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
            '& .MuiDrawer-paper': {
              width: currentDrawerWidth,
              borderRight: '1px solid #e2e8f0',
              overflowX: 'hidden',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Mobile Drawer */}
      {!isDesktop && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main Content Viewport */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 3.5 },
          width: isDesktop ? `calc(100% - ${currentDrawerWidth}px)` : '100%',
          mt: '66px',
          mb: !isDesktop ? '60px' : 0,
          minHeight: 'calc(100vh - 66px)',
          bgcolor: '#f8fafc',
        }}
      >
        <Outlet />
      </Box>

      {/* Mobile Bottom Navigation */}
      {!isDesktop && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            borderTop: '1px solid #e2e8f0',
          }}
          elevation={3}
        >
          <BottomNavigation
            value={getActiveMobileNavIndex()}
            onChange={(_, newValue) => {
              const shortcut = mobileShortcuts[newValue];
              if (shortcut.path === 'MENU_TRIGGER') {
                setMobileOpen(true);
              } else {
                navigate(shortcut.path);
              }
            }}
            showLabels
            sx={{
              height: 58,
              '& .MuiBottomNavigationAction-root': {
                minWidth: 'auto',
                padding: '4px',
                color: '#64748b',
                '&.Mui-selected': {
                  color: '#6366f1',
                  fontWeight: 700,
                },
              },
            }}
          >
            {mobileShortcuts.map((shortcut, idx) => (
              <BottomNavigationAction
                key={idx}
                label={shortcut.label}
                icon={shortcut.icon}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
};

export default Layout;
