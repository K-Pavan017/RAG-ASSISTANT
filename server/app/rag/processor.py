import io
import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from app.rag.chromadb_client import chroma_client
import uuid
import logging

logger = logging.getLogger(__name__)

# Initialize embeddings locally
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    return text

async def process_and_store_document(file_bytes: bytes, filename: str, doc_id: str, user_id: str):
    logger.info(f"\n>>> PDF Processing: Doc ID {doc_id}, File: {filename}")
    
    try:
        # 1. Extract text
        logger.info("Step 1: Extracting text from PDF...")
        text = extract_text_from_pdf(file_bytes)
        if not text or len(text.strip()) == 0:
            raise ValueError("PDF has no text content")
        logger.info(f"✓ Extracted {len(text)} characters")
        
        # 2. Chunk text
        logger.info("Step 2: Chunking text...")
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        chunks = text_splitter.split_text(text)
        if not chunks:
            raise ValueError("Failed to create chunks from PDF")
        logger.info(f"✓ Created {len(chunks)} chunks")
        
        # 3. Generate embeddings
        logger.info(f"Step 3: Generating embeddings for {len(chunks)} chunks...")
        embedded_docs = embeddings.embed_documents(chunks)
        logger.info(f"✓ Generated {len(embedded_docs)} embeddings")
        
        # 4. Store in Chroma
        logger.info("Step 4: Storing in Chroma...")
        collection = chroma_client.get_collection()
        
        ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "source": filename,
                "doc_id": doc_id,
                "user_id": user_id,
                "chunk_index": i
            }
            for i in range(len(chunks))
        ]
        
        collection.add(
            ids=ids,
            embeddings=embedded_docs,
            documents=chunks,
            metadatas=metadatas
        )
        logger.info(f"✓ Stored {len(ids)} chunks in Chroma (User: {user_id})")
        logger.info(f"✓✓✓ PDF Processing Complete (Doc ID: {doc_id}) ✓✓✓\n")
        
    except Exception as e:
        logger.error(f"✗ Processing error: {str(e)}", exc_info=True)
        raise
