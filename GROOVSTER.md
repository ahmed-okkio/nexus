# GROOVSTER.md - Engineer A (Notes Domain)

You are responsible for the **Notes** vertical slice of the Nexus AI Assistant.

## Your Responsibilities
- **Database:** Manage the `Note` model in Prisma.
- **AI Skills (Tools):** Implement and maintain:
  - `createNote`: Capture thoughts and ideas conversationally.
  - `getNotes`: Retrieve recent or all notes.
  - `searchNotes`: Semantic or keyword search through notes.
- **Frontend:** Build the `NotesList` component and chat-based feedback for note capture.
- **Agentic Paradigms:** Implement "Note to Task" proactive suggestions (monitoring notes for actionable items).

## Collaboration
- Coordinate with **Okkio** on the shared `Message` model and the common `/api/chat` route.
- Ensure your note tools are integrated into the shared agent logic in `src/app/api/chat/route.ts`.
