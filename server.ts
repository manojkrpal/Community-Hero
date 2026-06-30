import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Helper for lazy loading Gemini SDK
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY environment variable is missing or using placeholder value.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// Utility to generate content with automatic retry on transient failures (e.g., 503 high demand)
async function generateContentWithRetry(ai: GoogleGenAI, params: any, maxRetries = 2): Promise<any> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries) {
        throw error;
      }
      console.warn(`Gemini API warning (Attempt ${attempt} of ${maxRetries + 1}):`, error.message || error);
      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

// 1. API Config: Serves Firebase config to client dynamically from firebase-applet-config.json
app.get("/api/config", (req, res) => {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      res.json({ success: true, config: configData });
    } else {
      res.status(404).json({ success: false, error: "Firebase applet config file not found" });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. AI Issue Analysis endpoint
app.post("/api/analyze-issue", async (req: any, res: any) => {
  const { title, description, imageBase64 } = req.body;

  if (!title || !description) {
    return res.status(400).json({ success: false, error: "Title and description are required" });
  }

  try {
    const ai = getGeminiClient();

    let prompt = `
You are the AI Civil Architect for the "Community Hero" platform.
Analyze the following civic issue submitted by a citizen and output a structured JSON response.

Issue Title: "${title}"
Issue Description: "${description}"

Based on this issue, predict the following fields:
1. "category": Must be one of: "Pothole", "Water Leakage", "Broken Streetlight", "Garbage Accumulation", "Illegal Dumping", "Fallen Tree", "Open Drain", "Public Property Damage", "Traffic Signal Malfunction", "Flooding", "Animal Hazard", "Public Safety", "Other".
2. "severity": Must be one of: "Low", "Medium", "High", "Critical".
3. "priorityScore": An integer between 1 and 100 assessing the threat to public safety and infrastructure degradation.
4. "confidenceScore": A decimal confidence rating between 0.50 and 1.00.
5. "riskAssessment": A short sentence highlighting the immediate risks (e.g., vehicle accidents, disease vector, electrocution).
6. "duplicateKeywords": A short array of 3 lowercase search terms to query other issues in the database to detect potential duplicates.
7. "autoCategoryReason": A concise technical justification for the chosen category and severity.
8. "suggestedDepartment": Predict the best department to solve this issue. Must be exactly one of: "Public Works", "Water & Sewage", "Sanitation Dept", "Electrical Grid".
9. "suggestedDepartmentReason": A brief professional explanation justifying why this department is assigned.

Your response MUST be valid JSON only, using the structure specified above. Do not include markdown codeblocks or extra conversational text.
`;

    let responseText = "";
    if (imageBase64) {
      // If image is provided, we can do multi-modal prompt
      const result = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: imageBase64.split(",")[1] || imageBase64
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });
      responseText = result.text || "{}";
    } else {
      const result = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      responseText = result.text || "{}";
    }

    try {
      const analysis = JSON.parse(responseText.trim());
      res.json({ success: true, analysis });
    } catch (parseError) {
      // Fallback clean regex parsing in case it included markdown formatting
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0].trim());
        res.json({ success: true, analysis });
      } else {
        throw new Error("Failed to parse JSON response from Gemini model.");
      }
    }

  } catch (error: any) {
    console.warn("AI Analysis Error (Using Fallback):", error.message || error);
    // Graceful fallback for demo purposes when Gemini key is missing
    const fallbackCategories = [
      "Pothole", "Water Leakage", "Broken Streetlight", 
      "Garbage Accumulation", "Illegal Dumping", "Fallen Tree", 
      "Open Drain", "Public Property Damage", "Traffic Signal Malfunction"
    ];
    const predictedCategory = fallbackCategories.find(c => 
      title.toLowerCase().includes(c.toLowerCase()) || description.toLowerCase().includes(c.toLowerCase())
    ) || "Other";

    let severity = "Medium";
    if (title.toLowerCase().includes("urgent") || description.toLowerCase().includes("danger") || description.toLowerCase().includes("critical")) {
      severity = "Critical";
    } else if (title.toLowerCase().includes("broken") || description.toLowerCase().includes("hole")) {
      severity = "High";
    }

    let fallbackDept = "Public Works";
    let fallbackDeptReason = "Assigned to Public Works for general inspection and physical infrastructure restoration.";
    const lowerText = (title + " " + description).toLowerCase();
    if (lowerText.includes("light") || lowerText.includes("electric") || lowerText.includes("wire") || lowerText.includes("signal") || lowerText.includes("power")) {
      fallbackDept = "Electrical Grid";
      fallbackDeptReason = "Automatic keyword matching identified electrical, wiring, or signal grid concerns.";
    } else if (lowerText.includes("water") || lowerText.includes("leak") || lowerText.includes("sewage") || lowerText.includes("drain") || lowerText.includes("pipe") || lowerText.includes("flood")) {
      fallbackDept = "Water & Sewage";
      fallbackDeptReason = "Automatic keyword matching identified water utility, leakage, or drain pipe issues.";
    } else if (lowerText.includes("garbage") || lowerText.includes("waste") || lowerText.includes("dump") || lowerText.includes("trash") || lowerText.includes("litter") || lowerText.includes("sanitation")) {
      fallbackDept = "Sanitation Dept";
      fallbackDeptReason = "Automatic keyword matching identified cleanup, garbage, or environmental sanitation requirements.";
    }

    const mockAnalysis = {
      category: predictedCategory,
      severity: severity,
      priorityScore: severity === "Critical" ? 90 : severity === "High" ? 75 : 45,
      confidenceScore: 0.88,
      riskAssessment: "Potential safety hazards, vehicle damage, and localized disruptions in the community sector.",
      duplicateKeywords: title.toLowerCase().split(" ").slice(0, 3),
      autoCategoryReason: "Local keyword evaluation triggered smart auto-classification fallback.",
      suggestedDepartment: fallbackDept,
      suggestedDepartmentReason: fallbackDeptReason
    };

    res.json({ 
      success: true, 
      analysis: mockAnalysis, 
      warning: "Running on sandbox fallback due to missing/invalid GEMINI_API_KEY environment configuration." 
    });
  }
});

