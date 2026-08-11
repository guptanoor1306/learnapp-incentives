import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import { profiles, incentiveCycles, goals, cheers } from './schema.ts';
import { and, eq, ilike, isNull } from 'drizzle-orm';
import { getPoolConfig } from './poolConfig.ts';

const FRESH_RESET = process.argv.includes('--fresh');
const REMOVED_EMAILS = [
  'aayush.srivastava@learnapp.com',
  'pratik@learnapp.com',
  'amardeep@learnapp.com',
];

dotenv.config();

const pool = new Pool(getPoolConfig());

const db = drizzle(pool);

async function runSeed() {
  console.log('Starting employee + cycle seed...');

  async function createOrUpdateUser(userData: {
    fullName: string;
    email: string;
    jobTitle: string;
    department: string;
    role: string;
    managerEmail?: string;
  }) {
    let uid = '';
    const existing = await db.select().from(profiles).where(eq(profiles.email, userData.email)).limit(1);
    if (existing.length > 0) {
      uid = existing[0].id;
    } else {
      uid = crypto.randomUUID();
    }

    let managerId: string | null = null;
    if (userData.managerEmail) {
      const mgrList = await db.select().from(profiles).where(eq(profiles.email, userData.managerEmail)).limit(1);
      if (mgrList.length > 0) {
        managerId = mgrList[0].id;
      }
    }

    const profileFields = {
      fullName: userData.fullName,
      jobTitle: userData.jobTitle,
      department: userData.department,
      role: userData.role,
      managerId: managerId,
      mustChangePassword: false,
    };

    if (existing.length > 0) {
      await db.update(profiles).set(profileFields).where(eq(profiles.id, uid));
      console.log(`Updated profile: ${userData.fullName} (${userData.email})`);
    } else {
      await db.insert(profiles).values({
        id: uid,
        email: userData.email,
        isActive: true,
        ...profileFields,
      });
      console.log(`Created profile: ${userData.fullName} (${userData.email})`);
    }

    return uid;
  }

  try {
    if (FRESH_RESET) {
      console.warn('WARNING: --fresh flag set. Wiping goals, cycles, and all profiles...');
      await db.delete(goals);
      await db.delete(incentiveCycles);
      await db.update(profiles).set({ managerId: null });
      await db.delete(profiles);
    } else {
      console.log('Safe seed mode: preserving existing goals and proofs. Pass --fresh to wipe everything.');
    }

    // Seed users
    console.log('Seeding employees...');
    
    const adminId = await createOrUpdateUser({
      fullName: 'Noor Gupta',
      email: 'noor@learnapp.com',
      jobTitle: 'Product Manager',
      department: 'Product',
      role: 'manager',
    });

    // Partnerships Department
    const abhishekRId = await createOrUpdateUser({
      fullName: 'Abhishek Rathore',
      email: 'abhishek@learnapp.com',
      jobTitle: '',
      department: 'Partnerships',
      role: 'employee',
      managerEmail: 'noor@learnapp.com',
    });

    // Zerodha Online (Renamed from B2B)
    const anjaliRId = await createOrUpdateUser({
      fullName: 'Anjali Rawat',
      email: 'anjali@learnapp.com',
      jobTitle: '',
      department: 'Zerodha Online',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const dheerajId = await createOrUpdateUser({
      fullName: 'Dheeraj',
      email: 'dheeraj.rajvania@learnapp.com',
      jobTitle: '',
      department: 'Zerodha Online',
      role: 'employee',
      managerEmail: 'anjali@learnapp.com',
    });

    const satyavratSId = await createOrUpdateUser({
      fullName: 'Satyavrat Sharma',
      email: 'satyavrat.sharma@learnapp.com',
      jobTitle: '',
      department: 'Zerodha Online',
      role: 'employee',
      managerEmail: 'anjali@learnapp.com',
    });

    const swatiJId = await createOrUpdateUser({
      fullName: 'Swati Juyal',
      email: 'swatijuyal@learnapp.com',
      jobTitle: '',
      department: 'Zerodha Online',
      role: 'employee',
      managerEmail: 'anjali@learnapp.com',
    });

    await createOrUpdateUser({
      fullName: 'Deepak Ch.',
      email: 'deepak@learnapp.com',
      jobTitle: '',
      department: 'Zerodha Online',
      role: 'employee',
      managerEmail: 'anjali@learnapp.com',
    });

    // Varsity Team
    const apoorvSId = await createOrUpdateUser({
      fullName: 'Apoorv Suman',
      email: 'Apoorv.suman@learnapp.com',
      jobTitle: '',
      department: 'Varsity',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const aalimId = await createOrUpdateUser({
      fullName: 'Aalim',
      email: 'aalim.abbasi@learnapp.com',
      jobTitle: '',
      department: 'Varsity',
      role: 'employee',
      managerEmail: 'Apoorv.suman@learnapp.com',
    });

    const anmolAId = await createOrUpdateUser({
      fullName: 'Anmol Anand',
      email: 'anmol@learnapp.com',
      jobTitle: '',
      department: 'Varsity',
      role: 'employee',
      managerEmail: 'Apoorv.suman@learnapp.com',
    });

    const manishSId = await createOrUpdateUser({
      fullName: 'Manish Singh Mahant',
      email: 'manish.singh@learnapp.com',
      jobTitle: '',
      department: 'Varsity',
      role: 'employee',
      managerEmail: 'Apoorv.suman@learnapp.com',
    });

    const manojKId = await createOrUpdateUser({
      fullName: 'Manoj Kumar',
      email: 'manoj.kumar@learnapp.com',
      jobTitle: '',
      department: 'Varsity',
      role: 'employee',
      managerEmail: 'Apoorv.suman@learnapp.com',
    });

    const vikasKId = await createOrUpdateUser({
      fullName: 'Vikas Kumar',
      email: 'Vikas.kumar@learnapp.com',
      jobTitle: '',
      department: 'Varsity',
      role: 'employee',
      managerEmail: 'Apoorv.suman@learnapp.com',
    });

    // Product Team
    const ankushCId = await createOrUpdateUser({
      fullName: 'Ankush Chaudhary',
      email: 'ankush.choudhary@learnapp.com',
      jobTitle: '',
      department: 'Product',
      role: 'employee',
      managerEmail: 'noor@learnapp.com',
    });

    const bhavyaOId = await createOrUpdateUser({
      fullName: 'Bhavya Oberoi',
      email: 'bhavya.oberoi@learnapp.com',
      jobTitle: '',
      department: 'Product',
      role: 'employee',
      managerEmail: 'noor@learnapp.com',
    });

    const vaishnaviMId = await createOrUpdateUser({
      fullName: 'Vaishnavi Mishra',
      email: 'vaishnavi.mishra@learnapp.com',
      jobTitle: '',
      department: 'Product',
      role: 'employee',
      managerEmail: 'noor@learnapp.com',
    });

    // Technology Team
    const supriyaCKId = await createOrUpdateUser({
      fullName: 'Supriya CK',
      email: 'supriya@learnapp.com',
      jobTitle: '',
      department: 'Technology',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const chandanKId = await createOrUpdateUser({
      fullName: 'Chandan Kumar Vishwakarma',
      email: 'chandan@learnapp.com',
      jobTitle: '',
      department: 'Technology',
      role: 'employee',
      managerEmail: 'supriya@learnapp.com',
    });

    const harshitaVId = await createOrUpdateUser({
      fullName: 'Harshita Varshney',
      email: 'harshita.varshney@learnapp.com',
      jobTitle: '',
      department: 'Technology',
      role: 'employee',
      managerEmail: 'supriya@learnapp.com',
    });

    const tilakMId = await createOrUpdateUser({
      fullName: 'Tilak Mahawar',
      email: 'tilak.mahawar@learnapp.com',
      jobTitle: '',
      department: 'Technology',
      role: 'employee',
      managerEmail: 'supriya@learnapp.com',
    });

    const tusharKId = await createOrUpdateUser({
      fullName: 'Tushar Kumar',
      email: 'tushar.kumar@learnapp.com',
      jobTitle: '',
      department: 'Technology',
      role: 'employee',
      managerEmail: 'supriya@learnapp.com',
    });

    // Graphics Team
    const anubhaRId = await createOrUpdateUser({
      fullName: 'Anubha Rathi',
      email: 'anubha@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const abhishekSId = await createOrUpdateUser({
      fullName: 'Abhishek Shukla',
      email: 'Abhishek.shukla@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    const amanGId = await createOrUpdateUser({
      fullName: 'Aman Ghosh',
      email: 'aman.ghosh@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    const amitJId = await createOrUpdateUser({
      fullName: 'Amit Joshi',
      email: 'Amit.joshi@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    const ishikaBId = await createOrUpdateUser({
      fullName: 'Ishika Badal',
      email: 'ishika.badal@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    const mayankCId = await createOrUpdateUser({
      fullName: 'Mayank Chauhan',
      email: 'Mayank.Chauhan@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    const piyushVId = await createOrUpdateUser({
      fullName: 'Piyush Vaid',
      email: 'Piyush@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    const pranchalCId = await createOrUpdateUser({
      fullName: 'Pranchal Chaudhary',
      email: 'pranchal@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    const rajId = await createOrUpdateUser({
      fullName: 'Raj',
      email: 'raj@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    const rakhiDId = await createOrUpdateUser({
      fullName: 'Rakhi Dhama',
      email: 'rakhi.dhama@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    const shreyaSId = await createOrUpdateUser({
      fullName: 'Shreya Sarawagi',
      email: 'shreya@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    const vaibhavSId = await createOrUpdateUser({
      fullName: 'Vaibhav Singhal',
      email: 'vaibhav@learnapp.com',
      jobTitle: '',
      department: 'Graphics',
      role: 'employee',
      managerEmail: 'anubha@learnapp.com',
    });

    // Sound Team
    const bhavyaSId = await createOrUpdateUser({
      fullName: 'Bhavya S Menon',
      email: 'Bhavya.menon@learnapp.com',
      jobTitle: '',
      department: 'Sound',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const amanDId = await createOrUpdateUser({
      fullName: 'Aman Deep',
      email: 'aman@learnapp.com',
      jobTitle: '',
      department: 'Sound',
      role: 'employee',
      managerEmail: 'Bhavya.menon@learnapp.com',
    });

    const ashutoshKId = await createOrUpdateUser({
      fullName: 'Ashutosh Kaushik',
      email: 'ashutosh.kaushik@learnapp.com',
      jobTitle: '',
      department: 'Sound',
      role: 'employee',
      managerEmail: 'Bhavya.menon@learnapp.com',
    });

    const naveenTId = await createOrUpdateUser({
      fullName: 'Naveen Tiwari',
      email: 'naveen.tiwari@learnapp.com',
      jobTitle: '',
      department: 'Sound',
      role: 'employee',
      managerEmail: 'Bhavya.menon@learnapp.com',
    });

    const rahulId = await createOrUpdateUser({
      fullName: 'Rahul',
      email: 'rahul@learnapp.com',
      jobTitle: '',
      department: 'Sound',
      role: 'employee',
      managerEmail: 'Bhavya.menon@learnapp.com',
    });

    // Editing 1 Team
    const bratishBId = await createOrUpdateUser({
      fullName: 'Bratish Kanti Banerjee',
      email: 'bratish.banerjee@learnapp.com',
      jobTitle: '',
      department: 'Editing 1',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const ajayRId = await createOrUpdateUser({
      fullName: 'Ajay Singh Rawat',
      email: 'ajay.rawat@learnapp.com',
      jobTitle: '',
      department: 'Editing 1',
      role: 'employee',
      managerEmail: 'bratish.banerjee@learnapp.com',
    });

    const akritiSId = await createOrUpdateUser({
      fullName: 'Akriti Singh',
      email: 'Akriti.singh@learnapp.com',
      jobTitle: '',
      department: 'Editing 1',
      role: 'employee',
      managerEmail: 'bratish.banerjee@learnapp.com',
    });

    const deepakKId = await createOrUpdateUser({
      fullName: 'Deepak Kumar',
      email: 'Deepak.kumar@learnapp.com',
      jobTitle: '',
      department: 'Editing 1',
      role: 'employee',
      managerEmail: 'bratish.banerjee@learnapp.com',
    });

    const wasimId = await createOrUpdateUser({
      fullName: 'MD Wasim',
      email: 'wasim@learnapp.com',
      jobTitle: '',
      department: 'Editing 1',
      role: 'employee',
      managerEmail: 'bratish.banerjee@learnapp.com',
    });

    // Editing 2 Team
    const harishRId = await createOrUpdateUser({
      fullName: 'Harish Rawat',
      email: 'harish@learnapp.com',
      jobTitle: '',
      department: 'Editing 2',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const abhishekShId = await createOrUpdateUser({
      fullName: 'Abhishek Sharma',
      email: 'abhishek.sharma@learnapp.com',
      jobTitle: '',
      department: 'Editing 2',
      role: 'employee',
      managerEmail: 'harish@learnapp.com',
    });

    const divyanshuMId = await createOrUpdateUser({
      fullName: 'Divyanshu Mishra',
      email: 'Divyanshu@learnapp.com',
      jobTitle: '',
      department: 'Editing 2',
      role: 'employee',
      managerEmail: 'harish@learnapp.com',
    });

    const rishabhBId = await createOrUpdateUser({
      fullName: 'Rishabh Bangwal',
      email: 'Rishabh@learnapp.com',
      jobTitle: '',
      department: 'Editing 2',
      role: 'employee',
      managerEmail: 'harish@learnapp.com',
    });

    // Content 1 Team
    const nishitaGId = await createOrUpdateUser({
      fullName: 'Nishita Gupta',
      email: 'nishita.gupta@learnapp.com',
      jobTitle: '',
      department: 'Content 1',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const sahilMId = await createOrUpdateUser({
      fullName: 'Sahil Mathur',
      email: 'sahil.mathur@learnapp.com',
      jobTitle: '',
      department: 'Content 1',
      role: 'employee',
      managerEmail: 'nishita.gupta@learnapp.com',
    });

    const shuchitaKId = await createOrUpdateUser({
      fullName: 'Shuchita Kumar',
      email: 'shuchita.kumar@learnapp.com',
      jobTitle: '',
      department: 'Content 1',
      role: 'employee',
      managerEmail: 'nishita.gupta@learnapp.com',
    });

    // Content 2 Team
    const pulkitLId = await createOrUpdateUser({
      fullName: 'Pulkit Lalwani',
      email: 'pulkit@learnapp.com',
      jobTitle: '',
      department: 'Content 2',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const priyanshuKId = await createOrUpdateUser({
      fullName: 'Priyanshu Kumar',
      email: 'priyanshu.kumar@learnapp.com',
      jobTitle: '',
      department: 'Content 2',
      role: 'employee',
      managerEmail: 'pulkit@learnapp.com',
    });

    // Social Team (Tanya Khanna is manager)
    const tanyaKId = await createOrUpdateUser({
      fullName: 'Tanya Khanna',
      email: 'tanya.khanna@learnapp.com',
      jobTitle: '',
      department: 'Social',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const anishMId = await createOrUpdateUser({
      fullName: 'Anish Mohan',
      email: 'anish@learnapp.com',
      jobTitle: '',
      department: 'Social',
      role: 'employee',
      managerEmail: 'tanya.khanna@learnapp.com',
    });

    const khushiNId = await createOrUpdateUser({
      fullName: 'Khushi Narula',
      email: 'khushi.narula@learnapp.com',
      jobTitle: '',
      department: 'Social',
      role: 'employee',
      managerEmail: 'tanya.khanna@learnapp.com',
    });

    const rohitSId = await createOrUpdateUser({
      fullName: 'Rohit Sondhi',
      email: 'rohit@learnapp.com',
      jobTitle: '',
      department: 'Social',
      role: 'employee',
      managerEmail: 'tanya.khanna@learnapp.com',
    });

    const satyamGId = await createOrUpdateUser({
      fullName: 'Satyam Gupta',
      email: 'satyam@learnapp.com',
      jobTitle: '',
      department: 'Social',
      role: 'employee',
      managerEmail: 'tanya.khanna@learnapp.com',
    });

    const siyaKId = await createOrUpdateUser({
      fullName: 'Siya Khanna',
      email: 'siya.khanna@learnapp.com',
      jobTitle: '',
      department: 'Social',
      role: 'employee',
      managerEmail: 'tanya.khanna@learnapp.com',
    });

    // Pre-production Team
    const vanditRId = await createOrUpdateUser({
      fullName: 'Vandit Rai',
      email: 'vandit@learnapp.com',
      jobTitle: '',
      department: 'Pre-production',
      role: 'manager',
      managerEmail: 'noor@learnapp.com',
    });

    const modAId = await createOrUpdateUser({
      fullName: 'Mod Abid',
      email: 'mod.abid@learnapp.com',
      jobTitle: '',
      department: 'Pre-production',
      role: 'employee',
      managerEmail: 'vandit@learnapp.com',
    });

    const mudhitMId = await createOrUpdateUser({
      fullName: 'Mudhit Mehra',
      email: 'mudhit.mehra@learnapp.com',
      jobTitle: '',
      department: 'Pre-production',
      role: 'employee',
      managerEmail: 'vandit@learnapp.com',
    });

    // HR Team
    const aasthaGId = await createOrUpdateUser({
      fullName: 'Aastha Gupta',
      email: 'aastha.gupta@learnapp.com',
      jobTitle: '',
      department: 'HR',
      role: 'employee',
      managerEmail: 'noor@learnapp.com',
    });

    // 2. Ensure July and August 2026 cycles exist
    console.log('Ensuring July and August 2026 cycles...');
    const currentYear = 2026;

    async function ensureCycle(data: {
      name: string;
      month: number;
      year: number;
      startDate: string;
      endDate: string;
      goalSubmissionDeadline: string;
      proofSubmissionDeadline: string;
      reviewDeadline: string;
      status: string;
    }) {
      const existing = await db.select().from(incentiveCycles)
        .where(and(eq(incentiveCycles.month, data.month), eq(incentiveCycles.year, data.year)))
        .limit(1);
      if (existing.length > 0) {
        if (existing[0].status !== data.status) {
          await db
            .update(incentiveCycles)
            .set({ status: data.status, updatedAt: new Date() })
            .where(eq(incentiveCycles.id, existing[0].id));
          console.log(`Updated cycle status: ${existing[0].name} -> ${data.status}`);
        }
        console.log(`Cycle already exists: ${existing[0].name}`);
        return existing[0];
      }
      const [created] = await db.insert(incentiveCycles).values(data).returning();
      console.log(`Successfully created: ${created.name}`);
      return created;
    }

    await ensureCycle({
      name: 'July 2026 Cycle',
      month: 7,
      year: currentYear,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      goalSubmissionDeadline: '2026-07-20',
      proofSubmissionDeadline: '2026-07-28',
      reviewDeadline: '2026-07-31',
      status: 'Closed',
    });

    await ensureCycle({
      name: 'August 2026 Cycle',
      month: 8,
      year: currentYear,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      goalSubmissionDeadline: '2026-08-10',
      proofSubmissionDeadline: '2026-08-28',
      reviewDeadline: '2026-08-31',
      status: 'Active',
    });

    const [julyCycle] = await db
      .select({ id: incentiveCycles.id })
      .from(incentiveCycles)
      .where(and(eq(incentiveCycles.month, 7), eq(incentiveCycles.year, currentYear)))
      .limit(1);

    if (julyCycle) {
      const backfilled = await db
        .update(cheers)
        .set({ cycleId: julyCycle.id })
        .where(isNull(cheers.cycleId))
        .returning({ id: cheers.id });
      if (backfilled.length > 0) {
        console.log(`Assigned ${backfilled.length} existing cheers to July 2026 cycle.`);
      }
    }

    // 3. Remove employees no longer on the roster (goals cascade-delete with profile)
    for (const email of REMOVED_EMAILS) {
      const removed = await db.delete(profiles).where(eq(profiles.email, email)).returning() as typeof profiles.$inferSelect[];
      if (removed.length > 0) {
        console.log(`Removed profile: ${removed[0].fullName} (${email})`);
      }
    }
    const removedArun = await db.delete(profiles).where(
      and(eq(profiles.department, 'Varsity'), ilike(profiles.fullName, '%Arun%'))
    ).returning() as typeof profiles.$inferSelect[];
    for (const p of removedArun) {
      console.log(`Removed Varsity profile: ${p.fullName} (${p.email})`);
    }

    // 4. Goals are imported separately from the July PDF (see seed-goals.ts)
    console.log('Goals are not seeded here — run seed-goals.ts after importing the July PDF data.');

    console.log('\n=========================================');
    console.log('DATABASE AND CYCLE SEEDING COMPLETE!');
    console.log('Seeded Monthly Cycles:');
    console.log('1. July 2026 Cycle   - Closed');
    console.log('2. August 2026 Cycle - Active');
    console.log('=========================================\n');

  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await pool.end();
  }
}

runSeed();
