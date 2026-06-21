/** mastyf.ai monorepo (cloud app, docs, and platform source). */
export const GITHUB_REPO_URL = 'https://github.com/mastyf-ai/mastyf.ai';

export const GITHUB_DEFAULT_BRANCH = 'main';

export const GITHUB_README_URL = `${GITHUB_REPO_URL}/blob/${GITHUB_DEFAULT_BRANCH}/README.md`;

/** Internal route: OAuth callback lands here, then redirects to GITHUB_REPO_URL. */
export const POST_SIGNIN_PATH = '/post-login';
