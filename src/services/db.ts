import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp 
} from 'firebase/firestore';

// Helper to convert Firestore timestamps to JS Dates
export const formatDoc = <T>(docSnap: any): T => {
  const data = docSnap.data();
  // Map timestamps to Date objects
  const formatted: any = { ...data, id: docSnap.id };
  for (const key in formatted) {
    if (formatted[key] instanceof Timestamp) {
      formatted[key] = formatted[key].toDate();
    }
  }
  return formatted as T;
};

// ----------------------------------------------------
// LOCAL DATE HELPERS (Prevents UTC timezone shifts)
// ----------------------------------------------------
export const parseDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d?.toDate) return d.toDate();
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  return new Date(d);
};

export const toLocalDateString = (d: any): string => {
  if (!d) return new Date().toISOString().split('T')[0];
  const date = parseDate(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return new Date(dateStr);
};

// Generic list query for a tenant
const listTenantCollection = async <T>(collectionName: string, tenantId: string): Promise<T[]> => {
  const colRef = collection(db, collectionName);
  const q = query(colRef, where('tenantId', '==', tenantId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => formatDoc<T>(doc));
};

// ----------------------------------------------------
// PLANTS
// ----------------------------------------------------
export interface Plant {
  id: string;
  tenantId: string;
  plantName: string;
  location: string;
  status: string; // ACTIVE, INACTIVE
  createdAt: Date;
}

export const getPlants = (tenantId: string) => listTenantCollection<Plant>('plants', tenantId);

export const createPlant = async (data: Omit<Plant, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'plants');
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: new Date()
  });
  return docRef.id;
};

export const updatePlant = async (id: string, data: Partial<Omit<Plant, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'plants', id);
  await updateDoc(docRef, data);
};

export const deletePlant = async (id: string) => {
  const docRef = doc(db, 'plants', id);
  await deleteDoc(docRef);
};

// ----------------------------------------------------
// MACHINES
// ----------------------------------------------------
export interface Machine {
  id: string;
  tenantId: string;
  plantId: string;
  categoryId?: string; // Associated production category ID
  machineCode: string;
  machineName: string;
  capacity?: number; // legacy hourly speed in units/hr
  operatingHours: number; // 12 or 24 hours/day (default 24)
  dailyCapacity: number; // Daily output volume in units/day
  status: string; // ACTIVE, INACTIVE
  createdAt: Date;
}

export const getMachines = async (tenantId: string): Promise<Machine[]> => {
  const list = await listTenantCollection<Machine>('machines', tenantId);
  return list.map(m => {
    const opHours = m.operatingHours || 24;
    const dailyCap = m.dailyCapacity ?? ((m.capacity || 0) * opHours);
    return {
      ...m,
      categoryId: m.categoryId || '',
      operatingHours: opHours,
      dailyCapacity: dailyCap,
      capacity: Math.round(dailyCap / opHours)
    };
  });
};

export const createMachine = async (data: Omit<Machine, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'machines');
  const operatingHours = data.operatingHours || 24;
  const dailyCapacity = data.dailyCapacity !== undefined 
    ? Number(data.dailyCapacity) 
    : (data.capacity ? Number(data.capacity) * operatingHours : 0);
  const capacity = Math.round(dailyCapacity / operatingHours);
  
  const docRef = await addDoc(colRef, {
    ...data,
    categoryId: data.categoryId || '',
    operatingHours,
    dailyCapacity,
    capacity,
    createdAt: new Date()
  });
  return docRef.id;
};

export const updateMachine = async (id: string, data: Partial<Omit<Machine, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'machines', id);
  const updateData: any = { ...data };
  
  const opHours = data.operatingHours !== undefined ? Number(data.operatingHours) : undefined;
  if (data.dailyCapacity !== undefined) {
    updateData.dailyCapacity = Number(data.dailyCapacity);
    const hours = opHours || 24;
    updateData.capacity = Math.round(updateData.dailyCapacity / hours);
  } else if (data.capacity !== undefined) {
    const hours = opHours || 24;
    updateData.dailyCapacity = Number(data.capacity) * hours;
    updateData.capacity = Number(data.capacity);
  }
  
  if (opHours !== undefined) {
    updateData.operatingHours = opHours;
  }
  if (data.categoryId !== undefined) {
    updateData.categoryId = data.categoryId;
  }
  
  await updateDoc(docRef, updateData);
};

