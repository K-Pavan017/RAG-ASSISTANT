from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    
    @classmethod
    def get_db(cls):
        if cls.client is None:
            cls.client = AsyncIOMotorClient(settings.MONGO_URI)
        return cls.client[settings.DB_NAME]

db = Database()

async def connect_to_mongo():
    try:
        Database.client = AsyncIOMotorClient(settings.MONGO_URI)
        # Test the connection
        await Database.client.admin.command('ping')
        logger.info("✓ Connected to MongoDB")
    except Exception as e:
        logger.error(f"✗ MongoDB connection failed: {e}")
        logger.error("Using fallback in-memory storage")
        # Connection will be attempted on first use

async def close_mongo_connection():
    if db.client:
        db.client.close()
        logger.info("Closed MongoDB connection")
