export const path = process.env["SOCKET_PATH"] || false;
export const host = process.env["HOST"] || '0.0.0.0';
export const port = process.env["PORT"] || (!path && 3000);
				
				process.env.__KIT_IMAGE_OPTS = {"minimumCacheTTL":8000};
				//import.meta.env.__KIT_IMAGE_OPTS = {"minimumCacheTTL":8000};

				export const imageConfig = {"minimumCacheTTL":8000}