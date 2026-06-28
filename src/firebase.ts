import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where,
  orderBy,
  deleteDoc,
  onSnapshot,
  Firestore
} from "firebase/firestore";
import { 
  getAuth, 
  Auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { Issue, User, VerificationActivity, TimelineUpdate, UserRole, IssueStatus } from "./types";

let db: Firestore | null = null;
export let auth: Auth | null = null;
let isFirebaseInitialized = false;

// We will export a promise that resolves when Firebase is ready
export const firebaseReadyPromise = fetch("/api/config")
  .then(res => res.json())
  .then(data => {
    if (data.success && data.config) {
      const config = data.config;
      const firebaseConfig = {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
      };
      
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      db = getFirestore(app, config.firestoreDatabaseId);
      auth = getAuth(app);
      isFirebaseInitialized = true;
      console.log("Firebase client-side SDK successfully initialized.");
      return true;
    }
    throw new Error("Invalid config format");
  })
  .catch(err => {
    console.warn("Firebase failed to initialize dynamically. App running in robust Offline-Local mode.", err);
    return false;
  });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- LOCAL STORAGE STATE MANAGEMENT (FALLBACK & OFFLINE) ---
const LOCAL_ISSUES_KEY = "community_hero_issues";
const LOCAL_USERS_KEY = "community_hero_users";
const LOCAL_VERIFICATIONS_KEY = "community_hero_verifications";
const LOCAL_TIMELINE_KEY = "community_hero_timeline";

function getLocalData<T>(key: string, defaultVal: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocalData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error("Local storage save error", err);
  }
}

