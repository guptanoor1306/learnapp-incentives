import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { and, eq, ne, inArray, asc, desc, getTableColumns } from 'drizzle-orm';

import { db } from './src/db/index.ts';
import {
  profiles,
  incentiveCycles,
  goals,
  progressUpdates,
  proofs,
  goalReviews,
  incentiveDecisions,
  cheers
} from './src/db/schema.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Helper for mapping snake_case to camelCase and vice versa
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function keysToSnake(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(keysToSnake);
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    newObj[toSnakeCase(key)] = keysToSnake(obj[key]);
  }
  return newObj;
}

function keysToCamel(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(keysToCamel);
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = toCamelCase(key);
    let val = keysToCamel(obj[key]);
    if ((camelKey === 'createdAt' || camelKey === 'updatedAt') && typeof val === 'string' && val) {
      val = new Date(val);
    }
    newObj[camelKey] = val;
  }
  return newObj;
}

function parseSelectColumns(tableObj: any, selectStr?: string) {
  if (!selectStr || selectStr.trim() === '*') return undefined;

  const allCols = getTableColumns(tableObj);
  const selection: Record<string, any> = {};

  for (const part of selectStr.split(',').map((s) => s.trim()).filter(Boolean)) {
    const camelKey = toCamelCase(part);
    if (allCols[camelKey]) {
      selection[camelKey] = allCols[camelKey];
    }
  }

  return Object.keys(selection).length > 0 ? selection : undefined;
}

// Table schema mappings
const tableMap: Record<string, any> = {
  profiles,
  incentive_cycles: incentiveCycles,
  goals,
  progress_updates: progressUpdates,
  proofs,
  goal_reviews: goalReviews,
  incentive_decisions: incentiveDecisions,
  cheers: cheers,
};

// Helper to construct where clauses in Drizzle
function buildWhereClause(tableObj: any, filters: any[]) {
  const conditions = [];
  for (const f of filters) {
    const camelCol = toCamelCase(f.col);
    const colObj = tableObj[camelCol];
    if (colObj === undefined) continue;

    if (f.op === 'eq') {
      if (f.val === null) {
        // Handle null values
        // Note: eq(col, null) or isNull is used in drizzle, we can just filter in javascript or handle it
        conditions.push(eq(colObj, f.val));
      } else {
        conditions.push(eq(colObj, f.val));
      }
    } else if (f.op === 'neq') {
      conditions.push(ne(colObj, f.val));
    } else if (f.op === 'in') {
      if (Array.isArray(f.val) && f.val.length > 0) {
        conditions.push(inArray(colObj, f.val));
      }
    }
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// Helper to construct sorting in Drizzle
function buildOrderBy(tableObj: any, orders: any[]) {
  const orderByArr = [];
  for (const o of orders) {
    const camelCol = toCamelCase(o.col);
    const colObj = tableObj[camelCol];
    if (colObj === undefined) continue;

    if (o.ascending) {
      orderByArr.push(asc(colObj));
    } else {
      orderByArr.push(desc(colObj));
    }
  }
  return orderByArr;
}

// 1. GENERIC API DATABASE PROXY ROUTE
app.post('/api/db', async (req, res) => {
  const { table, method, filters = [], orders = [], isSingle = false, data, selectStr } = req.body;

  const tableObj = tableMap[table];
  if (!tableObj) {
    return res.status(400).json({ error: `Table '${table}' is not supported.` });
  }

  try {
    if (method === 'select') {
      const columns = parseSelectColumns(tableObj, selectStr);
      let query = columns ? db.select(columns).from(tableObj) : db.select().from(tableObj);
      const whereClause = buildWhereClause(tableObj, filters);
      if (whereClause) {
        query = query.where(whereClause) as any;
      }
      const orderByArr = buildOrderBy(tableObj, orders);
      if (orderByArr.length > 0) {
        query = query.orderBy(...orderByArr) as any;
      }

      let results = await query;

      // Handle custom joins/attachments on the backend cleanly without manual parsers
      if (table === 'goals') {
        const employeeIds = results.map((g: any) => g.employeeId).filter(Boolean);
        if (employeeIds.length > 0) {
          const profileList = await db.select().from(profiles).where(inArray(profiles.id, employeeIds));
          const profileMap = new Map(profileList.map(p => [p.id, p]));
          for (const g of results as any[]) {
            g.employee_profile = profileMap.get(g.employeeId);
          }
        }
      } else if (table === 'goal_reviews') {
        const reviewerIds = results.map((r: any) => r.reviewerId).filter(Boolean);
        if (reviewerIds.length > 0) {
          const profileList = await db.select().from(profiles).where(inArray(profiles.id, reviewerIds));
          const profileMap = new Map(profileList.map(p => [p.id, p]));
          for (const r of results as any[]) {
            r.reviewer = profileMap.get(r.reviewerId);
          }
        }
      } else if (table === 'profiles') {
        const managerIds = results.map((p: any) => p.managerId).filter(Boolean);
        if (managerIds.length > 0) {
          const managerList = await db.select().from(profiles).where(inArray(profiles.id, managerIds));
          const managerMap = new Map(managerList.map(p => [p.id, p]));
          for (const p of results as any[]) {
            p.manager = managerMap.get(p.managerId);
          }
        }
      }

      if (isSingle) {
        return res.json({ data: results.length > 0 ? keysToSnake(results[0]) : null });
      }
      return res.json({ data: keysToSnake(results) });

    } else if (method === 'insert') {
      const camelData = keysToCamel(data);
      const results = await db.insert(tableObj).values(camelData).returning() as any[];
      return res.json({ data: results.length > 0 ? keysToSnake(results[0]) : null });

    } else if (method === 'update') {
      const camelData = keysToCamel(data);
      let query = db.update(tableObj).set(camelData);
      const whereClause = buildWhereClause(tableObj, filters);
      if (whereClause) {
        query = query.where(whereClause) as any;
      }
      const results = await query.returning();
      return res.json({ data: keysToSnake(results) });

    } else if (method === 'delete') {
      console.log(`[DB DELETE] Table: ${table}, Filters:`, JSON.stringify(filters));
      let query = db.delete(tableObj);
      const whereClause = buildWhereClause(tableObj, filters);
      if (whereClause) {
        query = query.where(whereClause) as any;
      }
      const results = await query.returning() as any[];
      console.log(`[DB DELETE] Deleted rows count: ${results.length}`);
      return res.json({ data: keysToSnake(results) });
    }

    return res.status(400).json({ error: `Method '${method}' is not supported.` });
  } catch (error: any) {
    console.error(`Database operations error on table ${table}:`, error);
    return res.status(500).json({ error: error.message || 'Database query failed. Please try again later.' });
  }
});

// Serve frontend with Vite in development, static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
