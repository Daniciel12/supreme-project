"use client";

import { useEffect, useState } from "react";
import "@uploadthing/react/styles.css";
import { UploadDropzone } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

interface VisionImage {
  id: string;
  imageUrl: string;
  createdAt: string;
}

export default function VisaoPage() {
  const [images, setImages] = useState<VisionImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadImages() {
      try {
        const res = await fetch("/api/vision");
        const data = await res.json();
        if (res.ok) setImages(data);
      } catch (err) {
        console.error("Erro ao carregar imagens", err);
      } finally {
        setLoadingImages(false);
      }
    }

    loadImages();
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/vision?id=${id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        console.error(data.error ?? "Erro ao remover imagem.");
        return;
      }

      setImages((prev) => prev.filter((image) => image.id !== id));
    } catch (err) {
      console.error("Erro ao remover imagem", err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        <div className="card">
          <h2 className="card-title">Quadro de Visão</h2>

          <UploadDropzone<OurFileRouter, "visionImageUploader">
            endpoint="visionImageUploader"
            className="ut-dropzone-dark"
            onClientUploadComplete={async (res) => {
              const imageUrl = res?.[0]?.url;
              if (!imageUrl) return;

              try {
                const response = await fetch("/api/vision", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ imageUrl }),
                });

                const data = await response.json();

                if (!response.ok) {
                  console.error(data.error ?? "Erro ao salvar imagem.");
                  return;
                }

                setImages((prev) => [data, ...prev]);
              } catch (err) {
                console.error("Erro ao salvar imagem enviada", err);
              }
            }}
            onUploadError={(error: Error) => {
              console.error("Erro no upload", error);
            }}
          />
        </div>

        <div className="vision-grid">
          {loadingImages ? (
            <p className="empty-state">Carregando imagens...</p>
          ) : images.length === 0 ? (
            <p className="empty-state">
              Nenhuma imagem cadastrada ainda. Envie a primeira acima.
            </p>
          ) : (
            images.map((image) => (
              <div key={image.id} className="vision-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.imageUrl} alt="Imagem do quadro de visão" />
                <button
                  type="button"
                  className="vision-delete-btn"
                  onClick={() => handleDelete(image.id)}
                  disabled={deletingId === image.id}
                  aria-label="Excluir imagem"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
