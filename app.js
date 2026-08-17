    // Reliably jump to a same-page anchor. `scroll-behavior: smooth` on <html>
    // doesn't always complete the browser's native hash-scroll — on initial page
    // load in particular, it can silently no-op. Anything that needs to land on
    // a section (sidebar links, search results) goes through this instead.
    function rbaJumpToHash(hash) {
      const id = hash.replace(/^#/, '');
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      // A target inside (or itself) a closed <details> — the "For developers"
      // disclosures — would scroll to a collapsed row. Open the chain first.
      let details = el.closest('details');
      while (details) {
        details.open = true;
        details = details.parentElement ? details.parentElement.closest('details') : null;
      }
      // The `behavior` option alone doesn't reliably beat the CSS scroll-behavior
      // rule in every engine, so force it via inline style for this one jump.
      const root = document.documentElement;
      const prevBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      el.scrollIntoView({ block: 'start' });
      root.style.scrollBehavior = prevBehavior;
    }
    // Any same-page hash navigation that isn't intercepted below (the task links on
    // the home page, for one) still needs the disclosure-opening jump.
    window.addEventListener('hashchange', () => rbaJumpToHash(location.hash));
    if (location.hash) {
      const hashToJump = location.hash;
      // Let any (possibly broken) native browser attempt at the hash-scroll
      // happen and finish first, so ours is the one that actually sticks.
      window.addEventListener('load', () => {
        setTimeout(() => {
          rbaJumpToHash(hashToJump);
          const link = document.querySelector('.sidebar-link[href="' + hashToJump + '"]');
          if (link) {
            document.querySelectorAll('.sidebar-link--active').forEach((l) => l.classList.remove('sidebar-link--active'));
            link.classList.add('sidebar-link--active');
          }
        }, 150);
      });
    }

    // ---- Search matching, shared by the icon and image pages ----
    // One set of rules, so "meetings" folds to "meeting" identically everywhere.
    //
    // Light word-form folding, applied to the QUERY only. Each variant can only
    // ADD matches — "meetings" also tries "meeting", "planning" tries "plan",
    // "shipped" tries "ship" — so a miss on the original spelling never hides a
    // hit, and the haystacks stay exactly what the content says.
    function rbaFoldVariants(t) {
      const v = [t];
      if (t.length > 3 && t.slice(-1) === 's' && t.slice(-2) !== 'ss') v.push(t.slice(0, -1));
      if (t.length > 4 && t.slice(-2) === 'es') v.push(t.slice(0, -2));
      // -ing/-ed stems shorter than 4 letters are dropped: "billing" usefully
      // tries "bill", but its doubled-consonant collapse "bil" is a substring
      // of "mobile" and floods the results with phones.
      if (t.length > 5 && t.slice(-3) === 'ing') {
        const s = t.slice(0, -3);
        if (s.length > 3) v.push(s, s + 'e');
        if (s.length > 4 && s.slice(-1) === s.slice(-2, -1)) v.push(s.slice(0, -1));
      }
      if (t.length > 4 && t.slice(-2) === 'ed') {
        const s = t.slice(0, -2);
        if (s.length > 3) v.push(s, s + 'e');
        if (s.length > 4 && s.slice(-1) === s.slice(-2, -1)) v.push(s.slice(0, -1));
      }
      return v;
    }
    const rbaFoundIn = (hay, t) => rbaFoldVariants(t).some(v => hay.indexOf(v) > -1);
    const rbaStartsWordIn = (words, t) => rbaFoldVariants(t).some(v => words.indexOf(' ' + v) > -1);
    // Edit distance <= 1, including a transposition ("tiem" -> "time"). One
    // shared-prefix walk instead of a full matrix: it only runs when a grid
    // would otherwise be empty, so it can afford to be simple.
    function rbaEd1(a, b) {
      const la = a.length, lb = b.length;
      if (Math.abs(la - lb) > 1) return false;
      let i = 0;
      while (i < la && i < lb && a[i] === b[i]) i++;
      if (i === la && i === lb) return true;
      if (la === lb) {
        if (a.slice(i + 1) === b.slice(i + 1)) return true;                        // substitution
        return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swap
      }
      const sh = la < lb ? a : b, lo = la < lb ? b : a;
      return sh.slice(i) === lo.slice(i + 1);                                      // insert/delete
    }

    // Scroll the sidebar so the active group (or scroll-spy'd link) sits just below
    // the top of the nav's own scroll area. The component groups are separate pages
    // and the sidebar is its own scroll container, so a normal navigation would reset
    // it to the top and drop the user far from the group they just opened. Returns the
    // active element (so the drawer can focus it) or null. No-op when the sidebar isn't
    // its own scroller (stacked no-JS mobile).
    function rbaRevealActiveNav() {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return null;
      const active = sidebar.querySelector('.sidebar-group--active') ||
                     sidebar.querySelector('.sidebar-link--active');
      if (!active) return null;
      if (sidebar.scrollHeight - sidebar.clientHeight > 4) {
        const delta = active.getBoundingClientRect().top - sidebar.getBoundingClientRect().top;
        sidebar.scrollTop = Math.max(0, sidebar.scrollTop + delta - 16);
      }
      return active;
    }

    // Sidebar scroll-spy · highlight the section closest to (and above) the viewport top
    (function () {
      const links = Array.from(document.querySelectorAll('.sidebar-link[href^="#"]'));
      if (!links.length) return;
      const linkBy = Object.fromEntries(links.map(l => [l.getAttribute('href').substring(1), l]));
      const sections = links
        .map(l => document.getElementById(l.getAttribute('href').substring(1)))
        .filter(Boolean);
      if (!sections.length) return;

      // Sort by document position so iteration matches scroll order
      sections.sort((a, b) =>
        (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1
      );

      // `undefined` rather than null so the first setActive(null) still runs and
      // clears whatever the markup shipped with.
      let currentId;
      // id may be null — "no section reached yet", which is a real state at the
      // top of the page and has to be expressible.
      function setActive(id) {
        if (id === currentId) return;
        currentId = id;
        links.forEach(l => l.classList.remove('sidebar-link--active'));
        if (id && linkBy[id]) linkBy[id].classList.add('sidebar-link--active');
      }

      function update() {
        // If we can't scroll further (or are within ~120 px of the bottom),
        // force the last section active so the tail of the page isn't stuck.
        const nearBottom = (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 120);
        if (nearBottom) {
          setActive(sections[sections.length - 1].id);
          return;
        }
        // "Active" = last section whose top has scrolled above the upper third of
        // the viewport. Starts at null, NOT at the first section: the hero and the
        // task cards sit above Colors, so seeding with sections[0] lit "Colors" on
        // load while the reader was still looking at the front door. Nothing is
        // highlighted until its section has actually been reached.
        const threshold = Math.max(120, window.innerHeight * 0.3);
        let bestId = null;
        for (const s of sections) {
          if (s.getBoundingClientRect().top - threshold <= 0) {
            bestId = s.id;
          } else {
            break;
          }
        }
        setActive(bestId);
      }

      let scheduled = false;
      function onScroll() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          update();
        });
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });

      // Snap immediately on click, and drive the scroll ourselves — see
      // rbaJumpToHash above for why the native hash-scroll can't be trusted.
      links.forEach(l => {
        l.addEventListener('click', (e) => {
          const id = l.getAttribute('href').substring(1);
          setActive(id);
          e.preventDefault();
          rbaJumpToHash('#' + id);
          history.pushState(null, '', '#' + id);
        });
      });

      update();
    })();

    // Theme toggle · light / dark, persisted across pages
    (function () {
      const KEY = 'rba-theme';
      const root = document.documentElement;
      const toggle = document.getElementById('theme-toggle');
      function apply(theme) {
        if (theme === 'dark') root.setAttribute('data-theme', 'dark');
        else root.removeAttribute('data-theme');
        if (toggle) {
          toggle.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
          // Both options are drawn in the track and the active one is styled off
          // [data-theme] in CSS, so nothing here swaps glyphs — the only job left
          // is keeping the switch's accessible name in step with what's shown.
          toggle.setAttribute('aria-label', theme === 'dark' ? 'Dark mode' : 'Light mode');
        }
      }
      let saved = null;
      try { saved = localStorage.getItem(KEY); } catch (e) {}
      let systemPrefersDark = false;
      try { systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
      apply(saved || (root.getAttribute('data-theme') === 'dark' || systemPrefersDark ? 'dark' : 'light'));
      if (toggle) {
        toggle.addEventListener('click', () => {
          const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
          apply(next);
          try { localStorage.setItem(KEY, next); } catch (e) {}
        });
      }
    })();

    // Responsive navigation · below the system's lg (1024) breakpoint the sidebar
    // becomes an off-canvas drawer (the Sheet pattern: scrim + side panel) opened
    // from a compact sticky bar. Everything here is additive — the [data-nav]
    // attribute is what switches the CSS on, so if this never runs the sidebar
    // just stacks above the content and stays usable.
    (function () {
      const sidebar = document.querySelector('.sidebar');
      const layout = document.querySelector('.app-layout');
      if (!sidebar || !layout) return;
      if (!sidebar.id) sidebar.id = 'sidebar-nav';

      const bar = document.createElement('header');
      bar.className = 'mobile-bar';
      bar.innerHTML =
        '<button type="button" class="mobile-bar-trigger" aria-expanded="false" aria-controls="' + sidebar.id + '" aria-label="Open navigation">' +
          '<span class="material-symbols-rounded" aria-hidden="true">menu</span>' +
        '</button>' +
        '<span class="mobile-bar-title">Connect <span class="wordmark-soft">Design System</span></span>';
      layout.parentNode.insertBefore(bar, layout);

      const scrim = document.createElement('div');
      scrim.className = 'nav-scrim';
      document.body.appendChild(scrim);

      const trigger = bar.querySelector('.mobile-bar-trigger');
      const icon = trigger.querySelector('.material-symbols-rounded');
      let lastFocus = null;

      const isDrawerMode = () => window.matchMedia('(max-width: 1023.98px)').matches;
      const isOpen = () => sidebar.classList.contains('sidebar--open');

      function focusables() {
        return Array.from(sidebar.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'))
          .filter(el => el.offsetParent !== null);
      }

      function open() {
        lastFocus = document.activeElement;
        sidebar.classList.add('sidebar--open');
        scrim.classList.add('nav-scrim--visible');
        trigger.setAttribute('aria-expanded', 'true');
        trigger.setAttribute('aria-label', 'Close navigation');
        icon.textContent = 'close';
        document.body.style.overflow = 'hidden';
        // Land on the current section: reveal the active group and focus it, so the
        // focus trap has a target without .focus() scrolling the drawer back to the top.
        const active = rbaRevealActiveNav();
        if (active && active.focus) {
          active.focus();
          rbaRevealActiveNav(); // re-correct: focus() may nudge the scroll position
        } else {
          const f = focusables();
          if (f.length) f[0].focus();
        }
      }

      function close(returnFocus) {
        sidebar.classList.remove('sidebar--open');
        scrim.classList.remove('nav-scrim--visible');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', 'Open navigation');
        icon.textContent = 'menu';
        document.body.style.overflow = '';
        if (returnFocus !== false && lastFocus && lastFocus.focus) lastFocus.focus();
      }

      trigger.addEventListener('click', () => { isOpen() ? close() : open(); });
      scrim.addEventListener('click', () => close());

      // Following a link should reveal the destination, not leave the drawer over it.
      sidebar.addEventListener('click', (e) => {
        if (e.target.closest('a') && isDrawerMode() && isOpen()) close(false);
      });

      document.addEventListener('keydown', (e) => {
        if (!isOpen()) return;
        if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
        if (e.key !== 'Tab') return;
        // Keep focus inside the drawer while it's acting as a modal surface.
        const f = focusables();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }, true);

      // Crossing back above lg (window resize, tablet rotation) must never leave
      // the page scroll-locked or the drawer half-open. matchMedia fires exactly
      // on the breakpoint crossing; a bare resize listener proved unreliable and
      // could strand the desktop page with body overflow:hidden.
      const mq = window.matchMedia('(max-width: 1023.98px)');
      const syncToBreakpoint = () => { if (!mq.matches) close(false); };
      if (mq.addEventListener) mq.addEventListener('change', syncToBreakpoint);
      else if (mq.addListener) mq.addListener(syncToBreakpoint);
      window.addEventListener('resize', syncToBreakpoint);

      document.documentElement.setAttribute('data-nav', 'drawer');
    })();

    // Sidebar continuity across pages · on the desktop column, keep the active group
    // in view instead of resetting to the top of the nav (the mobile drawer handles
    // this itself, on open, in the drawer IIFE above).
    rbaRevealActiveNav();                                 // sync — set before first paint to avoid a jump
    window.addEventListener('load', rbaRevealActiveNav);  // re-run once web fonts settle row heights

    // Search · Cmd/Ctrl+K palette across every section of the system
    (function () {
      // One entry per section. The keywords field is what makes this useful for
      // people who don't know our vocabulary — someone hunting the deck template
      // searches "powerpoint", not "templates".
      const INDEX = [
        { title: 'Colors',            category: 'Foundations', page: 'index.html',     anchor: '#colors',   keywords: 'palette hex rgb hsl cmyk print css var format swatch red midnight navy aqua blue grey gradient token' },
        { title: 'Typography',        category: 'Foundations', page: 'index.html',     anchor: '#type',     keywords: 'font fonts typeface montserrat libre caslon serif sans type scale heading body' },
        { title: 'RBA logos',         category: 'Foundations', page: 'index.html',     anchor: '#logo',     keywords: 'logo logos mark wordmark monogram clear space reversed colorway svg rba' },
        { title: 'Voice',             category: 'Foundations', page: 'index.html',     anchor: '#voice',    keywords: 'tone voice writing copy words banned jargon buzzwords style wording language proposal' },
        { title: 'Components',        category: 'Build',       page: 'components.html', anchor: '',         keywords: 'button buttons card cards cta stat stats bullet list layout spacing padding radius corner shadow spec token tokens accent line bar section' },
        { title: 'Icons',             category: 'Library',     page: 'icons.html',     anchor: '',          keywords: 'icon iconography glyph symbol svg png outline line download library chart people finance data document technology' },
        { title: 'Logo library',      category: 'Library',     page: 'logo-library.html', anchor: '',      keywords: 'logo logos partner partners partnership platform platforms client clients customer vendor technology stack certification badge accreditation microsoft azure aws sitecore umbraco optimizely coveo databricks snowflake bigcommerce wordpress github react python java nonprofit community rba cares black color color mono svg png trademark download' },
        { title: 'Brand images',      category: 'Library',     page: 'images.html',    anchor: '',          keywords: 'photo photography image picture illustration stock download' },
        { title: 'Templates & decks', category: 'Library',     page: 'templates.html', anchor: '',          keywords: 'powerpoint pptx deck slides word docx template letterhead document download' },
        { title: 'Device mockups',    category: 'Library',     page: 'templates.html', anchor: '#mockups',  keywords: 'mockup mockups phone tablet browser device frame shots screenshot status bar' },
      ];

      const overlay = document.getElementById('search-overlay');
      const input = document.getElementById('search-input');
      const results = document.getElementById('search-results');
      const trigger = document.getElementById('search-trigger');
      if (!overlay || !input || !results) return;

      let activeIndex = -1;
      let filtered = [];
      let previouslyFocused = null;

      function currentPage() {
        const p = location.pathname.split('/').pop();
        return p === '' ? 'index.html' : p;
      }

      function setActive(i) {
        activeIndex = i;
        Array.from(results.children).forEach((el, idx) => {
          const isActive = idx === i;
          el.classList.toggle('search-result-item--active', isActive);
          if (el.id) el.setAttribute('aria-selected', String(isActive));
        });
        const el = results.children[i];
        if (el) {
          el.scrollIntoView({ block: 'nearest' });
          input.setAttribute('aria-activedescendant', el.id);
        } else {
          input.removeAttribute('aria-activedescendant');
        }
      }

      function go(item) {
        close();
        if (item.page === currentPage()) {
          // Already here — an empty anchor (e.g. the page's own index entry)
          // means there's nothing left to do but close, not reload the page
          // we're already on.
          if (item.anchor) {
            rbaJumpToHash(item.anchor);
            history.pushState(null, '', item.anchor);
          }
        } else {
          location.href = item.page + item.anchor;
        }
      }

      function render(list) {
        filtered = list;
        results.innerHTML = '';
        if (!list.length) {
          results.innerHTML = '<p class="search-empty">No matches.</p>';
          activeIndex = -1;
          input.removeAttribute('aria-activedescendant');
          return;
        }
        list.forEach((item, i) => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'search-result-item';
          row.id = 'search-result-' + i;
          row.setAttribute('role', 'option');
          row.setAttribute('aria-selected', 'false');
          row.setAttribute('tabindex', '-1');
          row.innerHTML =
            '<span class="search-result-title"></span><span class="search-result-category"></span>';
          row.querySelector('.search-result-title').textContent = item.title;
          row.querySelector('.search-result-category').textContent = item.category;
          row.addEventListener('mouseenter', () => setActive(i));
          row.addEventListener('click', () => go(item));
          results.appendChild(row);
        });
        setActive(0);
      }

      function filter(query) {
        const q = query.trim().toLowerCase();
        if (!q) return render(INDEX);
        // Keywords are searched but never displayed — they exist so "pptx" finds
        // Templates and "hex" finds Colors, without cluttering the result rows.
        render(INDEX.filter((i) =>
          i.title.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.keywords || '').includes(q)
        ));
      }

      function open() {
        previouslyFocused = document.activeElement;
        overlay.hidden = false;
        input.value = '';
        input.setAttribute('aria-expanded', 'true');
        render(INDEX);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => input.focus());
      }
      function close() {
        overlay.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        document.body.style.overflow = '';
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus();
        }
        previouslyFocused = null;
      }

      if (trigger) trigger.addEventListener('click', open);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
      input.addEventListener('input', () => filter(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActive(Math.min(activeIndex + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActive(Math.max(activeIndex - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filtered[activeIndex]) go(filtered[activeIndex]);
        } else if (e.key === 'Tab') {
          // Result rows aren't tab-stops (arrow keys drive selection), so the
          // input is the only focusable element in the dialog — trap Tab here
          // rather than letting it escape to the page underneath.
          e.preventDefault();
        } else if (e.key === 'Escape') {
          close();
        }
      });
      document.addEventListener('keydown', (e) => {
        const isTypingField = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
        if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          overlay.hidden ? open() : close();
        } else if (e.key === '/' && !isTypingField) {
          e.preventDefault();
          open();
        } else if (e.key === 'Escape' && !overlay.hidden) {
          close();
        }
      });
    })();

    // Clipboard helper + toast · shared by code blocks and token swatches.
    function rbaToast(message) {
      let toast = document.getElementById('rba-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'rba-toast';
        toast.className = 'rba-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      // force reflow so re-triggering restarts the transition
      void toast.offsetWidth;
      toast.classList.add('rba-toast--visible');
      clearTimeout(toast._rbaTimer);
      toast._rbaTimer = setTimeout(() => {
        toast.classList.remove('rba-toast--visible');
      }, 1800);
    }
    function rbaCopy(text, message) {
      const done = () => rbaToast(message || 'Copied');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => rbaCopyFallback(text, done));
      } else {
        rbaCopyFallback(text, done);
      }
    }
    function rbaCopyFallback(text, done) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* no-op */ }
      document.body.removeChild(ta);
      done();
    }
    // ---- Color formats ------------------------------------------------------
    // The markup ships hex and nothing else; RGB, HSL, CMYK and the var() form are
    // all derived from it here. Writing five strings per colour into the HTML would
    // have been less code and five more places for a palette correction to be
    // missed — and this page already argues, in the token table, that a colour
    // should have exactly one authoritative value.
    function hexToRgb(hex) {
      const h = String(hex).replace('#', '');
      const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
      return [parseInt(full.slice(0, 2), 16),
              parseInt(full.slice(2, 4), 16),
              parseInt(full.slice(4, 6), 16)];
    }
    function fmtRgb(hex) {
      const c = hexToRgb(hex);
      return 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';
    }
    function fmtHsl(hex) {
      const c = hexToRgb(hex).map((v) => v / 255);
      const max = Math.max(c[0], c[1], c[2]);
      const min = Math.min(c[0], c[1], c[2]);
      const d = max - min;
      const l = (max + min) / 2;
      let h = 0;
      if (d) {
        if (max === c[0]) h = ((c[1] - c[2]) / d) % 6;
        else if (max === c[1]) h = (c[2] - c[0]) / d + 2;
        else h = (c[0] - c[1]) / d + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
      }
      const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
      return 'hsl(' + h + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%)';
    }
    // The plain sRGB→CMYK formula, which is a conversion and not a colour match:
    // it knows nothing about ink, stock or press profile. Published anyway because
    // a brand palette with no print numbers at all sends people to eyedrop a JPEG,
    // which is worse — but the hint line under the switch says plainly what this
    // is, and that caveat travels with the format.
    function fmtCmyk(hex) {
      const c = hexToRgb(hex).map((v) => v / 255);
      const k = 1 - Math.max(c[0], c[1], c[2]);
      const ink = (v) => (k === 1 ? 0 : Math.round(((1 - v - k) / (1 - k)) * 100));
      return 'C' + ink(c[0]) + ' M' + ink(c[1]) + ' Y' + ink(c[2]) + ' K' + Math.round(k * 100);
    }

    // Each format carries the reason you would pick it, not a definition of itself.
    // "HSL is hue, saturation, lightness" helps nobody standing in front of five
    // buttons; "the one PowerPoint's colour picker wants" is the actual question.
    const RBA_FORMATS = {
      hex:  { value: (hex) => hex,
              hint: 'What Figma, Office and most web tools expect.' },
      rgb:  { value: fmtRgb,
              hint: 'CSS, and the R / G / B boxes in PowerPoint, Word and the Adobe apps.' },
      hsl:  { value: fmtHsl,
              hint: 'CSS. Same hue, and you can lighten or darken it by moving one number.' },
      cmyk: { value: fmtCmyk,
              hint: 'For print. Converted from sRGB here — a straight conversion, not a press-matched value, so confirm it with your printer before a run.' },
      var:  { value: (hex, token) => (token ? 'var(' + token + ')' : hex),
              hint: 'The stylesheet token. Reference this rather than a raw value, so a palette correction lands everywhere at once.' }
    };

    // Click-to-copy across the Colors section, in whichever format is selected.
    (function () {
      const STORE = 'rba-color-format';
      const HEX = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;

      function txt(root, sel) {
        const el = root.querySelector(sel);
        return el ? el.textContent.trim() : '';
      }

      // Three shapes, one behaviour. The palette board and the chart series each
      // keep their token beside the value; in the token table the token IS the row
      // heading, so it comes off the row rather than out of the button.
      const items = [];
      document.querySelectorAll('.palette-swatch').forEach((el) => {
        items.push({ el: el,
                     valueEl: el.querySelector('.palette-swatch-value'),
                     tokenEl: el.querySelector('.palette-swatch-token'),
                     name: txt(el, '.palette-swatch-name'),
                     token: txt(el, '.palette-swatch-token') });
      });
      document.querySelectorAll('.viz-swatch-btn').forEach((el) => {
        items.push({ el: el,
                     valueEl: el.querySelector('.viz-swatch-value'),
                     tokenEl: el.querySelector('.viz-swatch-token'),
                     name: txt(el, '.viz-swatch-name'),
                     token: txt(el, '.viz-swatch-token') });
      });
      document.querySelectorAll('.token-table .token-copy').forEach((el) => {
        const row = el.closest('tr');
        const token = row ? txt(row, '.token-name') : '';
        items.push({ el: el,
                     valueEl: el.querySelector('.token-value'),
                     tokenEl: null,
                     name: token,
                     token: token });
      });

      // Anything whose printed value is not a single hex is left alone — the
      // gradient row and the "--viz-1 … --viz-8" summary row both describe a set
      // rather than a colour, and there is nothing to convert.
      const live = items.filter((it) => it.valueEl && HEX.test(it.valueEl.textContent.trim()));
      live.forEach((it) => {
        it.hex = it.valueEl.textContent.trim();
        // The palette swatches are real <button>s already; joining them to the
        // delegated handler below is cheaper than a second copy path that has to
        // be kept in step with this one.
        it.el.classList.add('js-copy-hex');
      });

      function apply(key) {
        const fmt = RBA_FORMATS[key] || RBA_FORMATS.hex;
        live.forEach((it) => {
          const value = fmt.value(it.hex, it.token);
          it.valueEl.textContent = value;
          it.el.setAttribute('data-copy', value);
          // The token table's row heading IS the token, so in var() mode the name
          // and the value are the same string — "Copy --rba-red, var(--rba-red)"
          // is a screen reader reading one fact twice.
          const named = it.name && value.indexOf(it.name) < 0;
          it.el.setAttribute('aria-label', 'Copy ' + (named ? it.name + ', ' : '') + value);
          // In var() mode the token is the value. Printing it twice on one line
          // reads as two facts about the colour when it is one.
          if (it.tokenEl) it.tokenEl.classList.toggle('is-hidden', key === 'var');
        });
      }

      document.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.js-copy-hex');
        if (!btn) return;
        const value = btn.getAttribute('data-copy');
        if (value) rbaCopy(value, 'Copied ' + value);
      });

      const box = document.querySelector('.format-switch');
      if (!box) { apply('hex'); return; }
      const btns = Array.prototype.slice.call(box.querySelectorAll('.format-switch-btn'));
      const hint = box.querySelector('.format-switch-hint');

      function select(key, moveFocus) {
        btns.forEach((b) => {
          const on = b.getAttribute('data-format') === key;
          b.setAttribute('aria-checked', on ? 'true' : 'false');
          // Roving tabindex: a radiogroup is one tab stop, and the arrow keys move
          // within it. Five separate tab stops would put the palette four presses
          // further from the keyboard than it is now.
          b.tabIndex = on ? 0 : -1;
          if (on && moveFocus) b.focus();
        });
        if (hint) hint.textContent = (RBA_FORMATS[key] || RBA_FORMATS.hex).hint;
        apply(key);
        try { localStorage.setItem(STORE, key); } catch (e) { /* private mode */ }
      }

      btns.forEach((b) => {
        b.addEventListener('click', () => select(b.getAttribute('data-format'), false));
      });
      box.addEventListener('keydown', (ev) => {
        const i = btns.indexOf(document.activeElement);
        if (i < 0) return;
        let n = -1;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') n = (i + 1) % btns.length;
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') n = (i - 1 + btns.length) % btns.length;
        if (ev.key === 'Home') n = 0;
        if (ev.key === 'End') n = btns.length - 1;
        if (n < 0) return;
        ev.preventDefault();
        select(btns[n].getAttribute('data-format'), true);
      });

      // Someone who works in print picks CMYK once and wants it still selected
      // next visit. Same try/catch as the theme toggle — Safari in private mode
      // throws on setItem rather than returning null.
      let saved = '';
      try { saved = localStorage.getItem(STORE) || ''; } catch (e) { /* private mode */ }
      select(RBA_FORMATS[saved] ? saved : 'hex', false);
    })();

    // Version and published date · both stamped at deploy time, neither maintained by hand.
    //
    // .github/workflows/deploy.yml rewrites the two constants below on every push to main
    // and then publishes, so what the page shows is always what was actually deployed.
    // RBA_VERSION is 1.<number of commits on main>, which increments on its own; the date
    // is the deploy date. Keep both on one line, in this exact shape — the workflow's sed
    // depends on it, and so does tools/build-bundles.sh for the bundle stamp.
    //
    // The placeholders are what you see when running from a working copy that has never
    // been deployed. That is deliberate: "dev" is more honest than a stale number.
    const RBA_VERSION   = 'dev';
    const RBA_PUBLISHED = 'not yet published';
    (function () {
      // The rail prints the date only. The version is still stamped and still worth
      // having when someone is working out which build they are looking at, so it
      // moves to the title rather than being dropped.
      const label = RBA_VERSION === 'dev'
        ? 'Dev build · not published'
        : 'Published ' + RBA_PUBLISHED;
      document.querySelectorAll('.js-release').forEach(el => {
        el.textContent = label;
        if (RBA_VERSION !== 'dev') el.title = 'v' + RBA_VERSION;
      });
    })();

    // The bundle build date used to be printed next to every "download all" button —
    // the zips under downloads/ are pre-built and committed, because a static host
    // can't zip on request, which makes staleness the one real failure mode. It was
    // removed because it crowded the buttons with a date nobody was checking, and a
    // date only helps if you already know when the assets last changed. Staleness is
    // now handled where it is actually visible: tools/build-bundles.sh reports what
    // it wrote, and the README makes rebuilding part of adding an asset.
    //
    // If it comes back, it needs to come back in all three places at once: the
    // markup, the constant here, and the stamping step in build-bundles.sh.

    // Icon library · 1,490 icons in 80 packs, rendered from the manifest that
    // tools/icons-sync.py writes into the bottom of icons.html.
    //
    // The manifest stores PACKS, not icons: every file is <slug>-NN.svg alongside
    // <slug>-NN.png, so a pack plus a count reconstructs every path. That keeps the
    // inlined block at 13 KB instead of the ~200 KB a flat list of 1,490 rows would
    // cost — and inlined it must be, because a fetch() of a local file is blocked by
    // the file:// origin rules and would leave the grid empty for anyone who
    // downloaded the repo rather than visiting the hosted site.
    //
    // Two things here exist purely because of the scale:
    //
    //   1. Masks load lazily. A tile paints its glyph with a CSS mask, and 1,490 tiles
    //      all carrying a mask URL is 1,490 requests the moment the page opens. An
    //      IntersectionObserver sets --icon only as a tile nears the viewport, so the
    //      cost tracks what is actually looked at. Without this the page issues its
    //      whole request budget on a set nobody scrolls to the end of.
    //   2. Filtering toggles .hidden on existing tiles rather than re-rendering. The
    //      tiles are built once; re-creating them on every keystroke would rebuild
    //      13,000 nodes per character typed.
    (function () {
      const grid = document.getElementById('icon-grid');
      const dataEl = document.getElementById('icon-manifest');
      if (!grid || !dataEl) return;                 // no-ops on every other page

      let packs = [], thesaurus = {};
      try {
        const data = JSON.parse(dataEl.textContent) || {};
        packs = data.packs || [];
        // Word-level, not per-icon: names are compositional (invoice-paid =
        // invoice + paid), so ~850 word entries cover all 1,490 icons, and
        // improving one word's synonyms improves every icon that uses it.
        thesaurus = data.thesaurus || {};
      } catch (e) {
        grid.innerHTML = '<p class="lib-empty">The icon manifest could not be read. ' +
                         'View source and check the <code>#icon-manifest</code> block.</p>';
        return;
      }

      // Hyphens and underscores become spaces so a typed query and a written name
      // meet in the middle: "pie chart", "pie-chart" and "Pie Chart" are one thing.
      const flatten = s => s.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

      // Flatten packs into icons, precomputing the search haystacks once. Doing it per
      // keystroke across 1,490 rows is the difference between a filter that feels
      // instant and one that stutters.
      const icons = [];
      const groups = [];
      packs.forEach(pack => {
        if (groups.indexOf(pack.group) < 0) groups.push(pack.group);
        const labels = pack.labels || {};
        for (let i = 1; i <= pack.count; i++) {
          const num = i < 10 ? '0' + i : String(i);
          const base = 'assets/icons/' + pack.slug + '/' + pack.slug + '-' + num;
          // A hand-written label wins over the generated name, but both stay
          // searchable — someone who knows it as "Finance-04" should still find it
          // after it has been renamed to "invoice-paid".
          const label = labels[num] || '';
          const filed = pack.name + '-' + num;
          icons.push({
            pack: pack,
            name: label || filed,
            // Named icons lose the pack from their visible label, and names repeat
            // across packs on purpose — a handshake in Collaboration and one in
            // Client are both handshakes. The tooltip carries what the tile no
            // longer shows, so two identical labels are still tellable apart.
            title: label ? label + ' · ' + pack.name + ' · ' + filed : filed,
            svg: base + '.svg',
            png: base + '.png',
            // Two haystacks, both hyphen-flattened. Flattening is what lets "pie
            // chart" find pie-chart-dollar — names are hyphenated and queries are
            // typed with spaces, and a plain substring test bridges neither.
            //
            // They are separate because a name match and a pack-keyword match are
            // not worth the same. "wallet" is a keyword on the whole Fintech pack,
            // so without this the three actual wallet icons sit behind sixteen
            // icons that merely belong to a pack that mentions wallets.
            nameHay: flatten(label + ' ' + filed),
            // Leading space on every word, so indexOf(' ' + term) is a word-start
            // test without a regex per keystroke per icon.
            nameWords: ' ' + flatten(label + ' ' + filed).split(' ').join('  '),
            hay: flatten(label + ' ' + filed + ' ' + pack.name + ' ' +
                         pack.group + ' ' + pack.keywords),
            // The thesaurus expansion of the name's words: what people type when
            // they don't know the name. "invoice-paid" grows "bill billing receipt
            // statement payment settled", so a search for "billing" still lands.
            // Kept separate from hay so a synonym match ranks BELOW a name match
            // and never outranks the icon someone asked for by name.
            synHay: (function () {
              let syn = '';
              flatten(label + ' ' + filed).split(' ').forEach(function (w) {
                if (thesaurus[w]) syn += ' ' + thesaurus[w];
              });
              return syn ? ' ' + flatten(syn) : '';
            })(),
          });
        }
      });

      // Lazy masks. rootMargin buys roughly a screen of runway so tiles are painted
      // before they are scrolled into, not as they arrive.
      const io = 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if (!entry.isIntersecting) return;
              paint(entry.target);
              io.unobserve(entry.target);
            });
          }, { rootMargin: '600px 0px' })
        : null;

      // Once every tile is painted there is nothing left for a sweep to find, and a
      // scroll handler that walks 1,490 nodes to conclude that is pure waste. The
      // count lives here rather than in sweep() because the observer paints too, and
      // a counter that only sweep() decremented would never reach zero.
      let unpainted = Infinity;   // set to the real total once the grid is built
      function paint(glyph) {
        if (glyph.dataset.painted) return;
        glyph.dataset.painted = '1';
        glyph.style.setProperty('--icon', 'url("' + glyph.dataset.src + '")');
        unpainted--;
      }

      // Say so when the glyphs cannot be fetched, instead of showing 1,490 empty
      // boxes and leaving someone to guess.
      //
      // A CSS mask fails SILENTLY and INVISIBLY: if the image 404s or the network
      // is gone, the mask resolves to nothing, which masks the element out
      // completely. The tile keeps its border, its label and its download buttons,
      // and the icon is simply absent — indistinguishable from "the icons were
      // never built". This page was reported as broken three times on exactly that
      // ambiguity, and the actual cause was mundane: the dev server had stopped,
      // the HTML, CSS and JS were still being served from browser cache, and only
      // the 1,454 icon files that had never been fetched were failing.
      //
      // One probe, not 1,490. If the first icon cannot load, none of them can.
      (function warnIfUnreachable() {
        if (!icons.length) return;
        const probe = new Image();
        probe.onerror = () => {
          const box = document.createElement('p');
          box.className = 'lib-offline';
          box.setAttribute('role', 'status');
          box.innerHTML =
            '<strong>The icon files could not be loaded.</strong> The page itself is ' +
            'fine — it is the 1,490 SVGs behind it that are not answering, which is ' +
            'almost always the local server having stopped. Restart it and reload. ' +
            'If it is running, check that <code></code> is reachable.';
          box.querySelector('code').textContent = icons[0].svg;
          grid.parentNode.insertBefore(box, grid);
        };
        probe.src = icons[0].svg;
      })();

      // Icons are painted with a CSS mask, not an <img>. An <img> renders the file's
      // own colors and can't inherit currentColor, so a single monochrome file could
      // not follow the theme — dark mode would need a second copy of all 1,490. The
      // mask paints the file's alpha with the tile's own color instead, so one file
      // serves both themes and stays a normal downloadable SVG.
      function iconTile(item) {
        const cell = document.createElement('div');
        cell.className = 'glyph-cell';
        cell.setAttribute('data-file', item.svg);
        cell.title = item.title;

        const glyph = document.createElement('span');
        glyph.className = 'glyph-cell-glyph';
        glyph.dataset.src = item.svg;
        glyph.setAttribute('role', 'img');
        glyph.setAttribute('aria-label', item.name);
        if (io) io.observe(glyph); else paint(glyph);

        const name = document.createElement('span');
        name.className = 'glyph-cell-name';
        name.textContent = item.name;

        // Plain anchors, not buttons: right-click "save as", middle-click and
        // keyboard all work for free, and the browser handles the download without
        // any of this script needing to run a second time.
        const actions = document.createElement('span');
        actions.className = 'glyph-cell-actions';
        [['SVG', item.svg], ['PNG', item.png]].forEach(pair => {
          const a = document.createElement('a');
          a.className = 'glyph-dl';
          a.href = pair[1];
          a.setAttribute('download', '');
          a.textContent = pair[0];
          a.setAttribute('aria-label', 'Download ' + item.name + ' as ' + pair[0]);
          actions.appendChild(a);
        });

        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'glyph-cell-copy js-copy-svg';
        copy.setAttribute('data-file', item.svg);
        copy.title = 'Copy SVG markup';
        copy.setAttribute('aria-label', 'Copy the SVG markup for ' + item.name);
        copy.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">content_copy</span>';

        cell.append(glyph, name, actions, copy);
        return cell;
      }

      // Counted from the manifest rather than written into the page, so the callout
      // can't drift from reality as packs get named a few at a time.
      const namedCount = packs.reduce((n, p) => n + Object.keys(p.labels || {}).length, 0);
      document.querySelectorAll('.js-naming-progress').forEach(el => {
        el.textContent = namedCount >= icons.length
          ? 'Every icon has a real name.'
          : namedCount.toLocaleString() + ' of ' + icons.length.toLocaleString() +
            ' icons have real names so far.';
      });

      const scope = grid.closest('.lib-scope') || document;
      const search = scope.querySelector('.lib-search-input');
      const chips = scope.querySelector('.lib-filter');
      const count = scope.querySelector('.lib-count');
      let activeGroup = 'all';

      if (chips) {
        const mk = (value, label, pressed) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'lib-filter-btn';
          b.setAttribute('data-filter', value);
          b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
          b.textContent = label;
          return b;
        };
        chips.appendChild(mk('all', 'All', true));
        groups.forEach(g => chips.appendChild(mk(g, g, false)));
        chips.addEventListener('click', ev => {
          const btn = ev.target.closest('.lib-filter-btn');
          if (!btn) return;
          activeGroup = btn.getAttribute('data-filter');
          chips.querySelectorAll('.lib-filter-btn').forEach(b => {
            b.setAttribute('aria-pressed', String(b === btn));
          });
          apply();
        });
      }

      // Folding and matching live at the top of the file now, shared with the
      // image search so both pages answer a query by the same rules.
      const variants = rbaFoldVariants;
      const foundIn = rbaFoundIn;
      const startsWordIn = rbaStartsWordIn;

      // The correction vocabulary: every word the search could possibly match,
      // built once on the first zero-result query rather than up front — most
      // sessions never misspell anything.
      let vocabArr = null, allHay = null;
      function vocab() {
        if (!vocabArr) {
          const s = new Set();
          icons.forEach(it => (it.hay + it.synHay).split(' ').forEach(w => {
            if (w.length > 2) s.add(w);
          }));
          vocabArr = Array.from(s);
        }
        return vocabArr;
      }
      const anywhere = t => {
        if (allHay === null) allHay = icons.map(i => i.hay + i.synHay).join(' ');
        return foundIn(allHay, t);
      };
      const ed1 = rbaEd1;
      function correctTerm(t) {
        if (t.length < 4) return null;   // 1 edit in a 3-letter word is a different word
        const words = vocab();
        let best = null;
        for (let i = 0; i < words.length; i++) {
          if (ed1(t, words[i])) {
            // Same first letter is almost always the intended word ("securty" ->
            // "security", not "purity"); settle for any hit only if nothing shares it.
            if (words[i][0] === t[0]) return words[i];
            if (!best) best = words[i];
          }
        }
        return best;
      }

      // One scoring pass over all icons. allMode=true demands every term; false is
      // the any-word fallback, where icons matching more of the words sort first.
      function evaluate(terms, allMode) {
        const tiers = new Array(icons.length);
        let shown = 0;
        for (let i = 0; i < icons.length; i++) {
          const item = icons[i];
          const inScope = activeGroup === 'all' || item.pack.group === activeGroup;
          let tier = -1;
          if (inScope) {
            if (!terms.length) tier = 0;
            else if (allMode) {
              const full = item.hay + item.synHay;
              if (terms.every(t => foundIn(full, t))) {
                // Four tiers, because substring matching alone ranks badly once
                // every icon has a name. "owl" is inside "bowl", so a plain
                // contains-test buries owl-graduation-cap under compass-bowl.
                //   0 — every term starts a word in the name  (owl → owl-graduation-cap)
                //   1 — every term appears in the name at all (owl → compass-bowl)
                //   2 — matched through the name's synonyms   (billing → invoice-paid)
                //   3 — matched only through the pack's keywords
                if (terms.every(t => startsWordIn(item.nameWords, t))) tier = 0;
                else if (terms.every(t => foundIn(item.nameHay, t))) tier = 1;
                else if (terms.every(t => foundIn(item.nameHay + item.synHay, t))) tier = 2;
                else tier = 3;
              }
            } else {
              const full = item.hay + item.synHay;
              const matched = terms.filter(t => foundIn(full, t)).length;
              // Rank by how many of the words hit; every icon here failed the
              // all-words test, so matched is always < terms.length.
              if (matched) tier = terms.length - matched;
            }
          }
          tiers[i] = tier;
          if (tier > -1) shown++;
        }
        return { tiers: tiers, shown: shown };
      }

      // The graceful-degradation note. Sits between the toolbar and the grid, and
      // only speaks when the search had to loosen something to find results.
      const noteEl = document.createElement('p');
      noteEl.className = 'lib-search-note';
      noteEl.setAttribute('role', 'status');
      noteEl.hidden = true;
      grid.parentNode.insertBefore(noteEl, grid);

      function apply() {
        // Every word must appear, in any order: "invoice review" and "review
        // invoice" both land on invoice-review, and each extra word narrows rather
        // than widening.
        const rawTerms = search ? flatten(search.value).split(' ').filter(Boolean) : [];
        let result = evaluate(rawTerms, true);
        let note = '';

        // An empty grid teaches nothing, so before showing one, loosen in two
        // honest steps and SAY what was loosened:
        //   1. respell terms that match nothing anywhere ("securty" → "security")
        //   2. drop the all-words requirement and rank by words matched
        if (!result.shown && rawTerms.length) {
          const corrected = rawTerms.map(t => anywhere(t) ? t : (correctTerm(t) || t));
          const respelled = corrected.join(' ') !== rawTerms.join(' ');
          if (respelled) {
            const r = evaluate(corrected, true);
            if (r.shown) {
              result = r;
              note = 'Nothing matches “' + rawTerms.join(' ') + '” — showing results for “' +
                     corrected.join(' ') + '”.';
            }
          }
          if (!result.shown && rawTerms.length > 1) {
            const terms = respelled ? corrected : rawTerms;
            const r = evaluate(terms, false);
            if (r.shown) {
              result = r;
              note = 'No icon matches all of “' + terms.join(' ') + '” — showing icons that match any of the words, best first.';
            }
          }
        }

        const cells = grid.children;
        for (let i = 0; i < icons.length; i++) {
          const tier = result.tiers[i];
          cells[i].hidden = tier < 0;
          // CSS order rather than reordering nodes: moving up to 1,490 elements on
          // every keystroke would cost far more than setting one property on the
          // ones still showing.
          cells[i].style.order = (tier > 0 && rawTerms.length) ? String(tier) : '';
        }
        noteEl.textContent = note;
        noteEl.hidden = !note;
        if (count) {
          const n = result.shown.toLocaleString();
          count.textContent = result.shown === icons.length
            ? n + ' icons'
            : n + ' of ' + icons.length.toLocaleString() + ' icons';
        }
        const empty = grid.nextElementSibling;
        if (empty && empty.classList.contains('lib-empty')) empty.hidden = result.shown > 0;
        // Let the paint sweep know the visible set changed. Declared below this
        // function and only ever fired from a handler, so the listener is attached
        // by the time anything dispatches.
        grid.dispatchEvent(new CustomEvent('rba:filtered'));
      }

      const frag = document.createDocumentFragment();
      icons.forEach(item => frag.appendChild(iconTile(item)));
      grid.appendChild(frag);

      // Paint what is already on screen straight away rather than waiting for the
      // observer's first callback. The observer is the right mechanism for the
      // other ~1,450 tiles, but its first delivery is scheduled off the rendering
      // loop — so anything that delays or suppresses that (a background tab, a
      // restored session, a throttled renderer) leaves the visible grid blank,
      // which reads as "the icons are broken" rather than "the icons are late".
      //
      // This sweep runs SYNCHRONOUSLY, and that is the whole point. It used to sit
      // inside a requestAnimationFrame, which meant the safety net was built out of
      // the very mechanism it exists to survive: a hidden document runs no animation
      // frames and delivers no observer callbacks, so both the lazy path and its
      // fallback stalled together and the grid stayed empty.
      //
      // It also used to trust window.innerHeight, which is the second half of the
      // same bug. An embedded or backgrounded view can report a viewport of ZERO —
      // measured at 0 in the app's own preview pane — and `0 + 600` is a cutoff no
      // tile in a grid that starts 2,800px down the page can clear. The safety net
      // computed an empty answer and returned it confidently.
      //
      // So when the viewport reports nothing, the head of the grid is painted BY
      // INDEX instead — no layout required, and no measurement to be wrong about.
      // Geometry is used when, and only when, there is a real viewport to measure
      // against.
      const EAGER = 120;   // ~4 screenfuls of a wide grid; 120 files, ~180KB
      unpainted = icons.length;
      function sweep() {
        if (unpainted <= 0) return;
        const glyphs = grid.querySelectorAll('.glyph-cell-glyph');
        const viewportH = Math.max(window.innerHeight || 0,
                                   document.documentElement.clientHeight || 0);
        const limit = viewportH + 600;
        // Read every rect before writing any mask. Interleaving the two dirties
        // layout on each paint and forces a reflow on the next measurement, 1,490
        // times, on every keystroke.
        const due = [];
        let rank = 0;
        for (let i = 0; i < glyphs.length; i++) {
          const g = glyphs[i];
          if (g.parentNode.hidden) continue;   // filtered out — not worth a request
          // Rank counts position among the tiles currently SHOWING, and is counted
          // before the painted check so it stays the same on every pass. Counting
          // only unpainted tiles would make the blind branch additive — each sweep
          // would paint another EAGER, and ten keystrokes would quietly fetch the
          // whole library.
          const idx = rank++;
          if (g.dataset.painted) continue;
          let want;
          if (viewportH > 0) {
            const box = g.getBoundingClientRect();
            want = box.bottom > -600 && box.top < limit;
          } else {
            // DOM order, not visual order — search tiers reorder tiles with CSS
            // `order`. It doesn't matter: this branch only runs when nothing can be
            // measured, which means nothing is being looked at either.
            want = idx < EAGER;
          }
          if (want) due.push(g);
        }
        due.forEach(g => { paint(g); if (io) io.unobserve(g); });
      }
      sweep();

      // Filtering moves tiles up into view without scrolling, and a hidden document
      // won't tell the observer about it. Sweeping after a filter costs one layout
      // per keystroke on the tiles still unpainted, which shrinks as you go.
      grid.addEventListener('rba:filtered', sweep);

      // Anything the observer missed while the tab was in the background gets picked
      // up the moment it comes forward — this is the case that reads as "I opened the
      // page and the icons are gone".
      document.addEventListener('visibilitychange', () => { if (!document.hidden) sweep(); });
      window.addEventListener('pageshow', sweep);

      // Scroll is the one that actually bit. Everything above handles the grid being
      // wrong when it FIRST appears; none of it helps once you start scrolling,
      // because painting past the first screenful was the observer's job alone — and
      // a document the browser considers hidden delivers no observer callbacks at
      // all. An embedded view (a preview pane, an iframe, a background tab someone is
      // still looking at) is hidden for its whole life, so the grid painted its top
      // and then stayed blank however far you scrolled. That reads as "the icons are
      // broken", and reasonably so.
      //
      // The observer still does the work whenever it is awake; this only covers the
      // case where it never wakes. Throttled on a timestamp rather than rAF for the
      // same reason the initial sweep is synchronous: rAF is one of the things that
      // stops in a hidden document, so a rAF-throttled handler would be dead exactly
      // when it is needed.
      let lastSweep = 0, sweepTimer = null;
      function onScroll() {
        const now = performance.now();
        if (now - lastSweep >= 120) { lastSweep = now; sweep(); return; }
        // Trailing call, so coming to rest between throttle windows still paints.
        if (!sweepTimer) {
          sweepTimer = setTimeout(() => {
            sweepTimer = null; lastSweep = performance.now(); sweep();
          }, 120);
        }
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });

      if (search) {
        search.addEventListener('input', apply);
        // Escape clears rather than blurring — the filter is this page's primary
        // control, so getting back to "everything" should not cost a reach for the
        // mouse.
        search.addEventListener('keydown', ev => {
          if (ev.key === 'Escape' && search.value) { search.value = ''; apply(); }
        });
      }
      apply();
    })();

    // Brand-image shortlist · fifty Adobe Stock candidates rendered from the
    // manifest tools/images-sync.py writes into the bottom of images.html.
    //
    // There are no image files. The workbook is a buying shortlist, nothing on it
    // is licensed, and the previews are watermarked comps that Adobe blocks
    // fetching anyway. So each card paints a slot and then ASKS whether a real
    // file exists at assets/images/shortlist/<adobe-id>.<ext>, trying the
    // plausible extensions in turn. Keying on the Adobe ID rather than a
    // hand-written filename is what lets someone drop a licensed image in and
    // have the card fill itself with no manifest edit and no rebuild.
    (function () {
      const grid = document.getElementById('image-grid');
      const dataEl = document.getElementById('image-manifest');
      if (!grid || !dataEl) return;                 // no-ops on every other page

      let data = {};
      try {
        data = JSON.parse(dataEl.textContent) || {};
      } catch (e) {
        grid.innerHTML = '<p class="lib-empty">The shortlist manifest could not be read. ' +
                         'View source and check the <code>#image-manifest</code> block.</p>';
        return;
      }
      const items = data.items || [];
      const cats = data.categories || [];

      // Best first, across the whole library rather than family by family.
      //
      // The manifest arrives grouped: every Collaboration image, then every
      // Expertise image, and so on. That is the right shape for library.json —
      // promoting an image means moving it up its own family — but it is the wrong
      // shape for a grid, because it puts the tenth-best Collaboration frame above
      // the best Applied AI one. Someone scrolling the page reads the top row as
      // "the good ones", and until now the top row was one family's back catalogue.
      //
      // Rank is already the quality judgement, derived from position within a
      // family by images-sync.py. Sorting on it globally interleaves the families:
      // the seven category leads fill the first row, the seven seconds the next.
      // Array.prototype.sort is stable, so images sharing a rank stay in the
      // manifest's family order, and filtering to one family gives back exactly
      // the order library.json specifies.
      items.sort((a, b) => (a.rank || 0) - (b.rank || 0));
      const flatten = s => s.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      // Layered haystacks, same idea as the icon search: what a term matched IN
      // decides where the card ranks, so a title hit beats a hit buried in the
      // curator's notes. titleWords carries a leading space so a word-start test
      // is one indexOf, not a regex.
      items.forEach(it => {
        it.titleHay = flatten(String(it.title || ''));
        it.titleWords = ' ' + it.titleHay;
        it.metaHay = flatten([it.cat, it.by, it.sourceName].join(' '));
        it.noteHay = flatten([it.why, it.use, it.crop, it.priority, it.id].join(' '));
        it.hay = it.titleHay + ' ' + it.metaHay + ' ' + it.noteHay;
      });

      // One filename, from the manifest, no guessing. This used to build four
      // candidate URLs per card by trying each extension in turn, which meant the
      // page discovered its own content by 404 — 150 failed requests before the
      // first picture appeared, back when webp was last in the list. The library
      // records the actual filename, images-sync.py refuses to write a manifest
      // whose files are missing, so by the time this runs the name is known good.
      //
      // A miss still degrades to the labelled slot rather than a broken frame:
      // that is the honest state for a row whose image has been deleted but whose
      // entry is still around.
      function findImage(cell, item) {
        if (!item.file) return;
        const probe = new Image();
        probe.referrerPolicy = 'no-referrer';
        probe.onload = () => {
          const frame = cell.querySelector('.shot-frame');
          frame.classList.add('shot-frame--filled');
          frame.style.backgroundImage = 'url("' + probe.src + '")';
          const slot = frame.querySelector('.shot-slot');
          if (slot) slot.remove();
        };
        probe.src = 'assets/images/shortlist/' + item.file;
      }

      // No decision state on this page at all. Keep / cut / licensed was tried —
      // a badge on the card and a filter above the grid — and every part of it read
      // as clutter on a page whose job is comparing photographs. Removing an image
      // now means removing it: delete the entry and the file. Nothing is archived.
      function card(item) {
        // The card is a DIV wrapping a link, not a link wrapping everything. It has
        // to be: the copy button below is a <button>, and a button inside an anchor
        // is invalid HTML that breaks both — the click target becomes ambiguous and
        // keyboard users get one control where there are two.
        const cell = document.createElement('div');
        const wanted = !item.file;
        cell.className = 'shot-card' + (wanted ? ' shot-card--wanted' : '');

        const a = document.createElement('a');
        a.className = 'shot-link';
        a.href = item.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        // The service name comes from the manifest, not a literal. Three strings
        // on this card used to say "Adobe Stock" outright, which was true of all
        // fifty images and would have been a lie about the first one that wasn't.
        const where = item.sourceName || 'the source';
        a.setAttribute('aria-label', item.title +
          (wanted ? ' — not downloaded yet' : '') + ' — open on ' + where);

        const frame = document.createElement('div');
        frame.className = 'shot-frame';
        const slot = document.createElement('span');
        slot.className = 'shot-slot';
        // Two different absences, and they are not the same problem. A wanted entry
        // is working as designed — somebody shortlisted it and has not fetched it.
        // A named file that will not load is a fault.
        slot.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">' +
                         (wanted ? 'download_for_offline' : 'broken_image') + '</span>' +
                         '<span class="shot-slot-id"></span>' +
                         '<span class="shot-slot-note">' +
                         (wanted ? 'not downloaded yet' : 'image missing') + '</span>';
        slot.querySelector('.shot-slot-id').textContent = item.id;
        frame.appendChild(slot);


        // Nothing else goes on the frame. It carried a rank chip ("Data, AI &
        // security · 1", both facts already on screen) and a priority chip
        // ("Primary pick" / "Strong alternative" / "Supporting option"). Priority
        // was a second ranking sitting on top of the first — the cards are already
        // in rank order — and it competed with the decision badge, which is the
        // ranking that actually means something now that you can mark things.
        //
        // Priority is still DERIVED and still in the manifest, so ordering the
        // library by it is a one-line change if it is ever wanted back.

        // The card carried eight separate pieces of text under a 240px-tall
        // photograph: title, contributor, dimensions, a paragraph of reasoning, an
        // intended use, a cropping note, a service name and a full sentence of
        // licence terms. At three across that is a wall of 11px type competing with
        // the only thing anyone actually looks at, which is the picture.
        //
        // What the page is FOR is deciding whether an image earns its place. That
        // needs three things: the picture, what it is, and whether you may use it.
        // The rest is reference for when you are looking at one image closely, and
        // it has not been deleted — it is all still in library.json, and the whole
        // note is on the card's tooltip.
        // No text on the card. The title, contributor, licence and reviewer notes
        // all used to sit under the photograph; the whole point of this page is
        // comparing pictures, and eight lines of small type under each one is the
        // main thing stopping you doing that. A grid of images reads as a grid of
        // images. Everything is still in library.json, and the full note is on the
        // tooltip of whichever card you are actually looking at.
        const notes = [item.title, item.why, item.use && 'Use: ' + item.use, item.crop,
                       item.by && 'By ' + item.by, item.licence, item.dim]
          .filter(Boolean).join('\n\n');
        if (notes) a.title = notes;

        const foot = document.createElement('span');
        foot.className = 'shot-foot';
        foot.innerHTML = '<span></span>' +
                         '<span class="material-symbols-rounded" aria-hidden="true">open_in_new</span>';
        foot.firstChild.textContent = where;
        a.append(frame, foot);

        // The source URL, whole, with a copy button — because the commands that
        // maintain this library take a URL, and reading one off a card and retyping
        // it is exactly the friction that stops anyone bothering.
        //
        // The URL is shown COMPLETE, scheme included, and wraps rather than
        // truncates. It used to be stripped of "https://" and then ellipsised from
        // the left by a direction:rtl trick, on the theory that the id at the end is
        // the part that matters. Between them those two made a card show
        // "…adobe.com/images/x/2021509311" — a string that is not the link, cannot be
        // pasted, and reads as if the library had mangled it. The copy button always
        // put the real URL on the clipboard, but nobody trusts a copy button when the
        // text beside it is visibly wrong.
        const urlRow = document.createElement('div');
        urlRow.className = 'shot-url';
        const txt = document.createElement('span');
        txt.className = 'shot-url-text';
        txt.textContent = item.url;
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'shot-url-copy';
        copy.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">content_copy</span>';
        copy.setAttribute('aria-label', 'Copy the link to ' + item.title);
        copy.title = item.url;
        copy.addEventListener('click', ev => {
          ev.preventDefault(); ev.stopPropagation();
          rbaCopy(item.url, 'Copied the link');
        });
        urlRow.append(txt, copy);

        cell.append(a, urlRow);
        findImage(cell, item);
        return cell;
      }

      const scope = grid.closest('.lib-scope') || document;
      const search = scope.querySelector('.lib-search-input');
      const chips = scope.querySelector('.lib-filter');
      const count = scope.querySelector('.lib-count');
      let activeCat = 'all';

      if (chips) {
        const mk = (value, label, pressed) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'lib-filter-btn';
          b.setAttribute('data-filter', value);
          b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
          b.textContent = label;
          return b;
        };
        // Counted, not typed. It said "All 50" as a literal, which was true for
        // exactly as long as the shortlist was the original fifty.
        chips.appendChild(mk('all', 'All ' + items.length, true));
        cats.forEach(c => chips.appendChild(mk(c, c, false)));
        chips.addEventListener('click', ev => {
          const btn = ev.target.closest('.lib-filter-btn');
          if (!btn) return;
          activeCat = btn.getAttribute('data-filter');
          chips.querySelectorAll('.lib-filter-btn').forEach(b => {
            b.setAttribute('aria-pressed', String(b === btn));
          });
          apply();
        });
      }

      // The correction vocabulary: every word the search could possibly match,
      // built once on the first zero-result query rather than up front.
      let vocabArr = null, allHay = null;
      function vocab() {
        if (!vocabArr) {
          const s = new Set();
          items.forEach(it => it.hay.split(' ').forEach(w => { if (w.length > 2) s.add(w); }));
          vocabArr = Array.from(s);
        }
        return vocabArr;
      }
      const anywhere = t => {
        if (allHay === null) allHay = items.map(i => i.hay).join(' ');
        return rbaFoundIn(allHay, t);
      };
      function correctTerm(t) {
        if (t.length < 4) return null;   // 1 edit in a 3-letter word is a different word
        const words = vocab();
        let best = null;
        for (let i = 0; i < words.length; i++) {
          if (rbaEd1(t, words[i])) {
            // Same first letter is almost always the intended word; settle for
            // any hit only if nothing shares it.
            if (words[i][0] === t[0]) return words[i];
            if (!best) best = words[i];
          }
        }
        return best;
      }

      // One scoring pass. allMode=true demands every term; false is the any-word
      // fallback, where cards matching more of the words sort first. Tiers, same
      // reasoning as the icon search — where a term matched decides the rank:
      //   0 — every term starts a word in the title  ("desk" → the desk photos)
      //   1 — every term appears in the title at all
      //   2 — matched through family or contributor  ("technology", "wavebreak")
      //   3 — matched only in the curator's notes    (why / use / crop)
      function evaluate(terms, allMode) {
        const tiers = new Array(items.length);
        let shown = 0;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const inScope = activeCat === 'all' || it.cat === activeCat;
          let tier = -1;
          if (inScope) {
            if (!terms.length) tier = 0;
            else if (allMode) {
              if (terms.every(t => rbaFoundIn(it.hay, t))) {
                if (terms.every(t => rbaStartsWordIn(it.titleWords, t))) tier = 0;
                else if (terms.every(t => rbaFoundIn(it.titleHay, t))) tier = 1;
                else if (terms.every(t => rbaFoundIn(it.titleHay + ' ' + it.metaHay, t))) tier = 2;
                else tier = 3;
              }
            } else {
              const matched = terms.filter(t => rbaFoundIn(it.hay, t)).length;
              if (matched) tier = terms.length - matched;
            }
          }
          tiers[i] = tier;
          if (tier > -1) shown++;
        }
        return { tiers: tiers, shown: shown };
      }

      // The graceful-degradation note, same contract as the icon page: it only
      // speaks when the search had to loosen something to find results.
      const noteEl = document.createElement('p');
      noteEl.className = 'lib-search-note';
      noteEl.setAttribute('role', 'status');
      noteEl.hidden = true;
      grid.parentNode.insertBefore(noteEl, grid);

      function apply() {
        const rawTerms = search ? flatten(search.value).split(' ').filter(Boolean) : [];
        let result = evaluate(rawTerms, true);
        let note = '';

        // An empty grid teaches nothing: before showing one, respell terms that
        // match nothing anywhere, then drop the all-words requirement — and SAY so.
        if (!result.shown && rawTerms.length) {
          const corrected = rawTerms.map(t => anywhere(t) ? t : (correctTerm(t) || t));
          const respelled = corrected.join(' ') !== rawTerms.join(' ');
          if (respelled) {
            const r = evaluate(corrected, true);
            if (r.shown) {
              result = r;
              note = 'Nothing matches “' + rawTerms.join(' ') + '” — showing results for “' +
                     corrected.join(' ') + '”.';
            }
          }
          if (!result.shown && rawTerms.length > 1) {
            const terms = respelled ? corrected : rawTerms;
            const r = evaluate(terms, false);
            if (r.shown) {
              result = r;
              note = 'No image matches all of “' + terms.join(' ') + '” — showing images that match any of the words, best first.';
            }
          }
        }

        const cells = grid.children;
        let shown = result.shown;
        for (let i = 0; i < items.length; i++) {
          const tier = result.tiers[i];
          cells[i].hidden = tier < 0;
          // CSS order rather than moving nodes — one property on the survivors.
          cells[i].style.order = (tier > 0 && rawTerms.length) ? String(tier) : '';
        }
        noteEl.textContent = note;
        noteEl.hidden = !note;
        if (count) {
          count.textContent = shown === items.length
            ? shown + ' image' + (shown === 1 ? '' : 's')
            : shown + ' of ' + items.length + ' images';
        }
        const empty = grid.nextElementSibling;
        if (empty && empty.classList.contains('lib-empty')) empty.hidden = shown > 0;
      }

      const frag = document.createDocumentFragment();
      items.forEach(it => frag.appendChild(card(it)));
      grid.appendChild(frag);

      if (search) {
        search.addEventListener('input', apply);
        search.addEventListener('keydown', ev => {
          if (ev.key === 'Escape' && search.value) { search.value = ''; apply(); }
        });
      }
      apply();
    })();

    // The chart-tooltip block lived here. It served the three worked figures that
    // the data-visualization section used to carry; those are gone — the section
    // is a palette card now — so the marks it listened for no longer exist.

    // Copy SVG · reads an icon's source file and puts its markup on the clipboard, for
    // pasting straight into a template or a codebase.
    //
    // This one genuinely needs a served origin: fetching a local file from a file://
    // page is blocked, and there is no workaround that doesn't mean inlining every
    // icon's markup into the page. So rather than fail on click, the buttons remove
    // themselves when the page isn't served — the download route still works, and an
    // absent button is honest where a broken one is not.
    (function () {
      const btns = document.querySelectorAll('.js-copy-svg');
      if (!btns.length) return;

      const canFetch = location.protocol === 'http:' || location.protocol === 'https:';
      if (!canFetch || !navigator.clipboard) {
        btns.forEach(b => b.remove());
        return;
      }

      document.addEventListener('click', ev => {
        const btn = ev.target.closest('.js-copy-svg');
        if (!btn) return;
        ev.preventDefault();
        ev.stopPropagation();
        const file = btn.getAttribute('data-file');
        if (!file) return;
        fetch(file)
          .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
          .then(text => rbaCopy(text, 'SVG copied'))
          .catch(() => rbaToast("Couldn't read that file"));
      });
    })();

    // Asset downloads · injects a hover "download" button onto every asset tile, so a
    // logo colorway, an icon, or a photograph can be pulled straight off the page.
    //   - Inline SVG (the logo colorways) is serialized to a standalone file: <use>
    //     refs are inlined from their <symbol> and the tile's computed color is baked
    //     onto the root, so currentColor resolves when the file is opened alone.
    //   - File-backed assets (icons, photography) download their source file
    //     directly. Those tiles also carry a plain <a download> link, so the button
    //     here is a convenience, not the only route.
    (function () {
      const SVGNS = 'http://www.w3.org/2000/svg';
      const XLINK = 'http://www.w3.org/1999/xlink';
      const slug = s => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      function trigger(href, name, revoke) {
        const a = document.createElement('a');
        a.href = href; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        if (revoke) setTimeout(() => URL.revokeObjectURL(href), 1500);
      }

      function serialize(svg) {
        const clone = svg.cloneNode(true);
        clone.querySelectorAll('use').forEach(u => {
          const href = (u.getAttribute('href') || u.getAttributeNS(XLINK, 'href') || '').trim();
          const ref = href && document.querySelector(href);
          if (!ref) return;
          const g = document.createElementNS(SVGNS, 'g');
          Array.from(ref.childNodes).forEach(n => g.appendChild(n.cloneNode(true)));
          u.replaceWith(g);
        });
        // Bake the resolved color onto the root. Every path in the mark is
        // fill="currentColor", so this one declaration is the whole colorway — and it has
        // to be a literal, not a var(), because plenty of standalone SVG consumers
        // (Preview, older design tools, thumbnailers) don't resolve custom properties at
        // all and would render the file black.
        //
        // The block lockup needs nothing here: its fills are fixed in the symbol.
        const cs = getComputedStyle(svg);
        clone.setAttribute('xmlns', SVGNS);
        clone.removeAttribute('class');
        clone.setAttribute('style', 'color:' + cs.color + ';');
        const out = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
        return URL.createObjectURL(new Blob([out], { type: 'image/svg+xml' }));
      }

      // A labelled link under the tile, not a button that appears on hover.
      //
      // The hover button was invisible until you moved the mouse over the right
      // 40 pixels, which meant the download — the entire point of an asset library
      // — was the one thing on the page you had to discover. It also could not
      // exist on a touch device, where there is no hover, so the affordance was
      // simply missing for anyone on a tablet.
      //
      // A permanent "Download SVG" underneath costs one line of 11px type and
      // tells you both that the file is downloadable and what you will get. The
      // icon tiles have worked this way all along; this brings the logos into line
      // with them.
      function attach(host, name, srcFn) {
        if (!host || host.querySelector(':scope > .asset-dl')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'asset-dl';
        const kind = /\.svg$/i.test(name) ? 'SVG' : name.split('.').pop().toUpperCase();
        btn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">download</span>' +
                        '<span></span>';
        btn.lastChild.textContent = 'Download ' + kind;
        btn.setAttribute('aria-label', 'Download ' + name);
        btn.title = name;
        btn.addEventListener('click', ev => {
          ev.preventDefault(); ev.stopPropagation();
          const src = srcFn();
          if (src.file) trigger(src.file, name);
          else if (src.svg) trigger(serialize(src.svg), name, true);
        });
        host.appendChild(btn);
      }

      // Logo colorways → serialized colored SVG (colorway read off the modifier class)
      document.querySelectorAll('.logo-card').forEach(card => {
        const svg = card.querySelector('svg.brand-logo');
        if (!svg) return;
        const cls = Array.from(svg.classList).find(c => c.indexOf('brand-logo--') === 0);
        const v = cls ? cls.slice('brand-logo--'.length) : 'mark';
        // The wrapper, not the card. The card is a fixed-aspect coloured swatch
        // with the logo centred in it — anything appended inside lands on top of
        // the artwork it belongs to.
        attach(card.closest('.logo-item') || card, 'rba-logo-' + v + '.svg', () => ({ svg }));
      });
      // Icon tiles are deliberately NOT handled here. They carry their own SVG and PNG
      // anchors, which the hover button would only duplicate — and attaching one to
      // each of 1,490 tiles would add 1,490 buttons and listeners to buy nothing.
      //
      // Nothing for brand images: the shortlist cards are links out to Adobe
      // Stock, and there is no local file to download until one is licensed.
    })();

    // ---------------------------------------------------------------------------
    // Logo library (logo-library.html)
    //
    // Same shape as the icon grid — build the tiles once, then filter by toggling
    // .hidden — but with two differences that matter.
    //
    //   1. The preview is an <img>, not a CSS mask. These marks are the owners'
    //      colors and must render as themselves; masking would flatten every one
    //      of them to a single fill, which is the opposite of the point.
    //   2. A colorway switch drives the tiles AND their download links together, so
    //      the file you get is always the one you are looking at.
    // ---------------------------------------------------------------------------
    (function () {
      const grid = document.getElementById('logo-grid');
      const dataEl = document.getElementById('logo-manifest');
      if (!grid || !dataEl) return;                 // no-ops on every other page

      let cats = [], logos = [];
      try {
        const data = JSON.parse(dataEl.textContent) || {};
        cats = data.categories || [];
        logos = data.logos || [];
      } catch (e) {
        grid.innerHTML = '<p class="lib-empty">The logo manifest could not be read. ' +
                         'View source and check the <code>#logo-manifest</code> block.</p>';
        return;
      }
      if (!logos.length) return;

      const flatten = s => s.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      const BASE = 'assets/logo-library/';

      // The six paths are derived, not stored — see the note on the manifest block.
      const paths = it => {
        const dir = BASE + cats[it.c].s + '/' + it.n;
        return { color: { svg: dir + '.svg',        png: dir + '.png' },
                 black: { svg: dir + '-black.svg',  png: dir + '-black.png' },
                 white: { svg: dir + '-white.svg',  png: dir + '-white.png' } };
      };

      const items = logos.map(it => ({
        raw: it,
        title: it.t,
        cat: cats[it.c],
        dark: !!it.d,
        files: paths(it),
        hay: ' ' + flatten(it.t + ' ' + it.n + ' ' + cats[it.c].l) + ' '
      }));

      let variant = 'color';

      // Lazily point each <img> at its file as the tile nears the viewport. 117 logos
      // x 512px PNG is several megabytes; loading it all on paint would spend the
      // whole request budget before anyone has scrolled.
      const io = 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if (!entry.isIntersecting) return;
              const img = entry.target;
              if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
              io.unobserve(img);
            });
          }, { rootMargin: '400px 0px' })
        : null;

      function setVariant(el, name) {
        const f = el._files[name];
        const img = el.querySelector('.logo-cell-img');
        // Only swap what is already loaded; a tile still below the fold keeps its
        // pending data-src so the observer fetches the right colorway when it lands.
        if (img.dataset.src) img.dataset.src = f.png; else img.src = f.png;
        const links = el.querySelectorAll('.glyph-dl');
        links[0].href = f.svg;
        links[1].href = f.png;
        // Name the download explicitly rather than leaving download="" to infer it
        // from the URL. Same result today, but it survives a cache-busting query
        // string being added to these hrefs later, which would otherwise start
        // saving files as "cargill.svg?v=2".
        links[0].setAttribute('download', f.svg.split('/').pop());
        links[1].setAttribute('download', f.png.split('/').pop());
        const label = el._title + ' — ' + name;
        links[0].setAttribute('aria-label', 'Download ' + label + ' as SVG');
        links[1].setAttribute('aria-label', 'Download ' + label + ' as PNG');
      }

      function logoTile(item) {
        const cell = document.createElement('div');
        cell.className = 'logo-cell' + (item.dark ? ' logo-cell--dark' : '');
        cell._files = item.files;
        cell._title = item.title;

        const stage = document.createElement('div');
        stage.className = 'logo-cell-stage';

        const img = document.createElement('img');
        img.className = 'logo-cell-img';
        img.alt = item.title + ' logo';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.dataset.src = item.files.color.png;
        if (io) io.observe(img); else img.src = item.files.color.png;
        stage.appendChild(img);

        const name = document.createElement('span');
        name.className = 'logo-cell-name';
        name.textContent = item.title;

        const cat = document.createElement('span');
        cat.className = 'logo-cell-cat';
        cat.textContent = item.cat.l;

        const actions = document.createElement('span');
        actions.className = 'glyph-cell-actions';
        ['SVG', 'PNG'].forEach(kind => {
          const a = document.createElement('a');
          a.className = 'glyph-dl';
          a.setAttribute('download', '');
          a.textContent = kind;
          actions.appendChild(a);
        });

        cell.append(stage, name, cat, actions);
        setVariant(cell, 'color');
        return cell;
      }

      const frag = document.createDocumentFragment();
      items.forEach(item => { item.el = logoTile(item); frag.appendChild(item.el); });
      grid.appendChild(frag);
      grid.dataset.variant = variant;

      const scope = grid.closest('.lib-scope') || document;
      const search = scope.querySelector('.lib-search-input');
      const chips = scope.querySelector('.lib-filter:not(.lib-filter--variant)');
      const count = scope.querySelector('.lib-count');
      const empty = scope.querySelector('.lib-empty');
      let activeCat = 'all';

      if (chips) {
        const mk = (value, label, pressed) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'lib-filter-btn';
          b.setAttribute('data-filter', value);
          b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
          b.textContent = label;
          return b;
        };
        chips.appendChild(mk('all', 'All', true));
        cats.forEach(c => chips.appendChild(mk(c.s, c.l, false)));
        chips.addEventListener('click', ev => {
          const btn = ev.target.closest('.lib-filter-btn');
          if (!btn) return;
          activeCat = btn.getAttribute('data-filter');
          chips.querySelectorAll('.lib-filter-btn').forEach(b => {
            b.setAttribute('aria-pressed', String(b === btn));
          });
          apply();
        });
      }

      scope.querySelectorAll('.js-logo-variant').forEach(btn => {
        btn.addEventListener('click', () => {
          variant = btn.getAttribute('data-variant');
          scope.querySelectorAll('.js-logo-variant').forEach(b => {
            b.setAttribute('aria-pressed', String(b === btn));
          });
          // The stage colour is decided in CSS from this one attribute, because which
          // tiles need a dark backing depends on the colorway, not on the logo alone.
          grid.dataset.variant = variant;
          items.forEach(it => setVariant(it.el, variant));
        });
      });

      function apply() {
        const terms = flatten(search ? search.value : '').split(' ').filter(Boolean);
        let shown = 0;
        items.forEach(it => {
          const inScope = activeCat === 'all' || it.cat.s === activeCat;
          const hit = inScope && terms.every(t => it.hay.indexOf(t) >= 0);
          it.el.hidden = !hit;
          if (hit) shown++;
        });
        if (count) {
          count.textContent = shown === items.length
            ? items.length + ' logos'
            : shown + ' of ' + items.length;
        }
        if (empty) empty.hidden = shown !== 0;
      }

      // The placeholder carries the count so it cannot drift from the manifest the
      // way a number typed into the HTML would.
      if (search) {
        search.placeholder = 'Search ' + items.length + ' logos \u2014 try sitecore, azure, united way\u2026';
        search.addEventListener('input', apply);
      }
      apply();
    })();
