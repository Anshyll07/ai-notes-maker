# Technical Flow Diagrams

This document outlines the technical architecture and process flows of the AI Notes Maker application.

## 1. High-Level System Architecture

Overview of how the Frontend, Backend, Database, and External Services interact.

```mermaid
graph TD
    User[User] -->|Interacts| FE[Frontend (React/Vite)]
    FE -->|HTTP API Calls| API[Backend API (Flask)]
    
    subgraph Backend
        API -->|Auth/Data| DB[(SQLite Database)]
        API -->|File I/O| FS[File System]
        FS -->|Uploads| UploadsDir[backend/uploads/]
        FS -->|Downloads| DownloadsDir[backend/downloaded_images/]
    end
    
    subgraph External Services
        API -->|AI Generation| Gemini[Google Gemini API]
        API -->|Image Search| DDG[DuckDuckGo Search]
    end
```

![High-Level Architecture](images/architecture.png)


## 2. Image Handling Flows

There are two distinct ways images are handled in the application: **Inline Images** (pasted/inserted) and **Attachments** (files).

### A. Inline Image Upload (Base64)
Images inserted directly into the editor are stored as Base64 strings within the HTML content.

```mermaid
sequenceDiagram
    participant User
    participant Editor as RichTextEditor
    participant API as Flask API (/upload_file)
    participant DB as SQLite (Note Content)

    User->>Editor: Clicks "Insert Image" or Pastes
    Editor->>API: POST /api/upload_file (File)
    Note over API: Reads file into memory
    Note over API: Converts to Base64 string
    API-->>Editor: Returns { "image": "data:image/png;base64..." }
    Editor->>Editor: Inserts <img src="data:..." /> into HTML
    Editor->>DB: Auto-save (PUT /notes/:id)
    Note over DB: Saves entire HTML with Base64 image
```

![Inline Image Flow](images/inline_flow.png)


### B. Attachment Upload (File System)
Files uploaded via the "Attach File" button are saved to disk and referenced in the database.

```mermaid
sequenceDiagram
    participant User
    participant FE as Frontend
    participant API as Flask API
    participant FS as File System
    participant DB as SQLite
    participant Worker as Background Thread

    User->>FE: Uploads File (PDF/Image)
    FE->>API: POST /notes/:id/attachments
    API->>FS: Save file to backend/uploads/UUID.ext
    API->>DB: Create Attachment Record (status: pending)
    API->>Worker: Start Summary Generation
    API-->>FE: Return Attachment Object
    
    par Background Process
        Worker->>FS: Read File
        Worker->>Gemini: Generate Summary
        Worker->>DB: Update Attachment (summary, status: complete)
    end
```

![Attachment Upload Flow](images/attachment_flow.png)


## 3. AI Chat & File Analysis Flow

How the system decides whether to read local files before answering a user question.

```mermaid
flowchart TD
    Start[User Sends Message] --> DecideEndpoint{POST /chat/decide}
    
    subgraph "Phase 1: Decision"
        DecideEndpoint --> CheckAtts[Check Note Attachments]
        CheckAtts -->|Has Attachments| SendSummaries[Send Summaries + User Query to Gemini]
        CheckAtts -->|No Attachments| NoFiles[Decision: No Files Needed]
        SendSummaries --> GeminiDecide[Gemini: "Do I need full file content?"]
        GeminiDecide -->|Yes| ReturnFiles[Return: need_files=true, file_indices=[...]]
        GeminiDecide -->|No| ReturnNoFiles[Return: need_files=false]
    end
    
    ReturnFiles --> RespondEndpoint{POST /chat/respond}
    ReturnNoFiles --> RespondEndpoint
    NoFiles --> RespondEndpoint
    
    subgraph "Phase 2: Response"
        RespondEndpoint --> ReadFiles{Need Files?}
        ReadFiles -->|Yes| DiskRead[Read Files from backend/uploads/]
        ReadFiles -->|No| SkipRead[Skip File Reading]
        
        DiskRead --> BuildContext[Build Prompt with File Content]
        SkipRead --> BuildContext[Build Prompt with Note Content Only]
        
        BuildContext --> GeminiGen[Gemini: Generate Answer]
        GeminiGen --> Response[Return AI Response]
    end
```

![AI Chat Flow](images/ai_chat_flow.png)


## 4. Image Search & Cleanup Process

How images are searched, downloaded, and cleaned up to prevent storage bloat.

```mermaid
stateDiagram-v2
    [*] --> Search: User requests image
    
    state Search {
        Frontend --> API_Search: POST /search-images
        API_Search --> DuckDuckGo: Search Query
        DuckDuckGo --> API_Search: Image URLs
        API_Search --> Download: Download to backend/downloaded_images/
        Download --> Frontend: Return Local URLs (/api/downloaded_images/...)
    }
    
    Search --> Selection: User views results
    
    state Selection {
        User --> Select: Selects Image
        Select --> Editor: Insert into Note
        User --> Cancel: Closes Modal
    }
    
    state Cleanup {
        Cancel --> API_Cleanup: POST /cleanup-images (Unused URLs)
        API_Cleanup --> DeleteFile: Delete from disk
        
        DeleteNote --> API_Delete: DELETE /notes/:id
        API_Delete --> ScanContent: Find /api/downloaded_images/ links
        ScanContent --> DeleteFile: Delete referenced files
    }
```

![Image Search Flow](images/image_search_flow.png)

