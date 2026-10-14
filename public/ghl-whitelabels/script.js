<script>
(function () {

  // ============================================================
  //  MAPS — Logo / Favicon / Title
  // ============================================================
  const logoMap = {
    'QUa0qSF6U3s7Jlwia2gX': 'https://assets.cdn.filesafe.space/QUa0qSF6U3s7Jlwia2gX/media/6a1bc463cd1238368fffe33c.svg',
    'rEo5zgOVFUKktLZZMJe2': 'https://assets.cdn.filesafe.space/rEo5zgOVFUKktLZZMJe2/media/6a1bc545d53fc25488cfd394.png',
    'tWh67iVHHkSDby7bGdvW': 'https://assets.cdn.filesafe.space/tWh67iVHHkSDby7bGdvW/media/69e45dccc56ad27908caa195.png',
     'gPwniIHGfBO7C4tPcBlw': 'https://assets.cdn.filesafe.space/gPwniIHGfBO7C4tPcBlw/media/6a8d65a267ecc8731de1d619.png',
    // 'NEW_LOCATION_ID': 'https://their-logo-url.png',
    'default': 'https://assets.cdn.filesafe.space/QUa0qSF6U3s7Jlwia2gX/media/69f857557165b6587e296fe0.jpg'
  };

  const titleMap = {
    'QUa0qSF6U3s7Jlwia2gX': 'Bright AI Solutions',
    'rEo5zgOVFUKktLZZMJe2': 'Cassia Elegant Spa',
    'tWh67iVHHkSDby7bGdvW': 'Bright Solutions',
    'gPwniIHGfBO7C4tPcBlw': 'Josie Conroy Esthetics',
    // 'NEW_LOCATION_ID': 'Their Business Name',
    'default': 'Bright AI Solutions'
  };

  const logoSizeMap = {
    'QUa0qSF6U3s7Jlwia2gX': '60px',
    'tWh67iVHHkSDby7bGdvW': '60px',
    'rEo5zgOVFUKktLZZMJe2': '80px',
    'gPwniIHGfBO7C4tPcBlw': '60px',
    // 'NEW_LOCATION_ID': '60px',
  };

  // ── FAVICON MAP — one per sub-account ──────────────────────
  const faviconMap = {
    'QUa0qSF6U3s7Jlwia2gX': 'https://assets.cdn.filesafe.space/QUa0qSF6U3s7Jlwia2gX/media/69f493c223e63d676c76c66b.png',
    'rEo5zgOVFUKktLZZMJe2': 'https://assets.cdn.filesafe.space/rEo5zgOVFUKktLZZMJe2/media/6a1bc545d53fc25488cfd394.png',
    'tWh67iVHHkSDby7bGdvW': 'https://assets.cdn.filesafe.space/tWh67iVHHkSDby7bGdvW/media/69f492eb07cf68d3e588dc1f.png',
    'gPwniIHGfBO7C4tPcBlw': 'https://assets.cdn.filesafe.space/gPwniIHGfBO7C4tPcBlw/media/6a8d65a267ecc8731de1d619.png',
    // 'NEW_LOCATION_ID': 'https://their-favicon.png',
    'default': 'https://assets.cdn.filesafe.space/QUa0qSF6U3s7Jlwia2gX/media/69f493c223e63d676c76c66b.png'
  };

  // ── THEME DEFINITIONS ───────────────────────────────────────
  const themes = {
    'QUa0qSF6U3s7Jlwia2gX': { accent: '#C0392B', accentHover: '#a93226', accentText: '#ffffff' },
    'rEo5zgOVFUKktLZZMJe2': { accent: '#8B1A1A', accentHover: '#6d1414', accentText: '#ffffff' },
    'tWh67iVHHkSDby7bGdvW': { accent: '#3A7A3A', accentHover: '#2e622e', accentText: '#ffffff' },
'gPwniIHGfBO7C4tPcBlw': { accent: '#FDDCA5', accentHover: '#F1D4AB', accentText: '#ffffff' },
    // 'NEW_LOCATION_ID': { accent: '#hex', accentHover: '#hex', accentText: '#ffffff' },

    // ── AGENCY DASHBOARD — default red (Bright AI) ──────────
    // The agency view has no location ID in the URL, so we use
    // a special sentinel key matched by isAgencyView().
    '__agency__': { accent: '#C0392B', accentHover: '#a93226', accentText: '#ffffff' },
  };

  // ── ALL SIDEBAR NAV IDs (sub-account + agency) ─────────────
  const NAV_IDS = [
    // Sub-account nav
    'sb_launchpad','sb_dashboard','sb_conversations','sb_calendars',
    'sb_contacts','sb_opportunities','sb_payments','sb_reporting',
    'sb_reputation','sb_automation','sb_email-marketing','sb_sites',
    'sb_memberships','sb_app-media','sb_app-marketplace','sb_settings',
    'sb_AI Agents','sb_marketing','sb_ai-agents',
    // Agency nav IDs
    'sb_agency-dashboard','sb_prospecting','sb_sub-accounts',
    'sb_account-snapshots','sb_reselling','sb_add-ons',
    'sb_affiliate-portal','sb_template-library','sb_partners',
    'sb_university','sb_saas-education','sb_ghl-swag','sb_ideas',
    'sb_mobile-app','sb_agency-settings'
  ];

  // ============================================================
  //  URL HELPERS
  // ============================================================
  function getCurrentLocationId() {
    const m = location.pathname.match(/\/location\/([a-zA-Z0-9_-]+)/i);
    return m ? m[1] : null;
  }

  // Agency dashboard has no /location/ segment — detect it by path
  function isAgencyView() {
    const p = location.pathname;
    return (
      p.includes('/agency_dashboard') ||
      p.includes('/agency-dashboard') ||
      p.includes('/agency_das') ||
      p.includes('/sub-accounts') ||
      p.includes('/reselling') ||
      p.includes('/prospecting') ||
      (p.includes('/settings') && !p.includes('/location/'))
    );
  }

  // Returns the theme key to use for the current page
  function getThemeKey() {
    const locId = getCurrentLocationId();
    if (locId && themes[locId]) return locId;
    if (isAgencyView()) return '__agency__';
    return null;
  }

  // ============================================================
  //  BUILD CSS
  // ============================================================
  function buildCSS(t) {
    return `

      /* ══════════════════════════════════════════════════
         SIDEBAR SHELL — white, clean border
         Width is left to GHL's .transition-slowest so the
         hide/show toggle keeps working naturally.
      ══════════════════════════════════════════════════ */
      #sidebar-v2 {
        background-color: #ffffff !important;
        border-right: 1px solid #e2e8f0 !important;
        padding-top: 0 !important;
      }

      /* Expanded — 240 px */
      #app div.transition-slowest {
        transform: translateX(0px) translateY(0px) !important;
        width: 240px !important;
        min-width: 240px !important;
        background-color: #ffffff !important;
        overflow: visible !important;
      }

      /* Collapsed — 56 px icon-only */
      #app div.transition-slowest.collapsed,
      #app div.transition-slowest[style*="width: 56px"],
      #app div.transition-slowest[style*="width:56px"] {
        width: 56px !important;
        min-width: 56px !important;
        overflow: hidden !important;
      }
      #app div.transition-slowest.collapsed nav a span,
      #app div.transition-slowest.collapsed nav a .nav-title,
      #app div.transition-slowest.collapsed nav a p,
      #app div.transition-slowest[style*="width: 56px"] nav a span,
      #app div.transition-slowest[style*="width: 56px"] nav a .nav-title,
      #app div.transition-slowest[style*="width: 56px"] nav a p {
        display: none !important;
      }

      /* All child wrappers — white */
      #sidebar-v2 > div,
      #sidebar-v2 > div > div {
        background-color: #ffffff !important;
      }

      /* ══════════════════════════════════════════════════
         LOGO AREA
      ══════════════════════════════════════════════════ */
      #sidebar-v2 .agency-logo-wrapper,
      #sidebar-v2 [class*="logo-wrap"],
      #sidebar-v2 [class*="logoWrap"],
      #sidebar-v2 > div:first-child > a,
      #sidebar-v2 > div:first-child > div:first-child,
      #sidebar-v2 > div:first-child > div:first-child > div,
      #sidebar-v2 > div:first-child {
        background-color: #ffffff !important;
        border-bottom: 1px solid #e2e8f0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        margin: 0 !important;
        min-height: unset !important;
      }

      /* ══════════════════════════════════════════════════
         LOCATION / ACCOUNT SWITCHER PILL
      ══════════════════════════════════════════════════ */
      #sidebar-v2 .hl_sub-account-selector,
      #sidebar-v2 [data-testid="location-switcher"],
      #sidebar-v2 > div > div:nth-child(2) > button,
      #sidebar-v2 > div > div:nth-child(2) > div > button {
        background-color: #f8fafc !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 8px !important;
      }
      #sidebar-v2 .hl_sub-account-selector span,
      #sidebar-v2 .hl_sub-account-selector p,
      #sidebar-v2 [data-testid="location-switcher"] span,
      #sidebar-v2 [data-testid="location-switcher"] p,
      #sidebar-v2 > div > div:nth-child(2) > button span,
      #sidebar-v2 > div > div:nth-child(2) > button p,
      #sidebar-v2 > div > div:nth-child(2) > div > button span,
      #sidebar-v2 > div > div:nth-child(2) > div > button p {
        color: #1e293b !important;
      }
      #sidebar-v2 .hl_sub-account-selector svg,
      #sidebar-v2 [data-testid="location-switcher"] svg {
        color: #64748b !important;
        stroke: #64748b !important;
      }

      /* ══════════════════════════════════════════════════
         SEARCH BAR
      ══════════════════════════════════════════════════ */
      #sidebar-v2 .hl_search-container,
      #sidebar-v2 input[type="text"],
      #sidebar-v2 .search-bar {
        background-color: #f8fafc !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 6px !important;
        color: #1e293b !important;
      }
      #sidebar-v2 input[type="text"]::placeholder { color: #94a3b8 !important; }
      #sidebar-v2 .hl_search-container svg,
      #sidebar-v2 .search-bar svg {
        color: #94a3b8 !important;
        stroke: #94a3b8 !important;
      }

      /* ══════════════════════════════════════════════════
         NAV LINKS — DEFAULT: dark text on white
         Smooth 0.18s transitions on all state changes
      ══════════════════════════════════════════════════ */
      #sidebar-v2 nav,
      #sidebar-v2 nav > div,
      #sidebar-v2 nav > ul {
        background-color: #ffffff !important;
      }

      #sidebar-v2 nav a {
        color: #1e293b !important;
        border-radius: 6px !important;
        margin: 2px 6px !important;
        background-color: transparent !important;
        background-image: none !important;
        border-left: 3px solid transparent !important;
        transition:
          background-color 0.18s ease,
          color 0.18s ease,
          border-color 0.18s ease !important;
      }
      #sidebar-v2 nav a span,
      #sidebar-v2 nav a .nav-title,
      #sidebar-v2 nav a p {
        color: #1e293b !important;
        display: inline !important;
        visibility: visible !important;
        opacity: 1 !important;
        white-space: nowrap !important;
        transition: color 0.18s ease !important;
      }
      #sidebar-v2 nav a svg {
        color: #64748b !important;
        stroke: #64748b !important;
        flex-shrink: 0 !important;
        transition: color 0.18s ease, stroke 0.18s ease !important;
      }
      #sidebar-v2 nav a img {
        filter: brightness(0) !important;
        opacity: 0.55 !important;
        transition: filter 0.18s ease, opacity 0.18s ease !important;
      }

      /* ── HOVER — accent bg, white text ── */
      #sidebar-v2 nav a:hover {
        background-color: ${t.accent} !important;
        background-image: none !important;
        color: #ffffff !important;
        border-left-color: ${t.accentHover} !important;
      }
      #sidebar-v2 nav a:hover span,
      #sidebar-v2 nav a:hover .nav-title,
      #sidebar-v2 nav a:hover p { color: #ffffff !important; }
      #sidebar-v2 nav a:hover svg {
        color: #ffffff !important;
        stroke: #ffffff !important;
      }
      #sidebar-v2 nav a:hover img {
        filter: brightness(0) invert(1) !important;
        opacity: 1 !important;
      }

      /* ── ACTIVE — CSS fallback (JS syncActiveStates is primary) ── */
      #sidebar-v2 nav a.active,
      #sidebar-v2 nav a.router-link-active,
      #sidebar-v2 nav a.router-link-exact-active {
        background-color: ${t.accent} !important;
        background-image: none !important;
        border-left: 3px solid ${t.accentHover} !important;
        color: #ffffff !important;
      }
      #sidebar-v2 nav a.active span,
      #sidebar-v2 nav a.router-link-active span,
      #sidebar-v2 nav a.router-link-exact-active span,
      #sidebar-v2 nav a.active .nav-title,
      #sidebar-v2 nav a.router-link-exact-active .nav-title,
      #sidebar-v2 nav a.active p,
      #sidebar-v2 nav a.router-link-exact-active p { color: #ffffff !important; }
      #sidebar-v2 nav a.active svg,
      #sidebar-v2 nav a.router-link-active svg,
      #sidebar-v2 nav a.router-link-exact-active svg {
        color: #ffffff !important;
        stroke: #ffffff !important;
      }
      #sidebar-v2 nav a.active img,
      #sidebar-v2 nav a.router-link-exact-active img {
        filter: brightness(0) invert(1) !important;
        opacity: 1 !important;
      }

      /* ══════════════════════════════════════════════════
         SETTINGS PANEL — solid white, never transparent
      ══════════════════════════════════════════════════ */
      #sidebar-v2 [class*="settings"],
      #sidebar-v2 [class*="Settings"],
      #sidebar-v2 [class*="sub-menu"],
      #sidebar-v2 [class*="subMenu"],
      #sidebar-v2 [class*="submenu"],
      #sidebar-v2 [class*="settings-panel"],
      #sidebar-v2 [class*="settingsPanel"],
      #sidebar-v2 .overflow-x-hidden,
      #sidebar-v2 .overflow-y-auto,
      #sidebar-v2 > div > div:last-child,
      #sidebar-v2 > div > div {
        background-color: #ffffff !important;
      }

      #sidebar-v2 h1, #sidebar-v2 h2,
      #sidebar-v2 h3, #sidebar-v2 h4,
      #sidebar-v2 [class*="title"],
      #sidebar-v2 [class*="heading"] {
        color: #1e293b !important;
        background-color: transparent !important;
      }

      /* Go Back button */
      #sidebar-v2 [class*="go-back"],
      #sidebar-v2 [class*="goBack"],
      #sidebar-v2 button[class*="back"] {
        background-color: #f1f5f9 !important;
        color: #1e293b !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 6px !important;
        transition: background-color 0.18s ease !important;
      }
      #sidebar-v2 [class*="go-back"] span,
      #sidebar-v2 [class*="goBack"] span,
      #sidebar-v2 button[class*="back"] span { color: #1e293b !important; }

      /* Settings sub-links */
      #sidebar-v2 [class*="settings"] a,
      #sidebar-v2 [class*="sub-menu"] a,
      #sidebar-v2 [class*="subMenu"] a,
      #sidebar-v2 [class*="submenu"] a {
        color: #1e293b !important;
        background-color: transparent !important;
        transition: background-color 0.18s ease, color 0.18s ease !important;
      }
      #sidebar-v2 [class*="settings"] a span,
      #sidebar-v2 [class*="sub-menu"] a span { color: #1e293b !important; }

      #sidebar-v2 [class*="settings"] a:hover,
      #sidebar-v2 [class*="sub-menu"] a:hover,
      #sidebar-v2 [class*="subMenu"] a:hover {
        background-color: ${t.accent} !important;
        color: #ffffff !important;
        border-radius: 6px !important;
      }
      #sidebar-v2 [class*="settings"] a:hover span,
      #sidebar-v2 [class*="sub-menu"] a:hover span { color: #ffffff !important; }

      #sidebar-v2 [class*="settings"] a.active,
      #sidebar-v2 [class*="sub-menu"] a.active,
      #sidebar-v2 [class*="settings"] a.router-link-exact-active {
        background-color: ${t.accent} !important;
        border-left: 3px solid ${t.accentHover} !important;
        color: #ffffff !important;
        border-radius: 6px !important;
      }
      #sidebar-v2 [class*="settings"] a.active span,
      #sidebar-v2 [class*="settings"] a.router-link-exact-active span { color: #ffffff !important; }

      /* ══════════════════════════════════════════════════
         SECTION LABELS
      ══════════════════════════════════════════════════ */
      #sidebar-v2 [class*="section-label"],
      #sidebar-v2 [class*="sectionLabel"],
      #sidebar-v2 [class*="group-label"],
      #sidebar-v2 [class*="nav-group"] > span,
      #sidebar-v2 [class*="navGroup"] > span,
      #sidebar-v2 .text-xs.font-semibold,
      #sidebar-v2 .text-xs.uppercase,
      #sidebar-v2 small {
        background: none !important;
        color: #94a3b8 !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        letter-spacing: 0.08em !important;
        text-transform: uppercase !important;
        border: none !important;
        box-shadow: none !important;
      }

      #sidebar-v2 hr,
      #sidebar-v2 [class*="divider"],
      #sidebar-v2 [class*="separator"] {
        border-color: #e2e8f0 !important;
        background: none !important;
      }

      /* ══════════════════════════════════════════════════
         TOPBAR
      ══════════════════════════════════════════════════ */
      #topbar {
        background-color: #ffffff !important;
        border-bottom: 1px solid #e2e8f0 !important;
      }
      #topbar span, #topbar p, #topbar a { color: #1e293b !important; }

      /* ══════════════════════════════════════════════════
         ACCOUNT SWITCHER DROPDOWN
      ══════════════════════════════════════════════════ */
      .hl_location-switcher-popup,
      [class*="location-switcher-popup"],
      .hl_sub-account-list,
      [class*="sub-account-list"] {
        background-color: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 10px !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important;
      }
      .hl_location-switcher-popup *,
      [class*="sub-account-list"] * { color: #1e293b !important; }
      .hl_location-switcher-popup input,
      [class*="sub-account-list"] input {
        background-color: #f8fafc !important;
        border: 1px solid #e2e8f0 !important;
        color: #1e293b !important;
        border-radius: 6px !important;
      }
      .hl_location-switcher-popup li:hover,
      [class*="sub-account-list"] li:hover {
        background-color: ${t.accent} !important;
        border-radius: 6px !important;
      }
      .hl_location-switcher-popup li:hover *,
      [class*="sub-account-list"] li:hover * { color: #ffffff !important; }
      .hl_location-switcher-popup hr,
      [class*="sub-account-list"] hr { border-color: #e2e8f0 !important; }

      /* ══════════════════════════════════════════════════
         CONTENT AREA — accent on interactive elements
      ══════════════════════════════════════════════════ */
      .n-button--primary-type {
        background-color: ${t.accent} !important;
        border-color: ${t.accent} !important;
        --n-color: ${t.accent} !important;
        --n-color-hover: ${t.accentHover} !important;
        --n-text-color: ${t.accentText} !important;
        transition: background-color 0.18s ease !important;
      }
      .n-button--primary-type:hover { background-color: ${t.accentHover} !important; }
      .n-button--primary-type span  { color: ${t.accentText} !important; }

      .n-tabs-bar { background-color: ${t.accent} !important; }
      .n-tab.n-tab--active { color: ${t.accent} !important; }

      .n-input:focus-within {
        --n-border-focus: 1px solid ${t.accent} !important;
        --n-box-shadow-focus: 0 0 0 2px ${t.accent}25 !important;
      }
      .n-base-selection.n-base-selection--focus,
      .n-base-selection.n-base-selection--active {
        --n-border-focus: 1px solid ${t.accent} !important;
        --n-border-active: 1px solid ${t.accent} !important;
      }
      .n-checkbox--checked .n-checkbox-box {
        background-color: ${t.accent} !important;
        border-color: ${t.accent} !important;
      }
      .n-switch.n-switch--active .n-switch__rail { background-color: ${t.accent} !important; }
      .n-pagination-item--active {
        background-color: ${t.accent} !important;
        border-color: ${t.accent} !important;
        color: #ffffff !important;
      }
      .n-tag {
        background-color: #f1f5f9 !important;
        border: 1px solid #e2e8f0 !important;
      }
      .n-tag .n-tag__content { color: #475569 !important; }
      .n-data-table-tr:hover .n-data-table-td { background-color: #f8fafc !important; }

      /* Scrollbar */
      ::-webkit-scrollbar { width: 5px !important; height: 5px !important; }
      ::-webkit-scrollbar-track { background: #f1f5f9 !important; }
      ::-webkit-scrollbar-thumb { background: #cbd5e1 !important; border-radius: 3px !important; }
      ::-webkit-scrollbar-thumb:hover { background: ${t.accent} !important; }

    `;
  }

  // ============================================================
  //  FAVICON
  // ============================================================
  function applyFavicon(locId) {
    const url = (locId && faviconMap[locId]) ? faviconMap[locId] : faviconMap['default'];
    document.querySelectorAll(
      "link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']"
    ).forEach(function(el) { el.parentNode.removeChild(el); });
    [
      { rel: 'shortcut icon',    type: 'image/x-icon' },
      { rel: 'icon',             type: 'image/png'    },
      { rel: 'apple-touch-icon', type: null           }
    ].forEach(function(attrs) {
      var link  = document.createElement('link');
      link.rel  = attrs.rel;
      if (attrs.type) link.type = attrs.type;
      link.href = url;
      document.head.appendChild(link);
    });
  }

  // ============================================================
  //  LOGO
  // ============================================================
  function applyCorrectLogo() {
    const locId = getCurrentLocationId();
    const src   = (locId && logoMap[locId])     ? logoMap[locId]     : logoMap['default'];
    const title = (locId && titleMap[locId])    ? titleMap[locId]    : titleMap['default'];
    const size  = (locId && logoSizeMap[locId]) ? logoSizeMap[locId] : 'auto';

    const img = document.querySelector('img.agency-logo');
    if (img) {
      if (img.src !== src) img.src = src;
      img.style.height    = size;
      img.style.width     = 'auto';
      img.style.maxHeight = 'none';
      img.style.setProperty('background-color', '#ffffff', 'important');

      const p1 = img.parentElement;
      if (p1 && p1.id !== 'sidebar-v2') {
        p1.style.setProperty('background-color', '#ffffff', 'important');
        p1.style.setProperty('padding',         '12px 16px', 'important');
        p1.style.setProperty('display',         'flex', 'important');
        p1.style.setProperty('align-items',     'center', 'important');
        p1.style.setProperty('justify-content', 'center', 'important');
        p1.style.setProperty('width',           '100%', 'important');
        p1.style.setProperty('box-sizing',      'border-box', 'important');
        p1.style.setProperty('border-bottom',   '1px solid #e2e8f0', 'important');
      }
    }

    applyFavicon(locId);
    document.title = title;
  }

  // ============================================================
  //  THEME INJECTION
  // ============================================================
  function applyTheme() {
    const key   = getThemeKey();
    const theme = key ? themes[key] : null;
    var old = document.getElementById('hl-custom-theme');
    if (old) old.remove();
    if (!theme) return;
    var s = document.createElement('style');
    s.id = 'hl-custom-theme';
    s.textContent = buildCSS(theme);
    (document.body || document.head).appendChild(s);
  }

  // ============================================================
  //  SIDEBAR BACKGROUND — only colors, never width
  // ============================================================
  function fixSidebarColors() {
    const sb = document.getElementById('sidebar-v2');
    if (!sb) return;
    sb.style.setProperty('background-color', '#ffffff', 'important');
    sb.style.setProperty('border-right',     '1px solid #e2e8f0', 'important');

    sb.querySelectorAll(':scope > div, :scope > div > div').forEach(function(d) {
      d.style.setProperty('background-color', '#ffffff', 'important');
    });

    const tsEl = sb.querySelector('.transition-slowest') ||
                 document.querySelector('#app div.transition-slowest');
    if (tsEl) {
      tsEl.style.setProperty('background-color', '#ffffff', 'important');
      if (tsEl.offsetWidth > 100) {
        tsEl.querySelectorAll('nav a span, nav a .nav-title, nav a p').forEach(function(el) {
          el.style.removeProperty('display');
          el.style.setProperty('visibility', 'visible', 'important');
          el.style.setProperty('opacity',    '1',       'important');
        });
      }
    }
  }

  // ============================================================
  //  HARD RESET — wipes ALL inline color styles from every nav
  //  item in the DOM. Called on account switch to clear stale
  //  colors left by the previous sub-account's theme.
  // ============================================================
  function hardResetAllNavItems() {
    // Reset by ID list
    NAV_IDS.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.removeProperty('background-color');
      el.style.removeProperty('background-image');
      el.style.removeProperty('color');
      el.style.removeProperty('border-left');
      el.querySelectorAll('span,p').forEach(function(c) { c.style.removeProperty('color'); });
      el.querySelectorAll('svg').forEach(function(c) {
        c.style.removeProperty('color');
        c.style.removeProperty('stroke');
      });
      // Clear the hover-fixed flag so listeners reattach with new theme
      el._hoverFixed = false;
    });

    // Also reset by DOM query — catches any IDs not in our list
    var sb = document.getElementById('sidebar-v2');
    if (sb) {
      sb.querySelectorAll('nav a').forEach(function(el) {
        el.style.removeProperty('background-color');
        el.style.removeProperty('background-image');
        el.style.removeProperty('color');
        el.style.removeProperty('border-left');
        el.querySelectorAll('span,p').forEach(function(c) { c.style.removeProperty('color'); });
        el.querySelectorAll('svg').forEach(function(c) {
          c.style.removeProperty('color');
          c.style.removeProperty('stroke');
        });
      });
    }
  }

  // ============================================================
  //  ACTIVE STATE MANAGER — single source of truth
  //  Clears ALL items, applies accent ONLY to the one GHL
  //  has actually marked active. Prevents multi-highlight bug.
  // ============================================================
  function syncActiveStates() {
    const key   = getThemeKey();
    const theme = key ? themes[key] : null;
    if (!theme) return;

    NAV_IDS.forEach(function(id) {
      const el = document.getElementById(id);
      if (!el) return;

      const isActive = el.classList.contains('active') ||
                       el.classList.contains('router-link-exact-active') ||
                       el.classList.contains('router-link-active');

      if (isActive) {
        el.style.setProperty('background-color', theme.accent, 'important');
        el.style.setProperty('background-image', 'none', 'important');
        el.style.setProperty('color',            '#ffffff', 'important');
        el.style.setProperty('border-left',      '3px solid ' + theme.accentHover, 'important');
        el.querySelectorAll('span,p').forEach(function(c) {
          c.style.setProperty('color', '#ffffff', 'important');
        });
        el.querySelectorAll('svg').forEach(function(c) {
          c.style.setProperty('color',  '#ffffff', 'important');
          c.style.setProperty('stroke', '#ffffff', 'important');
        });
      } else {
        el.style.removeProperty('background-color');
        el.style.removeProperty('background-image');
        el.style.removeProperty('color');
        el.style.removeProperty('border-left');
        el.querySelectorAll('span,p').forEach(function(c) { c.style.removeProperty('color'); });
        el.querySelectorAll('svg').forEach(function(c) {
          c.style.removeProperty('color');
          c.style.removeProperty('stroke');
        });
      }
    });
  }

  // ============================================================
  //  HOVER FIX
  //  mouseenter → accent
  //  mouseleave → syncActiveStates (restores truth)
  //  click      → wipe all others instantly, re-sync after Vue
  // ============================================================
  function applyHoverFix() {
    const key   = getThemeKey();
    const theme = key ? themes[key] : null;
    if (!theme) return;

    NAV_IDS.forEach(function(id) {
      const el = document.getElementById(id);
      if (!el || el._hoverFixed) return;
      el._hoverFixed = true;

      el.addEventListener('mouseenter', function() {
        el.style.setProperty('background-color', theme.accent, 'important');
        el.style.setProperty('background-image', 'none', 'important');
        el.style.setProperty('color',            '#ffffff', 'important');
        el.querySelectorAll('span,p').forEach(function(c) {
          c.style.setProperty('color', '#ffffff', 'important');
        });
        el.querySelectorAll('svg').forEach(function(c) {
          c.style.setProperty('color',  '#ffffff', 'important');
          c.style.setProperty('stroke', '#ffffff', 'important');
        });
      });

      el.addEventListener('mouseleave', function() {
        syncActiveStates();
      });

      el.addEventListener('click', function() {
        NAV_IDS.forEach(function(otherId) {
          var other = document.getElementById(otherId);
          if (!other || other === el) return;
          other.style.removeProperty('background-color');
          other.style.removeProperty('background-image');
          other.style.removeProperty('color');
          other.style.removeProperty('border-left');
          other.querySelectorAll('span,p').forEach(function(c) { c.style.removeProperty('color'); });
          other.querySelectorAll('svg').forEach(function(c) {
            c.style.removeProperty('color');
            c.style.removeProperty('stroke');
          });
        });
        setTimeout(syncActiveStates, 80);
        setTimeout(syncActiveStates, 300);
        setTimeout(syncActiveStates, 700);
      });
    });
  }

  // ============================================================
  //  RUN — full re-apply of everything
  // ============================================================
  function run() {
    applyCorrectLogo();
    applyTheme();
    fixSidebarColors();
    applyHoverFix();
    syncActiveStates();
  }

  // ============================================================
  //  ACCOUNT SWITCH DETECTION
  //  Watches for location ID changes in the URL.
  //  On switch: hard-reset ALL inline styles first, then re-run.
  //  This is what fixes the "stale colors after switching" bug.
  // ============================================================
  var lastLocationId = getCurrentLocationId();
  var lastPath       = window.location.pathname;

  function checkForAccountSwitch() {
    var newLocId = getCurrentLocationId();
    var newPath  = window.location.pathname;

    var switched = (newLocId !== lastLocationId) ||
                   (newPath !== lastPath && (
                     newPath.includes('/location/') ||
                     isAgencyView() !== (lastPath.includes('/agency'))
                   ));

    if (switched) {
      lastLocationId = newLocId;
      lastPath       = newPath;

      // Immediately wipe all stale inline styles
      hardResetAllNavItems();

      // Then re-apply theme and correct active state
      setTimeout(run,              200);
      setTimeout(syncActiveStates, 400);
      setTimeout(syncActiveStates, 800);
      setTimeout(syncActiveStates, 1500);
    }
  }

  // Initial boot
  run();
  setTimeout(run,              600);
  setTimeout(run,             1500);
  setTimeout(syncActiveStates, 2500);
  setTimeout(syncActiveStates, 4000);

  // DOM mutation watcher
  new MutationObserver(function(mutations) {
    var hasNodes = mutations.some(function(m) { return m.addedNodes.length > 0; });
    if (hasNodes) {
      applyCorrectLogo();
      fixSidebarColors();
      applyHoverFix();
      setTimeout(syncActiveStates, 50);
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Route + account-switch watcher (runs every 300ms)
  setInterval(function () {
    checkForAccountSwitch();
  }, 300);

  history.pushState = (function (orig) {
    return function () {
      orig.apply(this, arguments);
      hardResetAllNavItems();
      setTimeout(run,              300);
      setTimeout(syncActiveStates, 150);
      setTimeout(syncActiveStates, 500);
    };
  })(history.pushState);

  history.replaceState = (function (orig) {
    return function () {
      orig.apply(this, arguments);
      hardResetAllNavItems();
      setTimeout(run,              300);
      setTimeout(syncActiveStates, 150);
    };
  })(history.replaceState);

  window.addEventListener('popstate', function() {
    hardResetAllNavItems();
    setTimeout(run,              300);
    setTimeout(syncActiveStates, 150);
  });

  document.querySelectorAll('#sidebar-v2 nav a').forEach(a => console.log(
  a.textContent.trim(), '|', a.id, '|', a.getAttribute('meta'), '|',
  a.getAttribute('href'), '|', a.closest('nav').parentElement.className
))

})();
</script>