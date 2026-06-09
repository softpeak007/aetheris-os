import { ChangeDetectionStrategy, Component, signal, effect, computed, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";

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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-root",
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: "./app.html",
  styleUrl: "./app.css",
})
export class App implements OnDestroy {
  // Application State Signals
  appState = signal<DBState | null>(null);
  activeTab = signal<string>("mission-control");
  activeMissionMode = signal<string>("autonomous");
  isLoading = signal<boolean>(false);
  isStepping = signal<boolean>(false);
  isAutoStepping = signal<boolean>(false);
  isAutoSteppingAutonomous = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  uploadSuccess = signal<string | null>(null);
  activeWorkflowId = signal<string>("wf-software");

  // Phase 2 Presentation, History & Exports
  slideIndex = signal<number>(0);
  isInvestorMode = signal<boolean>(false);
  selectedHistoryMission = signal<MissionHistoryItem | null>(null);

  // Filtering logs / memory
  logFilter = signal<string>("all");
  memorySearchForm = new FormGroup({
    query: new FormControl(""),
  });

  // Reactive Forms with custom validations
  missionForm = new FormGroup({
    objective: new FormControl("", [Validators.required, Validators.minLength(5)]),
  });

  autonomousForm = new FormGroup({
    goal: new FormControl("", [Validators.required, Validators.minLength(5)]),
    industry: new FormControl("Tech"),
    outputType: new FormControl("MVP Specs"),
    priority: new FormControl("Medium"),
  });

  ragForm = new FormGroup({
    filename: new FormControl("", [Validators.required]),
    content: new FormControl("", [Validators.required, Validators.minLength(10)]),
    type: new FormControl("text/plain"),
  });

  memoryForm = new FormGroup({
    text: new FormControl("", [Validators.required, Validators.minLength(4)]),
    type: new FormControl("episodic"),
    tagsCsv: new FormControl("custom, manual"),
  });

  // Automatically trigger polling or periodic stepping when autoStep is toggled
  private autoInterval: ReturnType<typeof setInterval> | null = null;
  private autonomousInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.refreshState();

    // Effect to handle Auto-stepping interval loop
    effect(() => {
      const autoOn = this.isAutoStepping();
      if (autoOn) {
        this.startAutoStepLoop();
      } else {
        this.stopAutoStepLoop();
      }
    });

