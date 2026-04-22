"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useGlobalContext } from "@/contexts/global.context";
import { CurrencyInput } from "@/components/DynamicForm/fields/CurrencyInput";
import { TextInput } from "@/kits/components/text-input";
import { Button } from "@/kits/components/button";
import { IconButton } from "@/kits/components/icon-button";
import { Icons } from "@/kits/components/icons";
import { LoadingOverlay } from "@/kits/components/loading-overlay";
import { useNotification } from "@/kits/components/notification";
import { ImageCaptureInputWithUpload } from "@/kits/components/image-capture-input-upload";
import { MultipleImagesCaptureInputUpload } from "@/kits/components/multiple-images-capture-input-upload";
import { StyleUtil } from "@/kits/utils";
import { createRedeemReport } from "@/services/api/application/report-entry/redeem";
import type { CloudConfig } from "@/kits/components/image-capture-input-upload/types";
import type { ProjectConfig, SchemeConfig } from "@/config/projects";

/**
 * Interface for currentAttendance data from parent app
 */
interface CurrentAttendance {
  id: number;
  project_code: string;
  username: string;
  workshift_id: number | null;
  workshift_name: string;
  shift_start_time: string | null;
  shift_end_time: string | null;
  location_id: number | null;
  location_code: string;
  location_name: string;
  checkin_time: string | null;
  checkout_time: string | null;
  status: "CHECKED_IN" | "CHECKED_OUT" | "AUTO_CHECKED_OUT";
  timing_status: "ON_TIME" | "LATE" | "EARLY" | "ABSENT";
  checkin_photo_url: string | null;
  checkout_photo_url: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkout_lat: number | null;
  checkout_lng: number | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const DEV_ATTENDANCE: CurrentAttendance = {
  id: 99999,
  project_code: "DEV_PROJECT",
  username: "dev_user",
  workshift_id: 1,
  workshift_name: "Ca dev test",
  shift_start_time: null,
  shift_end_time: null,
  location_id: 1,
  location_code: "DEV_LOC",
  location_name: "Dev Location",
  checkin_time: new Date().toISOString(),
  checkout_time: null,
  status: "CHECKED_IN",
  timing_status: "ON_TIME",
  checkin_photo_url: null,
  checkout_photo_url: null,
  checkin_lat: null,
  checkin_lng: null,
  checkout_lat: null,
  checkout_lng: null,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

interface EntryProps {
  projectConfig?: ProjectConfig;
}

export const Entry = ({ projectConfig }: EntryProps) => {
  const globalStore = useGlobalContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const notification = useNotification();
  const isDevMode = searchParams.get("mode") === "dev";

  // Fallback config for backward compat (260006)
  const config = projectConfig ?? {
    slug: "260006",
    projectCode: "nx-gs-thienlong-260006",
    displayName: "Thiên Long Activation 30-04",
    firebaseBucketPath: "thienlong-holiday-304-2026/redeem",
    hasSchemeSelector: false,
    schemes: [
      {
        id: "holiday_304_scheme",
        name: "Lễ 30/4",
        description: "Hóa đơn Thiên Long từ 75K",
        subCode: "thienlong_75k",
        gifts: [
          { id: "holiday_304_gift", name: "Khăn quàng Cờ Việt Nam & Trải nghiệm tô vẽ nón lá" },
        ],
      },
    ],
  };

  const {
    watch,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      totalInvoice: 0,
    },
  });

  // Parent app data - required before allowing input
  const [currentAttendance, setCurrentAttendance] = useState<CurrentAttendance | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Scheme selection (for multi-scheme projects)
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<string[]>(
    config.hasSchemeSelector ? [] : [config.schemes[0]?.id].filter(Boolean) as string[]
  );

  const selectedSchemes: SchemeConfig[] = useMemo(
    () => config.schemes.filter((scheme) => selectedSchemeIds.includes(scheme.id)),
    [config.schemes, selectedSchemeIds]
  );

