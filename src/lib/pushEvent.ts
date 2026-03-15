/**
 * pushAppEvent — fire-and-forget helper used by Next.js API routes
 * to broadcast a named event to all connected browsers via the
 * collab Socket.IO server's /push-app-event HTTP endpoint.
 *
 * Usage:
 *   await pushAppEvent('page-created', { id, title, icon, parentId, _count });
 *
 * Errors are silently swallowed so they never break the API response.
 */
const COLLAB_URL = process.env.COLLAB_SERVER_URL || process.env.NEXT_PUBLIC_COLLAB_SERVER_URL || 'http://localhost:3001';

export async function pushAppEvent(event: string, payload: unknown): Promise<void> {
    try {
        await fetch(`${COLLAB_URL}/push-app-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, payload }),
        });
    } catch (e) {
        // Non-critical — collab server may be offline
        console.warn(`[pushAppEvent] Could not reach collab-server for event "${event}":`, (e as Error).message);
    }
}
