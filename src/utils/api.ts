export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const attempt = async (): Promise<{ res: Response; text: string }> => {
    const res = await fetch(url, options);
    const text = await res.text();
    return { res, text };
  };

  let { res, text } = await attempt();

  // If the dev server or proxy is briefly restarting and serves HTML on a GET, retry once
  if (
    (!options?.method || options.method === 'GET') &&
    text.trimStart().startsWith('<')
  ) {
    await new Promise((r) => setTimeout(r, 900));
    ({ res, text } = await attempt());
  }

  let parsed: unknown = null;
  if (text.trim()) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (text.trimStart().startsWith('<')) {
        throw new Error(
          `Server returned an HTML page instead of JSON (HTTP ${res.status}). Please refresh or retry in a moment.`
        );
      }
      throw new Error(`Invalid response from server (HTTP ${res.status}).`);
    }
  }

  if (!res.ok) {
    const errMsg =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `Request failed (HTTP ${res.status}).`;
    throw new Error(errMsg);
  }

  return parsed as T;
}
