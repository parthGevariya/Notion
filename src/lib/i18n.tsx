'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Locale = 'en' | 'hi';

// Translation dictionary
const translations: Record<Locale, Record<string, string>> = {
    en: {
        // Navigation
        'nav.search': 'Search',
        'nav.settings': 'Settings',
        'nav.reminders': 'Reminders',
        'nav.chat': 'Chat',
        'nav.favorites': 'Favorites',
        'nav.pages': 'Private',
        'nav.newPage': 'New Page',
        'nav.trash': 'Trash',
        // Common
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.create': 'Create',
        'common.loading': 'Loading...',
        'common.noResults': 'No results found',
        'common.untitled': 'Untitled',
        // Search
        'search.placeholder': 'Search pages...',
        'search.results': 'results',
        'search.minChars': 'Type at least 2 characters to search',
        // Reminders
        'reminders.title': 'Reminders',
        'reminders.new': 'New Reminder',
        'reminders.empty': 'No reminders yet. Click "New Reminder" to create one.',
        'reminders.titleField': 'Reminder title...',
        'reminders.details': 'Details (optional)...',
        'reminders.assignTo': 'Assign to...',
        'reminders.all': 'All',
        'reminders.assignedToMe': 'Assigned to Me',
        'reminders.createdByMe': 'Created by Me',
        // Status
        'status.pending': 'Pending',
        'status.inProgress': 'In Progress',
        'status.completed': 'Completed',
        'status.overdue': 'Overdue',
        // Chat
        'chat.title': 'Chat',
        'chat.newChat': '+ New',
        'chat.selectUser': 'Select a user...',
        'chat.typeMessage': 'Type a message...',
        'chat.selectConversation': 'Select a conversation or start a new chat',
        'chat.noMessages': 'No messages',
        // Settings
        'settings.title': 'Settings',
        'settings.yourRole': 'Your Role',
        'settings.teamMembers': 'Team Members',
        'settings.changeRole': 'Change role',
        // Theme
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        // Language
        'lang.english': 'English',
        'lang.hindi': 'हिन्दी',
    },
    hi: {
        // Navigation
        'nav.search': 'खोजें',
        'nav.settings': 'सेटिंग्स',
        'nav.reminders': 'रिमाइंडर',
        'nav.chat': 'चैट',
        'nav.favorites': 'पसंदीदा',
        'nav.pages': 'निजी',
        'nav.newPage': 'नया पेज',
        'nav.trash': 'कचरा',
        // Common
        'common.save': 'सेव करें',
        'common.cancel': 'रद्द करें',
        'common.delete': 'हटाएं',
        'common.edit': 'संपादित करें',
        'common.create': 'बनाएं',
        'common.loading': 'लोड हो रहा है...',
        'common.noResults': 'कोई परिणाम नहीं मिला',
        'common.untitled': 'बिना शीर्षक',
        // Search
        'search.placeholder': 'पेज खोजें...',
        'search.results': 'परिणाम',
        'search.minChars': 'खोजने के लिए कम से कम 2 अक्षर टाइप करें',
        // Reminders
        'reminders.title': 'रिमाइंडर',
        'reminders.new': 'नया रिमाइंडर',
        'reminders.empty': 'कोई रिमाइंडर नहीं। नया बनाने के लिए क्लिक करें।',
        'reminders.titleField': 'रिमाइंडर शीर्षक...',
        'reminders.details': 'विवरण (वैकल्पिक)...',
        'reminders.assignTo': 'असाइन करें...',
        'reminders.all': 'सभी',
        'reminders.assignedToMe': 'मुझे असाइन किया गया',
        'reminders.createdByMe': 'मेरे द्वारा बनाया गया',
        // Status
        'status.pending': 'लंबित',
        'status.inProgress': 'प्रगति में',
        'status.completed': 'पूर्ण',
        'status.overdue': 'अतिदेय',
        // Chat
        'chat.title': 'चैट',
        'chat.newChat': '+ नया',
        'chat.selectUser': 'उपयोगकर्ता चुनें...',
        'chat.typeMessage': 'संदेश लिखें...',
        'chat.selectConversation': 'बातचीत चुनें या नई शुरू करें',
        'chat.noMessages': 'कोई संदेश नहीं',
        // Settings
        'settings.title': 'सेटिंग्स',
        'settings.yourRole': 'आपकी भूमिका',
        'settings.teamMembers': 'टीम के सदस्य',
        'settings.changeRole': 'भूमिका बदलें',
        // Theme
        'theme.light': 'लाइट',
        'theme.dark': 'डार्क',
        // Language
        'lang.english': 'English',
        'lang.hindi': 'हिन्दी',
    },
};

interface I18nContextValue {
    locale: Locale;
    setLocale: (l: Locale) => void;
    t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
    locale: 'en',
    setLocale: () => { },
    t: (key: string) => key,
});

export function useI18n() {
    return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en');

    useEffect(() => {
        const saved = localStorage.getItem('notion-locale') as Locale | null;
        if (saved && translations[saved]) setLocaleState(saved);
    }, []);

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l);
        localStorage.setItem('notion-locale', l);
    }, []);

    const t = useCallback(
        (key: string) => translations[locale]?.[key] || translations.en[key] || key,
        [locale]
    );

    return (
        <I18nContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
}