// Mock initial database seeding if offline or first load
export function seedMockData() {
  const issues = getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []);
  if (issues.length === 0) {
    const mockIssues: Issue[] = [
      {
        id: "issue-1",
        title: "Major Pothole on Pine Street Near School Crossing",
        description: "Large, deep pothole in the middle of the eastbound lane. Vehicles are swerving into oncoming traffic to avoid it, posing a critical safety hazard to students.",
        category: "Pothole",
        severity: "High",
        status: "In Progress",
        latitude: 37.7749,
        longitude: -122.4194,
        address: "415 Pine St, San Francisco, CA 94104",
        imageUrl: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop",
        reporterId: "user-1",
        reporterName: "Sarah Connor",
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        assignedTo: "Officer David Miller",
        assignedDepartment: "Public Works & Road Maintenance Office",
        upvotes: 42,
        downvotes: 1,
        evidenceCount: 3,
        aiConfidence: 0.96,
        aiAnalysis: {
          category: "Pothole",
          severity: "High",
          priorityScore: 82,
          confidenceScore: 0.96,
          riskAssessment: "Severe vehicle alignment damage and high risk of head-on collisions due to swerving.",
          duplicateKeywords: ["pothole", "pine", "school"],
          autoCategoryReason: "Image analysis matches structural road deterioration over 40cm wide near high foot-traffic zone."
        },
        resolutionSteps: [
          "Secure the perimeter with reflective cones.",
          "Clear loose asphalt and debris from the pothole.",
          "Apply hot mix asphalt binder compound.",
          "Compact repair site using heavy vibration roller.",
          "Conduct inspection and release for public traffic."
        ],
        materialsRequired: ["Hot mix asphalt", "Tack coat binder", "Vibratory plate compactor"],
        safetyPrecautions: ["Setup lane closure signage", "Wear Class 3 high-visibility safety jackets"],
        estimatedHours: 4
      },
      {
        id: "issue-2",
        title: "Burst Water Pipe / Flooding on Elm Avenue",
        description: "Substantial clean water gushing from under the sidewalk, flooding the pedestrian walkway and front lawns. Water pressure in surrounding homes has dropped.",
        category: "Water Leakage",
        severity: "Critical",
        status: "Verified",
        latitude: 37.7849,
        longitude: -122.4294,
        address: "1890 Elm Ave, San Francisco, CA 94115",
        imageUrl: "https://images.unsplash.com/photo-1542060748-10c28b629f6f?q=80&w=600&auto=format&fit=crop",
        reporterId: "user-2",
        reporterName: "James Carter",
        createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        upvotes: 68,
        downvotes: 0,
        evidenceCount: 1,
        aiConfidence: 0.98,
        aiAnalysis: {
          category: "Water Leakage",
          severity: "Critical",
          priorityScore: 95,
          confidenceScore: 0.98,
          riskAssessment: "Pedestrian slip hazard, extreme water wastage, potential sinkhole formation, and local property foundation damage.",
          duplicateKeywords: ["water", "burst", "pipe"],
          autoCategoryReason: "High-volume water flow verified adjacent to electric utilities poles."
        }
      },
      {
        id: "issue-3",
        title: "Illegal Dump of Electronics and Tires in Alleys",
        description: "Over 20 used tires and several broken televisions dumped in the rear residential alleyway. Blocking garage access and attracting rodents.",
        category: "Illegal Dumping",
        severity: "Medium",
        status: "Pending Verification",
        latitude: 37.7649,
        longitude: -122.4094,
        address: "712 Cypress Alley, San Francisco, CA 94103",
        imageUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?q=80&w=600&auto=format&fit=crop",
        reporterId: "user-3",
        reporterName: "Maria G.",
        createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
        upvotes: 14,
        downvotes: 2,
        evidenceCount: 0,
        aiConfidence: 0.91,
        aiAnalysis: {
          category: "Illegal Dumping",
          severity: "Medium",
          priorityScore: 55,
          confidenceScore: 0.91,
          riskAssessment: "Eco-toxicity of heavy metals, severe mosquito vector nesting inside tire volumes.",
          duplicateKeywords: ["tires", "dumping", "alley"],
          autoCategoryReason: "Visual grouping of synthetic polymer waste materials blocking active passage."
        }
      },
      {
        id: "issue-4",
        title: "Broken Streetlight Plunges Corner into Darkness",
        description: "The streetlamp at the intersection of 18th and Oak has been out for over a week. The street is extremely dark, creating safety anxieties for evening walkers.",
        category: "Broken Streetlight",
        severity: "Medium",
        status: "Submitted",
        latitude: 37.7549,
        longitude: -122.4394,
        address: "Corner of 18th St & Oak Ave, San Francisco, CA 94117",
        imageUrl: "https://images.unsplash.com/photo-1509024644558-2f56ce76c490?q=80&w=600&auto=format&fit=crop",
        reporterId: "user-4",
        reporterName: "Elena Rostova",
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        upvotes: 3,
        downvotes: 0,
        evidenceCount: 0,
        aiConfidence: 0.93,
        aiAnalysis: {
          category: "Broken Streetlight",
          severity: "Medium",
          priorityScore: 48,
          confidenceScore: 0.93,
          riskAssessment: "Poor visibility increases pedestrian injury risks and opportunities for opportunistic crimes.",
          duplicateKeywords: ["streetlight", "darkness", "corner"],
          autoCategoryReason: "Text matching indicates light post failure."
        }
      }
    ];
    setLocalData(LOCAL_ISSUES_KEY, mockIssues);
  }

  // Users seeding
  const users = getLocalData<User[]>(LOCAL_USERS_KEY, []);
  if (users.length === 0) {
    const mockUsers: User[] = [
      {
        uid: "user-1",
        name: "Sarah Connor",
        email: "sarah@hero.org",
        role: "Citizen",
        reputation: 340,
        xp: 1250,
        level: 4,
        badges: ["First Responder", "Community Pillar", "Eagle Eye"],
        createdAt: new Date().toISOString()
      },
      {
        uid: "user-officer",
        name: "Officer David Miller",
        email: "officer@communityhero.gov",
        role: "Municipality Officer",
        reputation: 980,
        xp: 4500,
        level: 8,
        badges: ["Civic Excellence", "Resolution Master", "Ward Guardian"],
        createdAt: new Date().toISOString()
      },
      {
        uid: "user-admin",
        name: "Admin Chief",
        email: "admin@communityhero.gov",
        role: "Administrator",
        reputation: 2500,
        xp: 12000,
        level: 15,
        badges: ["Platform Founder", "Omniscient Moderator"],
        createdAt: new Date().toISOString()
      }
    ];
    setLocalData(LOCAL_USERS_KEY, mockUsers);
  }
}

// Ensure mock database is seeded on load
seedMockData();


// --- FIREBASE & LOCAL STATE COMBINED API OPERATIONS ---

