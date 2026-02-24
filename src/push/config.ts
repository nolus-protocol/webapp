const publicKey = "BJMnPqFfhkd9zZ0aUFqkJhKQP1uo_Z8H23uLqGhqLe_vKAKWV9AU76dvoR8KJLSk0ivFgk-D-Toq3DVNCvA8RKM";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
const appUrl = import.meta.env.VITE_APP_URL || "";

const host = `${backendUrl}/api/etl`;
const redirect = appUrl;

export { publicKey, host, redirect };
