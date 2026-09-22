# 知时 · 个人学习记录和复盘助手

一个基于 FastAPI、MySQL 和 DeepSeek API 的个人学习助手。通过网页记录学习内容、查看学习投入，并生成和保存 AI 复盘。

## 功能

- 学习记录：新增、修改、删除，记录科目、内容、日期、时长、困难和后续计划。
- 条件查询：按科目和日期范围筛选学习记录。
- 学习统计：查看各科学习时长、记录数和图表。
- AI 复盘：根据指定日期范围的学习记录生成回顾与建议。
- 复盘历史：查看历史列表、打开详情、删除历史复盘。
- 简洁工作台界面，适配电脑和手机屏幕。

当前版本面向本地个人使用，尚未实现账号登录和多用户数据隔离。

## 技术组成

- 后端：Python、FastAPI、Pydantic
- 数据库：MySQL、PyMySQL
- 模型调用：requests + DeepSeek API
- 前端：HTML、CSS、原生 JavaScript，由 FastAPI 提供静态资源

## 本地运行

### 1. 安装依赖

需要 Python 3.10 或以上版本，以及已启动的 MySQL 服务。在项目目录打开 PowerShell：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install "fastapi[standard]" pymysql requests
```

以下命令直接使用虚拟环境中的程序，不要求先执行激活脚本。

### 2. 初始化数据库

当前 `data_base.py` 连接本机 `localhost:3306`，默认数据库名为 `test`。

下面是在空数据库中使用的建表参考，与当前接口字段对应；已有表时请先核对结构，不要删除现有数据。`IF NOT EXISTS` 不会自动更新已有表的结构。

```sql
CREATE DATABASE IF NOT EXISTS test CHARACTER SET utf8mb4;
USE test;

