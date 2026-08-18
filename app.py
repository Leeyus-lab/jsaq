#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import json
import time
import sqlite3
import shutil
import threading
import queue
import base64
import re
import requests

try:
    import tkinter as tk
    from tkinter import ttk, messagebox, scrolledtext
    _HAS_TK = True
except ImportError:
    _HAS_TK = False

try:
    from urllib3 import disable_warnings
    disable_warnings()
except Exception:
    pass

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

def resource_path(rel):
    base = getattr(sys, "_MEIPASS", None)
    if base is None:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, rel)

def get_db_path():
    if getattr(sys, "frozen", False):
        live = os.path.join(os.path.dirname(sys.executable), "database.db")
        if not os.path.exists(live):
            seed = os.path.join(sys._MEIPASS, "database.db")
            shutil.copy(seed, live)
        return live
    return resource_path("database.db")

BASE = "http://wap.xiaoyuananquantong.com/guns-vip-main/wap"
COLLEGE_ID = "1224316234189443073"
EXAM_ID = "1948924196784492546"

UA = ("Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/146.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.71 Weixin NetType/5G Language/zh_CN")

COMMON_HEADERS = {
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    "Origin": "http://wap.xiaoyuananquantong.com",
    "User-Agent": UA,
    "X-Requested-With": "XMLHttpRequest",
}

TIKU_COURSES = [
    {"articleId": "2080135073788600321", "title": "题库学习", "question": "2080136617019842561-1", "quesType": "3"},
    {"articleId": "2079132357549375490", "title": "入学安全", "question": "2079154657984266242-1", "quesType": "3"},
    {"articleId": "2079133938168643585", "title": "国家安全", "question": "2079156723934838786-B", "quesType": "1"},
    {"articleId": "2079139032318623745", "title": "财物安全", "question": "2079446660177477633-1", "quesType": "3"},
    {"articleId": "2079140991327027201", "title": "心理健康", "question": "2079467760328392705-D", "quesType": "1"},
    {"articleId": "2079142411614830593", "title": "消防安全", "question": "2079492272201678850-C", "quesType": "1"},
    {"articleId": "2079143452481699842", "title": "人身安全", "question": "2079527272678703105-1", "quesType": "3"},
    {"articleId": "2079144978977669121", "title": "交通安全", "question": "2079540470853156866-A", "quesType": "1"},
    {"articleId": "2079146093836255234", "title": "禁毒防艾", "question": "2079548501443756034-1", "quesType": "3"},
    {"articleId": "2079146628521934850", "title": "应急救护",
     "question": "~2079553855799967746-A~2079553855799967746-B~2079553855799967746-C~2079553855799967746-D", "quesType": "2"},
    {"articleId": "2079147344531570690", "title": "防灾减灾", "question": "2079558043292418049-D", "quesType": "1"},
]

def get_all_schools(province):
    headers = {k: v for k, v in COMMON_HEADERS.items() if k != "Content-Type"}
    headers["Referer"] = f"{BASE}/jiangsuwxJsback"
    raw = requests.get(f"{BASE}/select/proCollege", params={"provincesName": province},
                       headers=headers, verify=False, timeout=15)
    return raw.text

def login_method(username, password, college_id):
    headers = dict(COMMON_HEADERS)
    headers["Referer"] = f"{BASE}/jiangsuwxJsback"
    data = {"openId": "", "account": username, "collegeId": college_id, "password": password}
    resp = requests.post(f"{BASE}/jsUserLogin", headers=headers, data=data, verify=False, timeout=15)
    return json.loads(resp.text)

def untying_method(user_id):
    headers = {k: v for k, v in COMMON_HEADERS.items() if k != "Content-Type"}
    headers["Referer"] = f"{BASE}/jspersonal"
    resp = requests.get(f"{BASE}/JsUntying", params={"userId": user_id}, headers=headers, verify=False, timeout=15)
    return json.loads(resp.text)

def creat_exam(user_id):
    headers = dict(COMMON_HEADERS)
    headers["Referer"] = f"{BASE}/newStudentssimulate?examType=2&userId={user_id}&ah"
    result = requests.post(f"{BASE}/test/create", data={"examId": EXAM_ID, "userId": user_id},
                           headers=headers, verify=False, timeout=15)
    return json.loads(result.text)

