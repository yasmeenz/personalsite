-- =====================================================================
-- Throttle booking submissions: at most 3 per email address per 10 minutes.
-- Anonymous visitors can insert but not read, so the check runs as
-- SECURITY DEFINER and only ever returns "allowed" or an error.
-- =====================================================================

create index if not exists bookings_email_created_at_idx
  on public.bookings (lower(email), created_at desc);

create or replace function public.enforce_booking_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.bookings b
    where lower(b.email) = lower(new.email)
      and b.created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'rate_limited',
      hint    = 'Too many booking requests for this email address. Try again later.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_booking_rate_limit() from public, anon, authenticated;

create trigger bookings_rate_limit
  before insert on public.bookings
  for each row execute function public.enforce_booking_rate_limit();
