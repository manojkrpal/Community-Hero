/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole =
  | "Citizen"
  | "Volunteer"
  | "Community Moderator"
  | "Municipality Officer"
  | "Department Officer"
  | "Contractor"
  | "Ward Officer"
  | "Administrator"
  | "Guest";

export type IssueStatus =
  | "Submitted"
  | "AI Processing"
  | "Pending Verification"
  | "Verified"
  | "Assigned"
  | "Accepted"
  | "In Progress"
  | "Resolved"
  | "Citizen Confirmation"
  | "Closed"
  | "Rejected"
  | "Duplicate"
  | "Spam"
  | "Archived";

export interface AIAnalysis {
  category: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  priorityScore: number;
  confidenceScore: number;
  riskAssessment: string;
  duplicateKeywords: string[];
  autoCategoryReason: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: IssueStatus;
  latitude: number;
  longitude: number;
  address: string;
  imageUrl?: string;
  voiceUrl?: string;
  reporterId: string;
  reporterName: string;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  assignedTo?: string; // Officer/Contractor Name or ID
  assignedDepartment?: string;
  upvotes: number;
  downvotes: number;
  evidenceCount: number;
  aiConfidence?: number;
  aiAnalysis?: AIAnalysis;
  verificationRadius?: number; // meters
  verificationConsensus?: "none" | "verified" | "rejected";
  reputationPoints?: number;
  resolutionSteps?: string[];
  materialsRequired?: string[];
  safetyPrecautions?: string[];
  estimatedHours?: number;
  resolutionNotes?: string;
  resolutionImageUrl?: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  reputation: number;
  xp: number;
  level: number;
  badges: string[];
  createdAt: string;
}

export interface VerificationActivity {
  id: string;
  issueId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  type: "upvote" | "downvote" | "evidence";
  comment: string;
  imageUrl?: string;
  createdAt: string;
}

export interface TimelineUpdate {
  id: string;
  issueId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  fromStatus: IssueStatus;
  toStatus: IssueStatus;
  comment: string;
  createdAt: string;
}

export interface PredictionForecast {
  wardName: string;
  hazardType: string;
  probability: number;
  factors: string;
  preventativeAction: string;
}
