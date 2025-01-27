# Rclone Selective Sync

## Overview
Rclone Selective Sync is a specialized tool designed for projects with a wide variety of large files and resources backed up to the cloud using Rclone. The tool enables users to efficiently manage their local file storage by selectively syncing folders from a project while protecting critical cloud backups.

### Target Audience
This tool is ideal for users managing projects where:
- A significant portion of files are not needed locally during day-to-day work.
- Projects involve large resources (e.g., VFX assets, rendered scenes, global resource libraries).
- Cloud storage is used for backups, and there is a need to avoid accidental deletions during synchronization.

### Use Case Example
A VFX project may have:
- A global resources folder containing essential shared assets.
- Dozens or hundreds of scene-specific folders with rendered assets, often large in size.

When a scene is complete, its files are no longer needed locally. Instead of keeping everything on the local system or risking deletion from the cloud during Rclone syncs, users can selectively keep the relevant folders locally and minimize download times when switching to new scenes.

---

## Paradigm
Rclone Selective Sync serves as a wrapper for Rclone, providing a user-friendly interface and added functionality. Below are key concepts:

### 1. Dependency on Rclone
The app requires Rclone to be installed beforehand. It modifies/creates the user's default `rclone.conf` file, so users must ensure all Rclone remotes are specified in the app's configuration to avoid unintended effects on other remotes.

### 2. Global Config
The **Global Config** is used to define:
- All Rclone remotes (currently supports Backblaze B2 only), including application keys, key IDs, bucket names, etc.
- The local path where the project is stored on the user’s file system.

### 3. Project Config
The **Project Config** is stored in a `sync.json` file at the root of each project folder. It contains:
- Whether full project syncing is allowed.
- A registry of individual folders for selective syncing.

### 4. Folder Management
Folders within a project can be:
- **Registered**: Added to the `sync.json` for selective syncing.
- **Updated**: Modified with aliases or descriptions.
- **Deregistered**: Removed from the `sync.json` when no longer needed locally.

### 5. Ultimate Goal
Enable users to:
- Sync, download, or remove individual folders locally as needed.
- Preserve cloud backups while reducing unnecessary local file storage.

---

## Project Structure

### Backend
The backend is implemented in Go and consists of:

#### 1. Data Structures
Key JSON-backed structures include:
- **Global Config**: Defines Rclone remotes and the local project path.
- **Project Config**: Defines folder syncing settings within a project.

#### 2. Service Files
- **Config Service**: Handles loading Global Config, creating the `rclone.conf` file, and managing Project Config.
- **Folder Service**: Manages folder registration, updates, and deregistration.
- **Sync Service**: Executes Rclone commands for syncing, downloading, or removing folders.

### Frontend
The frontend is built using Material-UI (MUI) and Toolpad for a polished and efficient interface.

#### 1. Components
Reusable and page-specific components, styled with MUI theming to maintain a consistent look and feel.

#### 2. Hooks
Custom hooks provide context and manage state, including Global Config and Project Config. These abstractions ensure seamless integration with the backend.

#### 3. Pages
Simple, modular pages designed for:
- Settings
- Sync operations
- Other app functionality

Each page wraps root components in the necessary contexts to manage state and API calls.

---

## Usage
_(To be completed with screenshots and examples)_