def get_exam(log_id, user_id):
    headers = {k: v for k, v in COMMON_HEADERS.items() if k != "Content-Type"}
    headers["Referer"] = f"{BASE}/newStudentssimulate?examType=2&userId={user_id}&ah"
    result = requests.get(f"{BASE}/test/list",
                          params={"logId": log_id, "page": 1, "limit": 200, "ah": "", "userId": user_id},
                          headers=headers, verify=False, timeout=15)
    return json.loads(result.text)

def get_exam_id(user_id):
    headers = dict(COMMON_HEADERS)
    headers["Referer"] = f"{BASE}/newStudentssimulate?examType=2&userId={user_id}&ah"
    res = requests.post(f"{BASE}/test/getTest",
                        data={"examType": 2, "examClass": 20, "userId": user_id, "ah": ""},
                        headers=headers, verify=False, timeout=15)
    return json.loads(res.text)

def get_answer_by_id(qid):
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("SELECT questionId, answer, quesType FROM tiku WHERE questionId = ? ORDER BY answer", (qid,))
    records = cursor.fetchall()
    conn.close()
    if not records:
        return ""
    ques_type = records[0][2]
    if ques_type == "2":
        question = "".join(f"~{r[0]}-{r[1]}" for r in records)
    else:
        question = f"{records[0][0]}-{records[0][1]}"
    return ("question", question), ("questionId", records[0][0]), ("quesType", ques_type)

def imitate_exam(exam_id, log_id, user_id, answers):
    headers = dict(COMMON_HEADERS)
    headers["Referer"] = f"{BASE}/newStudentssimulate?examId={exam_id}&examType=2&userId={user_id}&ah"
    data = [
        ("examId", exam_id),
        ("examType", 2),
        ("sysSource", 20),
        ("logId", log_id),
        ("userId", user_id),
        ("ah", ""),
    ]
    data += list(answers)
    result = requests.post(f"{BASE}/imitateTest", data=data, headers=headers, verify=False, timeout=30)
    return result

def download_certificate(user_id):
    """Download certificate image from the platform.
    Returns (image_bytes, ext) or (None, None) on failure."""
    headers = {k: v for k, v in COMMON_HEADERS.items() if k != "Content-Type"}
    headers["Referer"] = f"{BASE}/jspersonal"
    try:
        resp = requests.get(f"{BASE}/qrCode", params={"userId": user_id},
                            headers=headers, verify=False, timeout=15)
    except Exception:
        return None, None

    content_type = resp.headers.get("Content-Type", "")

    # Case 1: direct image response
    if content_type.startswith("image/"):
        ext = "png" if "png" in content_type else "jpg"
        return resp.content, ext

    # Case 2: HTML page — look for embedded base64 images first
    html = resp.text
    b64_match = re.search(r'src=["\']data:image/(\w+);base64,([^"\']+)["\']', html)
    if b64_match:
        ext = b64_match.group(1)
        try:
            img_bytes = base64.b64decode(b64_match.group(2))
            if len(img_bytes) > 1000:
                return img_bytes, ext
        except Exception:
            pass

    # Case 3: look for <img src="..."> URLs
    img_urls = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html)
    for img_url in img_urls:
        if img_url.startswith("data:"):
            continue
        if img_url.startswith("http"):
            full_url = img_url
        elif img_url.startswith("/"):
            full_url = "http://wap.xiaoyuananquantong.com" + img_url
        else:
            full_url = f"{BASE}/{img_url}"
        try:
            img_resp = requests.get(full_url, headers=headers, verify=False, timeout=15)
            ct = img_resp.headers.get("Content-Type", "")
            if img_resp.status_code == 200 and ct.startswith("image/") and len(img_resp.content) > 3000:
                ext = "png" if "png" in ct else "jpg"
                return img_resp.content, ext
        except Exception:
            continue

    return None, None

# 用量统计（沿用原版 jiangsu-safety-competition 的服务器与格式）：
# 仅上传最终得分和运行时长，不含姓名/账号/userId 等任何个人信息，失败静默忽略
STATS_UPLOAD_URL = "http://101.133.233.225:81/result_update"

