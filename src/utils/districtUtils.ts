import { Issue } from "../types";

export interface District {
  id: string;
  name: string;
  polygon: [number, number][]; // lat, lng pairs
  center: [number, number];
}

export interface DistrictHealthReport {
  score: number;
  totalIssuesCount: number;
  openIssuesCount: number;
  resolvedIssuesCount: number;
  avgResolveTimeHours: number;
  atRisk: boolean;
  riskAlertSummary: string | null;
}

export const INDIA_DISTRICTS: District[] = [
  {
    id: "north",
    name: "North India (Delhi NCR & Northern States)",
    center: [28.61, 77.21],
    polygon: [
      [32.5, 72.0],
      [32.5, 80.0],
      [25.0, 80.0],
      [25.0, 72.0]
    ]
  },
  {
    id: "south",
    name: "South India (Bengaluru, Chennai, Hyderabad)",
    center: [12.97, 77.59],
    polygon: [
      [16.0, 72.0],
      [16.0, 81.0],
      [8.0, 81.0],
      [8.0, 72.0]
    ]
  },
  {
    id: "west",
    name: "West India (Mumbai, Pune, Gujarat)",
    center: [19.08, 72.88],
    polygon: [
      [24.0, 68.0],
      [24.0, 74.0],
      [16.0, 74.0],
      [16.0, 68.0]
    ]
  },
  {
    id: "central",
    name: "Central India (Madhya Pradesh & Chhattisgarh)",
    center: [22.97, 78.66],
    polygon: [
      [25.0, 74.0],
      [25.0, 82.0],
      [16.0, 82.0],
      [16.0, 74.0]
    ]
  },
  {
    id: "east",
    name: "East India (Kolkata, Bihar & Odisha)",
    center: [22.57, 88.36],
    polygon: [
      [27.0, 82.0],
      [27.0, 89.0],
      [19.0, 89.0],
      [19.0, 82.0]
    ]
  },
  {
    id: "northeast",
    name: "Northeast India (Seven Sister States)",
    center: [26.14, 91.74],
    polygon: [
      [29.0, 89.0],
      [29.0, 97.0],
      [21.0, 97.0],
      [21.0, 89.0]
    ]
  }
];

export function getActiveCityCenter(issues: Issue[]): [number, number] {
  const indiaIssues = issues.filter(i => i.latitude > 5 && i.latitude < 38 && i.longitude > 65 && i.longitude < 98);
  if (indiaIssues.length > 0) {
    const sumLat = indiaIssues.reduce((sum, i) => sum + i.latitude, 0);
    const sumLng = indiaIssues.reduce((sum, i) => sum + i.longitude, 0);
    return [sumLat / indiaIssues.length, sumLng / indiaIssues.length];
  }
  return [20.5937, 78.9629]; // default central India
}

function makeHexagon(id: string, name: string, cLat: number, cLng: number, radius: number): District {
  const polygon: [number, number][] = [];
  const aspectRatio = 1.35; // compensation for latitude projection on maps
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i; // flat-topped hex
    polygon.push([
      cLat + radius * Math.sin(angle),
      cLng + radius * aspectRatio * Math.cos(angle)
    ]);
  }
  return {
    id,
    name,
    center: [cLat, cLng],
    polygon
  };
}

