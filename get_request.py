import requests
get = requests.get(
    url="http://127.0.0.1:8000/study/1"
)
print(get.status_code)
print(get.json())