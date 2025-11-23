import requests

BASE_URL = 'http://127.0.0.1:5000/api'

def test_register():
    print("Testing Register...")
    response = requests.post(f'{BASE_URL}/auth/register', json={
        'username': 'testuser_script',
        'password': 'password123'
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    return response.status_code == 201 or response.status_code == 400 # 400 if already exists

def test_login():
    print("\nTesting Login...")
    response = requests.post(f'{BASE_URL}/auth/login', json={
        'username': 'testuser_script',
        'password': 'password123'
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    if response.status_code == 200:
        return response.json()['access_token']
    return None

if __name__ == '__main__':
    if test_register():
        token = test_login()
        if token:
            print("\nLogin Successful! Token received.")
        else:
            print("\nLogin Failed.")
    else:
        print("\nRegister Failed.")
