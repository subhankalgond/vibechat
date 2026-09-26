import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { loadToken } from './storage';

/**
 * Base URL of the VibeChat API.
 *
 * - Android emulator: 10.0.2.2 is the machine's localhost.
 * - iOS simulator: localhost works directly.
 * - Real device: replace with your computer's LAN IP, e.g. http://192.168.1.5:5000
 *   or your deployed backend (https://vibechat-uukh.onrender.com).
 */
function resolveApiUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (fromExtra && typeof fromExtra === 'string' && fromExtra.length > 0) {
    return fromExtra.replace(/\/$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
}

export const API_URL = resolveApiUrl();

export const api = {
  async request<T = any>(method: string, path: string, body?: any, token?: string | null): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || !data?.success) {
      const error = new Error((data && data.message) || `Request failed (${response.status})`) as Error & {
        status?: number;
        errors?: Record<string, string> | null;
      };
      error.status = response.status;
      error.errors = (data && data.errors) || null;
      throw error;
    }
    return data.data as T;
  },

  get<T = any>(path: string, token?: string | null) {
    return this.request<T>('GET', path, undefined, token);
  },
  post<T = any>(path: string, body?: any, token?: string | null) {
    return this.request<T>('POST', path, body, token);
  },
  put<T = any>(path: string, body?: any, token?: string | null) {
    return this.request<T>('PUT', path, body, token);
  },
  delete<T = any>(path: string, token?: string | null) {
    return this.request<T>('DELETE', path, undefined, token);
  },

  /**
   * Multipart file upload (used for voice notes). `fileUri` is a local
   * file:// URI from the recorder; name and mimeType tell the server
   * which form field / extension to expect.
   */
  async upload<T = any>(path: string, fileUri: string, fieldName: string, fileName: string, mimeType: string): Promise<T> {
    const token = await loadToken();
    const form = new FormData();
    // RN's fetch accepts this shape and builds the multipart body itself.
    form.append(fieldName, { uri: fileUri, name: fileName, type: mimeType } as any);
    const response = await fetch(`${API_URL}/api${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok || !data?.success) {
      throw new Error((data && data.message) || `Upload failed (${response.status})`);
    }
    return data.data as T;
  },
};
