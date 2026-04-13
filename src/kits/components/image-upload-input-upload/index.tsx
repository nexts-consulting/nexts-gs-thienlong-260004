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
  INSTANCE_NAME: "ImageUploadInputUpload",
};

const styles = {
  label: StyleUtil.cn("mb-2 block w-fit line-clamp-2 text-sm font-normal text-gray-70"),
  helperText: StyleUtil.cn("mb-2 line-clamp-3 text-sm text-gray-70"),
  trigger: StyleUtil.cn(
    "flex h-32 w-full cursor-pointer flex-col items-center justify-center px-4 transition-colors duration-200",
    "border border-2 border-dashed border-gray-30 bg-gray-10",
    "active:border-primary-50 focus:border-primary-50",
  ),
  triggerContent: StyleUtil.cn(
    "flex flex-col items-center justify-center text-center text-sm text-gray-70",
  ),
  previewCard: StyleUtil.cn("relative border border-gray-30 bg-white overflow-hidden"),
  uploadProgress: StyleUtil.cn(
    "absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-sm font-medium text-white",
  ),
  actionOverlay: StyleUtil.cn(
    "absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity",
    "group-hover:opacity-100",
  ),
};

export interface ImageUploadInputUploadProps {
  label?: string;
  helperText?: string;
  value?: string | null;
  onChange?: (url: string | null) => void;
  cloudConfig: CloudConfig;
  disabled?: boolean;
  accept?: string;
  onUploadingChange?: (uploading: boolean) => void;
  onUploadProgress?: (progress: number) => void;
  onUploadSuccess?: (url: string) => void;
  onUploadError?: (error: Error) => void;
}

export const ImageUploadInputUpload = React.memo(
  React.forwardRef<HTMLDivElement, ImageUploadInputUploadProps>((props, ref) => {
    const {
      label = "Tải ảnh",
      helperText = "Chọn ảnh để tải lên",
      value,
      onChange,
      cloudConfig,
      disabled = false,
      accept = "image/*",
      onUploadingChange,
      onUploadProgress,
      onUploadSuccess,
      onUploadError,
    } = props;

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const instanceId = React.useRef(CommonUtil.nanoid("alphaLower"));
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(value || null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [errorText, setErrorText] = React.useState("");
    const [isMaximized, setIsMaximized] = React.useState(false);

    const ids = React.useRef({
      container: StringUtil.createElementId(constants.INSTANCE_NAME, instanceId.current),
      trigger: StringUtil.createElementId(constants.INSTANCE_NAME, instanceId.current, "trigger"),
      input: StringUtil.createElementId(constants.INSTANCE_NAME, instanceId.current, "input"),
    });

    React.useEffect(() => {
      setPreviewUrl(value || null);
    }, [value]);

    const setUploadingState = (uploading: boolean) => {
      setIsUploading(uploading);
      onUploadingChange?.(uploading);
    };

    const handleOpenFile = () => {
      if (disabled || isUploading) return;
      inputRef.current?.click();
    };

    const handleRemove = () => {
      if (disabled || isUploading) return;
      setPreviewUrl(null);
      setErrorText("");
      onChange?.(null);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);
      setErrorText("");
      setProgress(0);
      setUploadingState(true);

      try {
        const uploaded = await uploadFileToCloud(file, cloudConfig, (nextProgress) => {
          setProgress(nextProgress);
          onUploadProgress?.(nextProgress);
        });
        URL.revokeObjectURL(localPreview);
        setPreviewUrl(uploaded.url);
        onChange?.(uploaded.url);
        onUploadSuccess?.(uploaded.url);
      } catch (error) {
        URL.revokeObjectURL(localPreview);
        setPreviewUrl(value || null);
        const uploadError = error instanceof Error ? error : new Error("Upload failed");
        setErrorText(uploadError.message);
        onUploadError?.(uploadError);
      } finally {
        setUploadingState(false);
      }
    };

    return (
      <>
        <div id={ids.current.container} ref={ref} className="relative mb-2">
          {label && (
            <label htmlFor={ids.current.trigger} className={styles.label}>
              {label}
            </label>
          )}
          {helperText && <p className={styles.helperText}>{helperText}</p>}

          {!!errorText && (
            <div className="mb-2">
              <NotificationBanner
                type="error"
                title="Upload Failed"
                description={errorText}
                closeable
                onDismiss={() => setErrorText("")}
              />
            </div>
          )}

          <input
            id={ids.current.input}
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden sr-only"
            style={{ display: "none" }}
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleFileChange}
            disabled={disabled || isUploading}
          />

          {!previewUrl && (
            <button
              id={ids.current.trigger}
              type="button"
              onClick={handleOpenFile}
              disabled={disabled || isUploading}
              className={StyleUtil.cn(styles.trigger, {
                "cursor-not-allowed opacity-50": disabled || isUploading,
              })}
            >
              <div className={styles.triggerContent}>
                <Icons.Image className="mb-2 h-5 w-5" />
                <p>{isUploading ? `Đang tải lên ${Math.round(progress)}%` : "Chọn ảnh"}</p>
              </div>
            </button>
          )}

          {previewUrl && (
            <div className={StyleUtil.cn(styles.previewCard, "group")}>
              <img
                src={previewUrl}
                alt="upload-preview"
                className="aspect-[3/2] w-full bg-gray-10 object-contain object-center"
              />
              {isUploading && (
                <div className={styles.uploadProgress}>
                  <div className="text-center">
                    <p>Uploading...</p>
                    <p className="mt-1 text-xs">{Math.round(progress)}%</p>
                  </div>
                </div>
              )}
              {!isUploading && (
                <div className={styles.actionOverlay}>
                  <IconButton
                    size="medium"
                    variant="white"
                    icon={Icons.Maximize}
                    onClick={() => setIsMaximized(true)}
                    disabled={disabled}
                  />
                  <IconButton
                    size="medium"
                    variant="white"
                    icon={Icons.Camera}
                    onClick={handleOpenFile}
                    disabled={disabled}
                  />
                  <IconButton
                    size="medium"
                    variant="danger"
                    icon={Icons.CloseLarge}
                    onClick={handleRemove}
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <Modal
          isOpen={!!previewUrl && isMaximized}
          onClose={() => setIsMaximized(false)}
          title={typeof label === "string" ? label : "Image Preview"}
        >
          {previewUrl && (
            <img
              src={previewUrl}
              alt="upload-preview-maximized"
              className="h-[65vh] w-full bg-gray-10 object-contain object-center"
            />
          )}
        </Modal>
      </>
    );
  })
);

ImageUploadInputUpload.displayName = "ImageUploadInputUpload";
