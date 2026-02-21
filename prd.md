# 📄 PRD – Financial Dashboard (Enterprise-Ready)

## 1. 🧭 Product Overview

### 1.1 Nama Produk

Financial Management Dashboard

### 1.2 Tujuan

Membangun sistem dashboard keuangan terintegrasi untuk:

* Mengelola pendapatan & pengeluaran
* Manajemen karyawan & payroll
* Perhitungan BPJS & PPh21
* Pembuatan laporan:

  * Neraca
  * Laba Rugi
  * Arus Kas
  * General Ledger

### 1.3 Target User

* Admin keuangan
* HR / Payroll staff
* Owner / CFO
* Auditor

---

## 2. 🎯 Goals & Success Metrics

### Goals

* Single source of truth untuk data keuangan & payroll
* Otomatis generate laporan akuntansi
* Realtime dashboard

### Success Metrics

* Waktu generate laporan < 3 detik
* Error payroll < 0.1%
* Audit trail lengkap
* Multi entitas (multi company support)

---

## 3. 🧱 Tech Stack

### Core

* **Framework:** Next.js (App Router, Server Actions)
* **UI:** shadcn/ui
* **Database:** MongoDB
* **Auth:** Better Auth

### Pendukung

* TypeScript
* Zod validation
* TanStack Table
* React Hook Form
* Recharts / Tremor (chart)
* Decimal.js (akurasi finansial)

---

## 4. 🏗️ System Architecture

### 4.1 Konsep

Monorepo (single Next.js app):

```
Next.js
 ├── App Router
 ├── Server Actions → Business logic
 ├── MongoDB → Database URL
 ├── Better Auth → Authentication
```

### 4.2 Layering

* Presentation (UI)
* Application (Server Actions)
* Domain (business rules)
* Infrastructure (MongoDB)

---

## 5. 🔐 Role & Permission

### Roles

* Super Admin
* Finance Admin
* HR Admin
* Auditor
* Viewer

### RBAC Scope

Per company (multi tenant ready)

---

## 6. 🧩 Core Modules

---

### 6.1 Company / Multi Tenant

#### Data

* company_id
* name
* NPWP
* address
* timezone
* currency

---

### 6.2 Chart of Accounts (COA)

#### Fitur

* Struktur hirarki akun
* Kategori:

  * Asset
  * Liability
  * Equity
  * Revenue
  * Expense

#### Field

* code
* name
* type
* parent_id

---

### 6.3 Journal Entry (General Ledger)

#### Field

* journal_no
* date
* description
* lines:

  * account_id
  * debit
  * credit

#### Fitur

* Auto balancing
* Posting / unposting
* Audit trail

---

### 6.4 Revenue Management

#### Data

* source
* customer
* invoice_number
* amount
* tax
* payment_method
* status

---

### 6.5 Expense Management

#### Data

* vendor
* category
* amount
* tax
* attachment
* approval workflow

---

### 6.6 Employee Management

#### Data Karyawan

* NIK
* NPWP
* BPJS number
* employment status
* join date
* salary config

---

### 6.7 Payroll System

#### Komponen Gaji

* Basic salary
* Allowance
* Overtime
* Bonus
* Potongan

#### Output

* Slip gaji
* Jurnal otomatis

---

### 6.8 BPJS Calculation

#### BPJS Kesehatan

* Perusahaan
* Karyawan

#### BPJS Ketenagakerjaan

* JHT
* JP
* JKK
* JKM

---

### 6.9 PPh21 Engine

#### Fitur

* TER terbaru
* PTKP status
* Auto hitung pajak bulanan
* Bukti potong

---

## 7. 📊 Financial Reports

### 7.1 Neraca

Rumus:

```
Asset = Liability + Equity
```

### 7.2 Laba Rugi

* Revenue
* COGS
* Operating expense
* Net profit

### 7.3 Cash Flow

* Operating
* Investing
* Financing

---

## 8. 🖥️ Dashboard UI

### Widget

* Total revenue
* Total expense
* Net profit
* Cash position
* Payroll cost
* Tax payable

### Chart

* Monthly profit
* Expense breakdown
* Revenue by source

---

## 9. 🧮 Automation Rules

* Payroll → auto jurnal
* Expense → auto jurnal
* Revenue → auto jurnal
* Tax → auto jurnal

---

## 10. 📂 Database Design (MongoDB Collections)

### Core Collections

#### companies

#### users

#### chart_of_accounts

#### journals

#### journal_lines

#### employees

#### payrolls

#### payroll_items

#### bpjs_configs

#### tax_configs

#### revenues

#### expenses

#### audit_logs

---

## 11. ⚡ Performance Strategy

* Server Components
* Edge caching
* Aggregation pipeline untuk laporan
* Indexing:

  * company_id
  * date
  * account_id

---

## 12. 🔍 Audit & Compliance

* Immutable journal
* Log setiap perubahan
* Soft delete dengan tracking

---

## 13. 🌍 Enterprise Scalability

### Wajib Ada

✅ Multi company
✅ Multi currency
✅ Cost center
✅ Department
✅ Project tracking
✅ Budgeting
✅ Approval workflow
✅ Import/export data
✅ API access

---

## 14. 🔌 Future Integrations

* Bank sync
* e-Faktur
* e-Bupot
* HRIS
* POS / ERP

---

## 15. 🧠 AI-Ready Data

Agar bisa pakai AI ke depan:

* Tagging transaksi otomatis
* Prediksi cash flow
* Anomaly detection

---

## 16. 🗺️ Development Phases

### Phase 1 – Foundation

* Auth
* Company
* COA

### Phase 2 – Transaction

* Revenue
* Expense
* Journal

### Phase 3 – Payroll

* Employee
* Salary
* BPJS
* PPh21

### Phase 4 – Reporting

* Neraca
* Laba rugi
* Dashboard

---

# 📌 Rekomendasi Data Tambahan (Enterprise Grade)

Selain yang kamu sebut, WAJIB tambah:

### Struktur Organisasi

* Department
* Cost center
* Project

### Fixed Asset

* Depresiasi otomatis

### Inventory (kalau ada COGS)

### Budgeting System

### Approval Flow

### Multi cabang / branch