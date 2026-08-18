from src.database.crud import (
    create_user,
    get_user_by_email
)

from src.auth.password import (
    hash_password
)
from src.database.crud import get_user_by_email
from src.auth.password import verify_password


#-------------------------------------------------------
# SIGN UP 
#-------------------------------------------------------
def signup(
        username , 
        email , 
        password
):
    
    existing_user = get_user_by_email(email)

    if existing_user:
        raise ValueError(
            "Email already registered"
        )
    
    hashed_password = hash_password(
        password
    )

    user = create_user(
        username=username,
        email=email,
        password_hash=hashed_password
    )

    return user


#------------------------------------------------------------
#   LOG IN SETUP 
#-----------------------------------------------------------

def login(email,password):

    user = get_user_by_email(email)

    if not user :
        raise ValueError(
            'User not found'
        )

    if not verify_password(
        password , 
        user.password_hash
    ):
        raise ValueError(
            'Invalid Password'
        )
    
    return user