export const deleteMachine = async (id: string) => {
  const docRef = doc(db, 'machines', id);
  await deleteDoc(docRef);
};

// ----------------------------------------------------
// PRODUCTION CATEGORIES
// ----------------------------------------------------
export interface ProductionCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: string;
  createdAt: Date;
}

export const getProductionCategories = (tenantId: string) => 
  listTenantCollection<ProductionCategory>('production_categories', tenantId);

export const createProductionCategory = async (data: Omit<ProductionCategory, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'production_categories');
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: new Date()
  });
  return docRef.id;
};

export const updateProductionCategory = async (id: string, data: Partial<Omit<ProductionCategory, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'production_categories', id);
  await updateDoc(docRef, data);
};

export const deleteProductionCategory = async (id: string) => {
  const docRef = doc(db, 'production_categories', id);
  await deleteDoc(docRef);
};

// ----------------------------------------------------
// DOWNTIME CATEGORIES
// ----------------------------------------------------
export interface DowntimeCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: string;
  createdAt: Date;
}

export const getDowntimeCategories = (tenantId: string) => 
  listTenantCollection<DowntimeCategory>('downtime_categories', tenantId);

export const createDowntimeCategory = async (data: Omit<DowntimeCategory, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'downtime_categories');
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: new Date()
  });
  return docRef.id;
};

export const updateDowntimeCategory = async (id: string, data: Partial<Omit<DowntimeCategory, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'downtime_categories', id);
  await updateDoc(docRef, data);
};

export const deleteDowntimeCategory = async (id: string) => {
  const docRef = doc(db, 'downtime_categories', id);
  await deleteDoc(docRef);
};

// ----------------------------------------------------
// USERS & ROLES
// ----------------------------------------------------
export interface UserDoc {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roleId: string;
  status: string;
  createdAt: Date;
}

export const getUsers = (tenantId: string) => listTenantCollection<UserDoc>('users', tenantId);

export const updateUserRole = async (userId: string, roleId: string) => {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, { roleId });
};

export const updateUserStatus = async (userId: string, status: string) => {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, { status });
};

// ----------------------------------------------------
// DOWNTIME RECORDS
// ----------------------------------------------------
export interface DowntimeRecord {
  id: string;
  tenantId: string;
  plantId: string;
  machineId: string;
  categoryId: string;
  shift: string;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  dateStr?: string;
  reason: string;
  remarks?: string;
  createdBy: string;
  createdAt: Date;
}

export const getDowntimeRecords = (tenantId: string) => 
  listTenantCollection<DowntimeRecord>('downtime_records', tenantId);

export const createDowntimeRecord = async (data: Omit<DowntimeRecord, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'downtime_records');
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: new Date()
  });
  return docRef.id;
};

export const updateDowntimeRecord = async (id: string, data: Partial<Omit<DowntimeRecord, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'downtime_records', id);
  await updateDoc(docRef, data);
};

export const deleteDowntimeRecord = async (id: string) => {
  const docRef = doc(db, 'downtime_records', id);
  await deleteDoc(docRef);
};

// ----------------------------------------------------
// PRODUCTION RECORDS (Daily Category / Plant output)
// ----------------------------------------------------
export interface ProductionRecord {
  id: string;
  tenantId: string;
  plantId: string;
  categoryId: string;
  date: Date;
  budgetVolume: number;
  plannedVolume: number;
  actualVolume: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  createdBy: string;
  createdAt: Date;
}

export const getProductionRecords = (tenantId: string) => 
  listTenantCollection<ProductionRecord>('production_records', tenantId);

export const createProductionRecord = async (data: Omit<ProductionRecord, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'production_records');
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: new Date()
  });
  return docRef.id;
};

export const updateProductionRecord = async (id: string, data: Partial<Omit<ProductionRecord, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'production_records', id);
  await updateDoc(docRef, data);
};

export const deleteProductionRecord = async (id: string) => {
  const docRef = doc(db, 'production_records', id);
  await deleteDoc(docRef);
};

// ----------------------------------------------------
// AUDIT LOGGING
// ----------------------------------------------------
export interface AuditLogDoc {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  oldValues?: any;
  newValues?: any;
  createdAt: Date;
}

export const getAuditLogs = async (tenantId: string): Promise<AuditLogDoc[]> => {
  const colRef = collection(db, 'audit_logs');
  const q = query(
    colRef, 
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => formatDoc<AuditLogDoc>(doc));
};

