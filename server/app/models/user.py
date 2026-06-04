from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    id: str = Field(alias="_id")
    hashed_password: str

class UserResponse(UserBase):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
