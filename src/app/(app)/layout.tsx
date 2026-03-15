import Sidebar from '@/components/Sidebar/Sidebar';

/**
 * Shared layout for all authenticated app pages.
 * Sidebar lives here — persists across navigation without remounting.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            {children}
        </div>
    );
}
