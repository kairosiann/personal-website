// Shelf notes, and sideways scrolling for shelves with more books than fit across.
document.addEventListener('DOMContentLoaded', () => {
  const shelves = [...document.querySelectorAll('.shelf')];

  // Each shelf's note counts its books, and names whichever book you point at.
  shelves.forEach(shelf => {
    const note = shelf.querySelector('.shelf-note');
    const read = shelf.querySelectorAll('.spine').length;
    const reading = shelf.querySelectorAll('.flat').length;
    const summary = reading ? `${read} read · ${reading} currently reading` : `${read} read`;
    note.textContent = summary;
    shelf.querySelectorAll('[data-caption]').forEach(book => {
      const name = () => { note.textContent = book.dataset.caption; };
      const reset = () => { note.textContent = summary; };
      book.addEventListener('pointerenter', name);
      book.addEventListener('focus', name);
      book.addEventListener('pointerleave', reset);
      book.addEventListener('blur', reset);
    });
  });

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

  // Tabbing to a book that's slid out of view scrolls the page until it's in view,
  // rather than letting the browser scroll the strip itself.
  rows.forEach(row => {
    row.view.addEventListener('focusin', event => {
      row.view.scrollLeft = 0;
      if (!row.overflow) return;
      const book = event.target.closest('li');
      const centered = book.offsetLeft + book.offsetWidth / 2 - row.view.clientWidth / 2;
      const shift = Math.min(Math.max(centered, 0), row.overflow);
      window.scrollTo({ top: row.top - row.stick + HOLD + shift, behavior: 'auto' });
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

  layout();
});
