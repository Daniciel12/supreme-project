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

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Visão"
          title="Quadro de Visão"
          description="Reúna referências visuais que representem objetivos, ambientes e experiências que você quer construir."
          actions={<Badge tone="accent">{images.length} referências</Badge>}
        />

        <Card className={styles.uploadCard}>
          <div>
            <h2 className="card-title">Adicionar referência</h2>
            <p className={styles.description}>
              O upload exige uma sessão autenticada e a imagem é vinculada diretamente à sua conta no servidor.
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
              {images.map((image) => (
                <Card key={image.id} className={styles.visionItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.imageUrl}
                    alt="Referência do quadro de visão"
                    className={styles.visionImage}
                    loading="lazy"
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    isLoading={deletingId === image.id}
                    loadingLabel="Removendo..."
                    onClick={() => handleDelete(image)}
                    aria-label="Remover referência do quadro de visão"
                  >
                    Remover
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
