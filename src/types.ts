export interface Profile {
  id: string;
  full_name: string;
  email: string;
  job_title: string;
  department: string;
  role: 'employee' | 'manager' | 'admin';
  manager_id: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at?: string;
  updated_at?: string;
  manager?: {
    full_name: string;
    email: string;
  } | null;
}

export interface IncentiveCycle {
  id: string;
  name: string;
  month: number;
  year: number;
  start_date: string;
  end_date: string;
  goal_submission_deadline: string;
  proof_submission_deadline: string;
  review_deadline: string;
  status: 'Draft' | 'Active' | 'Under Review' | 'Closed';
  created_at?: string;
  updated_at?: string;
}

export interface Goal {
  id: string;
  employee_id: string;
  cycle_id: string;
  goal_type: 'personal' | 'business';
  title: string;
  description: string;
  success_criteria: string;
  beyond_bau_explanation: string | null;
  target_date: string;
  progress_percentage: number;
  status: 'Draft' | 'Pending Approval' | 'Changes Requested' | 'Approved' | 'Under Final Review' | 'Achieved' | 'Partially Achieved' | 'Not Achieved';
  manager_comment: string | null;
  final_outcome: 'Achieved' | 'Partially Achieved' | 'Not Achieved' | null;
  created_at?: string;
  updated_at?: string;
  employee_profile?: Profile;
}

export interface ProgressUpdate {
  id: string;
  goal_id: string;
  employee_id: string;
  progress_percentage: number;
  note: string;
  created_at: string;
}

export interface Proof {
  id: string;
  goal_id: string;
  uploaded_by: string;
  storage_path: string | null;
  external_url: string | null;
  note: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  signed_url?: string; // Client-side transient signed URL
}

export interface GoalReview {
  id: string;
  goal_id: string;
  reviewer_id: string;
  action: 'Approve' | 'Request Changes' | 'Mark Achieved' | 'Mark Partially Achieved' | 'Mark Not Achieved';
  comment: string | null;
  final_outcome: 'Achieved' | 'Partially Achieved' | 'Not Achieved' | null;
  created_at: string;
  reviewer?: Profile;
}

export interface IncentiveDecision {
  id: string;
  employee_id: string;
  cycle_id: string;
  manager_recommended_percentage: 0 | 5 | 6 | 7 | 8 | null;
  admin_final_percentage: 0 | 5 | 6 | 7 | 8 | null;
  eligibility_status: 'Pending' | 'Eligible' | 'Not Eligible';
  payment_status: 'Pending' | 'Approved' | 'Released';
  manager_note: string | null;
  admin_note: string | null;
  manager_incentive_status: 'Waiting for Team' | 'Eligible' | 'Not Eligible' | 'Released' | null;
  created_at?: string;
  updated_at?: string;
  employee_profile?: Profile;
}