def upload_stats(score, execute_time_ms):
    def _worker():
        try:
            requests.post(STATS_UPLOAD_URL,
                          json={"score": score, "runtime_ms": round(float(execute_time_ms), 3)},
                          timeout=3)
        except Exception:
            pass
    try:
        threading.Thread(target=_worker, daemon=True).start()
    except Exception:
        pass

def run_core(user_id, log, cert_callback=None):
    start_time = time.time()
    log(f"开始执行，userId={user_id}")
    course_headers = dict(COMMON_HEADERS)
    course_headers["Referer"] = f"{BASE}/jiangsuwxJsback"
    try:
        res = requests.post(f"{BASE}/compulsory/list", data={"userId": user_id, "collegeId": COLLEGE_ID},
                            headers=course_headers, verify=False, timeout=15)
        course = json.loads(res.text)["data"]
    except Exception as e:
        log(f"获取课程列表失败：{e}")
        log(f"原始响应：{res.text[:300] if 'res' in dir() else '无响应'}")
        return
    log("正在遍历课程列表，查询完成度：")
    unfinished = []
    for idx, item in enumerate(course):
        if item["isFinsh"]:
            log(f"第{idx + 1}课 {item['name']} 已完成")
        else:
            unfinished.append(idx)
            log(f"第{idx + 1}课 {item['name']} 未完成")
    if not unfinished:
        log("检测到所有课程已经完成，直接进入考试")
    else:
        for i in unfinished:
            log(f"正在完成 {TIKU_COURSES[i]['title']}")
            payload = {
                "articleId": TIKU_COURSES[i]["articleId"],
                "title": TIKU_COURSES[i]["title"],
                "userId": user_id,
                "ah": "",
                "question": TIKU_COURSES[i]["question"],
                "quesType": TIKU_COURSES[i]["quesType"],
            }
            try:
                requests.post(f"{BASE}/unitTest", data=payload, headers=course_headers, verify=False, timeout=15)
            except Exception as e:
                log(f"完成课程 {TIKU_COURSES[i]['title']} 失败：{e}")
        try:
            res = requests.post(f"{BASE}/compulsory/list", data={"userId": user_id, "collegeId": COLLEGE_ID},
                                headers=course_headers, verify=False, timeout=15)
            course = json.loads(res.text)["data"]
        except Exception as e:
            log(f"复查课程列表失败：{e}")
            return
        log("课程完成度查询(完成后)：")
        for idx, item in enumerate(course):
            state = "已完成" if item["isFinsh"] else "未完成"
            log(f"第{idx + 1}课 {item['name']} {state}")
        log("已完成课程学习")
    log("正在进入考试流程...")
    try:
        exam_resp = creat_exam(user_id)
        log_id = exam_resp["data"]["logId"]
    except Exception as e:
        log(f"创建考试失败：{e}")
        log(f"原始响应：{exam_resp if 'exam_resp' in dir() else '无响应'}")
        return
    log(f"取得 logId {log_id}")
    try:
        exam_list = get_exam(log_id=log_id, user_id=user_id)
        questions = exam_list["data"]["data"]
        log(f"获取到 {len(questions)} 道考题")
        data = get_exam_id(user_id)
    except Exception as e:
        log(f"获取考题失败：{e}")
        log(f"exam_list原始响应：{exam_list if 'exam_list' in dir() else '无响应'}")
        return
    if data.get("code") == 500:
        log("出错了！你的账号未完成内容学习，可能由以下几点原因导致")
        log("    1.你所在学校不属于江苏省")
        log("    2.题库出错")
        log("    3.平台更新")
        log(f"getTest原始响应：{data}")
        return
    exam_id = data["data"]["id"]
    log(f"取得 examId {exam_id}")
    qcount = len(questions)
    question_list = [questions[i]["questionId"] for i in range(qcount)]
    answers = ()
    found = 0
    missing = 0
    for qid in question_list:
        try:
            ans = get_answer_by_id(qid)
            if not ans:
                missing += 1
                log(f"警告：题目 {qid} 在题库中未找到答案，将留空")
                continue
            answers += ans
            found += 1
        except Exception as e:
            log(f"数据库读写错误：{e}")
            return
    log(f"答案生成完毕：共 {qcount} 题，找到 {found} 题，缺失 {missing} 题")
    if missing > 0:
        log(f"警告：有 {missing} 道题未找到答案，可能影响最终得分")
    log("正在执行提交答案...")
    try:
        res = imitate_exam(exam_id, log_id, user_id, answers)
        res_json = json.loads(res.text)
        score = res_json["data"]["count"]
    except Exception as e:
        log(f"提交答案失败：{e}")
        log(f"原始响应：{res.text[:500] if 'res' in dir() else '无响应'}")
        return
    log(f"得分：{score}")
    if int(score) != 100:
        log("没到100分，可重刷一次，因为有个别题目答案可能未录入准确。")
    else:
        log("考试满分！正在下载结业证书...")
        img_bytes, ext = download_certificate(user_id)
        if img_bytes:
            save_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.abspath(__file__))
            filename = f"结业证书_{user_id}.{ext}"
            save_path = os.path.join(save_dir, filename)
            try:
                with open(save_path, "wb") as f:
                    f.write(img_bytes)
                log(f"结业证书已保存到：{save_path}")
            except Exception as e:
                log(f"证书保存失败：{e}")
            b64data = base64.b64encode(img_bytes).decode("ascii")
            if cert_callback:
                try:
                    cert_callback(b64data, save_path)
                except Exception:
                    pass
        else:
            cert_url = f"{BASE}/qrCode?userId={user_id}"
            log(f"证书图片自动下载失败，请手动访问：{cert_url}")
            if cert_callback:
                try:
                    cert_callback(None, cert_url)
                except Exception:
                    pass
    elapsed_ms = (time.time() - start_time) * 1000
    log(f"execute time: {elapsed_ms:.3f} ms.")
    upload_stats(score, elapsed_ms)

