'use client';

import { useCollab } from './CollabProvider';

export default function CollabIndicator() {
    const { isConnected, connectedUsers } = useCollab();

    if (!isConnected && connectedUsers.length === 0) {
        return null; // Don't show if collab server isn't running
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            padding: '4px 10px',
            borderRadius: '10px',
            background: 'var(--bg-secondary)',
        }}>
            <div style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isConnected ? '#2ecc71' : '#e74c3c',
                flexShrink: 0,
            }} />
            {isConnected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {connectedUsers.length > 0 && (
                        <div style={{ display: 'flex' }}>
                            {connectedUsers.slice(0, 5).map((user, i) => (
                                <div
                                    key={i}
                                    title={user.userName}
                                    style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        background: user.userColor,
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid var(--bg-primary)',
                                        marginLeft: i > 0 ? '-6px' : 0,
                                    }}
                                >
                                    {user.userName.charAt(0).toUpperCase()}
                                </div>
                            ))}
                        </div>
                    )}
                    <span>{connectedUsers.length} online</span>
                </div>
            ) : (
                <span>Offline</span>
            )}
        </div>
    );
}
