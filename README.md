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
- Whether full project syncing is allowed (from the project root).
- A registry of individual folders for selective syncing.

### 4. Folder Management
Folders within a project can be:
- **Registered**: Added to the `sync.json` for selective syncing.
- **Updated**: Modified (folder alias and description).
- **Deregistered**: Removed from the `sync.json` when not intended to be selectively synced.
- **Removed**: Removed from the local file system when no longer needed (deletion from both the local and remote project must be carried out manually with Rclone).

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
Below are some examples of usage:

### Select a project
![image](https://github.com/user-attachments/assets/c8f9cb0e-506d-4080-867f-39387008b781)

### Describe a folder (click it)
![image](https://github.com/user-attachments/assets/a2bd1969-d760-4211-91c3-9035aefae11c)

### Open a folder in the File Explorer
![image](https://github.com/user-attachments/assets/ef31f3f7-3cb2-47c8-9e68-5d45c9b14122)

### Register, edit, or deregister a folder
![image](https://github.com/user-attachments/assets/a077ce44-4397-4655-a69b-ad6190d2f6fe)
![image](https://github.com/user-attachments/assets/ee95968f-f6e2-4bdd-ac7d-13493887f8f1)
![image](https://github.com/user-attachments/assets/6edce182-977f-4520-9fa4-7663f59a662a)

### Download remote folders
![image](https://github.com/user-attachments/assets/bf7c2a9d-a324-4126-aa32-52bd09fe0f00)

### Remove local folders
![image](https://github.com/user-attachments/assets/52cae900-6bf4-4328-8ad7-3c9266c44af7)

### Push updates to or pull updates from remote
![image](https://github.com/user-attachments/assets/586ccb90-72db-4272-a034-8c620831bd49)

Note that the user has the opportunity to first review the staged changes before pushing to or pulling from the remote with Rclone.
![image](https://github.com/user-attachments/assets/5d4bfb5f-7784-4dc0-b141-f349f7d0deae)












