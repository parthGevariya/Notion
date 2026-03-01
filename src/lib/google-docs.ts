/**
 * Google Docs sync module — SHELL (not yet activated)
 *
 * TODO: Fill in these environment variables in .env to activate:
 *   GOOGLE_CLIENT_ID=your_client_id
 *   GOOGLE_CLIENT_SECRET=your_client_secret
 *   GOOGLE_REFRESH_TOKEN=your_refresh_token
 *
 * Strategy:
 * - PUSH: After any script save (debounced 5s), push full script list to Google Doc as formatted text.
 * - PULL: Poll Google Doc every 30s; if doc version changed, pull and apply diffs.
 * - This keeps API quota usage low (~120 calls/hour max even with 4 editors active).
 */

/** A script item to sync */
export interface ScriptItem {
    scriptNumber: number;
    title: string;
    content: string | null;
    reelLink: string | null;
}

/**
 * Push all scripts for a client to their linked Google Doc.
 * @param docId - Google Doc document ID
 * @param scripts - Array of script items to push
 */
export async function syncScriptsToDoc(docId: string, scripts: ScriptItem[]): Promise<void> {
    // TODO: Implement with googleapis npm package
    // const auth = await getGoogleAuth();
    // const docs = google.docs({ version: 'v1', auth });
    // Format scripts as sections and update the doc body
    console.log(`[google-docs] TODO syncScriptsToDoc → docId: ${docId}, scripts: ${scripts.length}`);
}

/**
 * Fetch current content from a Google Doc and return it as plain text.
 * @param docId - Google Doc document ID
 */
export async function fetchDocContent(docId: string): Promise<string> {
    // TODO: Implement with googleapis npm package
    // const auth = await getGoogleAuth();
    // const docs = google.docs({ version: 'v1', auth });
    // const res = await docs.documents.get({ documentId: docId });
    // return extractPlainText(res.data.body);
    console.log(`[google-docs] TODO fetchDocContent → docId: ${docId}`);
    return '';
}

/**
 * Build OAuth2 client using env credentials.
 * TODO: Call this from the above functions once credentials are set.
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
