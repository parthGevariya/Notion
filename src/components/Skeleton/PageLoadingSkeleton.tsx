'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import Topbar from '@/components/Topbar/Topbar';
import styles from './PageLoadingSkeleton.module.css';

export default function PageLoadingSkeleton() {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <Sidebar />
            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minHeight: '100vh' }}>
                <Topbar />
                <div className={styles.container}>
                    {/* Cover image skeleton */}
                    <div className={styles.coverSkeleton}></div>

                    <div className={styles.content}>
                        {/* Title skeleton */}
                        <div className={`${styles.pulse} ${styles.title}`}></div>

                        {/* Editor skeleton lines */}
                        <div className={styles.editorSkeletons}>
                            <div className={`${styles.pulse} ${styles.line}`} style={{ width: '100%' }}></div>
                            <div className={`${styles.pulse} ${styles.line}`} style={{ width: '90%' }}></div>
                            <div className={`${styles.pulse} ${styles.line}`} style={{ width: '95%' }}></div>
                            <div className={`${styles.pulse} ${styles.line}`} style={{ width: '70%' }}></div>
                            <div className={`${styles.pulse} ${styles.line}`} style={{ width: '85%', marginTop: '24px' }}></div>
                            <div className={`${styles.pulse} ${styles.line}`} style={{ width: '40%' }}></div>
                        </div>

                        {/* Sub-blocks skeleton */}
                        <div className={styles.blocksContainer}>
                            <div className={`${styles.pulse} ${styles.block}`}></div>
                            <div className={`${styles.pulse} ${styles.block}`}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
