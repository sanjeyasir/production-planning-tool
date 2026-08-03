import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Firebase
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { seedGlobalRoles } from './seed';

// State
import { useAuthStore } from './store/authStore';
import { theme } from './theme';

// Components & Guard
import { Layout } from './components/Layout';
import { GuardedRoute } from './components/GuardedRoute';

// Pages
import { Login } from './pages/Login';
import { ChangePassword } from './pages/ChangePassword';
import { Landing } from './pages/Landing';
import { DowntimeDashboard } from './pages/DowntimeDashboard';
import { ProductionDashboard } from './pages/ProductionDashboard';
import { DowntimeEntry } from './pages/DowntimeEntry';
import { ProductionEntry } from './pages/ProductionEntry';

// Masters Pages
import { Plants } from './pages/Masters/Plants';
import { Machines } from './pages/Masters/Machines';
import { Categories } from './pages/Masters/Categories';
import { Users } from './pages/Masters/Users';

// Query Client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const { setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const profile = { id: userDocSnap.id, ...userDocSnap.data() } as any;

            // Fetch Tenant
            const tenantDocRef = doc(db, 'tenants', profile.tenantId);
            const tenantDocSnap = await getDoc(tenantDocRef);
            const tenant = tenantDocSnap.exists()
              ? { id: tenantDocSnap.id, ...tenantDocSnap.data() } as any
              : null;

            // Fetch Role
            const roleDocRef = doc(db, 'roles', profile.roleId);
            const roleDocSnap = await getDoc(roleDocRef);
            const role = roleDocSnap.exists()
              ? { id: roleDocSnap.id, ...roleDocSnap.data() } as any
              : null;

            setAuth(user, profile, tenant, role);
          } else {
            // Profile doc doesn't exist yet, check if it's the default admin account
            if (user.email === 'admin@gmail.com') {
              const tenantId = 'admin_tenant_gmail';
              
              // Seed global roles if missing
              await seedGlobalRoles();

              // Create Tenant Profile
              await setDoc(doc(db, 'tenants', tenantId), {
                companyName: 'Main Plant Operations',
                subscriptionPlan: 'ENTERPRISE',
                status: 'ACTIVE',
                createdAt: new Date(),
              });

              // Create User Profile
              await setDoc(doc(db, 'users', user.uid), {
                tenantId,
                name: 'Administrator',
                email: 'admin@gmail.com',
                roleId: 'tenant_admin',
                status: 'ACTIVE',
                createdAt: new Date(),
              });

              // Retrieve role details
              const roleDocRef = doc(db, 'roles', 'tenant_admin');
              const roleDocSnap = await getDoc(roleDocRef);
              const role = roleDocSnap.exists()
                ? { id: roleDocSnap.id, ...roleDocSnap.data() } as any
                : null;

              const profile = {
                id: user.uid,
                tenantId,
                name: 'Administrator',
                email: 'admin@gmail.com',
                roleId: 'tenant_admin',
                status: 'ACTIVE',
                createdAt: new Date(),
              } as any;

              const tenant = {
                id: tenantId,
                companyName: 'Main Plant Operations',
                subscriptionPlan: 'ENTERPRISE',
                status: 'ACTIVE',
                createdAt: new Date(),
              } as any;

              setAuth(user, profile, tenant, role);
            } else {
              // Standard profile missing fallback (handled during custom registration)
              setAuth(user, null, null, null);
            }
          }
        } catch (error) {
          console.error('Error synchronizing auth state:', error);
          clearAuth();
        }
      } else {
        clearAuth();
      }
    });

    return () => unsubscribe();
  }, [setAuth, clearAuth, setLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<GuardedRoute><ChangePassword /></GuardedRoute>} />

            {/* Protected SaaS App Routes */}
            <Route
              path="/"
              element={
                <GuardedRoute>
                  <Layout />
                </GuardedRoute>
              }
            >
              {/* Operations & Dashboards */}
              <Route
                index
                element={
                  <GuardedRoute>
                    <Landing />
                  </GuardedRoute>
                }
              />
              <Route
                path="downtime-dashboard"
                element={
                  <GuardedRoute module="downtime" action="view">
                    <DowntimeDashboard />
                  </GuardedRoute>
                }
              />
              <Route
                path="production-dashboard"
                element={
                  <GuardedRoute module="production" action="view">
                    <ProductionDashboard />
                  </GuardedRoute>
                }
              />
              <Route
                path="downtime-entry"
                element={
                  <GuardedRoute module="downtime" action="create">
                    <DowntimeEntry />
                  </GuardedRoute>
                }
              />
              <Route
                path="production-entry"
                element={
                  <GuardedRoute module="production" action="create">
                    <ProductionEntry />
                  </GuardedRoute>
                }
              />

              {/* Master Data Administration */}
              <Route
                path="plants"
                element={
                  <GuardedRoute module="master" action="view">
                    <Plants />
                  </GuardedRoute>
                }
              />
              <Route
                path="machines"
                element={
                  <GuardedRoute module="master" action="view">
                    <Machines />
                  </GuardedRoute>
                }
              />
              <Route
                path="categories"
                element={
                  <GuardedRoute module="master" action="view">
                    <Categories />
                  </GuardedRoute>
                }
              />
              <Route
                path="users"
                element={
                  <GuardedRoute module="user" action="view">
                    <Users />
                  </GuardedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
