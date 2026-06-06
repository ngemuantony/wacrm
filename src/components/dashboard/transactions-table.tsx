"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Transaction {
  id: string;
  amount: number;
  phone_number: string;
  checkout_request_id: string;
  receipt_number: string | null;
  status: string;
  created_at: string;
  contact_id: string | null;
  contacts?: {
    name: string | null;
  } | null;
}

interface TransactionsTableProps {
  transactions: Transaction[];
}

type SortField = "created_at" | "amount" | "status";
type SortOrder = "asc" | "desc";

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  
  const ITEMS_PER_PAGE = 10;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }

  // Filter
  const filtered = transactions.filter((t) => {
    const matchesSearch = 
      t.phone_number.includes(searchTerm) || 
      (t.receipt_number && t.receipt_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.contacts?.name && t.contacts.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    if (sortField === "amount") {
      comparison = a.amount - b.amount;
    } else if (sortField === "status") {
      comparison = a.status.localeCompare(b.status);
    } else {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const exportToCSV = () => {
    if (sorted.length === 0) return;
    const headers = ["Date", "Customer", "Phone", "Receipt", "Amount (KES)", "Status"];
    const rows = sorted.map(tx => [
      format(parseISO(tx.created_at), "yyyy-MM-dd HH:mm"),
      tx.contacts?.name || "Unknown",
      tx.phone_number,
      tx.receipt_number || "",
      tx.amount.toString(),
      tx.status
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(c => `"${c}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `transactions_export_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (sorted.length === 0) return;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // Emerald 500 (Brand Green)
    doc.text("Tuinnov8WaCRM", 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Transactions Report", 14, 32);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), "MMM d, yyyy HH:mm")}`, 14, 38);

    const tableColumn = ["Date", "Customer", "Phone", "Receipt", "Amount", "Status"];
    const tableRows = sorted.map(tx => [
      format(parseISO(tx.created_at), "MMM d, yyyy"),
      tx.contacts?.name || "Unknown",
      tx.phone_number,
      tx.receipt_number || "-",
      `KES ${tx.amount.toLocaleString()}`,
      tx.status.toUpperCase()
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // Green header
    });

    doc.save(`transactions_report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <Card className="p-4 md:p-6 overflow-hidden flex flex-col shadow-sm border border-sidebar-border">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
        <div className="flex gap-2 items-center w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search phone or receipt..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 bg-background"
            />
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          {["all", "completed", "pending", "failed"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>

        <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={sorted.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF} disabled={sorted.length === 0} className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleSort("created_at")} className="flex items-center gap-1 -ml-3">
                  Date <ArrowUpDown className="w-3 h-3" />
                </Button>
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center gap-1 -ml-3">
                  Amount <ArrowUpDown className="w-3 h-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleSort("status")} className="flex items-center gap-1 -ml-3">
                  Status <ArrowUpDown className="w-3 h-3" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(parseISO(tx.created_at), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    {tx.contacts?.name || <span className="text-muted-foreground italic">Unknown</span>}
                  </TableCell>
                  <TableCell>{tx.phone_number}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {tx.receipt_number || "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    KES {tx.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        tx.status === "completed"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                          : tx.status === "failed"
                          ? "border-red-500/30 bg-red-500/10 text-red-600"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-600"
                      }
                    >
                      {tx.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, sorted.length)} of {sorted.length}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
