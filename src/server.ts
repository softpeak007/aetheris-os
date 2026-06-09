import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Register JSON and URL encoders
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

import {
  Store,
  generatePlanningBlueprint,
  simulateAgentDebate,
  executeAgentStep,
  RAGDocument,
  Memory,
  generateAutonomousMissionResult,
  MissionHistoryItem,
  DBState,
  Epic,
  Task,
  getLocalFallbackConversations,
  getLocalFallbackReport,
} from "./server-helper";

/**
 * Save mission to history helper
 */
function saveMissionToHistory(state: DBState, engine: "autonomous" | "standard") {
  if (!state.missionHistory) {
    state.missionHistory = [];
  }
  
  const goal = engine === "autonomous" ? (state.autonomousMission?.goal || state.missionObjective) : state.missionObjective;
  if (!goal) return;
  
  const exists = state.missionHistory.find((h: MissionHistoryItem) => h.goal === goal && h.selectedEngine === engine);
  if (exists) return;
  
  const industry = engine === "autonomous" ? (state.autonomousMission?.industry || "Tech") : "General";
  const priority = engine === "autonomous" ? (state.autonomousMission?.priority || "Medium") : "Medium";
  const safetyChecks = engine === "autonomous" ? (state.autonomousMission?.safetyChecks || []) : [];
  
  let report = null;
  if (engine === "autonomous" && state.autonomousMission?.report) {
    report = { ...state.autonomousMission.report };
  } else if (engine === "standard") {
    report = {
      problemAnalysis: `Standard sequential execution complete for: "${state.missionObjective}".`,
      marketResearch: "Standard mode execution completed. Trigger Autonomous Grid for comprehensive bento layout reports.",
      productPlan: `Executed actions across custom workflows.`,
      mvpFeatures: state.tasks.map((t: Task) => t.name),
      uiUxDirection: "Interface verified with Inter display pairing, responsive container cards.",
      backendArchitecture: "Angular dynamic route coupled to sandboxed node runner.",
      monetizationStrategy: "Standard SaaS unit metrics.",
      riskAnalysis: "Standard dependencies checks resolved with no fatal blocks.",
      launchPlan: "Phased integration via sequential agent approvals.",
      next7DaysPlan: state.epics.map((e: Epic) => `Day: Finalize build and verify active logs of target epic "${e.name}" - ${e.description}`)
    };
  }
  
  state.missionHistory.unshift({
    id: `hist-${Date.now()}`,
    goal,
    industry,
    priority,
    selectedEngine: engine,
    status: "completed",
    timestamp: new Date().toISOString(),
    agentLogs: [...state.logs],
    safetyChecks,
    report,
    epics: [...state.epics],
    tasks: [...state.tasks]
  });
}

/**
 * Enterprise Multi-Agent OS API Endpoints
 */

// Endpoint to delete mission history item
app.post("/api/history/delete", (req, res) => {
  const { id } = req.body;
  if (!id) {
    res.status(400).json({ error: "Mission ID is required" });
    return;
  }
  try {
    const state = Store.get();
    if (!state.missionHistory) state.missionHistory = [];
    state.missionHistory = state.missionHistory.filter((h) => h.id !== id);
    Store.save();
    res.json(state);
  } catch {
    res.status(500).json({ error: "Failed to delete history item" });
  }
});

