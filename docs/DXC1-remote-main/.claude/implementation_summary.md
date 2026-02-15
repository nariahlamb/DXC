# Gist Cloud Backup Implementation

## Changes

1.  **New Service**: `utils/gistService.ts`
    - Handles GitHub API interactions.
    - Validate Token: `GET /user`
    - Find/Create/Update Gist: Uses description/filename "Danmachi DXC Cloud Save..." to identify the backup.
    - Load Gist: Retrieves content for restoration.

2.  **Storage Adapter**: `utils/storage/storageAdapter.ts`
    - Added `GITHUB_TOKEN_KEY` and `GIST_BACKUP_ID_KEY` constants.
    - Added helper functions to save/load these keys from managed storage (settings).

3.  **UI Update**: `components/game/modals/SaveManagerModal.tsx`
    - Added "Cloud Sync (GitHub Gist)" section.
    - Input for Personal Access Token (PAT).
    - "Connect" button to validate and store token.
    - "Upload Current" button: Creates or Updates the backup Gist with current game state.
    - "Download & Load" button: Retrieves and loads game state from the backup Gist.
    - Displays connection status and operation feedback.

## User Flow

1.  Open "Save/Load" (Data Management) Modal.
2.  Scroll to bottom "Cloud Sync" section.
3.  Enter GitHub Token (requires `gist` scope).
4.  Click "Connect".
5.  Click "Upload Current" to backup current progress.
6.  Click "Download & Load" to restore from cloud.

## Logic Details

- **Backup Identity**: The system looks for a Gist with description "Danmachi DXC Cloud Save - Automated Backup" or containing file "danmachi_dxc_save.json".
- **Overwrite**: If found, it updates that specific Gist ID.
- **Create**: If not found, it creates a new secret Gist.
- **Progress**: Uploads `gameState` wrapped in backup metadata (similar to file export).