export function getDistricts(center: [number, number]): District[] {
  const [lat, lng] = center;
  const radius = 0.015;
  const D = Math.sqrt(3) * radius; // center-to-center distance
  const A = 1.35; // Aspect ratio to look regular

  return [
    makeHexagon("central", "Central Ward (City Core)", lat, lng, radius),
    
    // North neighbor
    makeHexagon("north", "North Ward (Metro Heights)", lat + D, lng, radius),
    
    // South neighbor
    makeHexagon("south", "South Ward (Civic Plains)", lat - D, lng, radius),
    
    // North-East neighbor
    makeHexagon("northeast", "Northeast Ward (Tech Corridor)", lat + 0.5 * D, lng + 0.866 * D * A, radius),
    
    // North-West neighbor
    makeHexagon("northwest", "Northwest Ward (Scenic Ridge)", lat + 0.5 * D, lng - 0.866 * D * A, radius),
    
    // South-West neighbor
    makeHexagon("southwest", "Southwest Ward (Industrial Basin)", lat - 0.5 * D, lng - 0.866 * D * A, radius),
    
    // South-East neighbor
    makeHexagon("southeast", "Southeast Ward (Riverside District)", lat - 0.5 * D, lng + 0.866 * D * A, radius)
  ];
}

export const SF_DISTRICTS = getDistricts([20.5937, 78.9629]);

// Helper to check point in polygon (Ray-casting algorithm)
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance helper (squared distance is fine for comparison)
function getDistance(p1: [number, number], p2: [number, number]): number {
  return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
}

// Assign coordinates to a district
export function getDistrictForCoord(lat: number, lng: number, issues: Issue[] = [], districts?: District[]): District | null {
  const activeDistricts = districts || getDistricts(getActiveCityCenter(issues));
  
  // First, check if inside polygon
  for (const district of activeDistricts) {
    if (isPointInPolygon([lat, lng], district.polygon)) {
      return district;
    }
  }
  // Otherwise, find closest center
  let closestDist = Infinity;
  let closestDistrict: District | null = null;
  for (const district of activeDistricts) {
    const dist = getDistance([lat, lng], district.center);
    if (dist < closestDist) {
      closestDist = dist;
      closestDistrict = district;
    }
  }
  
  // If the closest center is more than 0.18 degrees (~20km) away,
  // it is outside the citizen's current city scope.
  if (closestDist > 0.18) {
    return null;
  }
  
  return closestDistrict;
}

