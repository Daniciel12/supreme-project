"use client";

import { useEffect, useState, FormEvent } from "react";

const DAYS = [
  { key: "DOM", label: "Dom" },
  { key: "SEG", label: "Seg" },
  { key: "TER", label: "Ter" },
  { key: "QUA", label: "Qua" },
  { key: "QUI", label: "Qui" },
  { key: "SEX", label: "Sex" },
  { key: "SAB", label: "Sáb" },
] as const;

interface PhysicalRecord {
  id: string;
  date: string;
  weight: number | null;
  height: number | null;
  imc: number | null;
  shapeStatus: string | null;
}

interface Workout {
  id: string;
  name: string;
  dayOfWeek: string;
  completed: boolean;
}

export default function TreinosPage() {
  // --- Meu Progresso ---
  const [records, setRecords] = useState<PhysicalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // --- Organize seus treinos ---
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>("SEG");
  const [workoutName, setWorkoutName] = useState("");
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecords() {
      try {
        const res = await fetch("/api/physical-records");
        const data = await res.json();
        if (res.ok) setRecords(data);
      } catch (err) {
        console.error("Erro ao carregar registros físicos", err);
      } finally {
        setLoadingRecords(false);
      }
    }

    async function loadWorkouts() {
      try {
        const res = await fetch("/api/workouts");
        const data = await res.json();
        if (res.ok) setWorkouts(data);
      } catch (err) {
        console.error("Erro ao carregar treinos", err);
      } finally {
        setLoadingWorkouts(false);
      }
    }

    loadRecords();
    loadWorkouts();
  }, []);

  const latestRecord = records[0];

  async function handleAddRecord(event: FormEvent) {
    event.preventDefault();
    setRecordError(null);

    const weightNum = Number(weight);
    const heightNum = Number(height);

    if (!weight || !height || Number.isNaN(weightNum) || Number.isNaN(heightNum)) {
      setRecordError("Informe peso e altura válidos.");
      return;
    }

    setSavingRecord(true);
    try {
      const res = await fetch("/api/physical-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: weightNum, height: heightNum }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRecordError(data.error ?? "Erro ao salvar registro.");
        return;
      }

      setRecords((prev) => [data, ...prev]);
      setWeight("");
      setHeight("");
    } catch (err) {
      console.error("Erro ao salvar registro físico", err);
      setRecordError("Erro ao salvar registro.");
    } finally {
      setSavingRecord(false);
    }
  }

  const filteredWorkouts = workouts.filter((w) => w.dayOfWeek === selectedDay);

  async function handleAddWorkout(event: FormEvent) {
    event.preventDefault();
    setWorkoutError(null);

    if (!workoutName.trim()) {
      setWorkoutError("Informe um nome para o treino.");
      return;
    }

    setSavingWorkout(true);
    try {
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workoutName,
          dayOfWeek: selectedDay,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setWorkoutError(data.error ?? "Erro ao criar treino.");
        return;
      }

      setWorkouts((prev) => [data, ...prev]);
      setWorkoutName("");
    } catch (err) {
      console.error("Erro ao criar treino", err);
      setWorkoutError("Erro ao criar treino.");
    } finally {
      setSavingWorkout(false);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        <div className="page-grid">
          {/* Meu Progresso */}
          <div className="card">
            <h2 className="card-title">Meu Progresso</h2>

            {loadingRecords ? (
              <p className="empty-state">Carregando registros...</p>
            ) : latestRecord ? (
              <div className="progress-summary">
                <div>
                  <div className="progress-stat-label">Peso atual</div>
                  <div className="progress-stat-value">
                    {latestRecord.weight != null ? `${latestRecord.weight} kg` : "—"}
                  </div>
                </div>
                <div>
                  <div className="progress-stat-label">Shape</div>
                  <div className="progress-stat-value accent">
                    {latestRecord.shapeStatus ?? "Indefinido"}
                  </div>
                </div>
              </div>
            ) : (
              <p className="empty-state">Nenhum registro ainda. Adicione o primeiro abaixo.</p>
            )}

            {recordError && <p className="error-text">{recordError}</p>}

            <form className="form" onSubmit={handleAddRecord}>
              <div className="form-row">
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  placeholder="Peso (kg)"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="Altura (m)"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingRecord}>
                {savingRecord ? "Salvando..." : "Registrar"}
              </button>
            </form>
          </div>

          {/* Organize seus treinos */}
          <div className="card">
            <h2 className="card-title">Organize seus treinos</h2>

            <div className="tabs">
              {DAYS.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className={`tab-button${selectedDay === day.key ? " active" : ""}`}
                  onClick={() => setSelectedDay(day.key)}
                >
                  {day.label}
                </button>
              ))}
            </div>

            {loadingWorkouts ? (
              <p className="empty-state">Carregando treinos...</p>
            ) : filteredWorkouts.length === 0 ? (
              <p className="empty-state">Nenhum treino cadastrado para este dia.</p>
            ) : (
              <ul className="workout-list">
                {filteredWorkouts.map((workout) => (
                  <li key={workout.id} className="workout-item">
                    <span className="workout-item-name">{workout.name}</span>
                    <span className="badge badge--accent">
                      {DAYS.find((d) => d.key === workout.dayOfWeek)?.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {workoutError && <p className="error-text">{workoutError}</p>}

            <form className="form" onSubmit={handleAddWorkout}>
              <div className="form-row">
                <input
                  type="text"
                  className="input"
                  placeholder="Nome do treino"
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingWorkout}>
                {savingWorkout
                  ? "Salvando..."
                  : `Adicionar para ${DAYS.find((d) => d.key === selectedDay)?.label}`}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