    effect(() => {
      const autoOn = this.isAutoSteppingAutonomous();
      if (autoOn) {
        this.startAutonomousStepLoop();
      } else {
        this.stopAutonomousStepLoop();
      }
    });
  }

  // Type-safe exception getter helper
  private getErrMsg(err: unknown): string {
    if (err && typeof err === "object" && "message" in err) {
      return String((err as { message: unknown }).message);
    }
    return String(err);
  }

  // Safe Fetch & JSON parse wrapper
  private async safeFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, options);
    
    let isJson = false;
    const contentType = res.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      isJson = true;
    }
    
    let data: unknown;
    if (isJson) {
      try {
        data = await res.json();
      } catch {
        throw new Error("Unable to parse a valid JSON response from the backend.");
      }
    } else {
      const text = await res.text();
      throw new Error(text || `Request failed with HTTP status code ${res.status}`);
    }
    
    if (!res.ok) {
      throw new Error(data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `Request failed with status ${res.status}`);
    }
    
    return data as T;
  }

  // Fetch full system state from Express
  async refreshState(): Promise<void> {
    try {
      this.errorMessage.set(null);
      const data = await this.safeFetch<DBState>("/api/agent-state");
      this.appState.set(data);
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrMsg(err));
    }
  }

  // Initialize a new mission (starts dynamic planning engine via Gemini)
  async startMission(): Promise<void> {
    if (this.missionForm.invalid) return;
    const objective = this.missionForm.get("objective")?.value || "";

    try {
      this.isLoading.set(true);
      this.errorMessage.set(null);
      
      const data = await this.safeFetch<DBState>("/api/init-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
      });

      this.appState.set(data);
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrMsg(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  // Execute a single task step sequentially
  async stepMission(): Promise<void> {
    const currentState = this.appState();
    if (!currentState || currentState.missionStatus !== "running" || this.isStepping()) return;

    try {
      this.isStepping.set(true);
      this.errorMessage.set(null);

      const data = await this.safeFetch<DBState>("/api/step-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      this.appState.set(data);
      
      // If we see execution complete, automatically stop autostepping
      if (data.missionStatus === "completed") {
        this.isAutoStepping.set(false);
      }
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrMsg(err));
      this.isAutoStepping.set(false); // Stop loop on error
    } finally {
      this.isStepping.set(false);
    }
  }

  // Clear specific human clearances
  async solveApproval(id: string, approved: boolean): Promise<void> {
    try {
      this.errorMessage.set(null);
      const data = await this.safeFetch<DBState>("/api/submit-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approved }),
      });

      this.appState.set(data);
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrMsg(err));
    }
  }

  // Ingest manual text or structure to RAG Engine
  async submitRAG(): Promise<void> {
    if (this.ragForm.invalid) return;
    const body = this.ragForm.value;

    try {
      this.isLoading.set(true);
      await this.safeFetch<{ success: boolean; doc: unknown }>("/api/rag/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      this.uploadSuccess.set(`Successfully ingested document "${body.filename || ''}" into dynamic RAG indexes.`);
      this.ragForm.reset({ type: "text/plain" });
      await this.refreshState();

      // Clear layout notification after 5 seconds
      setTimeout(() => this.uploadSuccess.set(null), 5000);
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrMsg(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  // Manual cognitive memory insertion
  async submitMemory(): Promise<void> {
    if (this.memoryForm.invalid) return;
    const { text, type, tagsCsv } = this.memoryForm.value;
    const tags = (tagsCsv || "").split(",").map((t) => t.trim()).filter((t) => t.length > 0);

    try {
      this.isLoading.set(true);
      await this.safeFetch<unknown>("/api/memories/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type, tags }),
      });

      this.memoryForm.reset({ type: "episodic", tagsCsv: "custom, manual" });
      await this.refreshState();
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrMsg(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  // Wipe vector memory index
  async clearMemories(): Promise<void> {
    try {
      await this.safeFetch<{ success: boolean }>("/api/memories/clear", { method: "POST" });
      await this.refreshState();
      this.uploadSuccess.set("Long-term semantic ledger cleared successfully.");
      setTimeout(() => this.uploadSuccess.set(null), 4000);
    } catch {
      this.errorMessage.set("Purging memory ledger failed.");
    }
  }

  // Reboot / reset OS State
  async resetSystem(): Promise<void> {
    this.isAutoStepping.set(false);
    this.isAutoSteppingAutonomous.set(false);
    try {
      const state = await this.safeFetch<DBState>("/api/reset", { method: "POST" });
      this.appState.set(state);
      this.missionForm.reset();
      this.autonomousForm.reset({
        goal: "",
        industry: "Tech",
        outputType: "MVP Specs",
        priority: "Medium"
      });
      this.uploadSuccess.set("Aetheris System Reboot complete. Real-time buffers flushed.");
      setTimeout(() => this.uploadSuccess.set(null), 4000);
    } catch {
      this.errorMessage.set("Operation reset pipeline crashed.");
    }
  }

  // Auto-Step Subengine timers
  toggleAutoStep(): void {
    const current = this.isAutoStepping();
    this.isAutoStepping.set(!current);
  }

  private startAutoStepLoop(): void {
    if (this.autoInterval) clearInterval(this.autoInterval);
    // Runs step every 1.2 seconds for snappy real-time presentation
    this.autoInterval = setInterval(() => {
      const current = this.appState();
      if (current && current.missionStatus === "running") {
        const hasApprovalRequired = current.tasks.some((t) => t.status === "approval_required");
        if (hasApprovalRequired) {
          // Pause execution, wait for human operator
          this.isAutoStepping.set(false);
          return;
        }
        this.stepMission();
      } else {
        this.isAutoStepping.set(false);
      }
    }, 1200);
  }

  private stopAutoStepLoop(): void {
    if (this.autoInterval) {
      clearInterval(this.autoInterval);
      this.autoInterval = null;
    }
  }

  // Trigger Autonomous Mission Mode initialization
  async startAutonomousMission(): Promise<void> {
    if (this.autonomousForm.invalid) return;
    const body = this.autonomousForm.value;

    try {
      this.isLoading.set(true);
      this.errorMessage.set(null);

      const data = await this.safeFetch<DBState>("/api/autonomous/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      this.appState.set(data);
      // Auto-step immediately!
      this.isAutoSteppingAutonomous.set(true);
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrMsg(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  // Manually step single agent in Autonomous Grid
  async stepAutonomousMission(): Promise<void> {
    const current = this.appState();
    if (!current || !current.autonomousMission || this.isStepping()) return;

    try {
      this.isStepping.set(true);
      this.errorMessage.set(null);

      const data = await this.safeFetch<DBState>("/api/autonomous/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      this.appState.set(data);

      if (data.autonomousMission?.status === "safety_checking") {
        this.isAutoSteppingAutonomous.set(false); // Pause auto ticks
        
        setTimeout(() => {
          this.completeAutonomousSafety();
        }, 250);
      }
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrMsg(err));
      this.isAutoSteppingAutonomous.set(false);
    } finally {
      this.isStepping.set(false);
    }
  }

  // Complete safety guidelines audit and publish output summary
  async completeAutonomousSafety(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.errorMessage.set(null);

      const data = await this.safeFetch<DBState>("/api/autonomous/complete-safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      this.appState.set(data);
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrMsg(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  // Flush autonomous settings back to factory default
  async resetAutonomousMission(): Promise<void> {
    this.isAutoSteppingAutonomous.set(false);
    try {
      this.isLoading.set(true);
      this.errorMessage.set(null);

      const data = await this.safeFetch<DBState>("/api/autonomous/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      this.appState.set(data);
      this.autonomousForm.reset({
        goal: "",
        industry: "Tech",
        outputType: "MVP Specs",
        priority: "Medium"
      });
      this.uploadSuccess.set("Autonomous simulation reset completed.");
      setTimeout(() => this.uploadSuccess.set(null), 3000);
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrMsg(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  // Toggle auto stepping interval inside grid
  toggleAutoStepAutonomous(): void {
    const current = this.isAutoSteppingAutonomous();
    this.isAutoSteppingAutonomous.set(!current);
  }

  // Interval loop handlers for autonomous
  private startAutonomousStepLoop(): void {
    if (this.autonomousInterval) clearInterval(this.autonomousInterval);
    this.autonomousInterval = setInterval(() => {
      const current = this.appState();
      if (current && current.autonomousMission && current.autonomousMission.status === "running") {
        this.stepAutonomousMission();
      } else {
        this.isAutoSteppingAutonomous.set(false);
      }
    }, 1100);
  }

  private stopAutonomousStepLoop(): void {
    if (this.autonomousInterval) {
      clearInterval(this.autonomousInterval);
      this.autonomousInterval = null;
    }
  }

  /**
   * Computed Signals helper lists
   */

  // Filtered logs
  filteredLogs = computed(() => {
    const s = this.appState();
    if (!s) return [];
    const filter = this.logFilter();
    if (filter === "all") return s.logs;
    
    // Custom filter matches
    if (filter === "debates") {
      return s.logs.filter((l) => l.type === "debate" || l.type === "critique");
    }
    if (filter === "tools") {
      return s.logs.filter((l) => l.type === "tool");
    }
    if (filter === "safety") {
      return s.logs.filter((l) => l.type === "safety");
    }
    return s.logs.filter((l) => l.type === filter);
  });

  // Active executing task
  activeExecutingTask = computed(() => {
    const s = this.appState();
    if (!s) return null;
    return s.tasks.find((t) => t.status === "active" || t.status === "approval_required") || null;
  });

  // Total calculated budgets
  avgLatency = computed(() => {
    const s = this.appState();
    if (!s || s.metrics.latency.length === 0) return 0;
    const sum = s.metrics.latency.reduce((a, b) => a + b, 0);
    return Math.round(sum / s.metrics.latency.length);
  });

  // Registry Agent List
  agentKeys = Object.keys({
    "CEO Agent": 1, "Research Agent": 1, "Planning Agent": 1, "Coding Agent": 1,
    "UI/UX Agent": 1, "Product Agent": 1, "Marketing Agent": 1, "Finance Agent": 1,
    "Legal Agent": 1, "Security Agent": 1, "RAG Agent": 1, "Memory Agent": 1,
    "Testing Agent": 1, "DevOps Agent": 1, "Analytics Agent": 1, "Documentation Agent": 1,
    "Critic Agent": 1, "Reflection Agent": 1, "Scheduler Agent": 1, "Notification Agent": 1,
  });

  getAgentMeta(agentName: string) {
    const defaultMeta = { icon: "smart_toy", color: "slate", specialty: "Technical execution Specialist." };
    const REGISTRY: Record<string, typeof defaultMeta> = {
      "CEO Agent": { icon: "crown", color: "amber", specialty: "Milestone planning, subprocess delegation, intent verification." },
      "Research Agent": { icon: "search", color: "sky", specialty: "Technical package inspection, API verification, market lookup." },
      "Planning Agent": { icon: "map", color: "cyan", specialty: "Blueprint mapping, milestone decomposition, dependencies checking." },
      "Coding Agent": { icon: "code", color: "emerald", specialty: "Modular Angular typescript modules compiling, algorithms optimization." },
      "UI/UX Agent": { icon: "palette", color: "rose", specialty: "Frictionless layouts, semantic contrast pairing, responsive scales." },
      "Product Agent": { icon: "token", color: "purple", specialty: "User story definition, MVP parameter scaling, functional criteria check." },
      "Marketing Agent": { icon: "campaign", color: "indigo", specialty: "GTM optimization, visual landing texts, newsletter drafting." },
      "Finance Agent": { icon: "payments", color: "lime", specialty: "SaaS model calculation, Stripe gateways maps, unit billing checks." },
      "Legal Agent": { icon: "gavel", color: "orange", specialty: "Regulatory compliance analysis, terms drafts, trademark safety." },
      "Security Agent": { icon: "shield", color: "red", specialty: "Payload injection protection, secret scrubbing, PII shielding." },
      "RAG Agent": { icon: "folder_shared", color: "teal", specialty: "Text sliding chunks formulations, knowledge index matching." },
      "Memory Agent": { icon: "psychology", color: "fuchsia", specialty: " Episodic correlation indexing, vector decays, semantic ranking." },
      "Testing Agent": { icon: "bug_report", color: "amber", specialty: "Defect validation, multi-user concurrency stress tests drafts." },
      "DevOps Agent": { icon: "dns", color: "slate", specialty: "Continuous deployment container scaling, Cloud Run configurations." },
      "Analytics Agent": { icon: "bar_chart", color: "amber", specialty: "Cost computations, execution timelines charts, CPU metrics." },
      "Documentation Agent": { icon: "description", color: "blue", specialty: "PRD design, Swagger REST API schemas, manuals formulating." },
      "Critic Agent": { icon: "rate_review", color: "violet", specialty: "Adversarial critique, functional gap detection, polishing checks." },
      "Reflection Agent": { icon: "auto_awesome", color: "pink", specialty: "Process corrections, prompt adjust strategies, self auditing." },
      "Scheduler Agent": { icon: "schedule", color: "sky", specialty: "Automation loops, cron triggers tracking, delays timers." },
      "Notification Agent": { icon: "notifications", color: "yellow", specialty: "Slack hooks integration, dispatching visual alerts, emails relays." },
    };
    return REGISTRY[agentName] || defaultMeta;
  }

  getAgentHealth(agentName: string): string {
    const s = this.appState();
    if (!s) return "healthy";
    return s.metrics.agentHealth[agentName] || "healthy";
  }

  // Active selected workflow structure
  selectedWorkflow = computed(() => {
    const s = this.appState();
    if (!s) return null;
    return s.workflows.find((w) => w.id === this.activeWorkflowId()) || s.workflows[0];
  });

  // Handle files dropped or input selected manually on RAG
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    
    // Read text file
    const reader = new FileReader();
    reader.onload = () => {
      this.ragForm.patchValue({
        filename: file.name,
        content: String(reader.result),
        type: file.type || "text/plain",
      });
    };
    reader.readAsText(file);
  }

  // Inject a prompt template from presets to speed up operations
  applyPresetObjective(preset: string): void {
    this.missionForm.patchValue({ objective: preset });
  }

  // Quick helper to replace standard regex templates
  replaceUnderscores(val: string): string {
    return val.split("_").join(" ");
  }

  // Demo Mode triggering
  async runDemoMission(demoKey: "study" | "saas" | "local"): Promise<void> {
    this.isInvestorMode.set(false);
    this.slideIndex.set(0);
    this.errorMessage.set(null);
    
    let goal = "";
    let industry = "";
    let priority = "";
    
    if (demoKey === "study") {
      goal = "Develop an AI-powered personalized study application with speech-to-text summaries, spaced repetition calendars, and customizable flashcards.";
      industry = "Education";
      priority = "High";
    } else if (demoKey === "saas") {
      goal = "Deploy a continuous cloud auditing system with sandboxed malware execution tracing, zero-trust perimeter logging, and dynamic SQL injection firewalls.";
      industry = "Tech";
      priority = "High";
    } else if (demoKey === "local") {
      goal = "Build an automated CRM scheduling hub for local plumbers and electrical engineers with twilio integrations, drag-and-drop calendars, and automatic invoice generation.";
      industry = "E-Commerce";
      priority = "Medium";
    }
    
    // Switch tabs & modes
    this.activeTab.set("mission-control");
    this.activeMissionMode.set("autonomous");
    
    this.autonomousForm.patchValue({
      goal,
      industry,
      outputType: "MVP Specs",
      priority
    });
    
    // Call run autonomous mission immediately
    await this.startAutonomousMission();
  }

  // Open Legacy Mission Fetcher
  async openHistoryMission(item: MissionHistoryItem): Promise<void> {
    try {
      this.isLoading.set(true);
      this.errorMessage.set(null);
      const data = await this.safeFetch<DBState>("/api/history/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id })
      });
      this.appState.set(data);
      this.activeTab.set("mission-control");
      this.isInvestorMode.set(false);
      this.slideIndex.set(0);
    } catch (err) {
      this.errorMessage.set(this.getErrMsg(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  // Delete History Record
  async deleteHistoryMission(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      this.isLoading.set(true);
      const data = await this.safeFetch<DBState>("/api/history/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      this.appState.set(data);
      if (this.selectedHistoryMission()?.id === id) {
        this.selectedHistoryMission.set(null);
      }
      this.uploadSuccess.set("Mission history item removed successfully.");
      setTimeout(() => this.uploadSuccess.set(null), 3000);
    } catch (err) {
      this.errorMessage.set(this.getErrMsg(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  // Duplicate Historical Setup
  duplicateHistoryMission(item: MissionHistoryItem, event: Event): void {
    event.stopPropagation();
    this.isInvestorMode.set(false);
    this.slideIndex.set(0);
    this.activeTab.set("mission-control");
    this.activeMissionMode.set(item.selectedEngine);
    
    if (item.selectedEngine === "autonomous") {
      this.autonomousForm.patchValue({
        goal: item.goal,
        industry: item.industry,
        priority: item.priority,
        outputType: "MVP Specs"
      });
    } else {
      this.missionForm.patchValue({
        objective: item.goal
      });
    }
    
    this.uploadSuccess.set("Mission settings successfully duplicated. Ready to launch!");
    setTimeout(() => this.uploadSuccess.set(null), 4000);
  }

  // Slide Deck Navigate
  navSlide(direction: number): void {
    const totalSlides = 9;
    const current = this.slideIndex();
    let next = current + direction;
    if (next < 0) next = totalSlides - 1;
    if (next >= totalSlides) next = 0;
    this.slideIndex.set(next);
  }

  /**
   * EXPORTS CENTER GENERATOR
   */
  private formatMissionData(mission: {
    id?: string;
    goal?: string;
    missionObjective?: string;
    industry?: string;
    priority?: string;
    selectedEngine?: "autonomous" | "standard";
    timestamp?: string;
    agentLogs?: Log[];
    safetyChecks?: SafetyCheck[];
    report?: FinalReport | null;
    tasks?: Task[];
    epics?: Epic[];
    autonomousMission?: {
      goal?: string;
      industry?: string;
      priority?: string;
      report?: FinalReport | null;
      safetyChecks?: SafetyCheck[];
    };
  }) {
    const reportVal = mission.report || (mission.autonomousMission?.report);
    const logs = mission.agentLogs || (this.appState()?.logs || []);
    const debate = logs.filter((l: Log) => l.type === "debate" || l.type === "critique")
                       .map((l: Log) => `${l.timestamp} [${l.agent}]: ${l.text}`).join("\n\n");
    const timeline = (mission.tasks || this.appState()?.tasks || []).map((t: Task) => `- Task: ${t.name} (${t.assignee}) -> Status: ${t.status}`);
    
    return {
      title: "AETHERIS OS INTEL REPORT",
      goal: mission.goal || mission.missionObjective,
      industry: mission.industry || (mission.autonomousMission?.industry || "General"),
      priority: mission.priority || (mission.autonomousMission?.priority || "Medium"),
      engine: mission.selectedEngine || (mission.autonomousMission ? "autonomous" : "standard"),
      timestamp: mission.timestamp || new Date().toISOString(),
      report: reportVal || {
        problemAnalysis: "",
        marketResearch: "",
        productPlan: "",
        mvpFeatures: [],
        uiUxDirection: "",
        backendArchitecture: "",
        monetizationStrategy: "",
        riskAnalysis: "",
        launchPlan: "",
        next7DaysPlan: []
      },
      timeline,
      debateTranscript: debate || "No specific adversarial debates were generated during this run.",
      complianceChecks: mission.safetyChecks || (mission.autonomousMission?.safetyChecks || [])
    };
  }

  openDownloadBlob(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportJson(mission: {
    id?: string;
    goal?: string;
    missionObjective?: string;
    industry?: string;
    priority?: string;
    selectedEngine?: "autonomous" | "standard";
    timestamp?: string;
    agentLogs?: Log[];
    safetyChecks?: SafetyCheck[];
    report?: FinalReport | null;
    tasks?: Task[];
    epics?: Epic[];
    autonomousMission?: {
      goal?: string;
      industry?: string;
      priority?: string;
      report?: FinalReport | null;
      safetyChecks?: SafetyCheck[];
    };
  }): void {
    const data = this.formatMissionData(mission);
    this.openDownloadBlob(JSON.stringify(data, null, 2), `aetheris_export_${mission.id || 'current'}.json`, "application/json");
    this.uploadSuccess.set("Export JSON successfully completed.");
    setTimeout(() => this.uploadSuccess.set(null), 3000);
  }

  exportMarkdown(mission: {
    id?: string;
    goal?: string;
    missionObjective?: string;
    industry?: string;
    priority?: string;
    selectedEngine?: "autonomous" | "standard";
    timestamp?: string;
    agentLogs?: Log[];
    safetyChecks?: SafetyCheck[];
    report?: FinalReport | null;
    tasks?: Task[];
    epics?: Epic[];
    autonomousMission?: {
      goal?: string;
      industry?: string;
      priority?: string;
      report?: FinalReport | null;
      safetyChecks?: SafetyCheck[];
    };
  }): void {
    const data = this.formatMissionData(mission);
    const report = data.report;
    const roadmap = report.next7DaysPlan ? report.next7DaysPlan.map((d: string, i: number) => `* **Day ${i+1}**: ${d}`).join("\n") : "None";
    const features = report.mvpFeatures ? report.mvpFeatures.map((f: string) => `* ${f}`).join("\n") : "None";
    
    const md = `# Aetheris Strategic Operating Report
**Mission Objective**: ${data.goal}
**Sector Vertical**: ${data.industry}
**Prioritization**: ${data.priority} | **Orchestrator**: ${data.engine.toUpperCase()}
**Timestamp**: ${data.timestamp}

---

## 1. Problem Statement & Strategic Gaps
${report.problemAnalysis || "No custom intelligence compiled."}

## 2. Competitive Intelligence Mapping
${report.marketResearch || "No competitive scans recorded."}

## 3. Product Vision & Implementation Specifications
${report.productPlan || "No target roadmap specs published."}

## 4. Minimum Loveable Product Features List
${features}

## 5. UI/UX Wireframe & Layout Design Systems
${report.uiUxDirection || "No design ergonomics set."}

## 6. Modular High-Contrast Technical Schema
${report.backendArchitecture || "No server schema structured."}

## 7. SaaS Tiered Monetization Plans
${report.monetizationStrategy || "No billing tiers modeled."}

## 8. Compliance Assessments & Contingency Defenses
${report.riskAnalysis || "No regulatory compliance items checked."}

## 9. Growth Execution & GTM Launch Map
${report.launchPlan || "No public launch channels calculated."}

---

## 10. Actionable 7-Day Rapid Launch Roadmap
${roadmap}

---

## 11. Security Audit Matrix
${data.complianceChecks.map((c: SafetyCheck) => `* **${c.check}**: [Status: ${c.status.toUpperCase()}] - ${c.comment}`).join("\n")}

---

## 12. Adversarial Dialogue Ledger
\`\`\`text
${data.debateTranscript}
\`\`\`
`;
    this.openDownloadBlob(md, `aetheris_export_${mission.id || 'current'}.md`, "text/markdown");
    this.uploadSuccess.set("Export MD successfully completed.");
    setTimeout(() => this.uploadSuccess.set(null), 3000);
  }

  exportHtml(mission: {
    id?: string;
    goal?: string;
    missionObjective?: string;
    industry?: string;
    priority?: string;
    selectedEngine?: "autonomous" | "standard";
    timestamp?: string;
    agentLogs?: Log[];
    safetyChecks?: SafetyCheck[];
    report?: FinalReport | null;
    tasks?: Task[];
    epics?: Epic[];
    autonomousMission?: {
      goal?: string;
      industry?: string;
      priority?: string;
      report?: FinalReport | null;
      safetyChecks?: SafetyCheck[];
    };
  }): void {
    const data = this.formatMissionData(mission);
    const report = data.report;
    const roadmap = report.next7DaysPlan ? report.next7DaysPlan.map((d: string, i: number) => `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
        <span style="font-size: 11px; font-weight: bold; color: #22d3ee; font-family: monospace;">DAY ${i+1}</span>
        <p style="font-size: 13px; margin: 5px 0 0 0; color: #cbd5e1;">${d}</p>
      </div>`).join("") : "";
    const features = report.mvpFeatures ? report.mvpFeatures.map((f: string) => `<li style="margin-bottom: 6px; color: #cbd5e1;">• ${f}</li>`).join("") : "";
    const checks = data.complianceChecks.map((c: SafetyCheck) => `
      <div style="padding: 12px; background: rgba(0,0,0,0.3); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; font-family: monospace;">
          <span style="color: #ffffff;">${c.check}</span>
          <span style="color: #34d399; background: rgba(52,211,153,0.1); padding: 2px 6px; border-radius: 4px;">${c.status.toUpperCase()}</span>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin: 6px 0 0 0;">${c.comment}</p>
      </div>`).join("");

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Aetheris Consolidated Intelligence Blueprint</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {
      background-color: #08080c;
      color: #e2e8f0;
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 40px;
    }
    .wrapper {
      max-width: 1000px;
      margin: 0 auto;
      background: #0d0d12;
      border: 1px solid rgba(34, 211, 238, 0.2);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    h1 {
      font-size: 32px;
      color: #ffffff;
      margin-top: 0;
      border-bottom: 2px solid rgba(34, 211, 238, 0.4);
      padding-bottom: 15px;
    }
    h2 {
      font-size: 20px;
      color: #22d3ee;
      margin-top: 30px;
      margin-bottom: 15px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 8px;
    }
    p, li {
      font-size: 14px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .grid {
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 20px;
    }
    .card {
      background: rgba(255,255,255,0.01);
      border: 1px solid rgba(255,255,255,0.05);
      padding: 20px;
      border-radius: 12px;
    }
    .meta-line {
      font-family: monospace;
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 20px;
    }
    .transcript {
      background: #040406;
      padding: 20px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      max-height: 350px;
      overflow-y: auto;
      white-space: pre-wrap;
      border: 1px solid rgba(255,255,255,0.05);
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <h1>Aetheris OS Executive Intelligence</h1>
    <div class="meta-line">
      Goal: ${data.goal}<br>
      Vertical Sector: ${data.industry} | Tier Priorities: ${data.priority} | Core Engine: ${data.engine.toUpperCase()}<br>
      Report Timestamp: ${data.timestamp}
    </div>

    <h2>1. Strategic Problem Gaps</h2>
    <p>${report.problemAnalysis || "No data available."}</p>

    <h2>2. Competitive Landscape scans</h2>
    <p>${report.marketResearch || "No data available."}</p>

    <h2>3. Product Concept & Thesis</h2>
    <p>${report.productPlan || "No data available."}</p>

    <div class="grid">
      <div class="card">
        <h2>4. Core MVP Feature Set</h2>
        <ul style="padding-left: 15px; margin: 0;">${features}</ul>
      </div>
      <div class="card">
        <h2>5. UI/UX Interface Directions</h2>
        <p>${report.uiUxDirection || "No data available."}</p>
      </div>
    </div>

    <h2>6. Model schema & Core Technology</h2>
    <p>${report.backendArchitecture || "No data available."}</p>

    <div class="grid">
      <div class="card">
        <h2>7. SaaS Pricing Tier structures</h2>
        <p>${report.monetizationStrategy || "No data available."}</p>
      </div>
      <div class="card">
        <h2>8. Compliance & Risks Assessment</h2>
        <p>${report.riskAnalysis || "No data available."}</p>
      </div>
    </div>

    <h2>9. Go-To-Market & Launch Roadmap</h2>
    <p>${report.launchPlan || "No data available."}</p>

    <h2>10. Immediate 7-Day Rapid Launch Roadmap</h2>
    <div style="display: grid; grid-template-cols: repeat(4, 1fr); gap: 12px; margin-top: 15px;">
      ${roadmap}
    </div>

    <h2>11. Compliance Auditing Checks</h2>
    <div>${checks}</div>

    <h2>12. Adversarial Debate Transcript Logs</h2>
    <div class="transcript">${data.debateTranscript}</div>
  </div>
</body>
</html>`;
    this.openDownloadBlob(htmlContent, `aetheris_export_${mission.id || 'current'}.html`, "text/html");
    this.uploadSuccess.set("Export HTML (PDF-Ready) successfully completed.");
    setTimeout(() => this.uploadSuccess.set(null), 3000);
  }

  copyToClipboard(mission: {
    id?: string;
    goal?: string;
    missionObjective?: string;
    industry?: string;
    priority?: string;
    selectedEngine?: "autonomous" | "standard";
    timestamp?: string;
    agentLogs?: Log[];
    safetyChecks?: SafetyCheck[];
    report?: FinalReport | null;
    tasks?: Task[];
    epics?: Epic[];
    autonomousMission?: {
      goal?: string;
      industry?: string;
      priority?: string;
      report?: FinalReport | null;
      safetyChecks?: SafetyCheck[];
    };
  }): void {
    const data = this.formatMissionData(mission);
    const report = data.report;
    const roadmap = report.next7DaysPlan ? report.next7DaysPlan.map((d: string, i: number) => `DAY ${i+1}: ${d}`).join("\n") : "None";
    const text = `
=== AETHERIS OPERATIONS INTELLIGENCE REPORT ===
Goal: ${data.goal}
Industry: ${data.industry} | Priority: ${data.priority}
Engine Type: ${data.engine.toUpperCase()}
Generated: ${data.timestamp}

1. Problem Statement:
${report.problemAnalysis || "N/A"}

2. Market Competitive Analysis:
${report.marketResearch || "N/A"}

3. Product specifications Node:
${report.productPlan || "N/A"}

4. Actionable 7-Day Schedule:
${roadmap}

5. Risk/Legal audits checked:
${data.complianceChecks.map((c: SafetyCheck) => `- ${c.check}: ${c.status.toUpperCase()} (${c.comment})`).join("\n")}
`;
    navigator.clipboard.writeText(text).then(() => {
      this.uploadSuccess.set("Intel telemetry copied successfully to clipboard!");
      setTimeout(() => this.uploadSuccess.set(null), 4500);
    }).catch(() => {
      this.errorMessage.set("Operation clipboard proxy denied access.");
    });
  }

  // Destroy auto-intervals on component unload
  ngOnDestroy(): void {
    this.stopAutoStepLoop();
    this.stopAutonomousStepLoop();
  }
}
