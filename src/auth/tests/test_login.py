from src.auth.auth_service import login

user = login(
    email="f46fa871-1449-4794-bbb8-61ca8d3d3768@gmail.com",
    password="Pratham123"
)

print("Login Successful")
print(user.id)
print(user.username)
print(user.email)

user = login(
    email="f46fa871-1449-4794-bbb8-61ca8d3d3768@gmail.com",
    password="WrongPassword"
)

print("Login Successful")
print(user.id)
print(user.username)
print(user.email)

user = login(
    email="notfound@gmail.com",
    password="Pratham123"
)

print("Login Successful")
print(user.id)
print(user.username)
print(user.email)