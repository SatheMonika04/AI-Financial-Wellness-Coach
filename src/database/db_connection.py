from sqlalchemy import create_engine , text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=5,
    max_overflow=10,
)

try:
    with engine.connect() as connection:
        # Run a simple query to confirm the connection works
        result = connection.execute(text("SELECT current_user;"))
        print(f"Successfully connected! Current user: {result.scalar()}")
except Exception as e:
    print(f"Connection failed: {e}")

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)




