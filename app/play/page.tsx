import type { Metadata } from "next";
import { Table } from "@/components/game/Table";

export const metadata: Metadata = {
  title: "Table",
};

export default function PlayPage() {
  return <Table />;
}