// Get all issues
export async function fetchIssues(): Promise<Issue[]> {
  await firebaseReadyPromise.catch(() => false);
  if (isFirebaseInitialized && db) {
    try {
      const snap = await getDocs(collection(db, "issues"));
      const issuesList: Issue[] = [];
      snap.forEach(docSnap => {
        issuesList.push({ id: docSnap.id, ...docSnap.data() } as Issue);
      });

      // If the database has zero issues, seed them directly into Firestore
      if (issuesList.length === 0) {
        console.log("Firestore 'issues' collection is empty. Seeding initial issues to live database...");
        const seedIssues: Omit<Issue, "id">[] = [
          {
            title: "Major Pothole on Pine Street Near School Crossing",
            description: "Large, deep pothole in the middle of the eastbound lane. Vehicles are swerving into oncoming traffic to avoid it, posing a critical safety hazard to students.",
            category: "Pothole",
            severity: "High",
            status: "In Progress",
            latitude: 37.7749,
            longitude: -122.4194,
            address: "415 Pine St, San Francisco, CA 94104",
            imageUrl: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop",
            reporterId: "user-1",
            reporterName: "Sarah Connor",
            createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
            assignedTo: "Officer David Miller",
            assignedDepartment: "Public Works & Road Maintenance Office",
            upvotes: 42,
            downvotes: 1,
            evidenceCount: 3,
            aiConfidence: 0.96,
            aiAnalysis: {
              category: "Pothole",
              severity: "High",
              priorityScore: 82,
              confidenceScore: 0.96,
              riskAssessment: "Severe vehicle alignment damage and high risk of head-on collisions due to swerving.",
              duplicateKeywords: ["pothole", "pine", "school"],
              autoCategoryReason: "Image analysis matches structural road deterioration over 40cm wide near high foot-traffic zone."
            },
            resolutionSteps: [
              "Secure the perimeter with reflective cones.",
              "Clear loose asphalt and debris from the pothole.",
              "Apply hot mix asphalt binder compound.",
              "Compact repair site using heavy vibration roller.",
              "Conduct inspection and release for public traffic."
            ],
            materialsRequired: ["Hot mix asphalt", "Tack coat binder", "Vibratory plate compactor"],
            safetyPrecautions: ["Setup lane closure signage", "Wear Class 3 high-visibility safety jackets"],
            estimatedHours: 4
          },
          {
            title: "Burst Water Pipe / Flooding on Elm Avenue",
            description: "Substantial clean water gushing from under the sidewalk, flooding the pedestrian walkway and front lawns. Water pressure in surrounding homes has dropped.",
            category: "Water Leakage",
            severity: "Critical",
            status: "Verified",
            latitude: 37.7849,
            longitude: -122.4294,
            address: "1890 Elm Ave, San Francisco, CA 94115",
            imageUrl: "https://images.unsplash.com/photo-1542060748-10c28b629f6f?q=80&w=600&auto=format&fit=crop",
            reporterId: "user-2",
            reporterName: "James Carter",
            createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
            upvotes: 68,
            downvotes: 0,
            evidenceCount: 1,
            aiConfidence: 0.98,
            aiAnalysis: {
              category: "Water Leakage",
              severity: "Critical",
              priorityScore: 95,
              confidenceScore: 0.98,
              riskAssessment: "Pedestrian slip hazard, extreme water wastage, potential sinkhole formation, and local property foundation damage.",
              duplicateKeywords: ["water", "burst", "pipe"],
              autoCategoryReason: "High-volume water flow verified adjacent to electric utilities poles."
            }
          },
          {
            title: "Illegal Dump of Electronics and Tires in Alleys",
            description: "Over 20 used tires and several broken televisions dumped in the rear residential alleyway. Blocking garage access and attracting rodents.",
            category: "Illegal Dumping",
            severity: "Medium",
            status: "Pending Verification",
            latitude: 37.7649,
            longitude: -122.4094,
            address: "712 Cypress Alley, San Francisco, CA 94103",
            imageUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?q=80&w=600&auto=format&fit=crop",
            reporterId: "user-3",
            reporterName: "Maria G.",
            createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
            upvotes: 14,
            downvotes: 2,
            evidenceCount: 0,
            aiConfidence: 0.91,
            aiAnalysis: {
              category: "Illegal Dumping",
              severity: "Medium",
              priorityScore: 55,
              confidenceScore: 0.91,
              riskAssessment: "Eco-toxicity of heavy metals, severe mosquito vector nesting inside tire volumes.",
              duplicateKeywords: ["tires", "dumping", "alley"],
              autoCategoryReason: "Visual grouping of synthetic polymer waste materials blocking active passage."
            }
          },
          {
            title: "Broken Streetlight Plunges Corner into Darkness",
            description: "The streetlamp at the intersection of 18th and Oak has been out for over a week. The street is extremely dark, creating safety anxieties for evening walkers.",
            category: "Broken Streetlight",
            severity: "Medium",
            status: "Submitted",
            latitude: 37.7549,
            longitude: -122.4394,
            address: "Corner of 18th St & Oak Ave, San Francisco, CA 94117",
            imageUrl: "https://images.unsplash.com/photo-1509024644558-2f56ce76c490?q=80&w=600&auto=format&fit=crop",
            reporterId: "user-4",
            reporterName: "Elena Rostova",
            createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
            upvotes: 3,
            downvotes: 0,
            evidenceCount: 0,
            aiConfidence: 0.93,
            aiAnalysis: {
              category: "Broken Streetlight",
              severity: "Medium",
              priorityScore: 48,
              confidenceScore: 0.93,
              riskAssessment: "Poor visibility increases pedestrian injury risks and opportunities for opportunistic crimes.",
              duplicateKeywords: ["streetlight", "darkness", "corner"],
              autoCategoryReason: "Text matching indicates light post failure."
            }
          }
        ];

        for (const item of seedIssues) {
          try {
            const docRef = await addDoc(collection(db, "issues"), item);
            issuesList.push({ id: docRef.id, ...item } as Issue);
          } catch (seedErr) {
            console.error("Failed to seed single issue to Firestore", seedErr);
          }
        }
      }

      // Synchronize back to local storage for offline use
      setLocalData(LOCAL_ISSUES_KEY, issuesList);
      return issuesList;
    } catch (err) {
      console.error("Firebase fetchIssues failed, using local fallback", err);
      return getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []);
    }
  }
  return getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []);
}

