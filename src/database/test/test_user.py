from src.database.crud import create_user
from src.database.crud import get_user_by_email


user = create_user(
    username="Pratham",
    email="pratham@gmail.com",
    password_hash="test123"
)

print('User Created')


user = get_user_by_email("pratham@gmail.com")

print(user.username)
print(user.email)
