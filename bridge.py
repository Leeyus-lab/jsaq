#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import json
import threading
import sqlite3

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import webview
import app


def _win():
    return webview.windows[0] if webview.windows else None

class Api:
    def _log(self, msg, cls=""):
        w = _win()
        if not w:
            return
        try:
            w.evaluate_js("window.__log('console', {}, '{}')".format(json.dumps(msg), cls))
        except Exception:
            pass

    def _status(self, text, kind=""):
        w = _win()
        if not w:
            return
        try:
            w.evaluate_js("window.__status({}, '{}')".format(json.dumps(text), kind))
        except Exception:
            pass

    def _certificate(self, b64data, filepath):
        w = _win()
        if not w:
            return
        try:
            w.evaluate_js("window.__certificateReady({}, {})".format(
                json.dumps(b64data), json.dumps(filepath)))
        except Exception:
            pass

    def search_schools(self, kw):
        try:
            raw = app.get_all_schools("江苏省")
            data = json.loads(raw)["data"]
            return [{"name": s["name"], "id": s["id"]} for s in data if kw in s["name"]]
        except Exception as e:
            return [{"name": "搜索失败：" + str(e), "id": None}]

    def run_login(self, sid, u, p):
        if not sid:
            self._log("请先搜索并选择学校", "err")
            return
        threading.Thread(target=self._login_worker, args=(sid, u, p), daemon=True).start()

    def _login_worker(self, sid, u, p):
        try:
            app.login_and_run(sid, u, p, self._log, self._certificate)
        except Exception as e:
            self._log("发生异常：" + str(e), "err")
        try:
            _win().evaluate_js("window.__runEnd()")
        except Exception:
            pass

    def run_userid(self, uid):
        threading.Thread(target=self._uid_worker, args=(uid,), daemon=True).start()

    def _uid_worker(self, uid):
        try:
            app.run_userid(uid, self._log, self._certificate)
        except Exception as e:
            self._log("发生异常：" + str(e), "err")
        try:
            _win().evaluate_js("window.__runEnd()")
        except Exception:
            pass

    def db_stats(self):
        try:
            conn = sqlite3.connect(app.get_db_path())
            cur = conn.cursor()
            cur.execute("SELECT quesType, COUNT(*) FROM tiku GROUP BY quesType")
            d = {"1": 0, "2": 0, "3": 0}
            for qt, c in cur.fetchall():
                d[qt] = c
            cur.execute("SELECT COUNT(*) FROM tiku")
            total = cur.fetchone()[0]
            conn.close()
            return {"single": d.get("1", 0), "multi": d.get("2", 0), "judge": d.get("3", 0), "total": total}
        except Exception as e:
            return {"single": 0, "multi": 0, "judge": 0, "total": 0}

    def db_add(self, qid, ans, qt):
        msgs = []
        try:
            app.db_add(qid, ans, qt, lambda m: msgs.append(m))
        except Exception as e:
            return "错误：" + str(e)
        return msgs[-1] if msgs else "操作完成"

    def db_delete(self, qid):
        msgs = []
        try:
            app.db_delete(qid, lambda m: msgs.append(m))
        except Exception as e:
            return "错误：" + str(e)
        return msgs[-1] if msgs else "操作完成"

    def db_list(self, kw, page):
        per = 60
        p = max(1, int(page or 1))
        off = (p - 1) * per
        try:
            conn = sqlite3.connect(app.get_db_path())
            cur = conn.cursor()
            if kw:
                cur.execute("SELECT questionId, answer, quesType FROM tiku WHERE questionId LIKE ? ORDER BY questionId LIMIT ? OFFSET ?",
                            ("%" + kw + "%", per, off))
                rows = cur.fetchall()
                cur.execute("SELECT COUNT(*) FROM tiku WHERE questionId LIKE ?", ("%" + kw + "%",))
                total = cur.fetchone()[0]
            else:
                cur.execute("SELECT questionId, answer, quesType FROM tiku ORDER BY questionId LIMIT ? OFFSET ?", (per, off))
                rows = cur.fetchall()
                cur.execute("SELECT COUNT(*) FROM tiku")
                total = cur.fetchone()[0]
            conn.close()
            return {"rows": [{"qid": r[0], "ans": r[1], "qt": r[2]} for r in rows], "total": total}
        except Exception as e:
            return {"rows": [], "total": 0, "error": str(e)}

    # ---------- 网络代理（v2.1：宝贝回家公益模块，绕过 file:// CORS） ----------
    # v2.1.1：改为异步回调。此前同步网络请求会阻塞 pywebview UI 线程，
    # 导致电脑端"刷新"卡死数秒、界面冻结。现在立即返回，结果经
    # window.__proxyDone / window.__proxyImgDone 回调送达 JS。

    def proxy_get(self, url, cb):
        """异步代替浏览器 fetch 请求外部 API，结果回调 window.__proxyDone(cb, text)"""
        threading.Thread(target=self._proxy_get_worker, args=(url, cb), daemon=True).start()
        return ""

    def _proxy_get_worker(self, url, cb):
        try:
            import requests as _rq
            r = _rq.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            txt = r.text
        except Exception as e:
            txt = json.dumps({"error": str(e)})
        w = _win()
        if w:
            try:
                w.evaluate_js("window.__proxyDone && window.__proxyDone({}, {})".format(
                    json.dumps(cb), json.dumps(txt)))
            except Exception:
                pass

    def proxy_get_image(self, url, cb):
        """异步下载图片，base64 结果回调 window.__proxyImgDone(cb, b64)"""
        threading.Thread(target=self._proxy_img_worker, args=(url, cb), daemon=True).start()
        return ""

    def _proxy_img_worker(self, url, cb):
        b64 = ""
        try:
            import requests as _rq
            import base64 as _b64
            r = _rq.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code == 200 and r.content:
                b64 = _b64.b64encode(r.content).decode("ascii")
        except Exception:
            b64 = ""
        w = _win()
        if w:
            try:
                w.evaluate_js("window.__proxyImgDone && window.__proxyImgDone({}, {})".format(
                    json.dumps(cb), json.dumps(b64)))
            except Exception:
                pass

    # ---------- 外部链接 / 系统通知 ----------

    def open_url(self, url):
        """用系统默认浏览器打开外部链接（应用内不导航离开，避免返回错乱）"""
        try:
            import webbrowser as _wb
            _wb.open(url)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def notify(self, title, msg):
        """Windows 原生 toast 通知（winotify，Win10/11 自带通知中心）"""
        try:
            from winotify import Notification as _Toast
            n = _Toast(app_id="安全教育工具演示软件", title=str(title or "寻亲信息"), msg=str(msg or ""))
            n.show()
            return True
        except Exception:
            return False

    def save_image(self, b64data, filename):
        """通用图片保存（海报等），带保存对话框"""
        return self.save_certificate(b64data, filename)

    def save_certificate(self, b64data, filename):
        """弹出保存对话框，把证书图片保存到本地"""
        try:
            w = _win()
            if not w:
                return {"success": False, "error": "窗口未就绪"}
            if not filename or "." not in filename:
                filename = (filename or "结业证书") + ".png"
            ext = filename.rsplit(".", 1)[1].lower()
            mime = {"png": "PNG 文件 (*.png)", "jpg": "JPEG 文件 (*.jpg)", "jpeg": "JPEG 文件 (*.jpg)"}.get(ext, "图片文件 (*.%s)" % ext)
            types = (mime,)
            target = w.create_file_dialog(webview.SAVE_DIALOG, save_filename=filename, file_types=types)
            if not target:
                return {"success": False, "error": "已取消"}
            if isinstance(target, (list, tuple)):
                target = target[0]
            import base64 as _b64
            with open(target, "wb") as f:
                f.write(_b64.b64decode(b64data))
            return {"success": True, "path": target}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ---------- 状态持久化（v2.1：WebView2 下 localStorage 不稳定，改为文件级兜底） ----------
    # 前端把 bbhj_* / v21_* 键值经 save_state 全量写入 %APPDATA%/jsaq_v21/state.json；
    # 启动时由 _restore_state_worker 注入回页面，关闭软件后公益记录/设置不再丢失。

    @staticmethod
    def _state_path():
        base = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "jsaq_v21")
        os.makedirs(base, exist_ok=True)
        return os.path.join(base, "state.json")

    def save_state(self, json_str):
        """接收前端序列化的 localStorage 键值快照，写盘持久化"""
        try:
            with open(self._state_path(), "w", encoding="utf-8") as f:
                f.write(json_str or "{}")
            return True
        except Exception:
            return False

    def load_state(self):
        """返回持久化快照（JSON 字符串），无文件时返回空串"""
        try:
            with open(self._state_path(), "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            return ""

    def _restore_state_worker(self):
        """轮询等待页面定义 __restoreState 后立即注入持久化状态（最多 12 秒）"""
        import time as _t
        try:
            with open(self._state_path(), "r", encoding="utf-8") as f:
                s = f.read()
        except Exception:
            return
        if not s:
            return
        for _ in range(48):
            _t.sleep(0.25)
            w = _win()
            if not w:
                continue
            try:
                ready = w.evaluate_js("typeof window.__restoreState === 'function'")
            except Exception:
                ready = False
            if ready:
                try:
                    w.evaluate_js("window.__restoreState({})".format(json.dumps(s)))
                except Exception:
                    pass
                return

    # ---------- 新用户注册（V2.0） ----------

    def reg_search_schools(self, kw):
        return self.search_schools(kw)

    def reg_get_faculties(self, college_id):
        try:
            headers = {k: v for k, v in app.COMMON_HEADERS.items() if k != "Content-Type"}
            headers["Referer"] = f"{app.BASE}/wapJSLogin"
            raw = app.requests.get(f"{app.BASE}/getFaculty", params={"collegeId": college_id},
                                   headers=headers, verify=False, timeout=15)
            data = json.loads(raw.text)
            return data.get("data", [])
        except Exception:
            return []

    def reg_get_classes(self, faculty_id):
        try:
            headers = {k: v for k, v in app.COMMON_HEADERS.items() if k != "Content-Type"}
            headers["Referer"] = f"{app.BASE}/wapJSLogin"
            raw = app.requests.get(f"{app.BASE}/getClass", params={"facultyId": faculty_id},
                                   headers=headers, verify=False, timeout=15)
            data = json.loads(raw.text)
            return data.get("data", [])
        except Exception:
            return []

    def reg_register(self, college_id, account, name, faculty_id, class_id):
        try:
            headers = dict(app.COMMON_HEADERS)
            headers["Referer"] = f"{app.BASE}/wapJSLogin"
            data = {"collegeId": college_id, "account": account, "name": name, "password": account}
            if faculty_id:
                data["facultyId"] = faculty_id
            if class_id:
                data["classId"] = class_id
            resp = app.requests.post(f"{app.BASE}/registerUser", headers=headers, data=data, verify=False, timeout=15)
            result = json.loads(resp.text)
            if result.get("code") == 200 and result.get("success"):
                user_id = (result.get("data") or {}).get("userId", "")
                return {"success": True, "userId": user_id}
            return {"success": False, "msg": result.get("message", "注册失败")}
        except Exception as e:
            return {"success": False, "msg": str(e)}

    def reg_register_and_run(self, college_id, account, name, faculty_id, class_id):
        result = self.reg_register(college_id, account, name, faculty_id, class_id)
        if not result.get("success"):
            self._log("注册失败：" + result.get("msg", "未知错误"), "err")
            try:
                _win().evaluate_js("window.__runEnd()")
            except Exception:
                pass
            return
        user_id = result["userId"]
        self._log("注册成功！userId=" + user_id, "ok")
        self._log("正在自动完成课程和考试...", "sys")
        threading.Thread(target=self._reg_run_worker, args=(user_id,), daemon=True).start()

    def _reg_run_worker(self, user_id):
        try:
            app.run_core(user_id, self._log, self._certificate)
        except Exception as e:
            self._log("发生异常：" + str(e), "err")
        try:
            app.untying_method(user_id)
            self._log("已解绑 openId")
        except Exception as e:
            self._log(f"解绑失败（可忽略）：{e}")
        try:
            _win().evaluate_js("window.__runEnd()")
        except Exception:
            pass


if __name__ == "__main__":
    api = Api()
    path = app.resource_path("webui/index.html")
    webview.create_window(
        title="安全教育工具演示软件v2.1",
        url=path,
        js_api=api,
        width=1020,
        height=760,
        min_size=(720, 620),
    )
    # private_mode=False：关闭隐私模式，localStorage（公益记录/主题/语言等全部配置）跨会话持久保存。
    # v2.1 修复：private_mode 是 webview.start() 的参数而非 create_window() 的
    # （v2.1.1 误传给 create_window 导致 exe 启动即崩溃 TypeError）。
    # v2.1 补充：部分机器 WebView2 持久化仍不生效，另加文件级兜底（save_state/load_state）。
    threading.Thread(target=api._restore_state_worker, daemon=True).start()
    webview.start(private_mode=False)
