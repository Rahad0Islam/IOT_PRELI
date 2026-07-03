/**
 * Shared Axios client. All requests go through here so we get one place
 * to swap the base URL / interceptors.
 */
import axios from 'axios';
import { config } from '../utils/config';

export const http = axios.create({
  baseURL: config.apiBase,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    // Normalise error for easier consumption by hooks.
    const msg =
      err?.response?.data?.error ??
      err?.response?.data?.message ??
      err?.message ??
      'Unknown error';
    return Promise.reject(new Error(msg));
  }
);
