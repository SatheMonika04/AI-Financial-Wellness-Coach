from src.database.db_connection import engine
from src.database.models import Base


def initialize_database():
	Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
	initialize_database()
	print("Tables created successfully!")
