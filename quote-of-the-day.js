// Quote of the day: every visitor sees the same quote on a given (local) day, and
// "Another quote" shuffles through the rest of the collection in /quotes.json
// (one object per quote: `text`, `who`, optional `src`; non-English quotes add
// `lang` plus an English `tr` translation). The dateline above it shows the
// visitor's own date, time, and time zone. The quote markup in index.html is the
// fallback if quotes.json can't be fetched (e.g. when opened via file://).
(() => {
  const root = document.querySelector('.quote');
  const textEl = root?.querySelector('.quote-text');
  const sourceEl = root?.querySelector('.quote-source');
  const clockEl = root?.querySelector('.quote-clock');
  const shuffleButton = root?.querySelector('[data-quote-shuffle]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let quotes = null;
  let current = null;
  let shuffled = false;
  let request = null;

  // One fetch shared by every caller; forgotten on failure so a later call can retry.
  const load = () => {
    request ||= fetch('/quotes.json')
      .then(response => {
        if (!response.ok) throw new Error(`quotes.json: HTTP ${response.status}`);
        return response.json();
      })
      .then(list => {
        if (!Array.isArray(list) || !list.length) throw new Error('quotes.json: expected a non-empty array');
        return list;
      })
      .catch(error => {
        request = null;
        throw error;
      });
    return request;
  };

  const dailyIndex = (date, count) => {
    const dayOfYear = Math.round(
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 864e5
    );
    return dayOfYear % count;
  };

  // Shared with the "See all quotes" drawer.
  window.quoteOfTheDay = {
    load,
    dailyIndex,
    show: index => {
      if (!root || !quotes || !quotes[index]) return;
      shuffled = true;
      render(index, true);
    },
    current: () => current,
  };

  if (!root) return;

  const quoteLine = q => `“${q.text}”`;
  const translationLine = q => ` (“${q.tr}”)`;
  const sourceLine = q => `— ${q.who}${q.src ? `, ${q.src}` : ''}`;

  function render(index, animate) {
    const q = quotes[index];
    current = index;

    const text = document.createElement('span');
    text.textContent = quoteLine(q);
    if (q.lang) text.lang = q.lang;
    textEl.replaceChildren(text);
    if (q.tr) {
      const translation = document.createElement('span');
      translation.className = 'quote-translation';
      translation.textContent = translationLine(q);
      textEl.append(translation);
    }
    // The name reads in black; the dash and the source stay grey.
    const who = document.createElement('span');
    who.className = 'quote-who';
    who.textContent = q.who;
    sourceEl.replaceChildren('— ', who, q.src ? `, ${q.src}` : '');

    if (animate && !reduceMotion.matches) {
      [textEl, sourceEl].forEach(el =>
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' })
      );
    }
  }

  // Dateline, e.g. "OCT 22nd 2026 | 07:00AM PT". Prefers the short generic zone
  // name (PT, ET) and falls back to an offset (GMT+9) where there isn't one.
  const ordinal = n => {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  };

  const zoneName = (date, style) => {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZoneName: style })
        .formatToParts(date)
        .find(part => part.type === 'timeZoneName')?.value;
    } catch {
      return undefined;
    }
  };

  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  let shownDay = new Date().toDateString();

  function tick() {
    const now = new Date();
    const parts = Object.fromEntries(timeFormat.formatToParts(now).map(part => [part.type, part.value]));
    const generic = zoneName(now, 'shortGeneric');
    const zone = generic && generic.length <= 4 ? generic : zoneName(now, 'short') || '';
    const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();

    clockEl.textContent = `${month} ${ordinal(now.getDate())} ${now.getFullYear()} | ${parts.hour}:${parts.minute}${parts.dayPeriod} ${zone}`.trim();
    clockEl.dateTime = now.toISOString();

    // Past midnight, roll over to the new day's quote unless the visitor has shuffled.
    if (now.toDateString() !== shownDay) {
      shownDay = now.toDateString();
      if (quotes && !shuffled) render(dailyIndex(now, quotes.length), true);
    }
  }

  // The clock runs whether or not the quotes load.
  tick();
  setTimeout(() => {
    tick();
    setInterval(tick, 60000);
  }, 60000 - (Date.now() % 60000));
  // Background tabs throttle timers, so catch up as soon as the page is visible again.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });

  load()
    .then(list => {
      quotes = list;
      const today = dailyIndex(new Date(), quotes.length);
      const q = quotes[today];
      // Only re-render when today's quote isn't already the fallback markup, so there's no flash.
      const showing = textEl.textContent === quoteLine(q) + (q.tr ? translationLine(q) : '') &&
        sourceEl.textContent === sourceLine(q);
      if (showing) current = today;
      else render(today, false);

      shuffleButton.hidden = false;
      shuffleButton.addEventListener('click', () => {
        let next = current;
        while (next === current && quotes.length > 1) next = Math.floor(Math.random() * quotes.length);
        shuffled = true;
        render(next, true);
        // One full turn of the refresh circle per shuffle (uses `rotate`, so it stacks on the hover turn).
        if (!reduceMotion.matches) {
          shuffleButton.querySelector('.quote-shuffle-icon')?.animate(
            [{ rotate: '0deg' }, { rotate: '360deg' }],
            { duration: 500, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
          );
        }
      });
    })
    .catch(() => {}); // Keep the fallback quote; "Another quote" stays hidden.
})();
