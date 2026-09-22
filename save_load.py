import json
def load_data():
    try:
        with open("D:/Work/个人学习记录和复盘助手/history.json", "r", encoding="utf-8") as f:
            history:list = json.load(f)
        return history
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        print("聊天记录不是有效的 JSON，请检查文件")
        raise
    except OSError:
        print("读取数据失败")
        raise

def save_data(msg):
    try:
        with open("D:/Work/个人学习记录和复盘助手/history.json", "w", encoding="utf-8") as f:
            json.dump(msg, f, indent=4, ensure_ascii=False)
    except OSError:
        print("读取数据失败")
        raise
        