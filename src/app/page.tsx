"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { useLocalDateKey } from "@/lib/local-date";
import styles from "./dashboard.module.css";

interface DashboardHabit {
  id: string;
  name: string;
  description: string | null;
  checkedToday: boolean;
}

interface DashboardTask {
  id: string;
  title: string;
  goal: { id: string; title: string };
}

interface DashboardWorkout {
  id: string;
  name: string;
  completed: boolean;
  notes: string | null;
}

interface DashboardGoal {
  id: string;
  title: string;
  category: string;
  deadline: string | null;
  isOverdue: boolean;
  totalTasks: number;
  completedTasks: number;
  progress: number | null;
}

interface DashboardEvolution {
  id: string;
  date: string;
  weight: number | null;
  bodyFat: number | null;
  imc: number | null;
  shapeStatus: string | null;
}

interface DashboardData {
  date: string;
  today: {
    habits: DashboardHabit[];
    habitsCompleted: number;
    habitsTotal: number;
    pendingTasks: DashboardTask[];
    workouts: DashboardWorkout[];
  };
  finances: {
    balance: number;
    monthlyIncome: number;
    monthlyExpense: number;
    monthlyPendingCount: number;
  };
  goals: DashboardGoal[];
  evolution: DashboardEvolution | null;
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatDashboardDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function formatGoalDeadline(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatRecordDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
}

function getDayNarrative(
  openFocusCount: number,
  totalFocusCount: number,
  habitProgress: number
) {
  if (totalFocusCount === 0) {
    return {
      title: "Seu espaço está pronto para começar.",
      description:
        "Adicione um hábito, treino ou tarefa para transformar intenção em um próximo passo visível.",
    };
  }

  if (openFocusCount === 0) {
    return {
      title: "Dia em ordem. Espaço para avançar.",
      description:
        "As prioridades visíveis estão resolvidas. Use o restante do dia para consolidar uma meta importante.",
    };
  }

  if (habitProgress >= 75) {
    return {
      title: "Bom ritmo. Feche o que importa.",
      description:
        "Sua consistência já aparece no dia. Agora, concentre energia nas poucas frentes que ainda estão abertas.",
    };
  }

  return {
    title: "Clareza primeiro. Movimento depois.",
    description:
      "Comece por uma ação curta, ganhe tração e deixe o restante do dia mais leve.",
  };
}

async function fetchDashboard(date: string): Promise<DashboardData> {
  const response = await fetch(`/api/dashboard?date=${date}`, {
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Erro ao carregar dashboard.");
  }

  return data;
}

export default function Home() {
  const dateKey = useLocalDateKey();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [checkingHabitId, setCheckingHabitId] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  const habitProgress = dashboard?.today.habitsTotal
    ? Math.round(
        (dashboard.today.habitsCompleted / dashboard.today.habitsTotal) * 100
      )
    : 0;
  const openHabits = dashboard
    ? dashboard.today.habits.filter((habit) => !habit.checkedToday).length
    : 0;
  const openWorkouts = dashboard
    ? dashboard.today.workouts.filter((workout) => !workout.completed).length
    : 0;
  const openFocusCount = dashboard
    ? openHabits + openWorkouts + dashboard.today.pendingTasks.length
    : 0;
  const totalFocusCount = dashboard
    ? dashboard.today.habits.length +
      dashboard.today.workouts.length +
      dashboard.today.pendingTasks.length
    : 0;
  const dayNarrative = getDayNarrative(
    openFocusCount,
    totalFocusCount,
    habitProgress
  );

  useEffect(() => {
    if (!dateKey) return;

    let active = true;

    fetchDashboard(dateKey)
      .then((data) => {
        if (!active) return;
        setDashboard(data);
        setLoadError(false);
      })
      .catch((error) => {
        console.error("Erro ao carregar dashboard", error);
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dateKey]);

  async function retryDashboard() {
    if (!dateKey) return;

    setLoading(true);
    setLoadError(false);

    try {
      setDashboard(await fetchDashboard(dateKey));
    } catch (error) {
      console.error("Erro ao recarregar dashboard", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(habitId: string) {
    if (!dateKey) return;

    setCheckinError(null);
    setCheckingHabitId(habitId);

    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitId, date: dateKey }),
      });
      const data = await response.json();

      if (!response.ok) {
        setCheckinError(data.error ?? "Erro ao registrar check-in.");
        return;
      }

      setDashboard((current) => {
        if (!current) return current;
        const target = current.today.habits.find((habit) => habit.id === habitId);
        if (!target || target.checkedToday) return current;

        return {
          ...current,
          today: {
            ...current.today,
            habitsCompleted: current.today.habitsCompleted + 1,
            habits: current.today.habits.map((habit) =>
              habit.id === habitId ? { ...habit, checkedToday: true } : habit
            ),
          },
        };
      });
    } catch (error) {
      console.error("Erro ao registrar check-in pelo dashboard", error);
      setCheckinError("Erro ao registrar check-in.");
    } finally {
      setCheckingHabitId(null);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Dashboard"
          title="Seu dia, em movimento"
          description="Prioridades, progresso e decisões reunidos em uma leitura clara do que importa agora."
          actions={
            <Badge tone="accent">
              {dateKey ? formatDashboardDate(dateKey) : "Data local"}
            </Badge>
          }
        />

        {loading ? (
          <LoadingState
            title="Montando seu dia..."
            description="Reunindo hábitos, metas, treinos e finanças."
          />
        ) : loadError || !dashboard ? (
          <ErrorState
            title="Não foi possível carregar o Dashboard"
            description="Tente novamente. Nenhum dado foi alterado."
            action={<Button onClick={retryDashboard}>Tentar novamente</Button>}
          />
        ) : (
          <>
            <section className={styles.pulseCard} aria-labelledby="day-pulse-title">
              <div className={styles.pulseCopy}>
                <span className={styles.pulseEyebrow}>Pulso do dia</span>
                <h2 id="day-pulse-title" className={styles.pulseTitle}>
                  {dayNarrative.title}
                </h2>
                <p className={styles.pulseDescription}>
                  {dayNarrative.description}
                </p>
                <div className={styles.pulseMeta} aria-label="Frentes do dia">
                  <span>
                    <strong>{openFocusCount}</strong> frentes abertas
                  </span>
                  <span>
                    <strong>{dashboard.today.pendingTasks.length}</strong> tarefas
                  </span>
                  <span>
                    <strong>{openWorkouts}</strong> treinos
                  </span>
                </div>
              </div>

              <div className={styles.pulseProgress}>
                <span className={styles.pulseValue}>
                  {habitProgress}<small>%</small>
                </span>
                <span className={styles.pulseLabel}>ritmo dos hábitos</span>
                <div
                  className={styles.pulseTrack}
                  role="progressbar"
                  aria-label="Hábitos concluídos hoje"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={habitProgress}
                >
                  <span
                    className={styles.pulseFill}
                    style={{ width: `${habitProgress}%` }}
                  />
                </div>
              </div>
            </section>

            <section className={styles.metricGrid} aria-label="Resumo do dia">
              <Card className={`${styles.metricCard} ${styles.metricCardAccent}`}>
                <span className={styles.metricIndex} aria-hidden="true">01</span>
                <span className={styles.metricLabel}>Hábitos hoje</span>
                <strong className={styles.metricValue}>
                  {dashboard.today.habitsCompleted}/{dashboard.today.habitsTotal}
                </strong>
                <span className={styles.metricHint}>concluídos no dia</span>
              </Card>
              <Card className={styles.metricCard}>
                <span className={styles.metricIndex} aria-hidden="true">02</span>
                <span className={styles.metricLabel}>Saldo atual</span>
                <strong className={styles.metricValue}>
                  {brlFormatter.format(dashboard.finances.balance)}
                </strong>
                <span className={styles.metricHint}>somente movimentos pagos</span>
              </Card>
              <Card className={styles.metricCard}>
                <span className={styles.metricIndex} aria-hidden="true">03</span>
                <span className={styles.metricLabel}>Receitas pagas</span>
                <strong className={styles.metricValue}>
                  {brlFormatter.format(dashboard.finances.monthlyIncome)}
                </strong>
                <span className={styles.metricHint}>neste mês</span>
              </Card>
              <Card className={styles.metricCard}>
                <span className={styles.metricIndex} aria-hidden="true">04</span>
                <span className={styles.metricLabel}>Despesas pagas</span>
                <strong className={styles.metricValue}>
                  {brlFormatter.format(dashboard.finances.monthlyExpense)}
                </strong>
                <span className={styles.metricHint}>neste mês</span>
              </Card>
            </section>

            <div className={styles.contentGrid}>
              <Card>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.sectionEyebrow}>Agora</span>
                    <h2 className={styles.sectionTitle}>Prioridades</h2>
                  </div>
                  <span className={styles.itemMeta}>Seu foco de hoje</span>
                </div>

                <section className={styles.todayBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.subheading}>Hábitos de hoje</h3>
                    <Link href="/habitos" className={styles.sectionLink}>
                      Gerenciar hábitos
                    </Link>
                  </div>
                  {dashboard.today.habits.length === 0 ? (
                    <EmptyState
                      title="Nenhum hábito ativo"
                      description="Crie um hábito para ele aparecer no seu dia."
                      action={
                        <Link href="/habitos" className={styles.sectionLink}>
                          Ir para hábitos
                        </Link>
                      }
                    />
                  ) : (
                    <ul className={styles.list}>
                      {dashboard.today.habits.map((habit) => (
                        <li key={habit.id} className={styles.listItem}>
                          <div className={styles.itemCopy}>
                            <span className={styles.itemTitle}>{habit.name}</span>
                            {habit.description && (
                              <span className={styles.itemMeta}>
                                {habit.description}
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={habit.checkedToday ? "secondary" : "outline"}
                            disabled={habit.checkedToday}
                            isLoading={checkingHabitId === habit.id}
                            loadingLabel="Registrando..."
                            onClick={() => handleCheckIn(habit.id)}
                          >
                            {habit.checkedToday ? "Feito hoje" : "Check-in"}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {checkinError && (
                    <p className={styles.errorText}>{checkinError}</p>
                  )}
                </section>

                <section className={styles.todayBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.subheading}>Treinos planejados</h3>
                    <Link href="/treinos" className={styles.sectionLink}>
                      Abrir treinos
                    </Link>
                  </div>
                  {dashboard.today.workouts.length === 0 ? (
                    <EmptyState
                      title="Nenhum treino para hoje"
                      description="Seu planejamento atual não possui treino cadastrado para este dia."
                    />
                  ) : (
                    <ul className={styles.list}>
                      {dashboard.today.workouts.map((workout) => (
                        <li key={workout.id} className={styles.listItem}>
                          <div className={styles.itemCopy}>
                            <span className={styles.itemTitle}>{workout.name}</span>
                            {workout.notes && (
                              <span className={styles.itemMeta}>{workout.notes}</span>
                            )}
                          </div>
                          <Badge tone={workout.completed ? "success" : "accent"}>
                            {workout.completed ? "Concluído" : "Planejado"}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className={styles.todayBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.subheading}>Tarefas pendentes</h3>
                    <Link href="/metas" className={styles.sectionLink}>
                      Abrir metas
                    </Link>
                  </div>
                  {dashboard.today.pendingTasks.length === 0 ? (
                    <EmptyState
                      title="Nenhuma tarefa pendente"
                      description="As metas ativas não possuem tarefas abertas no momento."
                    />
                  ) : (
                    <ul className={styles.list}>
                      {dashboard.today.pendingTasks.map((task) => (
                        <li key={task.id} className={styles.listItem}>
                          <div className={styles.itemCopy}>
                            <span className={styles.itemTitle}>{task.title}</span>
                            <span className={styles.itemMeta}>
                              Meta: {task.goal.title}
                            </span>
                          </div>
                          <Badge tone="warning">Pendente</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </Card>

              <div className={styles.stack}>
                <Card>
                  <div className={styles.sectionHeader}>
                    <div>
                      <span className={styles.sectionEyebrow}>Horizonte</span>
                      <h2 className={styles.sectionTitle}>Metas em movimento</h2>
                    </div>
                    <Link href="/metas" className={styles.sectionLink}>
                      Ver todas
                    </Link>
                  </div>
                  {dashboard.goals.length === 0 ? (
                    <EmptyState
                      title="Nenhuma meta ativa"
                      description="Crie uma meta para acompanhar seu avanço aqui."
                    />
                  ) : (
                    <div className={styles.goalList}>
                      {dashboard.goals.map((goal) => (
                        <article key={goal.id} className={styles.goalItem}>
                          <div className={styles.goalTopline}>
                            <div>
                              <h3 className={styles.goalTitle}>{goal.title}</h3>
                              <span className={styles.goalCategory}>
                                {goal.category}
                              </span>
                              {goal.deadline && (
                                <span className={styles.goalDeadline}>
                                  Prazo: {formatGoalDeadline(goal.deadline)}
                                </span>
                              )}
                            </div>
                            <Badge
                              tone={
                                goal.isOverdue
                                  ? "danger"
                                  : goal.progress === 100
                                    ? "success"
                                    : "accent"
                              }
                            >
                              {goal.isOverdue
                                ? "Atrasada"
                                : goal.progress == null
                                  ? "Sem tarefas"
                                  : `${goal.progress}%`}
                            </Badge>
                          </div>
                          {goal.progress != null && (
                            <>
                              <div className={styles.progressTrack}>
                                <div
                                  className={styles.progressFill}
                                  style={{ width: `${goal.progress}%` }}
                                />
                              </div>
                              <div className={styles.goalStats}>
                                <span>
                                  {goal.completedTasks}/{goal.totalTasks} tarefas
                                </span>
                                <span>{goal.progress}%</span>
                              </div>
                            </>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </Card>

                <Card>
                  <div className={styles.sectionHeader}>
                    <div>
                      <span className={styles.sectionEyebrow}>Recursos</span>
                      <h2 className={styles.sectionTitle}>Financeiro</h2>
                    </div>
                    <Link href="/financas" className={styles.sectionLink}>
                      Abrir finanças
                    </Link>
                  </div>
                  <div className={styles.financeGrid}>
                    <div className={styles.detailStat}>
                      <span className={styles.detailLabel}>Receitas pagas</span>
                      <strong className={styles.detailValue}>
                        {brlFormatter.format(dashboard.finances.monthlyIncome)}
                      </strong>
                    </div>
                    <div className={styles.detailStat}>
                      <span className={styles.detailLabel}>Despesas pagas</span>
                      <strong className={styles.detailValue}>
                        {brlFormatter.format(dashboard.finances.monthlyExpense)}
                      </strong>
                    </div>
                  </div>
                  <p className={styles.pendingNotice}>
                    {dashboard.finances.monthlyPendingCount === 0
                      ? "Nenhum lançamento pendente neste mês."
                      : `${dashboard.finances.monthlyPendingCount} lançamento(s) pendente(s) neste mês — não incluídos no saldo atual.`}
                  </p>
                </Card>

                <Card>
                  <div className={styles.sectionHeader}>
                    <div>
                      <span className={styles.sectionEyebrow}>Corpo</span>
                      <h2 className={styles.sectionTitle}>Evolução recente</h2>
                    </div>
                    <Link href="/treinos" className={styles.sectionLink}>
                      Ver evolução
                    </Link>
                  </div>
                  {!dashboard.evolution ? (
                    <EmptyState
                      title="Nenhum registro físico"
                      description="Registre sua evolução para acompanhar os dados mais recentes aqui."
                    />
                  ) : (
                    <>
                      <div className={styles.evolutionGrid}>
                        <div className={styles.detailStat}>
                          <span className={styles.detailLabel}>Peso</span>
                          <strong className={styles.detailValue}>
                            {dashboard.evolution.weight == null
                              ? "—"
                              : `${dashboard.evolution.weight} kg`}
                          </strong>
                        </div>
                        <div className={styles.detailStat}>
                          <span className={styles.detailLabel}>IMC</span>
                          <strong className={styles.detailValue}>
                            {dashboard.evolution.imc ?? "—"}
                          </strong>
                        </div>
                        <div className={styles.detailStat}>
                          <span className={styles.detailLabel}>Gordura corporal</span>
                          <strong className={styles.detailValue}>
                            {dashboard.evolution.bodyFat == null
                              ? "—"
                              : `${dashboard.evolution.bodyFat}%`}
                          </strong>
                        </div>
                        <div className={styles.detailStat}>
                          <span className={styles.detailLabel}>Shape</span>
                          <strong className={styles.detailValue}>
                            {dashboard.evolution.shapeStatus ?? "—"}
                          </strong>
                        </div>
                      </div>
                      <p className={styles.pendingNotice}>
                        Último registro: {formatRecordDate(dashboard.evolution.date)}
                      </p>
                    </>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
