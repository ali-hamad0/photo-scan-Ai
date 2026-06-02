# PathoScan AI — RAG Chatbot System

Complete guide to the Retrieval-Augmented Generation (RAG) chatbot system.

## Overview

The PathoScan AI chatbot ("MedBot") uses **Retrieval-Augmented Generation** to answer medical questions with contextual knowledge from a local vector database.

```
User Question
    ↓
Question Condensation (if follow-up)
    ↓
Vector Search (MMR retrieval from Chroma)
    ↓
Prompt Template Selection
    ↓
LLM Generation (Groq API → LLaMA 3.3)
    ↓
Streaming Response (via SSE)
```

---

## Architecture

### Components

```
backend/rag/
├── agent.py              # Public API: ask(), ask_stream(), seed_history()
├── config.py             # Groq API configuration, constants
├── ingest.py             # CLI: ingest documents into vectorstore
├── prompts.py            # Prompt templates, CBC reference
└── services/
    ├── chain.py          # Core RAG pipeline
    ├── embeddings.py     # HuggingFace Sentence Transformers
    ├── ingest.py         # Document loading and processing
    ├── llm.py            # Groq LLM client (singleton)
    ├── memory.py         # In-memory chat history per session
    ├── retriever.py      # Chroma MMR wrapper
    └── vectorstore.py    # Chroma database singleton
```

### Data Flow

```
User Input
    ↓
[rag/agent.py] ask_stream()
    ├── seed_history() — Load chat history from DB
    ├── condense_question() — Rewrite follow-ups
    └── chain.stream() — RAG pipeline
        ├── [services/memory.py] Maintain conversation context
        ├── [services/retriever.py] MMR search in Chroma
        ├── [services/llm.py] Groq API streaming
        └── [prompts.py] Apply template + system instructions
            ↓
        Streaming tokens → SSE events → Frontend
```

---

## Knowledge Base Ingestion

### Supported Formats

1. **PDFs** — Documents automatically split into chunks
2. **CSVs** — Smart detection of:
   - Q&A pairs (question, answer columns)
   - Lab reference values (name, min, max columns)
   - Generic data (stored as rows)

### Ingestion Pipeline

**File: `backend/rag/services/ingest.py`**

```python
def ingest_documents():
    """
    1. Load documents from backend/rag/documents/
    2. Deduplicate by content hash
    3. Split into chunks (400 chars, 50 char overlap)
    4. Generate embeddings
    5. Store in Chroma vectorstore
    """
    documents = []
    
    # Load PDFs
    for pdf_file in glob('documents/*.pdf'):
        loader = PyPDFLoader(pdf_file)
        docs = loader.load()
        documents.extend(docs)
    
    # Load CSVs
    for csv_file in glob('documents/*.csv'):
        loader = CSVLoader(csv_file)
        docs = loader.load()
        documents.extend(docs)
    
    # Deduplicate
    seen = set()
    unique_docs = []
    for doc in documents:
        doc_hash = hashlib.md5(doc.page_content.encode()).hexdigest()
        if doc_hash not in seen:
            seen.add(doc_hash)
            unique_docs.append(doc)
    
    # Split into chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=400,
        chunk_overlap=50
    )
    chunks = splitter.split_documents(unique_docs)
    chunks = chunks[:3000]  # Cap at 3000 chunks
    
    # Generate embeddings and store
    embeddings = HuggingFaceEmbeddings(
        model_name='sentence-transformers/all-MiniLM-L6-v2'
    )
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory='./vectorstore'
    )
    
    return vectorstore
```

### Running Ingestion

```bash
# Place documents in backend/rag/documents/
mkdir -p backend/rag/documents

# Add your PDFs and CSVs
cp myfile.pdf backend/rag/documents/
cp labvalues.csv backend/rag/documents/

# Run ingestion
docker-compose exec backend python -m rag.ingest
```

---

## Retrieval Strategy

### MMR (Maximum Marginal Relevance)

Balances similarity and diversity to avoid repetitive results.

**Configuration:**
```python
retriever = vectorstore.as_retriever(
    search_type='mmr',
    search_kwargs={
        'k': 6,              # Return 6 documents
        'fetch_k': 20,       # Consider top 20 candidates
        'lambda_mult': 0.7   # 70% similarity, 30% diversity
    }
)
```

**How it works:**
1. Find initial k candidates using cosine similarity
2. For each candidate, penalize if too similar to already-selected docs
3. Select document with highest (similarity - diversity_penalty)
4. Repeat until k documents selected

**Example:**
```
User: "What does a low WBC count mean?"

Vector search finds:
- Doc 1: "WBC normal range: 4,500-11,000" (score: 0.95)
- Doc 2: "WBC low, causes and treatment" (score: 0.92)
- Doc 3: "WBC very similar to Doc 1" (score: 0.91)

MMR selection:
1. Pick Doc 1 (highest similarity: 0.95)
2. Pick Doc 2 (good similarity: 0.92, diverse from Doc 1)
3. Skip Doc 3 (too similar to Doc 1, despite 0.91 score)
4. Continue with next-best non-duplicate docs
```

