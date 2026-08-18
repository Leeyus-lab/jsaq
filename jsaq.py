#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import json
import time
import sqlite3
import shutil
import requests

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
    raw = requests.get(f"{BASE}/select/proCollege", params={"provincesName": province}, timeout=15)
    return raw.text


def get_user_school():
    school_key = input("请输入学校名称[关键词也可以]：").strip()
    try:
        school_list = json.loads(get_all_schools("江苏省"))
    except Exception:
        print("错误：网络异常，无法获取学校列表")
        sys.exit(1)
    matched = [_["name"] for _ in school_list["data"] if school_key in _["name"]]
    if not matched:
        print("未查找到任何学校，请重新输入")
        return get_user_school()
    if len(matched) == 1:
        for _ in school_list["data"]:
            if _["name"] == matched[0]:
                print(f"已获取学校id：{_['id']}")
                return _["id"]
    else:
        print("查找到以下学校：")
        for i, name in enumerate(matched):
            print(f"[{i}] {name}")
        try:
            n = int(input("请输入数字序号来选择学校："))
        except Exception:
            print("您的输入有误，请重新输入")
            return get_user_school()
        school_name = matched[n]
        for _ in school_list["data"]:
            if _["name"] == school_name:
                print(f"已获取学校id：{_['id']}")
                return _["id"]
    return None


def login_method(username, password, college_id):
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Origin": "http://wap.xiaoyuananquantong.com",
        "Referer": "http://wap.xiaoyuananquantong.com/guns-vip-main/wap/jiangsuwxJsback",
        "User-Agent": "Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/146.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.71 Weixin NetType/5G Language/zh_CN",
        "X-Requested-With": "XMLHttpRequest",
    }
    data = {"openId": "", "account": username, "collegeId": college_id, "password": password}
    resp = requests.post(f"{BASE}/jsUserLogin", headers=headers, data=data, verify=False, timeout=15)
    return json.loads(resp.text)


def untying_method(user_id):
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": "http://wap.xiaoyuananquantong.com/guns-vip-main/wap/jspersonal",
        "User-Agent": "Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/146.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.71 Weixin NetType/5G Language/zh_CN",
        "X-Requested-With": "XMLHttpRequest",
    }
    resp = requests.get(f"{BASE}/JsUntying", params={"userId": user_id}, headers=headers, verify=False, timeout=15)
    return json.loads(resp.text)


def creat_exam(user_id):
    result = requests.post(f"{BASE}/test/create", data={"examId": EXAM_ID, "userId": user_id}, timeout=15)
    return json.loads(result.text)


def get_exam(log_id, user_id):
    result = requests.get(f"{BASE}/test/list",
                          params={"logId": log_id, "page": 1, "limit": 200, "ah": "", "userId": user_id},
                          timeout=15)
    return json.loads(result.text)


def get_exam_id(user_id):
    res = requests.post(f"{BASE}/test/getTest",
                        data={"examType": 2, "examClass": 20, "userId": user_id, "ah": ""}, timeout=15)
    return json.loads(res.text)


def get_answer_by_id(qid):
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("SELECT questionId, answer, quesType FROM tiku WHERE questionId = ?", (qid,))
    records = cursor.fetchall()
    conn.close()
    if not records:
        print(f"没找到题目 {qid} 的答案")
        return ""
    ques_type = records[0][2]
    if ques_type == "2":
        question = "".join(f"~{r[0]}-{r[1]}" for r in records)
    else:
        question = f"{records[0][0]}-{records[0][1]}"
    print(f"从题库查询题目 {qid} 类型 {ques_type} -> 答案 {records[0][1]}")
    return ("question", question), ("questionId", records[0][0]), ("quesType", ques_type)


def imitate_exam(exam_id, log_id, user_id, answers):
    headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Referer": f"{BASE}/newStudentssimulate?examId={exam_id}&examType=2&userId={user_id}&ah",
    }
    data = [
        ("examId", exam_id),
        ("examType", 2),
        ("sysSource", 20),
        ("logId", log_id),
        ("userId", user_id),
        ("ah", ""),
    ]
    data += list(answers)
    result = requests.post(f"{BASE}/imitateTest", data=data, headers=headers, timeout=15)
    return result


