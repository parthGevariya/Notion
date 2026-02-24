'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Plus, FileText } from 'lucide-react';
import Sidebar from '@/components/Sidebar/Sidebar';
import Topbar from '@/components/Topbar/Topbar';
import styles from './workspace.module.css';

export default function WorkspacePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    if (status === 'loading') {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', color: 'var(--text-secondary)', fontSize: '14px',
            }}>
                Loading...
            </div>
        );
    }

    if (!session) return null;

    const createFirstPage = async () => {
        try {
            const res = await fetch('/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Getting Started' }),
            });
            if (res.ok) {
                const page = await res.json();
                router.push(`/page/${page.id}`);
            }
        } catch (e) {
            console.error('Failed to create page:', e);
        }
    };

    return (
        <div className={styles['workspace-layout']}>
            <Sidebar />
            <div className={styles['workspace-main']}>
                <Topbar />
                <div className={styles['empty-workspace']}>
                    <div className={styles['empty-workspace-icon']}>
                        <FileText size={64} strokeWidth={1} />
                    </div>
                    <h2>Welcome to your workspace</h2>
                    <p>
                        Create your first page to get started. You can add notes, databases,
                        scripts, and more.
                    </p>
                    <button className={styles['empty-workspace-btn']} onClick={createFirstPage}>
                        <Plus size={16} />
                        Create a page
                    </button>
                </div>
            </div>
        </div>
    );
}
