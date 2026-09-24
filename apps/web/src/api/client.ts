import type { ApiError } from "./types.js";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1"
).replace(/\/$/, "");

export class ClientError extends Error {
  public code: string;
  public details?: unknown;
  public status: number;

  constructor(status: number, error: ApiError) {
    super(error.message || "An error occurred");
    this.name = "ClientError";
    this.status = status;
    this.code = error.code || "UNKNOWN_ERROR";
    this.details = error.details;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, headers: customHeaders, ...rest } = options;

  let url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (rest.body && typeof rest.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...rest,
    headers,
    credentials: "include", // Send and receive session cookies
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  let body: any = null;
  if (isJson) {
    try {
      body = await response.json();
    } catch {
      // non-parseable JSON
    }
  }

  if (!response.ok) {
    const errorData: ApiError = body?.error || {
      code: "HTTP_ERROR",
      message: response.statusText || "Request failed",
    };
    throw new ClientError(response.status, errorData);
  }

  return (body?.data !== undefined ? body.data : body) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: "GET", ...options }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: "DELETE", ...options }),
};

export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (progressPercent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(`Storage upload failed with HTTP status ${xhr.status}`),
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during direct storage upload"));
    };

    xhr.send(file);
  });
}
