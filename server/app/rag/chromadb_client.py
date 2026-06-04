import chromadb
from app.core.config import settings

class ChromaDBClient:
    client = None
    collection = None

    @classmethod
    def initialize(cls):
        cls.client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)
        cls.collection = cls.client.get_or_create_collection(name="documents")

    @classmethod
    def get_collection(cls):
        if cls.collection is None:
            cls.initialize()
        return cls.collection

chroma_client = ChromaDBClient()
