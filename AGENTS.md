# AI Agents Guide - RecoveryBot

This guide provides essential architectural and operational knowledge for AI agents working on the RecoveryBot codebase.

## 🏗 Architecture Overview
RecoveryBot is a Ruby on Rails 7 application designed to support recovery and 12-step programs.

### Tech Stack
- **Backend**: Ruby on Rails 7, PostgreSQL
- **Frontend**: React components (JSX) integrated with Stimulus.js and Vite for bundling.
- **Deployment**: CapRover / Docker

## 📂 Key Components & Logic

### 📚 Literature Library
Manages recovery literature (Books, Chapters, Readings).
- **Models**: `Book`, `Chapter`, `Reading`
- **Logic**: Literature is structured hierarchically. Imports and exports are handled via JSON payloads in `Api::BooksController` and supported by services like `LiteratureImporter`.
- **Frontend**: Uses rich text editors (Tiptap/Lexical) for content management (`ChapterEditor.jsx`, `ReadingEditor.jsx`).

### 🗣 Topicificator & Hostificator
- **Topicificator**: A randomized topic generator for group discussions. Uses `TopicSet`, `TopicCategory`, and `Topic` models.
- **Hostificator**: A voting system for proposing and selecting hosts/proposals (`Hostificator`, `HostProp`, `HostVote` models).

### 🎮 Quest System (Game Logic)
An API-driven system for tracking game state, inventories, and player progress.
- **Models**: `QuestPlayer`, `QuestSession`, `QuestInventory`
- **API Endpoints**: Located in `app/controllers/api/v1`. Handles player creation, session joining (via `join_code`), and game state persistence (grid position, points, inventory).

### 🤝 Meetings & Groups
- **Logic**: Meetings are associated with Groups (`Group` has many `Meeting`). This allows for organizing recurring meetings by group.

### 🛠 Services
Business logic for complex operations (e.g., importing literature) is encapsulated in `app/services`.

## 🚀 Development Workflow

### Local Setup
- **Server**: Run `./bin/dev` to start the Rails server and Vite.
- **Database**: Use `rails db:setup` for initial configuration.

### API Structure
- `/api/...`: General resource APIs (e.g., `Api::BooksController`). Some endpoints require administrative privileges (`require_admin!`).
- `/api/v1/...`: Specialized API for the Quest game system.

## ⚠️ Important Notes
- **Admin Access**: Many critical endpoints in the API and administrative panel require `admin` status on the `User` model.
- **Data Integrity**: When importing literature, ensure slugs are unique and formatted correctly to avoid collisions.
- **React Integration**: Frontend components are located in `app/javascript/components` and are rendered within Rails views.