  // Form states
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [giftReceiveImageUrl, setGiftReceiveImageUrl] = useState<string | null>(null);
  const [invoiceImageUrls, setInvoiceImageUrls] = useState<string[]>([]);
  const [gifts, setGifts] = useState<Record<string, number>>({});
  const [selectedGiftRadioByScheme, setSelectedGiftRadioByScheme] = useState<Record<string, string | null>>({});
  const [formKey, setFormKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [componentKey, setComponentKey] = useState(0);

  // Track image uploading states
  const [isGiftImageUploading, setIsGiftImageUploading] = useState(false);
  const [invoiceUploadingSet, setInvoiceUploadingSet] = useState<Set<number>>(new Set());

  const isLocalOrPendingImageUrl = (url?: string | null) => {
    if (!url) return true;
    const normalized = url.trim().toLowerCase();
    if (!normalized) return true;

    if (
      normalized.startsWith("blob:") ||
      normalized.startsWith("data:") ||
      normalized.startsWith("file:")
    ) {
      return true;
    }

    try {
      const parsed = new URL(url);
      const isHttpUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
      if (!isHttpUrl) return true;

      const host = parsed.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
        return true;
      }

      return false;
    } catch {
      return true;
    }
  };

  const hasPendingInvoiceImages = invoiceImageUrls.some((url) => isLocalOrPendingImageUrl(url));
  const hasPendingGiftImage = isLocalOrPendingImageUrl(giftReceiveImageUrl);
  const isAnyUploading =
    isGiftImageUploading ||
    invoiceUploadingSet.size > 0 ||
    hasPendingInvoiceImages ||
    (giftReceiveImageUrl ? hasPendingGiftImage : false);

  const formValues = watch();
  const totalInvoice = formValues?.totalInvoice || 0;

  const MAX_GIFTS_PER_INVOICE = 100;