export const logActivity = async (
  _tenantId: string, 
  _userId: string, 
  _userName: string, 
  _action: string, 
  _details: string,
  _oldValues?: any,
  _newValues?: any
) => {
  return Promise.resolve();
};

// ----------------------------------------------------
// PRODUCTION ORDERS
// ----------------------------------------------------
export interface ProductionOrder {
  id: string;
  tenantId: string;
  orderNumber: string;
  productName: string;
  categoryId: string;
  quantity: number;
  dueDate: Date;
  status: 'PENDING' | 'DRAFT_PLANNED' | 'SCHEDULED' | 'COMPLETED';
  createdAt: Date;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
}

export const getProductionOrders = (tenantId: string) => 
  listTenantCollection<ProductionOrder>('production_orders', tenantId);

export const createProductionOrder = async (data: Omit<ProductionOrder, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'production_orders');
  const docRef = await addDoc(colRef, {
    ...data,
    status: data.status || 'PENDING',
    createdAt: new Date()
  });
  return docRef.id;
};

export const updateProductionOrder = async (id: string, data: Partial<Omit<ProductionOrder, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'production_orders', id);
  await updateDoc(docRef, data);
};

export const deleteProductionOrder = async (id: string) => {
  const docRef = doc(db, 'production_orders', id);
  await deleteDoc(docRef);
};

// ----------------------------------------------------
// FACTORY HOLIDAYS
// ----------------------------------------------------
export interface Holiday {
  id: string;
  tenantId: string;
  date: Date;
  dateStr?: string; // YYYY-MM-DD
  name: string;
  createdAt: Date;
}

export const getHolidays = async (tenantId: string): Promise<Holiday[]> => {
  const holidays = await listTenantCollection<Holiday>('holidays', tenantId);
  return holidays.map(h => ({
    ...h,
    dateStr: toLocalDateString(h.date)
  }));
};

export const createHoliday = async (data: { tenantId: string; date: Date; name: string }) => {
  const colRef = collection(db, 'holidays');
  const dateStr = toLocalDateString(data.date);
  const localDate = parseLocalDate(dateStr);
  const docRef = await addDoc(colRef, {
    tenantId: data.tenantId,
    name: data.name.trim(),
    date: localDate,
    dateStr,
    createdAt: new Date()
  });
  return docRef.id;
};

export const updateHoliday = async (id: string, data: { name?: string; date?: Date | string }) => {
  const docRef = doc(db, 'holidays', id);
  const updateData: any = {};
  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }
  if (data.date !== undefined) {
    const dateStr = toLocalDateString(data.date);
    const localDate = parseLocalDate(dateStr);
    updateData.date = localDate;
    updateData.dateStr = dateStr;
  }
  await updateDoc(docRef, updateData);
};

export const deleteHoliday = async (id: string) => {
  const docRef = doc(db, 'holidays', id);
  await deleteDoc(docRef);
};

// ----------------------------------------------------
// PRODUCTION PLANS (Daily Volume Based)
// ----------------------------------------------------
export interface ProductionPlan {
  id: string;
  tenantId: string;
  orderId: string;
  machineId: string;
  startDate: Date;
  endDate: Date;
  type: 'CONFIRMED' | 'DRAFT' | 'SIMULATED';
  plannedDailyRate: number; // daily target capacity volume
  plannedHourlyRate?: number; // hourly reference
  totalPlannedDays: number;
  totalPlannedVolume: number;
  operatingHoursPerDay: number; // 12 or 24
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dailyVolumeOverrides?: Record<string, number>; // dateStr -> volume for each day
  notes?: string;
  createdAt: Date;
}

export const getProductionPlans = (tenantId: string) => 
  listTenantCollection<ProductionPlan>('production_plans', tenantId);

export const createProductionPlan = async (data: Omit<ProductionPlan, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'production_plans');
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: new Date()
  });
  return docRef.id;
};

export const updateProductionPlan = async (id: string, data: Partial<Omit<ProductionPlan, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'production_plans', id);
  await updateDoc(docRef, data);
};

export const deleteProductionPlan = async (id: string) => {
  const docRef = doc(db, 'production_plans', id);
  await deleteDoc(docRef);
};

