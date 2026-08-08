"use client";

import { useEffect, useState, FormEvent } from "react";

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
        }
      } catch (err) {
        console.error("Erro ao carregar hábitos", err);
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
        <div className="dashboard-grid">
          {/* Coluna esquerda — ofensiva */}
          <div className="card streak-card">
            <span className="streak-number">{streak}</span>
            <span className="streak-label">
              {streak === 1 ? "dia consecutivo" : "dias consecutivos"}
            </span>
          </div>

          {/* Coluna direita — hábitos diários */}
          <div className="card">
            <h2 className="card-title">Hábitos Diários</h2>

            {loadingHabits ? (
              <p className="empty-state">Carregando hábitos...</p>
            ) : habits.length === 0 ? (
              <p className="empty-state">
                Nenhum hábito cadastrado ainda. Crie o primeiro abaixo.
              </p>
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
                      <button
                        type="button"
                        className={`habit-checkin-btn${isDone ? " done" : ""}`}
                        onClick={() => handleCheckIn(habit.id)}
                        disabled={isDone}
                      >
                        {isDone ? "Feito hoje" : "Check-in"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {checkinError && <p className="error-text">{checkinError}</p>}

            <form className="form" onSubmit={handleCreateHabit}>
              <div className="form-row">
                <input
                  type="text"
                  className="input"
                  placeholder="Nome do hábito"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                />
                <input
                  type="text"
                  className="input"
                  placeholder="Descrição (opcional)"
                  value={newHabitDescription}
                  onChange={(e) => setNewHabitDescription(e.target.value)}
                />
              </div>
              {formError && <p className="error-text">{formError}</p>}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creatingHabit}
              >
                {creatingHabit ? "Adicionando..." : "Adicionar hábito"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