// Calculates health report for a specific district based on the current issues list
export function calculateDistrictHealth(districtId: string, issues: Issue[], districts?: District[]): DistrictHealthReport {
  const activeDistricts = districts || getDistricts(getActiveCityCenter(issues));
  const districtIssues = issues.filter(i => {
    const d = getDistrictForCoord(i.latitude, i.longitude, issues, activeDistricts);
    return d !== null && d.id === districtId;
  });

  let unresolvedPenalty = 0;
  let openIssuesCount = 0;
  let resolvedIssuesCount = 0;
  let totalResolveTimeMs = 0;
  let criticalOrHighActiveCount = 0;
  
  // Risk assessment arrays for predictive warnings
  const hazardKeywords: string[] = [];
  const riskSummaries: string[] = [];

  districtIssues.forEach(issue => {
    const isResolved = ["Completed by Assigned Department", "Resolved", "Citizen Confirmation", "Closed"].includes(issue.status);
    const severity = issue.aiAnalysis?.severity || issue.severity || "Low";

    if (!isResolved) {
      openIssuesCount++;
      // Penalize based on severity of active issues
      if (severity === "Critical") {
        unresolvedPenalty += 25;
        criticalOrHighActiveCount++;
      } else if (severity === "High") {
        unresolvedPenalty += 15;
        criticalOrHighActiveCount++;
      } else if (severity === "Medium") {
        unresolvedPenalty += 8;
      } else {
        unresolvedPenalty += 3;
      }

      // Extract details for predictive risks from Gemini AI assessments
      const category = issue.category || issue.aiAnalysis?.category;
      if (category && !hazardKeywords.includes(category)) {
        hazardKeywords.push(category);
      }
      const riskText = issue.aiAnalysis?.riskAssessment || issue.description;
      if (riskText && riskSummaries.length < 2) {
        riskSummaries.push(riskText);
      }
    } else {
      resolvedIssuesCount++;
      const created = new Date(issue.createdAt).getTime();
      const updated = new Date(issue.updatedAt || issue.createdAt).getTime();
      if (updated > created) {
        totalResolveTimeMs += (updated - created);
      }
    }
  });

  // Base health score starts at 100
  let score = 100 - unresolvedPenalty;

  // Average resolve time modifier
  let avgResolveTimeHours = 0;
  if (resolvedIssuesCount > 0) {
    avgResolveTimeHours = totalResolveTimeMs / (1000 * 60 * 60 * resolvedIssuesCount);
    if (avgResolveTimeHours > 72) {
      score -= 10; // penalty for slow resolutions
    } else if (avgResolveTimeHours < 24) {
      score += 10; // bonus for rapid resolutions
    }
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Leverage Gemini AI assessments to identify "at-risk" areas:
  // Trigger warning if there are multiple High/Critical active issues, or specific severe structural risk trends
  const containsStructuralRisk = riskSummaries.some(text => 
    /structural|collapse|leak|wiring|power|electric|hazard|crack|fire/i.test(text)
  );

  // Green zone: score >= 60
  // Orange zone: 40 <= score < 60
  // Red zone: score < 40
  const isGreenZone = score >= 60;
  const isOrangeZone = score >= 40 && score < 60;

  // atRisk is false in green zone, true in orange/red zone
  const atRisk = !isGreenZone;
  
  let riskAlertSummary: string | null = null;
  if (isGreenZone) {
    riskAlertSummary = "stabel - The district zone is healthy and stable. No elevated risks or critical hazards are forecasted by AI.";
  } else if (isOrangeZone) {
    const risksList = hazardKeywords.slice(0, 2).join(" & ");
    const riskSample = riskSummaries[0] ? `"${riskSummaries[0].slice(0, 60)}..."` : "recurring localized reports";
    riskAlertSummary = `at risk - Elevated hazards detected in area (${risksList || "infrastructure"}). AI risk assessment highlights potential escalation: ${riskSample}`;
  } else {
    const risksList = hazardKeywords.slice(0, 2).join(" & ");
    riskAlertSummary = `at risk - Critical public safety threat indicators. Multiple unresolved reports (${risksList || "structural"}) require urgent attention.`;
  }

  return {
    score,
    totalIssuesCount: districtIssues.length,
    openIssuesCount,
    resolvedIssuesCount,
    avgResolveTimeHours,
    atRisk,
    riskAlertSummary
  };
}

// Calculate the citywide health index (weighted average across all districts)
export function calculateCitywideHealth(issues: Issue[], districts?: District[]): number {
  if (issues.length === 0) return 100;
  
  const activeDistricts = districts || getDistricts(getActiveCityCenter(issues));
  let sumScores = 0;
  activeDistricts.forEach(d => {
    const report = calculateDistrictHealth(d.id, issues, activeDistricts);
    sumScores += report.score;
  });

  return Math.round(sumScores / activeDistricts.length);
}

// Get appropriate color-code based on health score
export function getHealthColor(score: number): {
  hex: string;
  twBg: string;
  twText: string;
  twBorder: string;
  label: string;
} {
  if (score >= 80) {
    return {
      hex: "#10b981", // Emerald
      twBg: "bg-emerald-50",
      twText: "text-emerald-700",
      twBorder: "border-emerald-200",
      label: "stabel"
    };
  }
  if (score >= 60) {
    return {
      hex: "#10b981", // Light Green/Emerald
      twBg: "bg-emerald-50/70",
      twText: "text-emerald-600",
      twBorder: "border-emerald-150",
      label: "stabel"
    };
  }
  if (score >= 40) {
    return {
      hex: "#f59e0b", // Amber
      twBg: "bg-amber-50",
      twText: "text-amber-700",
      twBorder: "border-amber-200",
      label: "at risk"
    };
  }
  return {
    hex: "#ef4444", // Red
    twBg: "bg-rose-50",
    twText: "text-rose-700",
    twBorder: "border-rose-200",
    label: "at risk"
  };
}
