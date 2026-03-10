'use client';

/**
 * ScriptPageView — Long-form document approach with Google Docs two-way sync.
 *
 * Sync strategy:
 *   PUSH (editor → Google Doc):
 *     1. On editor blur (primary — user clicks outside or tabs away)
 *     2. Every 30s safety net (for long continuous typing sessions)
 *     3. Skip if content hash hasn't changed since last push
 *
 *   PULL (Google Doc → editor):
 *     1. On page mount — immediate revisionId check
 *     2. Every 60s when tab is visible — cheap metadata poll
 *     3. Full content pull only if revisionId changed
 *
 * UI: corner sync status widget (no full loading screen)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, ExternalLink, RefreshCw, Cloud } from 'lucide-react';
import dynamic from 'next/dynamic';
import ScriptTOC, { TocHeading } from './ScriptTOC';
import styles from './ScriptPageView.module.css';

import type { TipTapScriptEditorProps } from './TipTapScriptEditor';
const TipTapScriptEditor = dynamic<TipTapScriptEditorProps & { onBlur?: () => void }>(() => import('./TipTapScriptEditor'), { ssr: false });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildTocFromJson(json: Record<string, unknown> | null): TocHeading[] {
    if (!json || !Array.isArray((json as { content?: unknown }).content)) return [];
    const headings: TocHeading[] = [];
    let num = 0;
    for (const node of (json as { content: Array<{ type: string; attrs?: { level?: number }; content?: Array<{ text?: string }> }> }).content) {
        if (node.type === 'heading' && node.attrs?.level === 1) {
            const text = (node.content || []).map((n) => n.text || '').join('').trim();
            if (text) { num++; headings.push({ id: slugify(text), text, number: num }); }
        }
    }
    return headings;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageScript { id: string; content: string | null; }

// Corner widget sync states
type SyncState = 'idle' | 'checking' | 'uploading' | 'pulling' | 'synced' | 'error';

const SYNC_LABELS: Record<SyncState, string> = {
    idle: '',
    checking: 'Checking for updates…',
    uploading: 'Uploading changes…',
    pulling: 'Pulling changes from Doc…',
    synced: 'Synced with Google Docs',
    error: 'Sync error',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScriptPageView({ pageId, clientId, clientName }: { pageId: string; clientId: string; clientName?: string }) {
    const { data: session } = useSession();
    void session; // used for auth context

    const [masterScript, setMasterScript] = useState<PageScript | null>(null);
    const [tocHeadings, setTocHeadings] = useState<TocHeading[]>([]);
    const [activeHeadingId, setActiveHeadingId] = useState<string | undefined>(undefined);
    const [docUrl, setDocUrl] = useState<string | null>(null);
    const [syncState, setSyncState] = useState<SyncState>('idle');
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    const [pullBanner, setPullBanner] = useState<string | null>(null);
    const [syncVersion, setSyncVersion] = useState(0);

    // Refs for push logic
    const saveTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const pushTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const lastPushedHashRef = useRef<string | null>(null);
    const isDirtyRef = useRef(false);
    const isEditorFocusedRef = useRef(false);
    const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastRevisionIdRef = useRef<string | null>(null);
    const lastSyncedVersionRef = useRef<string | null>(null); // Drive 'version' integer — most reliable change detector
    const lastForcePullAtRef = useRef<number>(0);             // timestamp of last pull attempt — used for 15s force-pull fallback
    const lastTypedAtRef = useRef<number>(0); // timestamp of last keystroke — used to debounce auto-push
    const masterScriptRef = useRef<PageScript | null>(null);

    // Keep ref in sync with state for use inside async callbacks
    useEffect(() => { masterScriptRef.current = masterScript; }, [masterScript]);

    // ── Fetch / create master script ───────────────────────────────────────────
    const fetchOrCreateMaster = useCallback(async () => {
        const res = await fetch(`/api/pages/${pageId}/scripts`);
        if (!res.ok) return;
        const scripts: PageScript[] = await res.json();
        if (scripts.length > 0) {
            setMasterScript(scripts[0]);
            lastPushedHashRef.current = scripts[0].content;
            isDirtyRef.current = false;
            try {
                const json = JSON.parse(scripts[0].content || 'null');
                setTocHeadings(buildTocFromJson(json));
            } catch { /* empty */ }
        } else {
            const createRes = await fetch(`/api/pages/${pageId}/scripts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Document', content: null }),
            });
            if (createRes.ok) setMasterScript(await createRes.json());
        }
    }, [pageId]);

    useEffect(() => { fetchOrCreateMaster(); }, [fetchOrCreateMaster]);

    // ── Push to Google Doc ─────────────────────────────────────────────────────
    const pushToGoogleDoc = useCallback(async (force = false) => {
        const script = masterScriptRef.current;
        if (!script?.content) { setSyncState('idle'); return; }

        // Skip if content hasn't changed since last push
        const hash = script.content;
        
        // Prevent spurious overwrites if we haven't loaded the initial hash yet
        if (lastPushedHashRef.current === null) { setSyncState('idle'); return; }
        
        // Block pushes if there are no genuine user edits
        if (!isDirtyRef.current && !force) { setSyncState('idle'); return; }

        if (!force && hash === lastPushedHashRef.current) { setSyncState('idle'); return; }

        setSyncState('uploading');
        try {
            const res = await fetch(`/api/clients/${clientId}/sync-doc`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.docUrl) {
                setDocUrl(data.docUrl);
                setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                lastPushedHashRef.current = hash;
                isDirtyRef.current = false;
                if (data.revisionId) lastRevisionIdRef.current = data.revisionId;
                if (data.docVersion) lastSyncedVersionRef.current = data.docVersion;
                setSyncState('synced');
            } else {
                setSyncState('error');
            }
        } catch {
            setSyncState('error');
        }
        // Auto-clear synced/error state after 4s
        setTimeout(() => setSyncState('idle'), 4000);
    }, [clientId]);

    // ── Pull from Google Doc ───────────────────────────────────────────────────
    const pullFromGoogleDoc = useCallback(async () => {
        lastForcePullAtRef.current = Date.now(); // reset fallback timer on every pull attempt
        setSyncState('pulling');
        try {
            const res = await fetch(`/api/clients/${clientId}/sync-doc`, { method: 'PUT' });
            const data = await res.json();
            if (res.ok && data.content) {
                // Content-safe: skip remount if Google Doc content is identical to what we have
                const currentContent = masterScriptRef.current?.content;
                if (currentContent === data.content) {
                    // Same content — nothing changed, no remount needed
                    setSyncState('idle');
                    return;
                }

                const json = JSON.parse(data.content);
                setTocHeadings(buildTocFromJson(json));
                setMasterScript(prev => prev ? { ...prev, content: data.content } : prev);
                lastPushedHashRef.current = data.content;
                isDirtyRef.current = false;
                isEditorFocusedRef.current = false; // TipTap doesn't fire onBlur on unmount — reset manually
                lastTypedAtRef.current = 0;          // prevent stale idle timer from triggering auto-push on next poll
                if (data.revisionId) lastRevisionIdRef.current = data.revisionId;
                if (data.docVersion) lastSyncedVersionRef.current = data.docVersion;
                setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                setSyncState('synced');
                setSyncVersion(v => v + 1);
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setPullBanner(`Google Doc changes pulled at ${time}`);
                setTimeout(() => setPullBanner(null), 5000);
            } else {
                setSyncState('idle');
            }
        } catch {
            setSyncState('error');
        }
        setTimeout(() => setSyncState(s => s === 'error' ? 'idle' : s), 4000);
    }, [clientId]);

    // ── Poll revisionId (on mount + every 60s) ─────────────────────────────────
    const checkForDocUpdates = useCallback(async (isMount = false) => {
        if (document.visibilityState === 'hidden' && !isMount) return;
        setSyncState('checking');
        try {
            const res = await fetch(`/api/clients/${clientId}/sync-doc`);
            if (!res.ok) { setSyncState('idle'); return; }
            const data = await res.json();
            console.log('[SyncDebug] Data fetched:', {
                docModifiedAt: data.docModifiedAt,
                lastSyncedAt: data.lastSyncedAt,
                docTime: data.docModifiedAt ? new Date(data.docModifiedAt).getTime() : null,
                dbTime: data.lastSyncedAt ? new Date(data.lastSyncedAt).getTime() : null,
                revisionId: data.revisionId
            });

            if (data.docUrl) setDocUrl(data.docUrl);
            if (data.lastSyncedAt) {
                setLastSyncedAt(new Date(data.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }

            let needsPull = false;

            // CRITICAL: NEVER pull while the user has local unsaved typing changes!
            // If we push, Google Drive increments `version`. A fast poll might see this new version
            // and assume it's external, pulling it down and overwriting the user's continued typing.
            // If the user's editor is dirty, we wait for them to pause typing (3s idle) so auto-push can run.
            if (!isDirtyRef.current) {
                // Condition 0 (PRIMARY): Drive 'version' changed — most reliable, no propagation delay
                if (data.docVersion && lastSyncedVersionRef.current !== null && data.docVersion !== lastSyncedVersionRef.current) {
                    console.log('[SyncDebug] version changed:', lastSyncedVersionRef.current, '->', data.docVersion);
                    needsPull = true;
                }

                // Condition 1: Revision ID changed during active session (fallback)
                if (!needsPull && data.revisionId && data.revisionId !== lastRevisionIdRef.current && lastRevisionIdRef.current !== null) {
                    needsPull = true;
                }

                // Condition 2: modifiedTime newer than lastSyncedAt (fallback if version/revision not available)
                if (!needsPull && data.docModifiedAt && data.lastSyncedAt) {
                    const docTime = new Date(data.docModifiedAt).getTime();
                    const dbTime = new Date(data.lastSyncedAt).getTime();
                    if (docTime > dbTime) needsPull = true;
                }
            }

            // Initialize refs on first poll
            if (data.revisionId && lastRevisionIdRef.current === null) lastRevisionIdRef.current = data.revisionId;
            if (data.docVersion && lastSyncedVersionRef.current === null) lastSyncedVersionRef.current = data.docVersion;
            
            if (needsPull) {
                console.log('[SyncDebug] ⬇️ PULL triggered — docTime > dbTime');
                await pullFromGoogleDoc();
                return; // isDirtyRef is reset inside pullFromGoogleDoc — safe to return
            }

            // Auto-push: only if user made real edits AND has been idle for 3s (not mid-typing)
            const typingIdleMs = Date.now() - lastTypedAtRef.current;
            console.log('[SyncDebug] isDirtyRef=', isDirtyRef.current, '| typingIdleMs=', typingIdleMs, '| docVersion=', data.docVersion, '| lastSyncedVersion=', lastSyncedVersionRef.current);
            if (isDirtyRef.current && typingIdleMs >= 3000) {
                console.log('[SyncDebug] ⬆️ AUTO-PUSH triggered — dirty + idle > 3s');
                await pushToGoogleDoc();
                return;
            }

            // 15s force-pull fallback: if all change-detection mechanisms fail (Drive API propagation delays,
            // timestamp collisions, version not returned), still pull every 15s as a safety net.
            // pullFromGoogleDoc is content-safe — skips remount if Google Doc content is identical.
            const msSinceLastPull = Date.now() - lastForcePullAtRef.current;
            if (!isDirtyRef.current && msSinceLastPull >= 15_000) {
                console.log('[SyncDebug] 🔄 FORCE-PULL — fallback after 15s without a pull');
                await pullFromGoogleDoc();
                return;
            }

            setSyncState('idle');
        } catch {
            setSyncState('idle');
        }
    }, [clientId, pullFromGoogleDoc, pushToGoogleDoc]);

    // On mount — check immediately
    useEffect(() => {
        checkForDocUpdates(true);
    }, [checkForDocUpdates]);

    // Every 5s when tab is visible — automatically stops on component unmount
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState !== 'hidden') checkForDocUpdates();
        }, 5_000);
        const onVisible = () => checkForDocUpdates();
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
    }, [checkForDocUpdates]);

    // Strict unmount cleanup — zero Drive/Docs API calls when no one is on the script page
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
        };
    }, []);

    // ── TipTap change handler ──────────────────────────────────────────────────
    const handleContentChange = useCallback((content: string) => {
        // Early exit: if content matches what we last pushed/pulled, it's a TipTap initialization
        // or normalization — nothing the user actually changed.
        // Use lastPushedHashRef (set synchronously in pullFromGoogleDoc) NOT masterScriptRef
        // (which syncs via useEffect and may be stale when this fires).
        if (lastPushedHashRef.current !== null && content === lastPushedHashRef.current) return;

        setMasterScript(prev => prev ? { ...prev, content } : prev);
        try { setTocHeadings(buildTocFromJson(JSON.parse(content))); } catch { /* not JSON */ }

        // Only mark dirty if the user is actively in the editor AND content changed from last push.
        // TipTap's heading-ID normalization changes the hash without user input, so we REQUIRE focus.
        if (isEditorFocusedRef.current && lastPushedHashRef.current !== null && content !== lastPushedHashRef.current) {
            console.log('[DirtyDebug] ❗ isDirty=true — focused, content changed');
            isDirtyRef.current = true;
            // lastTypedAtRef is updated via onKeystroke (before the debounce) for accuracy
        } else if (!isEditorFocusedRef.current && lastPushedHashRef.current !== null) {
            // Silently update the baseline so normalization edits don't look dirty later
            lastPushedHashRef.current = content;
        }

        // DB save (debounced 800ms)
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            const script = masterScriptRef.current;
            if (!script) return;
            await fetch(`/api/pages/${pageId}/scripts/${script.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
        }, 800);
        // NOTE: No 30s auto-push timer here. Google Docs push ONLY happens via the
        // Sync button or automatic pull detection. This prevents silent overwrites.
    }, [clientId, pushToGoogleDoc]);

    // On editor blur
    const handleEditorBlur = useCallback(() => {
        blurTimeoutRef.current = setTimeout(() => {
            isEditorFocusedRef.current = false;
            // We do NOT aggressively push to Google Docs on blur anymore.
            // It causes race conditions if the user clicks the 'Sync Doc' button (which triggers a blur).
            // The 30s idle timer or 60s visibility checker handles passive background saves.
        }, 100); // 100ms debounce to ignore synthetic blur/focus flickers from TipTap node updates
    }, []);

    const handleEditorFocus = useCallback(() => {
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
        isEditorFocusedRef.current = true;
    }, []);

    // TOC intersection observer
    useEffect(() => {
        if (tocHeadings.length === 0) return;
        const observers: IntersectionObserver[] = [];
        tocHeadings.forEach(h => {
            const el = document.getElementById(`script-h1-${h.id}`);
            if (!el) return;
            const obs = new IntersectionObserver(
                ([entry]) => { if (entry.isIntersecting) setActiveHeadingId(h.id); },
                { threshold: 0.6 }
            );
            obs.observe(el); observers.push(obs);
        });
        return () => observers.forEach(o => o.disconnect());
    }, [tocHeadings]);

    const handleAddScript = useCallback(() => {
        window.dispatchEvent(new CustomEvent('script-add-section', { detail: null }));
    }, []);

    // Manual sync button
    const handleManualSync = async () => {
        setSyncState('checking');
        try {
            const res = await fetch(`/api/clients/${clientId}/sync-doc`);
            if (!res.ok) { setSyncState('idle'); return; }
            const data = await res.json();
            
            let needsPull = false;
            if (data.docModifiedAt && data.lastSyncedAt) {
                const docTime = new Date(data.docModifiedAt).getTime();
                const dbTime = new Date(data.lastSyncedAt).getTime();
                if (docTime > dbTime) needsPull = true;
            }
            if (data.revisionId && data.revisionId !== lastRevisionIdRef.current && lastRevisionIdRef.current !== null) {
                needsPull = true;
            }

            if (needsPull) {
                // Google Doc is newer — pull it in
                await pullFromGoogleDoc();
            } else if (isDirtyRef.current) {
                // User has local unsaved changes — push them to Google Doc
                await pushToGoogleDoc(true);
            } else {
                // Nothing changed on either side — push current content as safety net
                await pushToGoogleDoc(true);
            }
        } catch {
            setSyncState('idle');
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className={styles.pageContainer}>
            {/* Pull banner */}
            {pullBanner && (
                <div className={styles.pullBanner}>
                    <Cloud size={13} /> {pullBanner}
                </div>
            )}

            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.toolbarLeft}>
                    <span className={styles.pageTitle}>
                        📝 {clientName || 'Scripts'}
                    </span>
                </div>
                <div className={styles.toolbarRight}>
                    {docUrl && (
                        <a
                            href={docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.docLinkBtn}
                            title="Open in Google Docs"
                        >
                            <ExternalLink size={13} />
                            <span>Open in Docs</span>
                        </a>
                    )}
                    <button
                        className={`${styles.iconBtn} ${syncState === 'error' ? styles.btnError : ''}`}
                        onClick={handleManualSync}
                        title="Sync to Google Docs"
                        disabled={['checking', 'uploading', 'pulling'].includes(syncState)}
                    >
                        <RefreshCw size={14} className={['checking', 'uploading', 'pulling'].includes(syncState) ? styles.spinning : ''} />
                        <span>{syncState === 'idle' ? 'Sync Doc' : SYNC_LABELS[syncState]}</span>
                    </button>
                    {lastSyncedAt && syncState === 'idle' && (
                        <span className={styles.syncTimeLabel} title="Last synced">
                            <Cloud size={12} /> {lastSyncedAt}
                        </span>
                    )}
                    <button className={styles.addBtn} onClick={handleAddScript}>
                        <Plus size={13} /> Add Script
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className={styles.body}>
                <ScriptTOC headings={tocHeadings} activeId={activeHeadingId} />
                <div className={styles.editorScrollArea}>
                    <div className={styles.editorInner}>
                        {masterScript ? (
                            <TipTapScriptEditor
                                key={`${masterScript.id}-${syncVersion}`}
                                scriptId={masterScript.id}
                                initialContent={masterScript.content || ''}
                                onChange={handleContentChange}
                                onBlur={handleEditorBlur}
                                onFocus={handleEditorFocus}
                                onKeystroke={() => { lastTypedAtRef.current = Date.now(); }}
                                readOnly={false}
                            />
                        ) : (
                            <div className={styles.loading}>Loading scripts…</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
