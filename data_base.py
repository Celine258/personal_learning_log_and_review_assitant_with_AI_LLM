import os
import pymysql
from pymysql.cursors import DictCursor

def get_connection(database="test"):
    if not os.environ.get("User") or not os.environ.get("Passwd"):
        raise RuntimeError("未配置数据库账号密码")
    return pymysql.connect(
        host="localhost",
        user=os.environ['User'],
        passwd=os.environ['Passwd'],
        database=database,
        port=3306,
        connect_timeout=5,
        charset="utf8mb4",
        cursorclass=DictCursor
    )