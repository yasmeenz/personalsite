/* Sign-in dialog and the signed-in dashboard (live booking list).
   Admins see and manage every request; other users see only their own. */
import { sendMagicLink, signOut, onAuthChange, cleanAuthParamsFromUrl, authErrorFromUrl } from '../lib/auth.js';
import { listBookings, updateBookingStatus, deleteBooking, subscribeToBookings, STATUSES } from '../lib/bookings.js';
import { initReveal } from './ui.js';

const STATUS_LABEL = { new: 'New', contacted: 'Contacted', scheduled: 'Scheduled', closed: 'Closed' };
const fmtDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/* ---------- Sign-in dialog ---------- */
function initDialog() {
  const dialog = document.getElementById('auth-dialog');
  const form = document.getElementById('auth-form');
  const input = document.getElementById('auth-email');
  const msg = document.getElementById('auth-msg');
  const submit = form.querySelector('button[type="submit"]');

  const open = () => {
    msg.textContent = '';
    msg.dataset.tone = '';
    form.hidden = false;
    dialog.showModal();
    input.focus();
  };
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // backdrop

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      msg.dataset.tone = 'error';
      msg.textContent = 'Enter an email like name@example.com.';
      input.focus();
      return;
    }
    submit.disabled = true;
    submit.querySelector('span').textContent = 'Sending link…';
    try {
      await sendMagicLink(email);
      msg.dataset.tone = 'ok';
      msg.textContent = `Sign-in link sent to ${email}. Open it to finish signing in.`;
      form.hidden = true;
    } catch (err) {
      console.error('Magic link failed', err);
      msg.dataset.tone = 'error';
      msg.textContent = err?.status === 429
        ? 'Too many sign-in emails were requested. Wait a minute, then try again.'
        : 'The sign-in link could not be sent. Check the address and try again.';
    } finally {
      submit.disabled = false;
      submit.querySelector('span').textContent = 'Email me a sign-in link';
    }
  });

  return { open, close: () => dialog.close() };
}

