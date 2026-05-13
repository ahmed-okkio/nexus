import { getDailyBriefing } from "@/lib/tools/tasks";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const briefing = await getDailyBriefing.execute();
    return NextResponse.json(briefing);
  } catch (error) {
    console.error('Error fetching briefing:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch briefing' }, { status: 500 });
  }
}
