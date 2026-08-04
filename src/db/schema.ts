import { pgTable, text, integer, boolean, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(), // Custom ID or Firebase Auth UID
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  jobTitle: text("job_title").notNull(),
  department: text("department").notNull(),
  role: text("role").notNull(), // 'employee', 'manager', 'admin'
  managerId: text("manager_id").references(() => profiles.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  passwordHash: text("password_hash"),
  salt: text("salt"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  manager: one(profiles, {
    fields: [profiles.managerId],
    references: [profiles.id],
    relationName: "manager_subordinates",
  }),
  subordinates: many(profiles, { relationName: "manager_subordinates" }),
  goals: many(goals),
  progressUpdates: many(progressUpdates),
  proofs: many(proofs),
  reviews: many(goalReviews),
  decisions: many(incentiveDecisions),
}));

export const incentiveCycles = pgTable("incentive_cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  goalSubmissionDeadline: date("goal_submission_deadline").notNull(),
  proofSubmissionDeadline: date("proof_submission_deadline").notNull(),
  reviewDeadline: date("review_deadline").notNull(),
  status: text("status").notNull(), // 'Draft', 'Active', 'Under Review', 'Closed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const incentiveCyclesRelations = relations(incentiveCycles, ({ many }) => ({
  goals: many(goals),
  decisions: many(incentiveDecisions),
  cheers: many(cheers),
}));

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: text("employee_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  cycleId: uuid("cycle_id").notNull().references(() => incentiveCycles.id, { onDelete: "cascade" }),
  goalType: text("goal_type").notNull(), // 'personal', 'business'
  title: text("title").notNull(),
  description: text("description").notNull(),
  successCriteria: text("success_criteria").notNull(),
  beyondBauExplanation: text("beyond_bau_explanation"),
  targetDate: date("target_date").notNull(),
  progressPercentage: integer("progress_percentage").notNull().default(0),
  status: text("status").notNull(), // 'Draft', 'Pending Approval', 'Changes Requested', 'Approved', 'Under Final Review', 'Achieved', 'Partially Achieved', 'Not Achieved'
  managerComment: text("manager_comment"),
  finalOutcome: text("final_outcome"), // 'Achieved', 'Partially Achieved', 'Not Achieved' or null
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const goalsRelations = relations(goals, ({ one, many }) => ({
  employee: one(profiles, {
    fields: [goals.employeeId],
    references: [profiles.id],
  }),
  cycle: one(incentiveCycles, {
    fields: [goals.cycleId],
    references: [incentiveCycles.id],
  }),
  progressUpdates: many(progressUpdates),
  proofs: many(proofs),
  reviews: many(goalReviews),
}));

export const progressUpdates = pgTable("progress_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  employeeId: text("employee_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  progressPercentage: integer("progress_percentage").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const progressUpdatesRelations = relations(progressUpdates, ({ one }) => ({
  goal: one(goals, {
    fields: [progressUpdates.goalId],
    references: [goals.id],
  }),
  employee: one(profiles, {
    fields: [progressUpdates.employeeId],
    references: [profiles.id],
  }),
}));

export const proofs = pgTable("proofs", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  uploadedBy: text("uploaded_by").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  storagePath: text("storage_path"),
  externalUrl: text("external_url"),
  note: text("note"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const proofsRelations = relations(proofs, ({ one }) => ({
  goal: one(goals, {
    fields: [proofs.goalId],
    references: [goals.id],
  }),
  uploader: one(profiles, {
    fields: [proofs.uploadedBy],
    references: [profiles.id],
  }),
}));

export const goalReviews = pgTable("goal_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'Approve', 'Request Changes', 'Mark Achieved', 'Mark Partially Achieved', 'Mark Not Achieved'
  comment: text("comment"),
  finalOutcome: text("final_outcome"), // 'Achieved', 'Partially Achieved', 'Not Achieved'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const goalReviewsRelations = relations(goalReviews, ({ one }) => ({
  goal: one(goals, {
    fields: [goalReviews.goalId],
    references: [goals.id],
  }),
  reviewer: one(profiles, {
    fields: [goalReviews.reviewerId],
    references: [profiles.id],
  }),
}));

export const incentiveDecisions = pgTable("incentive_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: text("employee_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  cycleId: uuid("cycle_id").notNull().references(() => incentiveCycles.id, { onDelete: "cascade" }),
  managerRecommendedPercentage: integer("manager_recommended_percentage"),
  adminFinalPercentage: integer("admin_final_percentage"),
  eligibilityStatus: text("eligibility_status").notNull(), // 'Pending', 'Eligible', 'Not Eligible'
  paymentStatus: text("payment_status").notNull(), // 'Pending', 'Approved', 'Released'
  managerNote: text("manager_note"),
  adminNote: text("admin_note"),
  managerIncentiveStatus: text("manager_incentive_status"), // 'Waiting for Team', 'Eligible', 'Not Eligible', 'Released' or null
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const incentiveDecisionsRelations = relations(incentiveDecisions, ({ one }) => ({
  employee: one(profiles, {
    fields: [incentiveDecisions.employeeId],
    references: [profiles.id],
  }),
  cycle: one(incentiveCycles, {
    fields: [incentiveDecisions.cycleId],
    references: [incentiveCycles.id],
  }),
}));

export const cheers = pgTable("cheers", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id").references(() => incentiveCycles.id, { onDelete: "cascade" }),
  giverId: text("giver_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cheersRelations = relations(cheers, ({ one }) => ({
  cycle: one(incentiveCycles, {
    fields: [cheers.cycleId],
    references: [incentiveCycles.id],
  }),
  giver: one(profiles, {
    fields: [cheers.giverId],
    references: [profiles.id],
  }),
  receiver: one(profiles, {
    fields: [cheers.receiverId],
    references: [profiles.id],
  }),
}));
