from src.database.db_connection import engine
from src.database.models import Base

Base.metadata.create_all(bind=engine)

print("Tables created successfully!")
