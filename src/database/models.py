from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, DateTime , ForeignKey , Index
from datetime import datetime
from sqlalchemy.orm import relationship
from sqlalchemy import Float , Text
import uuid


class Base(DeclarativeBase):
    pass


# User Table
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)



