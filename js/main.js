/* Entry point (ES module). Loads the page behaviour first so the site works
   even if Supabase or the CDN is unreachable, then wires up data features. */
import {
  initEntrance, initNav, initReveal, initCounters, initRotator,
  initHeroMotion, initTabs, initYear,
} from './modules/ui.js';

initEntrance();
initNav();
initReveal();
initCounters();
initRotator();
initHeroMotion();
initTabs();
initYear();

// Data features load separately: a CDN or network failure must not break the page.
try {
  const [{ initBookingForm }, { initAccount }] = await Promise.all([
    import('./modules/booking-form.js'),
    import('./modules/account.js'),
  ]);
  const booking = initBookingForm();
  initAccount({ onSignedIn: (email) => booking.prefillEmail(email) });
} catch (err) {
  console.error('Supabase features unavailable', err);
  const formError = document.getElementById('book-error');
  if (formError) formError.textContent = 'Online booking is unavailable right now. Email or call me using the details on this page.';
  document.querySelector('#book-form button[type="submit"]')?.setAttribute('disabled', '');
}
