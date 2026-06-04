import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load environment variables from .env file
load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Knowledge Assistant"
    API_V1_STR: str = "/api/v1"
    
    # MongoDB - MUST be set via environment variable (no default)
    MONGO_URI: str = os.getenv("MONGO_URI", "")
    DB_NAME: str = "knowledge_assistant"
    
    # JWT - MUST be set via environment variable (no default)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # ChromaDB
    CHROMA_DB_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "chroma_data")
    
    class Config:
        case_sensitive = True

settings = Settings()
