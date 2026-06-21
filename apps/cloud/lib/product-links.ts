/**
 * Public product naming — mastyf.ai (web) vs MCP Guardian (npm).
 *
 * mastyf.ai is the security score + cloud platform. It is not published to npm.
 * MCP Guardian (@mcp-guardian/server) is the open-source MCP proxy on npm that
 * mastyf.ai is built on.
 */

export const SITE_NAME = 'mastyf.ai';
export const CLOUD_NAME = 'mastyf.ai Cloud';

/** Canonical production URL (www). Set NEXT_PUBLIC_APP_URL in Vercel to match. */
export const PRODUCTION_SITE_URL = 'https://www.mastyf.ai';
export const PRODUCTION_SITE_HOST = 'www.mastyf.ai';
export const PRODUCTION_APEX_HOST = 'mastyf.ai';

export const NPM_PRODUCT_NAME = 'MCP Guardian';
export const NPM_PACKAGE_NAME = '@mcp-guardian/server';
export const NPM_PACKAGE_URL = 'https://www.npmjs.com/package/@mcp-guardian/server';
export const CLI_NAME = 'mcp-guardian';
export const NPM_INSTALL_CMD = `npm install -g ${NPM_PACKAGE_NAME}`;
export const CLI_ONBOARD_CMD = `${CLI_NAME} onboard --apply`;
export const CLI_START_CMD = `${CLI_NAME} start`;
