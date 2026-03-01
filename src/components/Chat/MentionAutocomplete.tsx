import { useEffect, useState } from 'react';
import styles from './MentionAutocomplete.module.css';

interface User {
    id: string;
    name: string;
    role: string;
}

interface MentionProps {
    searchText: string;
    users: User[];
    onSelect: (user: User) => void;
    onClose: () => void;
    position?: { bottom: number; left: number };
}

export default function MentionAutocomplete({ searchText, users, onSelect, onClose, position }: MentionProps) {
    const [filtered, setFiltered] = useState<User[]>([]);

    useEffect(() => {
        const term = searchText.toLowerCase();
        // Filter out users that don't match the search term
        setFiltered(users.filter(u =>
            u.name.toLowerCase().includes(term) ||
            u.role.toLowerCase().includes(term)
        ));
    }, [searchText, users]);

    if (filtered.length === 0) return null;

    return (
        <div
            className={styles.container}
            style={position ? { bottom: position.bottom, left: position.left } : {}}
        >
            <div className={styles.header}>Mention someone</div>
            {filtered.map(u => (
                <div key={u.id} className={styles.item} onClick={() => onSelect(u)}>
                    <div className={styles.avatar}>{u.name.charAt(0).toUpperCase()}</div>
                    <div className={styles.info}>
                        <span className={styles.name}>{u.name}</span>
                        <span className={styles.role}>{u.role}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
