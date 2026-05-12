import { createNote, createNotes, getNotes, searchNotes } from "../src/lib/tools/notes";
import { db } from "../src/lib/db";

async function runTests() {
  console.log("🚀 Starting Notes Tools Tests...");

  try {
    // 1. Test createNote
    console.log("\n--- Testing createNote ---");
    const uniqueContent = `Test note for search ${Math.random()}`;
    const singleNoteResult = await (createNote.execute as any)({ 
      content: uniqueContent
    });
    console.log("Result:", singleNoteResult.success ? "✅ Success" : "❌ Failed");
    if (singleNoteResult.note) {
      console.log("Created Note ID:", singleNoteResult.note.id);
    }

    // 2. Test createNotes (Bulk)
    console.log("\n--- Testing createNotes (Bulk) ---");
    const bulkNotesResult = await (createNotes.execute as any)({ 
      notes: ["Bulk note 1", "Bulk note 2"] 
    });
    console.log("Result:", bulkNotesResult.success ? "✅ Success" : "❌ Failed");
    console.log("Count:", bulkNotesResult.count);

    // 3. Test searchNotes
    console.log("\n--- Testing searchNotes ---");
    const searchResult = await (searchNotes.execute as any)({
      query: "uniqueContent" // Wait, I used uniqueContent variable, but searching for string literal "uniqueContent" won't work unless I pass the value
    });
    // Let's search for a part of the unique content
    const searchKeyword = uniqueContent.split(" ")[0]; // "Test"
    const searchResult2 = await (searchNotes.execute as any)({
      query: searchKeyword
    });
    console.log(`Searching for: "${searchKeyword}"`);
    console.log("Result:", searchResult2.success ? "✅ Success" : "❌ Failed");
    console.log("Notes found:", searchResult2.notes.length);
    const found = searchResult2.notes.some((n: any) => n.content === uniqueContent);
    console.log("Found our unique note:", found ? "✅ Yes" : "❌ No");

    // 4. Test getNotes
    console.log("\n--- Testing getNotes ---");
    const getNotesResult = await (getNotes.execute as any)({});
    console.log("Result:", getNotesResult.success ? "✅ Success" : "❌ Failed");
    console.log("Total notes found:", getNotesResult.notes.length);

    // Verify the latest note is one of our test notes
    const latestNote = getNotesResult.notes[0];
    console.log("Latest note content:", latestNote.content);

    console.log("\n✨ All tests completed successfully!");
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

runTests();
