// Shelf notes, sideways scrolling for shelves with more books than fit across, and
// opening a book to its cover.
document.addEventListener('DOMContentLoaded', () => {
  const shelves = [...document.querySelectorAll('.shelf')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Each shelf's note counts its books, names whichever book you point at, and
  // while a book is open, names it with a link out.
  const notes = new Map();
  shelves.forEach(shelf => {
    const note = shelf.querySelector('.shelf-note');
    const read = shelf.querySelectorAll('.spine').length;
    const reading = shelf.querySelectorAll('.flat').length;
    const summary = reading ? `${read} read · ${reading} currently reading` : `${read} read`;
    const state = { note, summary, open: null };
    notes.set(shelf, state);
    resetNote(state);
    shelf.querySelectorAll('[data-caption]').forEach(book => {
      const name = () => { note.textContent = book.dataset.caption; };
      const reset = () => resetNote(state);
      book.addEventListener('pointerenter', name);
      book.addEventListener('focus', name);
      book.addEventListener('pointerleave', reset);
      book.addEventListener('blur', reset);
    });
  });

  function resetNote({ note, summary, open }) {
    if (!open) {
      note.textContent = summary;
      return;
    }
    note.textContent = `${open.dataset.caption}`;
    if (open.href) {
      const link = document.createElement('a');
      link.className = 'outbound-link';
      link.href = open.href;
      link.textContent = 'Goodreads';
      note.append(' — ', link);
    }
  }

  // When a shelf's standing books overflow, the shelf pins in place and the page's
  // vertical scroll slides them sideways, like the homepage stepping through its
  // sections. Each such shelf gets extra height to scroll through: a short hold
  // before and after, plus the distance the books need to travel.
  const HOLD = 80;
  const rows = shelves.map(shelf => ({
    shelf,
    pin: shelf.querySelector('.shelf-pin'),
    view: shelf.querySelector('.shelf-scroll'),
    books: shelf.querySelector('.shelf-books'),
    overflow: 0,
    stick: 0,
    top: 0,
  }));
  let frame = 0;

  function layout() {
    rows.forEach(row => {
      row.shelf.classList.remove('is-scrolling');
      row.shelf.style.height = '';
      row.books.style.transform = '';
      row.overflow = Math.max(0, Math.ceil(row.books.offsetWidth - row.view.clientWidth));
    });
    rows.forEach(row => {
      if (!row.overflow) return;
      const height = row.pin.offsetHeight;
      row.stick = Math.max(16, Math.round((window.innerHeight - height) / 2));
      row.shelf.classList.add('is-scrolling');
      row.shelf.style.setProperty('--stick', `${row.stick}px`);
      row.shelf.style.height = `${height + row.overflow + HOLD * 2}px`;
    });
    // Measure after every shelf has its height, since each one moves the next.
    rows.forEach(row => { row.top = row.shelf.getBoundingClientRect().top + window.scrollY; });
    render();
  }

  function render() {
    frame = 0;
    rows.forEach(row => {
      if (!row.overflow) return;
      const shift = Math.min(Math.max(window.scrollY + row.stick - row.top - HOLD, 0), row.overflow);
      row.books.style.transform = `translateX(${-shift}px)`;
      row.view.classList.toggle('has-before', shift > 1);
      row.view.classList.toggle('has-after', shift < row.overflow - 1);
    });
  }

  // Scroll the page until a book on a sliding shelf is in the middle of the strip.
  function reveal(li, behavior = 'auto') {
    const row = rows.find(r => r.books.contains(li));
    if (!row || !row.overflow) return;
    const centered = li.offsetLeft + li.offsetWidth / 2 - row.view.clientWidth / 2;
    const shift = Math.min(Math.max(centered, 0), row.overflow);
    window.scrollTo({ top: row.top - row.stick + HOLD + shift, behavior });
  }

  // Tabbing to a book that's slid out of view scrolls the page to it, rather than
  // letting the browser scroll the strip itself.
  rows.forEach(row => {
    row.view.addEventListener('focusin', event => {
      row.view.scrollLeft = 0;
      reveal(event.target.closest('li'));
    });
  });

  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(render);
  }, { passive: true });

  let pending = 0;
  const observer = new ResizeObserver(() => {
    if (!pending) pending = requestAnimationFrame(() => { pending = 0; layout(); });
  });
  rows.forEach(row => { observer.observe(row.view); observer.observe(row.books); });

  // Opening a book: the first click on a spine turns the book to show its cover;
  // clicking the cover then follows the book's link. Escape, or clicking anywhere
  // else, puts it back.
  const TURN = 620;
  let current = null;

  document.querySelectorAll('.shelf-books .spine').forEach(spine => {
    const li = spine.parentElement;
    const [, author = ''] = spine.dataset.caption.split(' · ');
    const title = spine.querySelector('.spine-title');
    const height = spine.offsetHeight;

    const cover = document.createElement('span');
    cover.className = 'cover';
    cover.setAttribute('aria-hidden', 'true');
    const coverTitle = document.createElement('span');
    coverTitle.className = 'cover-title';
    coverTitle.textContent = spine.dataset.caption.split(' · ')[0];
    if (title.lang) coverTitle.lang = title.lang;
    const coverAuthor = document.createElement('span');
    coverAuthor.className = 'cover-author';
    coverAuthor.textContent = author;
    cover.append(coverTitle, coverAuthor);
    spine.append(cover);

    li.classList.add('has-cover');
    li.style.setProperty('--book-w', `${spine.offsetWidth}px`);
    li.style.setProperty('--cover-w', `${Math.max(120, Math.round(height * 0.66))}px`);
    spine.setAttribute('aria-expanded', 'false');
    if (!spine.href) {
      spine.tabIndex = 0;
      spine.setAttribute('role', 'button');
      spine.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          spine.click();
        }
      });
    }

    spine.addEventListener('click', event => {
      if (li.classList.contains('is-open')) {
        // An open book's cover follows its link; one without a link just closes.
        if (!spine.href) close(li);
        return;
      }
      event.preventDefault();
      open(li);
    });
  });

  function turn(li, opening) {
    li.classList.add('is-turning');
    li.classList.toggle('is-open', opening);
    li.querySelector('.spine').setAttribute('aria-expanded', String(opening));
    clearTimeout(li.turnTimer);
    li.turnTimer = setTimeout(() => li.classList.remove('is-turning'), TURN + 40);
  }

  function open(li) {
    if (current) close(current);
    current = li;
    turn(li, true);
    const state = notes.get(li.closest('.shelf'));
    state.open = li.querySelector('.spine');
    resetNote(state);
    // Once it's open, bring it into view on a shelf that slides.
    setTimeout(() => reveal(li, reduceMotion.matches ? 'auto' : 'smooth'), reduceMotion.matches ? 0 : TURN);
  }

  function close(li) {
    turn(li, false);
    const state = notes.get(li.closest('.shelf'));
    state.open = null;
    resetNote(state);
    if (current === li) current = null;
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && current) close(current);
  });
  document.addEventListener('click', event => {
    if (current && !event.target.closest('.spine, .shelf-note a')) close(current);
  });

  layout();
});
