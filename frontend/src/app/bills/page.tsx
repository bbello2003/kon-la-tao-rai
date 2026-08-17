"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "../../lib/api";

type Bill = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export default function BillsPage() {
  const router = useRouter();

  const [bills, setBills] = useState<Bill[]>([]);
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function loadBills() {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setError("");

      const data = await api<Bill[]>("/bills", {
        token,
      });

      setBills(data);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("ไม่สามารถโหลดบิลได้");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBills();
  }, []);

  async function handleCreateBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem("accessToken");

    if (!token) {
      router.push("/login");
      return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    try {
      setCreating(true);
      setError("");

      const newBill = await api<Bill>("/bills", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: trimmedName,
        }),
      });

      setBills((currentBills) => [newBill, ...currentBills]);

      setName("");
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("ไม่สามารถสร้างบิลได้");
      }
    } finally {
      setCreating(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("accessToken");
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">กำลังโหลดบิล...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">คนละเท่าไหร่</h1>

            <p className="mt-1 text-gray-500">บิลของฉัน</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-100"
          >
            ออกจากระบบ
          </button>
        </header>

        {/* Create bill */}
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">สร้างบิลใหม่</h2>

          <p className="mt-1 text-sm text-gray-500">
            เช่น บิลญี่ปุ่น, ทริปเชียงใหม่, กินข้าวกับเพื่อน
          </p>

          <form onSubmit={handleCreateBill} className="mt-5 flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="ชื่อบิล"
              maxLength={100}
              className="flex-1 rounded-lg border px-4 py-3 outline-none focus:border-black"
            />

            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="rounded-lg bg-black px-5 py-3 text-white transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating ? "กำลังสร้าง..." : "สร้างบิล"}
            </button>
          </form>
        </section>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Bills */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">บิลของคุณ</h2>

            <span className="text-sm text-gray-500">{bills.length} บิล</span>
          </div>

          {bills.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed bg-white p-10 text-center">
              <p className="font-medium">ยังไม่มีบิล</p>

              <p className="mt-1 text-sm text-gray-500">
                สร้างบิลแรกของคุณด้านบน
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {bills.map((bill) => (
                <button
                  key={bill.id}
                  type="button"
                  onClick={() => router.push(`/bills/${bill.id}`)}
                  className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold">{bill.name}</h3>

                  <p className="mt-2 text-sm text-gray-500">
                    สร้างเมื่อ{" "}
                    {new Date(bill.createdAt).toLocaleDateString("th-TH")}
                  </p>

                  <p className="mt-4 text-sm font-medium">ดูรายละเอียด →</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
