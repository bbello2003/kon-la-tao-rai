const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...requestOptions } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      Array.isArray(data?.message)
        ? data.message.join(", ")
        : (data?.message ?? "Something went wrong"),
    );
  }

  return data as T;
}
