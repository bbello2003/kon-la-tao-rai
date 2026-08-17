'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

type LoginResponse = {
  accessToken: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      const data = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      localStorage.setItem('accessToken', data.accessToken);

      router.push('/bills');
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Login failed',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border p-6"
      >
        <div>
          <h1 className="text-2xl font-bold">
            คนละเท่าไหร่
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            เข้าสู่ระบบ
          </p>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border p-3"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          className="w-full rounded-lg border p-3"
          required
        />

        {error && (
          <p className="text-sm text-red-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black p-3 text-white disabled:opacity-50"
        >
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  );
}