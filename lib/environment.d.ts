declare global {
  namespace NodeJS {
		interface ProcessEnv {
			CHROME_HEADLESS_WS_URL: string;
      PROXY_USERNAME: string;
      PROXY_PASSWORD: string;
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}