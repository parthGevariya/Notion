/**
 * google-drive.ts — Google Drive API utilities
 * Auth: shared service account from google-docs.ts
 */

import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';

let _auth: InstanceType<typeof google.auth.OAuth2> | null = null;

function getAuth() {
    if (_auth) return _auth;
    
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('[google-drive] Missing Google OAuth environment variables.');
    }

    _auth = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
    _auth.setCredentials({ refresh_token: refreshToken });

    return _auth;
}

async function driveClient() {
    return google.drive({ version: 'v3', auth: getAuth() });
}

/**
 * Upload a file to Google Drive and return its shareable link.
 * @param fileBuffer - File data
 * @param fileName - Original filename
 * @param mimeType - MIME type
 * @param folderId - Optional Drive folder ID
 */
export async function uploadToGoogleDrive(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId?: string,
): Promise<string> {
    const drive = await driveClient();

    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            ...(folderId ? { parents: [folderId] } : {}),
        },
        media: {
            mimeType,
            body: Readable.from(fileBuffer),
        },
        fields: 'id, webViewLink',
    });

    // Make file readable by anyone with the link
    await drive.permissions.create({
        fileId: res.data.id!,
        requestBody: { role: 'reader', type: 'anyone' },
    });

    return res.data.webViewLink!;
}

/**
 * Delete a file from Google Drive by its ID.
 * Silently succeeds if the file is already gone (404).
 */
export async function deleteFile(fileId: string): Promise<void> {
    try {
        const drive = await driveClient();
        await drive.files.delete({ fileId });
        console.log(`[google-drive] ✅ Deleted file: ${fileId}`);
    } catch (err: unknown) {
        const e = err as { code?: number };
        if (e?.code === 404) {
            console.log(`[google-drive] File already deleted: ${fileId}`);
            return;
        }
        throw err;
    }
}