// 3. AI Department Routing Suggestion Endpoint
app.post("/api/suggest-department", async (req: any, res: any) => {
  const { title, description, category, severity } = req.body;

  if (!title || !description) {
    return res.status(400).json({ success: false, error: "Title and description are required" });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `
You are the AI Civil Architect for the "Community Hero" municipality platform.
Determine the most appropriate department to assign the following reported issue:

Issue Title: "${title}"
Issue Description: "${description}"
Category: "${category || 'General'}"
Severity: "${severity || 'Medium'}"

Recommend exactly one of the following four departments:
1. "Public Works" (for potholes, fallen trees, road damage, structural repairs)
2. "Water & Sewage" (for water leakage, open drains, water log, sewage backup)
3. "Sanitation Dept" (for garbage accumulation, illegal dumping, animal carcasses, cleanups)
4. "Electrical Grid" (for broken streetlights, traffic signal malfunctions, exposed wiring)

Provide your response strictly in the following JSON structure:
{
  "suggestedDepartment": "Public Works" | "Water & Sewage" | "Sanitation Dept" | "Electrical Grid",
  "suggestedDepartmentReason": "A concise, technical, professional sentence justifying this assignment."
}
Do not include any explanation, conversational text, or markdown codeblocks outside this JSON.
`;

    const result = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    try {
      const recommendation = JSON.parse(result.text?.trim() || "{}");
      res.json({ success: true, recommendation });
    } catch {
      const jsonMatch = result.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        res.json({ success: true, recommendation: JSON.parse(jsonMatch[0].trim()) });
      } else {
        throw new Error("Unable to parse department suggestion.");
      }
    }
  } catch (error: any) {
    // Graceful fallback logic
    let dept = "Public Works";
    let reason = "Assigned to Public Works for general inspection and physical infrastructure restoration.";
    
    const t = (title + " " + description + " " + (category || "")).toLowerCase();
    if (t.includes("light") || t.includes("electric") || t.includes("wire") || t.includes("signal") || t.includes("power")) {
      dept = "Electrical Grid";
      reason = "Electrical issues detected in keywords, routed to Electrical Grid maintenance.";
    } else if (t.includes("water") || t.includes("leak") || t.includes("sewage") || t.includes("drain") || t.includes("pipe") || t.includes("flood")) {
      dept = "Water & Sewage";
      reason = "Water and sewage issues detected in keywords, routed to Water & Sewage team.";
    } else if (t.includes("garbage") || t.includes("waste") || t.includes("dump") || t.includes("trash") || t.includes("litter") || t.includes("sanitation")) {
      dept = "Sanitation Dept";
      reason = "Refuse or cleaning issues detected in keywords, routed to Sanitation Dept.";
    }

    res.json({
      success: true,
      recommendation: {
        suggestedDepartment: dept,
        suggestedDepartmentReason: reason
      },
      warning: "Fallback local routing used."
    });
  }
});

