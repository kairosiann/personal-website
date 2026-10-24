// "See all quotes": a side drawer listing every quote in /quotes.json. Picking one
// shows it in the homepage's quote section. Opens from the trigger link or from a
// shared /#all-quotes link, and keeps the hash in step without adding history.
(() => {
  const dialog = document.querySelector('.quotes-drawer');
  const trigger = document.querySelector('[data-quotes-open]');
  if (!dialog || !trigger || typeof dialog.showModal !== 'function') return;

  const HASH = '#all-quotes';
  const list = dialog.querySelector('.quotes-drawer-list');
  const count = dialog.querySelector('.quotes-drawer-count');
  const closeButton = dialog.querySelector('[data-quotes-close]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const api = () => (window.quoteOfTheDay && typeof window.quoteOfTheDay.load === 'function' ? window.quoteOfTheDay : null);

  let closing = 0;      // timer id while the exit animation runs
  let prevHash = '';    // hash to restore on close (e.g. #projects)
  let lockedY = 0;      // scroll position to hold while the page is locked
  let onExitEnd = null; // transitionend listener for the exit animation

  function render(quotes, qotd) {
    const today = typeof qotd.dailyIndex === 'function' ? qotd.dailyIndex(new Date(), quotes.length) : -1;
    const showing = typeof qotd.current === 'function' ? qotd.current() : null;

    count.textContent = quotes.length;
    list.replaceChildren(...quotes.map((q, i) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quotes-drawer-item';
      button.dataset.index = i;

      const text = document.createElement('span');
      text.className = 'quotes-drawer-text';
      const words = document.createElement('span');
      words.textContent = `“${q.text}”`;
      if (q.lang) words.lang = q.lang;
      text.append(words);
      if (q.tr) {
        const translation = document.createElement('span');
        translation.className = 'quotes-drawer-translation';
        translation.textContent = ` (“${q.tr}”)`;
        text.append(translation);
      }

      const meta = document.createElement('span');
      meta.className = 'quotes-drawer-meta';
      const who = document.createElement('span');
      who.className = 'quotes-drawer-who';
      who.textContent = `— ${q.who}${q.src ? `, ${q.src}` : ''}`;
      meta.append(who);

      const labels = [];
      if (i === today) labels.push('Today');
      if (i === showing && showing !== today) labels.push('Showing');
      if (labels.length) {
        const tag = document.createElement('span');
        tag.className = 'quotes-drawer-tag';
        tag.textContent = labels.join(' · ');
        meta.append(tag);
      }
      if (i === showing) button.setAttribute('aria-current', 'true');

      button.append(text, meta);
      item.append(button);
      return item;
    }));

    // Bring the quote that's on the page into view without scrolling the document.
    const current = list.querySelector('[aria-current]');
    list.scrollTop = 0;
    if (current) {
      const top = current.parentElement.offsetTop - list.offsetTop;
      const bottom = top + current.offsetHeight;
      if (bottom > list.clientHeight) list.scrollTop = bottom - list.clientHeight + 24;
    }
  }

  function renderError() {
    count.textContent = '';
    const item = document.createElement('li');
    item.className = 'quotes-drawer-empty';
    item.textContent = 'The quotes couldn’t be loaded. Try again in a moment.';
    list.replaceChildren(item);
  }

  function lockScroll() {
    lockedY = window.scrollY;
    document.documentElement.classList.add('quotes-drawer-locked');
  }

  function unlockScroll() {
    document.documentElement.classList.remove('quotes-drawer-locked');
    if (window.scrollY !== lockedY) window.scrollTo(0, lockedY);
  }

  function setHash(hash) {
    const url = location.pathname + location.search + hash;
    if (location.hash !== hash) history.replaceState(history.state, '', url);
  }

  function open() {
    const qotd = api();
    if (!qotd) return false;
    if (closing) finishClose();
    if (dialog.open) return true;

    lockScroll();
    prevHash = location.hash === HASH ? '' : location.hash;
    setHash(HASH);
    dialog.showModal();
    // Start from the closed pose, then transition in on the next frame.
    requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-open')));

    qotd.load().then(
      quotes => {
        if (!dialog.open) return;
        if (Array.isArray(quotes) && quotes.length) render(quotes, qotd);
        else renderError();
      },
      renderError
    );
    return true;
  }

  // dialog.close() hides instantly, so slide out first and close once that's done.
  function close() {
    if (!dialog.open || closing) return;
    dialog.classList.remove('is-open');
    if (reduceMotion.matches) {
      finishClose();
      return;
    }
    onExitEnd = event => {
      if (event.target === dialog && event.propertyName === 'transform') finishClose();
    };
    dialog.addEventListener('transitionend', onExitEnd);
    closing = setTimeout(finishClose, 400); // in case transitionend never fires
  }

  function finishClose() {
    clearTimeout(closing);
    closing = 0;
    if (onExitEnd) dialog.removeEventListener('transitionend', onExitEnd);
    onExitEnd = null;
    if (dialog.open) dialog.close();
  }

  // Runs however the dialog ended up closed (our close, or a forced Esc).
  dialog.addEventListener('close', () => {
    dialog.classList.remove('is-open');
    clearTimeout(closing);
    closing = 0;
    unlockScroll();
    if (location.hash === HASH) setHash(prevHash);
    prevHash = '';
    trigger.focus({ preventScroll: true });
  });

  trigger.addEventListener('click', event => {
    if (open()) event.preventDefault();
  });

  closeButton.addEventListener('click', close);

  // Esc: animate out instead of closing on the spot (when the browser lets us).
  dialog.addEventListener('cancel', event => {
    if (event.cancelable) {
      event.preventDefault();
      close();
    }
  });

  // Backdrop clicks land on the <dialog> itself; the panel fills it edge to edge.
  // Ignore drags that start inside the panel and end on the backdrop.
  let downOnBackdrop = false;
  dialog.addEventListener('pointerdown', event => {
    downOnBackdrop = event.target === dialog;
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog && downOnBackdrop) close();
    downOnBackdrop = false;
  });

  list.addEventListener('click', event => {
    const button = event.target.closest('.quotes-drawer-item');
    const qotd = api();
    if (!button || !qotd || typeof qotd.show !== 'function') return;
    qotd.show(Number(button.dataset.index));
    close();
  });

  // Shared links (/#all-quotes) and hand-edited hashes.
  if (location.hash === HASH) open();
  window.addEventListener('hashchange', () => {
    if (location.hash === HASH) open();
  });
})();
