/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Issue, 
  UserRole, 
  IssueStatus, 
  User, 
  VerificationActivity, 
  TimelineUpdate 
} from "./types";
import { 
  fetchIssues, 
  createIssue, 
  updateIssue, 
  deleteIssue,
  voteIssue, 
  addVerificationEvidence, 
  fetchVerifications, 
  fetchTimeline, 
  logTimelineUpdate, 
  getUserProfile, 
  awardUserXP,
  onAuthChanged,
  logoutUser,
  subscribeToIssues
} from "./firebase";
import IssueMap from "./components/IssueMap";
import ReportIssueForm from "./components/ReportIssueForm";
import AnalyticsPanel from "./components/AnalyticsPanel";
import AuthPage from "./components/AuthPage";
import { 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  User as UserIcon, 
  Award, 
  TrendingUp, 
  Plus, 
  Check, 
  ShieldAlert,
  ListFilter,
  Users,
  ChevronRight,
  BookOpen,
  MessageSquare,
  HelpCircle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  Building,
  CheckCircle,
  Upload,
  Edit,
  Trash2,
  Bell,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.15);

    // Second note (slightly delayed chime)
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain2.gain.setValueAtTime(0.12, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.35);
      } catch {}
    }, 80);
  } catch (e) {
    console.warn("Audio Context blocked or not supported", e);
  }
};