// Subscribe to live issues
export function subscribeToIssues(callback: (issues: Issue[]) => void): () => void {
  let unsub: (() => void) | null = null;
  let active = true;

  firebaseReadyPromise.then(() => {
    if (!active) return;
    if (isFirebaseInitialized && db) {
      try {
        unsub = onSnapshot(collection(db, "issues"), (snap) => {
          const issuesList: Issue[] = [];
          snap.forEach(docSnap => {
            issuesList.push({ id: docSnap.id, ...docSnap.data() } as Issue);
          });
          callback(issuesList);
        }, (err) => {
          console.error("onSnapshot error:", err);
          callback(getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []));
        });
      } catch (err) {
        console.error("Failed to setup onSnapshot:", err);
        callback(getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []));
      }
    } else {
      callback(getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []));
    }
  });

  return () => {
    active = false;
    if (unsub) {
      unsub();
    }
  };
}

// Add a new issue
export async function createIssue(issue: Omit<Issue, "id">): Promise<Issue> {
  await firebaseReadyPromise.catch(() => false);
  const newId = `issue-${Math.random().toString(36).substr(2, 9)}`;
  const createdIssue: Issue = { ...issue, id: newId };

  if (isFirebaseInitialized && db) {
    try {
      const docRef = await addDoc(collection(db, "issues"), issue);
      const savedIssue = { ...issue, id: docRef.id };
      
      // Update local storage in parallel
      const localIssues = getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []);
      localIssues.unshift(savedIssue);
      setLocalData(LOCAL_ISSUES_KEY, localIssues);
      
      return savedIssue;
    } catch (err) {
      console.error("Firebase createIssue error, fallback to local storage", err);
      handleFirestoreError(err, OperationType.CREATE, "issues");
    }
  }

  // Local storage save
  const localIssues = getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []);
  localIssues.unshift(createdIssue);
  setLocalData(LOCAL_ISSUES_KEY, localIssues);
  return createdIssue;
}

// Update an issue
export async function updateIssue(issueId: string, updates: Partial<Issue>): Promise<boolean> {
  await firebaseReadyPromise.catch(() => false);
  let success = false;

  if (isFirebaseInitialized && db) {
    try {
      const docRef = doc(db, "issues", issueId);
      await updateDoc(docRef, updates as any);
      success = true;
    } catch (err) {
      console.error("Firebase updateIssue error", err);
      handleFirestoreError(err, OperationType.UPDATE, `issues/${issueId}`);
    }
  }

  // Always sync to local storage
  const localIssues = getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []);
  const index = localIssues.findIndex(i => i.id === issueId);
  if (index !== -1) {
    localIssues[index] = { ...localIssues[index], ...updates, updatedAt: new Date().toISOString() };
    setLocalData(LOCAL_ISSUES_KEY, localIssues);
    success = true;
  }
  return success;
}

// Delete an issue
export async function deleteIssue(issueId: string): Promise<boolean> {
  await firebaseReadyPromise.catch(() => false);
  let success = false;

  if (isFirebaseInitialized && db) {
    try {
      const docRef = doc(db, "issues", issueId);
      await deleteDoc(docRef);
      success = true;
    } catch (err) {
      console.error("Firebase deleteIssue error", err);
      handleFirestoreError(err, OperationType.DELETE, `issues/${issueId}`);
    }
  }

  // Always sync to local storage
  const localIssues = getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []);
  const filtered = localIssues.filter(i => i.id !== issueId);
  setLocalData(LOCAL_ISSUES_KEY, filtered);
  return true;
}

// Upvote / Downvote
export async function voteIssue(issueId: string, type: "upvote" | "downvote", userId: string, userName: string): Promise<boolean> {
  const localIssues = getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []);
  const index = localIssues.findIndex(i => i.id === issueId);
  if (index === -1) return false;

  const field = type === "upvote" ? "upvotes" : "downvotes";
  const currentCount = localIssues[index][field] || 0;
  const updatedValue = currentCount + 1;

  // Add activities
  const newActivity: VerificationActivity = {
    id: `act-${Math.random().toString(36).substr(2, 9)}`,
    issueId,
    userId,
    userName,
    userRole: "Citizen",
    type,
    comment: `${userName} registered a ${type} for this report.`,
    createdAt: new Date().toISOString()
  };

  const activities = getLocalData<VerificationActivity[]>(LOCAL_VERIFICATIONS_KEY, []);
  activities.unshift(newActivity);
  setLocalData(LOCAL_VERIFICATIONS_KEY, activities);

  return updateIssue(issueId, { [field]: updatedValue });
}

