// Role definitions and hierarchy
export const ROLES = {
    OWNER: 'owner',
    MANAGER: 'manager',
    CONTENT_WRITER: 'content_writer',
    SHOOTER: 'shooter',
    EDITOR: 'editor',
    POSTING: 'posting',
    VIEWER: 'viewer',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Role hierarchy levels (higher number = more privilege)
export const ROLE_LEVELS: Record<Role, number> = {
    owner: 100,
    manager: 80,
    content_writer: 50,
    shooter: 50,
    editor: 50,
    posting: 50,
    viewer: 10,
};

export const ROLE_LABELS: Record<Role, string> = {
    owner: 'Owner / CEO',
    manager: 'Manager',
    content_writer: 'Content Writer',
    shooter: 'Shooter',
    editor: 'Editor',
    posting: 'Posting',
    viewer: 'Viewer',
};

export function hasPermission(userRole: Role, requiredLevel: number): boolean {
    return (ROLE_LEVELS[userRole] || 0) >= requiredLevel;
}

export function canManageUsers(role: Role): boolean {
    return role === ROLES.OWNER;
}

export function canManageWorkspace(role: Role): boolean {
    return role === ROLES.OWNER || role === ROLES.MANAGER;
}

export function isAdmin(role: Role): boolean {
    return role === ROLES.OWNER || role === ROLES.MANAGER;
}

// Database column types
export type ColumnType =
    | 'text' | 'number' | 'select' | 'multi_select'
    | 'date' | 'checkbox' | 'url' | 'email' | 'phone'
    | 'person' | 'file' | 'status' | 'rich_text';

export interface ColumnDef {
    id: string;
    name: string;
    type: ColumnType;
    width?: number;
    options?: { id: string; name: string; color: string }[]; // For select/multi_select/status
}

export interface ViewConfig {
    id: string;
    name: string;
    type: 'table' | 'kanban' | 'calendar' | 'gallery';
    filters?: FilterDef[];
    sorts?: SortDef[];
    groupBy?: string; // Column ID for kanban
    calendarBy?: string; // Column ID for calendar
}

export interface FilterDef {
    columnId: string;
    operator: 'equals' | 'contains' | 'not_equals' | 'is_empty' | 'is_not_empty' | 'gt' | 'lt';
    value: string;
}

export interface SortDef {
    columnId: string;
    direction: 'asc' | 'desc';
}
