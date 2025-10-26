// Simple test script to verify IndexedDB functionality
// Run this in the browser console to test the implementation

async function testIndexedDB() {
  console.log('🧪 Testing IndexedDB implementation...');
  
  try {
    // Import the storage functions (this would work in the actual app context)
    // For now, we'll just test if IndexedDB is available
    
    if (!window.indexedDB) {
      console.error('❌ IndexedDB not supported');
      return;
    }
    
    console.log('✅ IndexedDB is supported');
    
    // Test opening a database
    const dbName = 'AtlasChatDB';
    const request = indexedDB.open(dbName, 1);
    
    request.onerror = () => {
      console.error('❌ Failed to open database');
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      console.log('✅ Database opened successfully');
      console.log('📊 Object stores:', Array.from(db.objectStoreNames));
      db.close();
    };
    
    request.onupgradeneeded = (event) => {
      console.log('🔄 Database upgrade needed - this is expected for first run');
    };
    
  } catch (error) {
    console.error('❌ Error testing IndexedDB:', error);
  }
}

// Test deduplication logic
function testContentHash() {
  console.log('🧪 Testing content hash generation...');
  
  const content1 = "Hello world";
  const content2 = "Hello world";
  const content3 = "Different message";
  
  // Simple hash function for testing
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
  
  const hash1 = simpleHash(content1 + 'user');
  const hash2 = simpleHash(content2 + 'user');
  const hash3 = simpleHash(content3 + 'user');
  
  console.log('Hash 1:', hash1);
  console.log('Hash 2:', hash2);
  console.log('Hash 3:', hash3);
  console.log('✅ Same content produces same hash:', hash1 === hash2);
  console.log('✅ Different content produces different hash:', hash1 !== hash3);
}

console.log('🚀 IndexedDB test functions loaded. Run testIndexedDB() and testContentHash() to test.');