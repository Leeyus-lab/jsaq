/* ============================================================
   设置模块 v2.1：主题 / 语言 / 字号 / 水印 / 缓存 / 开源许可
   ============================================================ */
(function () {
  "use strict";
  function el(id) { return document.getElementById(id); }
  function toast(m, t) {
    var w = el("toasts"), n = document.createElement("div");
    n.className = "toast " + (t || ""); n.textContent = m;
    w.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 2600);
  }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- i18n（覆盖主要界面文案） ---------- */
  var I18N = {
    en: {
      navLogin: "⚡ Login", navReg: "📝 Register", navMine: "👤 Me",
      statusReady: "Ready", viewAll: "View all ›",
      modeUserid: "Link / userId", modeLogin: "Account",
      linkOrUid: "Link / userId", phUid: "Paste link or enter userId",
      school: "School", phSchool: "e.g. Nanjing University", searchSchool: "Search",
      account: "Account", phAccount: "Student ID / phone", password: "Password",
      phPwd: "Password", disclaimerShort: "I have read and agree to the", disclaimer: "Disclaimer",
      startRun: "Start Auto-complete", runLog: "Run log", clear: "Clear",
      phSchool2: "Enter school keyword", faculty: "Faculty", major: "Major",
      name: "Name", phName: "Real name",
      accountReg: "Account", phAccountReg: "Login account, defaults to your name",
      nameHint: "ℹ️ The initial password equals the account (changeable on the platform later)",
      regAndRun: "Register & Auto-complete",
      linkTitle: "Open external link", linkDesc: "The following link will open in your system browser:",
      linkOpenBtn: "Open in browser",
      sgCommon: "⚙️ General", themeMode: "Theme", language: "Language",
      sgCharity: "💖 Charity (Baby Come Home)", enableCarousel: "Enable carousel",
      carouselSub: "Show missing-child info carousel on main pages",
      bbhjPage: "Baby Come Home · Wall", viewHistory: "Playback history",
      sgDisplay: "🔔 Display & Notifications", notif: "Notifications",
      fontSize: "Font size", fontS: "S", fontM: "M", fontL: "L",
      watermark: "Show source watermark",
      sgData: "💾 Data & Cache", cacheSize: "Cache size", clearBtn: "Clear",
      autoUpdate: "Auto update data", autoUpdateSub: "Fetch latest charity data on startup",
      sgAbout: "📜 About & Legal", version: "Version", ossLicense: "Open-source licenses",
      thirdParty: "Third-party notice (NOTICE)", charityThanks: "Charity data credits",
      thanksSub: "All missing-child info comes from a random public charity API, to help spread search clues.",
      authorInfo: "Author",
      back: "‹ Back", bbhjTitle: "Baby Come Home", followList: "Followed",
      phSearch: "Search name / place / year", search: "Search", refresh: "Refresh",
      loadMore: "Load more",
      dBirth: "Born", dLostTime: "Lost on", dLostPlace: "Lost at", dFeature: "Features",
      dContact: "📞 Official contact", dTel: "Tel", dMobile: "Mobile", dQQ: "QQ group",
      dAddr: "Address", dTime: "Service hours",
      makePoster: "🖼 Make poster", followCase: "💗 Follow case", markViewed: "✓ Mark seen",
      notifBanner: "Enable notifications to receive clues",
      howGetUid: "How to get link / userId?", gotIt: "Got it",
      notifTitle: "Enable missing-child alerts", later: "Not now", allow: "Allow",
      skip: "Skip", followLater: "Follow later",
      playHistory: "Playback history", newFirst: "Newest first", oldFirst: "Oldest first",
      export: "Export", clearAll: "Clear all", confirmTitle: "Confirm",
      confirmClearHistory: "Clear all playback history? This cannot be undone.",
      cancel: "Cancel", confirm: "OK", close: "Close",
      ossLicenseTitle: "Open-source licenses",
      sharePoster: "Missing-child poster", saveShare: "Save / Share",
      certificate: "Certificate", certTip: "Full marks! Certificate generated.",
      save: "Save", agreeBtn: "I agree",
      statusRun: "Running..."
    }
  };

  function applyLang(lang) {
    if (lang === "zh") {
      /* v2.1.1：切回中文直接从快照恢复，不再 location.reload() */
      document.querySelectorAll("[data-i18n]").forEach(function (n) {
        var orig = n.getAttribute("data-orig");
        if (orig != null) { n.textContent = orig; n.removeAttribute("data-applied"); }
      });
      document.querySelectorAll("[data-i18n-ph]").forEach(function (n) {
        var orig = n.getAttribute("data-orig-ph");
        if (orig != null) n.placeholder = orig;
      });
      document.documentElement.lang = "zh-CN";
      return;
    }
    var dict = I18N[lang];
    if (!dict) return;
    document.querySelectorAll("[data-i18n]").forEach(function (n) {
      if (!n.getAttribute("data-orig")) n.setAttribute("data-orig", n.textContent);
      var v = dict[n.dataset.i18n];
      if (v) n.textContent = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (n) {
      if (!n.getAttribute("data-orig-ph")) n.setAttribute("data-orig-ph", n.placeholder || "");
      var v = dict[n.dataset.i18nPh];
      if (v) n.placeholder = v;
    });
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  }

  /* ---------- 主题 ---------- */
  var THEME_KEY = "v21_theme", CSS_KEY = "v21_custom_css";
  function applyTheme(name) {
    document.body.dataset.theme = name === "custom" ? (lsGet("v21_theme_base", "midnight")) : name;
    document.querySelectorAll(".theme-dot").forEach(function (d) {
      d.classList.toggle("active", d.dataset.theme === name);
    });
    el("customCssRow").classList.toggle("hidden", name !== "custom");
  }
  function applyCustomCss(css) {
    var tag = document.getElementById("customCssTag");
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "customCssTag";
      document.head.appendChild(tag);
    }
    tag.textContent = css || "";
  }

  /* ---------- 缓存 ---------- */
  function refreshCacheSize() {
    if (window.BBHJ) el("cacheSize").textContent = BBHJ.fmtBytes(BBHJ.cacheBytes());
  }

  function init() {
    /* 恢复设置 */
    applyTheme(lsGet(THEME_KEY, "midnight"));
    applyCustomCss(lsGet(CSS_KEY, ""));
    el("customCssInput").value = lsGet(CSS_KEY, "");
    var font = lsGet("v21_font", "m");
    document.documentElement.dataset.font = font;
    document.querySelectorAll("#fontSeg button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.font === font);
    });
    var lang = lsGet("v21_lang", "zh");
    document.querySelectorAll("#langSeg button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.lang === lang);
    });
    if (lang !== "zh") applyLang(lang);
    el("setWatermark").checked = lsGet("set_watermark", true);
    document.body.classList.toggle("no-watermark", !lsGet("set_watermark", true));
    el("setCarousel").checked = lsGet("set_carousel", true);
    el("setNotif").checked = lsGet("set_notif", true);
    el("setAutoUpdate").checked = lsGet("set_autoUpdate", true);
    refreshCacheSize();

    /* 主题选择 */
    document.querySelectorAll(".theme-dot").forEach(function (d) {
      d.addEventListener("click", function () {
        var name = d.dataset.theme;
        if (name === "custom") {
          var base = lsGet(THEME_KEY, "midnight");
          lsSet("v21_theme_base", base === "custom" ? lsGet("v21_theme_base", "midnight") : base);
        }
        lsSet(THEME_KEY, name);
        applyTheme(name);
        toast("主题已切换", "ok");
      });
    });
    el("applyCustomCss").addEventListener("click", function () {
      var css = el("customCssInput").value;
      lsSet(CSS_KEY, css);
      applyCustomCss(css);
      toast("自定义CSS已应用", "ok");
    });

    /* 语言 */
    document.querySelectorAll("#langSeg button").forEach(function (b) {
      b.addEventListener("click", function () {
        /* v2.1.1：切换时同步高亮，修复英文态下高亮仍停留在中文的问题 */
        document.querySelectorAll("#langSeg button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        lsSet("v21_lang", b.dataset.lang);
        applyLang(b.dataset.lang);
        toast(b.dataset.lang === "en" ? "Language: English" : "语言：简体中文", "ok");
      });
    });

    /* 字号 */
    document.querySelectorAll("#fontSeg button").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("#fontSeg button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        document.documentElement.dataset.font = b.dataset.font;
        lsSet("v21_font", b.dataset.font);
      });
    });

    /* 开关 */
    el("setWatermark").addEventListener("change", function () {
      lsSet("set_watermark", this.checked);
      document.body.classList.toggle("no-watermark", !this.checked);
    });
    el("setCarousel").addEventListener("change", function () {
      lsSet("set_carousel", this.checked);
      if (window.BBHJ) BBHJ.renderCarousels();
    });
    el("setNotif").addEventListener("change", function () {
      lsSet("set_notif", this.checked);
      if (window.BBHJ) BBHJ.updateNotifUI();
    });
    el("setAutoUpdate").addEventListener("change", function () {
      lsSet("set_autoUpdate", this.checked);
    });

    /* 缓存 */
    el("clearCacheBtn").addEventListener("click", function () {
      if (window.BBHJ) BBHJ.clearImgCache();
      refreshCacheSize();
      toast("缓存已清除", "ok");
    });

    /* 我的 → 宝贝回家页面入口（v2.1.1：记录来源页，返回时回到"我的"） */
    el("openBbhjPage").addEventListener("click", function () {
      if (window.BBHJ && BBHJ.openWall) BBHJ.openWall();
    });

    /* v2.1.1 二级菜单：第三方声明 / 公益数据致谢 */
    el("openNoticeBtn").addEventListener("click", function () { el("noticeModal").classList.add("show"); });
    el("noticeClose").addEventListener("click", function () { el("noticeModal").classList.remove("show"); });
    el("openThanksBtn").addEventListener("click", function () { el("thanksModal").classList.add("show"); });
    el("thanksClose").addEventListener("click", function () { el("thanksModal").classList.remove("show"); });

    /* 开源许可 */
    el("openLicenseBtn").addEventListener("click", function () {
      el("licenseModal").classList.add("show");
    });
    el("licenseClose").addEventListener("click", function () { el("licenseModal").classList.remove("show"); });
    document.querySelectorAll(".lic-link").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var key = a.dataset.lic;
        var license = (window.LICENSES || {})[key];
        el("licenseTitle").textContent = key === "apache" ? "Apache License 2.0" : "Mozilla Public License 2.0";
        el("licenseText").textContent = license || "协议全文缺失";
        el("licenseTextModal").classList.add("show");
      });
    });
    el("licenseTextClose").addEventListener("click", function () { el("licenseTextModal").classList.remove("show"); });

    /* 定时刷新缓存显示 */
    setInterval(refreshCacheSize, 8000);
  }

  window.__settingsInit = init;
})();
