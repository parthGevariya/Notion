require('dotenv').config();
const { google } = require('googleapis');

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

const auth = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
auth.setCredentials({ refresh_token: refreshToken });

const drive = google.drive({ version: 'v3', auth });

async function findOrMakeFolders() {
  try {
    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and (name='Videos' or name='Thumbnail' or name='Script')",
      fields: 'files(id, name, parents)',
    });
    console.log('Found folders:');
    res.data.files.forEach(f => console.log(`${f.name} - ${f.id} (Parents: ${f.parents})`));
    
    // Find Videos folder
    const videosFolder = res.data.files.find(f => f.name === 'Videos');
    
    // Check if Thumbnail folder exists
    const thumbnailFolder = res.data.files.find(f => f.name === 'Thumbnail');
    if (!thumbnailFolder && videosFolder && videosFolder.parents && videosFolder.parents.length > 0) {
      console.log('Creating Thumbnail folder inside same parent as Videos...');
      const newThumb = await drive.files.create({
        requestBody: {
          name: 'Thumbnail',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [videosFolder.parents[0]]
        },
        fields: 'id, name',
      });
      console.log(`Created Thumbnail folder: ${newThumb.data.id}`);
    }
  } catch(e) { 
    console.error('ERROR:', e.message); 
  }
}

findOrMakeFolders();
