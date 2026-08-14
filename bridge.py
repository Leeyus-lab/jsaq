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


if __name__ == "__main__":
    api = Api()
    path = app.resource_path("webui/index.html")
    webview.create_window(
        title="安全知识教育一键完成工具 本地版V1.2",
        url=path,
        js_api=api,
        width=980,
        height=740,
        min_size=(720, 600),
    )
    webview.start()