// Endpoint to open mission history item
app.post("/api/history/open", (req, res) => {
  const { id } = req.body;
  if (!id) {
    res.status(400).json({ error: "Mission ID is required" });
    return;
  }
  try {
    const state = Store.get();
    if (!state.missionHistory) state.missionHistory = [];
    const item = state.missionHistory.find((h) => h.id === id);
    if (!item) {
      res.status(404).json({ error: "History item not found" });
      return;
    }
    
    // Set active states
    state.missionObjective = item.goal;
    state.missionProgress = 100;
    
    if (item.selectedEngine === "autonomous") {
      state.missionStatus = "idle";
      state.autonomousMission = {
        isActive: true,
        goal: item.goal,
        industry: item.industry,
        outputType: "MVP Specs",
        priority: item.priority,
        status: "completed",
        currentStepIndex: 10,
        steps: [
          { agent: "CEO Agent", status: "completed", confidence: 98, estCompletion: "Resolved", logs: [] },
          { agent: "Research Agent", status: "completed", confidence: 96, estCompletion: "Resolved", logs: [] },
          { agent: "Product Agent", status: "completed", confidence: 97, estCompletion: "Resolved", logs: [] },
          { agent: "UI/UX Agent", status: "completed", confidence: 99, estCompletion: "Resolved", logs: [] },
          { agent: "Coding Agent", status: "completed", confidence: 95, estCompletion: "Resolved", logs: [] },
          { agent: "Marketing Agent", status: "completed", confidence: 94, estCompletion: "Resolved", logs: [] },
          { agent: "Finance Agent", status: "completed", confidence: 97, estCompletion: "Resolved", logs: [] },
          { agent: "Legal Agent", status: "completed", confidence: 98, estCompletion: "Resolved", logs: [] },
          { agent: "Critic Agent", status: "completed", confidence: 95, estCompletion: "Resolved", logs: [] },
          { agent: "Safety Agent", status: "completed", confidence: 99, estCompletion: "Resolved", logs: [] }
        ],
        conversations: [],
        report: item.report,
        safetyChecks: item.safetyChecks
      };
    } else {
      state.missionStatus = "completed";
      if (state.autonomousMission) {
        state.autonomousMission.isActive = false;
      }
      state.epics = item.epics || [];
      state.tasks = item.tasks || [];
    }
    
    state.logs = item.agentLogs || [];
    Store.save();
    res.json(state);
  } catch {
    res.status(500).json({ error: "Failed to open legacy mission profile" });
  }
});

// Retrieve full current database state
app.get("/api/agent-state", (req, res) => {
  try {
    const s = Store.get();
    res.json(s);
  } catch {
    res.status(500).json({ error: "Failed to read agent system state" });
  }
});

// Trigger new mission planning based on objective
app.post("/api/init-mission", async (req, res) => {
  const { objective } = req.body;
  if (!objective || typeof objective !== "string" || objective.trim() === "") {
    res.status(400).json({ error: "Mission objective is required" });
    return;
  }

  try {
    const state = Store.get();
    state.missionObjective = objective;
    state.missionStatus = "planning";
    state.missionProgress = 5;
    state.epics = [];
    state.tasks = [];
    
    // Clear logs except initial
    state.logs = [
      {
        id: "l-init",
        timestamp: new Date().toISOString(),
        agent: "CEO Agent",
        title: "Mission Formulated",
        text: `Mission initiated: "${objective}". Spawning specialized planning subprocesses...`,
        type: "info"
      }
    ];

    Store.save();

    // Trigger Gemini to decompose objective into epics and tasks
    const { epics, tasks } = await generatePlanningBlueprint(objective);
    
    state.epics = epics;
    state.tasks = tasks;
    state.missionStatus = "running";
    state.missionProgress = 15;

    // Add Planning complete log
    state.logs.push({
      id: "l-plan-complete",
      timestamp: new Date().toISOString(),
      agent: "Planning Agent",
      title: "Tactical Backlog Formulated",
      text: `Decomposed strategic objective into ${epics.length} Epics and ${tasks.length} critical dependent tasks. Prepared multi-agent priorities.`,
      type: "success"
    });

    Store.save();
    res.json(state);
  } catch (error) {
    console.error("Failed to plan mission", error);
    res.status(500).json({ error: "Strategic planning subprocess failed" });
  }
});

// Cache for the active background Gemini generation
interface BackgroundGeneration {
  goal: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  conversations: any[];
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  report: any;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  safetyChecks: any[];
  status: "pending" | "resolved" | "failed";
}

let backgroundCache: BackgroundGeneration | null = null;

