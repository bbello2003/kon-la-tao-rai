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
  category?: string;
  spentAt: string;
  splitMode: "EQUAL" | "CUSTOM";
  serviceChargePercent: number | string;
  serviceChargeMode: "EQUAL" | "PROPORTIONAL";
  vatPercent: number | string;
  vatMode: "EQUAL" | "PROPORTIONAL";
  paidBy: {
    id: string;
    name: string;
  };
  participants: {
    participantId: string;
    amountSatang: number;
    participant: {
      id: string;
      name: string;
    };
  }[];
};

type SummaryBalance = {
  participantId: string;
  name?: string;
  amountSatang: number;
  amountBaht: string;
};

type SummaryTransaction = {
  fromParticipantId: string;
  from?: string;
  toParticipantId: string;
  to?: string;
  amountSatang: number;
  amountBaht: string;
};

type BillSummary = {
  bill: {
    id: string;
    name: string;
  };
  balances: SummaryBalance[];
  transactions: SummaryTransaction[];
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
  const [billSummary, setBillSummary] = useState<BillSummary | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "expenses" | "summary">(
    "members",
  );

  const [participantName, setParticipantName] = useState("");
  const [addingParticipant, setAddingParticipant] = useState(false);

  // Expense
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidByParticipantId, setPaidByParticipantId] = useState("");

  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    string[]
  >([]);

  const [splitMode, setSplitMode] = useState<"EQUAL" | "CUSTOM">("EQUAL");

  const [participantAmounts, setParticipantAmounts] = useState<
    Record<string, string>
  >({});

  const [addServiceCharge, setAddServiceCharge] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState("10");
  const [serviceChargeMode, setServiceChargeMode] = useState<
    "EQUAL" | "PROPORTIONAL"
  >("EQUAL");

  const [addVat, setAddVat] = useState(false);
  const [vatPercent, setVatPercent] = useState("7");
  const [vatMode, setVatMode] = useState<"EQUAL" | "PROPORTIONAL">("EQUAL");

  const [creatingExpense, setCreatingExpense] = useState(false);

  // Modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editedParticipantName, setEditedParticipantName] = useState("");
  const [updatingParticipant, setUpdatingParticipant] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

      const [billData, participantsData, expensesData, summaryData] =
        await Promise.all([
          api<Bill>(`/bills/${billId}`, {
            token,
          }),

          api<Participant[]>(`/bills/${billId}/participants`, {
            token,
          }),

          api<Expense[]>(`/bills/${billId}/expenses`, {
            token,
          }),

          api<BillSummary>(`/bills/${billId}/summary`, {
            token,
          }),
        ]);

      setBill(billData);
      setParticipants(participantsData);
      setExpenses(expensesData);
      setBillSummary(summaryData);

      if (participantsData.length > 0) {
        setPaidByParticipantId(
          (currentValue) => currentValue || participantsData[0].id,
        );

        setSelectedParticipantIds((currentValue) =>
          currentValue.length > 0
            ? currentValue
            : participantsData.map((participant) => participant.id),
        );

        setParticipantAmounts((currentAmounts) => {
          const next = { ...currentAmounts };

          for (const participant of participantsData) {
            if (!(participant.id in next)) {
              next[participant.id] = "";
            }
          }

          return next;
        });
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
      setNotice("");

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
      setNotice(`เพิ่มสมาชิก ${trimmedName} เรียบร้อยแล้ว`);

      setSelectedParticipantIds((currentIds) => [
        ...currentIds,
        newParticipant.id,
      ]);

      setParticipantAmounts((currentAmounts) => ({
        ...currentAmounts,
        [newParticipant.id]: "",
      }));

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
        const nextIds = currentIds.filter((id) => id !== participantId);

        setParticipantAmounts((currentAmounts) => {
          const next = { ...currentAmounts };
          delete next[participantId];
          return next;
        });

        return nextIds;
      }

      return [...currentIds, participantId];
    });
  }

  function handleParticipantAmountChange(participantId: string, value: string) {
    setParticipantAmounts((currentAmounts) => ({
      ...currentAmounts,
      [participantId]: value,
    }));
  }

  function toggleAllParticipants() {
    if (participants.length === 0) {
      return;
    }

    const allIds = participants.map((participant) => participant.id);
    const isAllSelected = allIds.every((participantId) =>
      selectedParticipantIds.includes(participantId),
    );

    if (isAllSelected) {
      setSelectedParticipantIds([]);
      return;
    }

    setSelectedParticipantIds(allIds);
  }

  function getCustomAssignedSatang() {
    return selectedParticipantIds.reduce((sum, participantId) => {
      const value = participantAmounts[participantId];

      if (!value) {
        return sum;
      }

      const baht = Number(value);

      if (Number.isNaN(baht) || baht < 0) {
        return sum;
      }

      return sum + Math.round(baht * 100);
    }, 0);
  }

  function getRemainingCustomSatang() {
    const totalSatang = Math.round(Number(amount || 0) * 100);

    return Math.max(totalSatang - getCustomAssignedSatang(), 0);
  }

  function getCustomPeopleWithoutAmount() {
    return selectedParticipantIds.filter(
      (participantId) => !participantAmounts[participantId],
    ).length;
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

    const amountSatang = Math.round(amountNumber * 100);

    const body: {
      description: string;
      amountSatang: number;
      paidByParticipantId: string;
      participantIds: string[];
      splitMode: "EQUAL" | "CUSTOM";
      participantAmounts?: Record<string, number | null>;
      serviceChargePercent?: number;
      serviceChargeMode?: "EQUAL" | "PROPORTIONAL";
      vatPercent?: number;
      vatMode?: "EQUAL" | "PROPORTIONAL";
    } = {
      description: trimmedDescription,
      amountSatang,
      paidByParticipantId,
      participantIds: selectedParticipantIds,
      splitMode,
    };

    if (splitMode === "CUSTOM") {
      const customAmounts: Record<string, number | null> = {};

      let assignedSatang = 0;

      for (const participantId of selectedParticipantIds) {
        const rawValue = participantAmounts[participantId];

        if (!rawValue) {
          customAmounts[participantId] = null;
          continue;
        }

        const numberValue = Number(rawValue);

        if (Number.isNaN(numberValue) || numberValue < 0) {
          setError("จำนวนเงินของสมาชิกแต่ละคนไม่ถูกต้อง");
          return;
        }

        const satang = Math.round(numberValue * 100);

        assignedSatang += satang;
        customAmounts[participantId] = satang;
      }

      if (assignedSatang > amountSatang) {
        setError("ยอดที่กำหนดให้สมาชิกมากกว่ายอดค่าใช้จ่ายทั้งหมด");
        return;
      }

      if (
        assignedSatang < amountSatang &&
        getCustomPeopleWithoutAmount() === 0
      ) {
        setError("ยอดที่กำหนดให้สมาชิกต้องรวมเท่ากับยอดค่าใช้จ่าย");
        return;
      }

      body.participantAmounts = customAmounts;
    }

    if (addServiceCharge) {
      const percent = Number(serviceChargePercent);

      if (Number.isNaN(percent) || percent < 0 || percent > 100) {
        setError("Service Charge ต้องอยู่ระหว่าง 0 - 100%");
        return;
      }

      body.serviceChargePercent = percent;
      body.serviceChargeMode = serviceChargeMode;
    }

    if (addVat) {
      const percent = Number(vatPercent);

      if (Number.isNaN(percent) || percent < 0 || percent > 100) {
        setError("VAT ต้องอยู่ระหว่าง 0 - 100%");
        return;
      }

      body.vatPercent = percent;
      body.vatMode = vatMode;
    }

    try {
      setCreatingExpense(true);
      setError("");
      setNotice("");

      let newExpense: Expense;
      if (editingExpenseId) {
        // Update existing
        newExpense = await api<Expense>(
          `/bills/${billId}/expenses/${editingExpenseId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(body),
          },
        );
        setExpenses((currentExpenses) =>
          currentExpenses.map((e) => (e.id === editingExpenseId ? newExpense : e)),
        );
        setNotice(`อัพเดตรายการ ${trimmedDescription} เรียบร้อยแล้ว`);
      } else {
        // Create new
        newExpense = await api<Expense>(`/bills/${billId}/expenses`, {
          method: "POST",
          token,
          body: JSON.stringify(body),
        });
        setExpenses((currentExpenses) => [newExpense, ...currentExpenses]);
        setNotice(`เพิ่มรายการ ${trimmedDescription} เรียบร้อยแล้ว`);
      }

      closeExpenseModal();

      setDescription("");
      setAmount("");
      setSplitMode("EQUAL");
      setParticipantAmounts({});
      setAddServiceCharge(false);
      setServiceChargePercent("10");
      setServiceChargeMode("EQUAL");
      setAddVat(false);
      setVatPercent("7");
      setVatMode("EQUAL");

      if (participants.length > 0) {
        setPaidByParticipantId(participants[0].id);

        setSelectedParticipantIds(
          participants.map((participant) => participant.id),
        );
      }
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

  function resetExpenseForm() {
    setDescription("");
    setAmount("");
    setSplitMode("EQUAL");
    setParticipantAmounts({});
    setAddServiceCharge(false);
    setServiceChargePercent("10");
    setServiceChargeMode("EQUAL");
    setAddVat(false);
    setVatPercent("7");
    setVatMode("EQUAL");
    setEditingExpenseId(null);

    if (participants.length > 0) {
      setSelectedParticipantIds(participants.map((participant) => participant.id));
      setPaidByParticipantId(participants[0].id);
    }
  }

  function openExpenseModal(expense?: Expense) {
    if (expense) {
      setDescription(expense.description);
      setAmount((expense.amountSatang / 100).toString());
      setPaidByParticipantId(expense.paidByParticipantId);
      setSelectedParticipantIds(expense.participants.map((p) => p.participantId));
      setSplitMode(expense.splitMode);
      setAddServiceCharge(Number(expense.serviceChargePercent) > 0);
      setServiceChargePercent(expense.serviceChargePercent.toString());
      setServiceChargeMode(expense.serviceChargeMode);
      setAddVat(Number(expense.vatPercent) > 0);
      setVatPercent(expense.vatPercent.toString());
      setVatMode(expense.vatMode);
      setEditingExpenseId(expense.id);
    } else {
      resetExpenseForm();
    }
    setShowExpenseModal(true);
  }

  function closeExpenseModal() {
    setShowExpenseModal(false);
    setTimeout(() => resetExpenseForm(), 300);
  }

  function openEditParticipant(participant: Participant) {
    setEditingParticipantId(participant.id);
    setEditedParticipantName(participant.name);
  }

  function closeEditParticipant() {
    setEditingParticipantId(null);
    setEditedParticipantName("");
  }

  async function handleUpdateParticipant() {
    if (!editingParticipantId) return;

    const trimmedName = editedParticipantName.trim();
    if (!trimmedName) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setUpdatingParticipant(true);
      setError("");
      setNotice("");

      await api(`/bills/${params.id}/participants/${editingParticipantId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: trimmedName }),
      });

      setParticipants((current) =>
        current.map((p) =>
          p.id === editingParticipantId ? { ...p, name: trimmedName } : p,
        ),
      );

      setNotice(`อัพเดตชื่อ ${trimmedName} เรียบร้อยแล้ว`);
      closeEditParticipant();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("ไม่สามารถอัพเดตสมาชิกได้");
      }
    } finally {
      setUpdatingParticipant(false);
    }
  }

  async function handleDeleteParticipant(participant: Participant) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setError("");
      setNotice("");

      await api(`/bills/${params.id}/participants/${participant.id}`, {
        method: "DELETE",
        token,
      });

      await loadBillDetail();
      setNotice(`ลบสมาชิก ${participant.name} และรายการที่เกี่ยวข้องเรียบร้อยแล้ว`);
      closeEditParticipant();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("ไม่สามารถลบสมาชิกได้");
      }
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setError("");
      setNotice("");

      await api(`/bills/${params.id}/expenses/${expenseId}`, {
        method: "DELETE",
        token,
      });

      setExpenses((current) => current.filter((e) => e.id !== expenseId));
      setNotice("ลบรายการเรียบร้อยแล้ว");
      setDeletingExpenseId(null);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("ไม่สามารถลบรายการได้");
      }
    }
  }

  async function copyShareLink() {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      setError("");
      setNotice("คัดลอกลิงก์เรียบร้อยแล้ว");
    } catch {
      setError("ไม่สามารถคัดลอกลิงก์ได้ กรุณาคัดลอกจาก URL บนเบราว์เซอร์");
      setNotice("");
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

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amountSatang,
    0,
  );

  const totalParticipants = participants.length;

  return (
    <main className="min-h-screen bg-[#f5f3ef] text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            ← กลับ
          </button>

          <button
            type="button"
            onClick={copyShareLink}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            แชร์ลิงก์
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                {bill.name}
              </h1>
            </div>

            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-left text-white sm:text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">
                total
              </p>
              <p className="mt-1 text-2xl font-bold">
                {formatAmount(totalExpenses)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                members
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {totalParticipants}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                expenses
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {expenses.length}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { id: "members", label: "สมาชิก" },
              { id: "expenses", label: "รายการ" },
              { id: "summary", label: "สรุป" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as "members" | "expenses" | "summary")}
                className={`rounded-2xl px-4 py-3 text-base font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "members" && (
          <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Manage</p>
                <h2 className="text-2xl font-bold text-slate-900">เพิ่ม/ลบสมาชิก</h2>
              </div>
            </div>

            <form onSubmit={handleAddParticipant} className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={participantName}
                onChange={(event) => setParticipantName(event.target.value)}
                placeholder="ชื่อสมาชิก"
                maxLength={100}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
              />
              <button
                type="submit"
                disabled={addingParticipant || !participantName.trim()}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[110px]"
              >
                {addingParticipant ? "..." : "เพิ่ม"}
              </button>
            </form>

            <div className="mt-5 space-y-2">
              {participants.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  ยังไม่มีสมาชิก
                </div>
              ) : (
                participants.map((participant) => (
                  <div key={participant.id}>
                    {editingParticipantId === participant.id ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <input
                          type="text"
                          value={editedParticipantName}
                          onChange={(e) => setEditedParticipantName(e.target.value)}
                          maxLength={100}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base outline-none transition focus:border-slate-400"
                        />
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={handleUpdateParticipant}
                            disabled={updatingParticipant || !editedParticipantName.trim()}
                            className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                          >
                            {updatingParticipant ? "..." : "บันทึก"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteParticipant(participant)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                          >
                            ลบ
                          </button>
                          <button
                            type="button"
                            onClick={closeEditParticipant}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openEditParticipant(participant)}
                        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <span className="font-medium text-slate-700">
                          {participant.name}
                        </span>
                        <span className="text-xs text-slate-400">แก้ไข →</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === "expenses" && (
          <div className="mt-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Quick add</p>
                  <h2 className="text-2xl font-bold text-slate-900">รายการค่าใช้จ่าย</h2>
                </div>
                <button
                  type="button"
                  onClick={() => openExpenseModal()}
                  disabled={participants.length === 0}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + เพิ่มรายการ
                </button>
              </div>

              <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-lg font-bold text-slate-900">รายการทั้งหมด</h3>
                {expenses.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    {participants.length === 0
                      ? "เพิ่มสมาชิกก่อนจึงจะเพิ่มรายการได้"
                      : "ยังไม่มีรายการค่าใช้จ่าย"}
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {expenses.map((expense) => (
                      <div key={expense.id}>
                        {deletingExpenseId === expense.id ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                            <p className="font-semibold text-red-700">ยืนยันการลบรายการนี้?</p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
                              >
                                ยืนยันลบ
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingExpenseId(null)}
                                className="flex-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => openExpenseModal(expense)}
                            className="group w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="text-base font-semibold text-slate-900">
                                  {expense.description}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                  จ่ายโดย {expense.paidBy.name}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingExpenseId(expense.id);
                                }}
                                className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100"
                              >
                                ลบ
                              </button>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                              <span>{formatAmount(expense.amountSatang)}</span>
                              <span className="text-xs text-slate-400">แก้ไข →</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {showExpenseModal && participants.length > 0 && (
              <div className="fixed inset-0 z-50 flex items-end bg-black/30 sm:items-center sm:justify-center">
                <div className="w-full max-w-[96vw] rounded-t-3xl border-t border-slate-200 bg-white p-5 shadow-lg sm:my-4 sm:max-h-[92vh] sm:max-w-2xl sm:overflow-y-auto sm:rounded-3xl sm:border sm:border-slate-200 sm:p-6 md:max-w-3xl">

                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-bold text-slate-900">
                      {editingExpenseId ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}
                    </h3>
                    <button
                      type="button"
                      onClick={closeExpenseModal}
                      className="text-slate-400 transition hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreateExpense} className="mt-6 space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        รายละเอียด
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="เช่น ค่าอาหารกลางวัน"
                        maxLength={200}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-slate-400 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        จำนวนเงิน
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-base outline-none transition focus:border-slate-400 focus:bg-white"
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                          บาท
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        ใครเป็นคนจ่าย
                      </label>
                      <select
                        value={paidByParticipantId}
                        onChange={(event) => setPaidByParticipantId(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-slate-400 focus:bg-white"
                      >
                        {participants.map((participant) => (
                          <option key={participant.id} value={participant.id}>
                            {participant.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-700">
                        วิธีแบ่งค่าใช้จ่าย
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setSplitMode("EQUAL")}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            splitMode === "EQUAL"
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="font-semibold">หารเท่ากัน</div>
                          <div className="mt-1 text-xs opacity-80">ทุกคนจ่ายเท่ากัน</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSplitMode("CUSTOM")}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            splitMode === "CUSTOM"
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="font-semibold">กำหนดเอง</div>
                          <div className="mt-1 text-xs opacity-80">
                            ใส่จำนวนบาททีละคน
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-700">
                          คนที่ร่วมจ่าย
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={toggleAllParticipants}
                            className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2"
                          >
                            {selectedParticipantIds.length === participants.length
                              ? "ยกเลิกทั้งหมด"
                              : "เลือกทั้งหมด"}
                          </button>
                          <span className="text-xs text-slate-500">
                            {selectedParticipantIds.length} คน
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {participants.map((participant) => {
                          const active = selectedParticipantIds.includes(participant.id);

                          return (
                            <button
                              key={participant.id}
                              type="button"
                              onClick={() => toggleParticipant(participant.id)}
                              className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                                active
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {participant.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {splitMode === "CUSTOM" && selectedParticipantIds.length > 0 && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-700">
                            กำหนดยอดคนละคน
                          </p>
                          <span className="text-xs text-slate-500">บาท</span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {selectedParticipantIds.map((participantId) => {
                            const participant = participants.find(
                              (item) => item.id === participantId,
                            );

                            if (!participant) {
                              return null;
                            }

                            return (
                              <div
                                key={participant.id}
                                className="grid grid-cols-[90px_1fr] items-center gap-3"
                              >
                                <span className="truncate text-sm font-medium text-slate-600">
                                  {participant.name}
                                </span>

                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={participantAmounts[participant.id] ?? ""}
                                  onChange={(event) =>
                                    handleParticipantAmountChange(
                                      participant.id,
                                      event.target.value,
                                    )
                                  }
                                  placeholder="0.00"
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base outline-none transition focus:border-slate-400"
                                />
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
                          <div className="flex items-center justify-between">
                            <span>กำหนดแล้ว</span>
                            <span className="font-semibold text-slate-800">
                              {formatAmount(getCustomAssignedSatang())}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <span>คงเหลือ</span>
                            <span className="font-semibold text-slate-800">
                              {formatAmount(getRemainingCustomSatang())}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={addServiceCharge}
                          onChange={(event) =>
                            setAddServiceCharge(event.target.checked)
                          }
                          className="h-4 w-4"
                        />
                        <span className="font-medium text-slate-700">
                          เพิ่ม Service Charge
                        </span>
                      </label>

                      {addServiceCharge && (
                        <div className="mt-4 space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={serviceChargePercent}
                              onChange={(event) =>
                                setServiceChargePercent(event.target.value)
                              }
                              className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-slate-400"
                            />
                            <span className="text-sm text-slate-500">%</span>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setServiceChargeMode("EQUAL")}
                              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                                serviceChargeMode === "EQUAL"
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              หารเท่ากัน
                            </button>
                            <button
                              type="button"
                              onClick={() => setServiceChargeMode("PROPORTIONAL")}
                              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                                serviceChargeMode === "PROPORTIONAL"
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              ตามสัดส่วน
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={addVat}
                          onChange={(event) => setAddVat(event.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="font-medium text-slate-700">เพิ่ม VAT</span>
                      </label>

                      {addVat && (
                        <div className="mt-4 space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={vatPercent}
                              onChange={(event) => setVatPercent(event.target.value)}
                              className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-slate-400"
                            />
                            <span className="text-sm text-slate-500">%</span>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setVatMode("EQUAL")}
                              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                                vatMode === "EQUAL"
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              หารเท่ากัน
                            </button>
                            <button
                              type="button"
                              onClick={() => setVatMode("PROPORTIONAL")}
                              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                                vatMode === "PROPORTIONAL"
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              ตามสัดส่วน
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          resetExpenseForm();
                          closeExpenseModal();
                        }}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={
                          creatingExpense ||
                          !description.trim() ||
                          !amount ||
                          selectedParticipantIds.length === 0
                        }
                        className="flex-1 rounded-2xl bg-slate-900 px-5 py-3.5 text-base font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {creatingExpense ? "กำลังบันทึก..." : editingExpenseId ? "อัพเดตรายการ" : "เพิ่มรายการ"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "summary" && (
          <div className="mt-6">
            {billSummary && (
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Settlement</p>
                    <h2 className="text-2xl font-bold text-slate-900">
                      สรุปยอดชำระ
                    </h2>
                  </div>
                </div>

                {billSummary.transactions.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700">
                    ทุกคนชำระยอดตรงกันแล้ว
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {billSummary.transactions.map((transaction, index) => (
                      <div
                        key={`${transaction.fromParticipantId}-${transaction.toParticipantId}-${index}`}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm text-slate-500">การโอน</p>
                          <p className="font-semibold text-slate-800">
                            {transaction.from ?? "คนที่จ่าย"} → {transaction.to ?? "คนที่รับ"}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-slate-900">
                          {formatAmount(transaction.amountSatang)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {billSummary.balances.map((balance) => {
                    const isPositive = balance.amountSatang > 0;
                    const isNegative = balance.amountSatang < 0;

                    return (
                      <div
                        key={balance.participantId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-800">
                            {balance.name ?? "สมาชิก"}
                          </p>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              isPositive
                                ? "bg-emerald-100 text-emerald-700"
                                : isNegative
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {isPositive ? "ได้รับ" : isNegative ? "ต้องจ่าย" : "สมดุล"}
                          </span>
                        </div>

                        <p className="mt-3 text-xl font-bold text-slate-900">
                          {formatAmount(Math.abs(balance.amountSatang))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
