import datetime
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from data_base import get_connection

logging.basicConfig(
    filename= "D:/Work/个人学习记录和复盘助手/main.log",
    level= logging.INFO,
    format= "%(asctime)s | %(levelname)s | %(message)s",
    encoding= "utf-8",
    )
logging.getLogger("watchfiles").setLevel(logging.WARNING)

def rollback_quietly(conn) -> None:
    try:
        conn.rollback()
    except Exception:
        logging.exception("事务回滚失败")

app = FastAPI()

@app.exception_handler(Exception)
async def handle_server_error(request: Request, error: Exception):
    logging.error("请求处理失败: %s", request.url.path, exc_info=(type(error), error, error.__traceback__))
    return JSONResponse(status_code=500, content={"detail": "服务内部错误，请查看服务端日志"})


class StudyRecord(BaseModel):
    Subject: str = Field(min_length=1, max_length=100, pattern=r"\S")
    Topic: str = Field(min_length=1, max_length=100, pattern=r"\S")
    # 【修改 3】Date 原来是 str，只校验长度，非法日期要等 SQL 执行时才报错。
    # 改成 datetime.date 后由 Pydantic 在入口处拦截（客户端需传 "2026-09-20"）。
    Date: datetime.date
    Duration_minutes: int = Field(ge=0)
    Difficulty: str = Field(max_length=1000)
    Plan_Comment: str = Field(max_length=1000)

# @app.get("/study")
# def get_data():
#     conn = get_connection()
#     try:
#         with conn.cursor() as cursor:
#             cursor.execute("select * from study_record")
#             data = cursor.fetchall()
#             # 【修改 17】删掉 `if data == []: return {"message": ...}`。
#             # 加上它之后，"查询全部"这个接口在有数据时返回 list、没数据时返回 dict，
#             # 返回类型不稳定，客户端得写两套判断。查询全部本来就没有 404 的语义，
#             # 查不到数据返回空列表 [] 才是正确做法。
#     # 【修改 5】删掉 `except: raise`：捕获后原样抛出等于没写，只会让人误以为这里有处理逻辑。
#     # 补上真正的异常处理，避免数据库出错时把带堆栈的 500 直接抛给客户端。
#     except Exception as error:
#         logging.exception("查询全部记录失败")
#         raise HTTPException(status_code=500, detail="查询数据失败") from error
#     finally:
#         conn.close()

#     # 【修改 6】fetchall() 永远返回 list，空结果是 []，原来的 `data is None` 是死分支。
#     # 另外返回 [] 而不是字符串 "空"，保证同一个接口的返回类型稳定
#     # （原来有数据返回 list、没数据返回 str，前端得写两份判断）。
#     return data

@app.get("/study/{id}")
def get_data_by_id(id: int):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("select * from study_record where id = %s", (id, ))
            data = cursor.fetchone()
    # 【修改 7】原来这里没有 except，数据库出错时会把原始异常连同堆栈一起返回给客户端，
    # 既不安全，对调用方也不友好。
    except Exception as error:
        logging.exception("按 id 查询失败: id=%s", id)
        raise HTTPException(status_code=500, detail="查询数据失败") from error
    finally:
        conn.close()

    if data is None:
        raise HTTPException(status_code=404, detail="不存在该数据")
    return data


@app.post("/study", status_code=201)
def post_data(data: StudyRecord):# 【修改 8】新增资源成功应返回 201 Created，而不是默认的 200。
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("insert into study_record (Subject, Topic, Date, Duration_minutes, Difficulty, Plan_Comment) values (%s,%s,%s,%s,%s,%s)",
                           (data.Subject, data.Topic, data.Date, data.Duration_minutes, data.Difficulty, data.Plan_Comment))
            # 【修改 18】取出刚插入记录的自增 id。
            # 必须在 with 块内部读取——cursor 在块结束时就关闭了。
            new_id = cursor.lastrowid
        conn.commit()#提交易忘
    except Exception as error:
        rollback_quietly(conn)#失败要记得回滚
        # 【修改 9】加日志，并用 `from error` 保留原始异常链。
        # 否则 SQL 写错时你只看到"数据添加失败"，完全查不出原因。
        logging.exception("新增数据失败")
        raise HTTPException(status_code=500, detail="数据添加失败") from error#错误类型
    finally:
        conn.close()
    # 【修改 10】统一成功响应结构。原来是裸字符串，和失败时的 {"detail": ...} 格式不一致。
    # 【修改 19】顺便把新建记录的 id 返回给客户端。否则调用方根本不知道刚建的是哪一条，
    # 只能硬编码 /study/1 去猜——测试脚本里就是这么写的。
    return {"message": "数据添加成功", "id": new_id}

