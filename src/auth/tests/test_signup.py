from uuid import uuid4

from src.auth.auth_service import signup

email = f"{uuid4()}@gmail.com"

user = signup(
    username="Pratham",
    email=email,
    password="Pratham123"
)

print(user.id)
print(user.email)
print("Signup Successful")