def run_core(user_id):
    start_time = time.time()
    print(f"开始执行，userId={user_id}")
    res = requests.post(f"{BASE}/compulsory/list", data={"userId": user_id, "collegeId": COLLEGE_ID}, timeout=15)
    course = json.loads(res.text)["data"]
    print("正在遍历课程列表，查询完成度：")
    unfinished = []
    for idx, item in enumerate(course):
        if item["isFinsh"]:
            print(f"第{idx + 1}课 {item['name']} 已完成")
        else:
            unfinished.append(idx)
            print(f"第{idx + 1}课 {item['name']} 未完成")
    if not unfinished:
        print("检测到所有课程已经完成，直接进入考试")
    else:
        for i in unfinished:
            print(f"正在完成 {TIKU_COURSES[i]['title']}")
            payload = {
                "articleId": TIKU_COURSES[i]["articleId"],
                "title": TIKU_COURSES[i]["title"],
                "userId": user_id,
                "ah": "",
                "question": TIKU_COURSES[i]["question"],
                "quesType": TIKU_COURSES[i]["quesType"],
            }
            requests.post(f"{BASE}/unitTest", data=payload, timeout=15)
        res = requests.post(f"{BASE}/compulsory/list", data={"userId": user_id, "collegeId": COLLEGE_ID}, timeout=15)
        course = json.loads(res.text)["data"]
        print("课程完成度查询(完成后)：")
        for idx, item in enumerate(course):
            state = "已完成" if item["isFinsh"] else "未完成"
            print(f"第{idx + 1}课 {item['name']} {state}")
        print("已完成课程学习")
    print("正在进入考试流程...")
    log_id = creat_exam(user_id)["data"]["logId"]
    print(f"取得 logId {log_id}")
    exam_list = get_exam(log_id=log_id, userId=user_id)
    questions = exam_list["data"]["data"]
    data = get_exam_id(user_id)
    if data.get("code") == 500:
        print("""出错了！你的账号未完成内容学习，可能由以下几点原因导致
    1.你所在学校不属于江苏省
    2.脚本题库出错
    3.平台更新""")
        print("程序已自动结束，非常抱歉给您带来不便。")
        sys.exit(1)
    exam_id = data["data"]["id"]
    question_list = [questions[i]["questionId"] for i in range(50)]
    answers = ()
    for qid in question_list:
        try:
            answers += get_answer_by_id(qid)
        except Exception:
            print("err: 数据库读写错误")
            sys.exit(1)
    print("答案已生成，正在执行 imitateExam 提交答案...")
    res = imitate_exam(exam_id, log_id, user_id, answers)
    res = json.loads(res.text)
    score = res["data"]["count"]
    print(f"得分：{score}")
    if int(score) != 100:
        print("没到100分，这是一个历史遗留问题，重刷一次就行了，因为题库录入的时候有一题出错了。")
    else:
        print(f"前往 {BASE}/qrCode?userId={user_id} 下载结课证书")
    elapsed_ms = (time.time() - start_time) * 1000
    print(f"execute time: {elapsed_ms:.3f} ms.")


def do_login():
    print("===== 登录版 =====")
    college_id = get_user_school()
    username = input("请输入账号：").strip()
    password = input("请输入密码：").strip()
    login_result = login_method(username, password, college_id)
    if not login_result.get("success"):
        print("登录失败，请检查账号密码和学校是否正确")
        sys.exit(1)
    user_id = login_result["data"]["userId"]
    print(f"获取到了 userId {user_id}，开始执行脚本")
    run_core(user_id)
    print("正在解绑 openId 并退出登录...")
    print(untying_method(user_id))


def do_userid():
    print("===== userId 版 =====")
    user_id = input("请输入 userId：").strip()
    try:
        int(user_id)
    except Exception:
        print("err: 你输入了错误的 user_id，user_id 通常是一个 19 位长的纯数字，请检查输入是否正确。")
        sys.exit(1)
    run_core(user_id)