export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser?.role !== "Administrator") {
      setNotifications([]);
    }
  }, [currentUser]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedIssueVerifications, setSelectedIssueVerifications] = useState<VerificationActivity[]>([]);
  const [selectedIssueTimeline, setSelectedIssueTimeline] = useState<TimelineUpdate[]>([]);
  
  // Push Notifications State for Administrator
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const notifiedRequestsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef<boolean>(true);
  
  // Auth and portal gates
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthGate, setShowAuthGate] = useState(true);

  // UI States
  const [showReportForm, setShowReportForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "map" | "analytics">("feed");
  const [adminSubTab, setAdminSubTab] = useState<"pending" | "verified" | "inprogress" | "resolved" | "requests">("pending");
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");

  // Suggestion AI resolution steps loading
  const [loadingResolutionSteps, setLoadingResolutionSteps] = useState(false);
  const [verificationComment, setVerificationComment] = useState("");

  // Resolution inputs
  const [resolutionNotesInput, setResolutionNotesInput] = useState("");

  // Department task completion inputs
  const [completionPhoto, setCompletionPhoto] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [submittingCompletion, setSubmittingCompletion] = useState(false);

  // AI department routing suggestion states
  const [loadingDeptSuggestion, setLoadingDeptSuggestion] = useState(false);
  const [onDemandDeptSuggestion, setOnDemandDeptSuggestion] = useState<{ suggestedDepartment: string; suggestedDepartmentReason: string } | null>(null);

  // Fetch AI department assignment suggestion
  const handleFetchDeptSuggestion = async () => {
    if (!selectedIssue) return;
    setLoadingDeptSuggestion(true);
    try {
      const response = await fetch("/api/suggest-department", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedIssue.title,
          description: selectedIssue.description,
          category: selectedIssue.category,
          severity: selectedIssue.severity
        })
      });
      const data = await response.json();
      if (data.success && data.recommendation) {
        setOnDemandDeptSuggestion(data.recommendation);
      }
    } catch (err) {
      console.error("Error fetching AI department suggestion:", err);
    } finally {
      setLoadingDeptSuggestion(false);
    }
  };

  // User Post Modification & Admin Request Approval Handlers
  const [isEditingIssue, setIsEditingIssue] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSeverity, setEditSeverity] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [editAddress, setEditAddress] = useState("");

  const startEditing = () => {
    if (!selectedIssue) return;
    setEditTitle(selectedIssue.title);
    setEditDescription(selectedIssue.description);
    setEditCategory(selectedIssue.category);
    setEditSeverity(selectedIssue.severity);
    setEditAddress(selectedIssue.address || "");
    setIsEditingIssue(true);
  };

  const handleRequestEdit = async () => {
    if (!selectedIssue) return;
    const updates = { 
      editRequestPending: true, 
      editRequestApproved: false,
      status: "Pending Edit Approval" as IssueStatus,
      preRequestStatus: selectedIssue.status
    };
    const success = await updateIssue(selectedIssue.id, updates);
    if (success) {
      const updatedList = await fetchIssues();
      setIssues(updatedList);
      const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
      if (updatedIssue) setSelectedIssue(updatedIssue);
      await logTimelineUpdate(
        selectedIssue.id,
        currentUser?.uid || "system",
        currentUser?.name || "System",
        currentUser?.role || "Citizen",
        selectedIssue.status,
        "Pending Edit Approval",
        `Requested authorization to edit the post.`
      );
    }
  };

  const handleRequestDelete = async () => {
    if (!selectedIssue) return;
    const updates = { 
      deleteRequestPending: true, 
      deleteRequestApproved: false,
      status: "Pending Delete Approval" as IssueStatus,
      preRequestStatus: selectedIssue.status
    };
    const success = await updateIssue(selectedIssue.id, updates);
    if (success) {
      const updatedList = await fetchIssues();
      setIssues(updatedList);
      const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
      if (updatedIssue) setSelectedIssue(updatedIssue);
      await logTimelineUpdate(
        selectedIssue.id,
        currentUser?.uid || "system",
        currentUser?.name || "System",
        currentUser?.role || "Citizen",
        selectedIssue.status,
        "Pending Delete Approval",
        `Requested authorization to delete the post.`
      );
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedIssue) return;
    if (!editTitle.trim() || !editDescription.trim()) return;

    const updates: Partial<Issue> = {
      title: editTitle,
      description: editDescription,
      category: editCategory,
      severity: editSeverity,
      address: editAddress,
      status: "Pending Verification", // always reset to pending on edit
      editRequestApproved: false,
      editRequestPending: false,
      updatedAt: new Date().toISOString()
    };

    const success = await updateIssue(selectedIssue.id, updates);
    if (success) {
      setIsEditingIssue(false);
      const updatedList = await fetchIssues();
      setIssues(updatedList);
      const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
      if (updatedIssue) setSelectedIssue(updatedIssue);
      await logTimelineUpdate(
        selectedIssue.id,
        currentUser?.uid || "system",
        currentUser?.name || "System",
        currentUser?.role || "Citizen",
        selectedIssue.status,
        "Pending Verification",
        `Edited issue details. Status reset to Pending Verification.`
      );
    }
  };

  const handleDeleteIssue = () => {
    if (!selectedIssue) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteIssue = async () => {
    if (!selectedIssue) return;
    const success = await deleteIssue(selectedIssue.id);
    if (success) {
      setSelectedIssue(null);
      const updatedList = await fetchIssues();
      setIssues(updatedList);
    }
    setShowDeleteConfirm(false);
  };

  const handleAdminApproveEditRequest = async () => {
    if (!selectedIssue) return;
    const restoredStatus = selectedIssue.preRequestStatus || "Verified";
    const updates = { 
      editRequestApproved: true, 
      editRequestPending: false,
      status: restoredStatus as IssueStatus
    };
    const success = await updateIssue(selectedIssue.id, updates);
    if (success) {
      const updatedList = await fetchIssues();
      setIssues(updatedList);
      const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
      if (updatedIssue) setSelectedIssue(updatedIssue);
      await logTimelineUpdate(
        selectedIssue.id,
        currentUser?.uid || "system",
        currentUser?.name || "System",
        currentUser?.role || "Administrator",
        selectedIssue.status,
        restoredStatus,
        `Approved citizen's request to edit this report.`
      );
    }
  };

  const handleAdminRejectEditRequest = async () => {
    if (!selectedIssue) return;
    const restoredStatus = selectedIssue.preRequestStatus || "Verified";
    const updates = { 
      editRequestApproved: false, 
      editRequestPending: false,
      status: restoredStatus as IssueStatus
    };
    const success = await updateIssue(selectedIssue.id, updates);
    if (success) {
      const updatedList = await fetchIssues();
      setIssues(updatedList);
      const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
      if (updatedIssue) setSelectedIssue(updatedIssue);
      await logTimelineUpdate(
        selectedIssue.id,
        currentUser?.uid || "system",
        currentUser?.name || "System",
        currentUser?.role || "Administrator",
        selectedIssue.status,
        restoredStatus,
        `Rejected citizen's request to edit this report.`
      );
    }
  };

  const handleAdminApproveDeleteRequest = async () => {
    if (!selectedIssue) return;
    const restoredStatus = selectedIssue.preRequestStatus || "Verified";
    const updates = { 
      deleteRequestApproved: true, 
      deleteRequestPending: false,
      status: restoredStatus as IssueStatus
    };
    const success = await updateIssue(selectedIssue.id, updates);
    if (success) {
      const updatedList = await fetchIssues();
      setIssues(updatedList);
      const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
      if (updatedIssue) setSelectedIssue(updatedIssue);
      await logTimelineUpdate(
        selectedIssue.id,
        currentUser?.uid || "system",
        currentUser?.name || "System",
        currentUser?.role || "Administrator",
        selectedIssue.status,
        restoredStatus,
        `Approved citizen's request to delete this report.`
      );
    }
  };

  const handleAdminRejectDeleteRequest = async () => {
    if (!selectedIssue) return;
    const restoredStatus = selectedIssue.preRequestStatus || "Verified";
    const updates = { 
      deleteRequestApproved: false, 
      deleteRequestPending: false,
      status: restoredStatus as IssueStatus
    };
    const success = await updateIssue(selectedIssue.id, updates);
    if (success) {
      const updatedList = await fetchIssues();
      setIssues(updatedList);
      const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
      if (updatedIssue) setSelectedIssue(updatedIssue);
      await logTimelineUpdate(
        selectedIssue.id,
        currentUser?.uid || "system",
        currentUser?.name || "System",
        currentUser?.role || "Administrator",
        selectedIssue.status,
        restoredStatus,
        `Rejected citizen's request to delete this report.`
      );
    }
  };

  // Load Issues (Real-time) and Auth Session on Mount
  useEffect(() => {
    // Request notification permission if supported
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    // Subscribe to issues in real-time
    const unsubscribeIssues = subscribeToIssues((liveIssues) => {
      setIssues(liveIssues);

      // Handle Admin Push Notifications for edit/delete requests
      const isUserAdmin = currentUserRef.current?.role === "Administrator";
      if (isUserAdmin && liveIssues.length > 0) {
        const newNotifications: any[] = [];
        let triggered = false;

        liveIssues.forEach((issue) => {
          // Edit Request
          if (issue.editRequestPending) {
            const editKey = `edit-${issue.id}`;
            if (!notifiedRequestsRef.current.has(editKey)) {
              notifiedRequestsRef.current.add(editKey);
              if (!isFirstLoadRef.current) {
                // Trigger notification!
                const newNotif = {
                  id: `notif-${Math.random().toString(36).substr(2, 9)}`,
                  type: "edit",
                  issueId: issue.id,
                  issueTitle: issue.title,
                  reporterName: issue.reporterName || "Citizen",
                  timestamp: new Date(),
                  viewed: false,
                };
                newNotifications.push(newNotif);
                triggered = true;

                // Fire standard HTML5 Notification if permitted
                if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                  new Notification("⚠️ Pending Edit Request", {
                    body: `${issue.reporterName || "Citizen"} has requested to edit: "${issue.title}"`,
                    icon: "https://cdn-icons-png.flaticon.com/512/3239/3239147.png"
                  });
                }
              }
            }
          }

          // Delete Request
          if (issue.deleteRequestPending) {
            const deleteKey = `delete-${issue.id}`;
            if (!notifiedRequestsRef.current.has(deleteKey)) {
              notifiedRequestsRef.current.add(deleteKey);
              if (!isFirstLoadRef.current) {
                // Trigger notification!
                const newNotif = {
                  id: `notif-${Math.random().toString(36).substr(2, 9)}`,
                  type: "delete",
                  issueId: issue.id,
                  issueTitle: issue.title,
                  reporterName: issue.reporterName || "Citizen",
                  timestamp: new Date(),
                  viewed: false,
                };
                newNotifications.push(newNotif);
                triggered = true;

                // Fire standard HTML5 Notification if permitted
                if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                  new Notification("🚨 Pending Delete Request", {
                    body: `${issue.reporterName || "Citizen"} has requested to delete: "${issue.title}"`,
                    icon: "https://cdn-icons-png.flaticon.com/512/3239/3239147.png"
                  });
                }
              }
            }
          }
        });

        if (triggered && newNotifications.length > 0) {
          setNotifications((prev) => [...newNotifications, ...prev]);
          playNotificationSound();
        }

        // After initial parsing, mark first load as complete
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
        }
      }
    });

    // Listen to Auth State changes smoothly
    onAuthChanged((user) => {
      if (user) {
        setCurrentUser(user);
        setShowAuthGate(false);
      } else {
        setCurrentUser(null);
        setShowAuthGate(true);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribeIssues();
    };
  }, []);

  // Fetch comments and timeline updates when selecting an issue
  useEffect(() => {
    if (selectedIssue) {
      async function loadDetails() {
        const verifications = await fetchVerifications(selectedIssue.id);
        const timeline = await fetchTimeline(selectedIssue.id);
        setSelectedIssueVerifications(verifications);
        setSelectedIssueTimeline(timeline);
        
        // Reset completion form for new issue selection
        setCompletionPhoto(null);
        setCompletionNotes("");
        setOnDemandDeptSuggestion(null);
        setIsEditingIssue(false);
      }
      loadDetails();
    }
  }, [selectedIssue]);

  // Handle report success
  const handleReportSuccess = async (newIssuePayload: Omit<Issue, "id">) => {
    const savedIssue = await createIssue(newIssuePayload);
    
    // Add custom initial timeline update
    await logTimelineUpdate(
      savedIssue.id,
      "system-ai",
      "AI Architect Core",
      "Administrator",
      "Submitted",
      "AI Processing",
      `AI engine analyzed description: "${savedIssue.aiAnalysis?.riskAssessment}". Set initial priority factor.`
    );

    // Refresh feed
    const updated = await fetchIssues();
    setIssues(updated);
    setShowReportForm(false);
    setSelectedIssue(savedIssue);

    // Award user points
    if (currentUser) {
      const updatedUser = awardUserXP(currentUser.uid, 120, 30, "Eagle Eye");
      setCurrentUser(updatedUser);
    }
  };

  // Upvote / Downvote Issue
  const handleVote = async (type: "upvote" | "downvote") => {
    if (!selectedIssue || !currentUser) return;
    const success = await voteIssue(selectedIssue.id, type, currentUser.uid, currentUser.name);
    if (success) {
      const updatedList = await fetchIssues();
      setIssues(updatedList);
      const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
      if (updatedIssue) {
        setSelectedIssue(updatedIssue);
      }
      
      // Award micro XP for verifying
      const updatedUser = awardUserXP(currentUser.uid, 40, 10, "First Responder");
      setCurrentUser(updatedUser);
    }
  };

  // Add custom verification comment / evidence
  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !currentUser || !verificationComment.trim()) return;

    await addVerificationEvidence(
      selectedIssue.id,
      currentUser.uid,
      currentUser.name,
      currentUser.role,
      verificationComment
    );

    // Record timeline update
    await logTimelineUpdate(
      selectedIssue.id,
      currentUser.uid,
      currentUser.name,
      currentUser.role,
      selectedIssue.status,
      selectedIssue.status,
      `${currentUser.name} uploaded verification comment: "${verificationComment}"`
    );

    setVerificationComment("");
    
    // Refresh issues list
    const updatedList = await fetchIssues();
    setIssues(updatedList);
    const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
    if (updatedIssue) setSelectedIssue(updatedIssue);

    const updatedUser = awardUserXP(currentUser.uid, 80, 20, "Verified Civic Hero");
    setCurrentUser(updatedUser);
  };

  // AI Smart resolution recommendations checklist generator
  const handleGenerateResolutionSteps = async () => {
    if (!selectedIssue) return;
    setLoadingResolutionSteps(true);
    try {
      const response = await fetch("/api/suggest-resolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedIssue.title,
          category: selectedIssue.category,
          description: selectedIssue.description,
          severity: selectedIssue.severity
        })
      });

      const data = await response.json();
      if (data.success && data.recommendation) {
        const rec = data.recommendation;
        await updateIssue(selectedIssue.id, {
          resolutionSteps: rec.steps,
          materialsRequired: rec.materialsRequired,
          safetyPrecautions: rec.safetyPrecautions,
          estimatedHours: rec.estimatedHours,
          assignedDepartment: rec.assignedDepartment
        });

        // Record timeline
        await logTimelineUpdate(
          selectedIssue.id,
          "system-ai",
          "AI Architect Core",
          "Administrator",
          selectedIssue.status,
          selectedIssue.status,
          `Generated Smart Repair Checklists & safety recommendations from Gemini model.`
        );

        const updatedList = await fetchIssues();
        setIssues(updatedList);
        const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
        if (updatedIssue) setSelectedIssue(updatedIssue);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingResolutionSteps(false);
    }
  };

  // Route issue to specific department (Officers or Admins only)
  const handleRouteDepartment = async (department: string) => {
    if (!selectedIssue || !currentUser) return;
    
    const updates: Partial<Issue> = {
      assignedDepartment: department,
      updatedAt: new Date().toISOString()
    };

    let oldStatus = selectedIssue.status;
    let targetStatus = oldStatus;
    // If status was Pending Verification or Submitted, update to Assigned
    if (oldStatus === "Pending Verification" || oldStatus === "Submitted") {
      updates.status = "Assigned";
      targetStatus = "Assigned";
    }

    await updateIssue(selectedIssue.id, updates);

    // Log to audit log timeline
    await logTimelineUpdate(
      selectedIssue.id,
      currentUser.uid,
      currentUser.name,
      currentUser.role,
      oldStatus,
      targetStatus,
      `Routed problem to ${department} department.`
    );

    const updatedList = await fetchIssues();
    setIssues(updatedList);
    const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
    if (updatedIssue) setSelectedIssue(updatedIssue);
  };

  // Mark task completed by assigned department with evidence photo
  const handleCompleteByDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !currentUser || !completionPhoto) return;
    setSubmittingCompletion(true);
    try {
      const updates: Partial<Issue> = {
        status: "Completed by Assigned Department",
        completedImageUrl: completionPhoto,
        completedNotes: completionNotes,
        updatedAt: new Date().toISOString()
      };
      await updateIssue(selectedIssue.id, updates);

      // Log to audit log timeline
      await logTimelineUpdate(
        selectedIssue.id,
        currentUser.uid,
        currentUser.name,
        currentUser.role,
        selectedIssue.status,
        "Completed by Assigned Department",
        completionNotes || "Task completed by assigned department. Finished works photograph uploaded."
      );

      setCompletionPhoto(null);
      setCompletionNotes("");

      const updatedList = await fetchIssues();
      setIssues(updatedList);
      const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
      if (updatedIssue) setSelectedIssue(updatedIssue);
    } catch (err) {
      console.error("Error completing task:", err);
    } finally {
      setSubmittingCompletion(false);
    }
  };

  // Change Issue status (Officers or Admins only)
  const handleStatusChange = async (targetStatus: IssueStatus, comment: string) => {
    if (!selectedIssue || !currentUser) return;
    const oldStatus = selectedIssue.status;
    
    const updates: Partial<Issue> = { 
      status: targetStatus,
      updatedAt: new Date().toISOString()
    };
    
    if (targetStatus === "In Progress") {
      updates.assignedTo = currentUser.name;
    }

    if (targetStatus === "Resolved") {
      updates.resolutionNotes = resolutionNotesInput || "Restoration works successfully finished. Issue closed.";
    }

    await updateIssue(selectedIssue.id, updates);

    // Log to audit log timeline
    await logTimelineUpdate(
      selectedIssue.id,
      currentUser.uid,
      currentUser.name,
      currentUser.role,
      oldStatus,
      targetStatus,
      comment
    );

    // Reward points for resolving
    if (targetStatus === "Resolved") {
      const updatedUser = awardUserXP(currentUser.uid, 500, 150, "Resolution Master");
      setCurrentUser(updatedUser);
      setResolutionNotesInput("");
    }

    // Refresh feed
    const updatedList = await fetchIssues();
    setIssues(updatedList);
    const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
    if (updatedIssue) setSelectedIssue(updatedIssue);
  };

  // Filtering Logic
  const filteredIssues = issues.filter(issue => {
    const isApproved = [
      "Verified",
      "Assigned",
      "Accepted",
      "In Progress",
      "Completed by Assigned Department",
      "Resolved",
      "Citizen Confirmation",
      "Closed"
    ].includes(issue.status);

    const isDeptOfficer = [
      "Public Works Officer",
      "Water & Sewage Officer",
      "Sanitation Officer",
      "Electrical Officer"
    ].includes(currentUser?.role || "");

    if (isDeptOfficer) {
      // Department Officers can only view approved issues assigned to their department
      if (!isApproved) {
        return false;
      }
      if (!issue.assignedDepartment || issue.assignedDepartment !== currentUser?.department) {
        return false;
      }
    } else if (currentUser?.role === "Municipality Officer") {
      // Municipal officer only see the approved incidents
      if (!isApproved) {
        return false;
      }
    } else if (currentUser?.role === "Administrator") {
      // Administrator can see all reports for monitoring and operations
    } else {
      // Citizen / Guest / standard user
      const isMyOwnIssue = currentUser && issue.reporterId === currentUser.uid;
      const isPending = [
        "Submitted",
        "AI Processing",
        "Pending Verification"
      ].includes(issue.status);

      if (isPending) {
        // Can only see if they raised it themselves
        if (!isMyOwnIssue) {
          return false;
        }
      } else if (!isApproved) {
        // Hide spam, rejected, or archived issues unless they raised it
        if (!isMyOwnIssue) {
          return false;
        }
      }
    }

    const matchCategory = categoryFilter === "All" || issue.category === categoryFilter;
    const matchStatus = statusFilter === "All" || issue.status === statusFilter;
    const matchSeverity = severityFilter === "All" || issue.severity === severityFilter;
    return matchCategory && matchStatus && matchSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    let classes = "";
    switch (severity) {
      case "Critical":
        classes = "bg-orange-100 text-orange-700";
        break;
      case "High":
        classes = "bg-amber-100 text-amber-700";
        break;
      case "Medium":
        classes = "bg-blue-100 text-blue-700";
        break;
      default:
        classes = "bg-slate-100 text-slate-600";
    }
    return (
      <span className={`${classes} font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider`}>
        {severity}
      </span>
    );
  };

  const getStatusBadge = (status: IssueStatus) => {
    let classes = "";
    switch (status) {
      case "Submitted":
        classes = "bg-slate-100 text-slate-700";
        break;
      case "Pending Verification":
        classes = "bg-yellow-100 text-yellow-800 border border-yellow-200";
        break;
      case "Verified":
        classes = "bg-emerald-100 text-emerald-800";
        break;
      case "In Progress":
        classes = "bg-blue-100 text-blue-800 animate-pulse";
        break;
      case "Completed by Assigned Department":
        classes = "bg-indigo-100 text-indigo-800 border border-indigo-200";
        break;
      case "Resolved":
      case "Closed":
        classes = "bg-green-100 text-green-800";
        break;
      case "Rejected":
      case "Spam":
        classes = "bg-red-100 text-red-800";
        break;
      case "Pending Edit Approval":
        classes = "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse";
        break;
      case "Pending Delete Approval":
        classes = "bg-rose-100 text-rose-800 border border-rose-200 animate-pulse";
        break;
      default:
        classes = "bg-slate-100 text-slate-600";
    }
    return (
      <span className={`${classes} font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-tight`}>
        {status}
      </span>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4" id="app-auth-loader">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-500 font-bold tracking-tight">Initializing secure portal link...</p>
      </div>
    );
  }

  if (showAuthGate && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between" id="app-auth-gate">
        {/* Navigation bar with simplified guest view options */}
        <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">CommunityHero</span>
          </div>
          <button
            onClick={() => setShowAuthGate(false)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            Browse as Guest
          </button>
        </nav>
        
        <AuthPage 
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            setShowAuthGate(false);
          }}
          onSkip={() => setShowAuthGate(false)}
        />
        
        <footer className="py-6 border-t border-slate-200 bg-white text-center text-[11px] text-slate-400">
          Secure Civic Network Portal. Powered by Google AI Studio.
        </footer>
      </div>
    );
  }

  const isDeptOfficer = [
    "Public Works Officer",
    "Water & Sewage Officer",
    "Sanitation Officer",
    "Electrical Officer"
  ].includes(currentUser?.role || "");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col" id="applet-main-container">
      {/* Top Navigation Bar */}
      <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">CommunityHero</span>
          </div>
          
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-500">
            <button 
              onClick={() => setActiveTab("feed")} 
              className={`py-5 transition-colors border-b-2 hover:text-slate-950 ${activeTab === "feed" ? "text-blue-600 border-blue-600 font-bold" : "border-transparent"}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab("map")} 
              className={`py-5 transition-colors border-b-2 hover:text-slate-950 ${activeTab === "map" ? "text-blue-600 border-blue-600 font-bold" : "border-transparent"}`}
            >
              Issue Map
            </button>
            <button 
              onClick={() => setActiveTab("analytics")} 
              className={`py-5 transition-colors border-b-2 hover:text-slate-950 ${activeTab === "analytics" ? "text-blue-600 border-blue-600 font-bold" : "border-transparent"}`}
            >
              Analytics
            </button>
          </div>
        </div>

        {/* Gamified Profile Bar & Role Switcher */}
        <div className="flex items-center gap-4">
          {/* Admin Push Notification Bell */}
          {(currentUser?.role === "Administrator") && (
            <div className="relative">
              <button
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                className="relative p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 rounded-xl transition cursor-pointer flex items-center justify-center shadow-xs"
                title="Admin Alerts"
              >
                <Bell className="w-4.5 h-4.5" />
                {notifications.some(n => !n.viewed) && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse border border-white">
                    {notifications.filter(n => !n.viewed).length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotificationDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                      <div className="flex items-center gap-1.5 text-slate-800">
                        <Bell className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-bold text-[11px] uppercase tracking-wide">Admin Action Alerts</span>
                      </div>
                      {notifications.length > 0 && (
                        <button
                          onClick={() => {
                            setNotifications(prev => prev.map(n => ({ ...n, viewed: true })));
                          }}
                          className="text-[10px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2.5 scrollbar-none">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 flex flex-col items-center">
                          <CheckCircle className="w-8 h-8 text-slate-200 mb-2" />
                          <p className="text-[11px] font-medium">No pending action requests.</p>
                          <p className="text-[10px] text-slate-400 mt-1">Approved post edit/delete requests show here in real-time.</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => {
                              // View and highlight the issue
                              const targetIssue = issues.find(i => i.id === notif.issueId);
                              if (targetIssue) {
                                setSelectedIssue(targetIssue);
                                // Mark as viewed
                                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, viewed: true } : n));
                                setShowNotificationDropdown(false);
                              }
                            }}
                            className={`p-2.5 rounded-xl border transition cursor-pointer text-left flex gap-3 ${
                              notif.viewed 
                                ? "bg-slate-50 hover:bg-slate-100 border-slate-100" 
                                : "bg-blue-50/70 hover:bg-blue-50 border-blue-100 shadow-2xs"
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {notif.type === "edit" ? (
                                <div className="bg-amber-100 p-1.5 rounded-lg text-amber-700">
                                  <Edit className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <div className="bg-red-100 p-1.5 rounded-lg text-red-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${
                                  notif.type === "edit" ? "text-amber-800" : "text-red-700"
                                }`}>
                                  {notif.type === "edit" ? "Edit" : "Delete"}
                                </span>
                                <span className="text-[9px] text-slate-400 shrink-0">
                                  {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-800 font-bold leading-snug truncate">
                                {notif.issueTitle}
                              </p>
                              <p className="text-[10px] text-slate-500 leading-normal truncate">
                                Requested by <span className="font-semibold text-slate-700">{notif.reporterName}</span>
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {currentUser ? (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 text-right">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reputation</div>
                  <div className="text-sm font-bold text-slate-900 italic">
                    Level {currentUser.level} Guardian <span className="text-blue-600">• {currentUser.xp} XP</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-500 shadow-sm overflow-hidden flex items-center justify-center font-bold text-blue-700">
                  {currentUser.name ? currentUser.name.split(" ").map(n => n[0]).join("").toUpperCase() : "U"}
                </div>
              </div>
              
              <button
                onClick={async () => {
                  await logoutUser();
                }}
                className="text-xs font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-100 rounded-xl px-3 py-1.5 transition-all"
                id="navbar-sign-out-btn"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthGate(true)}
              className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 transition-all shadow-sm"
              id="navbar-sign-in-btn"
            >
              Sign In
            </button>
          )}

          {currentUser && (
            <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-1.5 shadow-2xs">
              <span className="text-[10px] text-blue-500 font-bold font-mono uppercase tracking-wider">Role:</span>
              <span className="text-xs font-black text-blue-700">{currentUser.role}</span>
            </div>
          )}
        </div>
      </nav>

      {/* Main Grid Workspace */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* Main Feed/Map/Analytics Workspace Column (Full Width) */}
        <div className="lg:col-span-12 space-y-6">
          
          {/* Sub-header Stats Row / Quick Stats Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Community Issues</div>
                <div className="text-2xl font-extrabold text-slate-900">{issues.length} Cases</div>
              </div>
              <div className="text-xs text-blue-600 font-medium mt-1.5 flex items-center justify-between">
                <span>Active Feed Layer</span>
                {currentUser?.role === "Citizen" && (
                  <button
                    onClick={() => setShowReportForm(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> File New Report
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">AI Resolution Efficiency</div>
                <div className="text-2xl font-extrabold text-blue-600">98.4%</div>
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1.5">
                {issues.filter(i => i.status === "Verified").length} confirmed by local consensus
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm bg-gradient-to-br from-white to-blue-50/50 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Closed Stability</div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {issues.filter(i => i.status === "Resolved" || i.status === "Closed").length} Resolved
                </div>
              </div>
              <div className="text-xs text-blue-500 font-medium mt-1.5">
                Top response rate this week
              </div>
            </div>
          </div>

          {/* Form Trigger Conditional Render */}
          <AnimatePresence>
            {showReportForm && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="z-20 relative"
              >
                <ReportIssueForm
                  onSuccess={handleReportSuccess}
                  onCancel={() => setShowReportForm(false)}
                  currentUser={currentUser}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Selection Row */}
          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl shadow-xs">
            <button
              onClick={() => setActiveTab("feed")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "feed" 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Community Issues Feed
            </button>
            <button
              onClick={() => setActiveTab("map")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "map" 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Interactive GIS Map
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "analytics" 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              AI Predictive Analytics
            </button>
          </div>

          {/* Tab Renderers */}
          {activeTab === "feed" && (
            <div className="space-y-4">
              {/* Filter Strip */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-wrap gap-3 items-center justify-between">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                  <ListFilter className="w-4 h-4 text-slate-400" /> Filter Criteria
                </span>

                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 font-semibold focus:outline-none"
                  >
                    <option value="All">All Categories</option>
                    <option value="Pothole">Potholes</option>
                    <option value="Water Leakage">Water Leakage</option>
                    <option value="Garbage Accumulation">Garbage Accumulation</option>
                    <option value="Illegal Dumping">Illegal Dumping</option>
                    <option value="Broken Streetlight">Streetlamps</option>
                    <option value="Flooding">Flooding</option>
                    <option value="Public Safety">Public Safety</option>
                  </select>

                  {currentUser?.role !== "Administrator" && (
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 font-semibold focus:outline-none"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Pending Verification">Pending Verification</option>
                      <option value="Verified">Verified Consensus</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  )}

                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 font-semibold focus:outline-none"
                  >
                    <option value="All">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Admin-specific Workspace Navigation */}
              {currentUser?.role === "Administrator" && (
                <div className="bg-slate-100/80 border border-slate-200/80 p-2 rounded-2xl flex flex-wrap gap-2 shadow-2xs">
                  <button
                    onClick={() => setAdminSubTab("pending")}
                    className={`flex-1 min-w-[140px] px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      adminSubTab === "pending"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-slate-200/60"
                    }`}
                  >
                    <span>⏳ Pending Verification</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${adminSubTab === "pending" ? "bg-white text-amber-600 font-bold" : "bg-slate-100 text-slate-600"}`}>
                      {issues.filter(issue => ["Submitted", "AI Processing", "Pending Verification"].includes(issue.status)).length}
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setAdminSubTab("verified")}
                    className={`flex-1 min-w-[140px] px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      adminSubTab === "verified"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-slate-200/60"
                    }`}
                  >
                    <span>✅ Verified</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${adminSubTab === "verified" ? "bg-white text-emerald-700 font-bold" : "bg-slate-100 text-slate-600"}`}>
                      {issues.filter(issue => ["Verified", "Assigned", "Accepted"].includes(issue.status)).length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAdminSubTab("inprogress")}
                    className={`flex-1 min-w-[140px] px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      adminSubTab === "inprogress"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-slate-200/60"
                    }`}
                  >
                    <span>⚙️ In Progress</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${adminSubTab === "inprogress" ? "bg-white text-blue-700 font-bold" : "bg-slate-100 text-slate-600"}`}>
                      {issues.filter(issue => ["In Progress", "Completed by Assigned Department"].includes(issue.status)).length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAdminSubTab("resolved")}
                    className={`flex-1 min-w-[140px] px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      adminSubTab === "resolved"
                        ? "bg-slate-700 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-slate-200/60"
                    }`}
                  >
                    <span>🎯 Resolved</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${adminSubTab === "resolved" ? "bg-white text-slate-700 font-bold" : "bg-slate-100 text-slate-600"}`}>
                      {issues.filter(issue => ["Resolved", "Citizen Confirmation", "Closed"].includes(issue.status)).length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAdminSubTab("requests")}
                    className={`flex-1 min-w-[160px] px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      adminSubTab === "requests"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-slate-200/60"
                    }`}
                  >
                    <span>🚨 Edit/Delete Requests</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${adminSubTab === "requests" ? "bg-white text-rose-700 font-bold animate-pulse" : "bg-slate-100 text-slate-600"}`}>
                      {issues.filter(issue => issue.editRequestPending || issue.deleteRequestPending || issue.status === "Pending Edit Approval" || issue.status === "Pending Delete Approval").length}
                    </span>
                  </button>
                </div>
              )}

              {/* Feed List */}
              {(() => {
                const renderIssueCard = (issue: Issue) => {
                  const isSelected = selectedIssue?.id === issue.id;
                  const leftBorderColor = 
                    issue.severity === "Critical" ? "border-l-orange-500" :
                    issue.severity === "High" ? "border-l-amber-500" : "border-l-blue-500";
                  
                  return (
                    <div
                      key={issue.id}
                      className={`bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col relative border-l-4 ${leftBorderColor} ${
                        isSelected ? "ring-2 ring-blue-500/10 border-blue-400" : "border-slate-200"
                      }`}
                    >
                      {/* Clickable Header/Summary area */}
                      <div 
                        onClick={() => {
                          if (isSelected) {
                            setSelectedIssue(null);
                          } else {
                            setSelectedIssue(issue);
                          }
                        }}
                        className="flex flex-col md:flex-row gap-4 cursor-pointer select-none"
                      >
                        {/* Left: Thumbnail image if available */}
                        {issue.imageUrl && (
                          <div className="w-full md:w-28 h-20 rounded-lg overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
                            <img src={issue.imageUrl} alt={issue.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}

                        {/* Right: Content details */}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                                {issue.category}
                              </span>
                              <div className="flex gap-1.5 items-center">
                                {getSeverityBadge(issue.severity)}
                                {getStatusBadge(issue.status)}
                                <span className="text-slate-400 hover:text-slate-600 ml-1 transition-colors">
                                  {isSelected ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </span>
                              </div>
                            </div>

                            <h3 className="font-bold text-slate-900 text-sm md:text-base leading-snug">
                              {issue.title}
                            </h3>

                            <p className="text-slate-500 text-xs mt-1 line-clamp-1">
                              {issue.description}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-4 items-center justify-between mt-3 border-t border-slate-100 pt-2">
                            <span className="text-[10px] text-slate-400 font-semibold">
                              📍 {issue.address}
                            </span>
                            <div className="flex gap-3 text-[10px] font-mono text-slate-500">
                              <span>👍 {issue.upvotes} upvotes</span>
                              <span>💬 {issue.evidenceCount} verified comments</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details Section */}
                      <AnimatePresence>
                        {isSelected && selectedIssue && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div 
                              onClick={(e) => e.stopPropagation()} 
                              className="border-t border-slate-200/60 mt-4 pt-4 space-y-5"
                            >
                              {/* Large/Banner Image */}
                              {selectedIssue.imageUrl && (
                                <div className="rounded-xl overflow-hidden border border-slate-200 relative max-h-72 aspect-video bg-slate-50">
                                  <img src={selectedIssue.imageUrl} alt={selectedIssue.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded text-white text-[10px] font-mono">
                                    GPS accuracy: ±2.5 meters
                                  </div>
                                </div>
                              )}

                              {isEditingIssue ? (
                                <div className="space-y-4 border border-blue-100 bg-blue-50/30 p-4.5 rounded-xl">
                                  <div className="flex items-center gap-1.5 text-blue-800 text-xs font-bold uppercase tracking-wider mb-2">
                                    <Edit className="w-4 h-4" /> Edit Report Details
                                  </div>
                                  
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Title</label>
                                    <input
                                      type="text"
                                      value={editTitle}
                                      onChange={(e) => setEditTitle(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                                    <textarea
                                      rows={3}
                                      value={editDescription}
                                      onChange={(e) => setEditDescription(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                                      <select
                                        value={editCategory}
                                        onChange={(e) => setEditCategory(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                                      >
                                        <option value="Roads & Streets">Roads & Streets</option>
                                        <option value="Water & Sanitation">Water & Sanitation</option>
                                        <option value="Electricity & Power">Electricity & Power</option>
                                        <option value="Waste & Trash">Waste & Trash</option>
                                        <option value="Public Safety">Public Safety</option>
                                        <option value="Traffic & Transit">Traffic & Transit</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Severity</label>
                                      <select
                                        value={editSeverity}
                                        onChange={(e) => setEditSeverity(e.target.value as any)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                                      >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Address / Landmark</label>
                                    <input
                                      type="text"
                                      value={editAddress}
                                      onChange={(e) => setEditAddress(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>

                                  <div className="flex gap-2 justify-end pt-2">
                                    <button
                                      onClick={() => setIsEditingIssue(false)}
                                      className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleSaveEdit}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                                    >
                                      Save Changes
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {/* Reporter / Basic Info */}
                                  <div className="text-xs text-slate-600 flex flex-col gap-1.5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <span className="font-bold text-slate-850">
                                      Detailed Report Description
                                    </span>
                                    <p className="text-slate-600 leading-relaxed text-xs">
                                      {selectedIssue.description}
                                    </p>
                                    <span className="text-[10px] text-slate-400 font-mono font-bold mt-1">
                                      Reported by {selectedIssue.reporterName} on {new Date(selectedIssue.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>

                                  {/* Reporter Action Center panel */}
                                  {currentUser && currentUser.uid === selectedIssue.reporterId && (
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                        <UserIcon className="w-3.5 h-3.5 text-blue-600" /> Reporter Action Center
                                      </div>

                                      {(() => {
                                        const isPendingEditApproval = selectedIssue.status === "Pending Edit Approval" || selectedIssue.editRequestPending === true;
                                        const isPendingDeleteApproval = selectedIssue.status === "Pending Delete Approval" || selectedIssue.deleteRequestPending === true;

                                        if (isPendingEditApproval) {
                                          return (
                                            <div className="space-y-2">
                                              <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs">
                                                <span className="flex items-center gap-1.5 font-bold">
                                                  ⏳ Edit Request Pending Approval
                                                </span>
                                                <p className="mt-1 text-[11px] text-amber-700 font-normal leading-normal">
                                                  Your request to edit this report is currently pending review by an Administrator. You will be able to edit this post once approved.
                                                </p>
                                              </div>
                                            </div>
                                          );
                                        }

                                        if (isPendingDeleteApproval) {
                                          return (
                                            <div className="space-y-2">
                                              <div className="bg-rose-50/80 border border-rose-200 p-3 rounded-lg text-rose-800 text-xs">
                                                <span className="flex items-center gap-1.5 font-bold">
                                                  ⏳ Delete Request Pending Approval
                                                </span>
                                                <p className="mt-1 text-[11px] text-rose-700 font-normal leading-normal">
                                                  Your request to delete this report is currently pending review by an Administrator. The post will be removed once approved.
                                                </p>
                                              </div>
                                            </div>
                                          );
                                        }

                                        const isApproved = [
                                          "Verified",
                                          "Assigned",
                                          "Accepted",
                                          "In Progress",
                                          "Completed by Assigned Department",
                                          "Resolved",
                                          "Citizen Confirmation",
                                          "Closed"
                                        ].includes(selectedIssue.status);

                                        if (!isApproved) {
                                          return (
                                            <div className="space-y-2">
                                              <p className="text-[11px] text-slate-500">
                                                This issue is currently pending admin approval. You can edit or delete this report directly.
                                              </p>
                                              <div className="flex gap-2">
                                                <button
                                                  onClick={startEditing}
                                                  className="flex-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                                                >
                                                  <Edit className="w-3.5 h-3.5" /> Edit Report
                                                </button>
                                                <button
                                                  onClick={handleDeleteIssue}
                                                  className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" /> Delete Report
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        } else {
                                          const canEdit = selectedIssue.editRequestApproved === true;
                                          const canDelete = selectedIssue.deleteRequestApproved === true;
                                          const editPending = selectedIssue.editRequestPending === true;
                                          const deletePending = selectedIssue.deleteRequestPending === true;

                                          return (
                                            <div className="space-y-2">
                                              <p className="text-[11px] text-amber-700 font-medium">
                                                ⚠️ This report has been verified/approved. Edits or deletions now require admin authorization.
                                              </p>

                                              <div className="space-y-2 pt-1">
                                                {canEdit ? (
                                                  <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg flex items-center justify-between">
                                                    <span className="text-[11px] text-emerald-800 font-semibold">🎉 Edit request approved!</span>
                                                    <button
                                                      onClick={startEditing}
                                                      className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer transition-all"
                                                    >
                                                      <Edit className="w-3 h-3" /> Edit Now
                                                    </button>
                                                  </div>
                                                ) : editPending ? (
                                                  <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                                                    <span className="text-[11px] text-slate-600 font-semibold flex items-center justify-center gap-1">
                                                      ⏳ Edit request pending...
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <button
                                                    onClick={handleRequestEdit}
                                                    className="w-full py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                                                  >
                                                    <Edit className="w-3.5 h-3.5" /> Request Edit Authorization
                                                  </button>
                                                )}

                                                {canDelete ? (
                                                  <div className="bg-red-50 border border-red-100 p-2.5 rounded-lg flex items-center justify-between">
                                                    <span className="text-[11px] text-red-800 font-semibold">🎉 Delete request approved!</span>
                                                    <button
                                                      onClick={handleDeleteIssue}
                                                      className="py-1 px-2.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer transition-all"
                                                    >
                                                      <Trash2 className="w-3 h-3" /> Delete Now
                                                    </button>
                                                  </div>
                                                ) : deletePending ? (
                                                  <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                                                    <span className="text-[11px] text-slate-600 font-semibold flex items-center justify-center gap-1">
                                                      ⏳ Delete request pending...
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <button
                                                    onClick={handleRequestDelete}
                                                    className="w-full py-1.5 bg-white hover:bg-red-50 hover:text-red-700 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" /> Request Delete Authorization
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        }
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* AI Diagnosis Insights Dashboard Card */}
                              {selectedIssue.aiAnalysis && (
                                <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-850 relative">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="bg-blue-600 text-[9px] font-bold px-2 py-0.5 rounded text-white tracking-wider uppercase">GEMINI AI ENGINE</div>
                                    <div className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Analysis Summary</div>
                                  </div>
                                  
                                  <h4 className="text-base font-bold text-white mb-2">AI Confidence Score: {Math.round(selectedIssue.aiAnalysis.confidenceScore * 100)}%</h4>
                                  
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 border-b border-slate-850 pb-3">
                                    <div className="flex justify-between border-b border-slate-800 pb-1">
                                      <span className="text-[10px] text-slate-400 font-medium">Category</span>
                                      <span className="text-[10px] font-mono text-green-400 uppercase font-bold">{selectedIssue.aiAnalysis.category}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-800 pb-1">
                                      <span className="text-[10px] text-slate-400 font-medium">Threat Rating</span>
                                      <span className="text-[10px] font-mono text-orange-400 font-bold">{selectedIssue.aiAnalysis.priorityScore}/100</span>
                                    </div>
                                  </div>

                                  <div className="space-y-1 text-xs text-slate-300">
                                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Risk Assessment</span>
                                    <p className="leading-relaxed text-[11px] text-slate-300">
                                      {selectedIssue.aiAnalysis.riskAssessment}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Operational workflow checklists */}
                              {selectedIssue.resolutionSteps && selectedIssue.resolutionSteps.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                                  <span className="block font-bold text-slate-700 text-xs uppercase tracking-wider">
                                    🔧 AI Resolution Checklist
                                  </span>
                                  {selectedIssue.assignedDepartment && (
                                    <div className="text-[10px] bg-slate-200/60 text-slate-700 px-2 py-1 rounded font-semibold font-mono inline-block">
                                      Assigned: {selectedIssue.assignedDepartment}
                                    </div>
                                  )}
                                  <ul className="space-y-2 text-xs">
                                    {selectedIssue.resolutionSteps.map((step, idx) => (
                                      <li key={idx} className="flex gap-2 items-start text-slate-600">
                                        <span className="bg-white border border-slate-200 text-[9px] font-mono font-bold w-4 h-4 rounded flex items-center justify-center shrink-0">
                                          {idx + 1}
                                        </span>
                                        <span>{step}</span>
                                      </li>
                                    ))}
                                  </ul>

                                  {selectedIssue.materialsRequired && (
                                    <div className="border-t border-slate-200/50 pt-2 text-[11px]">
                                      <span className="font-bold text-slate-700 block mb-0.5">Recommended Materials:</span>
                                      <span className="text-slate-500 font-mono text-[10px]">
                                        {selectedIssue.materialsRequired.join(", ")}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Citizen consensus and verification center */}
                              <div className="border-t border-slate-200 pt-4 space-y-4">
                                <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                                  Verified Consensus Portal
                                </h5>
                                
                                {/* Votes buttons */}
                                <div className="flex gap-2.5">
                                  <button
                                    onClick={() => handleVote("upvote")}
                                    className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95"
                                  >
                                    👍 Upvote Support ({selectedIssue.upvotes || 0})
                                  </button>
                                  <button
                                    onClick={() => handleVote("downvote")}
                                    className="flex-1 py-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95"
                                  >
                                    👎 Oppose ({selectedIssue.downvotes || 0})
                                  </button>
                                </div>

                                {/* Verification comment log */}
                                <div className="space-y-2.5">
                                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                                    Evidence commentary ({selectedIssueVerifications.length})
                                  </span>
                                  {selectedIssueVerifications.length > 0 ? (
                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                      {selectedIssueVerifications.map((v) => (
                                        <div key={v.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                                          <div className="flex justify-between text-[9px] text-slate-400 font-bold mb-0.5">
                                            <span>{v.userName} ({v.userRole})</span>
                                            <span>{new Date(v.createdAt).toLocaleTimeString()}</span>
                                          </div>
                                          <p className="text-slate-600 leading-normal">{v.comment}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="block text-center text-slate-400 text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      No commentary yet. Be the first to upload evidence notes.
                                    </span>
                                  )}

                                  {/* Add comment input */}
                                  <form onSubmit={handleAddEvidence} className="flex gap-2 mt-2">
                                    <input
                                      type="text"
                                      required
                                      placeholder="Add your proximity check details or evidence description..."
                                      value={verificationComment}
                                      onChange={(e) => setVerificationComment(e.target.value)}
                                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <button
                                      type="submit"
                                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shrink-0"
                                    >
                                      Submit
                                    </button>
                                  </form>
                                </div>
                              </div>

                              {/* DEPARTMENT OFFICERS WORKFLOW */}
                              {isDeptOfficer && (
                                <div className="border border-indigo-100 pt-4 space-y-3 bg-indigo-50/20 p-4.5 rounded-xl">
                                  <span className="font-bold text-xs uppercase text-indigo-800 tracking-wider flex items-center gap-1.5">
                                    <Building className="w-4 h-4 text-indigo-600" /> Department Action Portal ({currentUser?.department})
                                  </span>

                                  {selectedIssue.status === "Completed by Assigned Department" ? (
                                    <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-center space-y-1">
                                      <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto animate-bounce" />
                                      <h6 className="font-bold text-emerald-800 text-xs">Task Completed & Submitted</h6>
                                      <p className="text-[11px] text-slate-500">
                                        Awaiting final verification by a Municipality Officer.
                                      </p>
                                      {selectedIssue.completedImageUrl && (
                                        <div className="mt-2 rounded-lg overflow-hidden border border-emerald-200 max-h-36 aspect-video bg-white mx-auto">
                                          <img src={selectedIssue.completedImageUrl} alt="My completed work" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <form onSubmit={handleCompleteByDepartment} className="space-y-3">
                                      <p className="text-[11px] text-slate-500">
                                        To mark this incident as complete, you must capture/upload a photograph of the finished repairs and input your completion logs.
                                      </p>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                          📸 Upload Completion Photo
                                        </label>
                                        {completionPhoto ? (
                                          <div className="relative rounded-lg overflow-hidden border border-indigo-200 max-h-40 aspect-video bg-slate-50">
                                            <img src={completionPhoto} alt="Completion Proof" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            <button
                                              type="button"
                                              onClick={() => setCompletionPhoto(null)}
                                              className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-600 text-white rounded-lg transition-colors text-[10px] font-bold cursor-pointer"
                                            >
                                              Remove Photo
                                            </button>
                                          </div>
                                        ) : (
                                          <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all">
                                            <Upload className="w-5 h-5 text-indigo-500 mb-1" />
                                            <span className="text-[11px] font-bold text-slate-700">Choose completed task photograph</span>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              required
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                    setCompletionPhoto(reader.result as string);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                              className="hidden"
                                            />
                                          </label>
                                        )}
                                      </div>

                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                          Completion Crew Notes
                                        </label>
                                        <textarea
                                          rows={2.5}
                                          required
                                          placeholder="Describe materials used, final measurements, and safety checks completed..."
                                          value={completionNotes}
                                          onChange={(e) => setCompletionNotes(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                                        />
                                      </div>

                                      <button
                                        type="submit"
                                        disabled={submittingCompletion || !completionPhoto}
                                        className={`w-full py-2 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                          !completionPhoto 
                                            ? "bg-slate-300 cursor-not-allowed" 
                                            : "bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                                        }`}
                                      >
                                        {submittingCompletion ? (
                                          <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting completion proof...
                                          </>
                                        ) : (
                                          <>✓ Submit Completed Task</>
                                        )}
                                      </button>
                                    </form>
                                  )}
                                </div>
                              )}

                              {/* OFFICER ACTIONS WORKFLOW (Independent Privileges) */}
                              {(currentUser?.role === "Municipality Officer" || currentUser?.role === "Administrator") && (
                                <div className="border border-slate-200 pt-4 space-y-3 bg-slate-50 p-4.5 rounded-xl">
                                  <span className="font-bold text-xs uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                                    <FileCheck className="w-4 h-4 text-blue-600" /> Authorized Officer Panel
                                  </span>

                                  {/* Citizen Request Approvals (Admin/Officer only) */}
                                  {(selectedIssue.editRequestPending || selectedIssue.deleteRequestPending) && (
                                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg space-y-2 text-xs">
                                      <span className="font-bold text-amber-800 block uppercase tracking-wide text-[10px]">
                                        ⚠️ Pending Citizen Modification Requests
                                      </span>
                                      
                                      {selectedIssue.editRequestPending && (
                                        <div className="bg-white p-2.5 rounded border border-amber-100 space-y-2">
                                          <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                                            Citizen <strong>{selectedIssue.reporterName}</strong> has requested authorization to <strong>Edit</strong> this approved report.
                                          </p>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={handleAdminApproveEditRequest}
                                              className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded cursor-pointer transition"
                                            >
                                              Approve Edit
                                            </button>
                                            <button
                                              onClick={handleAdminRejectEditRequest}
                                              className="flex-1 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[11px] font-semibold rounded cursor-pointer transition"
                                            >
                                              Reject
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {selectedIssue.deleteRequestPending && (
                                        <div className="bg-white p-2.5 rounded border border-amber-100 space-y-2">
                                          <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                                            Citizen <strong>{selectedIssue.reporterName}</strong> has requested authorization to <strong>Delete</strong> this approved report.
                                          </p>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={handleAdminApproveDeleteRequest}
                                              className="flex-1 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded cursor-pointer transition"
                                            >
                                              Approve Delete
                                            </button>
                                            <button
                                              onClick={handleAdminRejectDeleteRequest}
                                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded cursor-pointer transition"
                                            >
                                              Reject
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Municipal Officer verification of completed task */}
                                  {selectedIssue.status === "Completed by Assigned Department" && (
                                    <div className="space-y-3 bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg">
                                      <span className="block text-[10px] font-bold text-indigo-700 uppercase">
                                        📸 Completion Proof Uploaded by Department Crew
                                      </span>
                                      {selectedIssue.completedImageUrl ? (
                                        <div className="rounded-lg overflow-hidden border border-indigo-200 aspect-video max-h-48 bg-slate-100">
                                          <img 
                                            src={selectedIssue.completedImageUrl} 
                                            alt="Completion Evidence" 
                                            className="w-full h-full object-cover" 
                                            referrerPolicy="no-referrer" 
                                          />
                                        </div>
                                      ) : (
                                        <div className="text-slate-400 text-xs italic">No photograph provided</div>
                                      )}
                                      {selectedIssue.completedNotes && (
                                        <p className="text-xs text-slate-600 bg-white p-2.5 rounded border border-slate-200">
                                          <strong className="text-slate-700 font-bold block mb-0.5">Crew Notes:</strong>
                                          {selectedIssue.completedNotes}
                                        </p>
                                      )}
                                      <button
                                        onClick={() => handleStatusChange("Resolved", "Municipal Officer validated completed task photo and authorized resolution state.")}
                                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                                      >
                                        ✓ Verify completed photo & mark as Resolved
                                      </button>
                                    </div>
                                  )}

                                  <div className="flex flex-wrap gap-2">
                                    {selectedIssue.status === "Pending Verification" && (
                                      <button
                                        onClick={() => handleStatusChange("Verified", "Municipal Officer validated report and authorized dispatch workflow.")}
                                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                                      >
                                        ✓ Approve & Verify Incident
                                      </button>
                                    )}

                                    {selectedIssue.status === "Verified" && currentUser?.role === "Municipality Officer" && (
                                      <button
                                        onClick={() => handleStatusChange("In Progress", "Assigned officer. Repair crews dispatched with inventory.")}
                                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                                      >
                                        ⚙ Dispatch Crews (In Progress)
                                      </button>
                                    )}

                                    {selectedIssue.status === "Verified" && currentUser?.role === "Administrator" && (
                                      <div className="text-xs text-slate-500 bg-slate-100/80 border border-slate-200 p-3 rounded-lg flex items-center gap-1.5 italic font-medium w-full">
                                        <span>ℹ️ Only Municipality Officers are authorized to dispatch repair crews.</span>
                                      </div>
                                    )}

                                    {/* Generates Gemini Smart checklist if missing */}
                                    {(!selectedIssue.resolutionSteps || selectedIssue.resolutionSteps.length === 0) && (
                                      <button
                                        onClick={handleGenerateResolutionSteps}
                                        disabled={loadingResolutionSteps}
                                        className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-blue-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                                      >
                                        {loadingResolutionSteps ? (
                                          <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching AI Resolution steps...
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles className="w-3.5 h-3.5" /> Suggest AI repair checklist
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {/* Resolution actions with Notes inputs */}
                                  {selectedIssue.status === "In Progress" && (
                                    <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs space-y-1">
                                      <span className="flex items-center gap-1.5 font-bold">
                                        ⏳ Awaiting Department Repair & Proof Submission
                                      </span>
                                      <p className="text-[11px] text-slate-600 font-normal leading-normal">
                                        The assigned department must complete the repair tasks, upload the completed photograph as evidence, and submit their notes before this case can be verified and marked as Resolved.
                                      </p>
                                    </div>
                                  )}

                                  {/* Department Routing Section */}
                                  {currentUser?.role === "Municipality Officer" && selectedIssue.status !== "Resolved" && selectedIssue.status !== "Closed" && (
                                    <div className="border-t border-slate-200/60 pt-3 mt-2 space-y-2.5">
                                      <div className="flex justify-between items-center">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                          🏢 Route Problem to Department
                                        </label>
                                        
                                        {/* Ask AI Router Trigger */}
                                        {!(selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion) && (
                                          <button
                                            type="button"
                                            onClick={handleFetchDeptSuggestion}
                                            disabled={loadingDeptSuggestion}
                                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition"
                                          >
                                            {loadingDeptSuggestion ? (
                                              <>
                                                <Loader2 className="w-3 h-3 animate-spin" /> Analyzing routing...
                                              </>
                                            ) : (
                                              <>
                                                <Sparkles className="w-3 h-3 text-indigo-500 fill-indigo-200" /> Get AI Suggestion
                                              </>
                                            )}
                                          </button>
                                        )}
                                      </div>

                                      {/* AI Suggestion Box */}
                                      {(selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion) && (
                                        <div className="bg-gradient-to-r from-indigo-50 to-blue-50/50 border border-indigo-100 rounded-xl p-3 text-xs space-y-1.5 shadow-xs">
                                          <div className="flex justify-between items-start">
                                            <span className="font-bold text-[10px] uppercase text-indigo-800 tracking-wider flex items-center gap-1 flex-wrap">
                                              <Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-200 animate-pulse" /> AI Smart Routing Recommendation
                                            </span>
                                            <button
                                              type="button"
                                              onClick={handleFetchDeptSuggestion}
                                              disabled={loadingDeptSuggestion}
                                              className="text-[9px] font-semibold text-indigo-600 hover:underline cursor-pointer disabled:opacity-50"
                                            >
                                              {loadingDeptSuggestion ? "Updating..." : "Recalculate"}
                                            </button>
                                          </div>
                                          <div>
                                            <p className="text-slate-700 font-semibold text-xs">
                                              Suggested: <span className="text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/60 text-[11px] inline-block">{selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment}</span>
                                            </p>
                                            <p className="text-[11px] text-slate-500 italic mt-1 leading-relaxed">
                                              "{(selectedIssue.aiAnalysis?.suggestedDepartmentReason || onDemandDeptSuggestion?.suggestedDepartmentReason)}"
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              const targetDept = selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment;
                                              if (targetDept) {
                                                await handleRouteDepartment(targetDept);
                                              }
                                            }}
                                            disabled={selectedIssue.assignedDepartment === (selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment)}
                                            className={`w-full py-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                                              selectedIssue.assignedDepartment === (selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment)
                                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow-sm cursor-pointer"
                                            }`}
                                          >
                                            {selectedIssue.assignedDepartment === (selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment) ? (
                                              <>✓ Applied Recommendation</>
                                            ) : (
                                              <>Assign to {selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment}</>
                                            )}
                                          </button>
                                        </div>
                                      )}

                                      <div className="flex gap-2">
                                        <select
                                          value={selectedIssue.assignedDepartment || ""}
                                          onChange={async (e) => {
                                            await handleRouteDepartment(e.target.value);
                                          }}
                                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/30 animate-none"
                                        >
                                          <option value="" disabled>Select department to assign...</option>
                                          {["Public Works", "Water & Sewage", "Sanitation Dept", "Electrical Grid"].map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  )}

                                  {currentUser?.role === "Administrator" && selectedIssue.assignedDepartment && (
                                    <div className="border-t border-slate-200 pt-3 text-xs text-slate-600 flex justify-between">
                                      <span className="font-bold">Routed Department:</span>
                                      <span className="bg-blue-50 text-blue-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                                        {selectedIssue.assignedDepartment}
                                      </span>
                                    </div>
                                  )}

                                  {/* Reject, spam, and delete options */}
                                  {currentUser?.role === "Municipality Officer" && (
                                    <div className="flex gap-2 border-t border-slate-200 pt-3 mt-1">
                                      {selectedIssue.status !== "Resolved" && selectedIssue.status !== "Closed" && (
                                        <>
                                          <button
                                            onClick={() => handleStatusChange("Rejected", "Declined: Insufficient hazard criteria detected on site inspection.")}
                                            className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                                          >
                                            Decline report
                                          </button>
                                          <button
                                            onClick={() => handleStatusChange("Spam", "Identified as malicious false report. Reporter flag compiled.")}
                                            className="flex-1 py-1.5 border border-red-200 hover:bg-red-50 text-red-500 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                                          >
                                            Spam flag
                                          </button>
                                        </>
                                      )}
                                      <button
                                        onClick={handleDeleteIssue}
                                        className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-[10px] font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3 text-red-500" /> Delete Report
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Audit Timeline panel */}
                              <div className="border-t border-slate-200 pt-4">
                                <span className="block font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">
                                  Auditable Security Timeline Logs
                                </span>
                                {selectedIssueTimeline.length > 0 ? (
                                  <div className="relative border-l border-slate-100 pl-4 space-y-3 pb-2 ml-1">
                                    {selectedIssueTimeline.map((item, idx) => (
                                      <div key={item.id} className="relative text-xs">
                                        {/* Bullet dot */}
                                        <span className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-100" />
                                        <div className="flex justify-between text-[9px] text-slate-400 font-mono mb-0.5">
                                          <span>{item.actorName} ({item.actorRole})</span>
                                          <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                        <span className="inline-block text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 rounded mb-1">
                                          {item.fromStatus} → {item.toStatus}
                                        </span>
                                        <p className="text-slate-500 leading-normal">{item.comment}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="py-4 text-center text-slate-400 text-xs font-mono">
                                    Loading timeline logs...
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                };

                const isCitizen = !currentUser || currentUser.role === "Citizen" || currentUser.role === "Guest";

                if (filteredIssues.length === 0) {
                  return (
                    <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-400 text-sm">
                      No issues reported matching your filter selections.
                    </div>
                  );
                }

                if (isCitizen) {
                  const myReportedIssues = filteredIssues.filter(
                    issue => currentUser && issue.reporterId === currentUser.uid
                  );
                  const communityIssues = filteredIssues.filter(
                    issue => !currentUser || issue.reporterId !== currentUser.uid
                  );

                  return (
                    <div className="space-y-6">
                      {/* Section 1: My Reported Issues */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <UserIcon className="w-4 h-4 text-blue-500" />
                            My Reported Issues
                            <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                              {myReportedIssues.length}
                            </span>
                          </h4>
                        </div>
                        
                        {myReportedIssues.length > 0 ? (
                          <div className="grid grid-cols-1 gap-4">
                            {myReportedIssues.map(issue => renderIssueCard(issue))}
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs font-medium">
                            No issues reported by you. Click "Report New Issue" to submit one.
                          </div>
                        )}
                      </div>

                      {/* Section 2: Community Issues */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-emerald-500" />
                            Verified & In-Progress Issues
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                              {communityIssues.length}
                            </span>
                          </h4>
                        </div>

                        {communityIssues.length > 0 ? (
                          <div className="grid grid-cols-1 gap-4">
                            {communityIssues.map(issue => renderIssueCard(issue))}
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs font-medium">
                            No other verified or in-progress issues found in the community.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                if (currentUser?.role === "Administrator") {
                  let adminFilteredIssues = filteredIssues;
                  if (adminSubTab === "pending") {
                    adminFilteredIssues = filteredIssues.filter(issue => 
                      ["Submitted", "AI Processing", "Pending Verification"].includes(issue.status)
                    );
                  } else if (adminSubTab === "verified") {
                    adminFilteredIssues = filteredIssues.filter(issue => 
                      ["Verified", "Assigned", "Accepted"].includes(issue.status)
                    );
                  } else if (adminSubTab === "inprogress") {
                    adminFilteredIssues = filteredIssues.filter(issue => 
                      ["In Progress", "Completed by Assigned Department"].includes(issue.status)
                    );
                  } else if (adminSubTab === "resolved") {
                    adminFilteredIssues = filteredIssues.filter(issue => 
                      ["Resolved", "Citizen Confirmation", "Closed"].includes(issue.status)
                    );
                  } else if (adminSubTab === "requests") {
                    adminFilteredIssues = filteredIssues.filter(issue => 
                      issue.editRequestPending || issue.deleteRequestPending || issue.status === "Pending Edit Approval" || issue.status === "Pending Delete Approval"
                    );
                  }

                  if (adminFilteredIssues.length === 0) {
                    return (
                      <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-400 text-sm">
                        No issues found in this administrative section.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 gap-4">
                      {adminFilteredIssues.map(issue => renderIssueCard(issue))}
                    </div>
                  );
                }

                // Regular Officer View
                return (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredIssues.map(issue => renderIssueCard(issue))}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === "map" && (
            <IssueMap
              issues={filteredIssues}
              onSelectIssue={(issue) => {
                setSelectedIssue(issue);
                setActiveTab("feed");
              }}
              selectedIssueId={selectedIssue?.id}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsPanel issues={issues} />
          )}

        </div>

        {/* Right Column has been embedded inline inside the toggleable card component */}
        <div className="hidden">
          <AnimatePresence mode="wait">
            {selectedIssue ? (
              <motion.div
                key={selectedIssue.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm sticky top-24"
                id="issue-details-panel"
              >
                {/* Header detail */}
                <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <span className="bg-slate-100 text-slate-700 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                      ID: {selectedIssue.id}
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm mt-1">
                      Report File Information
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedIssue(null)}
                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-md transition text-xs font-bold"
                  >
                    ✕ Close Panel
                  </button>
                </div>

                {/* Banner Image */}
                {selectedIssue.imageUrl && (
                  <div className="h-44 w-full overflow-hidden border-b border-slate-200 relative">
                    <img src={selectedIssue.imageUrl} alt={selectedIssue.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded text-white text-[10px] font-mono">
                      GPS accuracy: ±2.5 meters
                    </div>
                  </div>
                )}

                {/* Info summary */}
                <div className="p-5 space-y-5">
                  {isEditingIssue ? (
                    <div className="space-y-4 border border-blue-100 bg-blue-50/30 p-4.5 rounded-xl">
                      <div className="flex items-center gap-1.5 text-blue-800 text-xs font-bold uppercase tracking-wider mb-2">
                        <Edit className="w-4 h-4" /> Edit Report Details
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                        <textarea
                          rows={3}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                          >
                            <option value="Roads & Streets">Roads & Streets</option>
                            <option value="Water & Sanitation">Water & Sanitation</option>
                            <option value="Electricity & Power">Electricity & Power</option>
                            <option value="Waste & Trash">Waste & Trash</option>
                            <option value="Public Safety">Public Safety</option>
                            <option value="Traffic & Transit">Traffic & Transit</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Severity</label>
                          <select
                            value={editSeverity}
                            onChange={(e) => setEditSeverity(e.target.value as any)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Address / Landmark</label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          onClick={() => setIsEditingIssue(false)}
                          className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {getSeverityBadge(selectedIssue.severity)}
                        {getStatusBadge(selectedIssue.status)}
                        {selectedIssue.assignedDepartment && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider flex items-center gap-1">
                            🏢 {selectedIssue.assignedDepartment}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 text-base md:text-lg tracking-tight">
                        {selectedIssue.title}
                      </h4>
                      <p className="text-slate-500 text-xs leading-relaxed mt-2">
                        {selectedIssue.description}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-3 font-mono font-bold">
                        Reported by {selectedIssue.reporterName} on {new Date(selectedIssue.createdAt).toLocaleDateString()}
                      </span>

                      {/* Reporter Action Center panel */}
                      {currentUser && currentUser.uid === selectedIssue.reporterId && (
                        <div className="mt-4 bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-blue-600" /> Reporter Action Center
                          </div>

                          {(() => {
                            const isPendingEditApproval = selectedIssue.status === "Pending Edit Approval" || selectedIssue.editRequestPending === true;
                            const isPendingDeleteApproval = selectedIssue.status === "Pending Delete Approval" || selectedIssue.deleteRequestPending === true;

                            if (isPendingEditApproval) {
                              return (
                                <div className="space-y-2">
                                  <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs">
                                    <span className="flex items-center gap-1.5 font-bold">
                                      ⏳ Edit Request Pending Approval
                                    </span>
                                    <p className="mt-1 text-[11px] text-amber-700 font-normal leading-normal">
                                      Your request to edit this report is currently pending review by an Administrator. You will be able to edit this post once approved.
                                    </p>
                                  </div>
                                </div>
                              );
                            }

                            if (isPendingDeleteApproval) {
                              return (
                                <div className="space-y-2">
                                  <div className="bg-rose-50/80 border border-rose-200 p-3 rounded-lg text-rose-800 text-xs">
                                    <span className="flex items-center gap-1.5 font-bold">
                                      ⏳ Delete Request Pending Approval
                                    </span>
                                    <p className="mt-1 text-[11px] text-rose-700 font-normal leading-normal">
                                      Your request to delete this report is currently pending review by an Administrator. The post will be removed once approved.
                                    </p>
                                  </div>
                                </div>
                              );
                            }

                            const isApproved = [
                              "Verified",
                              "Assigned",
                              "Accepted",
                              "In Progress",
                              "Completed by Assigned Department",
                              "Resolved",
                              "Citizen Confirmation",
                              "Closed"
                            ].includes(selectedIssue.status);

                            if (!isApproved) {
                              return (
                                <div className="space-y-2">
                                  <p className="text-[11px] text-slate-500">
                                    This issue is currently pending admin approval. You can edit or delete this report directly.
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={startEditing}
                                      className="flex-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                                    >
                                      <Edit className="w-3.5 h-3.5" /> Edit Report
                                    </button>
                                    <button
                                      onClick={handleDeleteIssue}
                                      className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete Report
                                    </button>
                                  </div>
                                </div>
                              );
                            } else {
                              const canEdit = selectedIssue.editRequestApproved === true;
                              const canDelete = selectedIssue.deleteRequestApproved === true;
                              const editPending = selectedIssue.editRequestPending === true;
                              const deletePending = selectedIssue.deleteRequestPending === true;

                              return (
                                <div className="space-y-2">
                                  <p className="text-[11px] text-amber-700 font-medium">
                                    ⚠️ This report has been verified/approved. Edits or deletions now require admin authorization.
                                  </p>

                                  <div className="space-y-2 pt-1">
                                    {canEdit ? (
                                      <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg flex items-center justify-between">
                                        <span className="text-[11px] text-emerald-800 font-semibold">🎉 Edit request approved!</span>
                                        <button
                                          onClick={startEditing}
                                          className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                          <Edit className="w-3 h-3" /> Edit Now
                                        </button>
                                      </div>
                                    ) : editPending ? (
                                      <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                                        <span className="text-[11px] text-slate-600 font-semibold flex items-center justify-center gap-1">
                                          ⏳ Edit request pending...
                                        </span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={handleRequestEdit}
                                        className="w-full py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                                      >
                                        <Edit className="w-3.5 h-3.5" /> Request Edit Authorization
                                      </button>
                                    )}

                                    {canDelete ? (
                                      <div className="bg-red-50 border border-red-100 p-2.5 rounded-lg flex items-center justify-between">
                                        <span className="text-[11px] text-red-800 font-semibold">🎉 Delete request approved!</span>
                                        <button
                                          onClick={handleDeleteIssue}
                                          className="py-1 px-2.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                          <Trash2 className="w-3 h-3" /> Delete Now
                                        </button>
                                      </div>
                                    ) : deletePending ? (
                                      <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                                        <span className="text-[11px] text-slate-600 font-semibold flex items-center justify-center gap-1">
                                          ⏳ Delete request pending...
                                        </span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={handleRequestDelete}
                                        className="w-full py-1.5 bg-white hover:bg-red-50 hover:text-red-700 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> Request Delete Authorization
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Diagnosis Insights Dashboard Card (Clean Minimalism Style) */}
                  {selectedIssue.aiAnalysis && (
                    <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-850 relative">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="bg-blue-600 text-[9px] font-bold px-2 py-0.5 rounded text-white tracking-wider uppercase">GEMINI AI ENGINE</div>
                        <div className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Analysis Summary</div>
                      </div>
                      
                      <h4 className="text-base font-bold text-white mb-2">AI Confidence Score: {Math.round(selectedIssue.aiAnalysis.confidenceScore * 100)}%</h4>
                      
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 border-b border-slate-850 pb-3">
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                          <span className="text-[10px] text-slate-400 font-medium">Category</span>
                          <span className="text-[10px] font-mono text-green-400 uppercase font-bold">{selectedIssue.aiAnalysis.category}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                          <span className="text-[10px] text-slate-400 font-medium">Threat Rating</span>
                          <span className="text-[10px] font-mono text-orange-400 font-bold">{selectedIssue.aiAnalysis.priorityScore}/100</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-slate-300">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Risk Assessment</span>
                        <p className="leading-relaxed text-[11px] text-slate-300">
                          {selectedIssue.aiAnalysis.riskAssessment}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Operational workflow checklists */}
                  {selectedIssue.resolutionSteps && selectedIssue.resolutionSteps.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                      <span className="block font-bold text-slate-700 text-xs uppercase tracking-wider">
                        🔧 AI Resolution Checklist
                      </span>
                      {selectedIssue.assignedDepartment && (
                        <div className="text-[10px] bg-slate-200/60 text-slate-700 px-2 py-1 rounded font-semibold font-mono">
                          Assigned: {selectedIssue.assignedDepartment}
                        </div>
                      )}
                      <ul className="space-y-2 text-xs">
                        {selectedIssue.resolutionSteps.map((step, idx) => (
                          <li key={idx} className="flex gap-2 items-start text-slate-600">
                            <span className="bg-white border border-slate-200 text-[9px] font-mono font-bold w-4 h-4 rounded flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>

                      {selectedIssue.materialsRequired && (
                        <div className="border-t border-slate-200/50 pt-2 text-[11px]">
                          <span className="font-bold text-slate-700 block mb-0.5">Recommended Materials:</span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {selectedIssue.materialsRequired.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Citizen consensus and verification center */}
                  <div className="border-t border-slate-200 pt-4 space-y-4">
                    <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                      Verified Consensus Portal
                    </h5>
                    
                    {/* Votes buttons */}
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => handleVote("upvote")}
                        className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        👍 Upvote Support ({selectedIssue.upvotes || 0})
                      </button>
                      <button
                        onClick={() => handleVote("downvote")}
                        className="flex-1 py-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        👎 Oppose ({selectedIssue.downvotes || 0})
                      </button>
                    </div>

                    {/* Verification comment log */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                        Evidence commentary ({selectedIssueVerifications.length})
                      </span>
                      {selectedIssueVerifications.length > 0 ? (
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                          {selectedIssueVerifications.map((v) => (
                            <div key={v.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                              <div className="flex justify-between text-[9px] text-slate-400 font-bold mb-0.5">
                                <span>{v.userName} ({v.userRole})</span>
                                <span>{new Date(v.createdAt).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-slate-600 leading-normal">{v.comment}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="block text-center text-slate-400 text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                          No commentary yet. Be the first to upload evidence notes.
                        </span>
                      )}

                      {/* Add comment input */}
                      <form onSubmit={handleAddEvidence} className="flex gap-2 mt-2">
                        <input
                          type="text"
                          required
                          placeholder="Add your proximity check details or evidence description..."
                          value={verificationComment}
                          onChange={(e) => setVerificationComment(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button
                          type="submit"
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shrink-0"
                        >
                          Submit
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* DEPARTMENT OFFICERS WORKFLOW */}
                  {isDeptOfficer && (
                    <div className="border border-indigo-100 pt-4 space-y-3 bg-indigo-50/20 p-4.5 rounded-xl">
                      <span className="font-bold text-xs uppercase text-indigo-800 tracking-wider flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-indigo-600" /> Department Action Portal ({currentUser?.department})
                      </span>

                      {selectedIssue.status === "Completed by Assigned Department" ? (
                        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-center space-y-1">
                          <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto animate-bounce" />
                          <h6 className="font-bold text-emerald-800 text-xs">Task Completed & Submitted</h6>
                          <p className="text-[11px] text-slate-500">
                            Awaiting final verification by a Municipality Officer.
                          </p>
                          {selectedIssue.completedImageUrl && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-emerald-200 max-h-36 aspect-video bg-white mx-auto">
                              <img src={selectedIssue.completedImageUrl} alt="My completed work" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <form onSubmit={handleCompleteByDepartment} className="space-y-3">
                          <p className="text-[11px] text-slate-500">
                            To mark this incident as complete, you must capture/upload a photograph of the finished repairs and input your completion logs.
                          </p>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              📸 Upload Completion Photo
                            </label>
                            {completionPhoto ? (
                              <div className="relative rounded-lg overflow-hidden border border-indigo-200 max-h-40 aspect-video bg-slate-50">
                                <img src={completionPhoto} alt="Completion Proof" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <button
                                  type="button"
                                  onClick={() => setCompletionPhoto(null)}
                                  className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-600 text-white rounded-lg transition-colors text-[10px] font-bold cursor-pointer"
                                >
                                  Remove Photo
                                </button>
                              </div>
                            ) : (
                              <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all">
                                <Upload className="w-5 h-5 text-indigo-500 mb-1" />
                                <span className="text-[11px] font-bold text-slate-700">Choose completed task photograph</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  required
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setCompletionPhoto(reader.result as string);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">
                              Completion Crew Notes
                            </label>
                            <textarea
                              rows={2.5}
                              required
                              placeholder="Describe materials used, final measurements, and safety checks completed..."
                              value={completionNotes}
                              onChange={(e) => setCompletionNotes(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={submittingCompletion || !completionPhoto}
                            className={`w-full py-2 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              !completionPhoto 
                                ? "bg-slate-300 cursor-not-allowed" 
                                : "bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                            }`}
                          >
                            {submittingCompletion ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting completion proof...
                              </>
                            ) : (
                              <>✓ Submit Completed Task</>
                            )}
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* OFFICER ACTIONS WORKFLOW (Independent Privileges) */}
                  {(currentUser?.role === "Municipality Officer" || currentUser?.role === "Administrator") && (
                    <div className="border border-slate-200 pt-4 space-y-3 bg-slate-50 p-4.5 rounded-xl">
                      <span className="font-bold text-xs uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-blue-600" /> Authorized Officer Panel
                      </span>

                      {/* Citizen Request Approvals (Admin/Officer only) */}
                      {(selectedIssue.editRequestPending || selectedIssue.deleteRequestPending) && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg space-y-2 text-xs">
                          <span className="font-bold text-amber-800 block uppercase tracking-wide text-[10px]">
                            ⚠️ Pending Citizen Modification Requests
                          </span>
                          
                          {selectedIssue.editRequestPending && (
                            <div className="bg-white p-2.5 rounded border border-amber-100 space-y-2">
                              <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                                Citizen <strong>{selectedIssue.reporterName}</strong> has requested authorization to <strong>Edit</strong> this approved report.
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleAdminApproveEditRequest}
                                  className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded cursor-pointer transition"
                                >
                                  Approve Edit
                                </button>
                                <button
                                  onClick={handleAdminRejectEditRequest}
                                  className="flex-1 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[11px] font-semibold rounded cursor-pointer transition"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          )}

                          {selectedIssue.deleteRequestPending && (
                            <div className="bg-white p-2.5 rounded border border-amber-100 space-y-2">
                              <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                                Citizen <strong>{selectedIssue.reporterName}</strong> has requested authorization to <strong>Delete</strong> this approved report.
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleAdminApproveDeleteRequest}
                                  className="flex-1 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded cursor-pointer transition"
                                >
                                  Approve Delete
                                </button>
                                <button
                                  onClick={handleAdminRejectDeleteRequest}
                                  className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded cursor-pointer transition"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Municipal Officer verification of completed task */}
                      {selectedIssue.status === "Completed by Assigned Department" && (
                        <div className="space-y-3 bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg">
                          <span className="block text-[10px] font-bold text-indigo-700 uppercase">
                            📸 Completion Proof Uploaded by Department Crew
                          </span>
                          {selectedIssue.completedImageUrl ? (
                            <div className="rounded-lg overflow-hidden border border-indigo-200 aspect-video max-h-48 bg-slate-100">
                              <img 
                                src={selectedIssue.completedImageUrl} 
                                alt="Completion Evidence" 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer" 
                              />
                            </div>
                          ) : (
                            <div className="text-slate-400 text-xs italic">No photograph provided</div>
                          )}
                          {selectedIssue.completedNotes && (
                            <p className="text-xs text-slate-600 bg-white p-2.5 rounded border border-slate-200">
                              <strong className="text-slate-700 font-bold block mb-0.5">Crew Notes:</strong>
                              {selectedIssue.completedNotes}
                            </p>
                          )}
                          <button
                            onClick={() => handleStatusChange("Resolved", "Municipal Officer validated completed task photo and authorized resolution state.")}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                          >
                            ✓ Verify completed photo & mark as Resolved
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {selectedIssue.status === "Pending Verification" && (
                          <button
                            onClick={() => handleStatusChange("Verified", "Municipal Officer validated report and authorized dispatch workflow.")}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                          >
                            ✓ Approve & Verify Incident
                          </button>
                        )}

                        {selectedIssue.status === "Verified" && currentUser?.role === "Municipality Officer" && (
                          <button
                            onClick={() => handleStatusChange("In Progress", "Assigned officer. Repair crews dispatched with inventory.")}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                          >
                            ⚙ Dispatch Crews (In Progress)
                          </button>
                        )}

                        {selectedIssue.status === "Verified" && currentUser?.role === "Administrator" && (
                          <div className="text-xs text-slate-500 bg-slate-100/80 border border-slate-200 p-3 rounded-lg flex items-center gap-1.5 italic font-medium w-full">
                            <span>ℹ️ Only Municipality Officers are authorized to dispatch repair crews.</span>
                          </div>
                        )}

                        {/* Generates Gemini Smart checklist if missing */}
                        {(!selectedIssue.resolutionSteps || selectedIssue.resolutionSteps.length === 0) && (
                          <button
                            onClick={handleGenerateResolutionSteps}
                            disabled={loadingResolutionSteps}
                            className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-blue-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            {loadingResolutionSteps ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching AI Resolution steps...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" /> Suggest AI repair checklist
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Resolution actions with Notes inputs */}
                      {selectedIssue.status === "In Progress" && (
                        <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs space-y-1">
                          <span className="flex items-center gap-1.5 font-bold">
                            ⏳ Awaiting Department Repair & Proof Submission
                          </span>
                          <p className="text-[11px] text-slate-600 font-normal leading-normal">
                            The assigned department must complete the repair tasks, upload the completed photograph as evidence, and submit their notes before this case can be verified and marked as Resolved.
                          </p>
                        </div>
                      )}

                      {/* Department Routing Section */}
                      {currentUser?.role === "Municipality Officer" && selectedIssue.status !== "Resolved" && selectedIssue.status !== "Closed" && (
                        <div className="border-t border-slate-200/60 pt-3 mt-2 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                              🏢 Route Problem to Department
                            </label>
                            
                            {/* Ask AI Router Trigger */}
                            {!(selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion) && (
                              <button
                                type="button"
                                onClick={handleFetchDeptSuggestion}
                                disabled={loadingDeptSuggestion}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition"
                              >
                                {loadingDeptSuggestion ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" /> Analyzing routing...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3 text-indigo-500 fill-indigo-200" /> Get AI Suggestion
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* AI Suggestion Box */}
                          {(selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion) && (
                            <div className="bg-gradient-to-r from-indigo-50 to-blue-50/50 border border-indigo-100 rounded-xl p-3 text-xs space-y-1.5 shadow-xs">
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-[10px] uppercase text-indigo-800 tracking-wider flex items-center gap-1 flex-wrap">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-200 animate-pulse" /> AI Smart Routing Recommendation
                                </span>
                                <button
                                  type="button"
                                  onClick={handleFetchDeptSuggestion}
                                  disabled={loadingDeptSuggestion}
                                  className="text-[9px] font-semibold text-indigo-600 hover:underline cursor-pointer disabled:opacity-50"
                                >
                                  {loadingDeptSuggestion ? "Updating..." : "Recalculate"}
                                </button>
                              </div>
                              <div>
                                <p className="text-slate-700 font-semibold text-xs">
                                  Suggested: <span className="text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/60 text-[11px] inline-block">{selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment}</span>
                                </p>
                                <p className="text-[11px] text-slate-500 italic mt-1 leading-relaxed">
                                  "{(selectedIssue.aiAnalysis?.suggestedDepartmentReason || onDemandDeptSuggestion?.suggestedDepartmentReason)}"
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  const targetDept = selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment;
                                  if (targetDept) {
                                    await handleRouteDepartment(targetDept);
                                  }
                                }}
                                disabled={selectedIssue.assignedDepartment === (selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment)}
                                className={`w-full py-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                                  selectedIssue.assignedDepartment === (selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment)
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow-sm cursor-pointer"
                                }`}
                              >
                                {selectedIssue.assignedDepartment === (selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment) ? (
                                  <>✓ Applied Recommendation</>
                                ) : (
                                  <>Assign to {selectedIssue.aiAnalysis?.suggestedDepartment || onDemandDeptSuggestion?.suggestedDepartment}</>
                                )}
                              </button>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <select
                              value={selectedIssue.assignedDepartment || ""}
                              onChange={async (e) => {
                                await handleRouteDepartment(e.target.value);
                              }}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/30 animate-none"
                            >
                              <option value="" disabled>Select department to assign...</option>
                              {["Public Works", "Water & Sewage", "Sanitation Dept", "Electrical Grid"].map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {currentUser?.role === "Administrator" && selectedIssue.assignedDepartment && (
                        <div className="border-t border-slate-200 pt-3 text-xs text-slate-600 flex justify-between">
                          <span className="font-bold">Routed Department:</span>
                          <span className="bg-blue-50 text-blue-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                            {selectedIssue.assignedDepartment}
                          </span>
                        </div>
                      )}

                      {/* Reject, spam, and delete options */}
                      {currentUser?.role === "Municipality Officer" && (
                        <div className="flex gap-2 border-t border-slate-200 pt-3 mt-1">
                          {selectedIssue.status !== "Resolved" && selectedIssue.status !== "Closed" && (
                            <>
                              <button
                                onClick={() => handleStatusChange("Rejected", "Declined: Insufficient hazard criteria detected on site inspection.")}
                                className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                              >
                                Decline report
                              </button>
                              <button
                                onClick={() => handleStatusChange("Spam", "Identified as malicious false report. Reporter flag compiled.")}
                                className="flex-1 py-1.5 border border-red-200 hover:bg-red-50 text-red-500 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                              >
                                Spam flag
                              </button>
                            </>
                          )}
                          <button
                            onClick={handleDeleteIssue}
                            className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-[10px] font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" /> Delete Report
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audit Timeline panel */}
                  <div className="border-t border-slate-200 pt-4">
                    <span className="block font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">
                      Auditable Security Timeline Logs
                    </span>
                    {selectedIssueTimeline.length > 0 ? (
                      <div className="relative border-l border-slate-100 pl-4 space-y-3 pb-2 ml-1">
                        {selectedIssueTimeline.map((item, idx) => (
                          <div key={item.id} className="relative text-xs">
                            {/* Bullet dot */}
                            <span className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-100" />
                            <div className="flex justify-between text-[9px] text-slate-400 font-mono mb-0.5">
                              <span>{item.actorName} ({item.actorRole})</span>
                              <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <span className="inline-block text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 rounded mb-1">
                              {item.fromStatus} → {item.toStatus}
                            </span>
                            <p className="text-slate-500 leading-normal">{item.comment}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-slate-400 text-xs font-mono">
                        Loading timeline logs...
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            ) : (
              <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm flex flex-col items-center justify-center h-80">
                <MapPin className="w-10 h-10 text-slate-300 mb-3 animate-bounce" />
                <h4 className="font-semibold text-slate-600 mb-1">
                  No Incident Selected
                </h4>
                <p className="text-xs text-slate-400 max-w-xs leading-normal">
                  Click on an issue in the community feed or select a pin on the Interactive Map to load official files, Gemini AI assessments, and verification logs.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Humble Footer */}
      <footer className="mt-16 border-t border-slate-100 py-8 bg-white text-center text-xs text-slate-400 font-mono">
        <p className="font-semibold text-slate-500">
          Community Hero • Google AI Studio Starter Tier Optimized Civic Platform
        </p>
        <p className="mt-1 text-slate-400">
          Built with React 19, Vite, Express, Firestore & Gemini 2.5 models.
        </p>
      </footer>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[150]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-100 p-6 max-w-sm w-full mx-4 shadow-xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="bg-red-50 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  Delete Report?
                </h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Are you sure you want to delete this incident report? This action is permanent and cannot be undone.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteIssue}
                    className="flex-1 py-2 bg-red-600 border border-red-700 text-white text-xs font-semibold rounded-xl hover:bg-red-700 transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    Delete Report
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time Floating Push Toast Notifications Alert Panel */}
      <div className="fixed top-20 right-6 z-[100] flex flex-col gap-3 w-80 pointer-events-none">
        <AnimatePresence>
          {notifications.filter(n => !n.viewed).map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              className="pointer-events-auto bg-slate-900 text-white rounded-2xl border border-slate-800/80 p-4 shadow-2xl flex gap-3 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-indigo-600" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  {notif.type === "edit" ? (
                    <Edit className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    {notif.type === "edit" ? "Pending Edit Request" : "Pending Delete Request"}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white leading-snug mb-1 line-clamp-1">
                  {notif.issueTitle}
                </h4>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Citizen <strong className="text-slate-200">{notif.reporterName}</strong> requested authorization.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      const targetIssue = issues.find(i => i.id === notif.issueId);
                      if (targetIssue) {
                        setSelectedIssue(targetIssue);
                      }
                      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, viewed: true } : n));
                    }}
                    className="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition cursor-pointer shadow-sm"
                  >
                    Inspect & Act
                  </button>
                  <button
                    onClick={() => {
                      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, viewed: true } : n));
                    }}
                    className="py-1 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold rounded-lg transition cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, viewed: true } : n));
                }}
                className="text-slate-400 hover:text-white transition cursor-pointer h-fit p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
