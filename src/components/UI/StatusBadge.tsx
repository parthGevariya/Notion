interface StatusBadgeProps {
    status: string;
    label: string;
    color: string;
    bg: string;
}

export default function StatusBadge({ label, color, bg }: StatusBadgeProps) {
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 600,
            color: color,
            backgroundColor: bg,
        }}>
            {label}
        </span>
    );
}
