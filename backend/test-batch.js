async function testBatch() {
  const payload = {
    updatedBy: 'test-admin',
    items: [
      {
        id: 'alloc-test-1',
        day: 'Monday',
        slotId: 's1',
        roomName: 'New AI Room 1',
        branchId: 'b1',
        subject: 'CSPC 302 | Dr. Smith',
        branchLabel: 'CS',
        section: 'A'
      },
      {
        id: 'alloc-test-2',
        day: 'Monday',
        slotId: 's2',
        roomName: 'New AI Room 2',
        branchId: 'b2',
        subject: 'ITPC 404 | Prof. Jones',
        branchLabel: 'IT',
        section: null
      }
    ]
  };

  try {
    console.log('Testing batch insert to local API...');
    const res = await fetch('http://localhost:3001/api/allocations/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const json = await res.json();
    console.log('Status code:', res.status);
    console.log('Response:', json);

    if (res.ok) {
        console.log('Testing getting rooms to see if new rooms were created...');
        const roomRes = await fetch('http://localhost:3001/api/storage');
        const storage = await roomRes.json();
        const createdRooms = storage.rooms.filter(r => r.name.startsWith('New AI Room'));
        console.log('Newly created rooms:', createdRooms);
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testBatch();
