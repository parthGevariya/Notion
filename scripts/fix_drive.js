const { google } = require('googleapis');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth });

    try {
        const videoFolder = await drive.files.get({
            fileId: '1n48Huo6l7h3q1znW0jaX3dd5bMafiqQr',
            fields: 'id, name, owners, permissions'
        });

        const thumbnailFolder = await drive.files.get({
            fileId: '1Sq5Kkcu7avdUkTfj20o9lEV3I6FiTqb8',
            fields: 'id, name, owners, permissions'
        });

        const output = {
            VideoFolder: videoFolder.data,
            ThumbnailFolder: thumbnailFolder.data
        };

        fs.writeFileSync(path.join(__dirname, 'drive_permissions_out.json'), JSON.stringify(output, null, 2));
        console.log('Saved to drive_permissions_out.json');

    } catch (err) {
        console.error('Error:', err.message);
    }
}

run();
