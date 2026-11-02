import axios from "axios";

const TOKEN_KEY = "campus_token";
const REFRESH_TOKEN_KEY = "campus_refresh_token";

const AUTH_BASE_URL = import.meta.env.VITE_AUTH_API_URL || "http://localhost:8082";

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

let refreshing: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    try {
        const { data } = await axios.post(`${AUTH_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
        });
        setToken(data.token);
        setRefreshToken(data.refresh_token);
        return data.token as string;
    } catch {
        return null;
    }
}

function refreshOnce(): Promise<string | null> {
    if (!refreshing) {
        refreshing = refreshSession();
        void refreshing.finally(() => {
            refreshing = null;
        });
    }
    return refreshing;
}

function createAxiosInstance(baseURL: string) {
    const instance = axios.create({
        baseURL,
        timeout: 30000,
        headers: { "Content-Type": "application/json" },
    });

    instance.interceptors.request.use((config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        const tenantID = localStorage.getItem("campus_tenant_id");
        if (tenantID && config.baseURL?.toString().includes("/api")) {
            config.headers["X-Campus-Tenant-ID"] = tenantID;
        }
        return config;
    });

    instance.interceptors.response.use(
        (response) => response,
        async (error) => {
            const original = error.config;
            const isRefreshCall = original?.url?.includes("/auth/refresh");

            if (
                error.response?.status === 401 &&
                original &&
                !original._retried &&
                !isRefreshCall
            ) {
                original._retried = true;

                const token = await refreshOnce();
                if (token) {
                    original.headers = original.headers ?? {};
                    original.headers.Authorization = `Bearer ${token}`;
                    return instance(original);
                }

                removeToken();
                window.location.href = "/login";
            }

            return Promise.reject(error);
        },
    );

    return instance;
}

export const authApi = createAxiosInstance(
    import.meta.env.VITE_AUTH_API_URL || "http://localhost:8082",
);

export const campusApi = createAxiosInstance(
    (import.meta.env.VITE_CAMPUS_API_URL || "http://localhost:8084") + "/api",
);
