interface AvatarPillProps {
    name: string;
    avatar?: string | null;
    size?: 'sm' | 'md' | 'lg';
}

export default function AvatarPill({ name, avatar, size = 'md' }: AvatarPillProps) {
    const sizeMap = {
        sm: { img: 20, font: 12, padding: '2px 8px' },
        md: { img: 24, font: 13, padding: '4px 10px' },
        lg: { img: 32, font: 14, padding: '6px 12px' }
    };

    const s = sizeMap[size];

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: s.padding,
            backgroundColor: 'var(--bg-hover)',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border)'
        }}>
            {avatar ? (
                <img
                    src={avatar}
                    alt={name}
                    style={{
                        width: s.img,
                        height: s.img,
                        borderRadius: '50%',
                        objectFit: 'cover'
                    }}
                />
            ) : (
                <div style={{
                    width: s.img,
                    height: s.img,
                    borderRadius: '50%',
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.floor(s.img * 0.45),
                    fontWeight: 600
                }}>
                    {name.charAt(0).toUpperCase()}
                </div>
            )}
            <span style={{
                fontSize: s.font,
                fontWeight: 500,
                color: 'var(--text-secondary)'
            }}>
                {name}
            </span>
        </div>
    );
}