// Fetch verifications / activities for an issue
export async function fetchVerifications(issueId: string): Promise<VerificationActivity[]> {
  const activities = getLocalData<VerificationActivity[]>(LOCAL_VERIFICATIONS_KEY, []);
  return activities.filter(a => a.issueId === issueId);
}

// Submit a custom verification evidence (verification radius check + upvote/downvote + comments)
export async function addVerificationEvidence(
  issueId: string, 
  userId: string, 
  userName: string, 
  userRole: UserRole, 
  comment: string, 
  imageUrl?: string
): Promise<VerificationActivity> {
  const newActivity: VerificationActivity = {
    id: `act-${Math.random().toString(36).substr(2, 9)}`,
    issueId,
    userId,
    userName,
    userRole,
    type: "evidence",
    comment,
    imageUrl,
    createdAt: new Date().toISOString()
  };

  const activities = getLocalData<VerificationActivity[]>(LOCAL_VERIFICATIONS_KEY, []);
  activities.unshift(newActivity);
  setLocalData(LOCAL_VERIFICATIONS_KEY, activities);

  // Update counts on issue
  const localIssues = getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []);
  const idx = localIssues.findIndex(i => i.id === issueId);
  if (idx !== -1) {
    const evidenceCount = (localIssues[idx].evidenceCount || 0) + 1;
    // Auto-verify if evidence count reaches critical consensus threshold
    let status = localIssues[idx].status;
    let consensus = localIssues[idx].verificationConsensus || "none";
    if (evidenceCount >= 2 && status === "Pending Verification") {
      status = "Verified";
      consensus = "verified";
    }
    await updateIssue(issueId, { evidenceCount, status, verificationConsensus: consensus });
  }

  return newActivity;
}

// Fetch audit/timeline logs for an issue
export async function fetchTimeline(issueId: string): Promise<TimelineUpdate[]> {
  const timeline = getLocalData<TimelineUpdate[]>(LOCAL_TIMELINE_KEY, []);
  const filtered = timeline.filter(t => t.issueId === issueId);
  
  // Seed basic initial timeline if none exists
  if (filtered.length === 0) {
    const issues = getLocalData<Issue[]>(LOCAL_ISSUES_KEY, []);
    const issue = issues.find(i => i.id === issueId);
    if (issue) {
      const initial: TimelineUpdate[] = [
        {
          id: `t-${Math.random().toString(36).substr(2, 9)}`,
          issueId,
          actorId: issue.reporterId,
          actorName: issue.reporterName,
          actorRole: "Citizen",
          fromStatus: "Submitted",
          toStatus: "Submitted",
          comment: "Issue report generated with geolocated photo attachment.",
          createdAt: issue.createdAt
        }
      ];
      if (issue.status !== "Submitted") {
        initial.push({
          id: `t-${Math.random().toString(36).substr(2, 9)}`,
          issueId,
          actorId: "system-ai",
          actorName: "AI Architect",
          actorRole: "Administrator",
          fromStatus: "Submitted",
          toStatus: "AI Processing",
          comment: `AI Model classified category as "${issue.category}" and set safety priority score.`,
          createdAt: new Date(new Date(issue.createdAt).getTime() + 1000).toISOString()
        });
        
        if (issue.status !== "AI Processing" && issue.status !== "Pending Verification") {
          initial.push({
            id: `t-${Math.random().toString(36).substr(2, 9)}`,
            issueId,
            actorId: "user-officer",
            actorName: "Officer David Miller",
            actorRole: "Municipality Officer",
            fromStatus: "Pending Verification",
            toStatus: "Verified",
            comment: "Verified after spatial density matching and community upvote verification.",
            createdAt: new Date(new Date(issue.createdAt).getTime() + 60000).toISOString()
          });
        }
      }
      return initial;
    }
  }
  return filtered;
}

// Log status transitions for tracking audits
export async function logTimelineUpdate(
  issueId: string,
  actorId: string,
  actorName: string,
  actorRole: UserRole,
  fromStatus: IssueStatus,
  toStatus: IssueStatus,
  comment: string
): Promise<TimelineUpdate> {
  const newTimeline: TimelineUpdate = {
    id: `timeline-${Math.random().toString(36).substr(2, 9)}`,
    issueId,
    actorId,
    actorName,
    actorRole,
    fromStatus,
    toStatus,
    comment,
    createdAt: new Date().toISOString()
  };

  const timelineList = getLocalData<TimelineUpdate[]>(LOCAL_TIMELINE_KEY, []);
  timelineList.unshift(newTimeline);
  setLocalData(LOCAL_TIMELINE_KEY, timelineList);
  return newTimeline;
}

