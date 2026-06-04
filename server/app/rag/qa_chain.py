from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from app.rag.chromadb_client import chroma_client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
llm = ChatOllama(
    model="llama3.2",
    temperature=0
)
prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are a professional AI Knowledge Assistant for a company. Answer the user's question based ONLY on the provided context. If you cannot find the answer in the context, say 'I cannot find the answer in the provided documents.'\n\nContext:\n{context}"),
    ("user", "{question}")
])

async def ask_question(question: str, user_id: str):
    logger.info(f"\n=== CHAT QUERY === User: {user_id}, Question: {question[:50]}...")
    
    try:
        collection = chroma_client.get_collection()
        
        # embed the query
        logger.info("Step 1: Embedding query...")
        query_embedding = embeddings.embed_query(question)
        logger.info(f"✓ Query embedded")
        
        # retrieve relevant chunks for this user
        logger.info(f"Step 2: Searching Chroma for user {user_id}...")
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=5,
            where={"user_id": user_id}
        )
        
        docs_found = len(results.get('documents', [[]])[0]) if results.get('documents') else 0
        logger.info(f"✓ Chroma query complete - Found {docs_found} relevant documents")
        
        if not results['documents'] or not results['documents'][0]:
            logger.warning(f"✗ No documents found for user {user_id}")
            return {"answer": "No relevant documents found.", "citations": []}
        
        documents = results['documents'][0]
        metadatas = results['metadatas'][0]
        
        context = "\n\n---\n\n".join(documents)
        
        # generate response
        logger.info(f"Step 3: Generating LLM response using {len(documents)} documents...")
        chain = prompt_template | llm
        response = chain.invoke({"context": context, "question": question})
        logger.info(f"✓ LLM response generated")
        
        citations = [{"source": meta.get("source"), "content": doc} for doc, meta in zip(documents, metadatas)]
        
        logger.info(f"=== CHAT COMPLETE ===\n")
        return {
            "answer": response.content,
            "citations": citations
        }
    except Exception as e:
        logger.error(f"✗ Chat error: {str(e)}", exc_info=True)
        return {"answer": f"Error: {str(e)}", "citations": []}
