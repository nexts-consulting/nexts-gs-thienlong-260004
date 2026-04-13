"use client";

import React from "react";
import { uploadFileToCloud } from "@/components/DynamicForm/services/upload.service";
import type { CloudConfig } from "@/kits/components/image-capture-input-upload/types";
import { CommonUtil, StringUtil, StyleUtil } from "@/kits/utils";
import { IconButton } from "../icon-button";
import { Icons } from "../icons";
import { Modal } from "../modal";
import { NotificationBanner } from "../notification-banner";

const constants = {
  INSTANCE_NAME: "MultipleImagesUploadInputUpload",
};

const styles = {
  label: StyleUtil.cn("mb-2 block w-fit line-clamp-2 text-sm font-normal text-gray-70"),
  helperText: StyleUtil.cn("line-clamp-3 text-sm text-gray-70"),
  counter: StyleUtil.cn("bg-gray-10 px-3 py-1 text-sm font-medium text-gray-80"),
  trigger: StyleUtil.cn(
    "mt-3 flex h-28 w-full cursor-pointer flex-col items-center justify-center px-4 transition-colors duration-200",
    "border border-2 border-dashed border-gray-30 bg-gray-10",
    "active:border-primary-50 focus:border-primary-50",
  ),
  triggerContent: StyleUtil.cn(
    "flex flex-col items-center justify-center text-center text-sm text-gray-70",
  ),
  imageCard: StyleUtil.cn("group relative overflow-hidden border border-gray-30 bg-white"),
  uploadProgress: StyleUtil.cn(
    "absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-sm font-medium text-white",
  ),
  actionOverlay: StyleUtil.cn(
    "absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity",
    "group-hover:opacity-100",
  ),
  imageIndex: StyleUtil.cn(
    "absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white",
  ),
};

export interface MultipleImagesUploadInputUploadProps {
  label?: string;
  helperText?: string;
  value?: string[];
  onChange?: (urls: string[]) => void;
  cloudConfig: CloudConfig;
  disabled?: boolean;
  accept?: string;
  maxImages?: number;
  onUploadingChange?: (uploading: boolean) => void;
  onUploadProgress?: (index: number, progress: number) => void;
  onUploadSuccess?: (index: number, url: string) => void;
  onUploadError?: (index: number, error: Error) => void;
}

interface PendingUploadItem {
  id: string;
  localPreview: string;
  progress: number;
}

