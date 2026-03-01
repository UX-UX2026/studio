# ProcureEase - A Modern Procurement Portal

This project is a comprehensive Procurement Management System built with Next.js, Firebase, and ShadCN UI. It is designed to streamline the entire procurement lifecycle, from initial request to final fulfillment, with a sophisticated role-based access control system.

## Application Overview

This is a multi-user application designed to bring efficiency, transparency, and control to an organization's procurement process. It features a real-time database, robust user authentication, and a flexible, role-based permission system.

---

## Core Features & Functionality

**1. Role-Based Access Control (RBAC):**
The application's functionality is dictated by the user's assigned role. The primary roles include:
*   **Administrator:** Full access to all features, settings, and data.
*   **Requester:** Can create and submit procurement requests.
*   **Manager:** Can approve or reject requests from their department.
*   **Executive:** Higher-level approval authority.
*   **Procurement Officer / Assistant:** Manages the fulfillment process and vendor interactions.

**2. Procurement & Submission:**
*   **Quick Submit:** A centralized page for creating and managing procurement requests.
*   **Recurring Items:** A master list of items (e.g., monthly subscriptions) automatically added to new requests.
*   **Budget vs. Actuals Summary:** Real-time comparison of submitted requests against pre-loaded budget forecasts.
*   **Import/Export:** Ability to import line items from a CSV file.

**3. Approval Workflow:**
*   A multi-stage approval pipeline (e.g., Manager Review -> Executive Approval).
*   Approvers can review line items, see request history, and add comments or queries.
*   The workflow is fully customizable by an administrator on a per-department basis.

**4. Fulfillment Management:**
*   A dedicated dashboard for procurement officers to manage approved requests.
*   Track and update the status of each individual line item (Sourcing, Quoted, Ordered, Completed).
*   Log received quantities and add fulfillment-specific comments.

**5. System Administration & Settings:**
*   **User Management:** Administrators can manage user roles and department assignments.
*   **Department Management:** Create and manage departments and their annual budgets.
*   **Workflow Customization:** A drag-and-drop interface to define approval stages for each department.
*   **Budget Integration:** A tool to import departmental budget forecasts from CSV or Excel.
*   **Audit & Error Logging:** Comprehensive logs to track all user actions and capture client-side errors.

---

## Technical Services & Stack

*   **Frontend Framework:** Next.js with React (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS with ShadCN UI
*   **Database:** Cloud Firestore (NoSQL) for real-time data.
*   **Authentication:** Firebase Authentication (Google & Email/Password).
*   **Hosting:** Configured for **Firebase Hosting** (free tier).

## Enhanced Features

*   **Real-time Data:** The UI updates instantly for all users as data changes in the backend.
*   **Offline Capability:** The app works offline, syncing any changes once a connection is restored.
*   **Dynamic Theming:** Switch between modern Light, Dark, and "Classic" themes.

---

## Database Schema Layout

The Firestore database is structured into several top-level collections.

| Collection Path                             | Description                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `/users/{userId}`                           | Stores public profile information for each user.                          |
| `/departments/{departmentId}`               | Contains all departments, their budgets, and custom workflows.            |
| `/roles/{roleId}`                           | Defines all user roles and their specific permission sets.                |
| `/procurementRequests/{procurementRequestId}` | The core collection for all procurement submissions.                      |
| `/vendors/{vendorId}`                       | A list of all approved vendors and suppliers.                             |
| `/recurringItems/{recurringItemId}`         | The master list of automatically-added recurring procurement items.       |
| `/budgets/{budgetId}`                       | Stores all imported budget line items, linked to a department.            |
| `/auditLogs/{logId}`                        | A complete log of all significant user actions for security and tracking. |
| `/errorLogs/{errorLogId}`                   | A log of all client-side application errors for debugging purposes.       |
| `/app/metadata`                             | A single document for storing global application settings.                |

## Getting Started

To get the application running locally, follow these steps.

### Prerequisites

*   Node.js (v18 or later)
*   An active Firebase project.

### Local Development

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

### Publishing the Application

This application is configured for deployment using **Firebase App Hosting**. App Hosting integrates with GitHub to automatically build and deploy your Next.js application when you push to your repository.

#### Environment Variables for Deployment

**WARNING: Your Firebase configuration is currently hard-coded directly into the application source code (`src/firebase/client.ts`). This is NOT a secure practice for a production application and is only done here for demonstration purposes.**

For a real production deployment, you should store these keys as secrets in your hosting provider and load them as environment variables. Hard-coding keys makes them publicly visible in your code repository and difficult to change.
