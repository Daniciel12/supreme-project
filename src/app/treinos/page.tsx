"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
import styles from "./treinos.module.css";

const DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"] as const;
const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  DOM: "Domingo",
  SEG: "Segunda",
  TER: "Terça",
  QUA: "Quarta",
  QUI: "Quinta",
  SEX: "Sexta",
  SAB: "Sábado",
};

interface PhysicalRecord {
  id: string;
  date: string;
  weight: number | null;
  height: number | null;
  bodyFat: number | null;
  imc: number | null;
  shapeStatus: string | null;
  notes: string | null;
}

interface Workout {
  id: string;
  name: string;
  dayOfWeek: string;
  notes?: string | null;
  completed: boolean;
}

interface WorkoutSummary {
  activeDaysLast7: number;
  completionsLast7: number;
}

function dayForDate(date: string) {
  return DAYS[new Date(`${date}T00:00:00`).getDay()];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(value)
  );
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export default function TreinosPage() {
  const todayKey = useLocalDateKey();
  const [selectedDateOverride, setSelectedDateOverride] = useState<string | null>(null);
  const selectedDate = selectedDateOverride ?? todayKey ?? "";
  const selectedDay = useMemo(
    () => (selectedDate ? dayForDate(selectedDate) : DAYS[0]),
    [selectedDate]
  );

  const [records, setRecords] = useState<PhysicalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [recordsLoadError, setRecordsLoadError] = useState(false);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [recordDateOverride, setRecordDateOverride] = useState<string | null>(null);
  const recordDate = recordDateOverride ?? todayKey ?? "";
  const [recordNotes, setRecordNotes] = useState("");
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [summary, setSummary] = useState<WorkoutSummary>({
    activeDaysLast7: 0,
    completionsLast7: 0,
  });
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [workoutsLoadError, setWorkoutsLoadError] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [updatingWorkoutId, setUpdatingWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/physical-records")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error("records");
        if (active) setRecords(data);
      })
      .catch(() => {
        if (active) setRecordsLoadError(true);
      })
      .finally(() => {
        if (active) setLoadingRecords(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedDate) return;

    let active = true;

    Promise.all([
      fetch(`/api/workouts?date=${selectedDate}`),
      fetch(`/api/workouts/summary?date=${selectedDate}`),
    ])
      .then(async ([workoutsResponse, summaryResponse]) => {
        const [workoutsData, summaryData] = await Promise.all([
          workoutsResponse.json(),
          summaryResponse.json(),
        ]);

        if (!workoutsResponse.ok || !summaryResponse.ok) throw new Error("workouts");
        if (!active) return;

        setWorkouts(workoutsData);
        setSummary(summaryData);
        setWorkoutsLoadError(false);
      })
      .catch(() => {
        if (active) setWorkoutsLoadError(true);
      })
      .finally(() => {
        if (active) setLoadingWorkouts(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDate]);

  const latestRecord = records[0] ?? null;
  const previousRecord = records[1] ?? null;
  const weightDelta =
    latestRecord?.weight != null && previousRecord?.weight != null
      ? latestRecord.weight - previousRecord.weight
      : null;

  const dayWorkouts = workouts.filter((workout) => workout.dayOfWeek === selectedDay);
  const completedOnDate = dayWorkouts.filter((workout) => workout.completed).length;
  const sessionUnavailable = !selectedDate || loadingWorkouts || workoutsLoadError;
  const physicalRecordUnavailable = loadingRecords || recordsLoadError;
  const sessionPercent =
    dayWorkouts.length === 0
      ? 0
      : Math.min(
          100,
          Math.max(0, Math.round((completedOnDate / dayWorkouts.length) * 100))
        );
  const activeDaysPercent = Math.min(
    100,
    Math.max(0, (summary.activeDaysLast7 / 7) * 100)
  );
  const remainingOnDate = Math.max(0, dayWorkouts.length - completedOnDate);
  const selectedDateLabel = selectedDate ? formatDate(selectedDate) : "data selecionada";
  const sessionNarrative =
    sessionUnavailable
      ? {
          title: "Lendo o pulso da sessão.",
          description:
            "A visão do treino aparece assim que a rotina da data estiver disponível.",
        }
      : dayWorkouts.length === 0
        ? {
            title: "O próximo movimento ainda está em aberto.",
            description:
              "Defina uma sessão possível para transformar intenção física em presença registrada.",
          }
        : remainingOnDate === 0
          ? {
              title: "A sessão planejada foi cumprida.",
              description:
                "Todo o treino previsto para a data recebeu execução. O corpo evolui no acúmulo dessas presenças.",
            }
          : completedOnDate === 0
            ? {
                title: "A sessão começa no primeiro bloco.",
                description:
                  "Escolha o treino que cabe agora e registre somente o que realmente foi executado.",
              }
            : {
                title: "O treino já ganhou movimento.",
                description:
                  "A sessão está em curso; conclua o que ainda faz sentido sem perder a qualidade da execução.",
              };

  function handleDateChange(value: string) {
    setLoadingWorkouts(true);
    setSelectedDateOverride(value);
  }

  async function refreshRecords() {
    const response = await fetch("/api/physical-records");
    const data = await response.json();
    if (!response.ok) throw new Error("records");
    setRecords(data);
  }

  async function refreshWorkoutSummary() {
    const response = await fetch(`/api/workouts/summary?date=${selectedDate}`);
    const data = await response.json();
    if (!response.ok) throw new Error("summary");
    setSummary(data);
  }

  async function handleAddRecord(event: FormEvent) {
    event.preventDefault();
    setRecordError(null);

    if (!recordDate) return;

    const weightNum = Number(weight);
    const heightNum = Number(height);
    const bodyFatNum = bodyFat ? Number(bodyFat) : undefined;

    if (!weight || !height || !Number.isFinite(weightNum) || !Number.isFinite(heightNum)) {
      setRecordError("Informe peso e altura válidos.");
      return;
    }

    setSavingRecord(true);
    try {
      const response = await fetch("/api/physical-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: weightNum,
          height: heightNum,
          ...(bodyFatNum !== undefined ? { bodyFat: bodyFatNum } : {}),
          ...(recordNotes.trim() ? { notes: recordNotes } : {}),
          date: recordDate,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setRecordError(data.error ?? "Erro ao salvar registro.");
        return;
      }

      await refreshRecords();
      setWeight("");
      setHeight("");
      setBodyFat("");
      setRecordNotes("");
    } catch {
      setRecordError("Erro ao salvar registro.");
    } finally {
      setSavingRecord(false);
    }
  }

  async function handleAddWorkout(event: FormEvent) {
    event.preventDefault();
    setWorkoutError(null);

    if (!workoutName.trim()) {
      setWorkoutError("Informe um nome para o treino.");
      return;
    }

    setSavingWorkout(true);
    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workoutName,
          dayOfWeek: selectedDay,
          ...(workoutNotes.trim() ? { notes: workoutNotes } : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setWorkoutError(data.error ?? "Erro ao criar treino.");
        return;
      }

      setWorkouts((current) => [{ ...data, completed: false }, ...current]);
      setWorkoutName("");
      setWorkoutNotes("");
    } catch {
      setWorkoutError("Erro ao criar treino.");
    } finally {
      setSavingWorkout(false);
    }
  }

  async function handleWorkoutCompletion(workout: Workout) {
    if (!selectedDate) return;

    setWorkoutError(null);
    setUpdatingWorkoutId(workout.id);

    try {
      const response = await fetch(`/api/workouts/${workout.id}/completion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          completed: !workout.completed,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setWorkoutError(data.error ?? "Erro ao atualizar treino.");
        return;
      }

      setWorkouts((current) =>
        current.map((item) =>
          item.id === workout.id ? { ...item, completed: data.completed } : item
        )
      );
      await refreshWorkoutSummary();
    } catch {
      setWorkoutError("Erro ao atualizar treino.");
    } finally {
      setUpdatingWorkoutId(null);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Treinos + evolução"
          title="Forja do Templo"
          description="Organize sua rotina semanal, registre cada execução por data e acompanhe sua evolução física com dados reais."
          actions={
            <Badge tone="accent">
              {sessionUnavailable ? "—/7 dias ativos" : `${summary.activeDaysLast7}/7 dias ativos`}
            </Badge>
          }
        />

        <Card
          className={styles.trainingPulse}
          aria-labelledby="training-pulse-title"
          aria-busy={loadingWorkouts}
        >
          <div className={styles.pulseCopy}>
            <span className={styles.pulseEyebrow}>Sessão em foco</span>
            <h2 id="training-pulse-title" className={styles.pulseTitle}>
              {sessionNarrative.title}
            </h2>
            <p className={styles.pulseDescription}>{sessionNarrative.description}</p>
            <div className={styles.pulseMeta} aria-label="Resumo da sessão selecionada">
              <span>
                <strong>{sessionUnavailable ? "—" : dayWorkouts.length}</strong> planejados
              </span>
              <span>
                <strong>{sessionUnavailable ? "—" : remainingOnDate}</strong> em aberto
              </span>
              <span>
                <strong>
                  {physicalRecordUnavailable || latestRecord?.weight == null
                    ? "—"
                    : `${formatNumber(latestRecord.weight)} kg`}
                </strong>{" "}
                peso atual
              </span>
              <span>
                <strong>
                  {physicalRecordUnavailable || weightDelta == null
                    ? "—"
                    : `${weightDelta > 0 ? "+" : ""}${formatNumber(weightDelta)} kg`}
                </strong>{" "}
                vs. medição anterior
              </span>
            </div>
          </div>

          <div className={styles.sessionProgress}>
            <span className={styles.metricEyebrow}>{selectedDateLabel}</span>
            <strong className={styles.sessionValue}>
              {sessionUnavailable ? "—" : sessionPercent}
              {!sessionUnavailable && <small>%</small>}
            </strong>
            <span className={styles.metricLabel}>da sessão concluída</span>
            <div
              className={styles.metricTrack}
              role="progressbar"
              aria-label="Treinos concluídos na data selecionada"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={sessionUnavailable ? undefined : sessionPercent}
            >
              <div
                className={styles.sessionFill}
                style={{ width: `${sessionPercent}%` }}
              />
            </div>
          </div>

          <div className={styles.recentCadence}>
            <span className={styles.metricEyebrow}>Cadência recente</span>
            <strong className={styles.cadenceValue}>
              {sessionUnavailable ? "—" : summary.activeDaysLast7}
              {!sessionUnavailable && <small>/7</small>}
            </strong>
            <span className={styles.metricLabel}>
              {sessionUnavailable
                ? "dias ativos"
                : `${summary.completionsLast7} execuções registradas`}
            </span>
            <div
              className={styles.metricTrack}
              role="progressbar"
              aria-label="Dias ativos nos últimos sete dias"
              aria-valuemin={0}
              aria-valuemax={7}
              aria-valuenow={sessionUnavailable ? undefined : summary.activeDaysLast7}
            >
              <div
                className={styles.cadenceFill}
                style={{ width: `${activeDaysPercent}%` }}
              />
            </div>
          </div>
        </Card>

        <div className={styles.workspaceGrid}>
          <Card>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className="card-title">Rotina de treino</h2>
                <p className={styles.sectionDescription}>
                  A conclusão é registrada para a data escolhida, sem alterar outros dias.
                </p>
              </div>
              <FormField label="Data" htmlFor="workout-date">
                <Input
                  id="workout-date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => handleDateChange(event.target.value)}
                />
              </FormField>
            </div>

            {loadingWorkouts ? (
              <LoadingState title="Carregando treinos..." />
            ) : workoutsLoadError ? (
              <ErrorState
                title="Não foi possível carregar os treinos"
                description="Tente novamente atualizando a página."
              />
            ) : dayWorkouts.length === 0 ? (
              <EmptyState
                title={`Nenhum treino para ${DAY_LABELS[selectedDay].toLowerCase()}`}
                description="Cadastre abaixo o primeiro treino deste dia da semana."
              />
            ) : (
              <ul className={styles.workoutList}>
                {dayWorkouts.map((workout) => (
                  <li key={workout.id} className={styles.workoutItem}>
                    <div>
                      <div className={styles.workoutTitle}>{workout.name}</div>
                      {workout.notes && (
                        <div className={styles.workoutNotes}>{workout.notes}</div>
                      )}
                    </div>
                    <div className={styles.workoutActions}>
                      <Badge tone={workout.completed ? "success" : "neutral"}>
                        {workout.completed ? "Concluído" : "Planejado"}
                      </Badge>
                      <Button
                        size="sm"
                        variant={workout.completed ? "secondary" : "outline"}
                        disabled={updatingWorkoutId === workout.id}
                        onClick={() => handleWorkoutCompletion(workout)}
                      >
                        {updatingWorkoutId === workout.id
                          ? "Salvando..."
                          : workout.completed
                            ? "Desmarcar"
                            : "Marcar concluído"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {workoutError && <p className="error-text">{workoutError}</p>}

            <form className={styles.formBlock} onSubmit={handleAddWorkout}>
              <h3 className={styles.formTitle}>Adicionar treino para {DAY_LABELS[selectedDay]}</h3>
              <FormField label="Nome do treino" htmlFor="workout-name">
                <Input
                  id="workout-name"
                  value={workoutName}
                  onChange={(event) => setWorkoutName(event.target.value)}
                  placeholder="Ex: Peito e tríceps"
                  disabled={savingWorkout}
                />
              </FormField>
              <FormField label="Observações" htmlFor="workout-notes" hint="Opcional">
                <Input
                  id="workout-notes"
                  value={workoutNotes}
                  onChange={(event) => setWorkoutNotes(event.target.value)}
                  placeholder="Ex: treino leve, foco em técnica"
                  disabled={savingWorkout}
                />
              </FormField>
              <Button type="submit" isLoading={savingWorkout} loadingLabel="Adicionando...">
                Adicionar treino
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="card-title">Evolução física</h2>

            {loadingRecords ? (
              <LoadingState title="Carregando evolução..." />
            ) : recordsLoadError ? (
              <ErrorState
                title="Não foi possível carregar a evolução"
                description="Tente novamente atualizando a página."
              />
            ) : latestRecord ? (
              <div className={styles.currentRecord}>
                <div>
                  <span className={styles.statLabel}>Último registro</span>
                  <strong>{formatDate(latestRecord.date)}</strong>
                </div>
                <div>
                  <span className={styles.statLabel}>IMC</span>
                  <strong>{latestRecord.imc != null ? formatNumber(latestRecord.imc) : "—"}</strong>
                </div>
                <div>
                  <span className={styles.statLabel}>Gordura corporal</span>
                  <strong>
                    {latestRecord.bodyFat != null ? `${formatNumber(latestRecord.bodyFat)}%` : "—"}
                  </strong>
                </div>
                <Badge tone="accent">{latestRecord.shapeStatus ?? "Sem classificação"}</Badge>
              </div>
            ) : (
              <EmptyState
                title="Nenhuma medição registrada"
                description="Registre peso e altura para iniciar seu histórico de evolução."
              />
            )}

            <form className={styles.formBlock} onSubmit={handleAddRecord}>
              <h3 className={styles.formTitle}>Nova medição</h3>
              <div className={styles.formGrid}>
                <FormField label="Peso (kg)" htmlFor="record-weight">
                  <Input
                    id="record-weight"
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    disabled={savingRecord}
                  />
                </FormField>
                <FormField label="Altura (m)" htmlFor="record-height">
                  <Input
                    id="record-height"
                    type="number"
                    step="0.01"
                    value={height}
                    onChange={(event) => setHeight(event.target.value)}
                    disabled={savingRecord}
                  />
                </FormField>
                <FormField label="Gordura corporal (%)" htmlFor="record-body-fat" hint="Opcional">
                  <Input
                    id="record-body-fat"
                    type="number"
                    step="0.1"
                    value={bodyFat}
                    onChange={(event) => setBodyFat(event.target.value)}
                    disabled={savingRecord}
                  />
                </FormField>
                <FormField label="Data" htmlFor="record-date">
                  <Input
                    id="record-date"
                    type="date"
                    value={recordDate}
                    onChange={(event) => setRecordDateOverride(event.target.value)}
                    disabled={savingRecord}
                  />
                </FormField>
              </div>
              <FormField label="Notas" htmlFor="record-notes" hint="Opcional">
                <Input
                  id="record-notes"
                  value={recordNotes}
                  onChange={(event) => setRecordNotes(event.target.value)}
                  placeholder="Contexto da medição"
                  disabled={savingRecord}
                />
              </FormField>
              {recordError && <p className="error-text">{recordError}</p>}
              <Button type="submit" isLoading={savingRecord} loadingLabel="Registrando...">
                Registrar evolução
              </Button>
            </form>

            {records.length > 0 && (
              <div className={styles.historyBlock}>
                <h3 className={styles.formTitle}>Histórico recente</h3>
                <ul className={styles.historyList}>
                  {records.slice(0, 5).map((record) => (
                    <li key={record.id} className={styles.historyItem}>
                      <span>{formatDate(record.date)}</span>
                      <strong>{record.weight != null ? `${formatNumber(record.weight)} kg` : "—"}</strong>
                      <span>{record.bodyFat != null ? `${formatNumber(record.bodyFat)}% GC` : "GC —"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
