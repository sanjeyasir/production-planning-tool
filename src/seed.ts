import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  query,
  where,
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

// Seed Toyo Dedicated Multi-Plant, Variable Dynamic Machine Master & Operational Data
export async function seedToyoData() {
  try {
    const toyoTenantId = 'toyo';
    
    // Check if Toyo tenant exists
    const toyoTenantRef = doc(db, 'tenants', toyoTenantId);
    await setDoc(toyoTenantRef, {
      companyName: 'Toyo Manufacturing',
      subscriptionPlan: 'ENTERPRISE',
      status: 'ACTIVE',
      createdAt: new Date()
    }, { merge: true });

    // Check if Toyo machines already exist
    const machSnap = await getDocs(query(collection(db, 'machines'), where('tenantId', '==', toyoTenantId)));
    if (!machSnap.empty) {
      console.log('Toyo data already seeded.');
      return;
    }

    const batch = writeBatch(db);

    // 1. Toyo Plants
    const plantBiyagamaId = 'plant_toyo_biyagama';
    const plantKatunayakeId = 'plant_toyo_katunayake';

    batch.set(doc(db, 'plants', plantBiyagamaId), {
      tenantId: toyoTenantId,
      plantName: 'Toyo Plant 1 - Biyagama',
      location: 'Biyagama Export Processing Zone',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    batch.set(doc(db, 'plants', plantKatunayakeId), {
      tenantId: toyoTenantId,
      plantName: 'Toyo Plant 2 - Katunayake',
      location: 'Katunayake Free Trade Zone',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    // 2. Toyo Categories
    const catExtId = 'cat_toyo_ext';
    const catMoldId = 'cat_toyo_mold';
    const catAssyId = 'cat_toyo_assy';

    batch.set(doc(db, 'production_categories', catExtId), {
      tenantId: toyoTenantId,
      name: 'Precision Extrusions',
      description: 'Multi-layer high-spec polymer tubing and profiles',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    batch.set(doc(db, 'production_categories', catMoldId), {
      tenantId: toyoTenantId,
      name: 'Technical Moldings',
      description: 'Automotive and electronics precision enclosures',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    batch.set(doc(db, 'production_categories', catAssyId), {
      tenantId: toyoTenantId,
      name: 'Automated Assemblies',
      description: 'Cleanroom component assembly and packaging',
      status: 'ACTIVE',
      createdAt: new Date()
    });

    // 3. Toyo Machines (Initial Base Capacities)
    const toyoMachines = [
      {
        id: 'toyo_ext_01',
        plantId: plantBiyagamaId,
        categoryId: catExtId,
        code: 'TOYO-EXT-01',
        name: 'Twin-Screw Extruder Alpha',
        dailyCap: 3500,
        hours: 24
      },
      {
        id: 'toyo_ext_02',
        plantId: plantBiyagamaId,
        categoryId: catExtId,
        code: 'TOYO-EXT-02',
        name: 'High-Speed Extruder Beta',
        dailyCap: 4200,
        hours: 24
      },
      {
        id: 'toyo_mold_01',
        plantId: plantKatunayakeId,
        categoryId: catMoldId,
        code: 'TOYO-MOLD-01',
        name: 'Micro-Molding Press 120T',
        dailyCap: 2800,
        hours: 20
      },
      {
        id: 'toyo_cnc_01',
        plantId: plantKatunayakeId,
        categoryId: catAssyId,
        code: 'TOYO-CNC-01',
        name: 'Robotic Machining Cell 01',
        dailyCap: 1600,
        hours: 16
      },
      {
        id: 'toyo_pack_01',
        plantId: plantBiyagamaId,
        categoryId: catAssyId,
        code: 'TOYO-PACK-01',
        name: 'Cleanroom Pouch & Pack Line',
        dailyCap: 5000,
        hours: 24
      }
    ];

    toyoMachines.forEach(m => {
      batch.set(doc(db, 'machines', m.id), {
        tenantId: toyoTenantId,
        plantId: m.plantId,
        categoryId: m.categoryId,
        machineCode: m.code,
        machineName: m.name,
        operatingHours: m.hours,
        dailyCapacity: m.dailyCap,
        capacity: Math.round(m.dailyCap / m.hours),
        status: 'ACTIVE',
        createdAt: new Date()
      });
    });

    // 4. Toyo Production Orders
    const sampleToyoOrders = [
      {
        id: 'toyo_po_901',
        orderNumber: 'TYO-PO-9001',
        customerName: 'AeroTech Systems',
        productName: 'Ultra-Flex Micro Tubing 4mm',
        categoryId: catExtId,
        quantity: 18000,
        deliveryDate: new Date(Date.now() + 7 * 86400000),
        priority: 'HIGH',
        status: 'PENDING'
      },
      {
        id: 'toyo_po_902',
        orderNumber: 'TYO-PO-9002',
        customerName: 'Apex Precision Devices',
        productName: 'Connector Base Shells',
        categoryId: catMoldId,
        quantity: 12500,
        deliveryDate: new Date(Date.now() + 10 * 86400000),
        priority: 'MEDIUM',
        status: 'PENDING'
      },
      {
        id: 'toyo_po_903',
        orderNumber: 'TYO-PO-9003',
        customerName: 'MediDevice Global',
        productName: 'Sterile Delivery Nozzles',
        categoryId: catAssyId,
        quantity: 9000,
        deliveryDate: new Date(Date.now() + 5 * 86400000),
        priority: 'HIGH',
        status: 'PENDING'
      }
    ];

    sampleToyoOrders.forEach(po => {
      batch.set(doc(db, 'production_orders', po.id), {
        tenantId: toyoTenantId,
        orderNumber: po.orderNumber,
        customerName: po.customerName,
        productName: po.productName,
        categoryId: po.categoryId,
        quantity: po.quantity,
        targetDeliveryDate: po.deliveryDate,
        priority: po.priority,
        status: po.status,
        createdAt: new Date()
      });
    });

    await batch.commit();

    // 5. Toyo Day-to-Day Variable Machine Capacities (Day-by-Day schedule for next 14 days)
    const capBatch = writeBatch(db);
    const today = new Date();

    // Pre-populate daily variations: capacity varies day-to-day!
    for (let dayOffset = -3; dayOffset <= 14; dayOffset++) {
      const curDate = new Date(today);
      curDate.setDate(today.getDate() + dayOffset);
      const dateStr = curDate.toISOString().split('T')[0];
      const dayOfWeek = curDate.getDay(); // 0 is Sun, 6 is Sat

      toyoMachines.forEach(mach => {
        let dailyCap = mach.dailyCap;
        let reason = 'Standard scheduled operation';
        let opHours = mach.hours;

        if (dayOfWeek === 0) {
          // Sunday: reduced or maintenance
          dailyCap = Math.round(mach.dailyCap * 0.5);
          opHours = Math.round(mach.hours * 0.5);
          reason = 'Sunday planned maintenance & mold wash';
        } else if (dayOfWeek === 6) {
          // Saturday: half or partial overtime
          dailyCap = Math.round(mach.dailyCap * 0.85);
          reason = 'Weekend shift adjustments';
        } else if (dayOffset === 2 && mach.code === 'TOYO-EXT-01') {
          // Specific day variance
          dailyCap = 2800; // lower
          reason = 'Resin grade switchover & purge';
        } else if (dayOffset === 3 && mach.code === 'TOYO-EXT-02') {
          dailyCap = 4800; // peak surge
          reason = 'Extended high-flow run with dual feeders';
        } else if (dayOffset === 5 && mach.code === 'TOYO-MOLD-01') {
          dailyCap = 2100;
          reason = 'Heater band calibration & sensor check';
        }

        const docId = `${mach.id}_${dateStr}`;
        capBatch.set(doc(db, 'machine_daily_capacities', docId), {
          tenantId: toyoTenantId,
          machineId: mach.id,
          machineCode: mach.code,
          dateStr,
          operatingHours: opHours,
          dailyCapacity: dailyCap,
          baseDailyCapacity: mach.dailyCap,
          variance: dailyCap - mach.dailyCap,
          plannedEfficiency: Math.round((dailyCap / mach.dailyCap) * 100),
          reason,
          notes: 'Configured via Toyo Daily Capacity Master',
          updatedAt: new Date()
        });
      });
    }

    await capBatch.commit();
    console.log('Toyo dynamic machine master and operational data seeded successfully.');
  } catch (error) {
    console.error('Error seeding Toyo data:', error);
  }
}

// Master seeder for all companies and accounts
export async function seedAllCompaniesAndRoles() {
  await seedGlobalRoles();
  await seedToyoData();
}