export const MultipleImagesUploadInputUpload = React.memo(
  React.forwardRef<HTMLDivElement, MultipleImagesUploadInputUploadProps>((props, ref) => {
    const {
      label = "Tải nhiều ảnh",
      helperText = "Chọn ảnh để tải lên",
      value,
      onChange,
      cloudConfig,
      disabled = false,
      accept = "image/*",
      maxImages = 3,
      onUploadingChange,
      onUploadProgress,
      onUploadSuccess,
      onUploadError,
    } = props;

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const instanceId = React.useRef(CommonUtil.nanoid("alphaLower"));
    const localPreviewRegistryRef = React.useRef<Set<string>>(new Set());
    const [pendingUploads, setPendingUploads] = React.useState<PendingUploadItem[]>([]);
    const [errorText, setErrorText] = React.useState("");
    const [previewImage, setPreviewImage] = React.useState<string | null>(null);

    const images = value || [];
    const totalCount = images.length + pendingUploads.length;
    const isUploading = pendingUploads.length > 0;
    const canAddMore = totalCount < maxImages;

    const ids = React.useRef({
      container: StringUtil.createElementId(constants.INSTANCE_NAME, instanceId.current),
      trigger: StringUtil.createElementId(constants.INSTANCE_NAME, instanceId.current, "trigger"),
      input: StringUtil.createElementId(constants.INSTANCE_NAME, instanceId.current, "input"),
    });

    React.useEffect(() => {
      onUploadingChange?.(isUploading);
    }, [isUploading, onUploadingChange]);

    React.useEffect(() => {
      return () => {
        localPreviewRegistryRef.current.forEach((localPreview) => {
          URL.revokeObjectURL(localPreview);
        });
        localPreviewRegistryRef.current.clear();
      };
    }, []);

    const handleOpenFile = () => {
      if (disabled || totalCount >= maxImages) return;
      inputRef.current?.click();
    };

    const handleRemoveUploaded = (index: number) => {
      if (disabled || isUploading) return;
      const next = images.filter((_, idx) => idx !== index);
      onChange?.(next);
    };

    const updatePendingProgress = (id: string, progress: number) => {
      setPendingUploads((prev) =>
        prev.map((item) => (item.id === id ? { ...item, progress } : item))
      );
    };

    const removePending = (id: string) => {
      setPendingUploads((prev) => {
        const target = prev.find((item) => item.id === id);
        if (target) {
          URL.revokeObjectURL(target.localPreview);
          localPreviewRegistryRef.current.delete(target.localPreview);
        }
        return prev.filter((item) => item.id !== id);
      });
    };

    const handleFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files || []);
      event.target.value = "";
      if (!selectedFiles.length) return;

      const remainSlots = Math.max(0, maxImages - totalCount);
      const files = selectedFiles.slice(0, remainSlots);
      if (!files.length) return;

      setErrorText("");
      const nextUploadedUrls = [...images];

      for (let idx = 0; idx < files.length; idx += 1) {
        const file = files[idx];
        const pendingId = `${Date.now()}-${idx}-${Math.random()}`;
        const localPreview = URL.createObjectURL(file);
        localPreviewRegistryRef.current.add(localPreview);

        setPendingUploads((prev) => [
          ...prev,
          { id: pendingId, localPreview, progress: 0 },
        ]);

        try {
          const uploaded = await uploadFileToCloud(file, cloudConfig, (progress) => {
            updatePendingProgress(pendingId, progress);
            onUploadProgress?.(nextUploadedUrls.length, progress);
          });
          nextUploadedUrls.push(uploaded.url);
          onChange?.([...nextUploadedUrls]);
          onUploadSuccess?.(nextUploadedUrls.length - 1, uploaded.url);
        } catch (error) {
          const uploadError = error instanceof Error ? error : new Error("Upload failed");
          setErrorText(uploadError.message);
          onUploadError?.(nextUploadedUrls.length, uploadError);
        } finally {
          removePending(pendingId);
        }
      }
    };

    return (
      <>
        <div id={ids.current.container} ref={ref} className="relative mb-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border border-gray-30 p-3">
            <div>
              {label && <label className={styles.label}>{label}</label>}
              {helperText && <p className={styles.helperText}>{helperText}</p>}
            </div>
            <p className={styles.counter}>
              {totalCount}/{maxImages}
            </p>
          </div>

          <input
            id={ids.current.input}
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden sr-only"
            style={{ display: "none" }}
            aria-hidden="true"
            tabIndex={-1}
            multiple
            onChange={handleFilesChange}
            disabled={disabled || !canAddMore}
          />

          {canAddMore && (
            <button
              id={ids.current.trigger}
              type="button"
              onClick={handleOpenFile}
              disabled={disabled}
              className={StyleUtil.cn(styles.trigger, { "cursor-not-allowed opacity-50": disabled })}
            >
              <div className={styles.triggerContent}>
                <Icons.Image className="mb-2 h-5 w-5" />
                <p>Chọn ảnh</p>
              </div>
            </button>
          )}

          {!!errorText && (
            <div className="mt-3">
              <NotificationBanner
                type="error"
                title="Upload Failed"
                description={errorText}
                closeable
                onDismiss={() => setErrorText("")}
              />
            </div>
          )}

          {(images.length > 0 || pendingUploads.length > 0) && (
            <div className="grid grid-cols-2 gap-3 border border-t-0 border-gray-30 p-3 md:grid-cols-3">
              {images.map((url, index) => (
                <div key={`uploaded-${index}`} className={styles.imageCard}>
                  <img
                    src={url}
                    alt={`uploaded-${index}`}
                    className="aspect-[3/2] w-full cursor-pointer bg-gray-10 object-cover"
                    onClick={() => setPreviewImage(url)}
                  />
                  <div className={styles.imageIndex}>{index + 1}</div>
                  <div className={styles.actionOverlay}>
                    <IconButton
                      size="medium"
                      variant="white"
                      icon={Icons.Maximize}
                      onClick={() => setPreviewImage(url)}
                      disabled={disabled || isUploading}
                    />
                    <IconButton
                      size="medium"
                      variant="danger"
                      icon={Icons.CloseLarge}
                      onClick={() => handleRemoveUploaded(index)}
                      disabled={disabled || isUploading}
                    />
                  </div>
                </div>
              ))}

              {pendingUploads.map((item) => (
                <div key={item.id} className={styles.imageCard}>
                  <img
                    src={item.localPreview}
                    alt="pending-upload"
                    className="aspect-[3/2] w-full bg-gray-10 object-cover"
                  />
                  <div className={styles.uploadProgress}>
                    <div className="text-center">
                      <p>Uploading...</p>
                      <p className="mt-1 text-xs">{Math.round(item.progress)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title={label}>
          {previewImage && (
            <img
              src={previewImage}
              alt="preview-image"
              className="h-[65vh] w-full bg-gray-10 object-contain object-center"
            />
          )}
        </Modal>
      </>
    );
  })
);

MultipleImagesUploadInputUpload.displayName = "MultipleImagesUploadInputUpload";
