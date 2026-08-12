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
import { useLocalDateKey } from "@/lib/local-date";
import styles from "./habits-v3.module.css";

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
  const todayKey = useLocalDateKey();
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
    if (!todayKey) return;

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
    if (!todayKey) return;

    const data = await fetchHabitSummary(todayKey);
    setHabits(data.habits);
    setSummary(data.summary);
    setHabitsLoadError(false);
  }

  async function handleCheckIn(habitId: string) {
    if (!todayKey) return;

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

  const summaryUnavailable = !todayKey || loadingHabits || habitsLoadError;
  const activeDaysPercent = Math.min(100, Math.max(0, (summary.activeDays7 / 7) * 100));
  const todayPercent =
    summary.totalActive === 0
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            Math.round((summary.completedToday / summary.totalActive) * 100)
          )
        );
  const remainingToday = Math.max(
    0,
    summary.totalActive - summary.completedToday
  );
  const todayNarrative =
    summaryUnavailable
      ? {
          title: "Lendo o ritmo de hoje.",
          description:
            "O resumo aparece assim que os hábitos do dia estiverem disponíveis.",
        }
      : summary.totalActive === 0
      ? {
          title: "O ritmo começa quando cabe no dia.",
          description:
            "Crie um compromisso simples para transformar intenção em presença observável.",
        }
      : remainingToday === 0
        ? {
            title: "O combinado de hoje está em dia.",
            description:
              "Todos os hábitos ativos receberam presença hoje. Amanhã, o ritmo recomeça sem dívida acumulada.",
          }
        : summary.completedToday === 0
          ? {
              title: "Um gesto coloca a rotina em movimento.",
              description:
                "Escolha um hábito possível e registre a prática quando ela realmente acontecer.",
            }
          : {
              title: "A rotina já ganhou movimento.",
              description:
                "Continue no que ainda faz sentido hoje; progresso real não precisa parecer perfeito.",
            };

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Hábitos"
          title="Sua rotina em movimento"
          description="Faça o check-in do dia e acompanhe sua presença real na rotina, sem métricas artificiais."
          actions={
            <Badge tone="success">
              {summaryUnavailable
                ? "— hoje"
                : `${summary.completedToday}/${summary.totalActive} hoje`}
            </Badge>
          }
        />

        <div className={`dashboard-grid ${styles.layout}`}>
          <Card
            className={`streak-card ${styles.summaryCard}`}
            aria-labelledby="habit-rhythm-title"
            aria-busy={loadingHabits}
          >
            <div className={styles.rhythmCopy}>
              <span className={styles.summaryEyebrow}>Ritmo de hoje</span>
              <h2 id="habit-rhythm-title" className={styles.rhythmTitle}>
                {todayNarrative.title}
              </h2>
              <p className={styles.rhythmDescription}>
                {todayNarrative.description}
              </p>
              <div className={styles.rhythmMeta} aria-label="Resumo dos hábitos de hoje">
                <span>
                  <strong>{summaryUnavailable ? "—" : remainingToday}</strong>{" "}
                  {remainingToday === 1 ? "hábito em aberto" : "hábitos em aberto"}
                </span>
                <span>
                  <strong>{summaryUnavailable ? "—" : summary.totalActive}</strong> ativos
                </span>
              </div>
            </div>

            <div className={styles.todayProgress}>
              <span className={styles.todayValue}>
                {summaryUnavailable ? "—" : todayPercent}
                {!summaryUnavailable && <small>%</small>}
              </span>
              <span className={styles.todayLabel}>concluído hoje</span>
              <div
                className={styles.summaryTrack}
                role="progressbar"
                aria-label="Hábitos concluídos hoje"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={summaryUnavailable ? undefined : todayPercent}
              >
                <div
                  className={styles.summaryFill}
                  style={{ width: `${todayPercent}%` }}
                />
              </div>
            </div>

            <div className={styles.recentPresence}>
              <span className={styles.presenceLabel}>Presença recente</span>
              <span className={`streak-number ${styles.summaryValue}`}>
                {summaryUnavailable ? "—" : summary.activeDays7}
                {!summaryUnavailable && <small>/7</small>}
              </span>
              <span className={`streak-label ${styles.summaryLabel}`}>
                dias com pelo menos um check-in
              </span>
              <div
                className={styles.presenceTrack}
                role="progressbar"
                aria-label="Dias com check-in nos últimos sete dias"
                aria-valuemin={0}
                aria-valuemax={7}
                aria-valuenow={summaryUnavailable ? undefined : summary.activeDays7}
              >
                <div
                  className={styles.presenceFill}
                  style={{ width: `${activeDaysPercent}%` }}
                />
              </div>
            </div>
          </Card>

          <Card className={styles.mainCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={`card-title ${styles.sectionTitle}`}>Hábitos diários</h2>
                <p className={styles.sectionMeta}>
                  Conclua o que está ativo hoje e mantenha sua rotina observável.
                </p>
              </div>
              <Badge tone="accent">{summary.totalActive} ativos</Badge>
            </div>

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
              <ul className={`habit-list ${styles.habitList}`}>
                {habits.map((habit, index) => (
                  <li
                    key={habit.id}
                    className={`habit-item ${styles.habitItem} ${
                      habit.checkedToday ? styles.habitItemDone : ""
                    }`}
                  >
                    <div className={styles.habitIdentity}>
                      <span className={styles.habitIndex} aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className={styles.habitCopy}>
                        <div className={`habit-item-name ${styles.habitName}`}>
                          {habit.name}
                        </div>
                        {habit.description && (
                          <div className={`habit-item-desc ${styles.habitDescription}`}>
                            {habit.description}
                          </div>
                        )}
                      </div>
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

            {checkinError && (
              <p className={`error-text ${styles.errorText}`} role="alert">
                {checkinError}
              </p>
            )}

            <div className={styles.formPanel}>
              <div className={styles.formIntro}>
                <h3 className={styles.formTitle}>Adicionar hábito</h3>
                <p className={styles.formDescription}>
                  Crie um compromisso simples e mensurável para aparecer na rotina diária.
                </p>
              </div>
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
                {formError && (
                  <p className={`error-text ${styles.errorText}`} role="alert">
                    {formError}
                  </p>
                )}
                <Button
                  type="submit"
                  isLoading={creatingHabit}
                  loadingLabel="Adicionando..."
                >
                  Adicionar hábito
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
