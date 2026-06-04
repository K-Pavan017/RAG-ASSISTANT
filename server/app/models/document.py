from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class DocumentBase(BaseModel):
    filename: str
    file_size: int
    content_type: str

class DocumentInDB(DocumentBase):
    id: str = Field(alias="_id")
    user_id: str
    upload_date: str
    status: str = "processing"
    error_message: Optional[str] = None
    processed_at: Optional[str] = None
    
    model_config = ConfigDict(populate_by_name=True)
    
class DocumentResponse(DocumentBase):
    id: str = Field(alias="_id")
    user_id: str
    upload_date: str
    status: str
    error_message: Optional[str] = None
    processed_at: Optional[str] = None
    
    model_config = ConfigDict(populate_by_name=True, extra='allow')
