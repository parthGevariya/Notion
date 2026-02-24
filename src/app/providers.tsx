'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/Theme/ThemeProvider';
import { I18nProvider } from '@/lib/i18n';
import React from 'react';

interface ProvidersProps {
    children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
    return (
        <SessionProvider>
            <ThemeProvider>
                <I18nProvider>
                    {children}
                </I18nProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}