// Fetch user profiling & gamification
export function getUserProfile(userId: string): User {
  const users = getLocalData<User[]>(LOCAL_USERS_KEY, []);
  const found = users.find(u => u.uid === userId);
  if (found) return found;

  const newMockUser: User = {
    uid: userId,
    name: "New Hero",
    email: `${userId}@hero.org`,
    role: "Citizen",
    reputation: 10,
    xp: 10,
    level: 1,
    badges: ["First Step"],
    createdAt: new Date().toISOString()
  };
  users.push(newMockUser);
  setLocalData(LOCAL_USERS_KEY, users);
  return newMockUser;
}

// Award user gamification points for active verification / resolution confirmation
export function awardUserXP(userId: string, xpReward: number, repReward: number, badgeAwarded?: string): User {
  const users = getLocalData<User[]>(LOCAL_USERS_KEY, []);
  const idx = users.findIndex(u => u.uid === userId);
  if (idx !== -1) {
    let currentXp = users[idx].xp + xpReward;
    let currentRep = users[idx].reputation + repReward;
    let currentLevel = Math.floor(Math.sqrt(currentXp / 100)) + 1; // standard level-up algorithm
    
    const badges = [...users[idx].badges];
    if (badgeAwarded && !badges.includes(badgeAwarded)) {
      badges.push(badgeAwarded);
    }
    
    // Automatically award landmark badges based on level/rep
    if (currentLevel >= 3 && !badges.includes("Active Guardian")) {
      badges.push("Active Guardian");
    }
    if (currentRep >= 500 && !badges.includes("Civic Legend")) {
      badges.push("Civic Legend");
    }

    users[idx] = {
      ...users[idx],
      xp: currentXp,
      reputation: currentRep,
      level: currentLevel,
      badges
    };
    setLocalData(LOCAL_USERS_KEY, users);
    return users[idx];
  }
  return getUserProfile(userId);
}

export function getRoleFromEmail(email: string): UserRole {
  const lowEmail = email.toLowerCase();
  if (lowEmail === "admin@communityhero.gov") {
    return "Administrator";
  }
  if (lowEmail === "officer@communityhero.gov" || lowEmail === "david@gov.org") {
    return "Municipality Officer";
  }
  if (lowEmail === "publicworks@communityhero.gov") {
    return "Public Works Officer";
  }
  if (lowEmail === "watersewage@communityhero.gov") {
    return "Water & Sewage Officer";
  }
  if (lowEmail === "sanitation@communityhero.gov") {
    return "Sanitation Officer";
  }
  if (lowEmail === "electrical@communityhero.gov") {
    return "Electrical Officer";
  }
  return "Citizen";
}

export function getDepartmentFromEmail(email: string): string | undefined {
  const lowEmail = email.toLowerCase();
  if (lowEmail === "publicworks@communityhero.gov") {
    return "Public Works";
  }
  if (lowEmail === "watersewage@communityhero.gov") {
    return "Water & Sewage";
  }
  if (lowEmail === "sanitation@communityhero.gov") {
    return "Sanitation Dept";
  }
  if (lowEmail === "electrical@communityhero.gov") {
    return "Electrical Grid";
  }
  return undefined;
}

