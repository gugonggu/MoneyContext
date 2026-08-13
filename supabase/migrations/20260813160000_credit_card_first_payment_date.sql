-- A card added mid-cycle (e.g. issued in August) often doesn't bill its first
-- purchases until the following month's payment day, not the very next one.
-- This lets a card record when its billing actually starts, so the calendar
-- stops showing a payment marker before that date.
alter table public.credit_card_settings
  add column first_payment_date date;