def login_and_run(school_id, username, password, log, cert_callback=None):
    try:
        login_result = login_method(username, password, school_id)
    except Exception as e:
        log(f"登录请求失败：{e}")
        return
    if not login_result.get("success"):
        log("登录失败，请检查账号密码和学校是否正确")
        return
    user_id = login_result["data"]["userId"]
    log(f"获取到 userId {user_id}，开始执行")
    run_core(user_id, log, cert_callback)
    try:
        untying_method(user_id)
        log("已解绑 openId")
    except Exception as e:
        log(f"解绑失败（可忽略）：{e}")

def run_userid(user_id, log, cert_callback=None):
    try:
        int(user_id)
    except Exception:
        log("userId 通常是一个长串纯数字，请检查输入是否正确。")
        return
    run_core(user_id, log, cert_callback)

def db_view(log):
    conn = sqlite3.connect(get_db_path())
    cur = conn.cursor()
    cur.execute("SELECT quesType, COUNT(*) FROM tiku GROUP BY quesType")
    log("题库统计：")
    for r in cur.fetchall():
        label = {"1": "单选", "2": "多选", "3": "判断"}.get(r[0], r[0])
        log(f"  {label}(类型{r[0]}): {r[1]} 题")
    cur.execute("SELECT COUNT(*) FROM tiku")
    log(f"  合计：{cur.fetchone()[0]} 题")
    conn.close()

def db_add(qid, ans, qt, log):
    if not qid or not ans or qt not in ("1", "2", "3"):
        log("输入不合法，已取消。")
        return
    conn = sqlite3.connect(get_db_path())
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM tiku WHERE questionId = ?", (qid,))
    if cur.fetchone():
        log("该题目ID已存在，如需修改请先删除再添加。")
        conn.close()
        return
    cur.execute("INSERT INTO tiku(questionId, answer, quesType) VALUES(?, ?, ?)", (qid, ans, qt))
    conn.commit()
    conn.close()
    log(f"已新增：{qid} -> {ans} (类型{qt})")

def db_delete(qid, log):
    if not qid:
        log("已取消。")
        return
    conn = sqlite3.connect(get_db_path())
    cur = conn.cursor()
    cur.execute("SELECT questionId, answer, quesType FROM tiku WHERE questionId = ?", (qid,))
    row = cur.fetchone()
    if not row:
        log("未找到该题目，已取消。")
        conn.close()
        return
    log(f"将删除：{row[0]} -> {row[1]} (类型{row[2]})")
    conn.close()
    db_delete_confirm(qid, log)