// Helper to dynamically load a user profile from Firestore by UID or by Email
export async function getFirestoreUserProfile(uid: string, email: string): Promise<User | null> {
  if (!isFirebaseInitialized || !db) return null;
  try {
    // 1. Try fetching by document ID (UID)
    const docRef = doc(db, "users", uid);
    const userSnap = await getDoc(docRef);
    if (userSnap.exists()) {
      return userSnap.data() as User;
    }

    // 2. Try querying by email (useful if pre-seeded with custom document IDs)
    if (email) {
      const q = query(collection(db, "users"), where("email", "==", email.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docData = snap.docs[0].data();
        const profile: User = {
          ...docData,
          uid: uid // normalize UID to match Auth user
        } as User;
        
        // Write it under the new UID so future loads by UID are extremely fast
        await setDoc(doc(db, "users", uid), profile);
        return profile;
      }
    }
  } catch (err) {
    console.warn("Failed to retrieve user profile from Firestore:", err);
  }
  return null;
}

// Create or update user profile details and sync with Firestore if active
export function saveUserProfileFromAuth(userId: string, name: string, email: string): User {
  const users = getLocalData<User[]>(LOCAL_USERS_KEY, []);
  const found = users.find(u => u.uid === userId);
  let updated: User;

  const role: UserRole = getRoleFromEmail(email);
  const department = getDepartmentFromEmail(email);

  if (found) {
    // Dynamically update the role if they should be administrator/officer
    const finalRole = (found.role === "Citizen" && role !== "Citizen") ? role : found.role;
    updated = { ...found, name, email, role: finalRole, department: department || found.department || null };
    const idx = users.findIndex(u => u.uid === userId);
    users[idx] = updated;
  } else {
    const isDeptOfficer = [
      "Public Works Officer",
      "Water & Sewage Officer",
      "Sanitation Officer",
      "Electrical Officer"
    ].includes(role);

    updated = {
      uid: userId,
      name: name || "New Hero",
      email: email || `${userId}@hero.org`,
      role: role,
      reputation: role === "Administrator" ? 2500 : role === "Municipality Officer" ? 980 : isDeptOfficer ? 800 : 10,
      xp: role === "Administrator" ? 12000 : role === "Municipality Officer" ? 4500 : isDeptOfficer ? 3500 : 10,
      level: role === "Administrator" ? 15 : role === "Municipality Officer" ? 8 : isDeptOfficer ? 6 : 1,
      badges: role === "Administrator" 
        ? ["Platform Founder", "Omniscient Moderator"] 
        : role === "Municipality Officer" 
        ? ["Civic Excellence", "Resolution Master", "Ward Guardian"] 
        : isDeptOfficer
        ? ["Department Expert", "Civic Crew Leader"]
        : ["First Step"],
      createdAt: new Date().toISOString(),
      department: department || null
    };
    users.push(updated);
  }
  setLocalData(LOCAL_USERS_KEY, users);

  // Sync to Firebase if initialized
  if (isFirebaseInitialized && db) {
    const docRef = doc(db, "users", userId);
    setDoc(docRef, updated).catch(err => {
      console.error("Failed to sync user profile to Firestore", err);
    });
  }

  return updated;
}

// Active listener for auth state change callbacks (important for mock/offline synchrony)
let registeredCallback: ((user: User | null) => void) | null = null;

// Listen for dynamic Firebase Authentication state changes or load mock user session
export function onAuthChanged(callback: (user: User | null) => void) {
  registeredCallback = callback;
  firebaseReadyPromise.then(() => {
    if (isFirebaseInitialized && auth) {
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          // Dynamic lookup: fetch from Firestore first to retrieve role/badges/xp dynamically
          const profile = await getFirestoreUserProfile(
            firebaseUser.uid,
            firebaseUser.email || ""
          );

          if (profile) {
            // Save to local storage for offline continuity
            const users = getLocalData<User[]>(LOCAL_USERS_KEY, []);
            const idx = users.findIndex(u => u.uid === firebaseUser.uid);
            if (idx !== -1) {
              users[idx] = profile;
            } else {
              users.push(profile);
            }
            setLocalData(LOCAL_USERS_KEY, users);
            callback(profile);
            return;
          }

          // Fallback if no Firestore profile doc exists yet
          const fallbackProfile = saveUserProfileFromAuth(
            firebaseUser.uid,
            firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Hero User",
            firebaseUser.email || ""
          );
          callback(fallbackProfile);
        } else {
          // Check if we have a locally active mock user session
          const cached = localStorage.getItem("current_mock_user");
          if (cached) {
            try {
              callback(JSON.parse(cached));
            } catch {
              callback(null);
            }
          } else {
            callback(null);
          }
        }
      });
    } else {
      // In offline/mock mode, check if there is a logged in mock user in localStorage
      const cached = localStorage.getItem("current_mock_user");
      if (cached) {
        try {
          callback(JSON.parse(cached));
        } catch {
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  });
}

// Log in via Google Sign-In with full popup capabilities
export async function signInWithGoogle(): Promise<User> {
  await firebaseReadyPromise;
  if (isFirebaseInitialized && auth) {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const profile = saveUserProfileFromAuth(
        user.uid,
        user.displayName || user.email?.split("@")[0] || "Hero User",
        user.email || ""
      );
      return profile;
    } catch (err: any) {
      if (err.code === "auth/operation-not-allowed" || err.code === "auth/auth-domain-config-required") {
        console.warn("Google Auth disabled or unconfigured in Firebase Console. Falling back to local offline Google user.");
        const mockUid = "user-google-mock";
        const profile = saveUserProfileFromAuth(mockUid, "Mock Google User", "mockuser@gmail.com");
        localStorage.setItem("current_mock_user", JSON.stringify(profile));
        if (registeredCallback) registeredCallback(profile);
        return profile;
      }
      throw err;
    }
  } else {
    // Create/load a mock Google user
    const mockUid = "user-google-mock";
    const profile = saveUserProfileFromAuth(mockUid, "Mock Google User", "mockuser@gmail.com");
    localStorage.setItem("current_mock_user", JSON.stringify(profile));
    if (registeredCallback) registeredCallback(profile);
    return profile;
  }
}