def db_view():
    conn = sqlite3.connect(get_db_path())
    cur = conn.cursor()
    cur.execute("SELECT quesType, COUNT(*) FROM tiku GROUP BY quesType")
    print("题库统计：")
    for r in cur.fetchall():
        label = {"1": "单选", "2": "多选", "3": "判断"}.get(r[0], r[0])
        print(f"  {label}(类型{r[0]}): {r[1]} 题")
    cur.execute("SELECT COUNT(*) FROM tiku")
    print(f"  合计：{cur.fetchone()[0]} 题")
    conn.close()


def db_add():
    print("=" * 50)
    print("  !! 警告：你正在向核心题库新增记录")
    print("  错误的题目ID或答案会直接导致考试答错、拿不到100分")
    print("  请务必从平台/原题核对无误后再添加")
    print("=" * 50)
    qid = input("题目ID(questionId)：").strip()
    ans = input("答案(如 1 / A / B / C / D，多选如 AB)：").strip().upper()
    qt = input("题型(1=单选 2=多选 3=判断)：").strip()
    if not qid or not ans or qt not in ("1", "2", "3"):
        print("输入不合法，已取消。")
        return
    conn = sqlite3.connect(get_db_path())
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM tiku WHERE questionId = ?", (qid,))
    if cur.fetchone():
        print("该题目ID已存在，如需修改请先删除再添加。")
        conn.close()
        return
    cur.execute("INSERT INTO tiku(questionId, answer, quesType) VALUES(?, ?, ?)", (qid, ans, qt))
    conn.commit()
    conn.close()
    print(f"已新增：{qid} -> {ans} (类型{qt})")


def db_delete():
    print("=" * 50)
    print("  !! 高危警告：你正在从核心题库删除记录")
    print("  删除后无法恢复，且会导致对应题目在考试时无答案")
    print("  请确认你真的要删除，而不是手滑")
    print("=" * 50)
    qid = input("要删除的题目ID：").strip()
    if not qid:
        print("已取消。")
        return
    conn = sqlite3.connect(get_db_path())
    cur = conn.cursor()
    cur.execute("SELECT questionId, answer, quesType FROM tiku WHERE questionId = ?", (qid,))
    row = cur.fetchone()
    if not row:
        print("未找到该题目，已取消。")
        conn.close()
        return
    print(f"将删除：{row[0]} -> {row[1]} (类型{row[2]})")
    confirm = input('如确认删除，请输入大写 "DELETE"：').strip()
    if confirm != "DELETE":
        print("确认不符，已取消。")
        conn.close()
        return
    cur.execute("DELETE FROM tiku WHERE questionId = ?", (qid,))
    conn.commit()
    conn.close()
    print("已删除。")


def db_manage():
    print("\n" + "#" * 54)
    print("#  !!!  数据库管理 —— 核心功能区，请谨慎使用  !!!")
    print("#  题库(tiku)是自动答题的唯一答案来源")
    print("#  任何增删都直接影响考试结果，请再三确认")
    print("#" * 54)
    while True:
        print("\n[数据库管理]")
        print("  [1] 查看题库统计")
        print("  [2] 增加题目  (谨慎)")
        print("  [3] 删除题目  (高危)")
        print("  [0] 返回主菜单")
        c = input("请选择：").strip()
        if c == "1":
            db_view()
        elif c == "2":
            db_add()
        elif c == "3":
            db_delete()
        elif c == "0":
            return
        else:
            print("输入有误")


def main():
    print("=" * 48)
    print("  安全知识教育 · 一键完成工具")
    print("  本地版 v1.2  (统计上传已移除 / 答案库可编辑 / 内置)")
    print("=" * 48)
    print("请选择功能：")
    print("  [1] 登录版  (输入学校+账号+密码)")
    print("  [2] userId版 (复制链接里的 userId)")
    print("  [3] 数据库管理 (增删题库，谨慎使用)")
    print("  [0] 退出")
    choice = input("请输入数字：").strip()
    if choice == "1":
        do_login()
    elif choice == "2":
        do_userid()
    elif choice == "3":
        db_manage()
    elif choice == "0":
        return
    else:
        print("输入有误")
        return
    input("程序结束，感谢使用！按回车退出。")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n已取消")
    except Exception as e:
        print(f"发生异常：{e}")
        input("按回车退出。")
