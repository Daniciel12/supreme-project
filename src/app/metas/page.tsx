"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";

const CATEGORIES = ["Profissional", "Saúde", "Espiritualidade"] as const;

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

export default function MetasPage() {
  // --- Metas ---
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalCategory, setGoalCategory] = useState<string>(CATEGORIES[0]);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);

  // --- Sub-tarefas de cada meta ---
  const [newTaskByGoal, setNewTaskByGoal] = useState<Record<string, string>>(
    {}
  );
  const [savingTaskGoalId, setSavingTaskGoalId] = useState<string | null>(
    null
  );

  // --- Livros ---
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookTotalPages, setBookTotalPages] = useState("");
  const [savingBook, setSavingBook] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGoals() {
      try {
        const res = await fetch("/api/goals");
        const data = await res.json();
        if (res.ok) setGoals(data);
      } catch (err) {
        console.error("Erro ao carregar metas", err);
      } finally {
        setLoadingGoals(false);
      }
    }

    async function loadBooks() {
      try {
        const res = await fetch("/api/books");
        const data = await res.json();
        if (res.ok) setBooks(data);
      } catch (err) {
        console.error("Erro ao carregar livros", err);
      } finally {
        setLoadingBooks(false);
      }
    }

    loadGoals();
    loadBooks();
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

  async function handleCreateGoal(event: FormEvent) {
    event.preventDefault();
    setGoalError(null);

    if (!goalTitle.trim()) {
      setGoalError("Informe um título para a meta.");
      return;
    }

    setSavingGoal(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: goalTitle, category: goalCategory }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGoalError(data.error ?? "Erro ao criar meta.");
        return;
      }

      setGoals((prev) => [...prev, { ...data, tasks: data.tasks ?? [] }]);
      setGoalTitle("");
    } catch (err) {
      console.error("Erro ao criar meta", err);
      setGoalError("Erro ao criar meta.");
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleToggleTask(goalId: string, task: Task) {
    // Atualização otimista: alterna na tela e desfaz se a API falhar.
    setGoals((prev) =>
      prev.map((g) =>
        g.id !== goalId
          ? g
          : {
              ...g,
              tasks: g.tasks.map((t) =>
                t.id === task.id ? { ...t, isCompleted: !t.isCompleted } : t
              ),
            }
      )
    );

    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "PATCH" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Erro ao atualizar tarefa.");
      }

      setGoals((prev) =>
        prev.map((g) =>
          g.id !== goalId
            ? g
            : { ...g, tasks: g.tasks.map((t) => (t.id === task.id ? data : t)) }
        )
      );
    } catch (err) {
      console.error("Erro ao atualizar tarefa", err);
      // desfaz a atualização otimista
      setGoals((prev) =>
        prev.map((g) =>
          g.id !== goalId
            ? g
            : {
                ...g,
                tasks: g.tasks.map((t) =>
                  t.id === task.id ? { ...t, isCompleted: task.isCompleted } : t
                ),
              }
        )
      );
    }
  }

  async function handleAddTask(event: FormEvent, goalId: string) {
    event.preventDefault();

    const title = (newTaskByGoal[goalId] ?? "").trim();
    if (!title) return;

    setSavingTaskGoalId(goalId);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, goalId }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(data.error ?? "Erro ao criar tarefa.");
        return;
      }

      setGoals((prev) =>
        prev.map((g) =>
          g.id !== goalId ? g : { ...g, tasks: [...g.tasks, data] }
        )
      );
      setNewTaskByGoal((prev) => ({ ...prev, [goalId]: "" }));
    } catch (err) {
      console.error("Erro ao criar tarefa", err);
    } finally {
      setSavingTaskGoalId(null);
    }
  }

  async function handleCreateBook(event: FormEvent) {
    event.preventDefault();
    setBookError(null);

    const totalPagesNum = parseInt(bookTotalPages, 10);

    if (!bookTitle.trim() || !bookAuthor.trim() || Number.isNaN(totalPagesNum)) {
      setBookError("Preencha título, autor e um total de páginas válido.");
      return;
    }

    setSavingBook(true);
    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bookTitle,
          author: bookAuthor,
          totalPages: totalPagesNum,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setBookError(data.error ?? "Erro ao criar livro.");
        return;
      }

      setBooks((prev) => [...prev, data]);
      setBookTitle("");
      setBookAuthor("");
      setBookTotalPages("");
    } catch (err) {
      console.error("Erro ao criar livro", err);
      setBookError("Erro ao criar livro.");
    } finally {
      setSavingBook(false);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        <div className="goals-page-grid">
          {/* Coluna esquerda — Meus Objetivos */}
          <div className="card">
            <h2 className="card-title">Meus Objetivos</h2>

            <form className="form" onSubmit={handleCreateGoal}>
              <input
                type="text"
                className="input"
                placeholder="Título da meta"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
              />
              <select
                className="select"
                value={goalCategory}
                onChange={(e) => setGoalCategory(e.target.value)}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {goalError && <p className="error-text">{goalError}</p>}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingGoal}
              >
                {savingGoal ? "Salvando..." : "Adicionar meta"}
              </button>
            </form>

            <div className="mt-lg">
              {loadingGoals ? (
                <p className="empty-state">Carregando metas...</p>
              ) : goals.length === 0 ? (
                <p className="empty-state">
                  Nenhuma meta cadastrada ainda. Adicione a primeira acima.
                </p>
              ) : (
                CATEGORIES.filter((category) =>
                  goalsByCategory.has(category)
                ).map((category) => (
                  <div key={category} className="goal-category-block">
                    <div className="goal-category-title">{category}</div>

                    {goalsByCategory.get(category)?.map((goal) => {
                      const totalTasks = goal.tasks.length;
                      const doneTasks = goal.tasks.filter(
                        (t) => t.isCompleted
                      ).length;
                      const progress =
                        totalTasks > 0
                          ? Math.round((doneTasks / totalTasks) * 100)
                          : 0;

                      return (
                        <div key={goal.id} className="goal-card">
                          <div className="goal-card-header">
                            <span
                              className={`goal-card-title${
                                goal.isCompleted ? " completed" : ""
                              }`}
                            >
                              {goal.title}
                            </span>
                            <span className="goal-progress-percent">
                              {totalTasks > 0
                                ? `${progress}%`
                                : "Sem tarefas"}
                            </span>
                          </div>

                          <div className="progress-bar-track">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          {totalTasks > 0 && (
                            <ul className="goal-task-list">
                              {goal.tasks.map((task) => (
                                <li key={task.id} className="goal-task-item">
                                  <input
                                    type="checkbox"
                                    checked={task.isCompleted}
                                    onChange={() =>
                                      handleToggleTask(goal.id, task)
                                    }
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
                            onSubmit={(e) => handleAddTask(e, goal.id)}
                          >
                            <input
                              type="text"
                              className="input goal-task-add-input"
                              placeholder="Nova sub-tarefa"
                              value={newTaskByGoal[goal.id] ?? ""}
                              onChange={(e) =>
                                setNewTaskByGoal((prev) => ({
                                  ...prev,
                                  [goal.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="submit"
                              className="goal-task-add-btn"
                              disabled={savingTaskGoalId === goal.id}
                              aria-label="Adicionar sub-tarefa"
                            >
                              +
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Coluna direita — Fontes de Conhecimento */}
          <div className="card">
            <h2 className="card-title">Fontes de Conhecimento</h2>

            <form className="form" onSubmit={handleCreateBook}>
              <input
                type="text"
                className="input"
                placeholder="Título do livro"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
              />
              <div className="form-row">
                <input
                  type="text"
                  className="input"
                  placeholder="Autor"
                  value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                />
                <input
                  type="number"
                  className="input"
                  placeholder="Total de páginas"
                  value={bookTotalPages}
                  onChange={(e) => setBookTotalPages(e.target.value)}
                />
              </div>
              {bookError && <p className="error-text">{bookError}</p>}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingBook}
              >
                {savingBook ? "Salvando..." : "Adicionar livro"}
              </button>
            </form>

            <div className="mt-lg">
              {loadingBooks ? (
                <p className="empty-state">Carregando livros...</p>
              ) : books.length === 0 ? (
                <p className="empty-state">
                  Nenhum livro cadastrado ainda. Adicione o primeiro acima.
                </p>
              ) : (
                <div className="book-grid">
                  {books.map((book) => {
                    const progress =
                      book.totalPages > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (book.readPages / book.totalPages) * 100
                            )
                          )
                        : 0;

                    return (
                      <div key={book.id} className="card book-card">
                        <span className="book-card-title">{book.title}</span>
                        <span className="book-card-author">
                          {book.author}
                        </span>
                        <div className="progress-bar-track">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="progress-percent-label">
                          {progress}% lido ({book.readPages}/{book.totalPages}{" "}
                          páginas)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