// Register a new user with email and password
export async function signUpWithEmail(email: string, password: string, name: string): Promise<User> {
  await firebaseReadyPromise;
  if (isFirebaseInitialized && auth) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;
      await updateProfile(user, { displayName: name });
      const profile = saveUserProfileFromAuth(user.uid, name, email);
      return profile;
    } catch (err: any) {
      if (err.code === "auth/operation-not-allowed") {
        console.warn("Email/Password Auth is disabled in Firebase Console. Falling back to local offline auth mode.");
        const mockUid = "user-mock-" + Math.random().toString(36).substr(2, 9);
        const profile = saveUserProfileFromAuth(mockUid, name, email);
        localStorage.setItem("current_mock_user", JSON.stringify(profile));
        if (registeredCallback) registeredCallback(profile);
        return profile;
      }
      throw err;
    }
  } else {
    const mockUid = "user-mock-" + Math.random().toString(36).substr(2, 9);
    const profile = saveUserProfileFromAuth(mockUid, name, email);
    localStorage.setItem("current_mock_user", JSON.stringify(profile));
    if (registeredCallback) registeredCallback(profile);
    return profile;
  }
}

// Sign in with email and password
export async function signInWithEmail(email: string, password: string): Promise<User> {
  await firebaseReadyPromise;
  if (isFirebaseInitialized && auth) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Try loading existing profile from Firestore (by UID or Email) to avoid hardcoded credentials or roles!
      let profile = await getFirestoreUserProfile(user.uid, email);
      if (!profile) {
        profile = saveUserProfileFromAuth(
          user.uid, 
          user.displayName || email.split("@")[0], 
          email
        );
      }
      
      if (registeredCallback) registeredCallback(profile);
      return profile;
    } catch (err: any) {
      const preconfiguredAccounts = [
        { email: "admin@communityhero.gov", password: "AdminPassword123", name: "Admin Chief" },
        { email: "officer@communityhero.gov", password: "OfficerPassword123", name: "Officer David Miller" },
        { email: "publicworks@communityhero.gov", password: "WorksPassword123", name: "Public Works Chief" },
        { email: "watersewage@communityhero.gov", password: "WaterPassword123", name: "Water & Sewage Chief" },
        { email: "sanitation@communityhero.gov", password: "SanitationPassword123", name: "Sanitation Chief" },
        { email: "electrical@communityhero.gov", password: "ElectricalPassword123", name: "Electrical Chief" }
      ];

      if (err.code === "auth/operation-not-allowed") {
        console.warn("Email/Password Auth is disabled in Firebase Console. Falling back to local offline verification.");
        // Try to verify locally
        const users = getLocalData<User[]>(LOCAL_USERS_KEY, []);
        const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (found) {
          localStorage.setItem("current_mock_user", JSON.stringify(found));
          if (registeredCallback) registeredCallback(found);
          return found;
        }
        
        const foundPreConfig = preconfiguredAccounts.find(acc => acc.email.toLowerCase() === email.toLowerCase());
        if (foundPreConfig) {
          const mockUid = "user-" + foundPreConfig.email.split("@")[0];
          const profile = saveUserProfileFromAuth(mockUid, foundPreConfig.name, email);
          localStorage.setItem("current_mock_user", JSON.stringify(profile));
          if (registeredCallback) registeredCallback(profile);
          return profile;
        }
        throw new Error("Local offline profile not found for this email. Please sign up first.");
      }

      const matchedAccount = preconfiguredAccounts.find(
        acc => acc.email.toLowerCase() === email.toLowerCase() && password === acc.password
      );

      if (matchedAccount && 
          (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-login-credentials")) {
        console.log("Pre-configured secure account not found in live Auth. Auto-provisioning...", email);
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        await updateProfile(user, { displayName: matchedAccount.name });
        const profile = saveUserProfileFromAuth(user.uid, matchedAccount.name, email);
        return profile;
      }
      throw err;
    }
  } else {
    // Check if user exists in local storage
    const users = getLocalData<User[]>(LOCAL_USERS_KEY, []);
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (found) {
      localStorage.setItem("current_mock_user", JSON.stringify(found));
      if (registeredCallback) registeredCallback(found);
      return found;
    }
    // Otherwise create one
    const mockUid = "user-mock-" + Math.random().toString(36).substr(2, 9);
    const name = email.split("@")[0];
    const profile = saveUserProfileFromAuth(mockUid, name.charAt(0).toUpperCase() + name.slice(1), email);
    localStorage.setItem("current_mock_user", JSON.stringify(profile));
    if (registeredCallback) registeredCallback(profile);
    return profile;
  }
}

// Sign out current authenticated or mock user session
export async function logoutUser(): Promise<void> {
  await firebaseReadyPromise;
  localStorage.removeItem("current_mock_user");
  if (isFirebaseInitialized && auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Sign out failed", err);
    }
  }
  // Guarantee state change callback triggers
  if (registeredCallback) {
    registeredCallback(null);
  }
}
