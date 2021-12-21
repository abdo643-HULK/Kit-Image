export const path = process.env["SOCKET_PATH"] || false;
export const host = process.env["HOST"] || '0.0.0.0';
export const port = process.env["PORT"] || (!path && 3000);