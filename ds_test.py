import requests

response = requests.post(
    "http://127.0.0.1:8000/study/review",
    params={
        "start_date": "2026-09-01",
        "end_date": "2026-09-22"
    },
    timeout=90
)

print(response.status_code)
print(response.text)