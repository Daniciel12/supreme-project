"use client";

import { useEffect, useState } from "react";
import "@uploadthing/react/styles.css";
import { UploadDropzone } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import styles from "./visao.module.css";

interface VisionImage {
  id: string;
  imageUrl: string;
  createdAt: string;
}

function formatVisionDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function VisaoPage() {
  const [images, setImages] = useState<VisionImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/vision")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Erro ao carregar imagens.");
        if (!cancelled) {
          setImages(data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingImages(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(image: VisionImage) {
    if (!window.confirm("Remover esta referência do quadro de visão?")) return;

    setActionError(null);
    setDeletingId(image.id);
    try {
      const response = await fetch(`/api/vision?id=${image.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        setActionError(data.error ?? "Erro ao remover imagem.");
        return;
      }

      setImages((previous) => previous.filter((item) => item.id !== image.id));
    } catch {
      setActionError("Erro ao remover imagem.");
    } finally {
      setDeletingId(null);
    }
  }

  const visionUnavailable = loadingImages || loadError;
  const latestImage = images[0] ?? null;
  const visionNarrative =
    visionUnavailable
      ? {
          title: "Revelando o horizonte visual.",
          description:
            "A composição aparece assim que suas referências estiverem disponíveis.",
        }
      : images.length === 0
        ? {
            title: "O horizonte ainda está em branco.",
            description:
              "Escolha uma imagem que torne o futuro mais concreto e dê ao quadro seu primeiro ponto de direção.",
          }
        : images.length === 1
          ? {
              title: "Uma imagem já aponta a direção.",
              description:
                "A primeira referência abriu o horizonte. Continue apenas com imagens que expressem algo que vale construir.",
            }
          : {
              title: "O futuro já ganhou forma visual.",
              description:
                "Seu quadro reúne sinais do que importa. Observe as conexões antes de adicionar a próxima referência.",
            };

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Visão"
          title="Quadro de Visão"
          description="Reúna referências visuais que representem objetivos, ambientes e experiências que você quer construir."
          actions={
            <Badge tone="accent">
              {visionUnavailable ? "— referências" : `${images.length} referências`}
            </Badge>
          }
        />

        <Card
          className={styles.visionHorizon}
          aria-labelledby="vision-horizon-title"
          aria-busy={loadingImages}
        >
          <div className={styles.horizonCopy}>
            <span className={styles.horizonEyebrow}>Horizonte em composição</span>
            <h2 id="vision-horizon-title" className={styles.horizonTitle}>
              {visionNarrative.title}
            </h2>
            <p className={styles.horizonDescription}>{visionNarrative.description}</p>
          </div>

          <div className={styles.referenceCount}>
            <span className={styles.metricEyebrow}>Sinais reunidos</span>
            <strong className={styles.referenceValue}>
              {visionUnavailable ? "—" : images.length}
            </strong>
            <span className={styles.metricLabel}>
              {images.length === 1 ? "referência no quadro" : "referências no quadro"}
            </span>
          </div>

          <div className={styles.latestReference}>
            <span className={styles.metricEyebrow}>Última direção</span>
            <strong className={styles.latestValue}>
              {visionUnavailable || !latestImage
                ? "—"
                : formatVisionDate(latestImage.createdAt)}
            </strong>
            <span className={styles.metricLabel}>
              {latestImage ? "referência mais recente" : "aguardando a primeira imagem"}
            </span>
          </div>
        </Card>

        <Card className={styles.uploadCard}>
          <div className={styles.uploadCopy}>
            <span className={styles.uploadEyebrow}>Novo ponto de direção</span>
            <h2 className="card-title">Adicionar referência</h2>
            <p className={styles.description}>
              Envie uma imagem que represente um objetivo, ambiente ou experiência que você quer tornar real.
            </p>
            <p className={styles.securityNote}>
              O arquivo é vinculado à sua conta por uma rota autenticada.
            </p>
          </div>

          <UploadDropzone<OurFileRouter, "visionImageUploader">
            endpoint="visionImageUploader"
            className="ut-dropzone-dark"
            content={{
              label: ({ isDragActive }) =>
                isDragActive
                  ? "Solte a imagem aqui"
                  : "Escolha uma imagem ou arraste e solte",
              allowedContent: "Imagem de até 4 MB",
              button: ({ ready, isUploading }) => {
                if (isUploading) return "Enviando...";
                return ready ? "Escolher imagem" : "Preparando...";
              },
            }}
            onClientUploadComplete={(result) => {
              const image = result?.[0]?.serverData?.image;

              if (!image) {
                setActionError(
                  "Upload concluído, mas não foi possível registrar a imagem."
                );
                return;
              }

              setImages((previous) => [image, ...previous]);
              setActionError(null);
            }}
            onUploadError={(error: Error) => {
              setActionError(error.message || "Erro ao enviar imagem.");
            }}
          />
        </Card>

        {actionError && (
          <div className={styles.actionError} role="alert">
            {actionError}
          </div>
        )}

        <section className={styles.gallerySection} aria-labelledby="vision-gallery-title">
          <div className={styles.sectionHeader}>
            <h2 id="vision-gallery-title" className="card-title">
              Referências salvas
            </h2>
            <span className={styles.sectionHint}>Mais recentes primeiro</span>
          </div>

          {loadingImages ? (
            <LoadingState title="Carregando quadro de visão..." />
          ) : loadError ? (
            <ErrorState
              title="Não foi possível carregar o quadro de visão"
              description="Atualize a página para tentar novamente."
            />
          ) : images.length === 0 ? (
            <EmptyState
              title="Seu quadro ainda está vazio"
              description="Envie a primeira referência visual para começar a compor sua visão."
            />
          ) : (
            <div className={styles.visionGrid}>
              {images.map((image, index) => (
                <Card key={image.id} className={styles.visionItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.imageUrl}
                    alt={`Referência ${index + 1} do quadro de visão`}
                    className={styles.visionImage}
                    loading="lazy"
                  />
                  <div className={styles.visionMeta}>
                    <div>
                      <span className={styles.referenceIndex} aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <time dateTime={image.createdAt}>
                        Adicionada em {formatVisionDate(image.createdAt)}
                      </time>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={deletingId === image.id}
                      loadingLabel="Removendo..."
                      onClick={() => handleDelete(image)}
                      aria-label={`Remover referência ${index + 1} do quadro de visão`}
                    >
                      Remover
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
