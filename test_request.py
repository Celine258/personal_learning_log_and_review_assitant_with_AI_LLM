import requests
def print_response(response):
    print(response.status_code)
    try:
        print(response.json())
    except requests.exceptions.JSONDecodeError:
        print(response.text)

def get_request(id):
    get = requests.get(
    url=f"http://127.0.0.1:8000/study/{id}",
    timeout=10
    )
    print_response(get)

def get_request_all():
    get = requests.get(
    url=f"http://127.0.0.1:8000/study",
    timeout=10
    )
    print_response(get)

def post_request():
    Subject = input("Subject:")
    Topic = input("Topic:")
    Date = input("Date (YYYY-MM-DD):")
    Duration_minutes = input("Time:")
    Difficulty = input("Difficulty:")
    Plan_Comment = input("Idea:")
    post = requests.post(
        url="http://127.0.0.1:8000/study",
        timeout=10,
        # json= {
        #     "Subject":"Computer",
        #     "Topic":"FastAPI",
        #     "Date":"2026-9-20",
        #     "Durarion_minutes":60,
        #     "Difficulty":"nothing",
        #     "Plan_Comment":"Nothing"
        json={
            "Subject":Subject,
            "Topic":Topic,
            "Date":Date,
            "Duration_minutes":Duration_minutes,
            "Difficulty":Difficulty,
            "Plan_Comment":Plan_Comment
        }
    )
    print_response(post)

def update_request(id:int):
    
    Subject = input("Subject:")
    Topic = input("Topic:")
    Date = input("Date (YYYY-MM-DD):")
    Duration_minutes = input("Time:")
    Difficulty = input("Difficulty:")
    Plan_Comment = input("Idea:")
    update = requests.put(
        url= f"http://127.0.0.1:8000/study/{id}",
        timeout=10,
        json={
            "Subject":Subject,
            "Topic":Topic,
            "Date":Date,
            "Duration_minutes":Duration_minutes,
            "Difficulty":Difficulty,
            "Plan_Comment":Plan_Comment
        }
    )
    print_response(update)

def delete_request(id:int):
    delete = requests.delete(
        url=f"http://127.0.0.1:8000/study/{id}",
        timeout=10
    )
    print_response(delete)

if __name__ == "__main__":
    post_request()