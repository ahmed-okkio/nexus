# Team Protocols - Nexus Project
This file is the single source of truth for the Nexus AI Assistant project rules.

## Team Responsibilities (Vertical Slice)
- **Groovster (Notes Domain):** Owns `Note` model, `notes.ts` tools, `NotesList` component, "Note to Task" logic.
- **Okkio (Tasks Domain):** Owns `Task` model, `tasks.ts` tools, `TasksList` component, "Smart Reminders" logic.

## Rules of Engagement
1. **Vertical Slices:** Always verify which domain your task falls under before modifying code.
2. **Database:** Use the singleton Prisma client (`src/lib/db.ts`).
3. **AI Integration:** Shared `Message` model and `/api/chat` route.
