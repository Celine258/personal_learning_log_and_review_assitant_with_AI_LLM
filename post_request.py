import requests
post = requests.post(
    url="http://127.0.0.1:8000/study",
    json= {
        "Subject":"Computer",
        "Topic":"FastAPI",
        "Date":"2026-09-20",
        "Duration_minutes":60,
        "Difficulty":"nothing",
        "Plan_Comment":"Nothing"
    }
)
print(post.status_code)
print(post.json())