CREATE TABLE IF NOT EXISTS study_record (
    id INT PRIMARY KEY AUTO_INCREMENT,
    Subject VARCHAR(100) NOT NULL,
    Topic VARCHAR(100) NOT NULL,
    Date DATE NOT NULL,
    Duration_minutes INT NOT NULL,
    Difficulty VARCHAR(1000) NOT NULL DEFAULT '',
    Plan_Comment VARCHAR(1000) NOT NULL DEFAULT ''
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS review_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    start_date DATE,
    end_date DATE,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;
```

复盘的起止日期允许为空，代表没有指定对应边界。`created_at` 在插入时自动记录数据库当前日期和时间。

### 3. 设置环境变量（必须）

启动服务前，在同一个 PowerShell 窗口设置以下三个变量，替换示例值：

```powershell
$env:User = "你的MySQL用户名"
$env:Passwd = "你的MySQL密码"
${env:API-Key} = "你的DeepSeek API密钥"
```

| 环境变量 | 用途 |
| --- | --- |
| `User` | MySQL 用户名 |
| `Passwd` | MySQL 密码 |
| `API-Key` | DeepSeek API 密钥，变量名中的连字符需要保留 |

这些设置仅对当前窗口及其启动的进程有效。打开新窗口后需要重新设置。`API-Key` 使用 `${env:API-Key}` 写法，避免 PowerShell 对连字符的解析问题。

当前代码在导入 `deepseek.py` 时就读取 `API-Key`，因此即使只使用学习记录功能，启动前也需要配置它。实际生成复盘还需要有效密钥、可用额度及网络连接。

当前代码没有自动读取 `.env` 文件的逻辑，仅创建 `.env` 文件不会完成配置。不要把真实密码或密钥写进源码、README、测试脚本或提交到 GitHub。

### 4. 核对本地路径

当前 `main.py` 中仍有两个绝对路径：

- 日志文件：`D:/Work/个人学习记录和复盘助手/main.log`
- 复盘提示词：`D:/Work/个人学习记录和复盘助手/personality.txt`

如果把项目放在其他目录，需要将这两个路径改为实际位置，并确保日志目录存在且可写。前端目录已按 `main.py` 所在目录定位。

### 5. 启动服务

在包含 `main.py` 的项目目录中执行：

```powershell
.\.venv\Scripts\fastapi.exe dev main.py
```

- 学习工作台：<http://127.0.0.1:8000/>
- AI 复盘：<http://127.0.0.1:8000/#review>
- 接口调试文档：<http://127.0.0.1:8000/docs>

前端与接口使用同一个服务，无需单独启动前端。界面修改后若仍显示旧内容，可以按 `Ctrl + F5` 强制刷新。`dev` 为本地开发启动方式。

## 使用流程

1. 在「学习记录」中新增一条记录。
2. 在「学习概览」查看时长和科目统计，尝试日期筛选。
3. 在「AI 复盘」中选择日期范围，或留空使用全部记录，再点击生成。
4. 生成成功后，在页面下方的历史列表查看已保存的复盘。
5. 刷新网页后重新打开历史详情，确认数据已持久保存；不需要的复盘可以通过删除按钮移除。

生成复盘会调用模型 API；查看历史和刷新列表只读取数据库，不会重新生成。没有符合条件的学习记录时不会生成复盘。AI 建议需要结合实际掌握情况判断。

## 主要接口

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| GET | `/study` | 学习记录列表，可传 `subject`、`start_date`、`end_date` |
| POST | `/study` | 新增学习记录 |
| GET | `/study/{id}` | 查看单条学习记录 |
| PUT | `/study/{id}` | 修改学习记录 |
| DELETE | `/study/{id}` | 删除学习记录 |
| GET | `/study/stats/subjects` | 各科时长和记录数，可传起止日期 |
| GET | `/study/subject/{subject}` | 按科目查询 |
| GET | `/study/date/{date}` | 按日期查询 |
| GET | `/study/topic/{topic}` | 按学习内容查询 |
| POST | `/study/review` | 生成并保存复盘，可传起止日期 |
| GET | `/study/review/all` | 查看复盘历史列表 |
| GET | `/study/review/{id}` | 查看某次复盘 |
| DELETE | `/study/review/delete/{id}` | 删除某次复盘 |

日期参数格式为 `YYYY-MM-DD`。起止日期可以只填一个，也可以都不填；同时填写时，开始日期不得晚于结束日期。例如：

```text
GET /study?subject=computer&start_date=2026-09-01&end_date=2026-09-30
POST /study/review?start_date=2026-09-01&end_date=2026-09-30
```

新增和修改学习记录的 JSON 示例（字段名区分大小写）：

```json
{
  "Subject": "Python",
  "Topic": "FastAPI 接口练习",
  "Date": "2026-09-22",
  "Duration_minutes": 60,
  "Difficulty": "异常处理还不熟练",
  "Plan_Comment": "补充不存在记录的查询测试"
}
```

浏览器地址栏用于访问 GET 接口；POST、PUT、DELETE 可通过网页按钮、`/docs` 或请求脚本调用。

## 文件说明

```text
main.py           接口、数据校验、网页入口和日志
data_base.py      数据库连接
deepseek.py       模型 API 请求
personality.txt   学习助手的复盘提示词
frontend/
  index.html     网页结构
  app.js         网页交互及接口调用
  style.css      页面样式
  favicon.svg    网站图标
```

## 常见问题

- **启动时提示缺少 `API-Key`**：检查当前窗口是否已设置环境变量，并从该窗口启动服务。
- **数据库连接失败**：检查 MySQL 服务、`User`、`Passwd`、数据库名及表结构。
- **接口返回 500**：查看本地 `main.log` 中的异常原因；模型调用问题还可查看服务终端输出。不要公开包含敏感信息的日志。
- **AI 复盘失败**：检查密钥、额度、网络及 `deepseek.py` 中配置的模型是否对当前账号可用。
- **返回 422**：核对参数名、日期格式、整数参数和请求 JSON；注意路径参数与查询参数的区别。

## 密钥与数据

`.gitignore` 已忽略 `.env`、日志和虚拟环境，但忽略规则不会清除已经提交过的内容。真实密钥如曾上传到 GitHub，应先在提供商后台撤销并更换，再清理 Git 历史；只删除文件或最新版本中的密钥不够。

当前项目适合本地自用。对外部署前，需要补充身份验证和数据隔离，避免学习记录和复盘被他人访问。