---

## Question Condensation

### Why It Matters

Follow-up questions with pronouns need context:
- "It was in the pneumonia scan" → Unclear which scan
- "What about my chest X-ray?" → Clearer, but still pronouns

**Solution:** Rewrite follow-ups using chat history before retrieval.

### Algorithm

**File: `backend/rag/services/chain.py`**

```python
def condense_question(question, history):
    """Rewrite follow-up questions to be standalone."""
    
    pronouns = {'it', 'that', 'this', 'they', 'he', 'she', 'who'}
    
    if any(p in question.lower() for p in pronouns):
        # Question has pronouns → likely a follow-up
        condense_prompt = PromptTemplate(
            input_variables=['question', 'chat_history'],
            template="""
Given the chat history, rewrite the question to be a standalone question
that includes all necessary context from previous messages.

Chat History:
{chat_history}

Question to rewrite: {question}

Rewritten question:
"""
        )
        
        chain = condense_prompt | llm
        condensed = chain.invoke({
            'question': question,
            'chat_history': format_history(history)
        })
        return condensed
    else:
        # No pronouns → standalone question
        return question

# Example:
history = [
    {'role': 'user', 'content': 'I have a chest X-ray with pneumonia'},
    {'role': 'assistant', 'content': 'Pneumonia shows...'}
]
original = "What treatment should I get for it?"
condensed = "What treatment should I get for pneumonia found in my chest X-ray?"
```

---

## Prompt Templates

### Template Selection

The system chooses between two templates based on question keywords:

```python
LAB_KEYWORDS = [
    'wbc', 'rbc', 'hemoglobin', 'hematocrit', 'platelet',
    'glucose', 'sodium', 'potassium', 'calcium',
    'pneumonia', 'tumor', 'glioma', 'fracture', 'scan'
]

def should_use_lab_template(question):
    return any(kw in question.lower() for kw in LAB_KEYWORDS)
```

### Lab Template

**Used for:** Medical diagnostic and lab questions

**File: `backend/rag/prompts.py`**

```
You are MedBot, a medical knowledge assistant. You help users understand
medical terms, lab results, and diagnostic findings in simple, patient-friendly language.

IMPORTANT RULES:
1. Never diagnose. Use hedging: "may suggest", "could indicate", "might be"
2. Always recommend consulting a doctor for diagnosis
3. If urgency flags are triggered (Hgb < 7, WBC < 2 or > 30, etc), add ⚠️
4. Keep answers 2-3 sentences for simple questions, structured for complex

---CONTEXT---
{context}

---CBC REFERENCE TABLE---
(Full table with normal ranges for all lab values)

---QUESTION---
{question}

Answer:
```

### General Template

**Used for:** Greetings, general knowledge, non-medical chat

```
You are MedBot, a friendly medical knowledge assistant.

IMPORTANT:
1. Keep it conversational and simple
2. Be helpful but know your limits
3. Recommend professional consultation when needed

---CONTEXT---
{context}

---QUESTION---
{question}

Answer:
```

### Response Format Guidelines

**Simple questions:**
```
"A low WBC count is below 4,500 cells/µL and may suggest infection or bone marrow issues. 
Please consult your doctor for proper evaluation."
```

**Diagnostic questions:**
```
Overview: 
What the finding typically represents

What This May Indicate:
- Possible condition 1
- Possible condition 2

What To Watch For:
- Symptom 1
- Symptom 2

Recommended Next Step:
- Consult a specialist
- Additional testing
```

---

## Streaming Response

### Server-Sent Events (SSE)

Responses stream in real-time over SSE, allowing users to see tokens as they arrive.

**Backend: `backend/chat.py`**

```python
async def stream_response():
    """Stream chat response over SSE."""
    
    async def event_generator():
        # Inject scan context if provided
        if scan_id:
            scan = db.query(Scan).filter(Scan.scan_id == scan_id).first()
            yield json.dumps({
                'type': 'scan_context_active',
                'content': True
            })
        
        # Stream tokens from RAG
        async for token in rag.ask_stream(
            message=message,
            session_id=session_id,
            history=history
        ):
            if token.get('type') == 'token':
                yield json.dumps(token)
        
        # Send sources after completion
        sources = token.get('sources', [])
        if sources:
            yield json.dumps({
                'type': 'sources',
                'content': sources
            })
        
        # Signal completion
        yield json.dumps({'type': 'done'})
    
    return StreamingResponse(
        event_generator(),
        media_type='text/event-stream'
    )
```

**Frontend: `frontend/src/pages/Chat.js`**

```javascript
const response = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: userMessage,
    session_id: sessionId,
    history: chatHistory
  })
});

const reader = response.body.getReader();
let fullResponse = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = new TextDecoder().decode(value);
  const lines = text.split('data: ').filter(l => l.trim());
  
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      
      if (event.type === 'token') {
        fullResponse += event.content;
        setMessages(prev => [
          ...prev.slice(0, -1),
          { ...prev[prev.length - 1], content: fullResponse }
        ]);
      } else if (event.type === 'done') {
        reader.cancel();
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }
}
```

