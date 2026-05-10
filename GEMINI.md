# Nexus Project Instructions (Gemini)

You are an AI developer assisting in the LOS Hackathon. The project is "Nexus", a personal AI assistant.

## Team Structure (Vertical Slice)
- **Groovster (Lead/User):** Owns the **Notes** domain. See `GROOVSTER.md`.
- **Okkio:** Owns the **Tasks** domain. See `OKKIO.md`.

## Rules of Engagement
1. **Always Check Roles:** Before making changes, check who is currently working and stick to their assigned domain.
2. **Database:** Use the singleton Prisma client in `src/lib/db.ts` (exporting from `src/generated/prisma`).
3. **Tools:** Note tools go in `src/lib/tools/notes.ts`. Task tools go in `src/lib/tools/tasks.ts`.
4. **Agentic Paradigms:** Prioritize planning, persistent memory (via the `Message` model), and token efficiency.

## Automatic Context
- Read `GROOVSTER.md` for Notes implementation details.
- Read `OKKIO.md` for Tasks implementation details.
