from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import PyJWTError
from app.core.config import settings
from app.models.user import UserInDB
from app.db.mongodb import db
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except PyJWTError:
        raise credentials_exception
        
    try:
        user_doc = await db.get_db()["users"].find_one({"email": email})
        if user_doc is None:
            raise credentials_exception
            
        user_doc["_id"] = str(user_doc["_id"])
        return UserInDB(**user_doc)
    except Exception as e:
        logger.error(f"Error fetching user from MongoDB: {e}")
        raise credentials_exception
