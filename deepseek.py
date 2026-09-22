import requests
def deepseek_api(msg):
    try:
        response = requests.post(
            url= "https://api.deepseek.com/chat/completions",
            headers= {
                "Authorization": "Bearer <API-Key>",
                "Content-Type" : "application/json"
            },
            json={
                "model": "deepseek-flash",
                "messages": msg,
                "stream": False,
            },
            timeout=60,
        )
        response.raise_for_status()
    except requests.exceptions.Timeout:
        print("Timeout")
        raise
    except requests.exceptions.ConnectionError:
        print("check WIFI")
        raise
    except requests.exceptions.HTTPError:
        print("错误码：", response.status_code)
        print("错误信息：", response.text)
        raise
    data = response.json()
    return data["choices"][0]["message"]["content"]