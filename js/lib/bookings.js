/* Data access for booking requests. Every call runs as the current user
   (anonymous or signed in); Row Level Security decides what is allowed. */
import { supabase } from './supabase.js';

export const STATUSES = ['new', 'contacted', 'scheduled', 'closed'];

/** Insert a request. No .select(): anonymous visitors may insert but not read back. */
export async function createBooking({ first, last, email, phone }) {
  const { error } = await supabase.from('bookings').insert({
    first_name: first.trim(),
    last_name: last.trim(),
    email: email.trim(),
    phone: phone.trim(),
  });
  if (error) throw error;
}

/** Bookings the current user may read: their own, or all of them for an admin. */
export async function listBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, first_name, last_name, email, phone, status, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function updateBookingStatus(id, status) {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteBooking(id) {
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Live changes to bookings. Realtime applies the same select policies, so a
 * user only hears about rows they can read. Returns an unsubscribe function.
 */
export function subscribeToBookings(onChange, onStatus) {
  const channel = supabase
    .channel('bookings-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, onChange)
    .subscribe((status) => onStatus?.(status));
  return () => supabase.removeChannel(channel);
}
