from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from app.api.deps import get_current_user
from app.models.user import UserInDB
from app.rag.qa_chain import ask_question
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

class Citation(BaseModel):
    source: str
    content: str

class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]

@router.post("/", response_model=ChatResponse)
async def chat_with_docs(
    request: ChatRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    logger.info(f"Chat request from user {current_user.id}: {request.message[:50]}...")
    try:
        result = await ask_question(request.message, current_user.id)
        logger.info(f"Chat response ready with {len(result['citations'])} citations")
        return ChatResponse(
            answer=result["answer"],
            citations=[Citation(**c) for c in result["citations"]]
        )
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise
