"use client";
import React, { Suspense } from "react";
import { QueryClientProvider } from "react-query";
import { ErrorBoundary } from "react-error-boundary";
import { AxiosError } from "axios";
import { NotificationProvider } from "@/kits/components/notification";
import { GlobalContextProvider } from "@/contexts/global.context";
import { Content } from "./content";
import { queryClient } from "@/libs/react-query/react-query";
import moment from "moment";
import "moment/locale/vi";
import { ConfigProvider } from "antd";
import { lightTheme } from "@/config/antd-theme.config";

moment.locale("vi");

interface ProvidersProps {
  children: React.ReactNode;
}

const Providers = (props: ProvidersProps) => {
  const { children } = props;

  return (
    <ConfigProvider theme={{ ...lightTheme } as any}>
    <Suspense>
      <ErrorBoundary
        FallbackComponent={() => <></>}
        onError={(error, errorInfo) => {
          const isApiErr =
            error instanceof AxiosError ||
            (error &&
              typeof error === "object" &&
              (("code" in error && typeof error.code === "string") ||
                ("message" in error && typeof error.message === "string")));
          
          if (isApiErr) {
            console.log("[ErrorBoundary] Ignoring API error - handled by onError callbacks");
            return;
          }
          console.error("[ErrorBoundary] Unhandled error:", error, errorInfo);
        }}
      >
        <QueryClientProvider client={queryClient}>
          <NotificationProvider placement="top-center">
            <GlobalContextProvider>
                <Content>{children}</Content>
            </GlobalContextProvider>
          </NotificationProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </Suspense>
    </ConfigProvider>
  );
};

export default Providers;
