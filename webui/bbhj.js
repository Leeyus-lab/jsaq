/* ============================================================
   宝贝回家公益模块 v2.1
   数据来源：起零数据公益API（api.istero.com）/ 宝贝回家寻亲网
   ============================================================ */
(function () {
  "use strict";

  var API = "https://api.istero.com/resource/v1/baby/come/home";
  /* 起零数据公益 API 的 Token（开源版请自行申请后填入，详见 README「公益模块配置」）
     申请地址：https://www.istero.com （资源：宝贝回家公益接口） */
  var TOKEN = "";

  /* ---------- 通用工具（供各模块共用） ---------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  function toast(msg, type) {
    var wrap = el("toasts");
    if (!wrap) return;
    var t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2900);
  }
  function pyApi() {
    return (window.pywebview && window.pywebview.api) ? window.pywebview.api : null;
  }
  function isApk() { return !!(window.Android && window.Android.saveImage); }
  function isExe() { return !!pyApi(); }
  function fmtTime(ts) {
    var d = new Date(ts);
    function p(n) { return n < 10 ? "0" + n : "" + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " +
      p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  /* ---------- 本地存储 ---------- */
  var K = {
    history: "bbhj_history_v21",
    follow: "bbhj_follow_v21",
    contact: "bbhj_contact_v21",
    imgCache: "bbhj_imgcache_v21",
    notifAsked: "bbhj_notif_asked_v21"
  };
  function lsGet(k, def) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* ---------- v2.1：exe 端文件级持久化（WebView2 localStorage 不稳，改为 %APPDATA% 快照兜底） ---------- */
  function persistableKeys() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k === K.imgCache || k === K.notifAsked) continue; /* 图片缓存不入盘 */
      if (k.indexOf("bbhj_") === 0 || k.indexOf("v21_") === 0) out[k] = localStorage.getItem(k);
    }
    return out;
  }
  var persistTimer = null;
  function persistNow() {
    var a = pyApi();
    if (!a || !a.save_state) return;
    try { a.save_state(JSON.stringify(persistableKeys())); } catch (e) {}
  }
  function schedulePersist() {
    if (!isExe()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, 600);
  }
  /* 劫持 setItem/removeItem：任何 bbhj_ 或 v21_ 前缀键写入时自动同步到文件（防抖合并） */
  (function () {
    var _set = localStorage.setItem.bind(localStorage);
    var _rm = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = function (k, v) { _set(k, v); schedulePersist(); };
    localStorage.removeItem = function (k) { _rm(k); schedulePersist(); };
  })();
  /* 关闭页面前强制落盘，避免防抖窗口内退出丢数据 */
  window.addEventListener("pagehide", function () {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    persistNow();
  });
  /* bridge 启动注入：把上次保存的键值恢复进 localStorage（早于 init 执行） */
  window.__restoreState = function (s) {
    try {
      var o = JSON.parse(s);
      Object.keys(o).forEach(function (k) {
        try { if (localStorage.getItem(k) !== o[k]) _lsRawSet(k, o[k]); } catch (e) {}
      });
      /* 恢复后立即重渲染（若页面已初始化） */
      if (window.BBHJ && window.BBHJ.refreshAll) { try { window.BBHJ.refreshAll(); } catch (e) {} }
    } catch (e) {}
  };
  function _lsRawSet(k, v) {
    /* 用原生 setItem 恢复，不触发落盘回环 */
    try { Storage.prototype.setItem.call(localStorage, k, v == null ? "" : String(v)); } catch (e) {}
  }


  function getHistory() {
    var h = lsGet(K.history, []);
    /* v2.1 修复：过滤历史脏数据（API 限流返回错误时旧版会把"未知"记录写进历史），
       首次读取时自动清理并回写 */
    var clean = h.filter(function (r) {
      return r && r.id && r.name && r.name !== "未知";
    });
    if (clean.length !== h.length) lsSet(K.history, clean);
    return clean;
  }
  function saveHistory(h) { lsSet(K.history, h.slice(0, 500)); }
  function getFollow() { return lsGet(K.follow, []); }
  function isFollowed(id) { return getFollow().some(function (r) { return r.id === id; }); }

  /* 图片缓存 */
  function getImgCache() { return lsGet(K.imgCache, {}); }
  function putImgCache(url, dataUrl) {
    if (!dataUrl || dataUrl.length > 400000) return;
    var c = getImgCache();
    c[url] = dataUrl;
    var keys = Object.keys(c);
    if (keys.length > 60) { delete c[keys[0]]; }
    lsSet(K.imgCache, c);
  }
  function cacheBytes() {
    var total = 0;
    [K.imgCache, K.history, K.follow, K.contact].forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v) total += v.length + k.length;
    });
    return total * 2; // UTF-16
  }
  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  /* ---------- 网络层（跨平台） ---------- */
  /* v2.1.1：exe 端桥接改为异步回调（pywebview 同步调用会阻塞 UI 线程，
     导致电脑端刷新公益数据时整个界面卡死）。 */
  var proxySeq = 0, proxyCbs = {};
  window.__proxyDone = function (cb, txt) {
    var f = proxyCbs[cb];
    if (f) { delete proxyCbs[cb]; f(txt); }
  };
  window.__proxyImgDone = function (cb, b64) {
    var f = proxyCbs[cb];
    if (f) { delete proxyCbs[cb]; f(b64 || ""); }
  };
  function pyProxy(fnName, url) {
    return new Promise(function (resolve) {
      var a = pyApi();
      if (!a || !a[fnName]) { resolve(null); return; }
      var id = "pcb" + (++proxySeq);
      proxyCbs[id] = resolve;
      /* 超时兜底：25 秒后仍未回调则放弃，避免 Promise 永久挂起 */
      setTimeout(function () {
        if (proxyCbs[id]) { delete proxyCbs[id]; resolve(null); }
      }, 25000);
      try { a[fnName](url, id); } catch (e) { delete proxyCbs[id]; resolve(null); }
    });
  }

  function fetchRecord() {
    if (!TOKEN) return Promise.reject("未配置公益数据 Token，公益模块已停用（配置方法见 README）");
    var url = API + "?token=" + TOKEN;
    var a = pyApi();
    if (a && a.proxy_get) {
      return pyProxy("proxy_get", url).then(function (txt) {
        if (txt == null) return Promise.reject("网络请求失败");
        var j;
        try { j = typeof txt === "string" ? JSON.parse(txt) : txt; }
        catch (e) { return Promise.reject("响应解析失败"); }
        var rec = normalize(j);
        if (!rec) return Promise.reject("接口无有效数据（可能限流）");
        return rec;
      });
    }
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var rec = normalize(j);
      if (!rec) return Promise.reject("接口无有效数据（可能限流）");
      return rec;
    });
  }

  /* 批量拉取 n 条。v2.1 修复：公益接口限流 1次/秒，并行请求会大量返回 429，
     旧版把 429 错误响应当成有效记录（name="未知"、id=时间戳）写入历史，
     造成"启动/刷新/清除后全变未知"。改为串行 + 1.2s 间隔。 */
  function fetchRecords(n) {
    var out = [];
    function next(i) {
      if (i >= n) return Promise.resolve(out);
      return fetchRecord().then(function (r) { if (r) out.push(r); })
        .catch(function () {})
        .then(function () { return new Promise(function (res) { setTimeout(res, 1200); }); })
        .then(function () { return next(i + 1); });
    }
    return next(0);
  }

  /* 清洗字段：接口偶发返回 ",," 之类的空壳值 */
  function clean(v) {
    v = (v == null ? "" : String(v)).trim();
    return /^[,，\s]*$/.test(v) ? "" : v;
  }

  function normalize(j) {
    /* v2.1 修复：接口限流(429)/出错时 data.information 为空，必须视为失败，
       绝不能生成 name="未知" 的假记录 */
    var d = (j && j.data) || {};
    var info = d.information || {};
    if (!info.name || (!info.id && !info.photo)) return null;
    var contact = d.contact || {};
    if (contact.tel || contact.mobile) lsSet(K.contact, contact);
    return {
      id: String(info.id || Date.now()),
      name: info.name,
      gender: clean(info.gender),
      photo: info.photo || "",
      feature: clean(info.feature),
      birth_time: clean(info.birth_time),
      lost_time: clean(info.lost_time),
      lost_place: clean(info.lost_place),
      fetchedAt: Date.now()
    };
  }

  function getContact() { return lsGet(K.contact, {}); }

  /* 获取图片 dataURL（跨平台，仅海报合成时使用；列表/轮播缩略图直接用远程 URL，不走此通道） */
  function imgData(url) {
    if (!url) return Promise.resolve("");
    var c = getImgCache();
    if (c[url]) return Promise.resolve(c[url]);
    var a = pyApi();
    if (a && a.proxy_get_image) {
      return pyProxy("proxy_get_image", url).then(function (b64) {
        if (!b64) return "";
        var du = "data:image/jpeg;base64," + b64;
        putImgCache(url, du);
        return du;
      });
    }
    return fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
      return new Promise(function (res) {
        var fr = new FileReader();
        fr.onloadend = function () {
          putImgCache(url, fr.result);
          res(fr.result);
        };
        fr.onerror = function () { res(""); };
        fr.readAsDataURL(blob);
      });
    }).catch(function () { return ""; });
  }

  /* ---------- 记录入历史 ---------- */
  function addRecord(rec) {
    /* v2.1 修复：无效记录（限流错误响应）绝不入库 */
    if (!rec || !rec.id || !rec.name || rec.name === "未知") return null;
    var h = getHistory();
    if (h.some(function (r) { return r.id === rec.id; })) return null;
    rec.shownAt = Date.now();
    rec.viewed = false;
    h.unshift(rec);
    saveHistory(h);
    return rec;
  }

  /* ---------- 轮播 ---------- */
  var carousels = [];
  function initCarousel(boxId, trackId, dotsId) {
    var c = { box: el(boxId), track: el(trackId), dots: el(dotsId), idx: 0, timer: null, paused: false };
    carousels.push(c);
    var box = c.box;
    box.addEventListener("mouseenter", function () { c.paused = true; });
    box.addEventListener("mouseleave", function () { c.paused = false; });
    box.addEventListener("touchstart", function () { c.paused = true; }, { passive: true });
    box.addEventListener("touchend", function () { setTimeout(function () { c.paused = false; }, 4000); });
    /* 手动左右滑动 */
    var sx = null;
    box.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) slideBy(c, dx < 0 ? 1 : -1);
      sx = null;
    });
    return c;
  }

  function renderCarousels() {
    var list = getHistory();
    carousels.forEach(function (c) {
      var enabled = lsGet("set_carousel", true);
      if (!enabled || !list.length) {
        c.box.innerHTML = '<div class="carousel-placeholder">暂无公益数据' + (enabled ? "" : "（轮播已在设置中关闭）") + "</div>";
        c.timer && clearInterval(c.timer);
        return;
      }
      c.box.style.padding = "0";
      var html = list.map(function (r) {
        return '<div class="bbhj-slide" data-id="' + esc(r.id) + '">' +
          "<img src=\"" + esc(r.photo) + "\" loading=\"lazy\" alt=\"\" />" +
          '<div><span class="slide-tag">寻找 ' + esc(r.name) + "</span>" +
          '<div class="slide-line">📍 ' + esc(r.lost_place || "地点不详") + "</div>" +
          '<div class="slide-line">🕐 ' + esc(r.lost_time || "时间不详") + "</div></div></div>";
      }).join("");
      c.track = c.box.querySelector(".carousel-track") || c.track;
      if (!c.track) {
        c.box.innerHTML = '<div class="carousel-track">' + html + '</div><div class="carousel-dots"></div><button class="carousel-all">查看全部 ›</button>';
        c.track = c.box.querySelector(".carousel-track");
        c.dots = c.box.querySelector(".carousel-dots");
      } else {
        c.track.innerHTML = html;
      }
      c.dots.innerHTML = list.slice(0, 10).map(function (_, i) {
        return "<i class=\"" + (i === 0 ? "on" : "") + "\"></i>";
      }).join("");
      c.box.querySelectorAll(".bbhj-slide").forEach(function (s) {
        s.addEventListener("click", function () { openDetail(s.dataset.id); });
      });
      c.idx = 0;
      c.track.style.transform = "translateX(0)";
      if (c.timer) clearInterval(c.timer);
      c.timer = setInterval(function () {
        if (!c.paused && !document.hidden) slideBy(c, 1);
      }, 5000);
    });
  }

  function slideBy(c, dir) {
    var n = c.track.children.length;
    if (!n) return;
    c.idx = (c.idx + dir + n) % n;
    c.track.style.transform = "translateX(-" + c.idx * 100 + "%)";
    c.dots.querySelectorAll("i").forEach(function (d, i) {
      d.className = i === c.idx % c.dots.children.length ? "on" : "";
    });
  }

  /* ---------- 详情页 ---------- */
  var backTarget = "login";
  var bbhjBackTarget = "mine"; /* 寻亲墙的返回目标：记录从哪个页面进入 */
  function currentPage() {
    var pg = document.querySelector(".page.active");
    if (!pg) return "login";
    var id = pg.id || "";
    return id.replace(/^page-/, "") || "login";
  }
  function openDetail(id, from) {
    var rec = getHistory().filter(function (r) { return r.id === id; })[0] ||
              getFollow().filter(function (r) { return r.id === id; })[0];
    if (!rec) { toast("未找到该案例", "err"); return; }
    /* v2.1.1：未显式指定来源时，返回到进入详情前的当前页面（登录/注册/寻亲墙） */
    backTarget = from || currentPage();
    if (backTarget === "detail" || backTarget === "bbhj") backTarget = bbhjBackTarget || "login";
    var ct = getContact();
    el("detailPhoto").src = rec.photo || "";
    el("detailName").textContent = "寻找 " + rec.name;
    el("detailGender").textContent = rec.gender || "";
    el("detailBirth").textContent = rec.birth_time || "—";
    el("detailLostTime").textContent = rec.lost_time || "—";
    el("detailLostPlace").textContent = rec.lost_place || "—";
    el("detailFeature").textContent = rec.feature || "暂无描述";
    el("detailTel").textContent = ct.tel || "—";
    el("detailMobile").textContent = ct.mobile || "—";
    el("detailQQ").textContent = ct.qq_group || "—";
    el("detailAddr").textContent = (ct.address || "—") + (ct.post_code ? "（" + ct.post_code + "）" : "");
    el("detailService").textContent = ct.service_time || "—";
    var fb = el("followBtn");
    fb.textContent = isFollowed(rec.id) ? "💔 取消关注" : "💗 关注此案例";
    fb.dataset.id = rec.id;
    /* v2.1：去掉"标记已看到"按钮，打开详情即自动标记已读 */
    markViewed(rec.id);
    showPage("detail");
  }
  window.__openCase = function (id) { openDetail(id, "login"); };

  /* ---------- 海报合成 ---------- */
  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    var lines = [], line = "";
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = text[i]; }
      else line = test;
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    lines.forEach(function (l, i2) { ctx.fillText(l, x, y + i2 * lineH); });
    return y + lines.length * lineH;
  }

  function makePoster(rec) {
    toast("正在合成海报...", "");
    /* v2.1.1：去掉二维码（在线QR服务不可用），直接生成纯海报 */
    imgData(rec.photo).then(function (photoDu) {
      var W = 750, H = 1200;
      var cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      var ctx = cv.getContext("2d");
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0f172a"); g.addColorStop(0.5, "#1e293b"); g.addColorStop(1, "#312e81");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 64px 'PingFang SC', sans-serif";
      ctx.fillText("宝贝回家 · 寻亲", W / 2, 92);
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "26px 'PingFang SC', sans-serif";
      ctx.fillText("每一次转发，都是一次回家的希望", W / 2, 138);

      var img = new Image();
      img.onload = function () {
        var iw = 460, ih = 460, ix = (W - iw) / 2, iy = 168;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 30;
        ctx.fillStyle = "#fff";
        roundRect(ctx, ix - 8, iy - 8, iw + 16, ih + 16, 24); ctx.fill();
        ctx.restore();
        ctx.save();
        roundRect(ctx, ix, iy, iw, ih, 18); ctx.clip();
        var s = Math.max(iw / img.width, ih / img.height);
        ctx.drawImage(img, ix - (img.width * s - iw) / 2, iy - (img.height * s - ih) / 2, img.width * s, img.height * s);
        ctx.restore();

        var y = iy + ih + 74;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 52px 'PingFang SC', sans-serif";
        ctx.fillText("寻找：" + rec.name + (rec.gender ? "（" + rec.gender + "）" : ""), W / 2, y); y += 56;
        ctx.font = "28px 'PingFang SC', sans-serif";
        ctx.fillStyle = "#e2e8f0";
        var lines = [
          "出生日期：" + (rec.birth_time || "不详"),
          "走失时间：" + (rec.lost_time || "不详")
        ];
        lines.forEach(function (l) { ctx.fillText(l, W / 2, y); y += 46; });
        ctx.textAlign = "left";
        y = wrapText(ctx, "走失地点：" + (rec.lost_place || "不详"), 100, y + 10, 550, 42, 2) + 14;
        if (rec.feature) y = wrapText(ctx, "体貌特征：" + rec.feature, 100, y, 550, 42, 3) + 14;
        ctx.textAlign = "center";

        /* 底部联系栏 */
        var ct = getContact();
        roundRect(ctx, 60, H - 240, W - 120, 170, 22);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 32px 'PingFang SC', sans-serif";
        ctx.fillText("发现线索请联系宝贝回家寻亲网", W / 2, H - 188);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 40px 'PingFang SC', sans-serif";
        ctx.fillText(ct.mobile || "13039194000", W / 2, H - 132);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "22px 'PingFang SC', sans-serif";
        ctx.fillText("数据来源：起零数据公益API · 宝贝回家寻亲网", W / 2, H - 96);

        var dataUrl;
        try { dataUrl = cv.toDataURL("image/png"); }
        catch (e) { toast("海报导出失败：" + e, "err"); return; }
        el("posterImg").src = dataUrl;
        el("posterSave").dataset.data = dataUrl;
        el("posterSave").dataset.name = "寻亲海报_" + rec.name + ".png";
        el("posterModal").classList.add("show");
      };
      img.onerror = function () { toast("照片加载失败，无法合成海报", "err"); };
      img.src = photoDu || rec.photo;
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function savePoster(dataUrl, name) {
    var b64 = dataUrl.split(",")[1];
    if (window.Android && window.Android.shareImage) {
      var r = window.Android.shareImage(b64, name, "宝贝回家寻亲海报");
      if (r && r.indexOf("ok") === 0) toast("已调起分享", "ok");
      else toast("分享失败：" + r, "err");
      return;
    }
    var a = pyApi();
    if (a && a.save_image) {
      a.save_image(b64, name).then(function (res) {
        if (res && res.success) toast("已保存：" + res.path, "ok");
        else toast("保存失败：" + (res && res.error), "err");
      });
      return;
    }
    var link = document.createElement("a");
    link.href = dataUrl; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
  }

  /* ---------- 历史列表页 ---------- */
  var bbhjPage = 0, bbhjFilter = "";
  function renderBbhjList(reset) {
    if (reset) bbhjPage = 0;
    var list = getHistory();
    if (bbhjFilter) {
      var f = bbhjFilter.toLowerCase();
      list = list.filter(function (r) {
        return (r.name || "").toLowerCase().indexOf(f) >= 0 ||
          (r.lost_place || "").toLowerCase().indexOf(f) >= 0 ||
          (r.lost_time || "").indexOf(bbhjFilter) >= 0;
      });
    }
    var PER = 20;
    var show = list.slice(0, (bbhjPage + 1) * PER);
    var box = el("bbhjList");
    if (!show.length) {
      box.innerHTML = '<div class="bbhj-empty">暂无记录，刷新可获取新的公益数据</div>';
    } else {
      box.innerHTML = show.map(function (r) {
        return '<div class="bbhj-item" data-id="' + esc(r.id) + '">' +
          (r.viewed ? "" : '<span class="red-dot"></span>') +
          (isFollowed(r.id) ? '<span class="follow-star">💗</span>' : "") +
          "<img src=\"" + esc(r.photo) + "\" loading=\"lazy\" alt=\"\" />" +
          '<div><div class="bi-name">寻找 ' + esc(r.name) + (r.gender ? "（" + esc(r.gender) + "）" : "") + "</div>" +
          '<div class="bi-line">📍 ' + esc(r.lost_place || "地点不详") + "</div>" +
          '<div class="bi-date">展示于 ' + fmtTime(r.shownAt) + "</div></div></div>";
      }).join("");
      box.querySelectorAll(".bbhj-item").forEach(function (it) {
        it.addEventListener("click", function () { openDetail(it.dataset.id); });
      });
    }
    el("bbhjMoreBtn").classList.toggle("hidden", show.length >= list.length);
  }

  /* ---------- 播放记录弹窗 ---------- */
  function renderHistoryModal(sortDesc) {
    var list = getHistory().slice().sort(function (a, b) {
      return sortDesc ? b.shownAt - a.shownAt : a.shownAt - b.shownAt;
    });
    el("historyCount").textContent = "共记录 " + list.length + " 条";
    var box = el("historyList");
    if (!list.length) { box.innerHTML = '<div class="bbhj-empty">暂无播放记录</div>'; return; }
    box.innerHTML = list.map(function (r) {
      var summary = "寻找" + r.name + "，走失地点" + (r.lost_place || "不详");
      if (summary.length > 22) summary = summary.slice(0, 22) + "...";
      return '<div class="history-item" data-id="' + esc(r.id) + '">' +
        "<img src=\"" + esc(r.photo) + "\" loading=\"lazy\" alt=\"\" />" +
        '<div class="hi-main"><div class="hi-time">' + fmtTime(r.shownAt) + "</div>" +
        '<div class="hi-summary">' + esc(summary) + "</div></div>" +
        '<button class="btn small">详情</button></div>';
    }).join("");
    box.querySelectorAll(".history-item").forEach(function (it) {
      it.addEventListener("click", function () {
        el("historyModal").classList.remove("show");
        openDetail(it.dataset.id, "mine");
      });
    });
  }

  /* ---------- 关注列表弹窗 ---------- */
  function renderFollowModal() {
    var list = getFollow();
    var box = el("followList");
    if (!list.length) { box.innerHTML = '<div class="bbhj-empty">暂无关注的案例</div>'; return; }
    box.innerHTML = list.map(function (r) {
      return '<div class="history-item" data-id="' + esc(r.id) + '">' +
        "<img src=\"" + esc(r.photo) + "\" loading=\"lazy\" alt=\"\" />" +
        '<div class="hi-main"><div class="hi-summary">寻找 ' + esc(r.name) + "</div>" +
        '<div class="hi-time">📍 ' + esc(r.lost_place || "不详") + "</div></div>" +
        '<button class="btn small">详情</button></div>';
    }).join("");
    box.querySelectorAll(".history-item").forEach(function (it) {
      it.addEventListener("click", function () {
        el("followModal").classList.remove("show");
        openDetail(it.dataset.id);
      });
    });
  }

  /* ---------- 通知（手机端） ---------- */
  function notifEnabled() {
    if (window.Android && window.Android.isNotifGranted) {
      return String(window.Android.isNotifGranted()) === "true";
    }
    if (typeof Notification !== "undefined") return Notification.permission === "granted";
    return false;
  }
  function updateNotifUI() {
    var mobile = isApk();
    var banner = el("notifBanner");
    if (mobile && !notifEnabled()) { banner.classList.remove("hidden"); }
    else { banner.classList.add("hidden"); }
  }

  /* 启动公益弹窗内容填充 + 3 秒倒计时（v2.1：所有平台打开软件都展示） */
  function showStartupModal(rec) {
    if (window.__startupTimer) { clearInterval(window.__startupTimer); window.__startupTimer = null; }
    var modal = el("startupModal");
    el("startupPhoto").src = rec.photo || "";
    el("startupName").textContent = "寻找 " + rec.name;
    el("startupGender").textContent = rec.gender || "";
    el("startupPlace").textContent = "📍 " + (rec.lost_place || "地点不详");
    el("startupTime").textContent = "🕐 " + (rec.lost_time || "时间不详");
    modal.classList.add("show");
    var n = 3;
    el("startupCountdown").textContent = n;
    var t = setInterval(function () {
      n--; el("startupCountdown").textContent = n;
      if (n <= 0) { clearInterval(t); modal.classList.remove("show"); }
    }, 1000);
    window.__startupTimer = t;
    el("startupSkip").onclick = function () { clearInterval(t); modal.classList.remove("show"); };
    el("startupFollow").onclick = function () {
      clearInterval(t); modal.classList.remove("show");
      followCase(rec.id, true);
      toast("已加入关注列表", "ok");
    };
    el("startupPhoto").parentElement.onclick = function () {
      clearInterval(t); modal.classList.remove("show");
      openDetail(rec.id, "login");
    };
  }

  function startupFlow(recOverride) {
    var auto = lsGet("set_autoUpdate", true);
    var p;
    if (recOverride) {
      /* init 首次批量拉取后直接复用结果，避免紧接着再请求一次撞限流 */
      p = Promise.resolve({ rec: recOverride, added: null });
    } else if (!auto) {
      p = Promise.resolve(null);
    } else {
      p = fetchRecord().then(function (rec) {
        var added = addRecord(rec);
        renderCarousels();
        return { rec: rec, added: added };
      }).catch(function () { return null; });
    }

    p.then(function (r) {
      var rec = r && r.rec;
      var added = r && r.added;
      /* v2.1 修复：启动弹窗此前只在手机端未开通知权限时展示，
         电脑端/已开通知的手机端只发系统通知、完全没有弹窗。
         现改为：所有平台打开软件都展示公益启动弹窗；
         无新数据时回退到最近一条历史记录，保证弹窗可见。 */
      if (!rec) {
        var h = getHistory();
        if (h.length) rec = h[0];
      }
      if (rec) tryShowStartup(rec);
      /* 系统通知：仅当本次有新入库记录时追加（弹窗之外的提醒） */
      if (added && lsGet("set_notif", true)) {
        if (isApk() && notifEnabled() && window.Android && window.Android.notify) {
          try {
            window.Android.notify("寻找" + added.name, (added.lost_place || "") + " " + (added.lost_time || ""), added.id);
          } catch (e) {}
        } else if (isExe()) {
          var a = pyApi();
          if (a && a.notify) {
            try { a.notify("寻找" + added.name, (added.lost_place || "地点不详") + " " + (added.lost_time || "")); } catch (e) {}
          }
        }
      }
    });
    updateNotifUI();
  }

  function followCase(id, add) {
    var list = getFollow();
    var all = getHistory().concat(list);
    var rec = all.filter(function (r) { return r.id === id; })[0];
    if (!rec) return;
    var idx = list.findIndex(function (r) { return r.id === id; });
    if (add && idx < 0) list.unshift({ id: rec.id, name: rec.name, photo: rec.photo, lost_place: rec.lost_place, lost_time: rec.lost_time });
    if (!add && idx >= 0) list.splice(idx, 1);
    lsSet(K.follow, list);
  }

  function markViewed(id) {
    var h = getHistory();
    h.forEach(function (r) { if (r.id === id) r.viewed = true; });
    saveHistory(h);
  }

  /* ---------- 导出记录 ---------- */
  function exportHistory() {
    var list = getHistory();
    if (!list.length) { toast("暂无记录可导出", "err"); return; }
    var rows = [["展示时间", "姓名", "性别", "出生日期", "走失时间", "走失地点", "体貌特征", "照片链接"]];
    list.forEach(function (r) {
      rows.push([fmtTime(r.shownAt), r.name, r.gender, r.birth_time, r.lost_time, r.lost_place, r.feature, r.photo]);
    });
    var csv = "\uFEFF" + rows.map(function (r) {
      return r.map(function (c) { return "\"" + String(c || "").replace(/"/g, '""') + "\""; }).join(",");
    }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "宝贝回家播放记录.csv";
    document.body.appendChild(a); a.click(); a.remove();
    toast("已导出 CSV", "ok");
  }

  /* ---------- 页面切换（与 app.js 共享） ---------- */
  function showPage(name) {
    document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("active"); });
    var pg = el("page-" + name);
    if (pg) pg.classList.add("active");
    document.querySelectorAll(".topnav .navtab, .bottomnav .navtab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.page === name);
    });
    window.scrollTo(0, 0);
  }

  /* ---------- 初始化 ---------- */
  /* v2.1.1：首次启动先完成通知权限请求弹窗，再展示公益启动弹窗，
     避免系统权限弹窗/公益弹窗互相覆盖。 */
  var startupGateOpen = true;
  var pendingStartupRec = null;
  /* 闸门未开时暂存待弹记录，开闸后立即展示（不再二次请求接口） */
  function tryShowStartup(rec) {
    if (startupGateOpen) showStartupModal(rec);
    else pendingStartupRec = rec;
  }
  function runStartupFlow() {
    if (!startupGateOpen) return;
    if (pendingStartupRec) {
      var r = pendingStartupRec;
      pendingStartupRec = null;
      showStartupModal(r);
    } else {
      startupFlow();
    }
  }

  function init() {
    initCarousel("carouselBox", "carouselTrack", "carouselDots");
    initCarousel("carouselBox2", "carouselTrack2", "carouselDots2");

    /* 首次启动：通知权限说明弹窗（手机端）——先于公益启动弹窗 */
    if (isApk() && !localStorage.getItem(K.notifAsked) && !notifEnabled()) {
      startupGateOpen = false; /* 关闸：等权限弹窗处理完再走启动流程 */
      el("notifAskModal").classList.add("show");
    }
    function notifAskDone() {
      el("notifAskModal").classList.remove("show");
      localStorage.setItem(K.notifAsked, "1");
      startupGateOpen = true;
      runStartupFlow();
    }
    el("notifAllow").addEventListener("click", function () {
      el("notifAskModal").classList.remove("show");
      localStorage.setItem(K.notifAsked, "1");
      if (window.Android && window.Android.requestNotifPermission) {
        window.Android.requestNotifPermission(); /* 结果经 __notifResult 回调后再启动 */
      } else {
        startupGateOpen = true;
        runStartupFlow();
      }
    });
    el("notifLater").addEventListener("click", function () {
      notifAskDone();
      updateNotifUI();
    });
    window.__notifResult = function (granted) {
      startupGateOpen = true;
      updateNotifUI();
      toast(granted ? "通知已开启，感谢您为公益助力" : "已跳过，可稍后在设置中开启", granted ? "ok" : "");
      runStartupFlow();
    };
    el("notifBanner").addEventListener("click", function () {
      if (window.Android && window.Android.openNotifSettings) window.Android.openNotifSettings();
    });

    /* 轮播「查看全部」——记住从哪个页面进入寻亲墙 */
    el("carouselAllBtn").addEventListener("click", function (e) {
      e.stopPropagation(); bbhjBackTarget = currentPage();
      showPage("bbhj"); renderBbhjList(true);
    });
    el("carouselAllBtn2").addEventListener("click", function (e) {
      e.stopPropagation(); bbhjBackTarget = currentPage();
      showPage("bbhj"); renderBbhjList(true);
    });

    /* 列表页 */
    el("bbhjBack").addEventListener("click", function () { showPage(bbhjBackTarget || "mine"); });
    function doSearch() {
      bbhjFilter = el("bbhjSearch").value.trim(); renderBbhjList(true);
    }
    el("bbhjSearchBtn").addEventListener("click", doSearch);
    el("bbhjSearch").addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.keyCode === 13) { e.preventDefault(); doSearch(); }
    });
    el("bbhjRefreshBtn").addEventListener("click", function () {
      toast("正在获取公益数据（接口限流，约需数秒）...", "");
      /* v2.1：串行限流拉取 5 条，杜绝 429 错误记录（"未知"）入库 */
      fetchRecords(5).then(function (list) {
        var added = 0;
        list.forEach(function (r) { if (addRecord(r)) added++; });
        renderCarousels(); renderBbhjList(true);
        toast(added ? "已更新 " + added + " 条" : "暂无新数据（或已展示过）", added ? "ok" : "");
      }).catch(function () { toast("获取失败，请检查网络", "err"); });
    });
    el("bbhjMoreBtn").addEventListener("click", function () { bbhjPage++; renderBbhjList(false); });
    el("openFollowBtn").addEventListener("click", function () { renderFollowModal(); el("followModal").classList.add("show"); });
    el("followClose").addEventListener("click", function () { el("followModal").classList.remove("show"); });

    /* 详情页 */
    el("detailBack").addEventListener("click", function () { showPage(backTarget); if (backTarget === "bbhj") renderBbhjList(true); });
    el("followBtn").addEventListener("click", function () {
      var id = this.dataset.id;
      var add = !isFollowed(id);
      followCase(id, add);
      this.textContent = add ? "💔 取消关注" : "💗 关注此案例";
      toast(add ? "已加入关注列表" : "已取消关注", "ok");
      renderCarousels();
    });
    el("posterBtn").addEventListener("click", function () {
      var id = el("followBtn").dataset.id;
      var rec = getHistory().concat(getFollow()).filter(function (r) { return r.id === id; })[0];
      if (rec) makePoster(rec);
    });
    el("posterClose").addEventListener("click", function () { el("posterModal").classList.remove("show"); });
    el("posterSave").addEventListener("click", function () {
      savePoster(this.dataset.data, this.dataset.name);
    });

    /* 播放记录弹窗 */
    var histSortDesc = true;
    el("openHistoryBtn").addEventListener("click", function () {
      renderHistoryModal(histSortDesc);
      el("historyModal").classList.add("show");
    });
    document.querySelectorAll("#historySortSeg button").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("#historySortSeg button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        histSortDesc = b.dataset.sort === "desc";
        renderHistoryModal(histSortDesc);
      });
    });
    el("clearHistoryBtn").addEventListener("click", function () {
      el("confirmModal").classList.add("show");
    });
    el("confirmCancel").addEventListener("click", function () { el("confirmModal").classList.remove("show"); });
    el("confirmOk").addEventListener("click", function () {
      lsDel(K.history); lsDel(K.follow);
      el("confirmModal").classList.remove("show");
      el("historyModal").classList.remove("show");
      renderCarousels();
      toast("已清空", "ok");
    });
    el("historyClose").addEventListener("click", function () { el("historyModal").classList.remove("show"); });
    el("exportHistoryBtn").addEventListener("click", exportHistory);

    /* 首次拉取 + 启动流程（串行限流拉取；v2.1：先拉 1 条立即弹启动弹窗，
       剩余 4 条后台串行补齐寻亲墙，弹窗无需等待全部拉完） */
    if (!getHistory().length) {
      fetchRecord().then(function (rec) {
        var first = null;
        if (rec) { addRecord(rec); first = rec; }
        renderCarousels();
        startupFlow(first);
        fetchRecords(4).then(function (list) {
          list.forEach(function (r) { addRecord(r); });
          renderCarousels();
        });
      }).catch(function () { renderCarousels(); startupFlow(); });
    } else {
      renderCarousels();
      startupFlow();
    }
  }

  /* 对外接口 */
  window.BBHJ = {
    init: init,
    fetchRecord: fetchRecord,
    addRecord: addRecord,
    renderCarousels: renderCarousels,
    renderList: renderBbhjList,
    showPage: showPage,
    openDetail: openDetail,
    /* v2.1：exe 端状态注入恢复后的整体重渲染（历史/关注/轮播一次刷新） */
    refreshAll: function () {
      try {
        renderCarousels();
        var listPg = document.getElementById("page-bbhj");
        if (listPg && listPg.classList.contains("active")) renderBbhjList(true);
        updateNotifUI();
      } catch (e) {}
    },
    openWall: function () {
      bbhjBackTarget = currentPage();
      showPage("bbhj"); renderBbhjList(true);
    },
    cacheBytes: cacheBytes,
    fmtBytes: fmtBytes,
    clearImgCache: function () { lsDel(K.imgCache); },
    updateNotifUI: updateNotifUI,
    notifEnabled: notifEnabled,
    startupFlow: startupFlow
  };
})();
