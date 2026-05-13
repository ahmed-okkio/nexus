import { getSmartReminders } from "@/lib/tools/tasks";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const reminders = await getSmartReminders.execute();
    return NextResponse.json(reminders);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch reminders' }, { status: 500 });
  }
}
