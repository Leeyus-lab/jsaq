/* ============================================================
   安全教育一键完成工具 v2.1 — 主逻辑
   登录完成（userId / 账号密码）+ 注册完成
   ============================================================ */
(function () {
  "use strict";

  var running = false;
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  function toast(msg, type) {
    var wrap = el("toasts");
    var t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2900);
  }
  window.__uiToast = toast;

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
    var dot = el("statusDot"), t = el("statusText");
    if (dot) dot.className = "dot" + (kind ? " " + kind : "");
    if (t) t.textContent = text;
  }
  window.__status = setStatus;

  /* ---------- 导航 ---------- */
  function showPage(name) { if (window.BBHJ) BBHJ.showPage(name); }
  document.querySelectorAll(".topnav .navtab, .bottomnav .navtab").forEach(function (b) {
    b.addEventListener("click", function () { showPage(b.dataset.page); });
  });

  /* ---------- userId 帮助弹窗 ---------- */
  el("uidHelpBtn").addEventListener("click", function (e) {
    e.preventDefault(); el("helpModal").classList.add("show");
  });
  el("helpClose").addEventListener("click", function () { el("helpModal").classList.remove("show"); });

  /* ---------- 免责声明 ---------- */
  var termsTarget = null;
  function showTerms(target) {
    termsTarget = target;
    el("termsModal").classList.add("show");
  }
  el("termsAgreeBtn").addEventListener("click", function () {
    el("termsModal").classList.remove("show");
    if (termsTarget) { el(termsTarget).checked = true; termsTarget = null; }
  });
  el("runShowTerms").addEventListener("click", function (e) { e.preventDefault(); showTerms("runAgree"); });
  el("regShowTerms").addEventListener("click", function (e) { e.preventDefault(); showTerms("regAgree"); });

  /* ---------- 从链接自动提取 userId ---------- */
  function extractUserId(text) {
    if (!text) return "";
    var m = String(text).match(/[?&]userid=(\d+)/i);
    return m ? m[1] : (/^\d{6,}$/.test(String(text).trim()) ? text.trim() : "");
  }
  el("uidInput").addEventListener("input", function () {
    var uid = extractUserId(this.value);
    if (uid && uid !== this.value) {
      this.value = uid;
      toast("已自动提取 userId", "ok");
    }
  });
  el("uidInput").addEventListener("paste", function () {
    var self = this;
    setTimeout(function () {
      var uid = extractUserId(self.value);
      if (uid) { self.value = uid; toast("已自动提取 userId", "ok"); }
    }, 0);
  });

  /* ---------- 开始执行（v2.1：账号密码 / 链接userId 双模式） ---------- */
  function setRunning(v) {
    running = v;
    var b = el("startBtn");
    if (b) b.disabled = v;
    if (v) setStatus("执行中...", "run");
    else setStatus("就绪", "");
  }
  window.__runEnd = function () { setRunning(false); };

  /* 模式切换（记住上次选择） */
  var loginMode = localStorage.getItem("v21_login_mode") === "uid" ? "uid" : "acct";
  function applyLoginMode() {
    el("tabAcct").classList.toggle("active", loginMode === "acct");
    el("tabUid").classList.toggle("active", loginMode === "uid");
    el("loginAcctBox").style.display = loginMode === "acct" ? "" : "none";
    el("loginUidBox").style.display = loginMode === "uid" ? "" : "none";
  }
  el("tabAcct").addEventListener("click", function () { loginMode = "acct"; localStorage.setItem("v21_login_mode", "acct"); applyLoginMode(); });
  el("tabUid").addEventListener("click", function () { loginMode = "uid"; localStorage.setItem("v21_login_mode", "uid"); applyLoginMode(); });
  applyLoginMode();

  /* 账号密码模式：学校搜索 */
  var loginSchoolId = null;
  el("loginSearchBtn").addEventListener("click", function () {
    var kw = el("loginSchoolKw").value.trim();
    if (!kw) { toast("请输入学校关键词", "err"); return; }
    el("loginSchoolList").innerHTML = '<div class="school-item">搜索中...</div>';
    var a = pyApi();
    if (a && a.reg_search_schools) {
      a.reg_search_schools(kw).then(function (list) { renderLoginSchools(list || []); })
        .catch(function (e) { toast("搜索失败：" + e, "err"); el("loginSchoolList").innerHTML = ""; });
    } else {
      jsSearchSchools(kw).then(renderLoginSchools).catch(function (e) { toast("搜索失败：" + e, "err"); el("loginSchoolList").innerHTML = ""; });
    }
  });
  function renderLoginSchools(list) {
    var box = el("loginSchoolList");
    box.innerHTML = "";
    if (!list || !list.length) { box.innerHTML = '<div class="school-item">未找到匹配学校</div>'; return; }
    list.forEach(function (s) {
      var d = document.createElement("div");
      d.className = "school-item";
      d.textContent = s.name;
      d.addEventListener("click", function () {
        box.querySelectorAll(".school-item").forEach(function (x) { x.classList.remove("sel"); });
        d.classList.add("sel");
        loginSchoolId = s.id;
        var n = el("loginSchoolName");
        n.textContent = s.name; n.classList.remove("empty");
        toast("已选择：" + s.name, "ok");
      });
      box.appendChild(d);
    });
  }
  el("loginSchoolField").addEventListener("click", function () {
    if (!loginSchoolId) { el("loginSearchBtn").click(); return; }
    toast("已选择：" + el("loginSchoolName").textContent + "（重新搜索可更换）", "ok");
  });

  el("startBtn").addEventListener("click", function () {
    if (running) return;
    if (!el("runAgree").checked) { toast("请先阅读并勾选免责声明", "err"); return; }
    var a = pyApi();
    if (loginMode === "acct") {
      if (!loginSchoolId) { toast("请先搜索并选择学校", "err"); return; }
      var u = el("loginUser").value.trim(), p = el("loginPass").value;
      if (!u) { toast("请输入账号", "err"); return; }
      if (!p) { toast("请输入密码", "err"); return; }
      setRunning(true);
      appendLog("console", "正在登录...", "sys");
      if (a && a.run_login) a.run_login(loginSchoolId, u, p);
      else jsRunLogin(loginSchoolId, u, p);
    } else {
      var uid = extractUserId(el("uidInput").value);
      if (!uid) { toast("请粘贴平台链接或输入 userId", "err"); return; }
      setRunning(true);
      if (a) a.run_userid(uid);
      else jsRunUserid(uid);
    }
  });

  el("clearLogBtn").addEventListener("click", function () { el("console").innerHTML = ""; });
  el("clearRegLogBtn").addEventListener("click", function () { el("regConsole").innerHTML = ""; });

  /* ---------- 结业证书 ---------- */
  window.__certificateReady = function (b64data, filepath) {
    var modal = el("certModal"), img = el("certImg"), dl = el("certDownload"), pathEl = el("certPath");
    if (b64data) {
      img.src = "data:image/png;base64," + b64data;
      img.style.display = "";
      var fname = filepath || "结业证书.png";
      if (fname.indexOf("/") >= 0) fname = fname.split("/").pop();
      if (window.Android && window.Android.saveImage) {
        dl.href = "#"; dl.download = "";
        dl.onclick = function (e) {
          e.preventDefault();
          dl.textContent = "保存中...";
          var stamp = new Date();
          function p2(n) { return n < 10 ? "0" + n : "" + n; }
          var uniq = fname.replace(/\.png$/i, "") + "_" + stamp.getFullYear() + p2(stamp.getMonth() + 1) + p2(stamp.getDate()) + "_" + p2(stamp.getHours()) + p2(stamp.getMinutes()) + p2(stamp.getSeconds()) + ".png";
          var result = window.Android.saveImage(b64data, uniq);
          if (result && result.indexOf("ok:") === 0) {
            dl.textContent = "已保存";
            pathEl.textContent = "已保存到相册 Pictures/JSAQ/" + result.substring(3);
            pathEl.style.display = "";
            if (window.Android.toast) window.Android.toast("证书已保存到相册");
          } else {
            dl.textContent = "保存失败，重试";
            pathEl.textContent = "保存失败：" + result;
            pathEl.style.display = "";
          }
          return false;
        };
      } else {
        var a = pyApi();
        if (a && a.save_certificate) {
          dl.href = "#";
          dl.onclick = function (e) {
            e.preventDefault();
            dl.textContent = "保存中...";
            a.save_certificate(b64data, fname).then(function (r) {
              if (r && r.success) {
                dl.textContent = "已保存";
                pathEl.textContent = "已保存到：" + r.path;
                pathEl.style.display = "";
              } else {
                dl.textContent = "保存失败，重试";
                pathEl.textContent = "保存失败：" + (r && r.error);
                pathEl.style.display = "";
              }
            }).catch(function (err) {
              dl.textContent = "保存失败，重试";
              pathEl.textContent = "保存失败：" + err;
              pathEl.style.display = "";
            });
            return false;
          };
        } else {
          dl.href = "data:image/png;base64," + b64data;
          dl.download = fname;
          dl.onclick = null;
        }
      }
      dl.style.display = "";
      pathEl.textContent = "";
      pathEl.style.display = "none";
    } else {
      img.src = ""; img.style.display = "none";
      dl.style.display = "none";
      pathEl.innerHTML = "证书图片自动下载失败，请<a href=\"" + filepath + "\" target=\"_blank\" style=\"color:#60a5fa\">点此手动查看</a>";
      pathEl.style.display = "";
    }
    modal.classList.add("show");
  };
  el("certClose").addEventListener("click", function () { el("certModal").classList.remove("show"); });

  /* ============================================================
     纯 JS 实现（APK / 无 Python 桥接时使用）
     基于 jiangsu-safety-platform-skip（Apache License 2.0）
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

  function mergedDb() { return window.ANSWER_DB || {}; }
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
  function jsUntying(userId) { return jsGet(BASE + "/JsUntying", { userId: userId }); }
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
    var rec = mergedDb()[qid];
    if (!rec) return "";
    var qt = rec.t, ans = rec.a;
    if (qt === "2") {
      var q = "~" + qid + "-" + ans.join("~" + qid + "-");
      return [["question", q], ["questionId", qid], ["quesType", qt]];
    }
    return [["question", qid + "-" + (Array.isArray(ans) ? ans[0] : ans)], ["questionId", qid], ["quesType", qt]];
  }
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

  /* 用量统计（与 exe 端/原版相同服务器与格式）：仅上传得分与运行时长，失败静默 */
  function uploadStats(score, runtimeMs) {
    try {
      fetch("http://101.133.233.225:81/result_update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: score, runtime_ms: runtimeMs })
      }).catch(function () {});
    } catch (e) {}
  }

  function jsRunCore(userId, logFn, done) {
    var t0 = Date.now();
    logFn("开始执行，userId=" + userId, "sys");
    return jsPost(BASE + "/compulsory/list", { userId: userId, collegeId: COLLEGE_ID })
      .then(function (j) { return j.data; })
      .then(function (course) {
        var unfinished = [];
        course.forEach(function (item, idx) {
          if (item.isFinsh) logFn("第" + (idx + 1) + "课 " + item.name + " 已完成");
          else { unfinished.push(idx); logFn("第" + (idx + 1) + "课 " + item.name + " 未完成"); }
        });
        if (!unfinished.length) logFn("所有课程已完成，直接进入考试");
        var chain = Promise.resolve();
        unfinished.forEach(function (i) {
          chain = chain.then(function () {
            logFn("正在完成 " + TIKU_COURSES[i].title);
            return jsPost(BASE + "/unitTest", {
              articleId: TIKU_COURSES[i].articleId, title: TIKU_COURSES[i].title,
              userId: userId, ah: "", question: TIKU_COURSES[i].question, quesType: TIKU_COURSES[i].quesType
            });
          });
        });
        return chain;
      })
      .then(function () { logFn("正在进入考试流程..."); return jsCreatExam(userId); })
      .then(function (j) { var logId = j.data.logId; logFn("取得 logId " + logId); return logId; })
      .then(function (logId) {
        return jsGetExam(logId, userId).then(function (examList) {
          var questions = examList.data.data;
          logFn("获取到 " + questions.length + " 道考题");
          return jsGetExamId(userId).then(function (data) {
            if (data.code === 500) {
              logFn("出错了！账号未完成内容学习（学校非江苏/题库出错/平台更新）。", "err");
              return;
            }
            var examId = data.data.id;
            logFn("取得 examId " + examId);
            var answers = [];
            var found = 0, missing = 0;
            for (var i = 0; i < questions.length; i++) {
              var qid = questions[i].questionId;
              var a = jsLookup(qid);
              if (!a) { missing++; logFn("警告：题目 " + qid + " 未找到答案，留空", "warn"); continue; }
              answers = answers.concat(a);
              found++;
            }
            logFn("答案生成完毕：共 " + questions.length + " 题，找到 " + found + " 题，缺失 " + missing + " 题");
            logFn("正在提交...");
            return jsImitate(examId, logId, userId, answers).then(function (res) {
              var score = res.data.count;
              logFn("得分：" + score, score == 100 ? "ok" : "warn");
              uploadStats(score, Date.now() - t0);
              if (score != 100) logFn("没到100分，可重刷一次（个别答案可能未录入准确）。", "warn");
              else { logFn("考试满分！正在获取结业证书...", "ok"); jsShowCertificate(userId); }
            });
          });
        });
      })
      .then(function () { jsUntying(userId).then(function () { logFn("已解绑 openId", "sys"); }).catch(function () {}); })
      .catch(function (e) { logFn("发生异常：" + e, "err"); })
      .then(function () { logFn("==== 执行结束 ====", "sys"); done(); });
  }

  function jsRunLogin(sid, u, p) {
    jsLoginMethod(u, p, sid).then(function (r) {
      if (!r.success) { appendLog("console", "登录失败，请检查账号密码和学校", "err"); window.__runEnd(); return; }
      appendLog("console", "获取到 userId " + r.data.userId + "，开始执行", "ok");
      jsRunCore(r.data.userId, function (m, c) { appendLog("console", m, c); }, window.__runEnd);
    }).catch(function (e) { appendLog("console", "登录请求失败：" + e, "err"); window.__runEnd(); });
  }
  function jsRunUserid(uid) {
    if (!/^\d+$/.test(uid)) { appendLog("console", "userId 通常是一长串纯数字，请检查输入。", "err"); window.__runEnd(); return; }
    jsRunCore(uid, function (m, c) { appendLog("console", m, c); }, window.__runEnd);
  }

  /* ---------- 注册 ---------- */
  function jsRegGetFaculties(collegeId) {
    return jsGet(BASE + "/getFaculty", { collegeId: collegeId }).then(function (j) { return j.data || []; });
  }
  function jsRegGetClasses(facultyId) {
    return jsGet(BASE + "/getClass", { facultyId: facultyId }).then(function (j) { return j.data || []; });
  }
  function jsRegRegister(collegeId, account, name, facultyId, classId) {
    var data = { collegeId: collegeId, account: account, name: name, password: account };
    if (facultyId) data.facultyId = facultyId;
    if (classId) data.classId = classId;
    return jsPost(BASE + "/registerUser", data, BASE + "/wapJSLogin").then(function (j) {
      if (j.code === 200 && j.success) return { success: true, userId: (j.data || {}).userId || "" };
      return { success: false, msg: j.message || "注册失败" };
    });
  }

  var regSchoolId = null, regFacultyId = null, regClassId = null, regRunning = false;
  var regFaculties = [], regClasses = [];
  function regLog(m, c) { appendLog("regConsole", m, c); }
  function regSetRunning(v) {
    regRunning = v;
    el("regRunBtn").disabled = v;
    setStatus(v ? "执行中..." : "就绪", v ? "run" : "");
  }

  /* 未勾选免责声明时按钮不可用 */
  var regAgreeChk = el("regAgree");
  function syncRegBtn() { el("regRunBtn").disabled = !regAgreeChk.checked || regRunning; }
  regAgreeChk.addEventListener("change", syncRegBtn);
  syncRegBtn();

  /* ---------- 通用选择器弹窗（v2.1：替代安卓原生下拉框） ---------- */
  function openPicker(title, items, onSelect) {
    el("pickerTitle").textContent = title;
    var box = el("pickerList");
    box.innerHTML = "";
    if (!items || !items.length) {
      box.innerHTML = '<div class="bbhj-empty">暂无可选项</div>';
    } else {
      items.forEach(function (it) {
        var d = document.createElement("div");
        d.className = "picker-item" + (it.sel ? " sel" : "");
        d.textContent = it.name;
        d.addEventListener("click", function () {
          el("pickerModal").classList.remove("show");
          onSelect(it);
        });
        box.appendChild(d);
      });
    }
    el("pickerModal").classList.add("show");
  }
  el("pickerClose").addEventListener("click", function () { el("pickerModal").classList.remove("show"); });

  function setPicked(id, text) {
    var n = el(id);
    n.textContent = text;
    n.classList.remove("empty");
  }
  function resetFacultyClass() {
    regFacultyId = null; regClassId = null;
    regFaculties = []; regClasses = [];
    var f = el("regFacultyName"), c = el("regClassName");
    f.textContent = "请先选择学校"; f.classList.add("empty");
    c.textContent = "请先选择学院"; c.classList.add("empty");
  }

  /* 学校搜索 */
  el("regSearchBtn").addEventListener("click", function () {
    var kw = el("regSchoolKw").value.trim();
    if (!kw) { toast("请输入学校关键词", "err"); return; }
    el("regSchoolList").innerHTML = '<div class="school-item">搜索中...</div>';
    var a = pyApi();
    if (a && a.reg_search_schools) {
      a.reg_search_schools(kw).then(function (list) { renderRegSchools(list || []); })
        .catch(function (e) { toast("搜索失败：" + e, "err"); el("regSchoolList").innerHTML = ""; });
    } else {
      jsSearchSchools(kw).then(renderRegSchools).catch(function (e) { toast("搜索失败：" + e, "err"); el("regSchoolList").innerHTML = ""; });
    }
  });
  function renderRegSchools(list) {
    var box = el("regSchoolList");
    box.innerHTML = "";
    if (!list || !list.length) { box.innerHTML = '<div class="school-item">未找到匹配学校</div>'; return; }
    list.forEach(function (s) {
      var d = document.createElement("div");
      d.className = "school-item";
      d.textContent = s.name;
      d.addEventListener("click", function () {
        box.querySelectorAll(".school-item").forEach(function (x) { x.classList.remove("sel"); });
        d.classList.add("sel");
        regSchoolId = s.id;
        setPicked("regSchoolName", s.name);
        toast("已选择：" + s.name, "ok");
        resetFacultyClass();
        loadFaculties(s.id);
      });
      box.appendChild(d);
    });
  }

  /* 学院 / 专业（自定义选择器） */
  function loadFaculties(collegeId) {
    var fname = el("regFacultyName");
    fname.textContent = "加载中..."; fname.classList.remove("empty");
    var a = pyApi();
    var p = (a && a.reg_get_faculties) ? a.reg_get_faculties(collegeId) : jsRegGetFaculties(collegeId);
    p.then(function (list) {
      regFaculties = list || [];
      if (!regFaculties.length) {
        fname.textContent = "该学校无学院数据"; fname.classList.add("empty");
      } else {
        fname.textContent = "请选择学院"; fname.classList.add("empty");
      }
    }).catch(function () {
      regFaculties = [];
      fname.textContent = "学院加载失败，点击重试"; fname.classList.remove("empty");
    });
  }
  el("regFacultyField").addEventListener("click", function () {
    if (!regSchoolId) { toast("请先搜索并选择学校", "err"); return; }
    if (!regFaculties.length && el("regFacultyName").textContent.indexOf("重试") >= 0) { loadFaculties(regSchoolId); return; }
    if (!regFaculties.length) { toast("该学校无学院数据", "err"); return; }
    openPicker("选择学院", regFaculties.map(function (f) {
      return { id: f.id, name: f.name, sel: f.id === regFacultyId };
    }), function (f) {
      regFacultyId = f.id;
      setPicked("regFacultyName", f.name);
      regClassId = null; regClasses = [];
      var c = el("regClassName");
      c.textContent = "加载中..."; c.classList.remove("empty");
      var a = pyApi();
      var p = (a && a.reg_get_classes) ? a.reg_get_classes(f.id) : jsRegGetClasses(f.id);
      p.then(function (list) {
        regClasses = list || [];
        if (!regClasses.length) { c.textContent = "该学院无专业数据"; c.classList.add("empty"); }
        else { c.textContent = "请选择专业"; c.classList.add("empty"); }
      }).catch(function () {
        regClasses = [];
        c.textContent = "专业加载失败，点击重试"; c.classList.remove("empty");
      });
    });
  });
  el("regClassField").addEventListener("click", function () {
    if (!regFacultyId) { toast("请先选择学院", "err"); return; }
    if (!regClasses.length && el("regClassName").textContent.indexOf("重试") >= 0) {
      var p2 = (pyApi() && pyApi().reg_get_classes) ? pyApi().reg_get_classes(regFacultyId) : jsRegGetClasses(regFacultyId);
      p2.then(function (list) {
        regClasses = list || [];
        if (regClasses.length) openPicker("选择专业", regClasses.map(function (c2) { return { id: c2.id, name: c2.name, sel: c2.id === regClassId }; }), pickClass);
        else toast("该学院无专业数据", "err");
      });
      return;
    }
    if (!regClasses.length) { toast("该学院无专业数据", "err"); return; }
    openPicker("选择专业", regClasses.map(function (c2) {
      return { id: c2.id, name: c2.name, sel: c2.id === regClassId };
    }), pickClass);
  });
  function pickClass(c) {
    regClassId = c.id;
    setPicked("regClassName", c.name);
  }
  el("regSchoolField").addEventListener("click", function () {
    if (!regSchoolId) { el("regSearchBtn").click(); return; }
    toast("已选择：" + el("regSchoolName").textContent + "（重新搜索可更换）", "ok");
  });

  el("regRunBtn").addEventListener("click", function () {
    if (regRunning) return;
    if (!regSchoolId) { toast("请先搜索并选择学校", "err"); return; }
    if (!regFacultyId) { toast("请选择学院", "err"); return; }
    if (!regClassId) { toast("请选择专业", "err"); return; }
    var name = el("regName").value.trim();
    if (!name) { toast("请输入姓名", "err"); return; }
    if (!regAgreeChk.checked) { toast("请先阅读并勾选免责声明", "err"); return; }
    var account = el("regAccount").value.trim() || name; /* 账号默认同姓名，密码同账号 */
    regSetRunning(true);
    regLog("正在注册...", "sys");
    var a = pyApi();
    if (a && a.reg_register_and_run) {
      a.reg_register_and_run(regSchoolId, account, name, regFacultyId, regClassId);
    } else {
      jsRegRegister(regSchoolId, account, name, regFacultyId, regClassId).then(function (res) {
        if (res.success) {
          regLog("注册成功！userId=" + res.userId, "ok");
          toast("注册成功！正在自动完成...", "ok");
          regLog("正在自动完成课程和考试...", "sys");
          jsRunCore(res.userId, regLog, function () { regSetRunning(false); regLog("==== 执行结束 ====", "sys"); });
        } else {
          regLog("注册失败：" + res.msg, "err");
          toast("注册失败：" + res.msg, "err");
          regSetRunning(false);
        }
      }).catch(function (e) { regLog("异常：" + e, "err"); regSetRunning(false); });
    }
  });

  /* ---------- 外部链接统一拦截（v2.1：弹窗确认 → 系统浏览器打开，应用内不跳走） ---------- */
  var pendingUrl = null;
  function openExternal(url) {
    if (window.Android && window.Android.openUrl) { try { window.Android.openUrl(url); return; } catch (e) {} }
    var a = pyApi();
    if (a && a.open_url) { try { a.open_url(url); return; } catch (e2) {} }
    window.open(url, "_blank");
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest("a") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (!/^https?:\/\//i.test(href)) return;
    e.preventDefault();
    e.stopPropagation();
    pendingUrl = href;
    el("linkUrl").textContent = href;
    el("linkModal").classList.add("show");
  }, true);
  el("linkCancel").addEventListener("click", function () { el("linkModal").classList.remove("show"); });
  el("linkOpen").addEventListener("click", function () {
    el("linkModal").classList.remove("show");
    if (pendingUrl) openExternal(pendingUrl);
  });

  /* ---------- 弹窗遮罩点击关闭（v2.1：解决"没有返回/关闭"的困扰） ---------- */
  document.querySelectorAll(".modal-overlay").forEach(function (o) {
    o.addEventListener("click", function (e) {
      if (e.target !== o) return;
      if (o.id === "confirmModal" || o.id === "notifAskModal") return; /* 二次确认/权限弹窗必须显式选择 */
      o.classList.remove("show");
    });
  });

  /* Python 桥接版注册完成回调 */
  var _origRunEnd = window.__runEnd;
  window.__runEnd = function () {
    if (typeof _origRunEnd === "function") _origRunEnd();
    if (regRunning) { regSetRunning(false); regLog("==== 执行结束 ====", "sys"); }
  };

  /* ---------- 初始化 ---------- */
  if (window.__settingsInit) window.__settingsInit();
  if (window.BBHJ) BBHJ.init();
  appendLog("console", "已就绪。粘贴平台链接或输入 userId 即可一键完成。", "sys");
  appendLog("regConsole", "注册功能已就绪。请搜索学校并填写信息。", "sys");
})();
