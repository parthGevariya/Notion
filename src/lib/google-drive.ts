/**
 * Google Drive module — SHELL (not yet activated)
 *
 * TODO: Fill in these environment variables in .env to activate:
 *   GOOGLE_CLIENT_ID=your_client_id
 *   GOOGLE_CLIENT_SECRET=your_client_secret
 *   GOOGLE_REFRESH_TOKEN=your_refresh_token
 */

/**
 * Upload a file buffer to a specific Google Drive folder.
 * @param fileBuffer - The file data
 * @param fileName - Original file name
 * @param mimeType - File mime type
 * @param folderId - Target Google Drive folder ID (from Client model)
 * @returns The Drive sharing link
 */
export async function uploadToGoogleDrive(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId?: string
): Promise<string> {
    console.log(`[google-drive] TODO upload file: ${fileName} to folder: ${folderId || 'root'}`);

    // TODO: Implement with googleapis npm package
    // const auth = await getGoogleAuth();
    // const drive = google.drive({ version: 'v3', auth });
    // 
    // const res = await drive.files.create({
    //   requestBody: {
    //     name: fileName,
    //     parents: folderId ? [folderId] : [],
    //   },
    //   media: {
    //     mimeType: mimeType,
    //     body: Readable.from(fileBuffer),
    //   },
    //   fields: 'id, webViewLink'
    // });
    //
    // // Make file readable by anyone with the link
    // await drive.permissions.create({
    //   fileId: res.data.id!,
    //   requestBody: { role: 'reader', type: 'anyone' }
    // });
    // 
    // return res.data.webViewLink!;

    return `https://drive.google.com/file/d/stub_${Date.now()}/view`;
}

/**
 * Build OAuth2 client using env credentials.
 */
// async function getGoogleAuth() {
//   const { google } = await import('googleapis');
//   const auth = new google.auth.OAuth2(
//     process.env.GOOGLE_CLIENT_ID,
//     process.env.GOOGLE_CLIENT_SECRET,
//   );
//   auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
//   return auth;
// }
