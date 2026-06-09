import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import { join } from "node:path";

let aiClient: GoogleGenAI | null = null;
let lastApiKey: string | null = null;

/**
 * Lazy initializer for Google GenAI Client
 */
export function getGeminiClient(): GoogleGenAI {
  const key = process.env["GEMINI_API_KEY"];
  if (!key || key.trim() === "" || key === "dummy_key" || key === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is not configured in environment variables. Please provide it in the Settings > Secrets panel.");
  }
  
  if (!aiClient || lastApiKey !== key) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    lastApiKey = key;
  }
  return aiClient;
}

/**
 * Wraps call in a retry mechanism with exponential backoff for transient API errors (e.g. 503, 429).
 */
export async function generateContentWithRetry(
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  maxRetries = 3,
  initialDelay = 1000
): Promise<Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>> {
  let attempt = 0;
  while (true) {
    try {
      return await getGeminiClient().models.generateContent(params);
    } catch (error: unknown) {
      attempt++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if transient error
      const is503 = errorMessage.includes("503") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("high demand") || errorMessage.includes("Service Unavailable");
      const is429 = errorMessage.includes("429") || errorMessage.includes("rate limit") || errorMessage.includes("exhausted");
      const isTransient = is503 || is429;

      if (isTransient && attempt <= maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.warn(`[Gemini Retry] Attempt ${attempt} failed with transient error: ${errorMessage}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
}

export interface Epic {
  id: string;
  name: string;
  description: string;
  progress: number;
  priority: "low" | "medium" | "high";
  status: "pending" | "active" | "completed";
  estimatedTime: string;
  risk: "low" | "medium" | "high";
  successCriteria: string;
}

export interface Task {
  id: string;
  epicId: string;
  name: string;
  description: string;
  assignee: string;
  status: "pending" | "active" | "completed" | "failed" | "approval_required";
  progress: number;
  dependencies: string[];
}

export interface Log {
  id: string;
  timestamp: string;
  agent: string;
  title: string;
  text: string;
  type: "info" | "warning" | "success" | "error" | "tool" | "debate" | "critique" | "memory" | "safety";
  epicId?: string;
  taskId?: string;
}

export interface Memory {
  id: string;
  text: string;
  timestamp: string;
  type: string;
  confidence: number;
  relevance: number;
  tags: string[];
}

export interface RAGDocument {
  id: string;
  filename: string;
  content: string;
  byteSize: number;
  chunkCount: number;
  type: string;
  uploadDate: string;
}

export interface RAGChunk {
  id: string;
  docId: string;
  filename: string;
  text: string;
  index: number;
}

export interface Approval {
  id: string;
  title: string;
  actionType: string;
  payload: Record<string, unknown> | null;
  agent: string;
  status: "pending" | "approved" | "rejected";
  timestamp: string;
}

export interface WorkflowNode {
  id: string;
  label: string;
  agent: string;
  taskType: string;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface AutonomousStep {
  agent: string;
  status: "pending" | "running" | "completed" | "failed";
  confidence: number;
  estCompletion: string;
  logs: string[];
}

export interface AutonomousConversation {
  id: string;
  speaker: string;
  text: string;
  type: "objection" | "suggestion" | "decision" | "argument" | "critique";
}

export interface FinalReport {
  problemAnalysis: string;
  marketResearch: string;
  productPlan: string;
  mvpFeatures: string[];
  uiUxDirection: string;
  backendArchitecture: string;
  monetizationStrategy: string;
  riskAnalysis: string;
  launchPlan: string;
  next7DaysPlan: string[];
}

export interface SafetyCheck {
  check: string;
  status: "safe" | "flagged";
  comment: string;
}

export interface AutonomousMissionState {
  isActive: boolean;
  goal: string;
  industry: string;
  outputType: string;
  priority: string;
  status: "idle" | "planning" | "running" | "safety_checking" | "completed" | "failed";
  currentStepIndex: number;
  steps: AutonomousStep[];
  conversations: AutonomousConversation[];
  report: FinalReport | null;
  safetyChecks: SafetyCheck[];
}

export interface MissionHistoryItem {
  id: string;
  goal: string;
  industry: string;
  priority: string;
  selectedEngine: "autonomous" | "standard";
  status: string;
  timestamp: string;
  agentLogs: Log[];
  safetyChecks: SafetyCheck[];
  report: FinalReport | null;
  epics?: Epic[];
  tasks?: Task[];
}

export interface DBState {
  missionObjective: string;
  missionStatus: "idle" | "planning" | "running" | "paused" | "completed" | "cancelled";
  missionProgress: number;
  currentEpicId: string;
  currentTaskId: string;
  epics: Epic[];
  tasks: Task[];
  logs: Log[];
  memories: Memory[];
  documents: RAGDocument[];
  chunks: RAGChunk[];
  approvals: Approval[];
  workflows: Workflow[];
  autonomousMission?: AutonomousMissionState;
  missionHistory?: MissionHistoryItem[];
  metrics: {
    latency: number[];
    tokensUsed: number;
    totalCost: number;
    successRate: number;
    hallucinationScore: number;
    agentHealth: Record<string, "healthy" | "busy" | "maintenance">;
  };
}

const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    id: "wf-software",
    name: "Software Product Launch",
    description: "Standard workflow aligning Product, Design, Development, Safety, and DevOps.",
    nodes: [
      { id: "node-1", label: "Product Spec & Requirements", agent: "Product Agent", taskType: "spec" },
      { id: "node-2", label: "UI Wireframes & Mockups", agent: "UI/UX Agent", taskType: "design" },
      { id: "node-3", label: "Core Coding & Logic", agent: "Coding Agent", taskType: "code" },
      { id: "node-4", label: "Security & Policy Audit", agent: "Security Agent", taskType: "security" },
      { id: "node-5", label: "Automated Deployment", agent: "DevOps Agent", taskType: "deploy" },
    ],
    edges: [
      { source: "node-1", target: "node-2" },
      { source: "node-2", target: "node-3" },
      { source: "node-3", target: "node-4" },
      { source: "node-4", target: "node-5" },
    ],
  },
  {
    id: "wf-marketing",
    name: "Marketing & Launch Campaign",
    description: "Sequenced campaign formulation, financial evaluation, and documentation.",
    nodes: [
      { id: "m-1", label: "Market Research", agent: "Research Agent", taskType: "research" },
      { id: "m-2", label: "Campaign Strategies", agent: "Marketing Agent", taskType: "marketing" },
      { id: "m-3", label: "Financial Modeling", agent: "Finance Agent", taskType: "financial" },
      { id: "m-4", label: "Legal Adherence", agent: "Legal Agent", taskType: "legal" },
    ],
    edges: [
      { source: "m-1", target: "m-2" },
      { source: "m-2", target: "m-3" },
      { source: "m-3", target: "m-4" },
    ],
  },
];

const INITIAL_STATE: DBState = {
  missionObjective: "",
  missionStatus: "idle",
  missionProgress: 0,
  currentEpicId: "",
  currentTaskId: "",
  epics: [],
  tasks: [],
  logs: [],
  memories: [
    {
      id: "mem-init",
      text: "System initialized with 20 master specialized agent cognitive models.",
      timestamp: new Date().toISOString(),
      type: "system",
      confidence: 1.0,
      relevance: 1.0,
      tags: ["system", "startup"],
    },
  ],
  documents: [],
  chunks: [],
  approvals: [],
  workflows: DEFAULT_WORKFLOWS,
  missionHistory: [],
  autonomousMission: {
    isActive: false,
    goal: "",
    industry: "Tech",
    outputType: "MVP Specs",
    priority: "Medium",
    status: "idle",
    currentStepIndex: 0,
    steps: [],
    conversations: [],
    report: null,
    safetyChecks: []
  },
  metrics: {
    latency: [210, 480, 310, 390, 440],
    tokensUsed: 124500,
    totalCost: 0.186,
    successRate: 98.4,
    hallucinationScore: 1.2,
    agentHealth: {
      "CEO Agent": "healthy",
      "Research Agent": "healthy",
      "Planning Agent": "healthy",
      "Coding Agent": "healthy",
      "UI/UX Agent": "healthy",
      "Product Agent": "healthy",
      "Marketing Agent": "healthy",
      "Finance Agent": "healthy",
      "Legal Agent": "healthy",
      "Security Agent": "healthy",
      "RAG Agent": "healthy",
      "Memory Agent": "healthy",
      "Testing Agent": "healthy",
      "DevOps Agent": "healthy",
      "Analytics Agent": "healthy",
      "Documentation Agent": "healthy",
      "Critic Agent": "healthy",
      "Reflection Agent": "healthy",
      "Scheduler Agent": "healthy",
      "Notification Agent": "healthy",
    },
  },
};

const STORE_PATH = join(process.cwd(), "session_store.json");

export class Store {
  private static state: DBState | null = null;

  static get(): DBState {
    if (this.state) return this.state;
    try {
      if (fs.existsSync(STORE_PATH)) {
        const data = fs.readFileSync(STORE_PATH, "utf8");
        this.state = JSON.parse(data);
      } else {
        this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
        this.save();
      }
    } catch (e) {
      console.error("Error reading store, resetting...", e);
      this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    }
    return this.state!;
  }

  static save(): void {
    if (!this.state) return;
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.state, null, 2), "utf8");
    } catch (e) {
      console.error("Error writing store", e);
    }
  }

  static reset(): void {
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.save();
  }
}

// Map of Agents meta for icons, colors and capabilities
export const AGENT_REGISTRY: Record<
  string,
  { icon: string; color: string; specialty: string; systemPrompt: string }
> = {
  "CEO Agent": {
    icon: "crown",
    color: "amber",
    specialty: "High-level goal decomposition, multi-agent orchestration, core corporate intent enforcement.",
    systemPrompt: "You are the CEO Agent, the main orchestrator of the Enterprise Multi-Agent Operating System. Your job is to define milestones, delegate to appropriate agents, verify outcome alignment, and maintain strategic success standards.",
  },
  "Research Agent": {
    icon: "search",
    color: "sky",
    specialty: "Deep search, market validation, competitive analysis, data gathering.",
    systemPrompt: "You are the Research Agent. Your job is to investigate recent events, find packages, gather APIs, and analyze market/technical terrain.",
  },
  "Planning Agent": {
    icon: "map",
    color: "cyan",
    specialty: "Roadmapping, dependency trees, epic structure, timeline calculation.",
    systemPrompt: "You are the Planning Agent. You convert objectives into highly structured epic backlogs, milestones, tasks, dependencies, risks, and estimated timelines.",
  },
  "Coding Agent": {
    icon: "code",
    color: "emerald",
    specialty: "Production-ready coding, optimization, clean architecture pattern matching.",
    systemPrompt: "You are the Coding Agent. Your output consists of clean, correct, modular, beautifully implemented TypeScript/Angular and full-stack solutions. Specify real scripts and structures.",
  },
  "UI/UX Agent": {
    icon: "palette",
    color: "rose",
    specialty: "Design systems, layout alignment, theme pairing, glassmorphism design, ergonomics.",
    systemPrompt: "You are the UI/UX Agent. You specialize in designing outstanding user interfaces with modern spacing, color, shadow depths, visual rhythm, and impeccable usability.",
  },
  "Product Agent": {
    icon: "token",
    color: "purple",
    specialty: "User stories, MVP scope definition, functional specification design.",
    systemPrompt: "You are the Product Agent. You craft flawless specs, describe product interactions, and keep teams laser-focused on minimal lovable product structures.",
  },
  "Marketing Agent": {
    icon: "campaign",
    color: "indigo",
    specialty: "GTM strategy, copywriting, channels expansion, promotional hooks.",
    systemPrompt: "You are the Marketing Agent. You specialize in high-impact growth strategy, viral messaging structures, landing page copy, and performance indicators.",
  },
  "Finance Agent": {
    icon: "payments",
    color: "lime",
    specialty: "Cost modeling, SaaS pricing strategy, billing structures, agent asset optimization.",
    systemPrompt: "You are the Finance Agent. You specialize in pricing tiers, unit economics, resource cost analysis, stripe integrations, and subscription billing schemas.",
  },
  "Legal Agent": {
    icon: "gavel",
    color: "orange",
    specialty: "Terms of service, compliance, trademark risk, privacy compliance (GDPR/CCPA).",
    systemPrompt: "You are the Legal Agent. You assess compliance vulnerabilities, draft terms, check risk indices, and ensure agents execute legal boundaries.",
  },
  "Security Agent": {
    icon: "shield",
    color: "red",
    specialty: "Prompt injection protection, secret scrubbing, PII shielding, dependency safety.",
    systemPrompt: "You are the Security Agent. You perform zero-trust code sanitization, detect credential exposure, screen for injection templates, and maintain hard perimeter boundaries.",
  },
  "RAG Agent": {
    icon: "folder_shared",
    color: "teal",
    specialty: "Knowledge index, document parsing, citation alignment, semantic queries.",
    systemPrompt: "You are the RAG Agent. You index documentation, parse text chunks, generate context citations, and supply knowledge matching for operational directives.",
  },
  "Memory Agent": {
    icon: "psychology",
    color: "fuchsia",
    specialty: "Long-term episodic ranking, association decay, semantic caching, vector search.",
    systemPrompt: "You are the Memory Agent. You maintain and search long-term memories, summarize decision criteria, and rank episodic context relative to active tasks.",
  },
  "Testing Agent": {
    icon: "bug_report",
    color: "amber",
    specialty: "Unit test generation, behavior validation, end-to-end edge-case mockups.",
    systemPrompt: "You are the Testing Agent. You formulate critical edge cases, run stress-test plans, and ensure code meets full functional integrity constraints.",
  },
  "DevOps Agent": {
    icon: "dns",
    color: "slate",
    specialty: "Build pipelines, container scaling, deployment orchestration, health logs.",
    systemPrompt: "You are the DevOps Agent. You design deployment patterns, Cloud Run blueprints, bundle optimization setups, and continuous integration procedures.",
  },
  "Analytics Agent": {
    icon: "bar_chart",
    color: "amber",
    specialty: "Metrics mapping, token cost counters, performance trends, latency monitoring.",
    systemPrompt: "You are the Analytics Agent. You analyze execution velocity, cost curves, token budgets, and construct operational visual dashboard metrics.",
  },
  "Documentation Agent": {
    icon: "description",
    color: "blue",
    specialty: "PRD design, code guides, Swagger definitions, API architecture schemas.",
    systemPrompt: "You are the Documentation Agent. You generate outstanding technical documentation, architectural blueprints, developer guides, and operations standard kits.",
  },
  "Critic Agent": {
    icon: "rate_review",
    color: "violet",
    specialty: "Hypothesis testing, adversarial critique, bottleneck highlighting, QA check.",
    systemPrompt: "You are the Critic Agent. You play devil's advocate, spot logical contradictions in blueprints, flag lazy coding choices, and enforce extreme polish.",
  },
  "Reflection Agent": {
    icon: "auto_awesome",
    color: "pink",
    specialty: "Post-mortem review, retry analytics, learning adjustment, system tuning.",
    systemPrompt: "You are the Reflection Agent. You review execution failures, refine system templates, optimize prompt instructions, and structure self-improvement loops.",
  },
  "Scheduler Agent": {
    icon: "schedule",
    color: "sky",
    specialty: "Cron scheduling, routine automation, delay pipelines, time-boxed checks.",
    systemPrompt: "You are the Scheduler Agent. You manage cron expressions, automated checking loops, wait delays, and time-ordered agenda tasks.",
  },
  "Notification Agent": {
    icon: "notifications",
    color: "yellow",
    specialty: "Email dispatch, Slack webhooks, system alerts, visual messaging relays.",
    systemPrompt: "You are the Notification Agent. You construct polished, actionable Slack updates, structured email alerts, and high-priority dashboard signals.",
  },
};

// Generates an initial planning epic and task set from an objective using Gemini
export async function generatePlanningBlueprint(objective: string): Promise<{ epics: Epic[]; tasks: Task[] }> {
  try {
    const prompt = `You are a staff Planning and Product Arch Agent. Decompose this strategic corporate objective into an enterprise backlog.
Objective: "${objective}"

Decompose it into exactly 3-4 Epics, and then decompose each Epic into 3-4 structural Tasks. 
Return the response strictly as a JSON object of this exact schema:
{
  "epics": [
    {
      "id": "epic-1",
      "name": "Epic Name Here",
      "description": "Deep corporate epic focus",
      "priority": "high",  // must be 'low', 'medium' or 'high'
      "estimatedTime": "4 days",
      "risk": "medium",  // must be 'low', 'medium' or 'high'
      "successCriteria": "Epic success indicator"
    }
  ],
  "tasks": [
    {
      "id": "task-1-1",
      "epicId": "epic-1",
      "name": "Task Name Here",
      "description": "Granular operational task instruction for an agent",
      "assignee": "Coding Agent", // Must pick from: 'CEO Agent','Research Agent','Planning Agent','Coding Agent','UI/UX Agent','Product Agent','Marketing Agent','Finance Agent','Legal Agent','Security Agent','RAG Agent','Memory Agent','Testing Agent','DevOps Agent','Analytics Agent','Documentation Agent','Critic Agent','Reflection Agent','Scheduler Agent','Notification Agent'
      "dependencies": [] // Array of pre-requisite task IDs
    }
  ]
}

Only return clean parseable JSON. Do not write any markdown outside of JSON.`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    if (parsed.epics && parsed.tasks) {
      // Map extra fields
      const epics: Epic[] = (parsed.epics as Partial<Epic>[]).map((e) => ({
        id: e.id || "epic-id",
        name: e.name || "Unnamed Epic",
        description: e.description || "",
        progress: 0,
        priority: e.priority || "medium",
        status: "pending",
        estimatedTime: e.estimatedTime || "2 days",
        risk: e.risk || "low",
        successCriteria: e.successCriteria || "Completed successfully",
      }));

      const tasks: Task[] = (parsed.tasks as Partial<Task>[]).map((t) => ({
        id: t.id || "task-id",
        epicId: t.epicId || "epic-id",
        name: t.name || "Unnamed Task",
        description: t.description || "",
        assignee: t.assignee || "Coding Agent",
        status: "pending",
        progress: 0,
        dependencies: t.dependencies || [],
      }));

      return { epics, tasks };
    }
  } catch (e) {
    console.error("Gemini blueprint generation failed, falling back to static generation", e);
  }

  // Fallback in case of API failure/unconfigured key
  const mockEpics: Epic[] = [
    {
      id: "epic-scope",
      name: "Strategic MVP Scope & Spec Formulation",
      description: "Perform research, legal risk checks, and craft functional architecture blueprints.",
      progress: 0,
      priority: "high",
      status: "pending",
      estimatedTime: "2 days",
      risk: "low",
      successCriteria: "Approved Product Requirement Documents and compliant architecture specifications.",
    },
    {
      id: "epic-dev",
      name: "Iterative Core Codebase Construction",
      description: "Write complete backend API logic, interactive client components, and security-hardened rules.",
      progress: 0,
      priority: "high",
      status: "pending",
      estimatedTime: "5 days",
      risk: "medium",
      successCriteria: "Compiling standalone UI, responsive visual bindings, and fully covered database endpoints.",
    },
    {
      id: "epic-scale",
      name: "Growth Strategies & Automated Launch Pipelines",
      description: "Design viral marketing campaigns, formulate SaaS tiers, map container orchestrations, and deploy build files.",
      progress: 0,
      priority: "medium",
      status: "pending",
      estimatedTime: "3 days",
      risk: "high",
      successCriteria: "Production deployment container up, dynamic Stripe callback router registered, and newsletters dispatched.",
    },
  ];

  const mockTasks: Task[] = [
    {
      id: "t-1",
      epicId: "epic-scope",
      name: "Deconstruct Core Requirements & Flow Matrix",
      description: "Extract essential functional user stories and outline the epic planning backlog hierarchy.",
      assignee: "Product Agent",
      status: "pending",
      progress: 0,
      dependencies: [],
    },
    {
      id: "t-2",
      epicId: "epic-scope",
      name: "Audit Regulatory Conformity & Compliance",
      description: "Examine potential regulatory risk, trademark availability, and draft clear structural compliance constraints.",
      assignee: "Legal Agent",
      status: "pending",
      progress: 0,
      dependencies: ["t-1"],
    },
    {
      id: "t-3",
      epicId: "epic-dev",
      name: "Craft Scalable Database Models & API Schema",
      description: "Implement structural entity relationship models, index structures, and secure server routes.",
      assignee: "Coding Agent",
      status: "pending",
      progress: 0,
      dependencies: ["t-2"],
    },
    {
      id: "t-4",
      epicId: "epic-dev",
      name: "Verify Sanitization, Shields & API Secret Guards",
      description: "Integrate automatic payload filters, detect prompt injection templates, and scrub visible secrets.",
      assignee: "Security Agent",
      status: "pending",
      progress: 0,
      dependencies: ["t-3"],
    },
    {
      id: "t-5",
      epicId: "epic-scale",
      name: "Formulate Subscription Billing Tiers & Stripe Maps",
      description: "Calculate unit resource pricing models and formulate tiered monetization paths.",
      assignee: "Finance Agent",
      status: "pending",
      progress: 0,
      dependencies: ["t-4"],
    },
    {
      id: "t-6",
      epicId: "epic-scale",
      name: "Construct Continuous CI Actions & Deploy Container",
      description: "Configure optimize bundles, test suite verification, and compile build bundles.",
      assignee: "DevOps Agent",
      status: "pending",
      progress: 0,
      dependencies: ["t-5"],
    },
  ];

  return { epics: mockEpics, tasks: mockTasks };
}

// Simulates a debate between specialized agents about a task using Gemini
export async function simulateAgentDebate(
  objective: string,
  taskName: string,
  agentA: string,
  agentB: string
): Promise<{ dialogue: { speaker: string; text: string }[]; consensus: string }> {
  try {
    const prompt = `We are operating in an Enterprise Multi-Agent Operating System executing a core mission.
Main Objective: "${objective}"
Active Task Challenged: "${taskName}"

We are conducting an intense, staff-level technical debate between two specialized agents to resolve implementation strategy:
- Agent A: ${agentA} (${AGENT_REGISTRY[agentA]?.specialty || "Specialist"})
- Agent B: ${agentB} (${AGENT_REGISTRY[agentB]?.specialty || "Specialist"})

Provide a structured debate of exactly 4-5 conversational turns, followed by a final strategic consensus report.
Return the response strictly as a JSON object matching this schema:
{
  "dialogue": [
    { "speaker": "${agentA}", "text": "Intelligent debate contribution detailing concerns, costs, or patterns." },
    { "speaker": "${agentB}", "text": "Rebuttal outlining optimal alternatives, safety guardrails, or code paths." }
  ],
  "consensus": "Polished consensus strategy outlining exactly how the system will proceed to minimize cost and maximize reliability."
}

Do not return any markdown beside parseable JSON.`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Gemini agent debate failed", e);
    return {
      dialogue: [
        {
          speaker: agentA,
          text: `Reviewing task: ${taskName}. I must emphasize robust standard procedures, optimal modularity, and thorough integration checkpoints. We cannot take shortcuts on unit coverage.`,
        },
        {
          speaker: agentB,
          text: `Agreed, but we must optimize for latency and transaction cost. Standardizing our REST endpoints and pruning legacy schemas is the fastest route to scale.`,
        },
        {
          speaker: agentA,
          text: `We must also evaluate safety policies. Making sure our input filters scrub potential prompt injection patterns is critical before the DevOps agent launches on Cloud Run.`,
        },
      ],
      consensus: `Combine robust unit validations with high-performance serialization pipelines, and implement a dedicated request-sanitization guard pattern at the API layer.`,
    };
  }
}

// Executes a core agent step, producing rich details, tools execution and safety metrics
export async function executeAgentStep(
  objective: string,
  epicName: string,
  task: Task
): Promise<{
  reasoning: string[];
  selfCritique: string;
  toolInvocations: { tool: string; command: string; result: string }[];
  safetyLog: { check: string; status: "safe" | "flagged"; comment: string }[];
  metricLogs: { latency: number; tokens: number; cost: number; hallucination: number };
  memoryAcquired: string[];
  approvalRequest?: { actionType: string; title: string; payload: Record<string, unknown> | null };
}> {
  const agent = task.assignee;
  const registryInfo = AGENT_REGISTRY[agent] || AGENT_REGISTRY["Coding Agent"];

  try {
    const prompt = `You are running inside an Enterprise Multi-Agent Operating System.
Mission Objective: "${objective}"
Active Epic Context: "${epicName}"
Target Task to Execute: "${task.name}" (Description: "${task.description}")
Agent Executing: ${agent} (Specialty: "${registryInfo.specialty}")

Autonomously simulate a production-grade execution step. Determine:
1. Inner thought process (step-by-step reasoning / Tree of thought - list of 3 items).
2. Honest self critique pointing out any performance bottlenecks or structural gaps.
3. Relevant Tool Invocations. MUST simulate 1 realistic professional tool interaction (e.g. Git checkouts, Web search for frameworks, DB query setup, file writes, Slack notification post).
4. Safety assessment (checking for injection, secret exposure, PII).
5. Memories captured for long-term vector indexing (2 items).
6. State if this action requires human-in-the-loop approval. Critical human feedback is MANDATORY for actions like: Deployment, Payments, Deletion of database stores, Legal drafts, Email send. If so, specify the approval payload.

Return the response strictly as a JSON object matching this schema:
{
  "reasoning": [
    "Step 1 thought: analyzing inputs...",
    "Step 2 thought: evaluating technical routes...",
    "Step 3 thought: resolving core output..."
  ],
  "selfCritique": "Adversarial evaluation of this design choice.",
  "toolInvocations": [
    { "tool": "Git / DB / REST / Web Search", "command": "specific terminal command or function", "result": "detailed raw execution response" }
  ],
  "safetyLog": [
    { "check": "Injection shield / Secret Masking / PII Check", "status": "safe", "comment": "Description of safety validation" }
  ],
  "metricLogs": {
    "latency": 350, // in milliseconds
    "tokens": 4500, // prompt + output tokens
    "cost": 0.0067, // cost in USD
    "hallucination": 0.5 // score between 0.0 and 5.0 (low is better, representing factuality check)
  },
  "memoryAcquired": [
    "Long term association memory item 1",
    "Long term association memory item 2"
  ],
  "requiresApproval": false, // boolean
  "approvalRequest": { // Optional, only define if requiresApproval is true
    "actionType": "payment / deployment / db_update / legal_action / email_send",
    "title": "Clear action label requiring verification",
    "payload": { "details": "contextual verification info requiring human check" }
  }
}

Do not return any markdown beside parseable JSON.`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      reasoning: parsed.reasoning || ["Parsed inputs and contextual limits", "Formulated task blueprint", "Generated sandbox execution output"],
      selfCritique: parsed.selfCritique || "Need to optimize cache hits for compiled dependencies.",
      toolInvocations: parsed.toolInvocations || [
        { tool: "File System", command: "cat src/routes.ts", result: "Successfully resolved router module bindings" },
      ],
      safetyLog: parsed.safetyLog || [{ check: "Secret Guard", status: "safe", comment: "No API keys or system secrets detected in payload" }],
      metricLogs: parsed.metricLogs || { latency: 280, tokens: 2400, cost: 0.0036, hallucination: 0.1 },
      memoryAcquired: parsed.memoryAcquired || [`${agent} finished ${task.name}`],
      approvalRequest: parsed.requiresApproval ? parsed.approvalRequest : undefined,
    };
  } catch (e) {
    console.error("Gemini task execution simulation failed", e);

    // Fallback based on Agent specialty
    const isDangerous = ["Legal Agent", "Finance Agent", "DevOps Agent"].includes(agent) || task.name.toLowerCase().includes("deploy") || task.name.toLowerCase().includes("payment");
    const mockApproval = isDangerous
      ? {
          actionType: agent === "Finance Agent" ? "payment" : agent === "DevOps Agent" ? "deployment" : "legal_action",
          title: `Authorize ${agent} Execute Request`,
          payload: { task: task.name, costLimit: "$250.00", targetZone: "Production Deployment Stage" },
        }
      : undefined;

    return {
      reasoning: [
        "Consulted agent cognitive context mappings.",
        "Constructed structural output aligning with task parameters.",
        "Sanitized compilation boundaries for modular export.",
      ],
      selfCritique: "Task resolved cleanly, though streaming performance on heavy payloads could be throttled.",
      toolInvocations: [
        {
          tool: agent === "Research Agent" ? "Web Search" : agent === "Coding Agent" ? "File System" : "Rest API",
          command: agent === "Research Agent" ? "search: angular 21 zoneless patterns" : "write: src/models/core.ts",
          result: "Command executed successfully inside sandbox context.",
        },
      ],
      safetyLog: [
        { check: "PII Sanitization Check", status: "safe", comment: "Scrubbed identifiers from sandbox telemetry trace." },
        { check: "Payload Shield", status: "safe", comment: "Filtered malicious tags successfully." },
      ],
      metricLogs: {
        latency: 420,
        tokens: 3100,
        cost: 0.0046,
        hallucination: 0.2,
      },
      memoryAcquired: [
        `Executed milestone step ${task.name} with reliable execution performance.`,
        `Preserved architectural blueprint guidelines inside project contextual history.`,
      ],
      approvalRequest: mockApproval,
    };
  }
}

export async function generateAutonomousMissionResult(
  goal: string,
  industry: string,
  outputType: string,
  priority: string
): Promise<{
  conversations: AutonomousConversation[];
  safetyChecks: SafetyCheck[];
  report: FinalReport;
}> {
  const prompt = `You are the ultimate Orchestrator Agent of Aetheris OS. An autonomous multi-agent task is requested.
Context:
- Strategic Goal: "${goal}"
- Industry Vertical: "${industry}"
- Intended Deliverable Format: "${outputType}"
- Strategic Urgency Priority: "${priority}"

Simulate a collaborative discussion between 10 specialist agents to execute this goal:
CEO Agent, Research Agent, Product Agent, UI/UX Agent, Coding Agent, Marketing Agent, Finance Agent, Legal Agent, Critic Agent, Safety Agent.

We need three outputs:
1. An agent debate/discussing transcript (at least 6-8 turns) where:
- Product, UI/UX, or Coding agents propose strategies.
- Critic Agent raises specific objections or highlights potential execution bottlenecks.
- Other agents suggest alternatives (e.g. Marketing on target audiences, Finance on pricing, Legal on regulatory compliance).
- Safety Agent inspects vulnerabilities.
- A final decision consensus is formulated by the CEO Agent.

2. A strict Safety Audit check covering:
- harmful content
- legal risk
- false claims
- privacy issues
- missing assumptions

3. A highly detailed, professional Final Mission Report containing:
- Problem analysis
- Market research
- Product plan
- MVP feature list (array of items)
- UI/UX direction
- Backend architecture
- Monetization strategy
- Risk analysis
- Launch plan
- Next 7-day action plan (array of items)

Please return this strictly as a JSON object matching this schema:
{
  "conversations": [
    { "id": "conv-1", "speaker": "CEO Agent", "text": "...", "type": "argument" },
    { "id": "conv-2", "speaker": "Research Agent", "text": "...", "type": "suggestion" },
    { "id": "conv-3", "speaker": "Critic Agent", "text": "...", "type": "objection" }
  ],
  "safetyChecks": [
    { "check": "harmful content check", "status": "safe", "comment": "..." },
    { "check": "legal risk check", "status": "safe", "comment": "..." }
  ],
  "report": {
    "problemAnalysis": "Highly detailed text...",
    "marketResearch": "Highly detailed text...",
    "productPlan": "...",
    "mvpFeatures": ["Feature 1", "Feature 2"],
    "uiUxDirection": "...",
    "backendArchitecture": "...",
    "monetizationStrategy": "...",
    "riskAnalysis": "...",
    "launchPlan": "...",
    "next7DaysPlan": ["Day 1: ...", "Day 2: ..."]
  }
}
Do not return any markdown besides parseable JSON.`;

  try {
    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    if (parsed.conversations && parsed.safetyChecks && parsed.report) {
      return parsed;
    }
    throw new Error("Invalid output structure from Gemini");
  } catch (e) {
    console.warn("Gemini Autonomous generation failed, applying custom dynamic fallback:", e);
    
    const fallbackData = getLocalFallbackReport(goal, industry);
    return {
      conversations: getLocalFallbackConversations(goal, industry, outputType, priority),
      safetyChecks: fallbackData.safetyChecks,
      report: fallbackData.report
    };
  }
}

export function getLocalFallbackConversations(
  goal: string,
  industry: string,
  outputType: string,
  priority: string
): AutonomousConversation[] {
  return [
    {
      id: "c1",
      speaker: "CEO Agent",
      text: `Operators, we are initiating Autonomous Mission Mode on industry vertical [${industry}] with priority level [${priority}]. Our target deliverable is to formulate: ${outputType} matching user goal: "${goal}". Let's begin planning.`,
      type: "argument" as const
    },
    {
      id: "c2",
      speaker: "Research Agent",
      text: `Understood, Chief. Initial competitive scans on the ${industry} market reveal high fragmentation. Our competitive edge lies in leveraging automation to execute the value drivers behind "${goal}".`,
      type: "suggestion" as const
    },
    {
      id: "c3",
      speaker: "Product Agent",
      text: `Agreed. We must isolate a singular wedge problem to target first. The core product plan is to create a sleek, intuitive solution that simplifies workflows for our users.`,
      type: "suggestion" as const
    },
    {
      id: "c4",
      speaker: "Critic Agent",
      text: `Hold on. That product plan is extremely broad. What about user inertia? A lot of traditional incumbents in ${industry} have high lock-in. If we don't have a specific Hook, users won't switch.`,
      type: "objection" as const
    },
    {
      id: "c5",
      speaker: "UI/UX Agent",
      text: `Excellent point by the Critic. To counter user inertia, we must focus on absolute cognitive ease. We will architect a glassmorphic dashboard featuring a telemetry HUD, responsive cyan glows, and zero nested settings pages. Speed is our primary user retention metric.`,
      type: "suggestion" as const
    },
    {
      id: "c6",
      speaker: "Coding Agent",
      text: `Technically, a zoneless architecture aligned with modern API streaming routes will ensure ultra-low latency. We can organize the backend around serverless cloud runtime instances with real-time vector caches.`,
      type: "argument" as const
    },
    {
      id: "c7",
      speaker: "Marketing Agent",
      text: `For the GTM roadmap, we will launch a private beta, branding the product as an advanced Elite Operating System for ${industry}. This exclusivity will build massive traction among top decision makers.`,
      type: "suggestion" as const
    },
    {
      id: "c8",
      speaker: "Finance Agent",
      text: `Let's keep monetization tiered: a clean utility-based model ($29/user/month for professional level) and an custom enterprise volume pricing SLA to lock in high-ticket accounts.`,
      type: "suggestion" as const
    },
    {
      id: "c9",
      speaker: "Legal Agent",
      text: `From a systems regulatory perspective, we must ensure sandboxed processing of telemetry and full alignment with data privacy mandates like GDPR and CCPA.`,
      type: "critique" as const
    },
    {
      id: "c10",
      speaker: "Safety Agent",
      text: `Safety audits complete. No adversarial data patterns or leakage hazards found. The systems context looks safe and validated for compliance.`,
      type: "decision" as const
    },
    {
      id: "c12",
      speaker: "CEO Agent",
      text: `Superb alignment team. Under Critic Agent's suggestions, we have fortified our GTM Hook. Coding Agent's serverless vector caches are approved. Let's output the Final Mission Execution Blueprint.`,
      type: "decision" as const
    }
  ];
}

export function getLocalFallbackReport(
  goal: string,
  industry: string
): { safetyChecks: SafetyCheck[]; report: FinalReport } {
  return {
    safetyChecks: [
      {
        check: "Harmful Content Audit",
        status: "safe" as const,
        comment: "Checked objective text inputs against structural toxicity classification guidelines. Passed completely."
      },
      {
        check: "Corporate Legal Risks",
        status: "safe" as const,
        comment: `Evaluated structural models against compliance guides for the ${industry} vertical. Confirmed zero compliance breach items.`
      },
      {
        check: "False Claims Assessment",
        status: "safe" as const,
        comment: "Investigated technical viability performance. Projections of execution timeline conform to current benchmark limitations."
      },
      {
        check: "User Privacy & Security Shield",
        status: "safe" as const,
        comment: "Data parameters are sandboxed completely. No active PII stored or leaked in state telemetry vectors."
      },
      {
        check: "Assumptions Validation Probe",
        status: "safe" as const,
        comment: "Critic agent audit confirms that all claims are backed by structured reasoning and competitive telemetry metrics."
      }
    ],
    report: {
      problemAnalysis: `The ${industry} industry current landscape is heavily plagued by high friction, slow reaction latency, and archaic legacy interfaces. Users aiming to realize "${goal}" struggle with manual overhead, lack of live observability, and fragmented datasets. By utilizing cognitive automation, we bypass these blockers completely.`,
      marketResearch: `Competitive mapping indicates that while several incumbents provide raw database access, none offer a cohesive autonomous orchestrator tailored for ${industry}. Market growth trends indicate a 24.8% CAGR in intelligent systems, representing a major multi-million dollar blue-ocean target for early movers.`,
      productPlan: `Our primary thesis is an elite, high-touch Operating Objective to fulfill "${goal}". The application will stream live execution timelines across specialized cognitive agent grids, eliminating traditional multi-tool fatigue.`,
      mvpFeatures: [
        "Responsive multi-agent HUD console with cyan glow aesthetics",
        "One-click autonomous prompt formulation and planning compiler",
        "Agent discussion network with live objection and suggestion transcript loggers",
        "Comprehensive safety audit board mapping content, compliance, and privacy issues"
      ],
      uiUxDirection: `An executive dark web console mimicking premium terminal HUDs. Utilizing generous negative space, glassmorphism panels with 16px backdrops, and glowing cyan cues to guide priority attention. All key interactive items are coupled with elegant material icons.`,
      backendArchitecture: `Fully decoupled Node/Express backend coordinating real-time SSE threads and serverless API proxy relays. Core AI computation leverages the @google/genai TypeScript SDK, utilizing memory caches and persistent storage databases.`,
      monetizationStrategy: `Subscribers receive access via a tiered SaaS model: Professional tier at $29/month featuring unlimited agent execution tasks, and an Enterprise custom volume SLA.`,
      riskAnalysis: `Primary risk is competitive reaction from generic AI products. We mitigate this by anchoring our core logic around robust long-term semantic memorization indexes and customized local RAG contexts.`,
      launchPlan: `A phased 3-stage private beta roll-out targeting top-tier product creators, followed by full product release on developer marketplaces with rich documentation.`,
      next7DaysPlan: [
        "Day 1: Initialize the glassmorphic executive HUD interface and theme colors.",
        "Day 2: Construct Express endpoint routing to coordinate sequential agent step simulators.",
        "Day 3: Integrate Gemini API calling prompts with robust dynamic fallbacks.",
        "Day 4: Implement live chronological conversation log components.",
        "Day 5: Inject deep RAG ingestion guides matching industry specifications.",
        "Day 6: Conduct safety stress testing to audit toxic, privacy, or leak patterns.",
        "Day 7: Launch public beta and monitor real-time latency telemetry charts."
      ]
    }
  };
}
