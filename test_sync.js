require('dotenv').config();
const { syncDocumentToGoogleDoc, createGoogleDoc, setDocPublicRead } = require('./src/lib/google-docs.ts');

const tipTapDummy = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "This is a direct test of the TipTap to Google Docs sync function." }]
    }
  ]
};

async function testSync() {
  try {
     const docId = await createGoogleDoc('Test Sync Doc');
     console.log('Created doc:', docId);
     await setDocPublicRead(docId);
     
     console.log('Attempting syncDocumentToGoogleDoc...');
     const result = await syncDocumentToGoogleDoc(docId, tipTapDummy);
     console.log('Sync Result:', result);
  } catch(e) {
     console.error('SYNC CRASH:', e);
  }
}

testSync();
