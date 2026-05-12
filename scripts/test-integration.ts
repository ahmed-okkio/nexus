import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  message: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, status: 'PASS', message: '✅' });
  } catch (error) {
    results.push({
      name,
      status: 'FAIL',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runTests() {
  console.log('🧪 Starting Integration Tests...\n');

  // Test 1: Create a note
  await test('POST /api/notes - Create note', async () => {
    const res = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Integration test note',
      }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json() as { note?: { id?: string } };
    if (!data.note?.id) throw new Error('No ID returned');
  });

  // Test 2: Get all notes
  let noteCount = 0;
  await test('GET /api/notes - Retrieve notes', async () => {
    const res = await fetch(`${API_BASE}/notes`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json() as { notes: Array<{ id: string }> };
    if (!Array.isArray(data.notes)) throw new Error('Response.notes is not an array');
    noteCount = data.notes.length;
    console.log(`   Found ${noteCount} notes`);
  });

  // Test 3: Create multiple notes
  await test('POST /api/notes - Create multiple notes', async () => {
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `Bulk test note ${i + 1}`,
        }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
    }
  });

  // Test 4: Verify notes increased
  await test('GET /api/notes - Verify count increased', async () => {
    const res = await fetch(`${API_BASE}/notes`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json() as { notes: Array<{ id: string }> };
    const newCount = data.notes.length;
    if (newCount <= noteCount) throw new Error(`Count didn't increase: ${noteCount} → ${newCount}`);
    console.log(`   Notes increased from ${noteCount} to ${newCount}`);
  });

  // Test 5: Delete a note (get first note ID and delete it)
  let deletedNoteId = '';
  await test('DELETE /api/notes/[id] - Delete note', async () => {
    const getRes = await fetch(`${API_BASE}/notes`);
    if (!getRes.ok) throw new Error(`GET Status ${getRes.status}`);
    const notes = await getRes.json() as Array<{ id: string }>;
    if (notes.length === 0) throw new Error('No notes to delete');
    deletedNoteId = notes[0].id;

    const deleteRes = await fetch(`${API_BASE}/notes/${deletedNoteId}`, {
      method: 'DELETE',
    });
    if (!deleteRes.ok) throw new Error(`DELETE Status ${deleteRes.status}`);
  });

  // Test 6: Verify note was deleted
  await test('GET /api/notes - Verify deletion', async () => {
    const res = await fetch(`${API_BASE}/notes`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const notes = await res.json() as Array<{ id: string }>;
    const stillExists = notes.some(n => n.id === deletedNoteId);
    if (stillExists) throw new Error(`Deleted note still exists: ${deletedNoteId}`);
  });

  // Test 7: Get tasks
  await test('GET /api/tasks - Retrieve tasks', async () => {
    const res = await fetch(`${API_BASE}/tasks`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json() as Array<{ id: string }>;
    if (!Array.isArray(data)) throw new Error('Response is not an array');
    console.log(`   Found ${data.length} tasks`);
  });

  // Test 8: Create a task
  await test('POST /api/tasks - Create task', async () => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Integration Test Task',
        description: 'Testing task creation',
        priority: 'MEDIUM',
      }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json() as { id?: string };
    if (!data.id) throw new Error('No task ID returned');
  });

  // Print results
  console.log('\n📊 Test Results:\n');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    const msg = r.status === 'PASS' ? r.message : `${r.message}`;
    console.log(`${icon} ${r.name}`);
    if (r.status === 'FAIL') console.log(`   └─ ${msg}`);
  });

  const passed = results.filter(r => r.status === 'PASS').length;
  const total = results.length;
  console.log(`\n📈 Summary: ${passed}/${total} tests passed\n`);

  if (passed === total) {
    console.log('🎉 All integration tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }
}

runTests();
