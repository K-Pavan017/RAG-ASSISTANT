from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from app.api.deps import get_current_user
from app.models.user import UserInDB
from app.models.chat import ChatMessage
from app.models.session import ChatSession
from app.db.mongodb import db
from app.rag.qa_chain import ask_question
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    session_id: str

class Citation(BaseModel):
    source: str
    content: str

class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]

@router.get("/sessions")
async def get_sessions(current_user: UserInDB = Depends(get_current_user)):
    try:
        cursor = db.get_db().chat_sessions.find({"user_id": current_user.id}).sort("updated_at", -1)
        sessions = await cursor.to_list(length=100)
        return [{"id": str(s["_id"]), "title": s["title"], "updated_at": s.get("updated_at")} for s in sessions]
    except Exception as e:
        logger.error(f"Error fetching sessions: {e}")
        return []

@router.post("/sessions")
async def create_session(current_user: UserInDB = Depends(get_current_user)):
    try:
        new_session = ChatSession(user_id=current_user.id, title="New Chat")
        result = await db.get_db().chat_sessions.insert_one(new_session.model_dump(by_alias=True, exclude={"id"}))
        return {"id": str(result.inserted_id), "title": "New Chat"}
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create session")

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: UserInDB = Depends(get_current_user)):
    try:
        # Delete session
        await db.get_db().chat_sessions.delete_one({"_id": ObjectId(session_id), "user_id": current_user.id})
        # Delete associated messages
        await db.get_db().chat_history.delete_many({"session_id": session_id, "user_id": current_user.id})
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete session")

@router.get("/{session_id}")
async def get_chat_history(session_id: str, current_user: UserInDB = Depends(get_current_user)):
    try:
        cursor = db.get_db().chat_history.find({"user_id": current_user.id, "session_id": session_id}).sort("timestamp", -1).limit(50)
        messages = await cursor.to_list(length=50)
        return [{"id": str(msg["_id"]), "role": msg["role"], "content": msg["content"], "citations": msg.get("citations", []), "timestamp": msg.get("timestamp")} for msg in reversed(messages)]
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        return []

@router.post("/", response_model=ChatResponse)
async def chat_with_docs(
    request: ChatRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    logger.info(f"Chat request from user {current_user.id} in session {request.session_id}: {request.message[:50]}...")
    try:
        # Update session title if it's "New Chat"
        session = await db.get_db().chat_sessions.find_one({"_id": ObjectId(request.session_id)})
        if session and session.get("title") == "New Chat":
            new_title = request.message[:30] + "..." if len(request.message) > 30 else request.message
            await db.get_db().chat_sessions.update_one(
                {"_id": ObjectId(request.session_id)},
                {"$set": {"title": new_title}}
            )

        # Save user message
        user_msg = ChatMessage(session_id=request.session_id, user_id=current_user.id, role="user", content=request.message)
        await db.get_db().chat_history.insert_one(user_msg.model_dump(by_alias=True, exclude={"id"}))

        result = await ask_question(request.message, current_user.id)
        logger.info(f"Chat response ready with {len(result['citations'])} citations")
        
        # Save assistant message
        citations_data = [Citation(**c).model_dump() for c in result["citations"]]
        assistant_msg = ChatMessage(session_id=request.session_id, user_id=current_user.id, role="assistant", content=result["answer"], citations=citations_data)
        await db.get_db().chat_history.insert_one(assistant_msg.model_dump(by_alias=True, exclude={"id"}))

        # Update session updated_at
        from datetime import datetime
        await db.get_db().chat_sessions.update_one(
            {"_id": ObjectId(request.session_id)},
            {"$set": {"updated_at": datetime.utcnow()}}
        )

        return ChatResponse(
            answer=result["answer"],
            citations=result["citations"]
        )
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise
