import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const parseTaskDueDate = (dueDate?: string) => {
  if (!dueDate) {
    return null;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00(?::00(?:\.000)?)?Z)?$/.exec(dueDate);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  }

  return new Date(dueDate);
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim();

    console.log('Fetching tasks from DB...');
    const tasks = await db.task.findMany({
      where: {
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { description: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`Successfully fetched ${tasks.length} tasks.`);
    return NextResponse.json({ success: true, tasks, count: tasks.length, query: query || null });
  } catch (error) {
    console.error('CRITICAL Error fetching tasks:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch tasks',
      details: error instanceof Error ? error.message : String(error),
      debug: {
        cwd: process.cwd(),
        dbUrl: process.env.DATABASE_URL,
        env: process.env.NODE_ENV
      }
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      priority?: string;
      dueDate?: string;
    };
    const title = body.title?.trim();

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Missing title' },
        { status: 400 }
      );
    }

    const dueDate = parseTaskDueDate(body.dueDate);
    if (body.dueDate && Number.isNaN(dueDate?.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid due date' },
        { status: 400 }
      );
    }

    const task = await db.task.create({
      data: {
        title,
        description: body.description?.trim() || null,
        priority: body.priority || 'medium',
        dueDate,
      },
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing id or status' },
        { status: 400 }
      );
    }

    const task = await db.task.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing id' },
        { status: 400 }
      );
    }

    const task = await db.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 });
  }
}
