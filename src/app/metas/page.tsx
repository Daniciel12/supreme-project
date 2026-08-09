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
  Select,
} from "@/components/ui";

const CATEGORIES = ["Profissional", "Saúde", "Espiritualidade", "Pessoal"] as const;

interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  goalId: string;
}

interface Goal {
  id: string;
  title: string;
  category: string;
  isCompleted: boolean;
  deadline: string | null;
  tasks: Task[];
}

interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  readPages: number;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatDeadline(deadline: string) {
  return dateFormatter.format(new Date(deadline));
}

async function fetchGoals() {
  const response = await fetch("/api/goals");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Erro ao carregar metas.");
  return data as Goal[];
}

async function fetchBooks() {
  const response = await fetch("/api/books");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Erro ao carregar livros.");
  return data as Book[];
}

export default function MetasPage() {
  const todayKey = localDateKey();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [goalsLoadError, setGoalsLoadError] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalCategory, setGoalCategory] = useState<string>(CATEGORIES[0]);
  const [goalDeadline, setGoalDeadline] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);

  const [newTaskByGoal, setNewTaskByGoal] = useState<Record<string, string>>({});
  const [savingTaskGoalId, setSavingTaskGoalId] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [booksLoadError, setBooksLoadError] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookTotalPages, setBookTotalPages] = useState("");
  const [savingBook, setSavingBook] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([fetchGoals(), fetchBooks()]).then(
      ([goalsResult, booksResult]) => {
        if (cancelled) return;

        if (goalsResult.status === "fulfilled") {
          setGoals(goalsResult.value);
        } else {
          setGoalsLoadError(true);
        }
        setLoadingGoals(false);

        if (booksResult.status === "fulfilled") {
          setBooks(booksResult.value);
        } else {
          setBooksLoadError(true);
        }
        setLoadingBooks(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const goalsByCategory = useMemo(() => {
    const grouped = new Map<string, Goal[]>();
    for (const goal of goals) {
      const list = grouped.get(goal.category) ?? [];
      list.push(goal);
      grouped.set(goal.category, list);
    }
    return grouped;
  }, [goals]);

  const categoryOrder = useMemo(() => {
    const known = CATEGORIES.filter((category) => goalsByCategory.has(category));
    const extras = Array.from(goalsByCategory.keys()).filter(
      (category) => !CATEGORIES.includes(category as (typeof CATEGORIES)[number])
    );
    return [...known, ...extras];
  }, [goalsByCategory]);

  async function handleCreateGoal(event: FormEvent) {
    event.preventDefault();
    setGoalError(null);

    if (!goalTitle.trim()) {
      setGoalError("Informe um título para a meta.");
      return;
    }

    setSavingGoal(true);
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goalTitle,
          category: goalCategory,
          deadline: goalDeadline || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setGoalError(data.error ?? "Erro ao criar meta.");
        return;
      }

      setGoals((previous) => [...previous, data]);
      setGoalTitle("");
      setGoalDeadline("");
    } catch (error) {
      console.error("Erro ao criar meta", error);
      setGoalError("Erro ao criar meta.");
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleToggleTask(goalId: string, task: Task) {
    const nextCompleted = !task.isCompleted;
    setTaskError(null);
    setUpdatingTaskId(task.id);

    setGoals((previous) =>
      previous.map((goal) =>
        goal.id !== goalId
          ? goal
          : {
              ...goal,
              tasks: goal.tasks.map((item) =>
                item.id === task.id
                  ? { ...item, isCompleted: nextCompleted }
                  : item
              ),
            }
      )
    );

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: nextCompleted }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? "Erro ao atualizar tarefa.");

      setGoals((previous) =>
        previous.map((goal) =>
          goal.id !== goalId
            ? goal
            : {
                ...goal,
                tasks: goal.tasks.map((item) =>
                  item.id === task.id ? data : item
                ),
              }
        )
      );
    } catch (error) {
      console.error("Erro ao atualizar tarefa", error);
      setTaskError("Não foi possível atualizar a tarefa.");
      setGoals((previous) =>
        previous.map((goal) =>
          goal.id !== goalId
            ? goal
            : {
                ...goal,
                tasks: goal.tasks.map((item) =>
                  item.id === task.id
                    ? { ...item, isCompleted: task.isCompleted }
                    : item
                ),
              }
        )
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleAddTask(event: FormEvent, goalId: string) {
    event.preventDefault();
    setTaskError(null);

    const title = (newTaskByGoal[goalId] ?? "").trim();
    if (!title) return;

    setSavingTaskGoalId(goalId);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, goalId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setTaskError(data.error ?? "Erro ao criar tarefa.");
        return;
      }

      setGoals((previous) =>
        previous.map((goal) =>
          goal.id !== goalId
            ? goal
            : { ...goal, tasks: [...goal.tasks, data] }
        )
      );
      setNewTaskByGoal((previous) => ({ ...previous, [goalId]: "" }));
    } catch (error) {
      console.error("Erro ao criar tarefa", error);
      setTaskError("Não foi possível criar a tarefa.");
    } finally {
      setSavingTaskGoalId(null);
    }
  }

  async function handleCreateBook(event: FormEvent) {
    event.preventDefault();
    setBookError(null);

    const totalPages = Number.parseInt(bookTotalPages, 10);
    if (!bookTitle.trim() || !bookAuthor.trim() || !Number.isInteger(totalPages) || totalPages <= 0) {
      setBookError("Preencha título, autor e um total de páginas válido.");
      return;
    }

    setSavingBook(true);
    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bookTitle,
          author: bookAuthor,
          totalPages,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setBookError(data.error ?? "Erro ao criar livro.");
        return;
      }

      setBooks((previous) => [...previous, data]);
      setBookTitle("");
      setBookAuthor("");
      setBookTotalPages("");
    } catch (error) {
      console.error("Erro ao criar livro", error);
      setBookError("Erro ao criar livro.");
    } finally {
      setSavingBook(false);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Metas"
          title="Transforme intenção em execução"
          description="Defina prazos, quebre metas em tarefas e acompanhe o progresso sem perder de vista o que está vencendo."
          actions={<Badge tone="accent">{goals.length} metas</Badge>}
        />

        <div className="goals-page-grid">
          <Card>
            <h2 className="card-title">Meus objetivos</h2>

            <form className="form" onSubmit={handleCreateGoal}>
              <FormField label="Título" htmlFor="goal-title">
                <Input
                  id="goal-title"
                  value={goalTitle}
                  onChange={(event) => setGoalTitle(event.target.value)}
                  placeholder="Ex: Concluir certificação"
                  disabled={savingGoal}
                />
              </FormField>
              <div className="form-row">
                <FormField label="Categoria" htmlFor="goal-category">
                  <Select
                    id="goal-category"
                    value={goalCategory}
                    onChange={(event) => setGoalCategory(event.target.value)}
                    disabled={savingGoal}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Prazo" htmlFor="goal-deadline" hint="Opcional">
                  <Input
                    id="goal-deadline"
                    type="date"
                    value={goalDeadline}
                    onChange={(event) => setGoalDeadline(event.target.value)}
                    disabled={savingGoal}
                  />
                </FormField>
              </div>
              {goalError && <p className="error-text">{goalError}</p>}
              <Button
                type="submit"
                isLoading={savingGoal}
                loadingLabel="Salvando meta..."
              >
                Adicionar meta
              </Button>
            </form>

            <div className="mt-lg">
              {loadingGoals ? (
                <LoadingState title="Carregando metas..." />
              ) : goalsLoadError ? (
                <ErrorState
                  title="Não foi possível carregar suas metas"
                  description="Atualize a página para tentar novamente."
                />
              ) : goals.length === 0 ? (
                <EmptyState
                  title="Nenhuma meta cadastrada"
                  description="Crie uma meta e adicione tarefas para transformar intenção em progresso mensurável."
                />
              ) : (
                categoryOrder.map((category) => (
                  <div key={category} className="goal-category-block">
                    <div className="goal-category-title">{category}</div>

                    {goalsByCategory.get(category)?.map((goal) => {
                      const totalTasks = goal.tasks.length;
                      const completedTasks = goal.tasks.filter(
                        (task) => task.isCompleted
                      ).length;
                      const progress =
                        totalTasks > 0
                          ? Math.round((completedTasks / totalTasks) * 100)
                          : null;
                      const deadlineKey = goal.deadline?.slice(0, 10) ?? null;
                      const isOverdue =
                        !goal.isCompleted &&
                        deadlineKey !== null &&
                        deadlineKey < todayKey;
                      const isDueToday =
                        !goal.isCompleted && deadlineKey === todayKey;

                      return (
                        <div key={goal.id} className="goal-card">
                          <div className="goal-card-header">
                            <div>
                              <span
                                className={`goal-card-title${
                                  goal.isCompleted ? " completed" : ""
                                }`}
                              >
                                {goal.title}
                              </span>
                              <div className="mt-sm">
                                {goal.isCompleted ? (
                                  <Badge tone="success">Concluída</Badge>
                                ) : isOverdue ? (
                                  <Badge tone="danger">
                                    Vencida em {formatDeadline(goal.deadline!)}
                                  </Badge>
                                ) : isDueToday ? (
                                  <Badge tone="warning">Vence hoje</Badge>
                                ) : goal.deadline ? (
                                  <Badge tone="accent">
                                    Prazo {formatDeadline(goal.deadline)}
                                  </Badge>
                                ) : (
                                  <Badge>Sem prazo</Badge>
                                )}
                              </div>
                            </div>
                            <span className="goal-progress-percent">
                              {progress === null
                                ? "Sem tarefas"
                                : `${progress}% · ${completedTasks}/${totalTasks}`}
                            </span>
                          </div>

                          <div className="progress-bar-track">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${progress ?? 0}%` }}
                            />
                          </div>

                          {totalTasks > 0 && (
                            <ul className="goal-task-list">
                              {goal.tasks.map((task) => (
                                <li key={task.id} className="goal-task-item">
                                  <input
                                    type="checkbox"
                                    checked={task.isCompleted}
                                    onChange={() => handleToggleTask(goal.id, task)}
                                    disabled={updatingTaskId !== null}
                                    aria-label={`${task.isCompleted ? "Reabrir" : "Concluir"} tarefa ${task.title}`}
                                  />
                                  <span
                                    className={`goal-task-item-title${
                                      task.isCompleted ? " completed" : ""
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}

                          <form
                            className="goal-task-add"
                            onSubmit={(event) => handleAddTask(event, goal.id)}
                          >
                            <Input
                              type="text"
                              className="goal-task-add-input"
                              placeholder="Nova sub-tarefa"
                              value={newTaskByGoal[goal.id] ?? ""}
                              onChange={(event) =>
                                setNewTaskByGoal((previous) => ({
                                  ...previous,
                                  [goal.id]: event.target.value,
                                }))
                              }
                              disabled={savingTaskGoalId === goal.id}
                              aria-label={`Nova tarefa para ${goal.title}`}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              isLoading={savingTaskGoalId === goal.id}
                              loadingLabel="Adicionando..."
                            >
                              Adicionar tarefa
                            </Button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {taskError && <p className="error-text">{taskError}</p>}
          </Card>

          <Card>
            <h2 className="card-title">Fontes de conhecimento</h2>
            <p className="text-secondary">
              A biblioteca continua disponível aqui até a etapa dedicada de Livros + Vision Board.
            </p>

            <form className="form mt-lg" onSubmit={handleCreateBook}>
              <FormField label="Título" htmlFor="book-title">
                <Input
                  id="book-title"
                  value={bookTitle}
                  onChange={(event) => setBookTitle(event.target.value)}
                  placeholder="Título do livro"
                  disabled={savingBook}
                />
              </FormField>
              <div className="form-row">
                <FormField label="Autor" htmlFor="book-author">
                  <Input
                    id="book-author"
                    value={bookAuthor}
                    onChange={(event) => setBookAuthor(event.target.value)}
                    placeholder="Autor"
                    disabled={savingBook}
                  />
                </FormField>
                <FormField label="Total de páginas" htmlFor="book-pages">
                  <Input
                    id="book-pages"
                    type="number"
                    min="1"
                    value={bookTotalPages}
                    onChange={(event) => setBookTotalPages(event.target.value)}
                    placeholder="Ex: 320"
                    disabled={savingBook}
                  />
                </FormField>
              </div>
              {bookError && <p className="error-text">{bookError}</p>}
              <Button
                type="submit"
                isLoading={savingBook}
                loadingLabel="Salvando livro..."
              >
                Adicionar livro
              </Button>
            </form>

            <div className="mt-lg">
              {loadingBooks ? (
                <LoadingState title="Carregando livros..." />
              ) : booksLoadError ? (
                <ErrorState
                  title="Não foi possível carregar os livros"
                  description="Atualize a página para tentar novamente."
                />
              ) : books.length === 0 ? (
                <EmptyState
                  title="Nenhum livro cadastrado"
                  description="Adicione o primeiro livro para manter sua biblioteca disponível."
                />
              ) : (
                <div className="book-grid">
                  {books.map((book) => {
                    const progress =
                      book.totalPages > 0
                        ? Math.min(
                            100,
                            Math.round((book.readPages / book.totalPages) * 100)
                          )
                        : 0;

                    return (
                      <Card key={book.id} className="book-card">
                        <span className="book-card-title">{book.title}</span>
                        <span className="book-card-author">{book.author}</span>
                        <div className="progress-bar-track">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="progress-percent-label">
                          {progress}% lido ({book.readPages}/{book.totalPages} páginas)
                        </span>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
