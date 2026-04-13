"use client";

interface ContentProps {
  children: React.ReactNode;
}

export const Content = (props: ContentProps) => {
  const { children } = props;
  return <>{children}</>;
};
