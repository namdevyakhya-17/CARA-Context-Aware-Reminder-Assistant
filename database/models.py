from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base
Base = declarative_base()

class Reminder(Base):
    __tablename__ = "reminders"
    id = Column(Integer,primary_key=True)
    task = Column(String)
    date = Column(String)
    time = Column(String)
    priority = Column(String)