// Autonomous Mission Mode: Initialize and compile whole execution plan
app.post("/api/autonomous/run", (req, res) => {
  const { goal, industry, outputType, priority } = req.body;
  if (!goal || typeof goal !== "string" || goal.trim() === "") {
    res.status(400).json({ error: "Mission goal is required" });
    return;
  }

  try {
    const state = Store.get();
    
    state.missionStatus = "idle";
    state.missionObjective = goal;

    const agentsList = [
      "CEO Agent", "Research Agent", "Product Agent", "UI/UX Agent", "Coding Agent", 
      "Marketing Agent", "Finance Agent", "Legal Agent", "Critic Agent", "Safety Agent"
    ];

    const initialSteps = agentsList.map((agent) => ({
      agent,
      status: "pending" as const,
      confidence: 0,
      estCompletion: "Pending",
      logs: [] as string[]
    }));

    state.autonomousMission = {
      isActive: true,
      goal,
      industry: industry || "Tech",
      outputType: outputType || "MVP Specs",
      priority: priority || "Medium",
      status: "running",
      currentStepIndex: 0,
      steps: initialSteps,
      conversations: [],
      report: null,
      safetyChecks: []
    };

    state.logs.push({
      id: `auto-run-init-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: "CEO Agent",
      title: "Autonomous Pipeline Triggered",
      text: `Autonomous agent grid requested for vertical [${industry}] with format limit [${outputType}]. Formulating collaborative planning session...`,
      type: "info"
    });

    state.logs.push({
      id: `auto-run-compiled-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: "CEO Agent",
      title: "Collaborative Dialogue Initiated",
      text: `Tactical pipeline is live. Instantiating multi-agent dialogue grids simultaneously under zero-latency optimization.`,
      type: "success"
    });

    // Initialize non-blocking background Gemini thread
    backgroundCache = {
      goal,
      conversations: [],
      report: null,
      safetyChecks: [],
      status: "pending"
    };

    generateAutonomousMissionResult(goal, industry || "Tech", outputType || "MVP Specs", priority || "Medium")
      .then((result) => {
        if (backgroundCache && backgroundCache.goal === goal) {
          backgroundCache.conversations = result.conversations;
          backgroundCache.report = result.report;
          backgroundCache.safetyChecks = result.safetyChecks;
          backgroundCache.status = "resolved";
          console.log(`[Aetheris OS] Background task finished for goal: ${goal}`);

          const s = Store.get();
          if (s.autonomousMission && s.autonomousMission.goal === goal) {
            if (s.autonomousMission.status === "completed" || s.autonomousMission.status === "safety_checking") {
              s.autonomousMission.conversations = result.conversations;
              s.autonomousMission.report = result.report;
              s.autonomousMission.safetyChecks = result.safetyChecks;
              Store.save();
            }
          }
        }
      })
      .catch((err) => {
        console.error("[Aetheris OS] Background formulation error:", err);
        if (backgroundCache && backgroundCache.goal === goal) {
          backgroundCache.status = "failed";
        }
      });

    Store.save();
    res.json(state);
  } catch (error) {
    console.error("Failed to run autonomous mission", error);
    res.status(500).json({ error: "Autonomous mission compilation failed. Please check Gemini API availability and retry." });
  }
});

