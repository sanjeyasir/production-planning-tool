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

const DRAWER_WIDTH = 260;
const COLLAPSED_DRAWER_WIDTH = 70;

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
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
      title: 'Downtime',
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

  // Mobile Bottom Navigation items
  const mobileShortcuts = [
    { label: 'Orders', icon: <AssignmentIcon />, path: '/production-orders' },
    { label: 'Schedule', icon: <CalendarMonthIcon />, path: '/production-schedule' },
    { label: 'Output', icon: <TrendingUpIcon />, path: '/daily-output-entry' },
    { label: 'Downtime', icon: <ReportProblemIcon />, path: '/downtime-entry' },
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
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          px: open ? 2.5 : 1,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        {open ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                bgcolor: '#10b981',
                width: 36,
                height: 36,
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              }}
            >
              <PrecisionManufacturingIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.1, fontSize: '0.95rem' }}>
                MOIP Ops
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem', letterSpacing: '0.06em', fontWeight: 600 }}>
                MANUFACTURING HUB
              </Typography>
            </Box>
          </Box>
        ) : (
          <Avatar
            sx={{
              bgcolor: '#10b981',
              width: 36,
              height: 36,
              borderRadius: '10px',
            }}
          >
            <PrecisionManufacturingIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Avatar>
        )}
        {isDesktop && open && (
          <IconButton onClick={handleDrawerToggle} size="small" sx={{ color: '#64748b' }}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

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
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  fontSize: '0.675rem',
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
                  minHeight: 42,
                  justifyContent: open ? 'initial' : 'center',
                  px: open ? 1.5 : 1,
                  bgcolor: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.18)' : '1px solid transparent',
                  color: isActive ? '#4f46e5' : '#475569',
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
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#4f46e5' : '#334155',
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
                  bgcolor: '#10b981',
                  width: 36,
                  height: 36,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                }}
              >
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
              <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                  {profile?.name || 'User'}
                </Typography>
                <Typography variant="caption" noWrap sx={{ display: 'block', color: '#64748b', fontSize: '0.725rem' }}>
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
                fontWeight: 600,
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
          bgcolor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          color: '#0f172a',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 3 }, minHeight: '64px !important' }}>
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

            {/* Brand Header Display */}
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 800,
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                letterSpacing: '-0.01em',
                fontSize: { xs: '1rem', sm: '1.1rem' }
              }}
            >
              <PrecisionManufacturingIcon sx={{ fontSize: 20 }} />
              {!isMobile ? 'MOIP Operations Hub' : 'MOIP'}
            </Typography>

            {/* Tenant Display */}
            {tenant && (
              <Chip
                icon={<FactoryIcon sx={{ fontSize: '15px !important', color: '#10b981 !important' }} />}
                label={tenant.companyName}
                size="small"
                variant="outlined"
                sx={{
                  color: '#059669',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  bgcolor: 'rgba(16, 185, 129, 0.06)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  display: { xs: 'none', sm: 'inline-flex' }
                }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Role Chip */}
            {role?.name && (
              <Chip
                label={role.name.toUpperCase()}
                size="small"
                sx={{
                  bgcolor: role?.name === 'Super Admin' || role?.name === 'Tenant Admin' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                  color: role?.name === 'Super Admin' || role?.name === 'Tenant Admin' ? '#dc2626' : '#4f46e5',
                  fontWeight: 700,
                  fontSize: '0.675rem',
                  letterSpacing: '0.04em',
                  display: { xs: 'none', sm: 'inline-flex' }
                }}
              />
            )}

            {/* Quick Profile access */}
            <Tooltip title="User Profile Menu">
              <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0.5 }}>
                <Avatar
                  sx={{
                    bgcolor: '#10b981',
                    width: 34,
                    height: 34,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                  }}
                >
                  {profile?.name?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleProfileMenuClose}
              elevation={4}
              slotProps={{
                paper: {
                  sx: {
                    mt: 1.5,
                    minWidth: 220,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
                  },
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  {profile?.name || 'User'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>
                  {profile?.email}
                </Typography>
                <Chip
                  label={role?.name || 'Viewer'}
                  size="small"
                  sx={{ mt: 1, height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5' }}
                />
              </Box>
              <Divider sx={{ borderColor: '#f1f5f9' }} />
              <MenuItem
                onClick={() => {
                  handleProfileMenuClose();
                  navigate('/change-password');
                }}
                sx={{ fontSize: '0.85rem', py: 1, color: '#334155' }}
              >
                <LockResetIcon sx={{ fontSize: 18, mr: 1.5, color: '#64748b' }} />
                Change Password
              </MenuItem>
              <Divider sx={{ borderColor: '#f1f5f9' }} />
              <MenuItem onClick={handleLogout} sx={{ color: '#ef4444', fontSize: '0.85rem', py: 1 }}>
                <ExitToAppIcon sx={{ fontSize: 18, mr: 1.5 }} />
                Sign Out
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer - Desktop */}
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: currentDrawerWidth,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            [`& .MuiDrawer-paper`]: {
              width: currentDrawerWidth,
              boxSizing: 'border-box',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflowX: 'hidden',
              borderRight: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      ) : (
        /* Mobile Drawer */
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              borderRight: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 2.5, md: 3.5 },
          width: isDesktop ? `calc(100% - ${currentDrawerWidth}px)` : '100%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          mt: 8,
          pb: isMobile ? 10 : 4, // Padding at bottom for mobile nav bar
          bgcolor: '#f8fafc',
        }}
      >
        <Outlet />
      </Box>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            borderTop: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
          }}
          elevation={8}
        >
          <BottomNavigation
            showLabels
            value={getActiveMobileNavIndex()}
            onChange={(_, newValue) => {
              const item = mobileShortcuts[newValue];
              if (item.path === 'MENU_TRIGGER') {
                setMobileOpen(true);
              } else {
                navigate(item.path);
              }
            }}
            sx={{
              bgcolor: '#ffffff',
              height: 58,
              '& .MuiBottomNavigationAction-root': {
                minWidth: 'auto',
                padding: '6px 0',
                color: '#64748b',
                '&.Mui-selected': {
                  color: '#6366f1',
                },
              },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.675rem',
                fontWeight: 600,
                mt: 0.2,
                '&.Mui-selected': {
                  fontSize: '0.7rem',
                },
              },
            }}
          >
            {mobileShortcuts.map((shortcut, index) => (
              <BottomNavigationAction
                key={index}
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