---

## Session Memory

### In-Memory Chat History

Each session maintains a conversation history in memory for fast retrieval:

**File: `backend/rag/services/memory.py`**

```python
class ChatMemory:
    """In-memory chat session storage."""
    
    def __init__(self):
        self.sessions = {}  # session_id → [messages]
    
    def load_session(self, session_id, db_messages):
        """Load session from database and store in memory."""
        self.sessions[session_id] = [
            {'role': m.role, 'content': m.content}
            for m in db_messages
        ]
    
    def add_message(self, session_id, role, content):
        """Add message to session."""
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        self.sessions[session_id].append({
            'role': role,
            'content': content
        })
    
    def get_history(self, session_id, max_messages=10):
        """Get recent messages for context."""
        if session_id not in self.sessions:
            return []
        return self.sessions[session_id][-max_messages:]
    
    def clear_session(self, session_id):
        """Clear in-memory history for a session."""
        self.sessions.pop(session_id, None)
```

**Lifecycle:**
1. User sends message to `/api/chat/stream`
2. Load session messages from DB
3. Load into in-memory memory
4. Use history for question condensation
5. Generate response
6. Save new messages back to DB
7. Keep in-memory cache for future requests
8. On session delete, clear in-memory

---

## Configuration

**File: `backend/rag/config.py`**

```python
# LLM Configuration
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')

# Retrieval Configuration
RETRIEVAL_K = 6                      # Number of documents to retrieve
RETRIEVAL_FETCH_K = 20               # Candidate pool size for MMR
RETRIEVAL_LAMBDA_MULT = 0.7          # Diversity weight in MMR

# Temperature (lower = more deterministic, better for medical)
LLM_TEMPERATURE = 0.2

# Retry and timeout
MAX_RETRIES = 3
TIMEOUT_SECONDS = 30

# Vectorstore paths
VECTORSTORE_PATH = './vectorstore'
DOCUMENTS_PATH = './documents'
MAX_CHUNKS = 3000

# Embeddings model
EMBEDDINGS_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
```

---

## Error Handling

### Common Issues

```python
# Issue 1: No documents in vectorstore
if vectorstore.similarity_search("test", k=1) == []:
    return {
        'error': 'No knowledge base loaded',
        'suggestion': 'Run `python -m rag.ingest` to load documents'
    }

# Issue 2: API timeout
try:
    response = llm.generate(...)
except TimeoutError:
    return {
        'error': 'API timeout',
        'message': 'Groq API not responding. Please try again.'
    }

# Issue 3: Invalid API key
try:
    llm.predict(...)
except AuthenticationError:
    return {
        'error': 'Invalid API key',
        'message': 'Groq API key not configured properly'
    }
```

---

## Troubleshooting

### Chat not responding

**Check:**
```bash
# 1. Vectorstore loaded?
docker-compose exec backend python -c \
  "from rag.services.vectorstore import get_vectorstore; print(get_vectorstore())"

# 2. Groq API key valid?
curl -H "Authorization: Bearer $GROQ_API_KEY" \
  https://api.groq.com/openai/v1/models

# 3. Documents ingested?
ls -la backend/rag/vectorstore/
```

### Slow responses

```bash
# 1. Check LLM latency
docker-compose logs backend | grep "completion.*ms"

# 2. Reduce retrieval candidates
RETRIEVAL_K=3  # Lower from 6

# 3. Use faster model
GROQ_MODEL=llama-2-70b-chat  # Check available models
```

### Bad answers

```python
# 1. Check retrieved documents
documents = retriever.get_relevant_documents(question)
print([doc.page_content[:200] for doc in documents])

# 2. Adjust retrieval strategy
RETRIEVAL_LAMBDA_MULT = 0.5  # More diversity
RETRIEVAL_K = 8              # More documents

# 3. Update prompt template
# Add more specific instructions in prompts.py
```

---

## Future Improvements

1. **Persistent Memory**: Replace in-memory with Redis for distributed systems
2. **Multi-document QA**: Answer questions across multiple documents
3. **Semantic Caching**: Cache similar questions and responses
4. **Custom Models**: Fine-tune embeddings on medical terminology
5. **Fact Verification**: Check retrieved facts against reliable sources
6. **Citation Tracking**: Link answers back to source documents
7. **Multi-language**: Support Spanish, Chinese, etc.

---

## References

- **LangChain RAG**: https://python.langchain.com/docs/use_cases/question_answering/
- **ChromaDB**: https://www.trychroma.com/
- **Groq API**: https://console.groq.com/docs/
- **Sentence Transformers**: https://www.sbert.net/

See also:
- **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** — Full reference
- **[API_ENDPOINTS.md](API_ENDPOINTS.md)** — Chat API endpoints
- **[DEVELOPMENT.md](DEVELOPMENT.md)** — Code structure
