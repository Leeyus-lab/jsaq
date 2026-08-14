(function () {
  "use strict";

  var running = false;

  function el(id) { return document.getElementById(id); }

  function pyApi() {
    return (window.pywebview && window.pywebview.api) ? window.pywebview.api : null;
  }

  function appendLog(area, msg, cls) {
    var c = el(area);
    if (!c) return;
    var d = document.createElement("div");
    d.className = "ln " + (cls || "");
    d.textContent = msg;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  }
  window.__log = appendLog;

  function setStatus(text, kind) {
    var dot = el("statusDot");
    var t = el("statusText");
    if (dot) dot.className = "dot" + (kind ? " " + kind : "");
    if (t) t.textContent = text;
  }
  window.__status = setStatus;

  window.__runEnd = function () { setRunning(false); setStatus("就绪", ""); };

  /* ---------- 结业证书 ---------- */
  window.__certificateReady = function (b64data, filepath) {
    var modal = el("certModal");
    var img = el("certImg");
    var dl = el("certDownload");
    var pathEl = el("certPath");

    if (b64data) {
      img.src = "data:image/png;base64," + b64data;
      img.style.display = "";

      var fname = filepath || "结业证书.png";
      if (fname.indexOf("/") >= 0) fname = fname.split("/").pop();

      if (window.Android && window.Android.saveImage) {
        /* APK 模式：通过 Java 接口写入手机相册 */
        dl.href = "#";
        dl.download = "";
        dl.onclick = function (e) {
          e.preventDefault();
          dl.textContent = "保存中...";
          var result = window.Android.saveImage(b64data, fname);
          if (result && result.indexOf("ok:") === 0) {
            dl.textContent = "已保存";
            var savedName = result.substring(3);
            pathEl.textContent = "已保存到相册 Pictures/JSAQ/" + savedName;
            pathEl.style.display = "";
            if (window.Android.toast) window.Android.toast("证书已保存到相册");
          } else {
            dl.textContent = "保存失败，重试";
            pathEl.textContent = "保存失败：" + result;
            pathEl.style.display = "";
            if (window.Android.toast) window.Android.toast("保存失败：" + result);
          }
          return false;
        };
      } else {
        /* 桌面浏览器模式：用 a download */
        dl.href = "data:image/png;base64," + b64data;
        dl.download = fname;
        dl.onclick = null;
      }
      dl.style.display = "";
      pathEl.textContent = "";
      pathEl.style.display = "none";
    } else {
      img.src = "";
      img.style.display = "none";
      dl.style.display = "none";
      pathEl.innerHTML = '证书图片自动下载失败，请<a href="' + filepath + '" target="_blank" style="color:#60a5fa">点此手动查看</a>';
      pathEl.style.display = "";
    }
    modal.classList.add("show");
  };

  el("certClose").addEventListener("click", function () {
    el("certModal").classList.remove("show");
  });

  function setRunning(v) {
    running = v;
    var b = el("startBtn");
    if (b) b.disabled = v;
    if (v) { setStatus("执行中...", "run"); }
  }

  function toast(msg, type) {
    var wrap = el("toasts");
    var t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2900);
  }

  /* ---------- 标签 / 模式切换 ---------- */
  document.querySelectorAll(".tab").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
      document.querySelectorAll(".panel").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      el("panel-" + b.dataset.tab).classList.add("active");
    });
  });

  var mode = "login";
  document.querySelectorAll("#modeSeg button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("#modeSeg button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      mode = b.dataset.mode;
      el("loginBox").classList.toggle("hidden", mode !== "login");
      el("useridBox").classList.toggle("hidden", mode !== "userid");
    });
  });

  /* ---------- 学校搜索 ---------- */
  var selectedSchoolId = null;
  el("searchBtn").addEventListener("click", function () {
    var kw = el("schoolKw").value.trim();
    if (!kw) { toast("请输入学校关键词", "err"); return; }
    el("schoolList").innerHTML = '<div class="school-item">搜索中...</div>';
    var a = pyApi();
    if (a) {
      a.search_schools(kw).then(function (list) { renderSchools(list || []); })
        .catch(function (e) { toast("搜索失败：" + e, "err"); el("schoolList").innerHTML = ""; });
    } else {
      jsSearchSchools(kw).then(renderSchools).catch(function (e) { toast("搜索失败：" + e, "err"); el("schoolList").innerHTML = ""; });
    }
  });

  function renderSchools(list) {
    var box = el("schoolList");
    box.innerHTML = "";
    if (!list || !list.length) { box.innerHTML = '<div class="school-item">未找到匹配学校，请换关键词</div>'; return; }
    list.forEach(function (s) {
      var d = document.createElement("div");
      d.className = "school-item";
      d.textContent = s.name;
      d.addEventListener("click", function () {
        box.querySelectorAll(".school-item").forEach(function (x) { x.classList.remove("sel"); });
        d.classList.add("sel");
        selectedSchoolId = s.id;
        toast("已选择：" + s.name, "ok");
      });
      box.appendChild(d);
    });
  }

  /* ---------- 从平台链接自动提取 userId ---------- */
  function extractUserId(text) {
    if (!text) return "";
    var m = String(text).match(/[?&]userid=(\d+)/i);
    return m ? m[1] : "";
  }
  function applyUrlExtract() {
    var raw = el("urlInput").value.trim();
    var uid = extractUserId(raw);
    if (uid) {
      el("uid").value = uid;
      toast("已自动提取 userId", "ok");
    } else if (raw) {
      toast("未在链接中识别到 userid，请检查", "err");
    }
  }
  el("urlInput").addEventListener("paste", function () {
    setTimeout(applyUrlExtract, 0);
  });
  el("urlInput").addEventListener("change", applyUrlExtract);
  /* 误把整条链接贴进 userId 框时自动纠正 */
  el("uid").addEventListener("input", function () {
    var v = el("uid").value.trim();
    if (!/^\d+$/.test(v) && /[?&]userid=(\d+)/i.test(v)) {
      var uid = extractUserId(v);
      if (uid) { el("uid").value = uid; toast("已从链接自动提取 userId", "ok"); }
    }
  });

  /* ---------- 开始执行 ---------- */
  el("startBtn").addEventListener("click", function () {
    if (running) return;
    var a = pyApi();
    if (mode === "login") {
      if (!selectedSchoolId) { toast("请先搜索并选择学校", "err"); return; }
      var u = el("acc").value.trim();
      var p = el("pwd").value.trim();
      if (!u || !p) { toast("请输入账号和密码", "err"); return; }
      setRunning(true);
      if (a) { a.run_login(selectedSchoolId, u, p); }
      else { jsRunLogin(selectedSchoolId, u, p); }
    } else {
      var uid = el("uid").value.trim();
      if (!uid) { toast("请输入 userId", "err"); return; }
      setRunning(true);
      if (a) { a.run_userid(uid); }
      else { jsRunUserid(uid); }
    }
  });

  /* ---------- 题库管理 ---------- */
  function renderStats(s) {
    el("stSingle").textContent = s.single;
    el("stMulti").textContent = s.multi;
    el("stJudge").textContent = s.judge;
    el("stTotal").textContent = s.total;
  }

  function loadStats() {
    var a = pyApi();
    if (a) {
      a.db_stats().then(renderStats).catch(function (e) { toast("统计失败：" + e, "err"); });
    } else {
      renderStats(jsStats());
    }
  }
  el("refreshStats").addEventListener("click", loadStats);

  /* ---- 查看题库 ---- */
  var viewPage = 1;
  var viewKw = "";
  var VIEW_PER = 60;

  function loadView(reset) {
    if (reset) { viewPage = 1; }
    viewKw = el("viewKw").value.trim();
    var a = pyApi();
    if (a) {
      a.db_list(viewKw, viewPage).then(renderView).catch(function (e) { toast("查询失败：" + e, "err"); });
    } else {
      renderView(jsDbList(viewKw, viewPage));
    }
  }
  el("viewBtn").addEventListener("click", function () { loadView(true); });
  el("viewKw").addEventListener("keydown", function (e) { if (e.key === "Enter") { loadView(true); } });
  el("viewPrev").addEventListener("click", function () { if (viewPage > 1) { viewPage--; loadView(false); } });
  el("viewNext").addEventListener("click", function () { viewPage++; loadView(false); });

  function qtLabel(qt) { return qt === "1" ? "单选" : qt === "2" ? "多选" : qt === "3" ? "判断" : qt; }
  function renderView(data) {
    var rows = data.rows || [];
    var total = data.total || rows.length;
    var tb = el("viewBody");
    tb.innerHTML = "";
    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:18px">无匹配题目</td></tr>';
    } else {
      rows.forEach(function (r) {
        var tr = document.createElement("tr");
        tr.innerHTML = '<td>' + r.qid + '</td><td><b>' + r.ans + '</b></td><td>' + qtLabel(r.qt) + '</td>';
        tb.appendChild(tr);
      });
    }
    el("viewPageInfo").textContent = "第 " + viewPage + " 页 / 共 " + Math.max(1, Math.ceil(total / VIEW_PER)) + " 页（" + total + " 条）";
    el("viewPrev").disabled = viewPage <= 1;
  }

  el("addBtn").addEventListener("click", function () {
    var qid = el("addQid").value.trim();
    var ans = el("addAns").value.trim().toUpperCase();
    var qt = el("addQt").value;
    if (!qid || !ans) { toast("请填写题目ID和答案", "err"); return; }
    var a = pyApi();
    if (a) {
      a.db_add(qid, ans, qt).then(function (m) { appendLog("dbConsole", m, "ok"); toast(m, "ok"); loadStats(); })
        .catch(function (e) { appendLog("dbConsole", "错误：" + e, "err"); });
    } else {
      var m = jsDbAdd(qid, ans, qt);
      appendLog("dbConsole", m, "ok"); toast(m, "ok"); loadStats();
    }
    el("addQid").value = ""; el("addAns").value = "";
  });

  var pendingDel = null;
  el("delBtn").addEventListener("click", function () {
    var qid = el("delQid").value.trim();
    if (!qid) { toast("请输入题目ID", "err"); return; }
    pendingDel = qid;
    el("modalQid").textContent = qid;
    el("modal").classList.add("show");
  });
  el("modalCancel").addEventListener("click", function () {
    el("modal").classList.remove("show"); pendingDel = null;
  });
  el("modalOk").addEventListener("click", function () {
    el("modal").classList.remove("show");
    var qid = pendingDel; pendingDel = null;
    if (!qid) return;
    var a = pyApi();
    if (a) {
      a.db_delete(qid).then(function (m) { appendLog("dbConsole", m, "ok"); toast(m, "ok"); loadStats(); loadView(false); })
        .catch(function (e) { appendLog("dbConsole", "错误：" + e, "err"); });
    } else {
      var m = jsDbDelete(qid);
      appendLog("dbConsole", m, m.indexOf("已删除") >= 0 ? "ok" : "warn"); toast(m, "ok"); loadStats(); loadView(false);
    }
    el("delQid").value = "";
  });

  /* ============================================================
     纯 JS 实现（网页版 / APK 版，无 Python 桥接时使用）
     ============================================================ */
  var BASE = "http://wap.xiaoyuananquantong.com/guns-vip-main/wap";
  var COLLEGE_ID = "1224316234189443073";
  var EXAM_ID = "1948924196784492546";
  var TIKU_COURSES = [
    { articleId: "2080135073788600321", title: "题库学习", question: "2080136617019842561-1", quesType: "3" },
    { articleId: "2079132357549375490", title: "入学安全", question: "2079154657984266242-1", quesType: "3" },
    { articleId: "2079133938168643585", title: "国家安全", question: "2079156723934838786-B", quesType: "1" },
    { articleId: "2079139032318623745", title: "财物安全", question: "2079446660177477633-1", quesType: "3" },
    { articleId: "2079140991327027201", title: "心理健康", question: "2079467760328392705-D", quesType: "1" },
    { articleId: "2079142411614830593", title: "消防安全", question: "2079492272201678850-C", quesType: "1" },
    { articleId: "2079143452481699842", title: "人身安全", question: "2079527272678703105-1", quesType: "3" },
    { articleId: "2079144978977669121", title: "交通安全", question: "2079540470853156866-A", quesType: "1" },
    { articleId: "2079146093836255234", title: "禁毒防艾", question: "2079548501443756034-1", quesType: "3" },
    { articleId: "2079146628521934850", title: "应急救护", question: "~2079553855799967746-A~2079553855799967746-B~2079553855799967746-C~2079553855799967746-D", quesType: "2" },
    { articleId: "2079147344531570690", title: "防灾减灾", question: "2079558043292418049-D", quesType: "1" }
  ];

  var OV_KEY = "jsaq_db_overrides_v1";
  function loadOverrides() {
    try { return JSON.parse(localStorage.getItem(OV_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveOverrides(o) {
    try { localStorage.setItem(OV_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function mergedDb() {
    var o = loadOverrides();
    var base = window.ANSWER_DB || {};
    var merged = Object.assign({}, base, o.add || {});
    Object.keys(o.del || {}).forEach(function (k) { delete merged[k]; });
    return merged;
  }
  function jsStats() {
    var merged = mergedDb();
    var s = { 1: 0, 2: 0, 3: 0 };
    Object.keys(merged).forEach(function (k) { s[merged[k].t] = (s[merged[k].t] || 0) + 1; });
    return { single: s[1], multi: s[2], judge: s[3], total: s[1] + s[2] + s[3] };
  }
  function jsDbList(kw, page) {
    var merged = mergedDb();
    var arr = Object.keys(merged).map(function (k) {
      var a = merged[k].a;
      return { qid: k, ans: Array.isArray(a) ? a.join("") : a, qt: merged[k].t };
    });
    arr.sort(function (x, y) { return x.qid < y.qid ? -1 : 1; });
    if (kw) arr = arr.filter(function (x) { return x.qid.indexOf(kw) >= 0; });
    var per = 60;
    var p = page || 1;
    var slice = arr.slice((p - 1) * per, p * per);
    return { rows: slice, total: arr.length };
  }
  function jsDbAdd(qid, ans, qt) {
    var o = loadOverrides();
    o.add = o.add || {};
    o.del = o.del || {};
    delete o.del[qid];
    o.add[qid] = { a: ans.split(""), t: qt };
    saveOverrides(o);
    return "已新增：" + qid + " -> " + ans + " (类型" + qt + ")";
  }
  function jsDbDelete(qid) {
    var o = loadOverrides();
    var base = window.ANSWER_DB || {};
    if (!base[qid] && !(o.add && o.add[qid])) return "未找到该题目，已取消。";
    o.del = o.del || {};
    o.add = o.add || {};
    delete o.add[qid];
    o.del[qid] = 1;
    saveOverrides(o);
    return "已删除：" + qid;
  }

  var UA = "Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.71 Weixin NetType/5G Language/zh_CN";

  function jsGet(url, params) {
    var u = url;
    if (params) {
      var p = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
      u += (url.indexOf("?") >= 0 ? "&" : "?") + p;
    }
    return fetch(u, { headers: { "User-Agent": UA, "X-Requested-With": "XMLHttpRequest" } }).then(function (r) { return r.json(); });
  }
  function jsPost(url, data, referer) {
    var fd = Object.keys(data).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(data[k]); }).join("&");
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": UA, "X-Requested-With": "XMLHttpRequest",
        "Referer": referer || BASE + "/jiangsuwxJsback"
      },
      body: fd
    }).then(function (r) { return r.json(); });
  }
  function jsSearchSchools(kw) {
    return jsGet(BASE + "/select/proCollege", { provincesName: "江苏省" }).then(function (j) {
      return (j.data || []).filter(function (s) { return s.name.indexOf(kw) >= 0; })
        .map(function (s) { return { name: s.name, id: s.id }; });
    });
  }
  function jsLoginMethod(username, password, collegeId) {
    return jsPost(BASE + "/jsUserLogin",
      { openId: "", account: username, collegeId: collegeId, password: password },
      BASE + "/jiangsuwxJsback");
  }
  function jsUntying(userId) {
    return jsGet(BASE + "/JsUntying", { userId: userId });
  }
  function jsCreatExam(userId) { return jsPost(BASE + "/test/create", { examId: EXAM_ID, userId: userId }); }
  function jsGetExam(logId, userId) {
    return jsGet(BASE + "/test/list", { logId: logId, page: 1, limit: 200, ah: "", userId: userId });
  }
  function jsGetExamId(userId) {
    return jsPost(BASE + "/test/getTest", { examType: 2, examClass: 20, userId: userId, ah: "" });
  }
  function jsImitate(examId, logId, userId, answers) {
    var fd = "examId=" + encodeURIComponent(examId) + "&examType=2&sysSource=20&logId=" +
      encodeURIComponent(logId) + "&userId=" + encodeURIComponent(userId) + "&ah=";
    answers.forEach(function (pair) { fd += "&" + encodeURIComponent(pair[0]) + "=" + encodeURIComponent(pair[1]); });
    return fetch(BASE + "/imitateTest", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": UA, "X-Requested-With": "XMLHttpRequest",
        "Referer": BASE + "/newStudentssimulate?examId=" + examId + "&examType=2&userId=" + userId + "&ah" },
      body: fd
    }).then(function (r) { return r.json(); });
  }
  function jsLookup(qid) {
    var merged = mergedDb();
    var rec = merged[qid];
    if (!rec) return "";
    var qt = rec.t;
    var ans = rec.a;
    if (qt === "2") {
      var q = "~" + qid + "-" + ans.join("~" + qid + "-");
      return [["question", q], ["questionId", qid], ["quesType", qt]];
    }
    return [["question", qid + "-" + (Array.isArray(ans) ? ans[0] : ans)], ["questionId", qid], ["quesType", qt]];
  }

  function jsLog(msg, cls) { appendLog("console", msg, cls); }

  function blobToB64(blob, cb) {
    var reader = new FileReader();
    reader.onloadend = function () { cb(reader.result.split(",")[1]); };
    reader.readAsDataURL(blob);
  }

  function jsShowCertificate(userId) {
    var certUrl = BASE + "/qrCode?userId=" + userId;
    fetch(certUrl)
      .then(function (r) {
        var ct = r.headers.get("Content-Type") || "";
        if (ct.indexOf("image/") >= 0) {
          return r.blob().then(function (blob) {
            blobToB64(blob, function (b64) { window.__certificateReady(b64, "结业证书.png"); });
          });
        }
        return r.text().then(function (html) {
          var m = (html || "").match(/src=["']data:image\/(\w+);base64,([^"']{100,})["']/);
          if (m) { window.__certificateReady(m[2], "结业证书." + m[1]); return; }
          var imgs = (html || "").match(/<img[^>]+src=["']([^"']+)["']/g) || [];
          var found = false;
          if (!imgs.length) { window.__certificateReady(null, certUrl); return; }
          imgs.forEach(function (tag) {
            if (found) return;
            var u = tag.match(/src=["']([^"']+)["']/)[1];
            if (u.startsWith("data:")) return;
            if (!u.startsWith("http")) {
              u = u.startsWith("/") ? "http://wap.xiaoyuananquantong.com" + u : BASE + "/" + u;
            }
            fetch(u).then(function (ir) { return ir.blob(); }).then(function (blob) {
              if (!found && blob.size > 3000 && (blob.type || "").indexOf("image/") >= 0) {
                found = true;
                blobToB64(blob, function (b64) { window.__certificateReady(b64, "结业证书.png"); });
              }
            }).catch(function () {});
          });
        });
      })
      .catch(function () { window.__certificateReady(null, certUrl); });
  }

  function jsRunCore(userId) {
    var t0 = Date.now();
    jsLog("开始执行，userId=" + userId, "sys");
    return jsPost(BASE + "/compulsory/list", { userId: userId, collegeId: COLLEGE_ID })
      .then(function (j) { return j.data; })
      .then(function (course) {
        var unfinished = [];
        course.forEach(function (item, idx) {
          if (item.isFinsh) jsLog("第" + (idx + 1) + "课 " + item.name + " 已完成");
          else { unfinished.push(idx); jsLog("第" + (idx + 1) + "课 " + item.name + " 未完成"); }
        });
        if (!unfinished.length) jsLog("所有课程已完成，直接进入考试");
        var chain = Promise.resolve();
        unfinished.forEach(function (i) {
          chain = chain.then(function () {
            jsLog("正在完成 " + TIKU_COURSES[i].title);
            return jsPost(BASE + "/unitTest", {
              articleId: TIKU_COURSES[i].articleId, title: TIKU_COURSES[i].title,
              userId: userId, ah: "", question: TIKU_COURSES[i].question, quesType: TIKU_COURSES[i].quesType
            });
          });
        });
        return chain;
      })
      .then(function () {
        jsLog("正在进入考试流程...");
        return jsCreatExam(userId);
      })
      .then(function (j) { var logId = j.data.logId; jsLog("取得 logId " + logId); return logId; })
      .then(function (logId) {
        return jsGetExam(logId, userId).then(function (examList) {
          var questions = examList.data.data;
          jsLog("获取到 " + questions.length + " 道考题");
          return jsGetExamId(userId).then(function (data) {
            if (data.code === 500) {
              jsLog("出错了！账号未完成内容学习（学校非江苏/题库出错/平台更新）。", "err");
              jsLog("getTest响应：" + JSON.stringify(data), "err");
              return;
            }
            var examId = data.data.id;
            jsLog("取得 examId " + examId);
            var answers = [];
            var qcount = questions.length;
            var found = 0, missing = 0;
            for (var i = 0; i < qcount; i++) {
              var qid = questions[i].questionId;
              var a = jsLookup(qid);
              if (!a) { missing++; jsLog("警告：题目 " + qid + " 未找到答案，留空", "warn"); continue; }
              answers = answers.concat(a);
              found++;
            }
            jsLog("答案生成完毕：共 " + qcount + " 题，找到 " + found + " 题，缺失 " + missing + " 题");
            if (missing > 0) jsLog("警告：有 " + missing + " 道题未找到答案，可能影响得分", "warn");
            jsLog("正在提交...");
            return jsImitate(examId, logId, userId, answers).then(function (res) {
              var score = res.data.count;
              jsLog("得分：" + score, score == 100 ? "ok" : "warn");
              if (score != 100) jsLog("没到100分，可重刷一次（个别答案可能未录入准确）。", "warn");
              else { jsLog("考试满分！正在获取结业证书...", "ok"); jsShowCertificate(userId); }
            });
          });
        });
      })
      .then(function () { jsRunLogin_untying(userId); })
      .catch(function (e) { jsLog("发生异常：" + e, "err"); })
      .then(function () {
        jsLog("==== 执行结束 ====", "sys");
        window.__runEnd();
      });
  }
  function jsRunLogin_untying(userId) {
    jsUntying(userId).then(function () { jsLog("已解绑 openId", "sys"); }).catch(function () {});
  }
  function jsRunLogin(sid, u, p) {
    jsLoginMethod(u, p, sid).then(function (r) {
      if (!r.success) { jsLog("登录失败，请检查账号密码和学校", "err"); window.__runEnd(); return; }
      jsLog("获取到 userId " + r.data.userId + "，开始执行", "ok");
      jsRunCore(r.data.userId);
    }).catch(function (e) { jsLog("登录请求失败：" + e, "err"); window.__runEnd(); });
  }
  function jsRunUserid(uid) {
    if (!/^\d+$/.test(uid)) { jsLog("userId 通常是一长串纯数字，请检查输入。", "err"); window.__runEnd(); return; }
    jsRunCore(uid);
  }

  /* 初始化 */
  loadStats();
  appendLog("console", "已就绪。选择方式后点击「开始执行」。", "sys");

  /* 桌面版：pywebview 就绪后用 Python 重新统计 */
  window.addEventListener("pywebviewready", function () { loadStats(); });
})();
