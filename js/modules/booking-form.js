/* Booking form: client-side validation, then a real insert into Supabase. */
import { createBooking } from '../lib/bookings.js';

const rules = {
  first: (v) => (v.trim() ? '' : 'Enter your first name.'),
  last: (v) => (v.trim() ? '' : 'Enter your last name.'),
  email: (v) => {
    if (!v.trim()) return 'Enter your email address.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter an email like name@example.com.';
  },
  phone: (v) => {
    if (!v.trim()) return 'Enter your phone number.';
    const digits = v.replace(/\D/g, '');
    return /^[+\d\s().-]+$/.test(v.trim()) && digits.length >= 7 && digits.length <= 15
      ? '' : 'Enter a phone number with 7 to 15 digits, for example +20 100 000 0000.';
  },
};

/* Turn a database/network error into something a visitor can act on. */
function describeError(err) {
  if (!navigator.onLine) return 'You appear to be offline. Check your connection and press Book again.';
  if (err?.code === 'P0001' && err?.message === 'rate_limited') {
    return "You've sent several requests just now. I'll be in touch, or email me directly.";
  }
  if (err?.code === '23514') return 'One of the fields was not accepted. Check your email and phone number, then press Book again.';
  return 'Your request could not be sent. Wait a moment and press Book again, or email me directly.';
}

export function initBookingForm() {
  const form = document.getElementById('book-form');
  const success = document.getElementById('book-success');
  const formError = document.getElementById('book-error');
  const submit = form?.querySelector('button[type="submit"]');
  if (!form) return { prefillEmail() {} };

  const check = (input) => {
    const msg = rules[input.name](input.value);
    const err = document.getElementById(`${input.id}-err`);
    err.textContent = msg;
    if (msg) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', err.id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
    return !msg;
  };

  form.querySelectorAll('input').forEach((input) => {
    input.addEventListener('blur', () => { if (input.value) check(input); });
    input.addEventListener('input', () => { if (input.getAttribute('aria-invalid')) check(input); });
  });

  const setBusy = (busy) => {
    submit.disabled = busy;
    submit.setAttribute('aria-busy', String(busy));
    submit.querySelector('span').textContent = busy ? 'Booking…' : 'Book';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';
    const inputs = [...form.querySelectorAll('input')];
    const results = inputs.map(check);
    const firstBad = inputs[results.indexOf(false)];
    if (firstBad) { firstBad.focus(); return; }

    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      await createBooking(data);
    } catch (err) {
      console.error('Booking insert failed', err);
      formError.textContent = describeError(err);
      setBusy(false);
      return;
    }
    setBusy(false);
    success.querySelector('[data-name]').textContent = data.first.trim();
    success.querySelector('[data-email]').textContent = data.email.trim();
    form.hidden = true;
    success.hidden = false;
    success.focus();
  });

  success.querySelector('[data-reset]').addEventListener('click', () => {
    form.reset();
    success.hidden = true;
    form.hidden = false;
    form.querySelector('input').focus();
  });

  return {
    /** Fill the email field for signed-in visitors, unless they've typed one. */
    prefillEmail(email) {
      if (email && !form.email.value) form.email.value = email;
    },
  };
}