/* ---------- Dashboard ---------- */
function initDashboard() {
  const section = document.getElementById('dashboard');
  const title = document.getElementById('dashboard-title');
  const who = document.getElementById('dashboard-who');
  const live = document.getElementById('dashboard-live');
  const list = document.getElementById('dashboard-list');
  const empty = document.getElementById('dashboard-empty');
  const error = document.getElementById('dashboard-error');
  const signOutBtn = document.getElementById('dashboard-signout');

  let rows = new Map();          // id -> booking
  let isAdmin = false;
  let unsubscribe = null;

  const setLive = (state) => {
    live.dataset.state = state;
    live.textContent = state === 'SUBSCRIBED' ? 'Live' : state === 'connecting' ? 'Connecting…' : 'Offline, reconnecting';
  };

  const showError = (text) => { error.textContent = text; error.hidden = !text; };

  const renderRow = (b, { fresh = false } = {}) => {
    const li = document.createElement('li');
    li.className = 'booking';
    li.dataset.id = b.id;
    if (fresh) li.classList.add('is-fresh');

    const main = document.createElement('div');
    main.className = 'booking__main';
    const name = document.createElement('p');
    name.className = 'booking__name';
    name.textContent = `${b.first_name} ${b.last_name}`;
    const meta = document.createElement('p');
    meta.className = 'booking__meta';
    const mail = document.createElement('a');
    mail.href = `mailto:${b.email}`;
    mail.textContent = b.email;
    const tel = document.createElement('a');
    tel.href = `tel:${b.phone.replace(/[^\d+]/g, '')}`;
    tel.textContent = b.phone;
    const time = document.createElement('time');
    time.dateTime = b.created_at;
    time.textContent = fmtDate.format(new Date(b.created_at));
    meta.append(mail, tel, time);
    main.append(name, meta);

    const side = document.createElement('div');
    side.className = 'booking__side';
    if (isAdmin) {
      const label = document.createElement('label');
      label.className = 'sr-only';
      label.htmlFor = `status-${b.id}`;
      label.textContent = `Status for ${b.first_name} ${b.last_name}`;
      const select = document.createElement('select');
      select.id = `status-${b.id}`;
      select.className = 'booking__status';
      select.dataset.status = b.status;
      STATUSES.forEach((s) => select.add(new Option(STATUS_LABEL[s], s, false, s === b.status)));
      select.addEventListener('change', async () => {
        const prev = b.status;
        select.disabled = true;
        try {
          await updateBookingStatus(b.id, select.value);
          select.dataset.status = select.value;
          showError('');
        } catch (err) {
          console.error(err);
          select.value = prev;
          showError('The status could not be saved. Check your connection and try again.');
        } finally { select.disabled = false; }
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'booking__delete';
      del.textContent = 'Delete';
      del.setAttribute('aria-label', `Delete request from ${b.first_name} ${b.last_name}`);
      del.addEventListener('click', async () => {
        if (!confirm(`Delete the request from ${b.first_name} ${b.last_name}? This can't be undone.`)) return;
        del.disabled = true;
        try { await deleteBooking(b.id); removeRow(b.id); showError(''); }
        catch (err) { console.error(err); del.disabled = false; showError('The request could not be deleted. Try again.'); }
      });
      side.append(label, select, del);
    } else {
      const badge = document.createElement('span');
      badge.className = 'booking__badge';
      badge.dataset.status = b.status;
      badge.textContent = STATUS_LABEL[b.status] ?? b.status;
      side.append(badge);
    }

    li.append(main, side);
    return li;
  };

  const updateCount = () => {
    const n = rows.size;
    title.textContent = isAdmin ? `Booking requests (${n})` : `Your booking requests (${n})`;
    empty.hidden = n > 0;
  };

  const upsertRow = (b, { fresh = false } = {}) => {
    rows.set(b.id, b);
    const existing = list.querySelector(`[data-id="${CSS.escape(b.id)}"]`);
    const el = renderRow(b, { fresh });
    if (existing) existing.replaceWith(el);
    else list.prepend(el);
    updateCount();
  };

  const removeRow = (id) => {
    rows.delete(id);
    list.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove();
    updateCount();
  };

  const onChange = (payload) => {
    // DELETE events skip RLS and carry only the primary key, so every subscriber
    // hears them. removeRow ignores ids it doesn't hold; nothing leaks.
    if (payload.eventType === 'DELETE') removeRow(payload.old.id);
    else upsertRow(payload.new, { fresh: payload.eventType === 'INSERT' });
  };

  async function show(profile) {
    isAdmin = profile?.role === 'admin';
    who.textContent = isAdmin
      ? `Signed in as ${profile.email}, admin`
      : `Signed in as ${profile?.email ?? 'you'}`;
    section.hidden = false;
    initReveal(section);
    setLive('connecting');
    showError('');

    // Subscribe first so nothing is missed between the fetch and the stream.
    unsubscribe?.();
    unsubscribe = subscribeToBookings(onChange, (status) => setLive(status));

    try {
      const data = await listBookings();
      rows = new Map();
      list.replaceChildren(...data.map((b) => { rows.set(b.id, b); return renderRow(b); }));
      updateCount();
    } catch (err) {
      console.error(err);
      showError('Booking requests could not be loaded. Refresh the page to try again.');
    }
  }

  function hide() {
    unsubscribe?.();
    unsubscribe = null;
    rows = new Map();
    list.replaceChildren();
    section.hidden = true;
  }

  return { show, hide, signOutBtn };
}

/* ---------- Wiring ---------- */
export function initAccount({ onSignedIn } = {}) {
  const dialog = initDialog();
  const dash = initDashboard();
  const accountBtn = document.querySelector('[data-account]');
  let signedIn = false;

  let redirectError = authErrorFromUrl();   // shown once, after an expired/invalid link

  accountBtn.addEventListener('click', () => {
    if (signedIn) document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });
    else dialog.open();
  });

  dash.signOutBtn.addEventListener('click', async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  });

  onAuthChange(({ session, profile }) => {
    cleanAuthParamsFromUrl();
    signedIn = Boolean(session);
    accountBtn.textContent = signedIn ? 'Your dashboard' : 'Sign in';
    if (signedIn) {
      dialog.close();
      dash.show(profile ?? { email: session.user.email, role: 'user' });
      onSignedIn?.(session.user.email);
    } else {
      dash.hide();
      if (redirectError) {
        dialog.open();
        const msg = document.getElementById('auth-msg');
        msg.dataset.tone = 'error';
        msg.textContent = `That sign-in link didn't work (${redirectError}). Request a new one below.`;
        redirectError = null;
      }
    }
  });
}
