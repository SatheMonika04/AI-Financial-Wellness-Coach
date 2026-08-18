import json

from src.database.db_connection import SessionLocal, engine
from src.database.models import (
    Base,
    
    User,
    
)
from sqlalchemy.orm import joinedload


#-------------------------------------------------------
# CREATE USER FUNCTION
#-------------------------------------------------------
def create_user(username, email, password_hash):
    session = SessionLocal()

    try:
        user = User(
            username=username,
            email=email,
            password_hash=password_hash
        )

        session.add(user)
        session.commit()
        session.refresh(user)

        return user

    except Exception:
        session.rollback()
        raise

    finally:
        session.close()


#----------------------------------------------------------
# GET USER BY EMAIL
#----------------------------------------------------------
def get_user_by_email(email):
    session = SessionLocal()

    try:
        user = session.query(User).filter(
            User.email == email
        ).first()

        return user
    
    finally:
        session.close()



    
            