export const hasActiveJobOnDate = ({
  machineId,
  dateStr,
  plans,
  holidays = [],
}: {
  machineId: string;
  dateStr: string;
  plans: ProductionPlan[];
  holidays?: Holiday[];
}): boolean => {
  const holidayMap: Record<string, boolean> = {};
  holidays.forEach(h => {
    const dStr = h.dateStr || toLocalDateString(h.date);
    holidayMap[dStr] = true;
  });

  return plans.some(p => {
    if (p.machineId !== machineId || p.status === 'CANCELLED') return false;
    const pStartStr = toLocalDateString(p.startDate);
    const pEndStr = toLocalDateString(p.endDate);

    if (p.dailyVolumeOverrides && p.dailyVolumeOverrides[dateStr] !== undefined) {
      return Number(p.dailyVolumeOverrides[dateStr]) > 0;
    }

    if (pStartStr <= dateStr && dateStr <= pEndStr) {
      if (holidayMap[dateStr]) return false;
      return (Number(p.plannedDailyRate) > 0 || Number(p.totalPlannedVolume) > 0);
    }
    return false;
  });
};

export const shiftMachinePlansByWorkingDays = async ({
  machineId,
  fromDateStr,
  direction = 'forward',
  holidays,
  plans,
}: {
  machineId: string;
  fromDateStr: string;
  direction?: 'forward' | 'backward';
  holidays: Holiday[];
  plans: ProductionPlan[];
}) => {
  const holidayMap: Record<string, boolean> = {};
  holidays.forEach(h => {
    const dStr = h.dateStr || toLocalDateString(h.date);
    holidayMap[dStr] = true;
  });

  const getShiftedDate = (dStr: string, dir: 'forward' | 'backward'): string => {
    const d = parseLocalDate(dStr);
    const step = dir === 'forward' ? 1 : -1;
    d.setDate(d.getDate() + step);
    while (holidayMap[toLocalDateString(d)]) {
      d.setDate(d.getDate() + step);
    }
    return toLocalDateString(d);
  };

  const affectedPlans = plans.filter(p => {
    if (p.machineId !== machineId || p.status === 'CANCELLED') return false;
    const pEnd = toLocalDateString(p.endDate);
    return pEnd >= fromDateStr;
  });

  let shiftedCount = 0;

  for (const plan of affectedPlans) {
    const pStartStr = toLocalDateString(plan.startDate);
    const pEndStr = toLocalDateString(plan.endDate);
    const hasOverrides = !!(plan.dailyVolumeOverrides && Object.keys(plan.dailyVolumeOverrides).length > 0);

    const oldOverrides: Record<string, number> = {};
    if (hasOverrides && plan.dailyVolumeOverrides) {
      Object.assign(oldOverrides, plan.dailyVolumeOverrides);
    } else {
      const cur = parseLocalDate(pStartStr);
      const end = parseLocalDate(pEndStr);
      while (cur <= end) {
        const dStr = toLocalDateString(cur);
        if (!holidayMap[dStr]) {
          oldOverrides[dStr] = Number(plan.plannedDailyRate) || 0;
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    const newOverrides: Record<string, number> = {};
    const dateKeys = Object.keys(oldOverrides).sort();

    // Dates strictly before fromDateStr stay as they are
    dateKeys.forEach(dStr => {
      if (dStr < fromDateStr) {
        newOverrides[dStr] = oldOverrides[dStr];
      }
    });

    // Dates >= fromDateStr are shifted
    // When shifting forward: process descending to avoid overwriting future dates
    // When shifting backward: process ascending to avoid overwriting earlier dates
    const datesToShift = dateKeys.filter(dStr => dStr >= fromDateStr);
    if (direction === 'forward') {
      datesToShift.sort((a, b) => b.localeCompare(a));
    } else {
      datesToShift.sort((a, b) => a.localeCompare(b));
    }

    datesToShift.forEach(dStr => {
      const vol = oldOverrides[dStr];
      if (vol > 0) {
        const shiftedDStr = getShiftedDate(dStr, direction);
        newOverrides[shiftedDStr] = (newOverrides[shiftedDStr] || 0) + vol;
      }
    });

    // Compute new start, end, total volume, total days
    const activeDates = Object.keys(newOverrides).filter(d => newOverrides[d] > 0).sort();
    if (activeDates.length > 0) {
      const newStart = parseLocalDate(activeDates[0]);
      const newEnd = parseLocalDate(activeDates[activeDates.length - 1]);
      const totalVol = activeDates.reduce((sum, d) => sum + newOverrides[d], 0);
      const totalDays = activeDates.length;
      const avgDailyRate = Math.round(totalVol / Math.max(1, totalDays));

      await updateProductionPlan(plan.id, {
        startDate: newStart,
        endDate: newEnd,
        dailyVolumeOverrides: newOverrides,
        totalPlannedVolume: totalVol,
        totalPlannedDays: totalDays,
        plannedDailyRate: avgDailyRate
      });
      shiftedCount++;
    }
  }

  return { shiftedCount, affectedPlansCount: affectedPlans.length };
};

export const shiftMachinePlansByOneWorkingDay = async (params: {
  machineId: string;
  fromDateStr: string;
  holidays: Holiday[];
  plans: ProductionPlan[];
}) => {
  return shiftMachinePlansByWorkingDays({ ...params, direction: 'forward' });
};

// ----------------------------------------------------
// DAILY PRODUCTION LOGS (Replacing Hourly Production)
// ----------------------------------------------------
export interface DailyProduction {
  id: string;
  tenantId: string;
  planId: string;
  orderId?: string;
  machineId?: string;
  date: Date;
  dateStr?: string; // YYYY-MM-DD
  targetVolume: number;
  actualVolume: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  downtimeMinutes?: number;
  notes?: string;
  enteredBy?: string;
  enteredByEmail?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export const getDailyProductions = async (tenantId: string): Promise<DailyProduction[]> => {
  const logs = await listTenantCollection<DailyProduction>('daily_production', tenantId);
  return logs.map(l => ({
    ...l,
    dateStr: toLocalDateString(l.date)
  }));
};

export const createDailyProduction = async (data: Omit<DailyProduction, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'daily_production');
  const dateStr = toLocalDateString(data.date);
  const docRef = await addDoc(colRef, {
    ...data,
    dateStr,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return docRef.id;
};

export const updateDailyProduction = async (id: string, data: Partial<Omit<DailyProduction, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'daily_production', id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date()
  });
};

export const deleteDailyProduction = async (id: string) => {
  const docRef = doc(db, 'daily_production', id);
  await deleteDoc(docRef);
};

// Legacy compatibility shim for hourly productions if referenced elsewhere
export interface HourlyProduction {
  id: string;
  tenantId: string;
  planId: string;
  date: Date;
  hour: number;
  budget: number;
  actual: number;
  createdAt: Date;
}
export const getHourlyProductions = (tenantId: string) => listTenantCollection<HourlyProduction>('hourly_production', tenantId);
export const createHourlyProduction = async (data: Omit<HourlyProduction, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'hourly_production');
  const docRef = await addDoc(colRef, { ...data, createdAt: new Date() });
  return docRef.id;
};
export const updateHourlyProduction = async (id: string, data: Partial<Omit<HourlyProduction, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'hourly_production', id);
  await updateDoc(docRef, data);
};
export const deleteHourlyProduction = async (id: string) => {
  const docRef = doc(db, 'hourly_production', id);
  await deleteDoc(docRef);
};

// ----------------------------------------------------
// TRANSACTIONAL DATA CLEANER (Maintains Master Data)
// ----------------------------------------------------
export const clearTenantTransactionalData = async (tenantId: string) => {
  const collectionsToClear = [
    'production_plans',
    'hourly_production',
    'daily_production',
    'production_records',
    'downtime_records',
  ];

  const results: Record<string, number> = {};

  for (const colName of collectionsToClear) {
    const colRef = collection(db, colName);
    const q = query(colRef, where('tenantId', '==', tenantId));
    const snapshot = await getDocs(q);
    let count = 0;
    for (const docSnap of snapshot.docs) {
      await deleteDoc(docSnap.ref);
      count++;
    }
    results[colName] = count;
  }

  // Reset production orders status back to PENDING
  const ordersRef = collection(db, 'production_orders');
  const qOrders = query(ordersRef, where('tenantId', '==', tenantId));
  const ordersSnap = await getDocs(qOrders);
  let orderCount = 0;
  for (const docSnap of ordersSnap.docs) {
    await updateDoc(docSnap.ref, { status: 'PENDING' });
    orderCount++;
  }
  results['production_orders_reset'] = orderCount;

  return results;
};