@app.put("/study/{id}")
def update_data(id: int, data: StudyRecord):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # 【说明】保留"先查存在性"这一步，不要简化成判断 UPDATE 的 rowcount：
            # MySQL 的 rowcount 返回的是"实际被修改的行数"，如果提交的内容和库里一模一样
            # （例如重复点了一次保存），会返回 0，用它判断存在性会误报 404。
            cursor.execute("select id from study_record where id = %s for update", (id, ))
            if cursor.fetchone() is None:  # 【修改 11】`== None` 改成 `is None`
                raise HTTPException(status_code=404, detail="不存在该数据")
            cursor.execute("""
                        update study_record
                        set Subject=%s, Topic=%s, Date=%s, Duration_minutes=%s, Difficulty=%s, Plan_Comment=%s
                        where id = %s
                        """,
                        (data.Subject, data.Topic, data.Date, data.Duration_minutes, data.Difficulty, data.Plan_Comment, id))
        conn.commit()
    # 【修改 12】except 子句必须"从具体到宽泛"排列。
    # 原来写的是 `except Exception: raise` 再跟一个 `except:`，前者会把所有 Exception
    # 都拦下并原样抛出，后面的 rollback 分支永远执行不到（死代码）。现在按语义拆开。
    except HTTPException:
        rollback_quietly(conn)
        raise  # 404 等业务异常原样放行，不要包装成 500
    except Exception as error:
        rollback_quietly(conn)
        # 【修改 13】原来被注释掉的分支里写的是"删除失败"（从 del_data 复制粘贴留下的文案错误），
        # 而且把所有异常都映射成 404，会把"SQL 报错"误导成"数据不存在"。
        # 数据库异常统一按 500 返回。
        logging.exception("修改数据失败: id=%s", id)
        raise HTTPException(status_code=500, detail="修改数据失败") from error
    finally:
        conn.close()
    return {"message": "修改数据成功"}

@app.delete("/study/{id}")
def del_data(id: int):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("delete from study_record where id = %s", (id, ))
            # 这里用 rowcount 判断是可靠的：DELETE 的 rowcount 就是"真正删掉的行数"
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="不存在该数据")
        conn.commit()
    # 【修改 14】同上，业务异常（404）必须排在数据库异常前面。
    # 否则 404 会被后面的分支重新包装成 500，你写的 404 分支就白写了
    # ——原来被注释掉的那段 `except:` 正是这个隐患。
    except HTTPException:
        rollback_quietly(conn)
        raise
    except Exception as error:
        rollback_quietly(conn)
        logging.exception("删除数据失败: id=%s", id)
        raise HTTPException(status_code=500, detail="删除失败") from error
    finally:
        conn.close()
    # 【修改 15】统一响应结构，顺便把英文改成中文
    return {"message": "删除成功"}

@app.get("/study/subject/{subject}")
def get_same_subject(subject: str):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("select * from study_record where Subject = %s", (subject, ))
            data = cursor.fetchall()
    except Exception as error:
        logging.exception("查询记录失败")
        raise HTTPException(status_code=500, detail="查询数据失败") from error
    finally:
        conn.close()
    return data

@app.get("/study/date/{date}")
def get_same_date(date:datetime.date):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("select * from study_record where Date = %s", (date, ))
            data = cursor.fetchall()
    except Exception as error:
        logging.exception("查询数据失败")
        raise HTTPException(status_code=500, detail="查询数据失败") from error
    finally:
        conn.close()
    return data

@app.get("/study/topic/{topic}")
def get_same_topic(topic: str):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("select * from study_record where Topic = %s", (topic, ))
            data = cursor.fetchall()
    except Exception as error:
        logging.exception("查询数据失败")
        raise HTTPException(status_code=500, detail="查询数据失败") from error
    finally:
        conn.close()
    return data

@app.get("/study/stats/subjects")
def get_subject_stats(
    start_date: datetime.date | None = None,
    end_date: datetime.date | None = None
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="开始日期不得大于结束日期")
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            str = """
                SELECT
                    Subject AS subject,
                    SUM(Duration_minutes) AS total_minutes,
                    COUNT(*) AS record_count 
                FROM study_record 
                WHERE 1=1 
                """
            params = []
            if start_date is not None:
                str += " AND Date >= %s "
                params.append(start_date)
            if end_date is not None:
                str += " AND Date <= %s "
                params.append(end_date)
            str += " GROUP BY Subject ORDER BY total_minutes DESC "
            cursor.execute(str, params)
            data = cursor.fetchall()
    except Exception as error:
        logging.exception("查询学习统计失败")
        raise HTTPException(
            status_code=500,
            detail="查询学习统计失败"
        ) from error
    finally:
        conn.close()
    return data

@app.get("/study")
def get_record_list(
    subject:str | None = None,
    start_date:datetime.date | None = None,
    end_date:datetime.date | None = None,
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="开始日期不得大于结束日期")
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
                SELECT * 
                FROM study_record
                WHERE 1=1
                """
            params = []
            if subject is not None:
                sql += " AND Subject = %s "
                params.append(subject)
            if start_date is not None:
                sql += " AND Date >= %s "
                params.append(start_date)
            if end_date is not None:
                sql += " AND Date <= %s "
                params.append(end_date)
            sql += " ORDER BY Date DESC, id DESC"
            cursor.execute(sql, params)
            data = cursor.fetchall()
    except Exception as error:
        logging.exception("查询数据失败")
        raise HTTPException(status_code=500, detail="查询数据失败") from error
    finally:
        conn.close()
    return data


# 网页与接口共用当前服务，前端文件以 main.py 所在目录为基准查找。
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

frontend_dir = Path(__file__).resolve().parent / "frontend"
app.mount("/assets", StaticFiles(directory=frontend_dir), name="frontend")

@app.get("/", include_in_schema=False)
def learning_workspace():
    return FileResponse(frontend_dir / "index.html")
