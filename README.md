# Nexus AI Assistant

Nexus is a voice-first personal AI assistant built as an extension of the mind. It allows users to capture thoughts, manage tasks, and stay organized through natural, conversational interactions.

**Built for the LOS Hackathon 2026.**

---

## 🌟 The Vision

Nexus is designed to be ambient. It stays out of your way until you need it, capturing ideas from speech and organizing them into actionable tasks without the friction of traditional forms or complex UIs. It's not just an app; it's a "Neural Interface" for your daily life.

## 🚀 Key Features

### 🎙️ Voice-First Interaction
*   **Ambient Listening:** Natural wake-word detection ("Nexus").
*   **Personalized Greetings:** Dynamic TTS initialization (e.g., "Welcome back, Boss").
*   **Neural Animation:** A high-fidelity Framer Motion startup sequence and a "breathing" assistant orb.

### 📝 Smart Notes & Tasks
*   **Conversational Capture:** Dictate notes or create tasks naturally.
*   **Note-to-Task AI:** The assistant can identify actionable items within a note and convert them into scheduled tasks automatically.
*   **Task Management:** Fully conversational tracking, updates, and completion.

### 📊 Intelligence Layer
*   **Daily Briefing:** A single command to get a summary of your upcoming day, recent notes, and overdue items.
*   **Smart Reminders:** Proactive alerts based on task deadlines and accumulations.
*   **Semantic History:** Retrieval of past notes and tasks through conversational queries.

---

## 🤖 Agentic Engineering (The Build Story)

The core challenge of the LOS Hackathon was building the product using an **AI Agent** as the primary developer. Nexus was built entirely through CLI-based interactions with a team of specialized agents.

### The Specialist Team:
*   **Gemini CLI:** Our "All-Rounder" and Master Builder. It laid the foundation, created the repo, and handled the complex Next.js/Prisma integrations.
*   **Codex CLI:** Our Deep Coding Specialist. It excelled at solving the hardest logic puzzles and refining the voice synthesis pipelines.
*   **Claude Haiku (via Copilot CLI):** Our Strategic Navigator. Used in "Planning Mode" to map out the vision and architectural boundaries from the project brief.
*   **GitHub CLI (gh):** Used for seamless workflow, branch management, and integration.

### Strategic Paradigms:
*   **Vertical Slice Architecture:** The project was divided into domain-specific slices (Notes owned by **Groove**, Tasks owned by **Okkio**) with the AI guided by role-specific Markdown instruction manuals (`OKKIO.md`, `GROOVSTER.md`).
*   **Token Efficiency (Caveman Mode):** To maximize free-tier usage, we utilized "Caveman Mode" with Codex—using ultra-compressed language to stay within context limits while solving deep problems.
*   **Automated Verification:** We leveraged "Project Memories" to instruct the agents to run the linter and type-checker after every significant change, creating a self-regulating engineering environment.
*   **Fresh Sessions:** We maintained context hygiene by manually starting new chat windows for discrete tasks, preventing context drift and ensuring high-signal responses.

---

## 🛠️ Technical Stack

*   **Framework:** [Next.js](https://nextjs.org/) (TypeScript)
*   **Database:** [Prisma](https://www.prisma.io/) with SQLite
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Animations:** [Framer Motion](https://www.framer.com/motion/)
*   **AI Integration:** [Google AI SDK](https://sdk.vercel.ai/docs)
*   **Voice Synthesis:** Custom Web Speech API & Edge TTS integration

---

## 🏁 Getting Started

### Prerequisites
*   Node.js 20+
*   npm

### Installation
1.  Clone the repository:
    ```bash
    git clone https://github.com/your-repo/nexus.git
    cd nexus
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up the database:
    ```bash
    npx prisma migrate dev --name init
    ```
4.  Set up environment variables:
    Create a `.env` file with your Google AI API Key:
    ```bash
    GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
    ```
5.  Run the development server:
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to experience Nexus.

---

## 👥 Team
*   **Groove** — Lead / Notes Vertical Slice
*   **Okkio** — Lead / Tasks Vertical Slice

---

**LOS Hackathon 2026** — *Building something we would actually use.*
