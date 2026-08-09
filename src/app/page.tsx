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

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  const [dateKey] = useState(localDateKey);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [checkingHabitId, setCheckingHabitId] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  useEffect(() => {
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
          title="Hoje no Supreme"
          description="Uma visão operacional do que pede sua atenção agora, sem misturar planejamento com dados já realizados."
          actions={<Badge tone="accent">{formatDashboardDate(dateKey)}</Badge>}
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
            <section className={styles.metricGrid} aria-label="Resumo do dia">
              <Card className={styles.metricCard}>
                <span className={styles.metricLabel}>Hábitos hoje</span>
                <strong className={styles.metricValue}>
                  {dashboard.today.habitsCompleted}/{dashboard.today.habitsTotal}
                </strong>
                <span className={styles.metricHint}>concluídos no dia</span>
              </Card>
              <Card className={styles.metricCard}>
                <span className={styles.metricLabel}>Saldo atual</span>
                <strong className={styles.metricValue}>
                  {brlFormatter.format(dashboard.finances.balance)}
                </strong>
                <span className={styles.metricHint}>somente movimentos pagos</span>
              </Card>
              <Card className={styles.metricCard}>
                <span className={styles.metricLabel}>Receitas pagas</span>
                <strong className={styles.metricValue}>
                  {brlFormatter.format(dashboard.finances.monthlyIncome)}
                </strong>
                <span className={styles.metricHint}>neste mês</span>
              </Card>
              <Card className={styles.metricCard}>
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
                  <h2 className={styles.sectionTitle}>Prioridades</h2>
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
                    <h2 className={styles.sectionTitle}>Metas em movimento</h2>
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
                    <h2 className={styles.sectionTitle}>Financeiro</h2>
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
                    <h2 className={styles.sectionTitle}>Evolução recente</h2>
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
