import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log('Fetching tasks from DB...');
    const tasks = await db.task.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`Successfully fetched ${tasks.length} tasks.`);
    return NextResponse.json({ success: true, tasks });
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
