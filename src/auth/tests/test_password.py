from src.auth.password import (
    hash_password,
    verify_password
)

password = "Pratham12"

hashed = hash_password(password)

print("Original:", password)
print("Hash:", hashed)

print(
    verify_password(
        password,
        hashed
    )
)