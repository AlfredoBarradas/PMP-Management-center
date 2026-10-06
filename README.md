# PMP Management Center

## Project Description

**PMP Management Center** is a web application designed to centralize, organize, and control the main processes and engineering documentation associated with the PMP (Plastic and Metal Parts) area.

The application is intended to provide a single point of access for engineering information, document management, process indicators, production-related information, and approval workflows.

The initial development focuses on building the user interface and establishing a clean, scalable project structure. The first version will use plain HTML, CSS, and JavaScript to make the fundamentals of web development explicit and easy to maintain.

## Main Objectives

- Centralize PMP engineering information.
- Organize engineering documents by type and process.
- Establish controlled document creation, validation, approval, and release workflows.
- Provide a common interface for different engineering and production-related modules.
- Display relevant process and business KPIs.
- Prepare the application for future user roles and permissions.
- Prepare the architecture for future integration with document storage systems such as Google Drive.
- Provide a foundation for future integration with existing company applications.

## Planned Modules

### Dashboard

General overview of the PMP process, including:

- Process KPIs.
- Engineering document status.
- Pending validations.
- Pending approvals.
- Pending releases.
- General process indicators.

### Documents

Centralized engineering document management.

Initial document categories:

- SOP
- Layout
- MDR
- TI
- Substitutes
- Flow Chart
- PFMEA

Additional document types may be added as the system evolves.

### SOP Management

The SOP module will initially include:

- Create
- Search
- Catalog
- Released documents
- Document history

The long-term workflow is expected to follow:

```text
Creation
   ↓
Validation
   ↓
Approval
   ↓
Release
   ↓
Released / Active
```

Each controlled document will eventually receive a unique identification code and maintain relevant metadata such as version, status, responsible person, dates, and document location.

### Other Planned Modules

- Losstime
- Efficiency
- Scrap
- Hour by Hour
- New Models
- Production Release

These modules will be developed progressively after the document management foundation is established.

## User Roles

The application is expected to support different roles and permissions.

Initial role concept:

- Admin
- Engineer
  - Creator
  - Validator
  - Approver
- QM Engineer
- QM Inspector
- Supervisor
- Extra / Standard User

Permissions will be implemented at the application and backend levels. The interface alone will not be considered a security boundary.

## Interface

The application will use a persistent global sidebar containing the main modules and account/configuration options.

The main content area will change according to the current section.

Initial navigation concept:

```text
PMP Management Center
│
├── Dashboard
├── Documents
│   ├── SOP
│   ├── Layout
│   ├── MDR
│   ├── TI
│   ├── Substitutes
│   ├── Flow Chart
│   └── PFMEA
├── Losstime
├── Efficiency
├── Scrap
├── Hour by Hour
├── New Models
├── Production Release
│
├── Settings
└── Account
```

The initial interface will be developed with a simple and clean visual style. Advanced animations and visual effects will be added only after the underlying structure is stable.

## Languages

The initial interface will be developed in **English**.

The application is planned to support multiple languages in the future:

- English
- Spanish
- Chinese

A language selector will be available in the upper-right area of the interface.

## Initial Technology Stack

The first development stage will intentionally use:

- HTML
- CSS
- JavaScript

No frontend framework is required for the initial prototype.

The architecture will remain open to future migration or expansion into a framework and backend architecture if the project requirements justify it.

## Initial Project Structure

```text
pmp-management-center/
│
├── index.html
│
├── css/
│   └── style.css
│
├── js/
│   ├── app.js
│   └── sidebar.js
│
├── documents/
│   ├── index.html
│   └── sop/
│       └── index.html
│
├── settings/
│   └── index.html
│
└── account/
    └── index.html
```

This structure will evolve as functionality is added.

## Document Management Concept

A document will eventually be treated as more than a physical file.

Conceptually:

```text
Document
│
├── Unique Code
├── Document Type
├── Name
├── Model / Product
├── Process
├── Responsible Person
├── Version
├── Status
├── Creation Date
├── Validation Date
├── Approval Date
├── Release Date
│
└── File Location
      └── Google Drive URL
```

This separation will allow the system to manage document metadata and workflow independently from the physical file.

## Future Integration

One of the planned capabilities is integration with the existing company application that consumes publicly accessible Google Drive URLs for SOP-related content.

The long-term architecture may allow PMP Management Center to become the central source of document information while existing applications consume the required document data or URLs.

Possible future architecture:

```text
                 PMP Management Center
                         │
             ┌───────────┴───────────┐
             │                       │
          Database              Google Drive
             │                       │
             └───────────┬───────────┘
                         │
                         ▼
              Existing Company Apps
```

The exact integration method will be evaluated after the existing application's architecture and data sources are understood.

## Deployment

The initial deployment target is **Vercel**.

A custom domain may be added later through an external domain provider.

The application should therefore be developed with deployment portability in mind.

## Development Approach

Development will be incremental:

1. Define the application structure.
2. Build the initial HTML interface.
3. Create the global CSS.
4. Create reusable navigation components.
5. Build the Dashboard.
6. Build the Documents section.
7. Build SOP management.
8. Define document metadata and workflow.
9. Introduce authentication and role-based permissions.
10. Add backend and database functionality.
11. Integrate document storage.
12. Integrate existing company applications where appropriate.
13. Expand the remaining operational modules.

## Current Development Stage

**Stage 1 - Interface Foundation**

Current focus:

- HTML structure
- Global sidebar
- Header
- Dashboard
- Basic navigation
- Basic CSS
- Initial JavaScript structure

Backend, authentication, database, document workflows, and integrations are intentionally out of scope for the first interface prototype.
