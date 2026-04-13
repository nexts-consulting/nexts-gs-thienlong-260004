"use client";

import { useState, useEffect } from "react";
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

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const giftConfig = [
  {id: "holiday_304_gift", name: "Khăn quàng Cờ Việt Nam & Trải nghiệm tô vẽ nón lá"},
];

export default function AdminCustomerPage() {
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

  // Filter states - default to current date
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    dayjs().startOf("day"),
    dayjs().endOf("day"),
  ]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerName, setCustomerName] = useState("");

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
  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params: any = {
        page: page - 1, // Supabase uses 0-based index
        size: pageSize,
      };

      // Add date range filter
      if (dateRange[0] && dateRange[1]) {
        params.dateFrom = dateRange[0].format("YYYY-MM-DD");
        params.dateTo = dateRange[1].format("YYYY-MM-DD");
      }

      // Add phone filter
      if (phoneNumber.trim()) {
        params.phoneNumber = phoneNumber.trim();
      }

      // Add name filter
      if (customerName.trim()) {
        params.customerName = customerName.trim();
      }

      const response = await listCustomerReports(params);

      setData(response.data);
      setTotal(response.total);
      setPagination((prev) => ({
        ...prev,
        current: page,
        pageSize: pageSize,
        total: response.total,
      }));
    } catch (error) {
      console.error("Error fetching data:", error);
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load data on mount and when filters change
   */
  useEffect(() => {
    fetchData(pagination.current, pagination.pageSize);
  }, []);

  /**
   * Check if running inside iframe and notify parent
   */
  useEffect(() => {
    const inIframe = window.self !== window.top;
    setIsInIframe(inIframe);

    if (inIframe) {
      // Notify parent that child is ready
      window.parent.postMessage(
        {
          type: "CHILD_READY",
          payload: {
            component: "customer-page",
          },
        },
        "*" // In production, use specific origin
      );
    }
  }, []);

  /**
   * Handle table change (pagination, filters, sorter)
   */
  const handleTableChange = (newPagination: TablePaginationConfig) => {
    fetchData(newPagination.current || 1, newPagination.pageSize || 10);
  };

  /**
   * Handle search
   */
  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    fetchData(1, pagination.pageSize);
  };

  /**
   * Handle reset filters
   */
  const handleReset = () => {
    setDateRange([null, null]);
    setPhoneNumber("");
    setCustomerName("");
    setPagination((prev) => ({ ...prev, current: 1 }));
    // Fetch data after reset
    setTimeout(() => {
      fetchData(1, pagination.pageSize);
    }, 100);
  };

  /**
   * Show detail modal
   */
  const showDetail = (record: RedeemReportEntry) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
    
    // Load verification data into form
    const verification = (record.other_data as any)?.verification;
    verificationForm.setFieldsValue({
      verificationStatus: verification?.status || "correct",
      adjustedAmount: verification?.adjustedAmount,
      verificationNote: verification?.note,
    });
  };

  /**
   * Handle verification form submit
   */
  const handleVerificationSubmit = async () => {
    if (!selectedRecord || !selectedRecord.id) return;

    try {
      const values = await verificationForm.validateFields();
      setSaving(true);

      const result = await updateRedeemReport({
        id: selectedRecord.id,
        verificationStatus: values.verificationStatus,
        adjustedAmount: values.adjustedAmount,
        verificationNote: values.verificationNote,
      });

      if (result.success) {
        message.success("Cập nhật thành công");
        setDetailModalVisible(false);
        // Refresh data
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

  /**
   * Export to Excel
   */
  const handleExportExcel = async () => {
    setExporting(true);
    message.loading({ content: "Đang xuất dữ liệu...", key: "export" });

    try {
      // Build filter params (same as table filters)
      const params: any = {};

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

      // Fetch all data without pagination
      const allData = await listAllCustomerReports(params);

      if (allData.length === 0) {
        message.warning({ content: "Không có dữ liệu để xuất", key: "export" });
        return;
      }

      // Transform data for Excel
      const excelData = allData.map((record, index) => {
        // Get gift quantities for each type
        const gifts = record.gift_data?.gifts || {};
        
        // Create object with individual gift columns
        const giftColumns: Record<string, number> = {};
        giftConfig.forEach((gift) => {
          giftColumns[gift.name] = gifts[gift.id] || 0;
        });

        // Get image URLs
        const invoiceImages = record.sale_data?.invoiceImageUrls || [];
        const giftImage = record.gift_data?.giftReceiveImageUrl || "";

        // Join invoice image URLs with semicolon
        const invoiceImageUrls = invoiceImages.join("; ");

        // Get verification data
        const verification = (record.other_data as any)?.verification;
        const verificationStatus = verification ? 
          (verification.status === "correct" ? "Dữ liệu đúng" : "Dữ liệu sai") : 
          "Chưa kiểm tra";

        return {
          "STT": index + 1,
          "Ngày tạo": record.created_at
            ? dayjs(record.created_at).format("DD/MM/YYYY HH:mm")
            : "",
          "Tên khách hàng": record.customer_name || "",
          "Số điện thoại": record.phone_number || "",
          "Tổng hóa đơn (VNĐ)": record.sale_data?.totalInvoice || 0,
          "Số hóa đơn": record.bill_number || "",
          
          // Individual gift columns
          ...giftColumns,
          
          // Verification columns
          "Trạng thái kiểm tra": verificationStatus,
          "Số tiền điều chỉnh (VNĐ)": verification?.adjustedAmount || "",
          "Ghi chú kiểm tra": verification?.note || "",
          "Thời gian kiểm tra": verification?.verifiedAt ? 
            dayjs(verification.verifiedAt).format("DD/MM/YYYY HH:mm") : "",
          
          // Image URLs
          "Link ảnh hóa đơn": invoiceImageUrls,
          "Link ảnh khách nhận quà": giftImage,
          
          // Location and shift info
          "Điểm làm việc": record.location_name || "",
          "Mã điểm": record.location_code || "",
          "Ca làm việc": record.workshift_name || "",
          "Mã ca": record.workshift_id || "",
          "Người tạo": record.created_by || "",
        };
      });

      // If running in iframe, send data to parent instead of downloading
      if (isInIframe) {
        // Build column definitions for consistent styling
        const columnDefinitions = [
          { key: "STT", label: "STT", type: "number" as const, align: "center" as const, width: 50 },
          { key: "Ngày tạo", label: "Ngày tạo", type: "text" as const, align: "left" as const, width: 140 },
          { key: "Tên khách hàng", label: "Tên khách hàng", type: "text" as const, align: "left" as const, width: 200 },
          { key: "Số điện thoại", label: "Số điện thoại", type: "text" as const, align: "left" as const, width: 120 },
          { key: "Tổng hóa đơn (VNĐ)", label: "Tổng hóa đơn (VNĐ)", type: "number" as const, align: "right" as const, width: 140 },
          { key: "Số hóa đơn", label: "Số hóa đơn", type: "text" as const, align: "left" as const, width: 120 },
          
          // Gift columns
          ...giftConfig.map((gift) => ({
            key: gift.name,
            label: gift.name,
            type: "number" as const,
            align: "center" as const,
            width: 160,
          })),
          
          // Verification columns
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
              filename: `DanhSachKhachHang_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`,
              sheetName: "Danh sách khách hàng",
              title: "BÁO CÁO DANH SÁCH KHÁCH HÀNG",
              totalRecords: allData.length,
            },
          },
          "*" // In production, use specific origin
        );
      } else {
        // Create workbook with ExcelJS
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "FMS Report System";
        workbook.created = new Date();
        
        const worksheet = workbook.addWorksheet("Danh sách khách hàng");

        // Define columns with styling
        const columns = [
          { header: "STT", key: "STT", width: 7 },
          { header: "Ngày tạo", key: "Ngày tạo", width: 18 },
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

        // Style header row
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

        // Add data rows
        excelData.forEach((row) => {
          const addedRow = worksheet.addRow(row);
          
          // Style data rows
          addedRow.alignment = { vertical: "middle", wrapText: true };
          addedRow.border = {
            top: { style: "thin", color: { argb: "FFD0D0D0" } },
            left: { style: "thin", color: { argb: "FFD0D0D0" } },
            bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
            right: { style: "thin", color: { argb: "FFD0D0D0" } },
          };

          // Align numbers to right
          addedRow.getCell("STT").alignment = { horizontal: "center", vertical: "middle" };
          addedRow.getCell("Tổng hóa đơn (VNĐ)").alignment = { horizontal: "right", vertical: "middle" };
          
          // Format gift quantity cells
          giftConfig.forEach((gift) => {
            addedRow.getCell(gift.name).alignment = { horizontal: "center", vertical: "middle" };
          });

          // Format verification cells
          addedRow.getCell("Trạng thái kiểm tra").alignment = { horizontal: "center", vertical: "middle" };
          addedRow.getCell("Số tiền điều chỉnh (VNĐ)").alignment = { horizontal: "right", vertical: "middle" };

          // Alternate row colors
          if (addedRow.number % 2 === 0) {
            addedRow.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8F9FA" },
            };
          }
        });

        // Add autofilter
        worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: columns.length },
        };

        // Freeze header row
        worksheet.views = [{ state: "frozen", ySplit: 1 }];

        // Generate filename with timestamp
        const timestamp = dayjs().format("YYYYMMDD_HHmmss");
        const filename = `DanhSachKhachHang_${timestamp}.xlsx`;

        // Save file
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
        const total = record.sale_data?.totalInvoice || 0;
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
        
        // Collect all images
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
                  <Descriptions.Item label="Tổng hóa đơn">
                    <Text strong className="text-green-600">
                      {(selectedRecord.sale_data?.totalInvoice || 0).toLocaleString("vi-VN")} ₫
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
                      <Space direction="vertical" size="middle" className="w-full">
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

