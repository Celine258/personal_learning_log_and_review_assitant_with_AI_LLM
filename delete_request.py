import requests
delete = requests.delete(
    url="http://127.0.0.1:8000/study/1"
)
print(delete.status_code)
print(delete.json())