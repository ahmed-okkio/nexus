import { db } from "@/lib/db";

export async function createTask(title: string, dueDate?: Date) {
  return await db.task.create({
    data: {
      title,
      dueDate,
    },
  });
}

export async function getTasks() {
  return await db.task.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function toggleTask(id: string, status: string) {
  return await db.task.update({
    where: { id },
    data: { status },
  });
}
