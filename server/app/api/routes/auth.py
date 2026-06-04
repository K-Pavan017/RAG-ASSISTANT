import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.models.user import UserCreate, UserResponse, Token
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.db.mongodb import db
from datetime import timedelta
import datetime

# In-memory fallback store (used if MongoDB connection fails)
USERS_FALLBACK: dict = {}

router = APIRouter()

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate):
    try:
        # Try MongoDB first
        existing_user = await db.get_db()["users"].find_one({"email": user_in.email})
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="The user with this email already exists in the system.",
            )
        user_dict = user_in.dict()
        user_dict["hashed_password"] = get_password_hash(user_dict.pop("password"))
        result = await db.get_db()["users"].insert_one(user_dict)
        created_user = await db.get_db()["users"].find_one({"_id": result.inserted_id})
        created_user["_id"] = str(created_user["_id"])
        # Remove hashed_password before returning response
        created_user.pop("hashed_password", None)
        return UserResponse(**created_user)
    except HTTPException:
        # Re-raise HTTP exceptions (like duplicate user)
        raise
    except Exception as e:
        logging.error(f"MongoDB register error: {e}")
        # Fallback to in-memory store
        if user_in.email in USERS_FALLBACK:
            raise HTTPException(status_code=400, detail="The user with this email already exists in the system.")
        USERS_FALLBACK[user_in.email] = {
            "email": user_in.email,
            "full_name": user_in.full_name,
            "hashed_password": get_password_hash(user_in.password),
            "_id": "fallback-" + user_in.email,
        }
        return UserResponse(**{"_id": USERS_FALLBACK[user_in.email]["_id"], "email": user_in.email, "full_name": user_in.full_name})

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Try MongoDB first
    try:
        user = await db.get_db()["users"].find_one({"email": form_data.username})
    except Exception:
        user = None
        
    if not user:
        # Fallback check in-memory store
        user = USERS_FALLBACK.get(form_data.username)
        
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user["email"], expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
