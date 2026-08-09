"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
} from "@/components/ui";

interface Habit {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  active: boolean;
  checkedToday: boolean;
}

interface HabitSummary {
  completedToday: number;
  totalActive: number;
  activeDays7: number;
}

interface HabitSummaryResponse {
  date: string;
  habits: Habit[];
  summary: HabitSummary;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchHabitSummary(date: string) {
  const response = await fetch(`/api/habits/summary?date=${date}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Erro ao carregar hábitos.");
  }

  return data as HabitSummaryResponse;
}

const emptySummary: HabitSummary = {
  completedToday: 0,
  totalActive: 0,
  activeDays7: 0,
};

export default function HabitosPage() {
  const todayKey = localDateKey();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [summary, setSummary] = useState<HabitSummary>(emptySummary);
  const [loadingHabits, setLoadingHabits] = useState(true);
  const [habitsLoadError, setHabitsLoadError] = useState(false);
  const [updatingHabitId, setUpdatingHabitId] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitDescription, setNewHabitDescription] = useState("");
  const [creatingHabit, setCreatingHabit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchHabitSummary(todayKey)
      .then((data) => {
        if (cancelled) return;
        setHabits(data.habits);
        setSummary(data.summary);
      })
      .catch((error) => {
        console.error("Erro ao carregar hábitos", error);
        if (!cancelled) setHabitsLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingHabits(false);
      });

    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  async function refreshSummary() {
    const data = await fetchHabitSummary(todayKey);
    setHabits(data.habits);
    setSummary(data.summary);
    setHabitsLoadError(false);
  }

  async function handleCheckIn(habitId: string) {
    setCheckinError(null);
    setUpdatingHabitId(habitId);

    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitId, date: todayKey }),
      });
      const data = await response.json();

      if (!response.ok) {
        setCheckinError(data.error ?? "Erro ao registrar check-in.");
        return;
      }

      await refreshSummary();
    } catch (error) {
      console.error("Erro ao registrar check-in", error);
      setCheckinError("Erro ao registrar check-in.");
    } finally {
      setUpdatingHabitId(null);
    }
  }

  async function handleCreateHabit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!newHabitName.trim()) {
      setFormError("Informe um nome para o hábito.");
      return;
    }

    setCreatingHabit(true);
    try {
      const response = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newHabitName,
          description: newHabitDescription.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? "Erro ao criar hábito.");
        return;
      }

      setNewHabitName("");
      setNewHabitDescription("");
      await refreshSummary();
    } catch (error) {
      console.error("Erro ao criar hábito", error);
      setFormError("Erro ao criar hábito.");
    } finally {
      setCreatingHabit(false);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Hábitos"
          title="Sua rotina em movimento"
          description="Faça o check-in do dia e acompanhe sua presença real na rotina, sem métricas artificiais."
          actions={
            <Badge tone="success">
              {summary.completedToday}/{summary.totalActive} hoje
            </Badge>
          }
        />

        <div className="dashboard-grid">
          <Card className="streak-card" aria-label="Consistência recente">
            <span className="streak-number">{summary.activeDays7}/7</span>
            <span className="streak-label">
              dias com pelo menos um check-in nos últimos 7 dias
            </span>
          </Card>

          <Card>
            <h2 className="card-title">Hábitos diários</h2>

            {loadingHabits ? (
              <LoadingState title="Carregando hábitos..." />
            ) : habitsLoadError ? (
              <ErrorState
                title="Não foi possível carregar seus hábitos"
                description="Tente atualizar a página em alguns instantes."
              />
            ) : habits.length === 0 ? (
              <EmptyState
                title="Nenhum hábito ativo"
                description="Crie seu primeiro hábito no formulário abaixo para começar."
              />
            ) : (
              <ul className="habit-list">
                {habits.map((habit) => (
                  <li key={habit.id} className="habit-item">
                    <div>
                      <div className="habit-item-name">{habit.name}</div>
                      {habit.description && (
                        <div className="habit-item-desc">{habit.description}</div>
                      )}
                    </div>
                    <Button
                      variant={habit.checkedToday ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => handleCheckIn(habit.id)}
                      disabled={habit.checkedToday || updatingHabitId !== null}
                      isLoading={updatingHabitId === habit.id}
                      loadingLabel="Registrando..."
                    >
                      {habit.checkedToday ? "Feito hoje" : "Check-in"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {checkinError && <p className="error-text">{checkinError}</p>}

            <form className="form" onSubmit={handleCreateHabit}>
              <div className="form-row">
                <FormField label="Nome do hábito" htmlFor="habit-name">
                  <Input
                    id="habit-name"
                    type="text"
                    placeholder="Ex: Ler por 20 minutos"
                    value={newHabitName}
                    onChange={(event) => setNewHabitName(event.target.value)}
                    disabled={creatingHabit}
                  />
                </FormField>
                <FormField
                  label="Descrição"
                  htmlFor="habit-description"
                  hint="Opcional"
                >
                  <Input
                    id="habit-description"
                    type="text"
                    placeholder="Como você quer praticar?"
                    value={newHabitDescription}
                    onChange={(event) => setNewHabitDescription(event.target.value)}
                    disabled={creatingHabit}
                  />
                </FormField>
              </div>
              {formError && <p className="error-text">{formError}</p>}
              <Button
                type="submit"
                isLoading={creatingHabit}
                loadingLabel="Adicionando..."
              >
                Adicionar hábito
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
