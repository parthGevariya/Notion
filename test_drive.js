const { google } = require('googleapis');
const credentials = require('./APIs/gl-task-management-ff700e26cac4.json');
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/docs', 'https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

async function testCreate() {
  try {
     console.log('Attempting to create doc...');
     const res = await drive.files.create({
         requestBody: {
             name: 'Test Doc from Script',
             mimeType: 'application/vnd.google-apps.document',
             parents: ['1zer4MuB3A8HM0pBJQC11E_uJqIyc6QpF']
         }
     });
     console.log('SUCCESS:', res.data.id);
  } catch(e) { 
     console.error('ERROR MESSAGE:', e.message); 
     if(e.response && e.response.data) {
        console.error('ERROR DATA:', JSON.stringify(e.response.data, null, 2));
     }
  }
}
testCreate();
