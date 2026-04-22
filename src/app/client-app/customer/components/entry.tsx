"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGlobalContext } from "@/contexts/global.context";
import { TextInput } from "@/kits/components/text-input";
import { Button } from "@/kits/components/button";
import { Icons } from "@/kits/components/icons";
import { LoadingOverlay } from "@/kits/components/loading-overlay";
import { listCustomerReports, type RedeemReportEntry } from "@/services/api/application/report-entry/redeem";
import type { ProjectConfig } from "@/config/projects";
import { getAllGiftConfigs } from "@/config/projects";

const INITIAL_PAGE_SIZE = 10;

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const globalStore = useGlobalContext();
  const isDevMode = searchParams.get("mode") === "dev";

  // Derive gift config from project config
  const giftConfig = projectConfig
    ? getAllGiftConfigs(projectConfig)
    : [{ id: "holiday_304_gift", name: "Khăn quàng Cờ Việt Nam & Trải nghiệm tô vẽ nón lá" }];

  const displayName = projectConfig?.displayName ?? "Thiên Long Activation 30-04";
  const getSchemeDisplayName = (schemeValue?: string | null) => {
    const schemeIds = (schemeValue ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (schemeIds.length === 0) return "-";
    return schemeIds
      .map((schemeId) => projectConfig?.schemes.find((s) => s.id === schemeId)?.name ?? schemeId)
      .join(", ");
  };

  // Parent app data
  const [currentAttendance, setCurrentAttendance] = useState<CurrentAttendance | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Local state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customers, setCustomers] = useState<RedeemReportEntry[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<RedeemReportEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const dateString = useMemo(() => {
    return format(selectedDate, "yyyy-MM-dd");
  }, [selectedDate]);

  /**
   * Listen for messages from parent app
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

      if (!allowedOrigins.some((origin) => event.origin.includes(origin))) {
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
          }
          break;
        default:
          console.log("Unknown message type:", message.type);
      }
    };

    window.addEventListener("message", handleMessage);

    const parentOrigin = process.env.NEXT_PUBLIC_PARENT_APP_URL || "*";
    window.parent.postMessage({ type: "FORM_READY" }, parentOrigin);

    console.log("📡 Sent FORM_READY message to parent app");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isDevMode]);

  /**
   * Fetch customer reports from Supabase
   */
  const fetchCustomers = async () => {
    if (!currentAttendance) return;

    setIsLoading(true);
    try {
      const schemeIds = projectConfig?.schemes.map((s) => s.id);
      const response = await listCustomerReports({
        date: dateString,
        createdBy: currentAttendance.username,
        workshiftId: currentAttendance.workshift_id?.toString(),
        subCode: projectConfig?.projectCode ?? "",
        page: page,
        size: INITIAL_PAGE_SIZE,
      });

      setCustomers(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetch customers when date, attendance, or page changes
   */
  useEffect(() => {
    if (isReady && currentAttendance) {
      fetchCustomers();
    }
  }, [dateString, currentAttendance, page, isReady]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setSelectedDate(date);
    setPage(0);
  };

  const handleRefresh = () => {
    setPage(0);
    fetchCustomers();
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
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-semibold text-gray-800">{displayName}</p>
        </div>
        <p className="text-xs text-gray-60">
          Điểm làm việc: {currentAttendance.location_name} ({currentAttendance.location_code})
        </p>
        <p className="text-xs text-gray-60">
          Ca làm việc: {currentAttendance.workshift_name}
        </p>
      </div>

      <div className="flex flex-col gap-4 p-4 pt-0">
        <div className="flex items-center gap-2 mt-4 w-full">
          <TextInput
            type="date"
            value={dateString}
            onChange={handleDateChange}
            className="w-full border border-gray-200"
          />
          <Button
            variant="primary"
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-full max-w-[150px]"
          >
            Làm mới
          </Button>
        </div>

        {isLoading && <LoadingOverlay active={true} />}

        {!isLoading && customers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>Không có dữ liệu khách hàng</p>
          </div>
        )}

        {customers.map((customer) => (
          <div
            key={customer.id}
            className="border border-gray-200 p-4 shadow-sm bg-white cursor-pointer hover: transition-colors"
            onClick={() => setSelectedCustomer(customer)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {customer.customer_name}
                </h3>
                <p className="text-xs text-gray-600 mb-2">{customer.phone_number}</p>
                {customer.scheme && (
                  <p className="text-xs text-primary-50 font-medium mb-1">
                    {getSchemeDisplayName(customer.scheme)}
                  </p>
                )}
                <p className="text-xs text-gray-600 mb-2">
                  Tổng hóa đơn:{" "}
                  {customer.sale_data?.totalInvoice != null
                    ? customer.sale_data.totalInvoice.toLocaleString("vi-VN") + " VNĐ"
                    : "0 VNĐ"}
                </p>
                <p className="text-xs text-gray-500">
                  {customer.created_at
                    ? format(new Date(customer.created_at), "dd/MM/yyyy HH:mm")
                    : "-"}
                </p>
              </div>
              <div className="flex items-center">
                <Icons.ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        ))}

        {total > customers.length && (
          <Button
            variant="secondary"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={isLoading}
            className="w-full"
          >
            Tải thêm ({customers.length}/{total})
          </Button>
        )}
      </div>

      {/* Modal chi tiết khách hàng */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-lg w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-gray-900 font-semibold">Chi tiết khách hàng</h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-160px)]">
              <div className="p-4 space-y-4">
                {/* Thông tin khách hàng */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Thông tin khách hàng
                  </h4>
                  <div className="space-y-2 p-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tên khách hàng:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedCustomer.customer_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Số điện thoại:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedCustomer.phone_number}
                      </span>
                    </div>
                    {selectedCustomer.scheme && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Chương trình:</span>
                        <span className="text-sm font-medium text-primary-50">
                          {getSchemeDisplayName(selectedCustomer.scheme)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tổng hóa đơn:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedCustomer.sale_data?.totalInvoice != null
                          ? selectedCustomer.sale_data.totalInvoice.toLocaleString("vi-VN") +
                            " VNĐ"
                          : "0 VNĐ"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Điểm làm việc:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedCustomer.location_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Ca làm việc:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedCustomer.workshift_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Thời gian:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedCustomer.created_at
                          ? format(new Date(selectedCustomer.created_at), "dd/MM/yyyy HH:mm")
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Thông tin quà tặng */}
                {selectedCustomer.gift_data && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Thông tin quà tặng
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <table className="min-w-full bordery divide-gray-200">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                                Tên quà tặng
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">
                                Số lượng
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {Object.entries(selectedCustomer.gift_data.gifts || {})
                              .filter(([_, quantity]) => (quantity as number) > 0)
                              .map(([giftId, quantity]) => (
                                <tr key={giftId}>
                                  <td className="px-4 py-2 text-sm text-gray-700">
                                    {giftConfig.find((gift) => gift.id === giftId)?.name ||
                                      giftId}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                    {quantity as number}
                                  </td>
                                </tr>
                              ))}
                            {Object.entries(selectedCustomer.gift_data.gifts || {}).filter(
                              ([_, quantity]) => (quantity as number) > 0
                            ).length === 0 && (
                              <tr>
                                <td
                                  className="px-4 py-2 text-center text-sm text-gray-500"
                                  colSpan={2}
                                >
                                  Không có quà tặng nào
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Hóa đơn */}
                      {selectedCustomer.sale_data?.invoiceImageUrls?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 mb-2">
                            Hình ảnh hóa đơn
                          </h5>
                          <div className="grid grid-cols-1 gap-2">
                            {selectedCustomer.sale_data.invoiceImageUrls.map(
                              (imageUrl, index) => (
                                <div key={index} className="borderhidden">
                                  <img
                                    src={imageUrl}
                                    alt={`Hóa đơn ${index + 1}`}
                                    className="w-full h-auto"
                                  />
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hình khách hàng nhận quà */}
                      {selectedCustomer.gift_data?.giftReceiveImageUrl && (
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 mb-2">
                            Hình khách hàng nhận quà
                          </h5>
                          <div className="borderhidden">
                            <img
                              src={selectedCustomer.gift_data.giftReceiveImageUrl}
                              alt="Hình khách hàng nhận quà"
                              className="w-full h-auto"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4">
              <Button
                variant="tertiary"
                onClick={() => setSelectedCustomer(null)}
                className="w-full"
                centered
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