// Autonomous Mission Mode: Simulate parallel-grouped steps (4 strategic phases)
app.post("/api/autonomous/step", (req, res) => {
  try {
    const state = Store.get();
    if (!state.autonomousMission || state.autonomousMission.status !== "running") {
      res.status(400).json({ error: "No active autonomous mission is running" });
      return;
    }

    const currentIdx = state.autonomousMission.currentStepIndex;
    const steps = state.autonomousMission.steps;

    // Define 4 Parallel batched executable phases
    const batches = [
      [0, 1],       // Phase 0: CEO Agent + Research Agent in parallel
      [2, 3, 4],    // Phase 1: Product Agent + UI/UX Agent + Coding Agent in parallel
      [5, 6, 7],    // Phase 2: Marketing Agent + Finance Agent + Legal Agent in parallel
      [8, 9]        // Phase 3: Critic Agent + Safety Agent in parallel
    ];

    if (currentIdx >= batches.length) {
      state.autonomousMission.status = "safety_checking";
      steps.forEach(s => s.status = "completed");

      // Merge cached background Gemini results if resolved
      if (backgroundCache && backgroundCache.goal === state.autonomousMission.goal && backgroundCache.status === "resolved") {
        state.autonomousMission.report = backgroundCache.report;
        state.autonomousMission.safetyChecks = backgroundCache.safetyChecks;
      } else {
        // Safe, instantaneous fallback if still pending or failed
        const fallback = getLocalFallbackReport(state.autonomousMission.goal, state.autonomousMission.industry);
        state.autonomousMission.report = fallback.report;
        state.autonomousMission.safetyChecks = fallback.safetyChecks;
      }

      Store.save();
      res.json(state);
      return;
    }

    // Complete all previous batches
    for (let p = 0; p < currentIdx; p++) {
      batches[p].forEach((idx) => {
        steps[idx].status = "completed";
      });
    }

    // Fire current batch of multiple independent agents running concurrently
    const activeIndices = batches[currentIdx];
    activeIndices.forEach((idx) => {
      const activeStep = steps[idx];
      activeStep.status = "running";
      activeStep.confidence = Math.floor(Math.random() * 8) + 92;
      activeStep.estCompletion = "Resolved";

      const logsMap: Record<string, string[]> = {
        "CEO Agent": [
          "Analyzing mission strategic boundaries...",
          "Formulated tactical scope framework boundaries...",
          "Consensus blueprint parameters dispatched to agent grid."
        ],
        "Research Agent": [
          "Scraping competitor domains for unique value parameters...",
          "Evaluating industry fragmentations and niche vacancies...",
          "Completed baseline market capture matrix."
        ],
        "Product Agent": [
          "Isolating primary user stories and pain point wedging...",
          "Drafting Epic prioritization maps and feature matrices...",
          "Generated product requirements specifications."
        ],
        "UI/UX Agent": [
          "Structuring layout hierarchy matching Inter with Outfit display fonts...",
          "Engineering responsive glassmorphic cards with cyan outlines...",
          "Coupled user actions with high-contrast Material icons."
        ],
        "Coding Agent": [
          "Formulating zoneless Angular routing system...",
          "Structuring backend proxy controllers and REST layers...",
          "Compiled static bundle configurations with zero warnings."
        ],
        "Marketing Agent": [
          "Scouting growth acquisition hubs and private beta groups...",
          "Composing press release hooks and media kits...",
          "Designed high-traction waitlist launch timeline."
        ],
        "Finance Agent": [
          "Formulating tiered pricing matrices starting from $29/seat...",
          "Projecting lifetime value indices and payback buffers...",
          "Verified runway security against projected API usage."
        ],
        "Legal Agent": [
          "Auditing compliance grids with active privacy regulatory guides...",
          "Verifying sandbox transmission pipelines for encryption safety...",
          "Approved operational policy contract schemas."
        ],
        "Critic Agent": [
          "Conducting adversarial evaluation of product plan viability bounds...",
          "Alerting Product Agent about potential retention friction in settings layout...",
          "Delivered critical gaps optimization instructions."
        ],
        "Safety Agent": [
          "Conducting comprehensive toxicity content checks...",
          "Evaluating credential storage protocols for leaks...",
          "Granted official system deployment clearance."
        ]
      };

      activeStep.logs = logsMap[activeStep.agent] || [
        "Synchronizing context maps...",
        "Scrubbing logs for leakage vectors..."
      ];

      activeStep.logs.forEach((logText, lIdx) => {
        state.logs.push({
          id: `auto-${currentIdx}-${idx}-${lIdx}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          agent: activeStep.agent,
          title: activeStep.agent + " Core Task Resolved",
          text: logText,
          type: "info"
        });
      });
    });

    // Progressive Dialogue streaming: Filter conversations database matching completed or active agents
    const activeAndPastAgents = new Set<string>();
    for (let p = 0; p <= currentIdx; p++) {
      batches[p].forEach((idx) => {
        activeAndPastAgents.add(steps[idx].agent);
      });
    }

    let masterConversations = [];
    if (backgroundCache && backgroundCache.goal === state.autonomousMission.goal && backgroundCache.conversations.length > 0) {
      masterConversations = backgroundCache.conversations;
    } else {
      masterConversations = getLocalFallbackConversations(
        state.autonomousMission.goal,
        state.autonomousMission.industry,
        state.autonomousMission.outputType,
        state.autonomousMission.priority
      );
    }

    // Stream conversation parts progressively matching active execution timeline
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    state.autonomousMission.conversations = masterConversations.filter((c: any) => activeAndPastAgents.has(c.speaker));

    // Increment current batch phase index
    state.autonomousMission.currentStepIndex = currentIdx + 1;

    // Check if we hit final batch completion
    if (state.autonomousMission.currentStepIndex === batches.length) {
      steps.forEach(s => s.status = "completed");
      state.autonomousMission.status = "safety_checking";

      if (backgroundCache && backgroundCache.goal === state.autonomousMission.goal && backgroundCache.status === "resolved") {
        state.autonomousMission.report = backgroundCache.report;
        state.autonomousMission.safetyChecks = backgroundCache.safetyChecks;
      } else {
        const fallback = getLocalFallbackReport(state.autonomousMission.goal, state.autonomousMission.industry);
        state.autonomousMission.report = fallback.report;
        state.autonomousMission.safetyChecks = fallback.safetyChecks;
      }
    }

    Store.save();
    res.json(state);
  } catch (error) {
    console.error("Failed to step autonomous mission", error);
    res.status(500).json({ error: "Step processing failed" });
  }
});

// Autonomous Mission Mode: Complete safety checks and publish output
app.post("/api/autonomous/complete-safety", (req, res) => {
  try {
    const state = Store.get();
    if (!state.autonomousMission || state.autonomousMission.status !== "safety_checking") {
      res.status(400).json({ error: "Mission is not in safety auditing stage" });
      return;
    }

    state.autonomousMission.status = "completed";
    
    state.memories.push({
      id: `mem-auto-${Date.now()}`,
      text: `Completed comprehensive autonomous product formulation for project: "${state.autonomousMission.goal}". Persisted strategic roadmap in executive ledger.`,
      timestamp: new Date().toISOString(),
      type: "corporate",
      confidence: 0.98,
      relevance: 1.0,
      tags: ["autonomous", "achievement", state.autonomousMission.industry.toLowerCase()]
    });

    state.logs.push({
      id: `auto-success-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: "CEO Agent",
      title: "Strategic Milestone Met",
      text: "Entire multi-agent pipeline resolved with successful clearances. Published Final Actionable Intelligence Report.",
      type: "success"
    });

    saveMissionToHistory(state, "autonomous");
    Store.save();
    res.json(state);
  } catch (error) {
    console.error("Failed to complete safety checks", error);
    res.status(500).json({ error: "Compliance publishing failed" });
  }
});

// Autonomous Mission Mode: Reset back to idle
app.post("/api/autonomous/reset", (req, res) => {
  try {
    const state = Store.get();
    if (state.autonomousMission) {
      state.autonomousMission.isActive = false;
      state.autonomousMission.goal = "";
      state.autonomousMission.status = "idle";
      state.autonomousMission.currentStepIndex = 0;
      state.autonomousMission.steps = [];
      state.autonomousMission.conversations = [];
      state.autonomousMission.report = null;
      state.autonomousMission.safetyChecks = [];
    }
    Store.save();
    res.json(state);
  } catch (error) {
    console.error("Failed to reset autonomous state", error);
    res.status(500).json({ error: "State restore failed" });
  }
});

// Step through the active mission
app.post("/api/step-mission", async (req, res) => {
  try {
    const state = Store.get();
    if (state.missionStatus !== "running") {
      res.status(400).json({ error: "No mission is currently running" });
      return;
    }

    // Find the first pending task
    const nextTask = state.tasks.find((t) => t.status === "pending" || t.status === "failed");
    if (!nextTask) {
      // Check if any approval is required before completion
      const pendingApproval = state.tasks.find((t) => t.status === "approval_required");
      if (pendingApproval) {
        res.status(400).json({ error: "Execution paused: Human approval is required to proceed." });
        return;
      }

      // No pending tasks left! Completion sequence!
      state.missionStatus = "completed";
      state.missionProgress = 100;
      
      const finishedLog = {
        id: `log-f-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agent: "CEO Agent",
        title: "Mission Objective Realized",
        text: `All tactical items have been successfully resolved and validated. Generating final multi-agent evaluation reports.`,
        type: "success" as const
      };
      state.logs.push(finishedLog);
      saveMissionToHistory(state, "standard");
      Store.save();
      res.json(state);
      return;
    }

    // Determine current epic
    const epic = state.epics.find((e) => e.id === nextTask.epicId);
    const epicName = epic ? epic.name : "Subsystem Integrity";
    if (epic && epic.status === "pending") {
      epic.status = "active";
    }

    nextTask.status = "active";
    
    // Add active execution log
    state.logs.push({
      id: `log-act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: nextTask.assignee,
      title: `Executing Task: ${nextTask.name}`,
      text: `Commencing specialized design and tactical implementation. Description: ${nextTask.description}`,
      type: "info"
    });
    Store.save();

    // 1. Check if we should trigger an Agent Debate (25% chance or if dependencies exist, to enrich experience)
    const shouldDebate = Math.random() > 0.4 && state.tasks.filter((t) => t.status === "completed").length > 0;
    if (shouldDebate) {
      const debateOpponent = "Critic Agent";
      const debateResult = await simulateAgentDebate(
        state.missionObjective,
        nextTask.name,
        nextTask.assignee,
        debateOpponent
      );

      state.logs.push({
        id: `debate-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agent: nextTask.assignee,
        title: `Adversarial Debate with ${debateOpponent}`,
        text: `DEBATE TRANSCRIPT:\n` + 
              debateResult.dialogue.map((d) => `[${d.speaker}]: ${d.text}`).join("\n\n") + 
              `\n\nCONSENSUS REACHED:\n${debateResult.consensus}`,
        type: "debate"
      });
      state.metrics.tokensUsed += 1500;
      state.metrics.totalCost += 0.00225;
    }

    // 2. Perform Step Execution via Gemini
    const result = await executeAgentStep(state.missionObjective, epicName, nextTask);

    // Save outputs
    nextTask.progress = 100;
    
    // Incorporate metrics
    state.metrics.latency.push(result.metricLogs.latency);
    if (state.metrics.latency.length > 10) state.metrics.latency.shift();
    state.metrics.tokensUsed += result.metricLogs.tokens;
    state.metrics.totalCost += result.metricLogs.cost;
    
    // Smooth moving average for hallucination score
    state.metrics.hallucinationScore = parseFloat(
      ((state.metrics.hallucinationScore * 4 + result.metricLogs.hallucination) / 5).toFixed(2)
    );

    // Save memories
    result.memoryAcquired.forEach((memText) => {
      state.memories.push({
        id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        text: memText,
        timestamp: new Date().toISOString(),
        type: "episodic",
        confidence: parseFloat((0.95 - Math.random() * 0.1).toFixed(2)),
        relevance: parseFloat((0.98 - Math.random() * 0.15).toFixed(2)),
        tags: [nextTask.assignee.split(" ")[0].toLowerCase(), "task-resolution"],
      });
    });

    // Handle tool invocations logs
    result.toolInvocations.forEach((ti) => {
      state.logs.push({
        id: `tool-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        agent: nextTask.assignee,
        title: `Invoked Tool: ${ti.tool}`,
        text: `Command: \`${ti.command}\`\nOutput:\n${ti.result}`,
        type: "tool"
      });
    });

    // Handle safety logging
    result.safetyLog.forEach((sl) => {
      state.logs.push({
        id: `safe-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        agent: "Security Agent",
        title: `Security Check: ${sl.check}`,
        text: `Verification Outcome: ${sl.status.toUpperCase()} - ${sl.comment}`,
        type: "safety"
      });
    });

    // Check for approvals / dangerous commands
    if (result.approvalRequest) {
      nextTask.status = "approval_required";
      const approvalItem = {
        id: `app-${Date.now()}`,
        title: result.approvalRequest.title,
        actionType: result.approvalRequest.actionType,
        payload: result.approvalRequest.payload,
        agent: nextTask.assignee,
        status: "pending" as const,
        timestamp: new Date().toISOString()
      };
      state.approvals.push(approvalItem);

      state.logs.push({
        id: `log-app-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agent: "Security Agent",
        title: "Execution Paused: Human Approval Required",
        text: `The ${nextTask.assignee} requests authority to execute a restricted command: ${result.approvalRequest.title}. Checked logs and requested clearance.`,
        type: "warning"
      });
    } else {
      nextTask.status = "completed";
      
      // Update Epic progress if all tasks inside are done
      const siblingTasks = state.tasks.filter((t) => t.epicId === nextTask.epicId);
      const finishedSiblings = siblingTasks.filter((t) => t.status === "completed").length;
      if (epic) {
        epic.progress = Math.round((finishedSiblings / siblingTasks.length) * 100);
        if (epic.progress === 100) {
          epic.status = "completed";
          state.logs.push({
            id: `epic-done-${Date.now()}`,
            timestamp: new Date().toISOString(),
            agent: "CEO Agent",
            title: `Epic Resolved: ${epic.name}`,
            text: `Successfully finished all tasks containing epic milestones. Verifying overall performance matrix.`,
            type: "success"
          });
        }
      }
    }

    // Recompute overall progress
    const totalFinished = state.tasks.filter((t) => t.status === "completed").length;
    state.missionProgress = 15 + Math.round((totalFinished / state.tasks.length) * 80);
    if (state.missionProgress > 95 && state.tasks.every(t => t.status === "completed")) {
      state.missionProgress = 100;
      state.missionStatus = "completed";
    }

    if (state.missionStatus === "completed") {
      saveMissionToHistory(state, "standard");
    }
    Store.save();
    res.json(state);
  } catch (error) {
    console.error("Error executing step", error);
    res.status(500).json({ error: "Step execution subengine failed" });
  }
});

// Human clearance submit
app.post("/api/submit-approval", (req, res) => {
  const { id, approved } = req.body;
  if (!id) {
    res.status(400).json({ error: "Approval request ID is required" });
    return;
  }

  try {
    const state = Store.get();
    const appItem = state.approvals.find((a) => a.id === id);
    if (!appItem) {
      res.status(404).json({ error: "Approval item not found" });
      return;
    }

    appItem.status = approved ? "approved" : "rejected";

    // Find the task that was waiting for this approval
    const waitingTask = state.tasks.find((t) => t.assignee === appItem.agent && t.status === "approval_required");

    if (approved) {
      state.logs.push({
        id: `app-y-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agent: "CEO Agent",
        title: "Restricted Command Cleared",
        text: `Human Operator APPROVED the request: "${appItem.title}". Resuming execution queue...`,
        type: "success"
      });

      if (waitingTask) {
        waitingTask.status = "completed";
        
        // Update Epic progress
        const epic = state.epics.find((e) => e.id === waitingTask.epicId);
        const siblingTasks = state.tasks.filter((t) => t.epicId === waitingTask.epicId);
        const finishedSiblings = siblingTasks.filter((t) => t.status === "completed").length;
        if (epic) {
          epic.progress = Math.round((finishedSiblings / siblingTasks.length) * 100);
          if (epic.progress === 100) {
            epic.status = "completed";
          }
        }
      }
    } else {
      state.logs.push({
        id: `app-n-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agent: "Security Agent",
        title: "Restricted Command Denied",
        text: `Human Operator REJECTED the request: "${appItem.title}". Task flagged as failed. Re-planning required.`,
        type: "error"
      });

      if (waitingTask) {
        waitingTask.status = "failed";
      }
    }

    // Recompute overall progress
    const totalFinished = state.tasks.filter((t) => t.status === "completed").length;
    state.missionProgress = 15 + Math.round((totalFinished / state.tasks.length) * 80);
    if (state.missionProgress > 95 && state.tasks.every(t => t.status === "completed")) {
      state.missionProgress = 100;
      state.missionStatus = "completed";
    }

    Store.save();
    res.json(state);
  } catch {
    res.status(500).json({ error: "Clearing decision subtask failed" });
  }
});

// Process uploaded files or text documents into chunks for RAG
app.post("/api/rag/upload", (req, res) => {
  const { filename, content, type } = req.body;
  if (!content || !filename) {
    res.status(400).json({ error: "Filename and content required" });
    return;
  }

  try {
    const state = Store.get();
    
    // Chunking text into ~300 character sliding chunks
    const textStr = String(content);
    const paragraphs = textStr.split(/\n+/).filter(p => p.trim().length > 0);
    const rawChunks: string[] = [];

    paragraphs.forEach((p) => {
      if (p.length > 500) {
        // split further
        let idx = 0;
        while (idx < p.length) {
          rawChunks.push(p.substring(idx, idx + 400));
          idx += 300; // overlapping sliding window
        }
      } else {
        rawChunks.push(p);
      }
    });

    const docId = `doc-${Date.now()}`;
    const newDoc: RAGDocument = {
      id: docId,
      filename,
      content,
      byteSize: Buffer.byteLength(content, "utf8"),
      chunkCount: rawChunks.length,
      type: type || "text/plain",
      uploadDate: new Date().toISOString(),
    };

    state.documents.push(newDoc);

    rawChunks.forEach((chunkText, index) => {
      state.chunks.push({
        id: `chunk-${docId}-${index}`,
        docId,
        filename,
        text: chunkText.trim(),
        index
      });
    });

    // Alert completion
    state.logs.push({
      id: `rag-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: "RAG Agent",
      title: `Knowledge Ingest Complete: ${filename}`,
      text: `Ingested document: ${newDoc.byteSize} bytes, formulated ${newDoc.chunkCount} searchable semantic text-fragments. Available immediately for workflow context matching.`,
      type: "success"
    });

    Store.save();
    res.json({ success: true, doc: newDoc });
  } catch {
    res.status(500).json({ error: "RAG knowledge ingest pipeline failed" });
  }
});

// Create Custom Epistemic Memory
app.post("/api/memories/create", (req, res) => {
  const { text, type, tags } = req.body;
  if (!text) {
    res.status(400).json({ error: "Memory text required" });
    return;
  }

  try {
    const state = Store.get();
    const newMem: Memory = {
      id: `mem-${Date.now()}`,
      text,
      timestamp: new Date().toISOString(),
      type: type || "episodic",
      confidence: parseFloat((0.92 + Math.random() * 0.08).toFixed(2)),
      relevance: 1.0,
      tags: tags || ["manual-inject"],
    };

    state.memories.push(newMem);
    Store.save();
    res.json(newMem);
  } catch {
    res.status(500).json({ error: "Memory index update failed" });
  }
});

// Clear memories
app.post("/api/memories/clear", (req, res) => {
  try {
    const state = Store.get();
    state.memories = [];
    Store.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to erase cognitive index" });
  }
});

// Reset system state
app.post("/api/reset", (req, res) => {
  try {
    Store.reset();
    res.json(Store.get());
  } catch {
    res.status(500).json({ error: "Subsystem hard reset failed" });
  }
});

// Save or change workflow builders
app.post("/api/workflows", (req, res) => {
  const { workflow } = req.body;
  if (!workflow || !workflow.id) {
    res.status(400).json({ error: "Valid workflow configuration required" });
    return;
  }

  try {
    const state = Store.get();
    const idx = state.workflows.findIndex((w) => w.id === workflow.id);
    if (idx !== -1) {
      state.workflows[idx] = workflow;
    } else {
      state.workflows.push(workflow);
    }
    Store.save();
    res.json({ success: true, workflows: state.workflows });
  } catch {
    res.status(500).json({ error: "Failed to update orchestrator workflows" });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
