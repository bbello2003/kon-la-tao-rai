"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { api } from "../../../lib/api";

type Bill = {
  id: string;
  name: string;
};

type Participant = {
  id: string;
  name: string;
};

type Expense = {
  id: string;
  billId: string;
  paidByParticipantId: string;
  description: string;
  amountSatang: number;
  category: string;
  spentAt: string;
  paidBy: {
    id: string;
    name: string;
  };
  participants: {
    participantId: string;
    participant: {
      id: string;
      name: string;
    };
  }[];
};

const categories = [
  "อาหาร",
  "ที่พัก",
  "เดินทาง",
  "ช้อปปิ้ง",
  "กิจกรรม",
  "อื่น ๆ",
];

export default function BillDetailPage() {
  const router = useRouter();
  const params = useParams();

  const [bill, setBill] = useState<Bill | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [participantName, setParticipantName] = useState("");
  const [addingParticipant, setAddingParticipant] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("อาหาร");
  const [paidByParticipantId, setPaidByParticipantId] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    string[]
  >([]);
  const [creatingExpense, setCreatingExpense] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadBillDetail() {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      router.push("/login");
      return;
    }

    const billId = params.id;

    if (typeof billId !== "string") {
      setError("ไม่พบบิลนี้");
      setLoading(false);
      return;
    }

    try {
      setError("");

      const [billData, participantsData, expensesData] = await Promise.all([
        api<Bill>(`/bills/${billId}`, {
          token,
        }),

        api<Participant[]>(`/bills/${billId}/participants`, {
          token,
        }),

        api<Expense[]>(`/bills/${billId}/expenses`, {
          token,
        }),
      ]);

      setBill(billData);
      setParticipants(participantsData);
      setExpenses(expensesData);

      if (participantsData.length > 0) {
        setPaidByParticipantId(
          (currentValue) => currentValue || participantsData[0].id,
        );

        setSelectedParticipantIds((currentValue) =>
          currentValue.length > 0
            ? currentValue
            : participantsData.map((participant) => participant.id),
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("ไม่สามารถโหลดรายละเอียดบิลได้");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBillDetail();
  }, [params.id]);

  async function handleAddParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem("accessToken");

    if (!token) {
      router.push("/login");
      return;
    }

    const billId = params.id;

    if (typeof billId !== "string") {
      return;
    }

    const trimmedName = participantName.trim();

    if (!trimmedName) {
      return;
    }

    try {
      setAddingParticipant(true);
      setError("");

      const newParticipant = await api<Participant>(
        `/bills/${billId}/participants`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            name: trimmedName,
          }),
        },
      );

      setParticipants((currentParticipants) => [
        ...currentParticipants,
        newParticipant,
      ]);

      setParticipantName("");

      setSelectedParticipantIds((currentIds) => [
        ...currentIds,
        newParticipant.id,
      ]);

      if (!paidByParticipantId) {
        setPaidByParticipantId(newParticipant.id);
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("ไม่สามารถเพิ่มสมาชิกได้");
      }
    } finally {
      setAddingParticipant(false);
    }
  }

  function toggleParticipant(participantId: string) {
    setSelectedParticipantIds((currentIds) => {
      if (currentIds.includes(participantId)) {
        return currentIds.filter((id) => id !== participantId);
      }

      return [...currentIds, participantId];
    });
  }

  async function handleCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem("accessToken");

    if (!token) {
      router.push("/login");
      return;
    }

    const billId = params.id;

    if (typeof billId !== "string") {
      return;
    }

    const trimmedDescription = description.trim();
    const amountNumber = Number(amount);

    if (!trimmedDescription) {
      setError("กรุณากรอกรายละเอียดค่าใช้จ่าย");
      return;
    }

    if (!amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }

    if (!paidByParticipantId) {
      setError("กรุณาเลือกคนที่จ่าย");
      return;
    }

    if (selectedParticipantIds.length === 0) {
      setError("กรุณาเลือกคนที่ร่วมค่าใช้จ่าย");
      return;
    }

    try {
      setCreatingExpense(true);
      setError("");

      const amountSatang = Math.round(amountNumber * 100);

      const newExpense = await api<Expense>(`/bills/${billId}/expenses`, {
        method: "POST",
        token,
        body: JSON.stringify({
          description: trimmedDescription,
          amountSatang,
          category,
          paidByParticipantId,
          participantIds: selectedParticipantIds,
        }),
      });

      setExpenses((currentExpenses) => [newExpense, ...currentExpenses]);

      setDescription("");
      setAmount("");
      setCategory("อาหาร");

      if (participants.length > 0) {
        setPaidByParticipantId(participants[0].id);
      }

      setSelectedParticipantIds(
        participants.map((participant) => participant.id),
      );
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("ไม่สามารถเพิ่มค่าใช้จ่ายได้");
      }
    } finally {
      setCreatingExpense(false);
    }
  }

  function handleBack() {
    router.push("/bills");
  }

  function formatAmount(amountSatang: number) {
    return `฿${(amountSatang / 100).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">กำลังโหลดรายละเอียดบิล...</p>
      </main>
    );
  }

  if (error && !bill) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <button
            type="button"
            onClick={handleBack}
            className="text-sm text-gray-600 transition hover:text-black"
          >
            ← กลับไปหน้าบิล
          </button>

          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-semibold text-red-700">
              ไม่สามารถโหลดบิลได้
            </h1>

            <p className="mt-2 text-sm text-red-600">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!bill) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Back */}
        <button
          type="button"
          onClick={handleBack}
          className="text-sm text-gray-600 transition hover:text-black"
        >
          ← กลับไปหน้าบิล
        </button>

        {/* Bill title */}
        <div className="mt-6">
          <h1 className="text-3xl font-bold">{bill.name}</h1>

          <p className="mt-1 text-sm text-gray-500">รายละเอียดการหารเงิน</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Participants */}
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">สมาชิก</h2>

            <span className="text-sm text-gray-500">
              {participants.length} คน
            </span>
          </div>

          {/* Add participant */}
          <form onSubmit={handleAddParticipant} className="mt-5 flex gap-3">
            <input
              type="text"
              value={participantName}
              onChange={(event) => setParticipantName(event.target.value)}
              placeholder="ชื่อสมาชิก"
              maxLength={100}
              className="flex-1 rounded-lg border px-4 py-3 outline-none focus:border-black"
            />

            <button
              type="submit"
              disabled={addingParticipant || !participantName.trim()}
              className="rounded-lg bg-black px-5 py-3 text-white transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {addingParticipant ? "กำลังเพิ่ม..." : "เพิ่มสมาชิก"}
            </button>
          </form>

          {participants.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed bg-gray-50 p-6 text-center">
              <p className="font-medium text-gray-700">ยังไม่มีสมาชิก</p>

              <p className="mt-1 text-sm text-gray-500">
                เพิ่มสมาชิกเพื่อเริ่มหารบิล
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="rounded-xl border px-4 py-3"
                >
                  <p className="font-medium text-gray-900">
                    {participant.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Create Expense */}
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">เพิ่มค่าใช้จ่าย</h2>

          <p className="mt-1 text-sm text-gray-500">
            ระบุว่าใครเป็นคนจ่าย และรายการนี้หารกับใครบ้าง
          </p>

          {participants.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed bg-gray-50 p-6 text-center">
              <p className="font-medium text-gray-700">
                ยังเพิ่มค่าใช้จ่ายไม่ได้
              </p>

              <p className="mt-1 text-sm text-gray-500">กรุณาเพิ่มสมาชิกก่อน</p>
            </div>
          ) : (
            <form onSubmit={handleCreateExpense} className="mt-5 space-y-5">
              {/* Description */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  รายละเอียด
                </label>

                <input
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="เช่น ค่าอาหารกลางวัน"
                  maxLength={200}
                  className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  จำนวนเงิน (บาท)
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  หมวดหมู่
                </label>

                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-2 w-full rounded-lg border bg-white px-4 py-3 outline-none focus:border-black"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payer */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  ใครเป็นคนจ่าย
                </label>

                <select
                  value={paidByParticipantId}
                  onChange={(event) =>
                    setPaidByParticipantId(event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border bg-white px-4 py-3 outline-none focus:border-black"
                >
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Participants */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    หารกับใครบ้าง
                  </label>

                  <span className="text-xs text-gray-400">
                    เลือก {selectedParticipantIds.length} คน
                  </span>
                </div>

                <div className="mt-2 space-y-2">
                  {participants.map((participant) => {
                    const selected = selectedParticipantIds.includes(
                      participant.id,
                    );

                    return (
                      <label
                        key={participant.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleParticipant(participant.id)}
                          className="h-4 w-4"
                        />

                        <span className="text-sm font-medium">
                          {participant.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  creatingExpense ||
                  !description.trim() ||
                  !amount ||
                  selectedParticipantIds.length === 0
                }
                className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creatingExpense
                  ? "กำลังเพิ่มค่าใช้จ่าย..."
                  : "เพิ่มค่าใช้จ่าย"}
              </button>
            </form>
          )}
        </section>

        {/* Expenses */}
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">รายละเอียดค่าใช้จ่าย</h2>

            <span className="text-sm text-gray-500">
              {expenses.length} รายการ
            </span>
          </div>

          {expenses.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed bg-gray-50 p-6 text-center">
              <p className="font-medium text-gray-700">
                ยังไม่มีรายการค่าใช้จ่าย
              </p>

              <p className="mt-1 text-sm text-gray-500">
                เพิ่มรายการแรกของคุณด้านบน
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {expenses.map((expense) => (
                <div key={expense.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {expense.description}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        จ่ายโดย {expense.paidBy.name}
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        {new Date(expense.spentAt).toLocaleDateString("th-TH")}
                      </p>
                    </div>

                    <p className="whitespace-nowrap text-lg font-semibold text-gray-900">
                      {formatAmount(expense.amountSatang)}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                      {expense.category}
                    </span>

                    <span className="text-xs text-gray-400">
                      หาร {expense.participants.length} คน
                    </span>
                  </div>

                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs text-gray-400">หารกับ</p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {expense.participants.map(({ participant }) => (
                        <span
                          key={participant.id}
                          className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
                        >
                          {participant.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Back */}
        <div className="mt-8">
          <button
            type="button"
            onClick={handleBack}
            className="w-full rounded-lg border bg-white px-5 py-3 text-sm font-medium transition hover:bg-gray-100"
          >
            กลับไปหน้าบิล
          </button>
        </div>
      </div>
    </main>
  );
}
