import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  writeBatch
} from 'firebase/firestore';

export interface SeedRole {
  id: string;
  name: string;
  permissions: string[];
}

export const DEFAULT_ROLES: SeedRole[] = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    permissions: ['*:*']
  },
  {
    id: 'tenant_admin',
    name: 'Tenant Admin',
    permissions: [
      'downtime:view', 'downtime:create', 'downtime:update', 'downtime:delete',
      'production:view', 'production:create', 'production:update', 'production:delete',
      'master:view', 'master:create', 'master:update', 'master:deactivate',
      'user:view', 'user:create', 'user:update', 'user:delete', 'user:invite'
    ]
  },
  {
    id: 'plant_manager',
    name: 'Plant Manager',
    permissions: [
      'downtime:view', 'downtime:approve',
      'production:view', 'production:approve',
      'master:view',
      'user:view'
    ]
  },
  {
    id: 'supervisor',
    name: 'Supervisor',
    permissions: [
      'downtime:view', 'downtime:create', 'downtime:update',
      'production:view', 'production:create', 'production:update',
      'master:view'
    ]
  },
  {
    id: 'operator',
    name: 'Operator',
    permissions: [
      'downtime:view', 'downtime:create'
    ]
  },
  {
    id: 'viewer',
    name: 'Viewer',
    permissions: [
      'downtime:view',
      'production:view',
      'master:view'
    ]
  }
];

// Seed global roles (run once during login or signup if missing)
export async function seedGlobalRoles() {
  try {
    const rolesCol = collection(db, 'roles');
    const snapshot = await getDocs(rolesCol);
    
    if (snapshot.empty) {
      const batch = writeBatch(db);
      DEFAULT_ROLES.forEach((role) => {
        const roleRef = doc(db, 'roles', role.id);
        batch.set(roleRef, {
          name: role.name,
          permissions: role.permissions,
          createdAt: new Date()
        });
      });
      await batch.commit();
      console.log('Global roles seeded successfully');
    }
  } catch (error) {
    console.error('Error seeding global roles:', error);
  }
}

