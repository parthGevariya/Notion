'use client';

/**
 * WorkspacePage
 * Entry point — renders the role-appropriate dashboard for the current user.
 * If no session, redirects to /login.
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar/Sidebar';
import Topbar from '@/components/Topbar/Topbar';
import PageLoadingSkeleton from '@/components/Skeleton/PageLoadingSkeleton';
import styles from './workspace.module.css';

// Lazy-load all dashboards (avoids SSR issues with session)
const OwnerDashboard = dynamic(() => import('@/components/Dashboards/OwnerDashboard'), { ssr: false });
const ManagerDashboard = dynamic(() => import('@/components/Dashboards/ManagerDashboard'), { ssr: false });
const ContentWriterDashboard = dynamic(() => import('@/components/Dashboards/ContentWriterDashboard'), { ssr: false });
const ShooterDashboard = dynamic(() => import('@/components/Dashboards/ShooterDashboard'), { ssr: false });
const EditorDashboard = dynamic(() => import('@/components/Dashboards/EditorDashboard'), { ssr: false });
const PostingDashboard = dynamic(() => import('@/components/Dashboards/PostingDashboard'), { ssr: false });

export default function WorkspacePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    if (status === 'loading') {
        return <PageLoadingSkeleton />;
    }

    if (!session) return null;

    const role = (session.user as { role?: string })?.role || 'content_writer';
    const userName = session.user?.name || 'User';
    const userId = (session.user as { id?: string })?.id || '';

    /** Render the correct dashboard based on the user's role */
    const renderDashboard = () => {
        switch (role) {
            case 'owner':
                return <OwnerDashboard userName={userName} />;
            case 'manager':
                return <ManagerDashboard userName={userName} />;
            case 'shooter':
                return <ShooterDashboard userName={userName} userId={userId} />;
            case 'editor':
                return <EditorDashboard userName={userName} userId={userId} />;
            case 'posting':
                return <PostingDashboard userName={userName} userId={userId} />;
            case 'content_writer':
            default:
                return <ContentWriterDashboard userName={userName} userId={userId} />;
        }
    };

    return (
        <div className={styles['workspace-layout']}>
            <Sidebar />
            <div className={styles['workspace-main']}>
                <Topbar />
                {/* Role-based dashboard content */}
                <div style={{ overflowY: 'auto', height: 'calc(100vh - var(--topbar-height))' }}>
                    {renderDashboard()}
                </div>
            </div>
        </div>
    );
}
