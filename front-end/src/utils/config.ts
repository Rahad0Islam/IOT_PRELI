/**
 * Static config loaded from Vite env. No hard-coded URLs elsewhere.
 */
export const config = {
  apiBase: (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:4000',
  socketUrl: (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'http://localhost:4000',
} as const;
