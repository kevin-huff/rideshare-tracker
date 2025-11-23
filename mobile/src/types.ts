/**
 * Core TypeScript types for the Rideshare Tracker mobile app.
 * These match the server schema and define the state machine.
 */

export type ThemeName = 'midnight' | 'ember' | 'glacier';

// ============================================================================
// Database Models (matching server schema)
// ============================================================================

export interface Shift {
    id: string; // UUID
    started_at: string; // ISO timestamp
    ended_at: string | null;
    earnings_cents: number;
    tips_cents: number;
    distance_miles: number;
    ride_count: number;
    synced: boolean; // local-only field
}

export interface Ride {
    id: string; // UUID
    shift_id: string;
    status: 'en_route' | 'in_progress' | 'completed';
    started_at: string; // ISO timestamp
    pickup_at: string | null;
    dropoff_at: string | null;
    ended_at: string | null;
    gross_cents: number;
    tip_cents: number;
    distance_miles: number;
    pickup_lat: number | null;
    pickup_lng: number | null;
    dropoff_lat: number | null;
    dropoff_lng: number | null;
    synced: boolean; // local-only field
}

export interface LocationPing {
    id: number; // local autoincrement
    shift_id: string;
    ride_id: string | null;
    ts: string; // ISO timestamp
    lat: number;
    lng: number;
    speed_mps: number | null;
    heading_deg: number | null;
    accuracy_m: number;
    source: 'gps' | 'network' | 'fused';
    synced: boolean; // local-only field
}

export interface Expense {
    id: string;
    ts: string;
    category: string;
    amount_cents: number;
    note: string | null;
    receipt_url?: string | null;
    receipt_base64?: string | null;
    receipt_mime?: string | null;
    synced: boolean;
}

export interface PendingRequest {
    id: number; // local autoincrement
    method: 'POST' | 'PATCH';
    url: string;
    body: string; // JSON string
    meta?: string | null; // JSON metadata (local IDs, type)
    retry_count: number;
    created_at: string; // ISO timestamp
    last_attempt_at: string | null;
}

// ============================================================================
// State Machine
// ============================================================================

export type AppStateType =
    | 'idle'              // No active shift
    | 'shift_active'      // Shift started, waiting for ride
    | 'en_route'          // Ride accepted, heading to pickup
    | 'in_ride'           // Rider picked up, heading to dropoff
    | 'shift_ended';      // Shift completed (transient state before idle)

export interface AppState {
    state: AppStateType;
    activeShift: Shift | null;
    activeRide: Ride | null;
    stats: ShiftStats;
}

export interface ShiftStats {
    rides: number;
    earnings: number; // in cents
    tips: number; // in cents
    duration: number; // in seconds
    ratePerHour: number; // $/hr
    distance: number; // in miles
}

// ============================================================================
// API Types
// ============================================================================

export interface StartShiftRequest {
    // Empty for now, server generates shift_id and timestamp
}

export interface StartShiftResponse {
    id: string; // Server returns 'id', not 'shift_id'
    started_at: string;
}

export interface EndShiftRequest {
    // Empty for now, server uses current timestamp
}

export interface StartRideRequest {
    shift_id: string;
    pickup_lat?: number;
    pickup_lng?: number;
}

export interface StartRideResponse {
    id: string; // Server returns 'id', not 'ride_id'
    started_at: string;
}

export interface EndRideRequest {
    gross_cents: number;
    dropoff_lat?: number;
    dropoff_lng?: number;
}

export interface AddTipRequest {
    tip_cents: number;
}

export interface LocationBatch {
    pings: Array<{
        shift_id: string;
        ride_id?: string;
        ts: string;
        lat: number;
        lng: number;
        speed_mps?: number;
        heading_deg?: number;
        accuracy_m: number;
        source: 'gps' | 'network' | 'fused';
    }>;
}

export interface CreateExpenseRequest {
    ts?: string;
    category: string;
    amount_cents: number;
    note?: string;
    receipt_base64?: string;
    receipt_mime?: string;
}

export interface CreateExpenseResponse {
    id: string;
    ts: string;
    receipt_url?: string | null;
}

export interface ExpenseResponse {
    id: string;
    ts: string;
    category: string;
    amount_cents: number;
    note?: string | null;
    receipt_url?: string | null;
}

export interface SettingsResponse {
    overlay_privacy_radius_m: number;
    overlay_hide_location: boolean;
    overlay_theme: ThemeName;
}

export type UpdateSettingsRequest = Partial<SettingsResponse>;

// ============================================================================
// Component Props
// ============================================================================

export interface ButtonProps {
    title: string;
    onPress: () => void | Promise<void>;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
}

export interface StatCardProps {
    label: string;
    value: string;
    subtitle?: string;
}
