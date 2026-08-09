"use client";

import { useEffect, useState, FormEvent } from "react";
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
}

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loadingHabits, setLoadingHabits] = useState(true);
  const [habitsLoadError, setHabitsLoadError] = useState(false);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [checkinError, setCheckinError] = useState<string | null>(null);

  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitDescription, setNewHabitDescription] = useState("");
  const [creatingHabit, setCreatingHabit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // TODO: quando existir um endpoint agregado de streak, substituir este
  // valor fixo pelo cálculo real de dias consecutivos do usuário.
  const streak = 1;

  useEffect(() => {
    async function loadHabits() {
      try {
        const res = await fetch("/api/habits");
        const data = await res.json();
        if (res.ok) {
          setHabits(data);
        } else {
          setHabitsLoadError(true);
        }
      } catch (err) {
        console.error("Erro ao carregar hábitos", err);
        setHabitsLoadError(true);
      } finally {
        setLoadingHabits(false);
      }
    }

    loadHabits();
  }, []);

  async function handleCheckIn(habitId: string) {
    setCheckinError(null);
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCheckinError(data.error ?? "Erro ao registrar check-in.");
        return;
      }

      setCheckedIn((prev) => new Set(prev).add(habitId));
    } catch (err) {
      console.error("Erro ao registrar check-in", err);
      setCheckinError("Erro ao registrar check-in.");
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
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newHabitName,
          description: newHabitDescription || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? "Erro ao criar hábito.");
        return;
      }

      setHabits((prev) => [data, ...prev]);
      setNewHabitName("");
      setNewHabitDescription("");
    } catch (err) {
      console.error("Erro ao criar hábito", err);
      setFormError("Erro ao criar hábito.");
    } finally {
      setCreatingHabit(false);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Rotina"
          title="Seu dia começa aqui"
          description="Acompanhe sua consistência e mantenha os hábitos importantes em movimento."
          actions={<Badge tone="success">Rotina ativa</Badge>}
        />
        <div className="dashboard-grid">
          {/* Coluna esquerda — ofensiva */}
          <Card className="streak-card" aria-label="Sequência atual">
            <span className="streak-number">{streak}</span>
            <span className="streak-label">
              {streak === 1 ? "dia consecutivo" : "dias consecutivos"}
            </span>
          </Card>

          {/* Coluna direita — hábitos diários */}
          <Card>
            <h2 className="card-title">Hábitos Diários</h2>

            {loadingHabits ? (
              <LoadingState title="Carregando hábitos..." />
            ) : habitsLoadError ? (
              <ErrorState
                title="Não foi possível carregar seus hábitos"
                description="Tente atualizar a página em alguns instantes."
              />
            ) : habits.length === 0 ? (
              <EmptyState
                title="Nenhum hábito cadastrado"
                description="Crie seu primeiro hábito no formulário abaixo para começar."
              />
            ) : (
              <ul className="habit-list">
                {habits.map((habit) => {
                  const isDone = checkedIn.has(habit.id);
                  return (
                    <li key={habit.id} className="habit-item">
                      <div>
                        <div className="habit-item-name">{habit.name}</div>
                        {habit.description && (
                          <div className="habit-item-desc">
                            {habit.description}
                          </div>
                        )}
                      </div>
                      <Button
                        variant={isDone ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => handleCheckIn(habit.id)}
                        disabled={isDone}
                      >
                        {isDone ? "Feito hoje" : "Check-in"}
                      </Button>
                    </li>
                  );
                })}
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
                    onChange={(e) => setNewHabitName(e.target.value)}
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
                    onChange={(e) => setNewHabitDescription(e.target.value)}
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
