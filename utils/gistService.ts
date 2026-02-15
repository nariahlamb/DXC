
import { GameState } from '../types';

interface GistFile {
  filename: string;
  content: string;
  raw_url: string;
}

interface Gist {
  id: string;
  description: string;
  updated_at: string;
  files: Record<string, GistFile>;
}

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
}

const GIST_FILENAME = 'danmachi_dxc_save.json';
const GIST_DESCRIPTION = 'Danmachi DXC Cloud Save - Automated Backup';

export class GistService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private get headers() {
    return {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  async validateToken(): Promise<GitHubUser | null> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: this.headers,
      });
      
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('GitHub API Error:', error);
      return null;
    }
  }

  async findBackupGist(): Promise<Gist | null> {
    try {
      // First, check if we have the ID stored locally? 
      // Actually, relying on search is more robust if local data is cleared.
      // Search user's gists.
      const response = await fetch('https://api.github.com/gists', {
        headers: this.headers,
      });

      if (!response.ok) throw new Error('Failed to fetch gists');
      
      const gists: Gist[] = await response.json();
      
      // Find the first gist that matches our description or filename
      const found = gists.find(g => 
        g.description === GIST_DESCRIPTION || 
        Object.keys(g.files).includes(GIST_FILENAME)
      );

      return found || null;
    } catch (error) {
      console.error('Find Backup Gist Error:', error);
      throw error;
    }
  }

  async createBackupGist(saveData: any): Promise<Gist> {
    const content = JSON.stringify(saveData, null, 2);
    
    try {
      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          description: GIST_DESCRIPTION,
          public: false, // Default to secret gist
          files: {
            [GIST_FILENAME]: {
              content,
            }
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create gist');
      }

      return await response.json();
    } catch (error) {
      console.error('Create Gist Error:', error);
      throw error;
    }
  }

  async updateBackupGist(gistId: string, saveData: any): Promise<Gist> {
    const content = JSON.stringify(saveData, null, 2);

    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify({
          description: GIST_DESCRIPTION, // Update description just in case
          files: {
            [GIST_FILENAME]: {
              content,
            }
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update gist');
      }

      return await response.json();
    } catch (error) {
      console.error('Update Gist Error:', error);
      throw error;
    }
  }

  async getGistContent(gistId: string): Promise<any> {
    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: this.headers,
      });

      if (!response.ok) throw new Error('Failed to fetch gist details');
      
      const gist: Gist = await response.json();
      const file = gist.files[GIST_FILENAME];
      
      if (!file) throw new Error('Save file not found in gist');
      
      return JSON.parse(file.content);
    } catch (error) {
      console.error('Get Gist Content Error:', error);
      throw error;
    }
  }
}
