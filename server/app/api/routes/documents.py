from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from app.api.deps import get_current_user
from app.models.user import UserInDB
from app.models.document import DocumentResponse, DocumentBase
from app.db.mongodb import db
from app.rag.processor import process_and_store_document
from app.rag.chromadb_client import chroma_client
from typing import List
from datetime import datetime
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_user)
):
    """Upload a PDF document for RAG processing"""
    try:
        logger.info(f"\n=== UPLOAD REQUEST === User: {current_user.id}, File: {file.filename}")
        
        # Validate file type
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Read file
        logger.info("Reading file content...")
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="File is empty")
        logger.info(f"✓ File read: {len(content)} bytes")
        
        # Create document record
        doc = {
            "filename": file.filename,
            "file_size": len(content),
            "content_type": file.content_type or "application/pdf",
            "user_id": current_user.id,
            "upload_date": datetime.utcnow().isoformat(),
            "status": "processing"
        }
        
        # Insert to MongoDB
        logger.info("Saving to MongoDB...")
        result = await db.get_db()["documents"].insert_one(doc)
        doc_id = str(result.inserted_id)
        logger.info(f"✓ MongoDB: Document created with ID {doc_id}")
        
        # Queue background processing
        logger.info("Queueing background processing...")
        background_tasks.add_task(
            process_document_task, 
            content, file.filename, doc_id, current_user.id
        )
        logger.info(f"✓ Background task queued")
        
        # Return response
        created_doc = await db.get_db()["documents"].find_one({"_id": result.inserted_id})
        # Rename _id to id for response
        created_doc["id"] = str(created_doc.pop("_id"))
        # Ensure dates are ISO format strings
        if isinstance(created_doc.get("upload_date"), datetime):
            created_doc["upload_date"] = created_doc["upload_date"].isoformat()
        logger.info(f"=== UPLOAD SUCCESS (ID: {doc_id}) ===\n")
        return DocumentResponse(**created_doc)
        
    except HTTPException as e:
        logger.error(f"HTTP Exception: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"✗ UPLOAD FAILED: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

async def process_document_task(content: bytes, filename: str, doc_id: str, user_id: str):
    """Background task to process and store document in Chroma"""
    try:
        logger.info(f"\n=== BACKGROUND PROCESSING START === Doc ID: {doc_id}, User ID: {user_id}")
        await process_and_store_document(content, filename, doc_id, user_id)
        logger.info(f"✓ Document processing complete - Doc ID: {doc_id}")
        await db.get_db()["documents"].update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {"status": "completed", "processed_at": datetime.utcnow().isoformat()}}
        )
        logger.info(f"✓ Status updated to 'completed' for doc {doc_id}\n")
    except Exception as e:
        logger.error(f"✗ Background processing error: {e}", exc_info=True)
        try:
            await db.get_db()["documents"].update_one(
                {"_id": ObjectId(doc_id)},
                {"$set": {"status": "error", "error_message": str(e), "error_at": datetime.utcnow().isoformat()}}
            )
        except Exception as update_err:
            logger.error(f"Failed to update document status: {update_err}")

@router.get("/", response_model=List[DocumentResponse])
async def list_documents(current_user: UserInDB = Depends(get_current_user)):
    """List all documents for current user (optimized for frequent polling)"""
    try:
        docs_cursor = db.get_db()["documents"].find({"user_id": current_user.id}).sort("upload_date", -1)
        docs = await docs_cursor.to_list(length=100)
        
        response = []
        for doc in docs:
            # Convert MongoDB _id to id
            doc["id"] = str(doc.pop("_id"))
            # Convert datetime fields to ISO format strings
            if isinstance(doc.get("upload_date"), datetime):
                doc["upload_date"] = doc["upload_date"].isoformat()
            if isinstance(doc.get("processed_at"), datetime):
                doc["processed_at"] = doc["processed_at"].isoformat()
            response.append(DocumentResponse(**doc))
        return response
    except Exception as e:
        logger.error(f"Error listing documents: {e}", exc_info=True)
        return []

@router.get("/debug", response_model=dict)
async def debug_documents(current_user: UserInDB = Depends(get_current_user)):
    """Debug endpoint to check documents for current user"""
    try:
        # Check MongoDB
        mongo_docs = await db.get_db()["documents"].find({"user_id": current_user.id}).to_list(length=100)
        
        # Check Chroma
        collection = chroma_client.get_collection()
        chroma_results = collection.get(where={"user_id": current_user.id})
        
        return {
            "user_id": current_user.id,
            "mongodb_documents": len(mongo_docs),
            "mongodb_doc_ids": [str(doc["_id"]) for doc in mongo_docs],
            "mongodb_statuses": [doc.get("status") for doc in mongo_docs],
            "chroma_chunks": len(chroma_results.get("ids", [])) if chroma_results else 0,
            "chroma_chunk_ids": chroma_results.get("ids", []) if chroma_results else [],
            "mongo_full": [{"id": str(doc["_id"]), "filename": doc.get("filename"), "status": doc.get("status")} for doc in mongo_docs]
        }
    except Exception as e:
        logger.error(f"Debug error: {e}", exc_info=True)
        return {"error": str(e)}