def db_delete_confirm(qid, log):
    conn = sqlite3.connect(get_db_path())
    cur = conn.cursor()
    cur.execute("DELETE FROM tiku WHERE questionId = ?", (qid,))
    conn.commit()
    conn.close()
    log("已删除。")

class App:
    def __init__(self, root):
        self.root = root
        self.root.title("安全知识教育一键完成工具 本地版V1.2")
        self.root.geometry("760x600")
        self.root.resizable(True, True)
        self.busy = False
        self.q = queue.Queue()
        self.school_map = {}
        self.selected_school_id = None
        self.mode_var = tk.StringVar(value="login")
        self._build()
        self.root.after(120, self._poll)

    def _build(self):
        header = ttk.Label(self.root, text="安全知识教育一键完成工具  本地版 V1.2", font=("Microsoft YaHei", 14, "bold"))
        header.pack(pady=(10, 4))
        sub = ttk.Label(self.root, text="请选择一种方式完成学习考试", foreground="#555555")
        sub.pack(pady=(0, 8))

        nb = ttk.Notebook(self.root)
        nb.pack(fill="both", expand=True, padx=12, pady=(0, 8))
        self._build_main_tab(nb)
        self._build_db_tab(nb)

    def _build_main_tab(self, nb):
        f = ttk.Frame(nb)
        nb.add(f, text="一键完成")
        mode_frame = ttk.LabelFrame(f, text="方式选择")
        mode_frame.pack(fill="x", padx=8, pady=8)
        rb1 = ttk.Radiobutton(mode_frame, text="登录方式（学校+账号+密码）", variable=self.mode_var, value="login", command=self._on_mode)
        rb2 = ttk.Radiobutton(mode_frame, text="userId 方式（粘贴链接里的 userId）", variable=self.mode_var, value="userid", command=self._on_mode)
        rb1.grid(row=0, column=0, sticky="w", padx=8, pady=4)
        rb2.grid(row=1, column=0, sticky="w", padx=8, pady=4)

        self.login_frame = ttk.LabelFrame(f, text="登录信息")
        self.login_frame.pack(fill="x", padx=8, pady=4)
        ttk.Label(self.login_frame, text="学校关键词：").grid(row=0, column=0, sticky="w", padx=6, pady=4)
        self.school_entry = ttk.Entry(self.login_frame, width=28)
        self.school_entry.grid(row=0, column=1, padx=6, pady=4)
        self.search_btn = ttk.Button(self.login_frame, text="搜索学校", command=self.search_schools)
        self.search_btn.grid(row=0, column=2, padx=6, pady=4)
        self.school_list = tk.Listbox(self.login_frame, height=4, exportselection=False)
        self.school_list.grid(row=1, column=0, columnspan=3, sticky="we", padx=6, pady=4)
        self.school_list.bind("<<ListboxSelect>>", self._on_school_select)
        ttk.Label(self.login_frame, text="账号：").grid(row=2, column=0, sticky="w", padx=6, pady=4)
        self.acc_entry = ttk.Entry(self.login_frame, width=28)
        self.acc_entry.grid(row=2, column=1, columnspan=2, padx=6, pady=4)
        ttk.Label(self.login_frame, text="密码：").grid(row=3, column=0, sticky="w", padx=6, pady=4)
        self.pwd_entry = ttk.Entry(self.login_frame, width=28, show="*")
        self.pwd_entry.grid(row=3, column=1, columnspan=2, padx=6, pady=4)

        self.uid_frame = ttk.LabelFrame(f, text="userId 信息")
        ttk.Label(self.uid_frame, text="userId：").grid(row=0, column=0, sticky="w", padx=6, pady=6)
        self.uid_entry = ttk.Entry(self.uid_frame, width=32)
        self.uid_entry.grid(row=0, column=1, padx=6, pady=6)
        self.uid_frame.pack_forget()

        btn_frame = ttk.Frame(f)
        btn_frame.pack(fill="x", padx=8, pady=6)
        self.start_btn = ttk.Button(btn_frame, text="开始执行", command=self.start)
        self.start_btn.pack(side="left", padx=4)
        self.status_var = tk.StringVar(value="就绪")
        ttk.Label(btn_frame, textvariable=self.status_var, foreground="#006600").pack(side="left", padx=8)

        ttk.Label(f, text="运行日志：").pack(anchor="w", padx=10, pady=(6, 0))
        self.log_main = scrolledtext.ScrolledText(f, height=14, state="disabled", font=("Consolas", 10))
        self.log_main.pack(fill="both", expand=True, padx=10, pady=(2, 10))

    def _build_db_tab(self, nb):
        f = ttk.Frame(nb)
        nb.add(f, text="题库管理")
        warn = ttk.Label(f, text="注意：题库是自动答题的唯一答案来源，任何增删都直接影响考试结果，请谨慎操作。",
                         foreground="#b00000", wraplength=700)
        warn.pack(fill="x", padx=10, pady=(10, 4))

        view_frame = ttk.LabelFrame(f, text="查看统计")
        view_frame.pack(fill="x", padx=8, pady=4)
        ttk.Button(view_frame, text="查看题库统计", command=self.view_db).pack(side="left", padx=6, pady=6)

        add_frame = ttk.LabelFrame(f, text="增加题目（谨慎）")
        add_frame.pack(fill="x", padx=8, pady=4)
        ttk.Label(add_frame, text="题目ID：").grid(row=0, column=0, sticky="w", padx=6, pady=4)
        self.add_qid = ttk.Entry(add_frame, width=30)
        self.add_qid.grid(row=0, column=1, padx=6, pady=4)
        ttk.Label(add_frame, text="答案：").grid(row=1, column=0, sticky="w", padx=6, pady=4)
        self.add_ans = ttk.Entry(add_frame, width=30)
        self.add_ans.grid(row=1, column=1, padx=6, pady=4)
        ttk.Label(add_frame, text="题型：").grid(row=2, column=0, sticky="w", padx=6, pady=4)
        self.add_qt = ttk.Combobox(add_frame, values=["1 单选", "2 多选", "3 判断"], width=12, state="readonly")
        self.add_qt.current(0)
        self.add_qt.grid(row=2, column=1, padx=6, pady=4)
        ttk.Button(add_frame, text="添加题目", command=self.add_question).grid(row=3, column=0, columnspan=2, padx=6, pady=6)

        del_frame = ttk.LabelFrame(f, text="删除题目（高危）")
        del_frame.pack(fill="x", padx=8, pady=4)
        ttk.Label(del_frame, text="题目ID：").grid(row=0, column=0, sticky="w", padx=6, pady=4)
        self.del_qid = ttk.Entry(del_frame, width=30)
        self.del_qid.grid(row=0, column=1, padx=6, pady=4)
        ttk.Button(del_frame, text="删除题目", command=self.delete_question).grid(row=1, column=0, columnspan=2, padx=6, pady=6)

        ttk.Label(f, text="操作日志：").pack(anchor="w", padx=10, pady=(6, 0))
        self.log_db = scrolledtext.ScrolledText(f, height=12, state="disabled", font=("Consolas", 10))
        self.log_db.pack(fill="both", expand=True, padx=10, pady=(2, 10))

    def _on_mode(self):
        if self.mode_var.get() == "login":
            self.uid_frame.pack_forget()
            self.login_frame.pack(fill="x", padx=8, pady=4)
        else:
            self.login_frame.pack_forget()
            self.uid_frame.pack(fill="x", padx=8, pady=4)

    def _on_school_select(self, event):
        sel = self.school_list.curselection()
        if sel:
            name = self.school_list.get(sel[0])
            self.selected_school_id = self.school_map.get(name)

    def put(self, tw, msg):
        self.q.put((tw, msg))

    def _poll(self):
        try:
            while True:
                tw, msg = self.q.get_nowait()
                tw.configure(state="normal")
                tw.insert(tk.END, msg + "\n")
                tw.see(tk.END)
                tw.configure(state="disabled")
        except queue.Empty:
            pass
        self.root.after(120, self._poll)

    def search_schools(self):
        kw = self.school_entry.get().strip()
        if not kw:
            messagebox.showwarning("提示", "请输入学校名称关键词")
            return
        self.search_btn.config(state="disabled")
        self.put(self.log_main, f"正在搜索学校：{kw} ...")
        threading.Thread(target=self._search_worker, args=(kw,), daemon=True).start()

    def _search_worker(self, kw):
        try:
            raw = get_all_schools("江苏省")
            data = json.loads(raw)["data"]
            matched = [s for s in data if kw in s["name"]]
        except Exception as e:
            self.put(self.log_main, f"搜索失败：{e}")
            self.root.after(0, lambda: self.search_btn.config(state="normal"))
            return
        self.school_map = {s["name"]: s["id"] for s in matched}
        self.root.after(0, self._populate_schools, matched)

    def _populate_schools(self, matched):
        self.school_list.delete(0, tk.END)
        if not matched:
            self.put(self.log_main, "未查找到任何学校，请更换关键词。")
        else:
            for s in matched:
                self.school_list.insert(tk.END, s["name"])
            self.put(self.log_main, f"找到 {len(matched)} 所学校，请在列表中选择。")
        self.search_btn.config(state="normal")

    def start(self):
        if self.busy:
            return
        mode = self.mode_var.get()
        if mode == "login":
            if not self.selected_school_id:
                messagebox.showwarning("提示", "请先搜索并选择学校")
                return
            u = self.acc_entry.get().strip()
            p = self.pwd_entry.get().strip()
            if not u or not p:
                messagebox.showwarning("提示", "请输入账号和密码")
                return
            self.busy = True
            self._set_running(True)
            threading.Thread(target=self._worker_login, args=(self.selected_school_id, u, p), daemon=True).start()
        else:
            uid = self.uid_entry.get().strip()
            if not uid:
                messagebox.showwarning("提示", "请输入 userId")
                return
            self.busy = True
            self._set_running(True)
            threading.Thread(target=self._worker_userid, args=(uid,), daemon=True).start()

    def _worker_login(self, sid, u, p):
        login_and_run(sid, u, p, lambda m: self.put(self.log_main, m))
        self.root.after(0, self._done)

    def _worker_userid(self, uid):
        run_userid(uid, lambda m: self.put(self.log_main, m))
        self.root.after(0, self._done)

    def _set_running(self, running):
        if running:
            self.start_btn.config(state="disabled")
            self.status_var.set("执行中...")
        else:
            self.start_btn.config(state="normal")
            self.status_var.set("就绪")

    def _done(self):
        self.busy = False
        self._set_running(False)
        self.put(self.log_main, "==== 执行结束 ====")

    def view_db(self):
        threading.Thread(target=self._worker_view, daemon=True).start()

    def _worker_view(self):
        db_view(lambda m: self.put(self.log_db, m))
        self.root.after(0, lambda: self.put(self.log_db, "==== 操作结束 ===="))

    def add_question(self):
        qid = self.add_qid.get().strip()
        ans = self.add_ans.get().strip().upper()
        qt_raw = self.add_qt.get().strip()
        qt = qt_raw[0] if qt_raw else ""
        if not qid or not ans or qt not in ("1", "2", "3"):
            messagebox.showwarning("提示", "请填写完整的题目ID、答案和题型")
            return
        threading.Thread(target=self._worker_add, args=(qid, ans, qt), daemon=True).start()

    def _worker_add(self, qid, ans, qt):
        db_add(qid, ans, qt, lambda m: self.put(self.log_db, m))
        self.root.after(0, lambda: self.put(self.log_db, "==== 操作结束 ===="))

    def delete_question(self):
        qid = self.del_qid.get().strip()
        if not qid:
            messagebox.showwarning("提示", "请输入题目ID")
            return
        ok = messagebox.askyesno("高危警告",
                                 f"你正在从核心题库删除记录：\n{qid}\n\n删除后无法恢复，且会导致对应题目在考试时无答案。\n\n确认删除？")
        if not ok:
            self.put(self.log_db, "已取消删除。")
            return
        threading.Thread(target=self._worker_del, args=(qid,), daemon=True).start()

    def _worker_del(self, qid):
        db_delete(qid, lambda m: self.put(self.log_db, m))
        self.root.after(0, lambda: self.put(self.log_db, "==== 操作结束 ===="))

if _HAS_TK and __name__ == "__main__":
    root = tk.Tk()
    try:
        root.iconbitmap()
    except Exception:
        pass
    App(root)
    root.mainloop()
