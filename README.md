# 🌌 Aetheris OS — Enterprise Multi-Agent AI Operating System

Aetheris OS is a next-generation, high-fidelity **Enterprise Multi-Agent Artificial Intelligence Operating System**. Built on a secure, full-stack, zoneless architecture with **Angular 21** and an **Express.js** backend, it provides continuous, collaborative, and autonomous execution pipelines powered by **Gemini 2.5 Flash / Flash-Thinking**.

Designed for rapid, high-concurrency business plan formulation, dynamic roadmap expansion, and localized compliance reviews, Aetheris OS allows a suite of specialized agents to coordinate, critique, debate, and deliver production-ready execution parameters.

---

## 🚀 Judge Quick Start (Under 60 Seconds)

Aetheris OS is optimized to deliver maximum product understanding in under a minute. 

1. **Open the Application**: Launch Aetheris OS. You will be greeted by the dark ambient sci-fi tactical UI.
2. **Access "Demo Presets"**: Scroll down the standard input pane or click the **Autonomous Grid** tab.
3. **Select a Tactical Presets Card**: Click one of the prepared quick templates:
   * **Education** (SaaS Customized Study application)
   * **Security/Tech** (Malware sandbox audits & perimeter security limits)
   * **E-Commerce/Local** (Automated scheduling calendars & TWILIO invoicing specs)
4. **Deploy the Pipeline**: Watch the multi-agent execution map automatically light up as the Planning, Product, Research, Design, and Legal agents initialize state variables, run cognitive loops, and display live conversation transcripts in real-time.
5. **Review the Intelligence Report**: Explore the comprehensive layout consisting of localized market metrics, MVP feature limits, UI/UX asset suggestions, and vulnerability mitigations.

---

## ✨ Features & Capabilities

### 1. **Dual Orchestration Engines**
* **Autonomous Grid**: A concurrent bento-styled multi-agent arena where five key agents (Planning, Research, Tech, Security, UX) execute parallel tasks, negotiate objections through live debates, check safety vulnerabilities, and publish finalized HTML, JSON, or Markdown briefings.
* **Standard Sequential Engine**: A custom human-in-the-loop task tracker where a CEO agent breaks down high-level objectives into Epics and discrete Tasks, coordinates specific developer roles, and pauses for user approval when system actions trigger sensitive operations.

### 2. **Cognitive Debate Dynamics**
Watch agents discuss tradeoffs in real-time. The **Critic Agent** audits proposed features, the **Finance Agent** evaluates unit metrics, and the **Legal Agent** drafts compliance policies. All logs are filterable by category (Debates, Tools, Safety, System) in a streamlined interface.

### 3. **Semantic RAG Engine & Embedding Context**
Upload custom text resources (knowledge bases, API specs, policy guidelines). Aetheris OS parses, chunks, and injects context directly into the agent formulation window using high-precision semantic matches.

### 4. **Episodic Memory Database**
Inspect, filter, or manually insert episodic memories and learned behaviors. Agents dynamically read, recall, and cross-reference records during execution steps.

### 5. **Interactive Data Telemetry**
Live monitors reporting token usage estimates, micro-latency trackers, dynamic agent health flags, and safety clearance checklists.

### 6. **High-Fidelity Exports Suite**
Instantly package, download, or copy completed mission reports into standard **Markdown**, clean static **HTML** documents, or serializable **JSON** structures.

---

## 🛠️ Tech Stack & Architecture

### **Front-End (Angular 21 + Tailwind CSS v4)**
* **Zoneless Signal State**: No-change-tracking overhead (`zone.js` eliminated), leveraging signals (`computed`, `signal`, `effect`) for reactive rendering and real-time state sync.
* **Dynamic Canvas UI**: Premium glassmorphic ambient layout with custom deep-charcoal palette (`#08080a`), high-contrast cyan glowing interactive metrics, and CSS scanline matrices.
* **Angular Material**: Native typography and accessibility (`mat-icon`, assistive screen-reader headers).
* **Framer Motion (Vanilla)**: Smooth state transitions, interactive modals, and slide micro-animations.

### **Back-End (Express.js)**
* **Secure API Proxies**: All Google GenAI keys are stored and initialized purely on the server-side, protecting developer keys from browser inspection.
* **Intelligent Backlog Generation**: Converts high-level requests into nested arrays of Epics and Tasks in-memory.
* **Durable Sessions**: State is persistently updated and mirrored across restarts inside `session_store.json`.

---

## 📂 Folder Structure

```markdown
├── angular.json           # Angular build and workspace configuration
├── eslint.config.js       # ESLint configurations and strict plugin directives
├── package.json           # Dependencies mapping (Angular 21.x, Express.js 5.x)
├── metadata.json          # Applet metadata (Frame permissions, capability tags)
├── session_store.json     # Serializable persistent mock RDBMS (State store)
├── src/
│   ├── main.ts            # Client-side bootstrapping script (Zoneless)
│   ├── main.server.ts     # Angular SSR server entry
│   ├── server.ts          # Express.js backend server with API routing
│   ├── server-helper.ts   # Strategic multi-agent engines, state interfaces, Gemini wrappers
│   ├── styles.css         # Tailwind v4 import, custom scrollbars, glass effects
│   ├── index.html         # Application shell document
│   └── app/
│       ├── app.ts         # Main Angular component (State, actions, signals)
│       ├── app.html       # Strategic console layout & interactive telemetry grid
│       └── app.css        # Interactive components transition overlays
```

---

## 🚀 Local Installation & Run Guide

### **Prerequisites**
Ensure you have **Node.js** (v18.x or later) and **npm** installed.

1. **Extract/Clone the Project**:
   ```bash
   cd aetheris-os-applet
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Create a `.env` file in the root directory (or copy from `.env.example`):
   ```env
   # .env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```
4. **Compile & Boot Dev Server**:
   ```bash
   npm run dev
   ```
   The application will startup on `http://localhost:3000`.

---

## 🗺️ Vision & Future Roadmap
* **Workspace Integration**: Read and sync product specification documents directly with Google Sheets and Google Docs via OAuth.
* **Multiplayer Collaboration Grid**: Real-time multi-developer brainstorming rooms with concurrent agent assignment via WebSockets.
* **On-Premise Container Deployment**: Package strategic agent setups into single-command dockerized sandboxes running in Cloud Run or Kubernetes.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE details for permissions. Crafted with premium ergonomics and enterprise multi-agent precision.
