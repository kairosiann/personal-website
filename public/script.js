// Scroll-driven sections: the intro and tabs stay pinned while scrolling the page
// steps through Education → Experiences → … underneath them. Each section owns a
// stretch of scroll: a short hold, then (if it's taller than the panel) its content
// scrolls up inside the panel, then a pause before the next section takes over.
document.addEventListener('DOMContentLoaded', () => {
  const home = document.querySelector('.home');
  const track = home.querySelector('.scrolly');
  const stage = track.querySelector('.stage');
  const nav = stage.querySelector('nav');
  const panel = stage.querySelector('.panel');
  const cue = stage.querySelector('.scroll-cue');
  const tabs = [...nav.querySelectorAll('.nav-tab:not([hidden])')];
  const sections = tabs.map(tab => document.getElementById(tab.dataset.tab));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let segments = [];
  let trackTop = 0;
  let pinOffset = 0;
  let current = null;
  let frame = 0;

  home.classList.add('scrolly-on');

  function layout() {
    // Remember where we are within the current section so re-measuring (fonts
    // loading, rotating a phone, resizing the window) doesn't jump to another one.
    const progress = window.scrollY - trackTop - pinOffset;
    const anchor = segments.length && progress > 0 ? locate(progress) : null;

    // Pin the intro too when it leaves enough room for the sections; on short or
    // narrow screens let it scroll away first and pin just the tabs.
    stage.style.setProperty('--pin-offset', '0px');
    const viewport = stage.offsetHeight;
    const compact = panel.clientHeight < viewport * 0.4;
    pinOffset = compact ? Math.max(0, nav.offsetTop - 20) : 0;
    stage.style.setProperty('--pin-offset', `${pinOffset}px`);

    const panelHeight = panel.clientHeight;
    const hold = Math.max(240, Math.round(viewport * 0.4));
    // A lead-in with an empty panel comes first, so no section shows until you scroll.
    let start = Math.round(hold * 0.5);
    segments = sections.map(section => {
      const overflow = Math.max(0, section.offsetHeight - panelHeight);
      const segment = { start, hold, overflow, length: hold + overflow };
      start += segment.length;
      return segment;
    });

    track.style.height = `${stage.offsetHeight + start}px`;
    trackTop = track.getBoundingClientRect().top + window.scrollY;
    if (anchor && anchor.index >= 0) {
      const { start: sectionStart, length } = segments[anchor.index];
      window.scrollTo(0, trackTop + pinOffset + sectionStart + Math.min(anchor.local, length));
    }
    render();
  }

  // Which section a scroll distance falls in, and how far into it. Index -1 is the lead-in.
  function locate(progress) {
    let index = segments.length - 1;
    while (index > 0 && progress < segments[index].start) index--;
    if (progress < segments[0].start) return { index: -1, local: 0 };
    const { start, length } = segments[index];
    return { index, local: Math.min(Math.max(progress - start, 0), length) };
  }

  function render() {
    frame = 0;
    const { index, local } = locate(window.scrollY - trackTop - pinOffset);
    cue.classList.toggle('is-hidden', window.scrollY > 8);
    if (index < 0) {
      if (current !== -1) show(-1);
      panel.classList.remove('has-above', 'has-more');
      return;
    }
    const { hold, overflow, length } = segments[index];
    const shift = Math.min(Math.max(local - hold * 0.3, 0), overflow);

    if (index !== current) show(index);
    sections[index].style.transform = `translateY(${-shift}px)`;
    tabs[index].style.setProperty('--progress', (local / length).toFixed(4));
    panel.classList.toggle('has-above', shift > 1);
    panel.classList.toggle('has-more', shift < overflow - 1);
  }

  // index -1 shows no section and no active tab (the lead-in).
  function show(index) {
    current = index;
    sections.forEach((section, i) => {
      section.classList.toggle('visible', i === index);
      section.style.transform = '';
    });
    tabs.forEach((tab, i) => {
      tab.classList.toggle('active', i === index);
      if (i === index) {
        tab.setAttribute('aria-current', 'true');
      } else {
        tab.removeAttribute('aria-current');
        tab.style.setProperty('--progress', 0);
      }
    });
  }

  function scrollToSection(index, behavior) {
    const top = trackTop + pinOffset + segments[index].start + (index > 0 ? 1 : 0);
    window.scrollTo({ top, behavior });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', event => {
      event.preventDefault();
      scrollToSection(index, reduceMotion.matches ? 'auto' : 'smooth');
    });
  });

  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(render);
  }, { passive: true });
  // Re-measure whenever the viewport, the intro, or a section changes size.
  let pending = 0;
  const observer = new ResizeObserver(() => {
    if (!pending) pending = requestAnimationFrame(() => { pending = 0; layout(); });
  });
  [stage, stage.querySelector('header'), ...sections].forEach(el => observer.observe(el));

  layout();
  // Deep links (/#projects): the browser also jumps to the section's id on its own,
  // so land on the section after it does, both on page load and on hash changes.
  function landOnHash() {
    const index = tabs.findIndex(tab => `#${tab.dataset.tab}` === location.hash);
    if (index >= 0) scrollToSection(index, 'auto');
  }

  if (location.hash) {
    landOnHash();
    window.addEventListener('load', landOnHash, { once: true });
  }
  window.addEventListener('hashchange', landOnHash);
});
