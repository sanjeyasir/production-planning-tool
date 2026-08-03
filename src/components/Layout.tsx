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
  Badge,
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
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FactoryIcon from '@mui/icons-material/Factory';
import HomeIcon from '@mui/icons-material/Home';

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
      title: 'Navigation',
      subheader: true,
    },
    {
      title: 'Portal Overview',
      path: '/',
      icon: <HomeIcon />,
    },
    {
      title: 'Dashboard',
      subheader: true,
    },
    {
      title: 'Downtime Analytics',
      path: '/downtime-dashboard',
      icon: <DashboardIcon />,
      module: 'downtime',
      action: 'view',
    },
    {
      title: 'Production Analytics',
      path: '/production-dashboard',
      icon: <BarChartIcon />,
      module: 'production',
      action: 'view',
    },
    {
      title: 'Operations',
      subheader: true,
    },
    {
      title: 'Enter Downtime',
      path: '/downtime-entry',
      icon: <PlaylistAddIcon />,
      module: 'downtime',
      action: 'create',
    },
    {
      title: 'Enter Production',
      path: '/production-entry',
      icon: <PrecisionManufacturingIcon />,
      module: 'production',
      action: 'create',
    },
    {
      title: 'Administration',
      subheader: true,
      adminOnly: true,
    },
    {
      title: 'Plants Master',
      path: '/plants',
      icon: <BusinessIcon />,
      module: 'master',
      action: 'view',
      adminOnly: true,
    },
    {
      title: 'Machines Master',
      path: '/machines',
      icon: <FactoryIcon />,
      module: 'master',
      action: 'view',
      adminOnly: true,
    },
    {
      title: 'Categories Master',
      path: '/categories',
      icon: <CategoryIcon />,
      module: 'master',
      action: 'view',
      adminOnly: true,
    },
    {
      title: 'Users Management',
      path: '/users',
      icon: <PeopleIcon />,
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

  // Mobile Bottom Navigation items (Top 4 shortcuts)
  const mobileShortcuts = [
    { label: 'Downtime', icon: <DashboardIcon />, path: '/downtime-dashboard' },
    { label: 'Production', icon: <BarChartIcon />, path: '/production-dashboard' },
    { label: 'Log DT', icon: <PlaylistAddIcon />, path: '/downtime-entry' },
    { label: 'Log Prod', icon: <PrecisionManufacturingIcon />, path: '/production-entry' },
  ];

  const getActiveMobileNavIndex = () => {
    const idx = mobileShortcuts.findIndex(s => s.path === location.pathname);
    return idx === -1 ? 0 : idx;
  };

  const currentDrawerWidth = open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH;

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box
        sx={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          px: open ? 2.5 : 1,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {open ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                bgcolor: 'primary.main',
                borderRadius: 1.5,
                p: 0.8,
                display: 'flex',
                boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
              }}
            >
              <PrecisionManufacturingIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 800, letterSpacing: 1.2 }}>
              MOIP
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              bgcolor: 'primary.main',
              borderRadius: 1.5,
              p: 0.8,
              display: 'flex',
            }}
          >
            <PrecisionManufacturingIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
        )}
        {isDesktop && open && (
          <IconButton onClick={handleDrawerToggle} size="small" sx={{ color: 'text.secondary' }}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      <List sx={{ px: 1.5, py: 2, flexGrow: 1, overflowY: 'auto' }}>
        {filteredMenuItems.map((item, index) => {
          if (item.subheader) {
            return open ? (
              <Typography
                key={`sub-${index}`}
                variant="caption"
                sx={{
                  display: 'block',
                  px: 2,
                  mt: 2,
                  mb: 0.8,
                  color: 'text.disabled',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {item.title}
              </Typography>
            ) : (
              <Divider key={`div-${index}`} sx={{ my: 2, borderColor: 'rgba(255,255,255,0.04)' }} />
            );
          }

          const isActive = location.pathname === item.path;
          
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path || '/');
                  if (!isDesktop) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2.5,
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2,
                  bgcolor: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.15)' : '1px solid transparent',
                  color: isActive ? 'primary.light' : 'text.secondary',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    color: 'text.primary',
                  },
                }}
              >
                <Tooltip title={!open ? item.title : ''} placement="right">
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: open ? 2 : 'auto',
                      justifyContent: 'center',
                      color: isActive ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                </Tooltip>
                 {open && (
                  <ListItemText>
                    <Typography variant="body2" sx={{ fontSize: '0.925rem', fontWeight: isActive ? 600 : 500 }}>
                      {item.title}
                    </Typography>
                  </ListItemText>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box
        sx={{
          p: open ? 2.5 : 1,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          bgcolor: 'rgba(255, 255, 255, 0.01)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: open ? 'stretch' : 'center',
          gap: 1,
        }}
      >
        {open ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar
                sx={{
                  bgcolor: 'primary.dark',
                  width: 38,
                  height: 38,
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                }}
              >
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
              <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {profile?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {role?.name}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              color="error"
              onClick={handleLogout}
              startIcon={<ExitToAppIcon />}
              fullWidth
              sx={{
                mt: 1.5,
                borderRadius: '8px',
                borderColor: 'rgba(239, 68, 68, 0.2)',
                bgcolor: 'rgba(239, 68, 68, 0.02)',
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': {
                  borderColor: 'error.main',
                  bgcolor: 'rgba(239, 68, 68, 0.08)',
                },
              }}
            >
              Sign Out
            </Button>
          </>
        ) : (
          <IconButton color="error" onClick={handleLogout} sx={{ borderRadius: 2 }}>
            <ExitToAppIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: isDesktop ? `calc(100% - ${currentDrawerWidth}px)` : '100%',
          ml: isDesktop ? `${currentDrawerWidth}px` : 0,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          bgcolor: 'background.default',
          backdropFilter: 'blur(20px)',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {!isDesktop && (
              <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
            )}
            
            {isDesktop && !open && (
              <IconButton onClick={handleDrawerToggle} size="small" sx={{ mr: 1, color: 'text.secondary' }}>
                <ChevronRightIcon />
              </IconButton>
            )}

            {/* Tenant Display */}
            {tenant && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    bgcolor: 'rgba(16, 185, 129, 0.1)',
                    color: 'secondary.light',
                    borderRadius: '8px',
                    px: 1.5,
                    py: 0.5,
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <FactoryIcon sx={{ fontSize: 16 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {tenant.companyName}
                  </Typography>
                </Box>
                <Badge
                  badgeContent={role?.name}
                  color={
                    role?.name === 'Super Admin' || role?.name === 'Tenant Admin' ? 'primary' : 'secondary'
                  }
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.675rem',
                      fontWeight: 700,
                      height: 18,
                      position: 'static',
                      transform: 'none',
                      px: 1,
                      borderRadius: 1,
                    },
                  }}
                />
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Quick Profile access */}
            <Tooltip title="User Profile">
              <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0.5 }}>
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    width: 32,
                    height: 32,
                    fontSize: '0.85rem',
                    fontWeight: 600,
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
              elevation={8}
              slotProps={{
                paper: {
                  sx: {
                    mt: 1.5,
                    minWidth: 200,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    bgcolor: '#0f172a',
                    backgroundImage: 'none',
                  },
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{profile?.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>{profile?.email}</Typography>
              </Box>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
              <MenuItem onClick={handleLogout} sx={{ color: 'error.light', py: 1.2 }}>
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
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
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
          p: { xs: 2.5, md: 4 },
          width: isDesktop ? `calc(100% - ${currentDrawerWidth}px)` : '100%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          mt: 8,
          pb: isMobile ? 10 : 4, // Padding at bottom for mobile nav bar
        }}
      >
        <Outlet />
      </Box>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }} elevation={10}>
          <BottomNavigation
            showLabels
            value={getActiveMobileNavIndex()}
            onChange={(_, newValue) => {
              navigate(mobileShortcuts[newValue].path);
            }}
            sx={{
              bgcolor: '#0f172a',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              height: 64,
            }}
          >
            {mobileShortcuts.map((shortcut, index) => (
              <BottomNavigationAction
                key={index}
                label={shortcut.label}
                icon={shortcut.icon}
                sx={{
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    color: 'primary.main',
                  },
                  '& .MuiBottomNavigationAction-label': {
                    fontSize: '0.725rem',
                    mt: 0.5,
                  },
                }}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
};
