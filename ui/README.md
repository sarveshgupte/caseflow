# Caseflow UI

Professional Neomorphic Web UI for Caseflow Backend

## 🎨 Design System

This UI implements a professional, enterprise-grade neomorphic design system:
- Soft neomorphic surfaces with subtle light/shadow
- Rounded corners and muted color palette
- Clear depth hierarchy between read-only and editable elements
- Accessible contrast and focus states
- Minimal functional animations

## 🚀 Quick Start

### Prerequisites

- Node.js 14+ and npm/yarn
- Caseflow backend running on http://localhost:3000

### Installation

1. **Navigate to the UI directory**
   ```bash
   cd ui
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` if your backend runs on a different URL:
   ```
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:5173
   ```

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
ui/
├── public/
│   └── index.html           # HTML template
├── src/
│   ├── assets/
│   │   └── styles/          # CSS design system
│   │       ├── tokens.css   # Design tokens (colors, spacing, etc.)
│   │       ├── neomorphic.css  # Neomorphic component styles
│   │       └── global.css   # Global styles and utilities
│   ├── components/
│   │   ├── auth/            # Authentication components
│   │   ├── common/          # Reusable UI components
│   │   ├── dashboard/       # Dashboard-specific components
│   │   ├── case/            # Case-specific components
│   │   ├── worklist/        # Worklist components
│   │   ├── admin/           # Admin components
│   │   └── profile/         # Profile components
│   ├── contexts/
│   │   ├── AuthContext.jsx  # Authentication state
│   │   └── ToastContext.jsx # Notification system
│   ├── hooks/
│   │   ├── useAuth.js       # Authentication hook
│   │   ├── usePermissions.js # Permissions hook
│   │   └── useApi.js        # API call hook
│   ├── pages/
│   │   ├── LoginPage.jsx    # Login screen
│   │   ├── DashboardPage.jsx # Dashboard
│   │   ├── WorklistPage.jsx # My worklist
│   │   ├── CaseDetailPage.jsx # Case view
│   │   ├── CreateCasePage.jsx # Create case
│   │   ├── ProfilePage.jsx  # User profile
│   │   └── AdminPage.jsx    # Admin panel
│   ├── services/
│   │   ├── api.js           # Axios configuration
│   │   ├── authService.js   # Auth API calls
│   │   ├── caseService.js   # Case API calls
│   │   ├── worklistService.js # Worklist API calls
│   │   └── adminService.js  # Admin API calls
│   ├── utils/
│   │   ├── formatters.js    # Data formatting utilities
│   │   ├── validators.js    # Form validation
│   │   ├── constants.js     # App constants
│   │   └── permissions.js   # Permission utilities
│   ├── App.jsx              # Root component
│   ├── Router.jsx           # Route configuration
│   └── index.jsx            # Entry point
├── .env.example             # Environment variable template
├── package.json             # Dependencies
├── vite.config.js           # Vite configuration
└── README.md                # This file
```

## 🔑 Features

### Part A — Authentication
- ✅ Login with xID + password
- ✅ First-login forced password change
- ✅ Password expiry handling
- ✅ Protected routes with auth guard
- ✅ xID header injection via Axios interceptor
- ✅ Logout functionality

### Part B — Dashboard
- ✅ My Open Cases count
- ✅ My Pending Cases count
- ✅ Admin pending approvals count
- ✅ Recently accessed cases table
- ✅ Role-aware display

### Part C — Worklists
- ✅ Employee worklist (assigned cases)
- ✅ Status filters (Open/Pending/Closed/Filed)
- ✅ Permission-aware display
- ✅ Click to open case details

### Part D — Case View
- ✅ Read-only case information
- ✅ Client details display
- ✅ Lock status indicator
- ✅ Full audit history
- ✅ Existing comments (read-only)
- ✅ Existing attachments (read-only)
- ✅ Add comment (append-only)
- ✅ Permission-gated actions

### Part E — Case Creation
- ✅ Client selector
- ✅ Category selector
- ✅ Initial description
- ✅ 409 duplicate client warning
- ✅ Force create option
- ✅ Explicit user choice required

### Part F — User Profile
- ✅ View profile information
- ✅ Edit allowed fields (DOB, Phone, Address, PAN, Aadhaar, Email)
- ✅ Immutable fields marked read-only (Name, xID)
- ✅ Password expiry date display

### Part G — Admin Panel
- ✅ Pending approvals overview
- ✅ User management tab (placeholder)
- ✅ Admin-only access control

## 🎨 Neomorphic Design Principles

The UI strictly follows neomorphic design principles:

1. **Soft shadows**: Elements use dual light/dark shadows for depth
2. **Muted colors**: Enterprise-appropriate color palette
3. **Clear hierarchy**: Visual distinction between read-only and editable
4. **Focus states**: Accessible focus rings for keyboard navigation
5. **Restrained animations**: Only functional transitions
6. **Professional appearance**: Internal compliance system aesthetic

## 🔒 Backend Integration

### API Base URL
Configurable via `VITE_API_BASE_URL` environment variable (default: `http://localhost:3000/api`)

### Authentication
- xID stored in localStorage
- xID sent in `x-user-id` header on all requests
- 401 responses trigger automatic logout and redirect

### Permission Handling
- All permissions come from backend responses
- UI respects backend permission checks
- No client-side permission bypassing

### Error Handling
- 401 Unauthorized → Redirect to login
- 403 Forbidden → Show error message
- 409 Conflict → Display duplicate warning
- 500 Server Error → Show user-friendly error

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3000/api` |

## 🚫 Non-Negotiable Rules (Backend Compliance)

The UI strictly enforces:

1. **Immutable Fields**: Cannot edit xID, name, clientId, caseId, audit records
2. **No Audit Mutations**: Audit history is strictly read-only
3. **No Approval Bypass**: All approval flows go through backend
4. **Permission Respect**: UI shows/hides based on backend permissions
5. **Warning Surface**: All backend warnings (e.g., duplicates) are displayed
6. **Append-Only Comments**: Comments cannot be edited or deleted
7. **Append-Only Attachments**: Attachments cannot be removed
8. **No Direct Client Edits**: Client changes only through case workflow

## 🧪 Development

### Tech Stack
- React 18 (with hooks)
- React Router v6
- Axios for API calls
- Vite for bundling
- Pure CSS (no heavy UI frameworks)

### State Management
- React Context for global state (Auth, Toast)
- Local state for component-specific data
- No Redux or heavy state management

### Styling
- CSS Variables for design tokens
- Component-specific CSS files
- Neomorphic utility classes
- No CSS-in-JS libraries

## 🤝 Contributing

This is an internal compliance system. All changes must:
- Respect backend as single source of truth
- Maintain neomorphic design consistency
- Follow permission and immutability rules
- Handle errors gracefully

## 📄 License

ISC
