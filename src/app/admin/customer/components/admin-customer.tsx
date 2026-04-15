"use client";

import { useState, useEffect, useRef } from "react";
import {
  Table,
  DatePicker,
  Input,
  Button,
  Space,
  Modal,
  Descriptions,
  Image,
  Tag,
  Card,
  Row,
  Col,
  Typography,
  Divider,
  message,
  Form,
  Select,
  InputNumber,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import ExcelJS from "exceljs";
import {
  listCustomerReports,
  listAllCustomerReports,
  updateRedeemReport,
  type RedeemReportEntry
} from "@/services/api/application/report-entry/redeem";
import type { ProjectConfig } from "@/config/projects";
import { getAllGiftConfigs } from "@/config/projects";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

interface AdminCustomerPageProps {
  projectConfig?: ProjectConfig;
}

export default function AdminCustomerPage({ projectConfig }: AdminCustomerPageProps) {
  // Derive gift config from project config
  const giftConfig = projectConfig
    ? getAllGiftConfigs(projectConfig)
    : [{ id: "holiday_304_gift", name: "Khăn quàng Cờ Việt Nam & Trải nghiệm tô vẽ nón lá" }];

  const displayName = projectConfig?.displayName ?? "Thiên Long Activation 30-04";

  // Build scheme options for filter
  const schemeOptions = projectConfig?.schemes.map((s) => ({
    value: s.id,
    label: s.name,
  })) ?? [];

  // Scheme IDs for this project (used to filter data per project)
  const projectSchemeIds = projectConfig?.schemes.map((s) => s.id) ?? [];

  // States
  const [data, setData] = useState<RedeemReportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<RedeemReportEntry | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form instance
  const [verificationForm] = Form.useForm();

  // Filter states
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    dayjs().startOf("day"),
    dayjs().endOf("day"),
  ]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [schemeFilter, setSchemeFilter] = useState<string | undefined>(undefined);

  const getCurrentInvoiceAmount = (record: RedeemReportEntry) => {
    const verification = (record.other_data as any)?.verification;
    return verification?.adjustedAmount ?? record.sale_data?.totalInvoice ?? 0;
  };

  const formatCurrencyValue = (value: number) => `${value.toLocaleString("vi-VN")} ₫`;

  // Pagination state
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total) => `Tổng ${total} bản ghi`,
    pageSizeOptions: ["10", "20", "50", "100"],
  });

  /**
   * Fetch data from Supabase
   */
  const fetchData = async (page = 1, pageSize = 10, overrides?: Record<string, any>) => {
    setLoading(true);
    try {
      const params: any = {
        page: page - 1,
        size: pageSize,
        schemeIn: projectSchemeIds.length > 0 ? projectSchemeIds : undefined,
      };

      if (overrides) {
        Object.assign(params, overrides);
      } else {
        if (dateRange[0] && dateRange[1]) {
          params.dateFrom = dateRange[0].format("YYYY-MM-DD");
          params.dateTo = dateRange[1].format("YYYY-MM-DD");
        }

        if (phoneNumber.trim()) {
          params.phoneNumber = phoneNumber.trim();
        }

        if (customerName.trim()) {
          params.customerName = customerName.trim();
        }
      }

      const response = await listCustomerReports(params);

      // Client-side filter by scheme if needed
      let filteredData = response.data;
      let filteredTotal = response.total;
      if (schemeFilter) {
        filteredData = response.data.filter((r) => r.scheme === schemeFilter);
        filteredTotal = filteredData.length;
      }

      setData(filteredData);
      setTotal(filteredTotal);
      setPagination((prev) => ({
        ...prev,
        current: page,
        pageSize: pageSize,
        total: filteredTotal,
      }));
    } catch (error) {
      console.error("Error fetching data:", error);
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const initialDateRef = useRef({
    from: dayjs().startOf("day").format("YYYY-MM-DD"),
    to: dayjs().endOf("day").format("YYYY-MM-DD"),
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await listCustomerReports({
          page: 0,
          size: 10,
          dateFrom: initialDateRef.current.from,
          dateTo: initialDateRef.current.to,
          schemeIn: projectSchemeIds.length > 0 ? projectSchemeIds : undefined,
        });
        if (cancelled) return;

        setData(response.data);
        setTotal(response.total);
        setPagination((prev) => ({
          ...prev,
          current: 1,
          total: response.total,
        }));
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching data:", error);
        setData([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const inIframe = window.self !== window.top;
    setIsInIframe(inIframe);

    if (inIframe) {
      window.parent.postMessage(
        {
          type: "CHILD_READY",
          payload: { component: "customer-page" },
        },
        "*"
      );
    }
  }, []);

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    fetchData(newPagination.current || 1, newPagination.pageSize || 10);
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    fetchData(1, pagination.pageSize);
  };

  const handleReset = () => {
    const today: [Dayjs, Dayjs] = [dayjs().startOf("day"), dayjs().endOf("day")];
    setDateRange(today);
    setPhoneNumber("");
    setCustomerName("");
    setSchemeFilter(undefined);
    setPagination((prev) => ({ ...prev, current: 1 }));
    // Fetch with today's date directly (don't rely on stale state in closure)
    const params: any = {
      page: 0,
      size: pagination.pageSize ?? 10,
      dateFrom: today[0].format("YYYY-MM-DD"),
      dateTo: today[1].format("YYYY-MM-DD"),
    };
    fetchData(1, pagination.pageSize, params);
  };

  const showDetail = (record: RedeemReportEntry) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);

    const verification = (record.other_data as any)?.verification;
    verificationForm.setFieldsValue({
      verificationStatus: verification?.status || "correct",
      adjustedAmount: verification?.adjustedAmount,
      verificationNote: verification?.note,
    });
  };

  const handleVerificationSubmit = async () => {
    if (!selectedRecord || !selectedRecord.id) return;

    try {
      const values = await verificationForm.validateFields();
      setSaving(true);

      const oldAmount = getCurrentInvoiceAmount(selectedRecord);
      const hasAdjustedAmount =
        typeof values.adjustedAmount === "number" && !Number.isNaN(values.adjustedAmount);
      const autoAmountNote = hasAdjustedAmount
        ? `đã sửa số tiền từ ${formatCurrencyValue(oldAmount)} thành ${formatCurrencyValue(values.adjustedAmount)}`
        : undefined;
      const finalVerificationNote = hasAdjustedAmount ? autoAmountNote : values.verificationNote;

      const result = await updateRedeemReport({
        id: selectedRecord.id,
        verificationStatus: values.verificationStatus,
        adjustedAmount: values.adjustedAmount,
        verificationNote: finalVerificationNote,
      });

      if (result.success) {
        const updatedSelectedRecord: RedeemReportEntry = hasAdjustedAmount
          ? {
            ...selectedRecord,
            sale_data: {
              ...selectedRecord.sale_data,
              totalInvoice: values.adjustedAmount,
            },
            other_data: {
              ...(selectedRecord.other_data as any),
              verification: {
                ...((selectedRecord.other_data as any)?.verification ?? {}),
                status: values.verificationStatus,
                adjustedAmount: values.adjustedAmount,
                note: finalVerificationNote,
                verifiedAt: dayjs().toISOString(),
              },
            },
          }
          : {
            ...selectedRecord,
            other_data: {
              ...(selectedRecord.other_data as any),
              verification: {
                ...((selectedRecord.other_data as any)?.verification ?? {}),
                status: values.verificationStatus,
                adjustedAmount: values.adjustedAmount,
                note: finalVerificationNote,
                verifiedAt: dayjs().toISOString(),
              },
            },
          };

        setSelectedRecord(updatedSelectedRecord);
        setData((prev) =>
          prev.map((record) =>
            record.id === selectedRecord.id ? updatedSelectedRecord : record
          )
        );
        verificationForm.setFieldsValue({ verificationNote: finalVerificationNote });
        message.success("Cập nhật thành công");
        setDetailModalVisible(false);
        fetchData(pagination.current, pagination.pageSize);
      } else {
        message.error(`Cập nhật thất bại: ${result.error}`);
      }
    } catch (error) {
      console.error("Error submitting verification:", error);
      message.error("Có lỗi xảy ra khi cập nhật");
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    message.loading({ content: "Đang xuất dữ liệu...", key: "export" });

    try {
      const params: any = {
        schemeIn: projectSchemeIds.length > 0 ? projectSchemeIds : undefined,
      };

      if (dateRange[0] && dateRange[1]) {
        params.dateFrom = dateRange[0].format("YYYY-MM-DD");
        params.dateTo = dateRange[1].format("YYYY-MM-DD");
      }

      if (phoneNumber.trim()) {
        params.phoneNumber = phoneNumber.trim();
      }

      if (customerName.trim()) {
        params.customerName = customerName.trim();
      }

      let allData = await listAllCustomerReports(params);

      // Client-side filter by scheme
      if (schemeFilter) {
        allData = allData.filter((r) => r.scheme === schemeFilter);
      }

      if (allData.length === 0) {
        message.warning({ content: "Không có dữ liệu để xuất", key: "export" });
        return;
      }

      const excelData = allData.map((record, index) => {
        const gifts = record.gift_data?.gifts || {};

        const giftColumns: Record<string, number> = {};
        giftConfig.forEach((gift) => {
          giftColumns[gift.name] = gifts[gift.id] || 0;
        });

        const invoiceImages = record.sale_data?.invoiceImageUrls || [];
        const giftImage = record.gift_data?.giftReceiveImageUrl || "";
        const invoiceImageUrls = invoiceImages.join("; ");

        const verification = (record.other_data as any)?.verification;
        const verificationStatus = verification ?
          (verification.status === "correct" ? "Dữ liệu đúng" : "Dữ liệu sai") :
          "Chưa kiểm tra";

        // Map scheme ID to name
        const schemeName = projectConfig?.schemes.find((s) => s.id === record.scheme)?.name ?? record.scheme ?? "";

        return {
          "STT": index + 1,
          "Ngày tạo": record.created_at
            ? dayjs(record.created_at).format("DD/MM/YYYY HH:mm")
            : "",
          "Chương trình": schemeName,
          "Tên khách hàng": record.customer_name || "",
          "Số điện thoại": record.phone_number || "",
          "Tổng hóa đơn (VNĐ)": getCurrentInvoiceAmount(record),
          "Số hóa đơn": record.bill_number || "",
          ...giftColumns,
          "Trạng thái kiểm tra": verificationStatus,
          "Số tiền điều chỉnh (VNĐ)": verification?.adjustedAmount || "",
          "Ghi chú kiểm tra": verification?.note || "",
          "Thời gian kiểm tra": verification?.verifiedAt ?
            dayjs(verification.verifiedAt).format("DD/MM/YYYY HH:mm") : "",
          "Link ảnh hóa đơn": invoiceImageUrls,
          "Link ảnh khách nhận quà": giftImage,
          "Điểm làm việc": record.location_name || "",
          "Mã điểm": record.location_code || "",
          "Ca làm việc": record.workshift_name || "",
          "Mã ca": record.workshift_id || "",
          "Người tạo": record.created_by || "",
        };
      });

      if (isInIframe) {
        const columnDefinitions = [
          { key: "STT", label: "STT", type: "number" as const, align: "center" as const, width: 50 },
          { key: "Ngày tạo", label: "Ngày tạo", type: "text" as const, align: "left" as const, width: 140 },
          { key: "Chương trình", label: "Chương trình", type: "text" as const, align: "left" as const, width: 200 },
          { key: "Tên khách hàng", label: "Tên khách hàng", type: "text" as const, align: "left" as const, width: 200 },
          { key: "Số điện thoại", label: "Số điện thoại", type: "text" as const, align: "left" as const, width: 120 },
          { key: "Tổng hóa đơn (VNĐ)", label: "Tổng hóa đơn (VNĐ)", type: "number" as const, align: "right" as const, width: 140 },
          { key: "Số hóa đơn", label: "Số hóa đơn", type: "text" as const, align: "left" as const, width: 120 },
          ...giftConfig.map((gift) => ({
            key: gift.name,
            label: gift.name,
            type: "number" as const,
            align: "center" as const,
            width: 160,
          })),
          { key: "Trạng thái kiểm tra", label: "Trạng thái kiểm tra", type: "text" as const, align: "center" as const, width: 120 },
          { key: "Số tiền điều chỉnh (VNĐ)", label: "Số tiền điều chỉnh (VNĐ)", type: "number" as const, align: "right" as const, width: 150 },
          { key: "Ghi chú kiểm tra", label: "Ghi chú kiểm tra", type: "text" as const, align: "left" as const, width: 250 },
          { key: "Thời gian kiểm tra", label: "Thời gian kiểm tra", type: "text" as const, align: "left" as const, width: 140 },
          { key: "Link ảnh hóa đơn", label: "Link ảnh hóa đơn", type: "text" as const, align: "left" as const, width: 400 },
          { key: "Link ảnh khách nhận quà", label: "Link ảnh khách nhận quà", type: "text" as const, align: "left" as const, width: 400 },
          { key: "Điểm làm việc", label: "Điểm làm việc", type: "text" as const, align: "left" as const, width: 200 },
          { key: "Mã điểm", label: "Mã điểm", type: "text" as const, align: "left" as const, width: 100 },
          { key: "Ca làm việc", label: "Ca làm việc", type: "text" as const, align: "left" as const, width: 160 },
          { key: "Mã ca", label: "Mã ca", type: "text" as const, align: "center" as const, width: 80 },
          { key: "Người tạo", label: "Người tạo", type: "text" as const, align: "left" as const, width: 200 },
        ];

        window.parent.postMessage(
          {
            type: "EXPORT_DATA",
            payload: {
              columnDefinitions,
              data: excelData,
              filename: `DanhSachKhachHang_${displayName}_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`,
              sheetName: "Danh sách khách hàng",
              title: `BÁO CÁO DANH SÁCH KHÁCH HÀNG - ${displayName}`,
              totalRecords: allData.length,
            },
          },
          "*"
        );
      } else {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "FMS Report System";
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet("Danh sách khách hàng");

        const columns = [
          { header: "STT", key: "STT", width: 7 },
          { header: "Ngày tạo", key: "Ngày tạo", width: 18 },
          { header: "Chương trình", key: "Chương trình", width: 28 },
          { header: "Tên khách hàng", key: "Tên khách hàng", width: 28 },
          { header: "Số điện thoại", key: "Số điện thoại", width: 16 },
          { header: "Tổng hóa đơn (VNĐ)", key: "Tổng hóa đơn (VNĐ)", width: 18 },
          { header: "Số hóa đơn", key: "Số hóa đơn", width: 16 },
          ...giftConfig.map((gift) => ({
            header: gift.name,
            key: gift.name,
            width: 20,
          })),
          { header: "Trạng thái kiểm tra", key: "Trạng thái kiểm tra", width: 18 },
          { header: "Số tiền điều chỉnh (VNĐ)", key: "Số tiền điều chỉnh (VNĐ)", width: 20 },
          { header: "Ghi chú kiểm tra", key: "Ghi chú kiểm tra", width: 35 },
          { header: "Thời gian kiểm tra", key: "Thời gian kiểm tra", width: 18 },
          { header: "Link ảnh hóa đơn", key: "Link ảnh hóa đơn", width: 60 },
          { header: "Link ảnh khách nhận quà", key: "Link ảnh khách nhận quà", width: 60 },
          { header: "Điểm làm việc", key: "Điểm làm việc", width: 28 },
          { header: "Mã điểm", key: "Mã điểm", width: 15 },
          { header: "Ca làm việc", key: "Ca làm việc", width: 22 },
          { header: "Mã ca", key: "Mã ca", width: 12 },
          { header: "Người tạo", key: "Người tạo", width: 28 },
        ];

        worksheet.columns = columns;

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4472C4" },
        };
        headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        headerRow.height = 30;
        headerRow.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        excelData.forEach((row) => {
          const addedRow = worksheet.addRow(row);

          addedRow.alignment = { vertical: "middle", wrapText: true };
          addedRow.border = {
            top: { style: "thin", color: { argb: "FFD0D0D0" } },
            left: { style: "thin", color: { argb: "FFD0D0D0" } },
            bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
            right: { style: "thin", color: { argb: "FFD0D0D0" } },
          };

          addedRow.getCell("STT").alignment = { horizontal: "center", vertical: "middle" };
          addedRow.getCell("Tổng hóa đơn (VNĐ)").alignment = { horizontal: "right", vertical: "middle" };

          giftConfig.forEach((gift) => {
            addedRow.getCell(gift.name).alignment = { horizontal: "center", vertical: "middle" };
          });

          addedRow.getCell("Trạng thái kiểm tra").alignment = { horizontal: "center", vertical: "middle" };
          addedRow.getCell("Số tiền điều chỉnh (VNĐ)").alignment = { horizontal: "right", vertical: "middle" };

          if (addedRow.number % 2 === 0) {
            addedRow.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8F9FA" },
            };
          }
        });

        worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: columns.length },
        };

        worksheet.views = [{ state: "frozen", ySplit: 1 }];

        const timestamp = dayjs().format("YYYYMMDD_HHmmss");
        const filename = `DanhSachKhachHang_${projectConfig?.slug ?? "260006"}_${timestamp}.xlsx`;

        workbook.xlsx.writeBuffer().then((buffer) => {
          const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.click();
          window.URL.revokeObjectURL(url);

          message.success({
            content: `Xuất thành công ${allData.length} bản ghi`,
            key: "export",
          });
        });
      }
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      message.error({
        content: "Có lỗi xảy ra khi xuất dữ liệu",
        key: "export",
      });
    } finally {
      setExporting(false);
    }
  };

  /**
   * Table columns
   */
  const columns: ColumnsType<RedeemReportEntry> = [
    {
      title: "STT",
      key: "index",
      width: 60,
      align: "center",
      fixed: "left",
      render: (_text, _record, index) => {
        return (pagination.current! - 1) * pagination.pageSize! + index + 1;
      },
    },
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (text) => {
        if (!text) return "-";
        return dayjs(text).format("DD/MM/YYYY HH:mm");
      },
    },
    // Show scheme column when project has multiple schemes
    ...(projectConfig?.hasSchemeSelector ? [{
      title: "Chương trình",
      dataIndex: "scheme",
      key: "scheme",
      width: 180,
      render: (text: string) => {
        const scheme = projectConfig?.schemes.find((s) => s.id === text);
        return scheme?.name ?? text ?? "-";
      },
    }] : []),
    {
      title: "Khách hàng",
      key: "customer",
      width: 200,
      render: (_text, record) => (
        <div>
          <div className="font-medium">{record.customer_name}</div>
          <div className="text-xs text-gray-500">{record.phone_number}</div>
        </div>
      ),
    },
    {
      title: "Tổng hóa đơn",
      key: "totalInvoice",
      width: 120,
      align: "right",
      render: (_text, record) => {
        const total = getCurrentInvoiceAmount(record);
        return (
          <span className="font-medium">
            {total.toLocaleString("vi-VN")} ₫
          </span>
        );
      },
    },
    {
      title: "Quà tặng",
      key: "gifts",
      width: 100,
      align: "center",
      render: (_text, record) => {
        const gifts = record.gift_data?.gifts || {};
        const totalGifts = Object.values(gifts).reduce((sum, qty) => sum + (qty as number), 0);
        return <Tag color="green">{totalGifts} món</Tag>;
      },
    },
    {
      title: "Trạng thái",
      key: "verificationStatus",
      width: 120,
      align: "center",
      render: (_text, record) => {
        const verification = (record.other_data as any)?.verification;
        const hasVerification = !!verification;

        if (!hasVerification) {
          return <Tag color="orange">Chưa kiểm tra</Tag>;
        }

        const isCorrect = verification.status === "correct";
        return (
          <Tag color={isCorrect ? "green" : "red"}>
            {isCorrect ? "Dữ liệu đúng" : "Dữ liệu sai"}
          </Tag>
        );
      },
    },
    {
      title: "Hình ảnh",
      key: "images",
      width: 150,
      render: (_text, record) => {
        const invoiceImages = record.sale_data?.invoiceImageUrls || [];
        const giftImage = record.gift_data?.giftReceiveImageUrl;

        const allImages = [...invoiceImages];
        if (giftImage) {
          allImages.push(giftImage);
        }

        if (allImages.length === 0) {
          return <span className="text-gray-400 text-xs">Không có</span>;
        }

        return (
          <Image.PreviewGroup>
            <div className="flex gap-1 flex-wrap">
              {allImages.slice(0, 3).map((url, index) => (
                <Image
                  key={index}
                  src={url}
                  alt={`Image ${index + 1}`}
                  width={40}
                  height={40}
                  style={{ objectFit: "cover", borderRadius: "4px" }}
                />
              ))}
              {allImages.length > 3 && (
                <div className="w-10 h-10 bg-gray-100 flex items-center justify-center text-xs text-gray-600 rounded">
                  +{allImages.length - 3}
                </div>
              )}
            </div>
          </Image.PreviewGroup>
        );
      },
    },
    {
      title: "Điểm làm việc",
      dataIndex: "location_name",
      key: "location_name",
      width: 180,
      ellipsis: true,
    },
    {
      title: "Ca làm việc",
      dataIndex: "workshift_name",
      key: "workshift_name",
      width: 150,
    },
    {
      title: "Người tạo",
      dataIndex: "created_by",
      key: "created_by",
      width: 150,
      ellipsis: true,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 100,
      align: "center",
      fixed: "right",
      render: (_text, record) => (
        <Button
          type="link"
          onClick={() => showDetail(record)}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div className="h-full">
      <Card>
        {/* Title */}
        <div className="mb-4">
          <Title level={4}>{displayName}</Title>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Text strong>Khoảng thời gian:</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
                format="DD/MM/YYYY"
                placeholder={["Từ ngày", "Đến ngày"]}
                className="w-full mt-1"
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Text strong>Số điện thoại:</Text>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Nhập số điện thoại"
                onPressEnter={handleSearch}
                className="mt-1"
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Text strong>Tên khách hàng:</Text>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nhập tên khách hàng"
                onPressEnter={handleSearch}
                className="mt-1"
              />
            </Col>
            {/* Scheme filter - only show for multi-scheme projects */}
            {schemeOptions.length > 1 && (
              <Col xs={24} sm={12} md={8} lg={6}>
                <Text strong>Chương trình:</Text>
                <Select
                  value={schemeFilter}
                  onChange={setSchemeFilter}
                  allowClear
                  placeholder="Tất cả chương trình"
                  className="w-full mt-1"
                  options={schemeOptions}
                />
              </Col>
            )}
            <Col xs={24} sm={12} md={8} lg={6}>
              <div className="flex items-end h-full">
                <Space className="mt-1">
                  <Button
                    type="primary"
                    onClick={handleSearch}
                  >
                    Tìm kiếm
                  </Button>
                  <Button onClick={handleReset}>
                    Làm mới
                  </Button>
                  <Button
                    type="default"
                    onClick={handleExportExcel}
                    loading={exporting}
                    disabled={total === 0}
                  >
                    Xuất Excel
                  </Button>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <Divider />

        {/* Summary */}
        <div className="mb-4">
          <Text type="secondary">
            Tổng số bản ghi: <Text strong>{total}</Text>
          </Text>
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 1600 }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Chi tiết khách hàng"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saving}
            onClick={handleVerificationSubmit}
          >
            Lưu kết quả
          </Button>,
        ]}
        width={1200}
        height={700}
        style={{ top: 20 }}
      >
        {selectedRecord && (
          <div className="flex gap-4" style={{ height: '70vh' }}>
            {/* Left Column - Scrollable Info */}
            <div
              className="flex-1 overflow-y-auto"
              style={{
                minWidth: '500px',
                maxHeight: '80vh',
                paddingRight: '8px'
              }}
            >
              {/* Customer Info */}
              <Card title="Thông tin khách hàng" size="small" className="mb-3">
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="Họ tên">
                    {selectedRecord.customer_name}
                  </Descriptions.Item>
                  <Descriptions.Item label="Số điện thoại">
                    {selectedRecord.phone_number}
                  </Descriptions.Item>
                  {selectedRecord.scheme && (
                    <Descriptions.Item label="Chương trình" span={2}>
                      <Tag color="blue">
                        {projectConfig?.schemes.find((s) => s.id === selectedRecord.scheme)?.name ?? selectedRecord.scheme}
                      </Tag>
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="Tổng hóa đơn">
                    <Text strong className="text-green-600">
                      {getCurrentInvoiceAmount(selectedRecord).toLocaleString("vi-VN")} ₫
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Số hóa đơn">
                    {selectedRecord.bill_number || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Điểm làm việc" span={2}>
                    {selectedRecord.location_name} ({selectedRecord.location_code})
                  </Descriptions.Item>
                  <Descriptions.Item label="Ca làm việc">
                    {selectedRecord.workshift_name} ({selectedRecord.workshift_id})
                  </Descriptions.Item>
                  <Descriptions.Item label="Người tạo">
                    {selectedRecord.created_by}
                  </Descriptions.Item>
                  <Descriptions.Item label="Thời gian" span={2}>
                    {selectedRecord.created_at
                      ? dayjs(selectedRecord.created_at).format("DD/MM/YYYY HH:mm:ss")
                      : "-"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* Gifts */}
              {selectedRecord.gift_data && (
                <Card title="Quà tặng" size="small" className="mb-3">
                  <Table
                    size="small"
                    dataSource={Object.entries(selectedRecord.gift_data.gifts || {})
                      .filter(([_, quantity]) => (quantity as number) > 0)
                      .map(([giftId, quantity]) => ({
                        giftId,
                        quantity,
                        name: giftConfig.find((g) => g.id === giftId)?.name || giftId,
                      }))}
                    columns={[
                      {
                        title: "Tên quà tặng",
                        dataIndex: "name",
                        key: "name",
                      },
                      {
                        title: "Số lượng",
                        dataIndex: "quantity",
                        key: "quantity",
                        width: 100,
                        align: "center",
                        render: (qty) => <Tag color="green">{qty}</Tag>,
                      },
                    ]}
                    pagination={false}
                    rowKey="giftId"
                  />
                </Card>
              )}

              {/* Verification Form */}
              <Card title="Kiểm tra dữ liệu" size="small">
                <Form
                  form={verificationForm}
                  layout="vertical"
                  size="small"
                  onValuesChange={(changedValues, allValues) => {
                    if (
                      Object.prototype.hasOwnProperty.call(changedValues, "adjustedAmount") &&
                      selectedRecord
                    ) {
                      const adjustedAmount = allValues.adjustedAmount;
                      if (typeof adjustedAmount === "number" && !Number.isNaN(adjustedAmount)) {
                        const oldAmount = getCurrentInvoiceAmount(selectedRecord);
                        verificationForm.setFieldsValue({
                          verificationNote: `đã sửa số tiền từ ${formatCurrencyValue(oldAmount)} thành ${formatCurrencyValue(adjustedAmount)}`,
                        });
                      }
                    }
                  }}
                  initialValues={{
                    verificationStatus: "correct",
                  }}
                >
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        label="Kết quả kiểm tra"
                        name="verificationStatus"
                        rules={[{ required: true, message: "Vui lòng chọn kết quả" }]}
                        style={{ marginBottom: '12px' }}
                      >
                        <Select size="small">
                          <Select.Option value="correct">Dữ liệu đúng</Select.Option>
                          <Select.Option value="incorrect">Dữ liệu sai</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="Số tiền điều chỉnh (VNĐ)"
                        name="adjustedAmount"
                        tooltip="Chỉ điền nếu cần điều chỉnh số tiền hóa đơn"
                        style={{ marginBottom: '12px' }}
                      >
                        <InputNumber
                          className="w-full"
                          size="small"
                          min={0}
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => (value ? Number(value.replace(/\$\s?|(,*)/g, '')) : 0) as any}
                          placeholder="Nhập số tiền"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label="Ghi chú"
                    name="verificationNote"
                    tooltip="Ghi chú lý do điều chỉnh hoặc thông tin bổ sung"
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea
                      size="small"
                      rows={3}
                      placeholder="Nhập ghi chú..."
                    />
                  </Form.Item>
                </Form>
              </Card>
            </div>

            {/* Right Column - Scrollable Images */}
            <div
              className="flex-1 overflow-y-auto"
              style={{
                minWidth: '400px',
                maxHeight: '80vh',
                paddingRight: '8px'
              }}
            >
              {/* Invoice Images */}
              {selectedRecord.sale_data?.invoiceImageUrls &&
                selectedRecord.sale_data.invoiceImageUrls.length > 0 && (
                  <Card title="Hình ảnh hóa đơn" size="small" className="mb-3">
                    <Image.PreviewGroup>
                      <Space orientation="vertical" size="middle" className="w-full">
                        {selectedRecord.sale_data.invoiceImageUrls.map((url, index) => (
                          <Image
                            key={index}
                            src={url}
                            alt={`Hóa đơn ${index + 1}`}
                            width="100%"
                            style={{ objectFit: "contain", borderRadius: "4px" }}
                          />
                        ))}
                      </Space>
                    </Image.PreviewGroup>
                  </Card>
                )}

              {/* Gift Receive Image */}
              {selectedRecord.gift_data?.giftReceiveImageUrl && (
                <Card title="Hình khách nhận quà" size="small">
                  <Image
                    src={selectedRecord.gift_data.giftReceiveImageUrl}
                    alt="Khách nhận quà"
                    width="100%"
                    style={{ borderRadius: "4px" }}
                  />
                </Card>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
