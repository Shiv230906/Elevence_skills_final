// Centralized API configuration for Elevance / InternArea Frontend
export const DEFAULT_BACKEND_URL = "https://elevance-skill.onrender.com";

/**
 * Returns the base backend URL without trailing slash or `/api`.
 * Priority:
 * 1. process.env.NEXT_PUBLIC_BACKEND_URL or process.env.NEXT_PUBLIC_API_URL
 * 2. If running in browser on localhost/127.0.0.1, fallback to http://localhost:5000
 * 3. Default to production deployed backend: https://elevance-skill.onrender.com
 */
export const getBackendUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:5000";
    }
  }
  return DEFAULT_BACKEND_URL;
};

/**
 * Returns the base API URL ending with `/api`.
 */
export const getApiUrl = (): string => {
  return `${getBackendUrl()}/api`;
};

export const BACKEND_URL = getBackendUrl();
export const API_URL = getApiUrl();
