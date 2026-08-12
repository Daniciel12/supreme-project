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
import styles from "./livros.module.css";

interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  readPages: number;
}

async function fetchBooks() {
  const response = await fetch("/api/books");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Erro ao carregar livros.");
  return data as Book[];
}

function progressFor(book: Book) {
  if (book.totalPages <= 0) return 0;
  return Math.min(100, Math.round((book.readPages / book.totalPages) * 100));
}

export default function LivrosPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [savingBook, setSavingBook] = useState(false);
  const [progressDrafts, setProgressDrafts] = useState<Record<string, string>>({});
  const [updatingBookId, setUpdatingBookId] = useState<string | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchBooks()
      .then((data) => {
        if (cancelled) return;
        setBooks(data);
        setProgressDrafts(
          Object.fromEntries(data.map((book) => [book.id, String(book.readPages)]))
        );
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingBooks(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    return books.reduce(
      (result, book) => ({
        total: result.total + 1,
        completed:
          result.completed + (book.totalPages > 0 && book.readPages === book.totalPages ? 1 : 0),
        reading:
          result.reading + (book.readPages > 0 && book.readPages < book.totalPages ? 1 : 0),
        pagesRead: result.pagesRead + book.readPages,
        totalPages: result.totalPages + book.totalPages,
      }),
      { total: 0, completed: 0, reading: 0, pagesRead: 0, totalPages: 0 }
    );
  }, [books]);

  const libraryUnavailable = loadingBooks || loadError;
  const remainingPages = Math.max(0, summary.totalPages - summary.pagesRead);
  const libraryProgress =
    summary.totalPages === 0
      ? 0
      : Math.min(
          100,
          Math.max(0, Math.round((summary.pagesRead / summary.totalPages) * 100))
        );
  const libraryNarrative =
    libraryUnavailable
      ? {
          title: "Lendo o mapa da biblioteca.",
          description:
            "O panorama aparece assim que suas leituras estiverem disponíveis.",
        }
      : summary.total === 0
        ? {
            title: "A próxima leitura ainda espera um título.",
            description:
              "Escolha uma obra que dialogue com o momento e transforme curiosidade em repertório construído.",
          }
        : summary.completed === summary.total
          ? {
              title: "A estante já virou repertório.",
              description:
                "Todas as leituras cadastradas foram concluídas. Um novo título pode abrir a próxima perspectiva.",
            }
          : summary.reading === 0
            ? {
                title: "O próximo capítulo pede movimento.",
                description:
                  "A biblioteca já tem direção; registre as primeiras páginas para colocar o conhecimento em curso.",
              }
            : {
                title: "A leitura já está em movimento.",
                description:
                  "Continue pelas obras em curso e deixe o progresso revelar o repertório que está sendo construído.",
              };

  async function handleCreateBook(event: FormEvent) {
    event.preventDefault();
    setActionError(null);

    const parsedTotalPages = Number(totalPages);
    if (
      !title.trim() ||
      !author.trim() ||
      !Number.isInteger(parsedTotalPages) ||
      parsedTotalPages <= 0
    ) {
      setActionError("Preencha título, autor e um total de páginas válido.");
      return;
    }

    setSavingBook(true);
    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          totalPages: parsedTotalPages,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionError(data.error ?? "Erro ao adicionar livro.");
        return;
      }

      const book = data as Book;
      setBooks((previous) => [...previous, book]);
      setProgressDrafts((previous) => ({ ...previous, [book.id]: "0" }));
      setTitle("");
      setAuthor("");
      setTotalPages("");
    } catch {
      setActionError("Erro ao adicionar livro.");
    } finally {
      setSavingBook(false);
    }
  }

  async function handleProgress(book: Book) {
    setActionError(null);
    const readPages = Number(progressDrafts[book.id]);

    if (
      !Number.isInteger(readPages) ||
      readPages < 0 ||
      readPages > book.totalPages
    ) {
      setActionError(`Informe um progresso entre 0 e ${book.totalPages} páginas.`);
      return;
    }

    setUpdatingBookId(book.id);
    try {
      const response = await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readPages }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionError(data.error ?? "Erro ao atualizar progresso.");
        return;
      }

      const updatedBook = data as Book;
      setBooks((previous) =>
        previous.map((item) => (item.id === updatedBook.id ? updatedBook : item))
      );
      setProgressDrafts((previous) => ({
        ...previous,
        [updatedBook.id]: String(updatedBook.readPages),
      }));
    } catch {
      setActionError("Erro ao atualizar progresso.");
    } finally {
      setUpdatingBookId(null);
    }
  }

  async function handleDelete(book: Book) {
    if (!window.confirm(`Remover “${book.title}” da biblioteca?`)) return;

    setActionError(null);
    setDeletingBookId(book.id);
    try {
      const response = await fetch(`/api/books/${book.id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        setActionError(data.error ?? "Erro ao remover livro.");
        return;
      }

      setBooks((previous) => previous.filter((item) => item.id !== book.id));
      setProgressDrafts((previous) => {
        const next = { ...previous };
        delete next[book.id];
        return next;
      });
    } catch {
      setActionError("Erro ao remover livro.");
    } finally {
      setDeletingBookId(null);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Livros"
          title="Biblioteca de conhecimento"
          description="Cadastre suas leituras e mantenha o progresso em páginas como uma medida objetiva de execução."
          actions={
            <Badge tone="accent">
              {libraryUnavailable ? "— livros" : `${summary.total} livros`}
            </Badge>
          }
        />

        <Card
          className={styles.readingMap}
          aria-labelledby="reading-map-title"
          aria-busy={loadingBooks}
        >
          <div className={styles.mapCopy}>
            <span className={styles.mapEyebrow}>Biblioteca em ação</span>
            <h2 id="reading-map-title" className={styles.mapTitle}>
              {libraryNarrative.title}
            </h2>
            <p className={styles.mapDescription}>{libraryNarrative.description}</p>
            <div className={styles.mapMeta} aria-label="Resumo da biblioteca">
              <span>
                <strong>{libraryUnavailable ? "—" : summary.total}</strong> na estante
              </span>
              <span>
                <strong>{libraryUnavailable ? "—" : summary.reading}</strong> em leitura
              </span>
              <span>
                <strong>{libraryUnavailable ? "—" : summary.completed}</strong> concluídos
              </span>
            </div>
          </div>

          <div className={styles.libraryProgress}>
            <span className={styles.metricEyebrow}>Repertório percorrido</span>
            <strong className={styles.progressValue}>
              {libraryUnavailable ? "—" : libraryProgress}
              {!libraryUnavailable && <small>%</small>}
            </strong>
            <span className={styles.metricLabel}>
              {libraryUnavailable ? "páginas registradas" : `${summary.pagesRead} páginas lidas`}
            </span>
            <div
              className={styles.metricTrack}
              role="progressbar"
              aria-label="Progresso total da biblioteca"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={libraryUnavailable ? undefined : libraryProgress}
            >
              <div
                className={styles.libraryFill}
                style={{ width: `${libraryProgress}%` }}
              />
            </div>
          </div>

          <div className={styles.nextChapters}>
            <span className={styles.metricEyebrow}>Próximos capítulos</span>
            <strong className={styles.remainingValue}>
              {libraryUnavailable ? "—" : remainingPages}
            </strong>
            <span className={styles.metricLabel}>páginas até concluir a estante atual</span>
            <span className={styles.secondaryMetric}>
              <strong>{libraryUnavailable ? "—" : summary.totalPages}</strong> páginas mapeadas
            </span>
          </div>
        </Card>

        {actionError && (
          <div className={styles.actionError} role="alert">
            {actionError}
          </div>
        )}

        <div className={styles.workspaceGrid}>
          <Card>
            <h2 className="card-title">Adicionar livro</h2>
            <form className="form" onSubmit={handleCreateBook}>
              <FormField label="Título" htmlFor="book-title">
                <Input
                  id="book-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Título do livro"
                  disabled={savingBook}
                />
              </FormField>
              <FormField label="Autor" htmlFor="book-author">
                <Input
                  id="book-author"
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Autor"
                  disabled={savingBook}
                />
              </FormField>
              <FormField label="Total de páginas" htmlFor="book-total-pages">
                <Input
                  id="book-total-pages"
                  type="number"
                  min="1"
                  step="1"
                  value={totalPages}
                  onChange={(event) => setTotalPages(event.target.value)}
                  placeholder="Ex: 320"
                  disabled={savingBook}
                />
              </FormField>
              <Button type="submit" isLoading={savingBook} loadingLabel="Adicionando...">
                Adicionar livro
              </Button>
            </form>
          </Card>

          <div className={styles.libraryColumn}>
            {loadingBooks ? (
              <LoadingState title="Carregando biblioteca..." />
            ) : loadError ? (
              <ErrorState
                title="Não foi possível carregar os livros"
                description="Atualize a página para tentar novamente."
              />
            ) : books.length === 0 ? (
              <EmptyState
                title="Nenhum livro cadastrado"
                description="Adicione o primeiro livro para começar a acompanhar suas leituras."
              />
            ) : (
              <div className={styles.bookGrid}>
                {books.map((book) => {
                  const progress = progressFor(book);
                  const completed = book.readPages === book.totalPages;
                  const started = book.readPages > 0;

                  return (
                    <Card key={book.id} className={styles.bookCard}>
                      <div className={styles.bookHeader}>
                        <div>
                          <h2 className={styles.bookTitle}>{book.title}</h2>
                          <p className={styles.bookAuthor}>{book.author}</p>
                        </div>
                        <Badge tone={completed ? "success" : started ? "accent" : "neutral"}>
                          {completed ? "Concluído" : started ? "Em leitura" : "Não iniciado"}
                        </Badge>
                      </div>

                      <div
                        className="progress-bar-track"
                        role="progressbar"
                        aria-label={`Progresso de ${book.title}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                      >
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className={styles.progressMeta}>
                        <span>{progress}%</span>
                        <span>{book.readPages}/{book.totalPages} páginas</span>
                      </div>

                      <div className={styles.progressForm}>
                        <FormField
                          label="Páginas lidas"
                          htmlFor={`book-progress-${book.id}`}
                        >
                          <Input
                            id={`book-progress-${book.id}`}
                            type="number"
                            min="0"
                            max={book.totalPages}
                            step="1"
                            value={progressDrafts[book.id] ?? String(book.readPages)}
                            onChange={(event) =>
                              setProgressDrafts((previous) => ({
                                ...previous,
                                [book.id]: event.target.value,
                              }))
                            }
                            disabled={updatingBookId === book.id}
                          />
                        </FormField>
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={updatingBookId === book.id}
                          loadingLabel="Salvando..."
                          onClick={() => handleProgress(book)}
                        >
                          Salvar progresso
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        variant="danger"
                        isLoading={deletingBookId === book.id}
                        loadingLabel="Removendo..."
                        onClick={() => handleDelete(book)}
                      >
                        Remover livro
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
