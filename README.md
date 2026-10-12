# 🏢 Thirumala Group Business Management System

> A comprehensive financial and asset management solution built with modern web technologies

**🌐 Live app:** [https://thirumala-groups.vercel.app](https://thirumala-groups.vercel.app) (deployed by Vercel from the `thirumala` branch)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.1-646CFF.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-2.39-3ECF8E.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Development Workflow](#-development-workflow)
- [Database Architecture](#-database-architecture)
- [Key Components](#-key-components)
- [Deployment](#-deployment)
- [Scripts & Utilities](#-scripts--utilities)
- [Environment Variables](#-environment-variables)
- [Contributing](#-contributing)

---

## 🎯 Overview

The **Thirumala Group Business Management System** is a full-stack web application designed to manage financial transactions, company records, assets, and user operations. The system supports dual-mode operation (Regular and ITR modes) for handling different business scenarios and tax reporting requirements.

### Core Capabilities

- 💰 **Financial Management**: Cash book entries, ledger management, balance sheets
- 🏢 **Company Management**: Multi-company support with hierarchical account structure
- 📊 **Reporting**: Daily reports, detailed ledgers, balance sheets, Excel exports
- 🔐 **User Management**: Role-based access control and authentication
- 🚗 **Asset Management**: Vehicle and driver tracking
- 📄 **Document Management**: Bank guarantees tracking
- ✅ **Approval Workflow**: Record approval and audit trail system

---

## ✨ Features

### Financial Operations
- ✅ Create, edit, and delete cash book entries
- ✅ Dual-mode support (Regular/ITR) for tax compliance
- ✅ Real-time balance calculations
- ✅ Multi-company financial tracking
- ✅ Credit/Debit transaction management
- ✅ Payment mode tracking

### Reporting & Analytics
- 📊 Interactive dashboard with real-time statistics
- 📈 Daily financial reports
- 📋 Detailed ledger views
- 💼 Balance sheet generation
- 📑 Excel export functionality
- 🔍 Advanced search and filtering

### Data Management
- 📤 CSV bulk import/export
- 🔄 Record replacement and editing
- 🗑️ Soft delete with audit trail
- ✅ Approval workflow system
- 📝 Edit history tracking

### User & Access Control
- 👥 User management interface
- 🔐 Secure authentication
- 🛡️ Role-based permissions
- 🔑 Password management
- 📊 User activity tracking

### Asset Tracking
- 🚗 Vehicle management with expiry dates
- 👨‍✈️ Driver license tracking
- 🏦 Bank guarantee management
- ⏰ Automated expiry notifications

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **TypeScript** | 5.5 | Type safety |
| **Vite** | 7.1.3 | Build tool & dev server |
| **React Router** | 6.20.1 | Client-side routing |
| **TanStack Query** | 5.87.1 | Server state management |
| **Tailwind CSS** | 3.4.1 | Utility-first styling |
| **Lucide React** | 0.344.0 | Icon library |
| **React Hot Toast** | 2.4.1 | Toast notifications |
| **date-fns** | 2.30.0 | Date manipulation |
| **XLSX** | 0.18.5 | Excel file handling |
| **jsPDF** | 3.0.1 | PDF generation |

### Backend & Database
| Technology | Version | Purpose |
|------------|---------|---------|
| **Supabase** | 2.39.0 | Backend-as-a-Service (PostgreSQL) |
| **Express.js** | 4.18.2 | Production server |
| **bcryptjs** | 3.0.2 | Password hashing |

### Development Tools
| Technology | Version | Purpose |
|------------|---------|---------|
| **ESLint** | 9.9.1 | Code linting |
| **Prettier** | 3.1.0 | Code formatting |
| **Vitest** | 3.2.4 | Unit testing |
| **Husky** | 8.0.3 | Git hooks |
| **TypeScript ESLint** | 8.3.0 | TypeScript linting |

### DevOps & Deployment
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Vercel** | Frontend hosting |
| **Nginx** | Reverse proxy (production) |
| **GitHub Actions** | CI/CD (if configured) |

---

## 📁 Project Structure

```
thirumala-admin-dashboard/
├── src/
│   ├── app/                    # App router pages (if using)
│   │   └── deleted-records/
│   ├── components/             # Reusable UI components
│   │   ├── Layout/            # Layout components (Header, Sidebar)
│   │   └── UI/                # UI primitives (Button, Input, Card, etc.)
│   ├── contexts/              # React contexts
│   │   ├── AuthContext.tsx    # Authentication state
│   │   └── TableModeContext.tsx # Regular/ITR mode switching
│   ├── hooks/                 # Custom React hooks
│   │   ├── useCashBookData.ts # Cash book data fetching
│   │   ├── useDashboardData.ts # Dashboard statistics
│   │   ├── useDropdownData.ts # Dropdown data management
│   │   └── useEditEntryData.ts # Entry editing logic
│   ├── lib/                   # Core libraries and utilities
│   │   ├── supabase.ts        # Supabase client configuration
│   │   ├── supabaseDatabase.ts # Database operations
│   │   ├── tableNames.ts      # Table name resolution (Regular/ITR)
│   │   ├── queryClient.ts     # React Query configuration
│   │   ├── financialCalculations.ts # Financial calculations
│   │   └── api.ts             # API utilities
│   ├── pages/                 # Page components
│   │   ├── Dashboard.tsx      # Main dashboard
│   │   ├── NewEntry.tsx       # Create new entry
│   │   ├── EditEntry.tsx      # Edit existing entry
│   │   ├── DailyReport.tsx    # Daily financial report
│   │   ├── DetailedLedger.tsx # Detailed ledger view
│   │   ├── LedgerSummary.tsx  # Ledger summary
│   │   ├── BalanceSheet.tsx   # Balance sheet
│   │   ├── ApproveRecords.tsx # Record approval
│   │   ├── EditedRecords.tsx  # Edit history
│   │   ├── DeletedRecords.tsx # Deleted records
│   │   ├── ReplaceForm.tsx    # Replace entry form
│   │   ├── ExportExcel.tsx    # Excel export
│   │   ├── CsvUpload.tsx      # CSV import
│   │   ├── Vehicles.tsx       # Vehicle management
│   │   ├── BankGuarantees.tsx # Bank guarantee tracking
│   │   ├── Drivers.tsx        # Driver management
│   │   ├── UserManagement.tsx # User administration
│   │   └── Login.tsx          # Authentication page
│   ├── utils/                 # Utility functions
│   │   ├── excel.ts           # Excel operations
│   │   ├── print.ts           # Print functionality
│   │   ├── alerts.ts          # Alert utilities
│   │   ├── backup.ts          # Backup operations
│   │   └── errorHandler.ts    # Error handling
│   ├── test/                  # Test setup
│   ├── App.tsx                # Root component
│   ├── main.tsx               # Application entry point
│   └── index.css              # Global styles
├── scripts/                    # Utility scripts
│   ├── setup-database.cjs     # Database initialization
│   ├── import-csv.js          # CSV import utilities
│   ├── clear-database.cjs     # Database cleanup
│   └── ...                    # Various utility scripts
├── supabase/
│   └── migrations/            # Database migrations
├── public/                    # Static assets
├── dist/                      # Production build output
├── node_modules/              # Dependencies
├── .env                       # Environment variables (not in repo)
├── .env.example               # Environment template
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── Dockerfile                 # Docker configuration
├── docker-compose.yml         # Docker Compose setup
├── vercel.json                # Vercel deployment config
├── nginx.conf                 # Nginx configuration
└── server.js                  # Express production server
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **Supabase Account** (for database)
- **Git** (for version control)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd thirumala-admin-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:5173
   ```

### First-Time Setup

1. **Database Setup**: Run database initialization scripts if needed
   ```bash
   node scripts/setup-database.cjs
   ```

2. **Create Admin User**: Use the user management interface or database scripts to create your first admin user

3. **Configure Table Mode**: The system supports Regular and ITR modes. Toggle between them using the mode switcher in the header

---

## 💻 Development Workflow

### Available Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start development server (Vite) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors automatically |
| `npm run type-check` | TypeScript type checking |
| `npm run test` | Run tests with Vitest |
| `npm run test:ui` | Run tests with UI |
| `npm run format` | Format code with Prettier |
| `npm run clean` | Clean build artifacts and cache |
| `npm start` | Start production server (Express) |

### Development Best Practices

1. **Code Style**: Follow ESLint and Prettier configurations
2. **Type Safety**: Always use TypeScript types
3. **Component Structure**: Keep components small and focused
4. **State Management**: Use React Query for server state, React Context for global UI state
5. **Error Handling**: Use error boundaries and toast notifications
6. **Testing**: Write tests for critical business logic

### Code Organization

- **Components**: Reusable UI components in `src/components/`
- **Pages**: Route-level components in `src/pages/`
- **Hooks**: Custom hooks for data fetching and business logic
- **Lib**: Core utilities and database operations
- **Utils**: Helper functions for specific tasks

---

## 🗄️ Database Architecture

### Core Tables

#### Financial Tables
- **`cash_book`** / **`cash_book_itr`**: Main transaction records
- **`edit_cash_book`** / **`edit_cash_book_itr`**: Edit history
- **`original_cash_book`** / **`original_cash_book_itr`**: Original records before edits
- **`deleted_cash_book`** / **`deleted_cash_book_itr`**: Soft-deleted records

#### Company & Account Structure
- **`companies`** / **`companies_itr`**: Company master data
- **`company_main_accounts`** / **`company_main_accounts_itr`**: Main account mapping
- **`company_main_sub_acc`** / **`company_main_sub_acc_itr`**: Sub-account mapping

#### Asset Management
- **`vehicles`**: Vehicle registration and tracking
- **`drivers`**: Driver information and license tracking
- **`bank_guarantees`**: Bank guarantee records

#### User Management
- **`users`**: User accounts and authentication
- **`user_types`**: Role definitions

### Dual-Mode System

The system operates in two modes:

1. **Regular Mode**: Uses standard tables (e.g., `cash_book`)
2. **ITR Mode**: Uses ITR-specific tables (e.g., `cash_book_itr`)

The mode is managed via:
- `TableModeContext`: React context for mode state
- `tableNames.ts`: Utility functions for table name resolution
- LocalStorage: Persists mode selection across sessions

### Key Features

- **Row Level Security (RLS)**: Implemented in Supabase for data access control
- **Audit Trail**: All edits and deletions are tracked
- **Soft Deletes**: Records are marked as deleted, not physically removed
- **Approval Workflow**: Records can be locked and require approval

---

## 🧩 Key Components

### Context Providers

#### `AuthContext`
- Manages user authentication state
- Provides login/logout functionality
- Handles password changes
- Protects routes

#### `TableModeContext`
- Manages Regular/ITR mode switching
- Persists mode to localStorage
- Provides mode to all components

### Custom Hooks

#### `useCashBookData`
- Fetches cash book entries with filtering
- Handles pagination and sorting
- Manages query invalidation

#### `useDashboardData`
- Provides dashboard statistics
- Company balances
- Recent entries
- Dropdown data

#### `useDropdownData`
- Manages dropdown options (companies, accounts, sub-accounts, users)
- Handles mode-specific data fetching
- Provides loading and error states

### Database Layer

#### `supabaseDatabase.ts`
- Centralized database operations
- Type-safe queries
- Error handling
- Mode-aware table selection

#### `tableNames.ts`
- Resolves table names based on current mode
- Supports both React context and standalone usage
- Handles localStorage fallback

---

## 🚢 Deployment

### Vercel Deployment (Recommended)

1. **Connect Repository**: Link your GitHub repository to Vercel
2. **Configure Environment Variables**: Add Supabase credentials in Vercel dashboard
3. **Build Settings**: Vercel auto-detects Vite projects
4. **Deploy**: Push to main branch triggers automatic deployment

### Docker Deployment

1. **Build Image**
   ```bash
   docker build -t thirumala-admin .
   ```

2. **Run Container**
   ```bash
   docker run -p 3000:3000 --env-file .env thirumala-admin
   ```

3. **Docker Compose**
   ```bash
   docker-compose up -d
   ```

### Production Server (Express)

The `server.js` file provides a production-ready Express server with:
- Static file serving
- Security headers (Helmet)
- Compression
- Rate limiting
- CORS configuration
- Health check endpoints

### Environment Configuration

Ensure these environment variables are set in production:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `NODE_ENV=production`
- `PORT` (optional, defaults to 3000)

---

## 🔧 Scripts & Utilities

### Database Scripts

Located in `scripts/` directory:

- **`setup-database.cjs`**: Initialize database schema
- **`import-csv.js`**: Bulk import from CSV files
- **`clear-database.cjs`**: Clean database (use with caution
- **`check-*.js`**: Various validation and checking scripts

### Utility Scripts

- **`test-connection.cjs`**: Test Supabase connection
- **`populate-basic-data.cjs`**: Seed initial data
- **`fix-database.cjs`**: Database repair utilities

---

## 🔐 Environment Variables

### Required Variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Optional Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com)
2. Select your project
3. Navigate to **Settings** > **API**
4. Copy **Project URL** and **anon/public key**

---

## 🤝 Contributing

### Development Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**: Follow code style guidelines

3. **Test Changes**: Run tests and type checking
   ```bash
   npm run test
   npm run type-check
   ```

4. **Commit Changes**: Use conventional commit messages
   ```bash
   git commit -m "feat: add new feature"
   ```

5. **Push and Create PR**: Push to your branch and create a pull request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Follow configured rules
- **Prettier**: Auto-format on save
- **Testing**: Write tests for new features
- **Documentation**: Update README for significant changes

### Commit Message Format

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Build process or auxiliary tool changes

---

## 📝 License

This project is licensed under the MIT License.

---

## 👥 Support

For issues, questions, or contributions, please:
- Open an issue on GitHub
- Contact the development team
- Check existing documentation

---

## 🎉 Acknowledgments

- **Supabase** for the excellent backend platform
- **Vite** for the blazing-fast build tool
- **React Team** for the amazing framework
- **All Contributors** who have helped improve this project

---

**Built with ❤️ by Thirumala Group**

---

*Last Updated: 2025*