// 3. AI Smart Resolution Recommendation Endpoint
app.post("/api/suggest-resolution", async (req: any, res: any) => {
  const { title, category, description, severity } = req.body;

  try {
    const ai = getGeminiClient();
    const prompt = `
You are the AI Civil Engineering Lead for the "Community Hero" municipality platform.
We need an optimized, technical resolution plan for the following reported issue:

Issue Category: ${category}
Issue Title: "${title}"
Severity Level: ${severity}
Description: "${description}"

Generate a step-by-step resolution plan and list of recommended safety equipment, materials, and department assignment.
Provide your response strictly in the following JSON structure:
{
  "assignedDepartment": "e.g., Sanitation & Waste Management, Public Works, Electrical Maintenance Division",
  "estimatedHours": 12,
  "steps": [
    "Step 1: Secure the perimeter with hazard tape.",
    "..."
  ],
  "materialsRequired": ["Item A", "Item B"],
  "safetyPrecautions": ["Precaution A", "Precaution B"]
}
Do not include any explanation, conversational text or markdown codeblocks outside this JSON.
`;

    const result = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    try {
      const recommendation = JSON.parse(result.text?.trim() || "{}");
      res.json({ success: true, recommendation });
    } catch {
      const jsonMatch = result.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        res.json({ success: true, recommendation: JSON.parse(jsonMatch[0].trim()) });
      } else {
        throw new Error("Unable to parse suggestion.");
      }
    }
  } catch (error: any) {
    // Graceful fallback recommendations
    const mockRec = {
      assignedDepartment: category === "Broken Streetlight" || category === "Traffic Signal Malfunction" 
        ? "Electrical & Grid Engineering Dept"
        : category === "Water Leakage" || category === "Open Drain"
        ? "Water Supply & Sewage Reclamation"
        : category === "Garbage Accumulation" || category === "Illegal Dumping"
        ? "Environmental Sanitation Services"
        : "Public Works & Road Maintenance Office",
      estimatedHours: severity === "Critical" ? 4 : severity === "High" ? 12 : 24,
      steps: [
        "Inspect the physical site and establish a safe buffer zone for civil works.",
        "Assess damage to secondary infrastructure (sidewalks, cables, water channels).",
        "Deploy municipal response team with correct utility equipment.",
        "Perform structural repair and document the completed resolution with photographs.",
        "Verify stability and request citizen confirmation for closure."
      ],
      materialsRequired: ["Traffic barrier cones", "Municipal toolset", "Site clearance markers"],
      safetyPrecautions: ["Wear high-visibility retroreflective vests", "Check for underground electrical utility lines before digging"]
    };
    res.json({ success: true, recommendation: mockRec, warning: "Using fallback algorithm." });
  }
});

// 4. AI Predictive Analytics mapping endpoint
app.post("/api/generate-predictive-map", async (req: any, res: any) => {
  const { currentIssues, cityCenter } = req.body; // array of current issue structures and [lat, lng] center

  try {
    const ai = getGeminiClient();
    const issueSummary = currentIssues ? JSON.stringify(currentIssues.slice(0, 10).map((i: any) => ({
      category: i.category,
      lat: i.latitude,
      lng: i.longitude,
      severity: i.severity
    }))) : "[]";

    const cityContext = cityCenter 
      ? `This represents issues only in the citizen's current city centered around coordinates [${cityCenter[0].toFixed(4)}, ${cityCenter[1].toFixed(4)}]. Focus your predictions ONLY on this local metropolitan zone.`
      : "Focus your predictions on the local area where these issues are clustered.";

    const prompt = `
You are the AI Predictive Urban Planner for "Community Hero".
${cityContext}
Based on this raw civic issue distribution within this specific city, predict three potential high-risk zones/wards where future infrastructure failure is probabilistic.

Raw Issues list in current city:
${issueSummary}

Provide a structured JSON output with three high-risk forecasts:
{
  "forecasts": [
    {
      "wardName": "Central Ward (City Core)",
      "hazardType": "Garbage Overflow / Drainage Clog Risk",
      "probability": 85,
      "factors": "Compounding effect of water leakage issues near high garbage density areas in the local city.",
      "preventativeAction": "Schedule preventative storm drain cleanouts and place additional municipal bins."
    }
  ]
}
Do not include codeblocks or text outside this JSON.
`;

    const result = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    try {
      const analysis = JSON.parse(result.text?.trim() || "{}");
      res.json({ success: true, forecasts: analysis.forecasts });
    } catch {
      const jsonMatch = result.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        res.json({ success: true, forecasts: JSON.parse(jsonMatch[0].trim()).forecasts });
      } else {
        throw new Error("Parsing predictive map error.");
      }
    }
  } catch (error: any) {
    const mockForecasts = [
      {
        wardName: "Sector 7 - West Avenue Transit Area",
        hazardType: "Water Main Burst & Road Erosion Risk",
        probability: 78,
        factors: "Frequent minor water leaks reported over sandy road foundations.",
        preventativeAction: "Conduct acoustic pipe leak inspection along Sector 7 main line."
      },
      {
        wardName: "Metro Plaza & Commercial Hub",
        hazardType: "Illegal Dumping & Pest Hazard",
        probability: 82,
        factors: "Overfilled dumpsters and low public lighting levels reported in commercial alleys.",
        preventativeAction: "Install motion-activated deterrence cameras and repair commercial streetlights."
      },
      {
        wardName: "Valley Heights residential basin",
        hazardType: "Water Pooling & Flash Flood Risk",
        probability: 65,
        factors: "Fallen foliage complaints combined with broken storm drain grates.",
        preventativeAction: "Deploy mobile sweepers to clear catch basins before expected monsoon showers."
      }
    ];
    res.json({ success: true, forecasts: mockForecasts, warning: "Using fallback planner logic." });
  }
});


// 5. Mount Vite middleware for development or serve build folder in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
