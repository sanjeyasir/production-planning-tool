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

// ----------------------------------------------------
// MACHINES
// ----------------------------------------------------
export interface Machine {
  id: string;
  tenantId: string;
  plantId: string;
  machineCode: string;
  machineName: string;
  capacity: number;
  status: string; // ACTIVE, INACTIVE
  createdAt: Date;
}

export const getMachines = (tenantId: string) => listTenantCollection<Machine>('machines', tenantId);

export const createMachine = async (data: Omit<Machine, 'id' | 'createdAt'>) => {
  const colRef = collection(db, 'machines');
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: new Date()
  });
  return docRef.id;
};

export const updateMachine = async (id: string, data: Partial<Omit<Machine, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'machines', id);
  await updateDoc(docRef, data);
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
// PRODUCTION RECORDS
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
  // Audit logging deactivated per requirement
  return Promise.resolve();
};
