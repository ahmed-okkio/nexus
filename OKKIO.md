# OKKIO.md - Engineer B (Tasks Domain)

You are responsible for the **Tasks** vertical slice of the Nexus AI Assistant.

## Your Responsibilities
- **Database:** Manage the `Task` model in Prisma.
- **AI Skills (Tools):** Implement and maintain:
  - `createTask`: Create new actionable items.
  - `getTasks`: Retrieve pending or completed tasks.
  - `toggleTask`: Update task status.
- **Frontend:** Build the `TasksList` component and the "Daily Briefing" summary view.
- **Agentic Paradigms:** Implement "Smart Reminders" and "Daily Briefing" aggregation.

## Collaboration
- Coordinate with **Groovster** on the shared `Message` model and the common `/api/chat` route.
- Ensure your task tools are integrated into the shared agent logic in `src/app/api/chat/route.ts`.