  // Firebase cloud config for image uploads
  const invoiceCloudConfig: CloudConfig = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const locationName = currentAttendance?.location_name || "unknown";
    return {
      provider: "firebase",
      path: `${config.firebaseBucketPath}/${locationName}/${today}`,
      generateFileName: (file: File) => {
        const phoneStr = phone || "unknown";
        return `invoice_${phoneStr}_${Date.now()}_${file.name}`;
      },
    };
  }, [config.firebaseBucketPath, currentAttendance?.location_name, phone]);

  const giftReceiveCloudConfig: CloudConfig = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const locationName = currentAttendance?.location_name || "unknown";
    return {
      provider: "firebase",
      path: `${config.firebaseBucketPath}/${locationName}/${today}`,
      generateFileName: (file: File) => {
        const phoneStr = phone || "unknown";
        return `gift_receive_${phoneStr}_${Date.now()}.jpg`;
      },
    };
  }, [config.firebaseBucketPath, currentAttendance?.location_name, phone]);

  // Calculate total quantity of selected gifts
  const totalGiftQuantity = Object.values(gifts).reduce((sum, qty) => sum + qty, 0);

  // Calculate all gifts customer will receive
  const getCustomerGifts = () => {
    const customerGifts: Array<{ name: string; qty: number }> = [];

    const selectedGiftNameById = new Map<string, string>();

    selectedSchemes.forEach((scheme) => {
      scheme.gifts.forEach((gift) => selectedGiftNameById.set(gift.id, gift.name));
    });

    Object.entries(gifts).forEach(([giftId, qty]) => {
      if (qty > 0) {
        const giftName = selectedGiftNameById.get(giftId);
        if (giftName) {
          customerGifts.push({ name: giftName, qty });
        }
      }
    });

    return customerGifts;
  };

  const customerGifts = getCustomerGifts();

  // Adjust gift quantity
  const adjustGift = (giftId: string, delta: number) => {
    setGifts((prev) => {
      const currentQty = prev[giftId] || 0;

      if (delta > 0) {
        return { ...prev, [giftId]: currentQty + 1 };
      }

      if (delta < 0) {
        if (currentQty <= 0) return prev;
        const newQty = currentQty - 1;
        if (newQty <= 0) {
          const { [giftId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [giftId]: newQty };
      }

      return prev;
    });
  };

  // Keep gifts and radio selections in sync with selected schemes
  useEffect(() => {
    const selectedSchemeIdSet = new Set(selectedSchemeIds);
    const validGiftIds = new Set(
      config.schemes
        .filter((scheme) => selectedSchemeIdSet.has(scheme.id))
        .flatMap((scheme) => scheme.gifts.map((gift) => gift.id))
    );

    setGifts((prev) => {
      const next = Object.entries(prev).reduce<Record<string, number>>((acc, [giftId, qty]) => {
        if (validGiftIds.has(giftId)) {
          acc[giftId] = qty;
        }
        return acc;
      }, {});
      return next;
    });

    setSelectedGiftRadioByScheme((prev) => {
      const next = Object.entries(prev).reduce<Record<string, string | null>>((acc, [schemeId, giftId]) => {
        if (selectedSchemeIdSet.has(schemeId)) {
          acc[schemeId] = giftId;
        }
        return acc;
      }, {});
      return next;
    });
  }, [config.schemes, selectedSchemeIds]);

  // Reset gifts when totalInvoice changes
  useEffect(() => {
    if (!totalInvoice) {
      setGifts({});
      setSelectedGiftRadioByScheme({});
    }
  }, [totalInvoice]);

  /**
   * Listen for messages from parent app via postMessage API
   */
  useEffect(() => {
    if (isDevMode) {
      setCurrentAttendance(DEV_ATTENDANCE);
      setIsReady(true);
      console.log("🛠️ DEV MODE: Using dummy attendance data");
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_PARENT_APP_URL || "",
        "http://localhost:3000",
        "http://localhost:3001",
        "https://fms-app.nextsconsulting.com",
        "https://fms-admin.nextsconsulting.com",
      ].filter(Boolean);

      if (!allowedOrigins.some(origin => event.origin.includes(origin))) {
        console.warn("Message from untrusted origin:", event.origin);
        return;
      }

      const message = event.data;

      switch (message.type) {
        case "INIT_FORM_DATA":
          const attendance = message.payload?.currentAttendance;
          if (attendance) {
            setCurrentAttendance(attendance);
            setIsReady(true);
            console.log("✅ Received attendance data from parent app:", attendance);
          } else {
            console.warn("⚠️ No attendance data received from parent app");
            notification.warning({
              title: "Cảnh báo",
              description: "Chưa có thông tin chấm công. Vui lòng check-in trước khi sử dụng form.",
            });
          }
          break;
        default:
          console.log("Unknown message type:", message.type);
      }
    };

    window.addEventListener("message", handleMessage);

    const parentOrigin = process.env.NEXT_PUBLIC_PARENT_APP_URL || "*";
    window.parent.postMessage(
      { type: "FORM_READY" },
      parentOrigin
    );

    console.log("📡 Sent FORM_READY message to parent app");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isDevMode]);

  const onSubmit = async (formData: any) => {
    if (!currentAttendance) {
      notification.error({
        title: "Lỗi",
        description: "Chưa có thông tin chấm công từ ứng dụng chính. Vui lòng kiểm tra lại.",
        options: { duration: 4000 },
      });
      return;
    }

    if (selectedSchemes.length === 0) {
      notification.error({
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất 1 chương trình khuyến mãi.",
        options: { duration: 4000 },
      });
      return;
    }

    const validationErrors: string[] = [];

    if (!fullName) {
      validationErrors.push("Họ tên khách hàng không được để trống");
    }

    if (totalInvoice > 0) {
      if (!invoiceImageUrls || invoiceImageUrls.length === 0) {
        validationErrors.push("Chụp ít nhất 1 hình ảnh hóa đơn");
      } else if (invoiceImageUrls.some((url) => isLocalOrPendingImageUrl(url))) {
        validationErrors.push("Ảnh hóa đơn chưa tải lên xong. Vui lòng chờ upload hoàn tất.");
      }
    }

    if (!giftReceiveImageUrl) {
      validationErrors.push("Chụp hình khách nhận quà");
    } else if (isLocalOrPendingImageUrl(giftReceiveImageUrl)) {
      validationErrors.push("Ảnh khách nhận quà chưa tải lên xong. Vui lòng chờ upload hoàn tất.");
    }

    // Validate gift selection
    const hasAnyGiftSelected = totalGiftQuantity > 0;
    if (!hasAnyGiftSelected) {
      validationErrors.push("Vui lòng chọn ít nhất 1 quà tặng");
    }

    selectedSchemes.forEach((scheme) => {
      const hasSelectableGiftsInScheme = scheme.gifts.some((gift) => gift.selectable);
      if (hasSelectableGiftsInScheme && !selectedGiftRadioByScheme[scheme.id]) {
        validationErrors.push(`Vui lòng chọn quà cho "${scheme.name}"`);
      }
    });

    if (validationErrors.length > 0) {
      notification.error({
        title: "Vui lòng kiểm tra lại thông tin",
        description: (
          <div>
            {validationErrors.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </div>
        ),
        options: { duration: 4000 },
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build gift data
      const allGifts: Record<string, number> = {};

      Object.entries(gifts).forEach(([giftId, qty]) => {
        if (qty > 0) {
          allGifts[giftId] = qty;
        }
      });

      const promotionSchemeValue = selectedSchemes.map((scheme) => scheme.id).join(",");
      const schemeValue = selectedSchemes.map((scheme) => scheme.id).join(",");
      const subCodeValue = projectConfig?.projectCode ?? "";

      const response = await createRedeemReport({
        customerPhone: phone,
        customerName: fullName,
        totalInvoice: totalInvoice,
        promotionScheme: promotionSchemeValue,
        gifts: allGifts,
        giftReceiveImageUrl: giftReceiveImageUrl || "",
        invoiceImageUrls: invoiceImageUrls,
        locationCode: currentAttendance.location_code,
        locationName: currentAttendance.location_name,
        workshiftId: currentAttendance.workshift_id?.toString(),
        workshiftName: currentAttendance.workshift_name,
        createdBy: currentAttendance.username,
        subCode: subCodeValue,
        scheme: schemeValue,
        otherData: {
          selectedSchemes: selectedSchemes.map((scheme) => ({
            id: scheme.id,
            name: scheme.name,
            subCode: scheme.subCode,
          })),
        },
      });

      if (response.success) {
        setComponentKey((prev) => prev + 1);
        notification.success({
          title: "Gửi thành công",
          description: "Thông tin khách hàng đã được ghi nhận.",
          options: { duration: 3000 },
        });

        // Reset form
        reset({ totalInvoice: 0 });
        setPhone("");
        setFullName("");
        setGiftReceiveImageUrl(null);
        setInvoiceImageUrls([]);
        setGifts({});
        setSelectedGiftRadioByScheme({});
        setFormKey((prev) => prev + 1);
        if (config.hasSchemeSelector) {
          setSelectedSchemeIds([]);
        }

        // Notify parent app
        window.parent.postMessage(
          {
            type: "FORM_SUBMITTED",
            payload: { reportId: response.data?.id },
          },
          process.env.NEXT_PUBLIC_PARENT_APP_URL || "*"
        );
      } else {
        notification.error({
          title: "Lỗi khi gửi",
          description: response.error || "Có lỗi xảy ra khi lưu dữ liệu",
          options: { duration: 3000 },
        });
      }
    } catch (err: any) {
      console.error("Error submitting report:", err);
      notification.error({
        title: "Lỗi khi gửi",
        description: err.message || "Có lỗi xảy ra",
        options: { duration: 3000 },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while waiting for parent app data
  if (!isReady || !currentAttendance) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-10">
        <div className="text-center">
          <LoadingOverlay active={true} />
          <p className="mt-32 text-sm text-gray-60">
            Đang tải dữ liệu từ ứng dụng chính...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <LoadingOverlay active={isSubmitting} />
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <p className="text-sm font-semibold text-gray-800">{config.displayName}</p>
        <p className="text-xs text-gray-60 mt-1">
          Điểm làm việc: {currentAttendance.location_name} ({currentAttendance.location_code})
        </p>
        <p className="text-xs text-gray-60">
          Ca làm việc: {currentAttendance.workshift_name}
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="mb-16">
          <div className="flex-1 overflow-auto p-4">

            {/* General Information */}
            <div className={StyleUtil.cn("mb-6")}>
              <h3 className="mb-3 text-base font-semibold text-gray-800">
                Thông tin khách hàng và hóa đơn
              </h3>
              <div className="space-y-4 bg-white p-5">
                <TextInput
                  type="number"
                  label="Số điện thoại"
                  placeholder="VD: 0901234567"
                  value={phone}
                  maxLength={10}
                  minLength={10}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <TextInput
                  label="Họ tên khách hàng"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                  }}
                />
                <CurrencyInput
                  label="Tổng số tiền hóa đơn"
                  placeholder="Nhập tổng số tiền hóa đơn"
                  value={totalInvoice}
                  onChange={(value) => {
                    setValue("totalInvoice", Number(value) || 0);
                  }}
                  error={!!errors.totalInvoice}
                />

                <MultipleImagesCaptureInputUpload
                  key={componentKey}
                  label="Hình ảnh hóa đơn"
                  helperText="Chụp ảnh hóa đơn"
                  value={invoiceImageUrls}
                  onChange={setInvoiceImageUrls}
                  enableUpload={true}
                  cloudConfig={invoiceCloudConfig}
                  minImages={totalInvoice === 0 ? 0 : 1}
                  maxImages={3}
                  defaultFacingMode="environment"
                  onUploadProgress={(idx) => {
                    setInvoiceUploadingSet((prev) => new Set(prev).add(idx));
                  }}
                  onUploadSuccess={(idx) => {
                    setInvoiceUploadingSet((prev) => {
                      const next = new Set(prev);
                      next.delete(idx);
                      return next;
                    });
                  }}
                  onUploadError={(idx) => {
                    setInvoiceUploadingSet((prev) => {
                      const next = new Set(prev);
                      next.delete(idx);
                      return next;
                    });
                  }}
                />
              </div>
            </div>

            {/* Scheme Selector (for multi-scheme projects) */}
            {config.hasSchemeSelector && (
              <div className="mb-6">
                <h3 className="mb-3 text-base font-semibold text-gray-800">
                  Chọn chương trình khuyến mãi
                </h3>
                <div className="space-y-2">
                  {config.schemes.map((scheme) => {
                    const isSelected = selectedSchemeIds.includes(scheme.id);
                    return (
                    <div
                      key={scheme.id}
                      className={StyleUtil.cn(
                        "border p-4 cursor-pointer transition-colors",
                        isSelected
                          ? "border-primary-50 bg-primary-50/5"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                      onClick={() => {
                        setSelectedSchemeIds((prev) =>
                          prev.includes(scheme.id)
                            ? prev.filter((id) => id !== scheme.id)
                            : [...prev, scheme.id]
                        );
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={StyleUtil.cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                            isSelected
                              ? "border-primary-50"
                              : "border-gray-300"
                          )}
                        >
                          {isSelected && (
                            <Icons.CheckboxCheckedFilled className="w-3 h-3 text-primary-50" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{scheme.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{scheme.description}</p>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Gift Options */}
            {selectedSchemes.length > 0 && (
              <div className={StyleUtil.cn("mb-6", { "opacity-50": !totalInvoice })}>
                <h3 className="mb-3 text-base font-semibold text-gray-800">
                  Chọn quà tặng
                </h3>

                <div className="space-y-4">
                  {selectedSchemes.map((scheme) => {
                    const hasSelectableGiftsInScheme = scheme.gifts.some((gift) => gift.selectable);
                    return (
                      <div key={scheme.id} className="bg-white p-4">
                        <p className="mb-2 text-sm font-semibold text-gray-800">{scheme.name}</p>
                        <p className="mb-3 text-xs text-gray-500">{scheme.description}</p>

                        {hasSelectableGiftsInScheme ? (
                          <div className="space-y-2">
                            {scheme.gifts.map((gift) => (
                              <label
                                key={gift.id}
                                className={StyleUtil.cn(
                                  "flex items-center gap-3 p-3 border cursor-pointer transition-colors",
                                  selectedGiftRadioByScheme[scheme.id] === gift.id
                                    ? "border-primary-50 bg-primary-50/5"
                                    : "border-gray-200 hover:border-gray-300"
                                )}
                              >
                                <input
                                  type="radio"
                                  name={`gift-selection-${scheme.id}`}
                                  value={gift.id}
                                  checked={selectedGiftRadioByScheme[scheme.id] === gift.id}
                                  onChange={() => {
                                    setSelectedGiftRadioByScheme((prev) => ({
                                      ...prev,
                                      [scheme.id]: gift.id,
                                    }));
                                    setGifts((prev) => {
                                      const next = { ...prev };
                                      scheme.gifts.forEach((schemeGift) => {
                                        delete next[schemeGift.id];
                                      });
                                      next[gift.id] = 1;
                                      return next;
                                    });
                                  }}
                                  disabled={!totalInvoice}
                                  className="h-4 w-4 accent-primary-50"
                                />
                                <span className="text-sm font-medium text-gray-900">{gift.name}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-200 bg-white">
                            {scheme.gifts.map((gift) => {
                              const qty = gifts[gift.id] || 0;
                              return (
                                <div key={gift.id} className="grid grid-cols-2 items-center gap-2 p-4">
                                  <div className="col-span-1">
                                    <p className="text-sm font-medium text-gray-900">{gift.name}</p>
                                  </div>
                                  <div className="flex items-center justify-end gap-2">
                                    <IconButton
                                      size="large"
                                      variant="tertiary"
                                      icon={Icons.Subtract}
                                      onClick={() => adjustGift(gift.id, -1)}
                                      disabled={qty === 0 || !totalInvoice}
                                    />
                                    <input
                                      className="w-16 border border-gray-300 py-2 text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-50"
                                      value={qty}
                                      readOnly
                                    />
                                    <IconButton
                                      size="large"
                                      variant="tertiary"
                                      icon={Icons.Add}
                                      onClick={() => adjustGift(gift.id, 1)}
                                      disabled={!totalInvoice}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Customer Gifts Summary */}
            {customerGifts.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-base font-semibold text-gray-800">
                  Tổng hợp quà khách nhận được
                </h3>
                <div className="bg-white p-4">
                  <div className="space-y-2">
                    {customerGifts.map((gift, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 border-l-4 border-primary-50 bg-primary-50/5 p-3"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">
                            <span className="text-primary-50 font-semibold">{gift.qty}x</span> - {gift.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h3 className="mb-3 text-base font-semibold text-gray-800">Hình khách nhận quà</h3>
              <div className="space-y-4 bg-white p-5">
                <ImageCaptureInputWithUpload
                  key={formKey}
                  defaultFacingMode="environment"
                  enableUpload={true}
                  helperText="Chụp ảnh khách nhận quà"
                  value={giftReceiveImageUrl}
                  onChange={setGiftReceiveImageUrl}
                  cloudConfig={giftReceiveCloudConfig}
                  onUploadProgress={() => setIsGiftImageUploading(true)}
                  onUploadSuccess={() => setIsGiftImageUploading(false)}
                  onUploadError={() => setIsGiftImageUploading(false)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4">
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            centered
            disabled={isSubmitting || isAnyUploading}
          >
            {isAnyUploading ? "Đang tải ảnh lên..." : "Lưu báo cáo"}
          </Button>
        </div>
      </form>
    </>
  );
};
