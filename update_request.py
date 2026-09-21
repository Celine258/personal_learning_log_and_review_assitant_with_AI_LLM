import requests
update = requests.put(
    url="http://127.0.0.1:8000/study/1",
    json={
        "Subject":"Computer",
        "Topic":"Python",
        "Date":"2026-09-20",
        "Duration_minutes":60,
        "Difficulty":"nothing",
        "Plan_Comment":"Nothing"
    }
)
print(update.status_code)
print(update.json())