// Seed complete demo data for a newly registered tenant
export async function seedTenantData(tenantId: string, userId: string, companyName: string) {
  try {
    const batch = writeBatch(db);
    
    // 1. Create Plants
    const plant1Id = 'plant_colombo_' + tenantId.slice(0, 5);
    const plant2Id = 'plant_galle_' + tenantId.slice(0, 5);
    
    const plant1Ref = doc(db, 'plants', plant1Id);
    batch.set(plant1Ref, {
      tenantId,
      plantName: 'Factory A - Colombo',
      location: 'Colombo Industrial Zone',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    const plant2Ref = doc(db, 'plants', plant2Id);
    batch.set(plant2Ref, {
      tenantId,
      plantName: 'Factory B - Galle',
      location: 'Galle Freeport',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    // 2. Create Product Categories
    const catApparelId = 'cat_apparel_' + tenantId.slice(0, 5);
    const catElecId = 'cat_elec_' + tenantId.slice(0, 5);
    const catAutoId = 'cat_auto_' + tenantId.slice(0, 5);

    batch.set(doc(db, 'production_categories', catApparelId), {
      tenantId,
      name: 'Apparel',
      description: 'Clothing, shirts, trousers, garments',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    batch.set(doc(db, 'production_categories', catElecId), {
      tenantId,
      name: 'Electronics',
      description: 'Circuit boards, sensors, smart displays',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    batch.set(doc(db, 'production_categories', catAutoId), {
      tenantId,
      name: 'Automotive',
      description: 'Plastic injection molded automotive parts',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    // 3. Create Downtime Categories
    const dtMechId = 'dt_mech_' + tenantId.slice(0, 5);
    const dtElecId = 'dt_elec_' + tenantId.slice(0, 5);
    const dtMatId = 'dt_mat_' + tenantId.slice(0, 5);
    const dtQualId = 'dt_qual_' + tenantId.slice(0, 5);
    const dtOpsId = 'dt_ops_' + tenantId.slice(0, 5);

    batch.set(doc(db, 'downtime_categories', dtMechId), {
      tenantId,
      name: 'Mechanical Failure',
      status: 'ACTIVE',
      createdAt: new Date()
    });
    batch.set(doc(db, 'downtime_categories', dtElecId), {
      tenantId,
      name: 'Electrical Failure',
      status: 'ACTIVE',
      createdAt: new Date()
    });
    batch.set(doc(db, 'downtime_categories', dtMatId), {
      tenantId,
      name: 'Material Shortage',
      status: 'ACTIVE',
      createdAt: new Date()
    });
    batch.set(doc(db, 'downtime_categories', dtQualId), {
      tenantId,
      name: 'Quality Re-inspection',
      status: 'ACTIVE',
      createdAt: new Date()
    });
    batch.set(doc(db, 'downtime_categories', dtOpsId), {
      tenantId,
      name: 'Operator Delay',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    // 4. Create Machines
    const mach1Id = 'mach_inj1_' + tenantId.slice(0, 5);
    const mach2Id = 'mach_inj2_' + tenantId.slice(0, 5);
    const mach3Id = 'mach_cnc1_' + tenantId.slice(0, 5);

    batch.set(doc(db, 'machines', mach1Id), {
      tenantId,
      plantId: plant1Id,
      machineCode: 'INJ-01',
      machineName: 'Injection Molding Machine 01',
      capacity: 350, // units/hr
      status: 'ACTIVE',
      createdAt: new Date()
    });

    batch.set(doc(db, 'machines', mach2Id), {
      tenantId,
      plantId: plant1Id,
      machineCode: 'INJ-02',
      machineName: 'Injection Molding Machine 02',
      capacity: 400,
      status: 'ACTIVE',
      createdAt: new Date()
    });

    batch.set(doc(db, 'machines', mach3Id), {
      tenantId,
      plantId: plant2Id,
      machineCode: 'CNC-01',
      machineName: 'High Precision CNC Milling Line',
      capacity: 120,
      status: 'ACTIVE',
      createdAt: new Date()
    });

    await batch.commit();

    // 5. Create Historical Operational Data (last 30 days)
    // We will batch-write these to avoid Firestore batch size limit of 500 documents.
    const recordsBatch = writeBatch(db);
    let docCount = 0;

    const today = new Date();
    const categories = [catApparelId, catElecId, catAutoId];
    const machines = [
      { id: mach1Id, plantId: plant1Id, code: 'INJ-01' },
      { id: mach2Id, plantId: plant1Id, code: 'INJ-02' },
      { id: mach3Id, plantId: plant2Id, code: 'CNC-01' }
    ];
    const dtCats = [dtMechId, dtElecId, dtMatId, dtQualId, dtOpsId];
    const shifts = ['Shift A', 'Shift B', 'Shift C'];
    const dtReasons: Record<string, string[]> = {
      [dtMechId]: ['Hydraulic hose leak', 'Clamping cylinder jam', 'Nozzle heater band failure'],
      [dtElecId]: ['PLC fault lock', 'Sensor calibration error', 'Power breaker trip'],
      [dtMatId]: ['Resin pellet hopper empty', 'Packaging box delay', 'Masterbatch colorant delay'],
      [dtQualId]: ['Wall thickness variance check', 'Flash trimming adjustments', 'Color check'],
      [dtOpsId]: ['Shift handover delay', 'Safety gate cleaning', 'Operator lunch cover delay']
    };

    for (let i = 29; i >= 0; i--) {
      const recordDate = new Date(today);
      recordDate.setDate(today.getDate() - i);
      recordDate.setHours(0, 0, 0, 0);

      // A) Generate Production Records for each category on this date
      categories.forEach((catId) => {
        const prodId = `prod_${tenantId.slice(0,4)}_${catId.slice(-4)}_${i}`;
        const prodRef = doc(db, 'production_records', prodId);
        
        const budget = 5000 + Math.floor(Math.random() * 2000);
        const planned = budget + (Math.random() > 0.5 ? 500 : -500);
        const actual = planned - Math.floor(Math.random() * 800);
        
        // Quality ratio: 95-99% accepted
        const rejectRate = 0.01 + Math.random() * 0.04;
        const rejected = Math.floor(actual * rejectRate);
        const accepted = actual - rejected;

        recordsBatch.set(prodRef, {
          tenantId,
          plantId: catId === catAutoId ? plant2Id : plant1Id,
          categoryId: catId,
          date: recordDate,
          budgetVolume: budget,
          plannedVolume: planned,
          actualVolume: actual,
          acceptedQuantity: accepted,
          rejectedQuantity: rejected,
          createdBy: userId,
          createdAt: new Date()
        });
        docCount++;
      });

      // B) Generate Downtime Records (not on every day, say 60% probability per machine-shift)
      machines.forEach((mach) => {
        shifts.forEach((shift) => {
          if (Math.random() < 0.25) {
            const dtId = `dt_${tenantId.slice(0,4)}_${mach.code}_${i}_${shift.replace(' ', '')}`;
            const dtRef = doc(db, 'downtime_records', dtId);
            
            const categoryId = dtCats[Math.floor(Math.random() * dtCats.length)];
            const reasons = dtReasons[categoryId];
            const reason = reasons[Math.floor(Math.random() * reasons.length)];
            
            // Random start time between 8am and 10pm
            const startHour = 8 + Math.floor(Math.random() * 12);
            const startMin = Math.floor(Math.random() * 4) * 15;
            
            const start = new Date(recordDate);
            start.setHours(startHour, startMin, 0, 0);
            
            const duration = 15 + Math.floor(Math.random() * 120); // 15 mins to 2 hours
            const end = new Date(start.getTime() + duration * 60000);

            recordsBatch.set(dtRef, {
              tenantId,
              plantId: mach.plantId,
              machineId: mach.id,
              categoryId,
              shift,
              startTime: start,
              endTime: end,
              duration,
              reason,
              remarks: 'Auto-generated demo operational log.',
              createdBy: userId,
              createdAt: new Date()
            });
            docCount++;
          }
        });
      });

      // Commit early if batch size approaches 500
      if (docCount >= 400) {
        await recordsBatch.commit();
        // Since we committed, we would need a new batch. 
        // But in client JS, recordsBatch is committed and can't be reused.
        // We will break and create a secondary batch. 
        // However, for 30 days * 3 categories = 90 docs + 30 days * 3 machines * 3 shifts * 25% = 67 docs. Total docs ~ 157.
        // So 157 is well below 500. We don't need multiple batches.
      }
    }

    if (docCount > 0) {
      await recordsBatch.commit();
    }
    console.log(`Tenant ${companyName} (${tenantId}) seeded with ${docCount} operational records.`);
  } catch (error) {
    console.error('Error seeding tenant data:', error);
  }
}
