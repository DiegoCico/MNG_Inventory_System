

# Vision and Scope & Software Requirements Specification Document for Inventory Management System
Prepared by Ben Tran, Diego Cicotoste, Gabe Manalang, Lily Bedichek, Reese Cantu, Stephanie Sayegh, Tyler Goldener in Fall 2025


### Table of Contents
1. Introduction
2. Business Requirements
    1. Background
    2. Success Metrics & Stakeholder Values
    3. Vision Statement
3. Scope and Limitations
4. Software Requirement Specification
    1. Project Scope
    2. User Classes and Characteristics
    3. Operating Environment
    4. Design and Implementation Constraints
    5. Assumptions and Dependencies
5. System Functionality – Functional Requirements	
    1. Authentication	
    2. Inventory Item Management	
    3. Item Status/Repair Forms	
    4. Team Management	
    5. Reporting and PDF Export	
    6. Cloud Access	
6. Data Requirements	
    1. Inputs and Outputs
    2. Data Model
        1. Data Model: Image
        2. Classes
        3. Relationships
    3. Reports
    4. Data Acquisition, Integrity, Retention, and Disposal
7. External Interface Requirements
    1. User Interfaces
    2. Software Interfaces
    3. Hardware Interfaces
    4. Communications Interfaces
8. Quality Attributes – Non-Functional Requirements
    1. Usability
    2. Performance
    3. Security
    4. Safety
9. Acceptance Criteria
10. Other Requirements


## Introduction
This document will outline the vision, scope, business requirements, and detailed software specifications for the Inventory Management System being developed for the Massachusetts Army National Guard. This system replaces the existing manual, paper-based process with a more efficient and secure cloud-hosted web application.

**The document outlines**:
- The scope and limitations of the system, clarifying what features are in and out of scope.
- The functional requirements regarding inventory management (including management of the team performing the inventory checks).
- The data model and external interface requirements, including API endpoints and database schema.
- The non-functional requirements, such as usability, performance, and security standards.
- The acceptance criteria that must be met for the system to be considered complete.
- This SRS is intended for all project stakeholders, including developers, testers, project sponsors, and end users. It serves as both a contract of requirements and a reference manual, guiding implementation and ensuring alignment with the National Guard’s operational goals.

## Business Requirements
### Background
The Massachusetts National Guard relies on a wide and complex range of equipment and supplies to support operations across its many bases.  Thus, like any entity, it must periodically check its supply to ensure items are both present and functional.  This process currently includes a tri-annual, multi-day process where teams and technicians manually locate thousands of items and indicate their presence and functionality on comprehensive stacks of paperwork.  The forms are handed to a supply sergeant who continues the inventory process.  Our project intends to assist the teams and technicians who fill out compliant forms.

The form which indicates the presence or absence of an item is known as the Component Listing / Hand Receipt form, and is the main focus of our project.  In the current inventory process, these forms are printed mostly filled out in their nested structure, with only the ‘quantity present’ attribute left to be filled out.  The names of the items are given by the National Stock Number (NSN) database, which lists all item names, photos, and identification numbers in DoD compliant format.

Unfortunately, the pre-filled information on the form given by the NSN data is generally insufficient for identifying exactly which item the form is referring to.  The information a technician would be given to identify an ethernet cable, for example, would be one of approximately thirty NSN entries titled “Cable Assembly, Special Purpose, Electrical”, for which no picture is available.  In fact, photographs printed on the forms are generally black-and-white, simplistic, and incorrectly matched to the item.

Another layer of complexity comes from the nesting of items within forms.  Most items have a parent ‘kit’ to which it belongs, and kits are kept on different inventory forms.  However, items are often not kept in their official kits, so inventory packages must be cross-referenced inside other packages.

When an item is marked as present, but broken, a separate form called the DA 2404 must be filled out to request maintenance. We will include this automation in our inventory logging system to further improve the flow of work for technicians.

These inefficiencies increase the length of taking inventory by a considerable degree.  A digital inventory form management system will replace this outdated process with faster logging. This will free up time for training while providing accurate, reliable records for both technicians and managers.

### Success Metrics & Stakeholder Values
Speed and accuracy of taking inventory
Lack of training required to conduct inventory

#### Primary Stakeholders
- Technicians: responsible for logging items as present or missing. Primarily interested in reducing inefficiency and stress while taking inventory.
- Managers: responsible for adding inventory items, reviewing inventory, and exporting reports. Primarily interested in reducing work for technicians so they can move on to other activities.
- Skip-Managers (supervisors above managers): responsible for creating team structures and assigning permissions. Primarily interested in reducing work for technicians and managers. 
- Supply Managers: responsible for reviewing produced forms and information.  Primarily concerned with accuracy and structure of forms.

#### Success Metrics
- Efficiency: inventory sessions should be completed in significantly less time compared to the current paper-based system.
- Ease of Use: the system should be intuitive, requiring little or no formal training for new users.
- Accuracy & Clarity: standardized names, searchable nicknames, and item photos should make it quick and easy to identify and log inventory items.
- Scalability: the design should support potential future expansion to greater DoD entities.
- Compliance: the system must generate official forms to meet DoD documentation standards.


#### Vision Statement
The vision of this project is to simplify and expedite inventory logging by technicians so they can spend more time training to serve our country. The goal is to provide a secure, easy-to-use solution that enhances efficiency and can be scaled across the National Guard.

## Scope and Limitations

#### Scope
The Inventory Management System will be a web-based application designed for the Massachusetts Army National Guard’s EOD unit, with potential to expand to other units. The system will:
- Allow technicians to log, search, update, and organize inventory items and kits.
- Provide managers and supervisors with tools to create teams, manage members, and review logged items.
- Support the generation of standardized reports in PDF format.
- Operate on a secure, cloud-hosted platform with role-based authentication.
- Be accessible through standard web browsers on desktops, laptops, or tablets.

#### Limitations
The project does not seek to automate or change any part of the inventory process beyond the generation of forms for technicians.
Offline functionality is not supported; users require internet access.
Integration with broader Army databases is out of scope for this version.
Mobile support will be limited to browser-based access; no native mobile app will be included.

## Software Requirement Specification

### Scope
The Inventory Management System is a cloud-hosted web application designed to enhance the inventory process currently used by the specific DoD units. The system will allow technicians to log and update items, managers to review and export official reports, and supervisors to organize teams. It will provide a secure and efficient way to generate standardized inventory records, while remaining scalable for potential use across more units.

### Operating Environment
The Inventory Management System will operate as a cloud-hosted web application deployed on Amazon Web Services (AWS). The application will use AWS Amplify for hosting, AWS Cognito for user authentication and identity management, AWS Lambda for backend functions such as PDF generation, and Amazon S3 for storing images and generated reports. Core application data, including users, teams, items, and item reports, will be stored in Amazon DynamoDB, a NoSQL database that provides scalable and reliable storage.
The system will be accessible through standard web browser (including Chrome, Edge, Firefox, and Safari) on desktops, laptops, and tablets. Communication between clients and the application will occur over secure HTTPS connections, with JWT tokens managing authentication sessions. Since the system relies on cloud services, a stable internet connection is required, and offline functionality is not supported.
This environment enables the system to remain cost-effective for smaller use, while also allowing for scalability to larger deployments if required. By leveraging AWS services, the application benefits from built-in scalability, security, and reliability while keeping operating costs low during periods of inactivity.

### Design and Implementation Constraints
The system must be deployed using AWS infrastructure and is limited to DynamoDB as the primary database, rather than alternative solutions. Authentication and access control are constrained to AWS Cognito to ensure secure identity management, and all PDF reports must be generated using the ReportLab library. Since the application relies on cloud services, a stable internet connection is necessary at all times, and offline functionality is not supported. The design also limits the system to fewer than ten active users per month, although it may be scaled in the future. In addition, all development must comply with Army IT security and compliance standards, which impose restrictions on both implementation choices and data handling practices.

### Assumptions and Dependencies
This project assumes that AWS services such as Amplify, Cognito, S3, DynamoDB, and Lambda will remain available at their current cost structure and service level. The system relies on a stable internet connection for all users, as offline functionality is not currently included in the design. It is also assumed that technicians and managers will have access to modern web browsers and devices capable of running the application without additional software installations.
The project relies on the continued support of third-party libraries, such as ReportLab, for PDF generation. If these components are deprecated or experience compatibility issues, system functionality could be affected. Another dependency is compliance with Army IT security standards and policies; any changes to those policies (specifically, a notice that our project must conform to specified security measures), may require modifications to authentication, data handling, or hosting configurations. 

## System Functionality – Functional Requirements

#### Figure 1 - Level 1 Data Flow Diagram

The Inventory Management System will provide the following core features:

### Authentication

#### Description
The system must allow authorized users to log in securely using AWS Cognito. Administrators will manage permissions by ‘toggling’ abilities for profiles or ranks. Users will be assigned roles (Technician, Manager, Skip-Manager) that determine their default permissions. Authentication sessions will be managed using JWT tokens, and access to all API endpoints will be restricted based on role.

#### User Story
- As a technician, I would like to be able to log into the web application using proper authentication. 

### Inventory Item Management

#### Description
Technicians will be able to create, view, update, and delete inventory items. Each item will include fields such as name, nickname, category, status, and optional photos. Nested kits must be supported, allowing items to be grouped within other items. Items can be searched, and nicknames may be created to improve search efficiency. Technicians must also be able to update item profiles and review past logs during inventory checks.

#### User Story
- As a Skip-manager, I would like to be able to add items to the inventory system. 

### Item Status/Repair Forms
#### Description
Technicians must be able to change the status of an item after it has been logged, including marking items as broken or absent. When necessary, the system must allow manual completion of forms for items requiring maintenance.

#### User Story
- As a technician, I would like to be able to manually fill out an inventory should an inventory item need repair.	
- As a technician, I would like to be able to change my mind about the status of an inventory item after logging it,

### Team Management

#### Description
Managers and Skip-Managers will be able to create and delete teams, as well as add or remove members. Skip-Managers have higher-level authority and can oversee multiple teams. Managers will also have the ability to create new inventory item types (simple or nested) and delete items or kits as needed.

#### User Story
- As Skip-Manager, I would like to be able to create a new team.
- As Skip-Manager, I would like to be able to add and remove people from existing teams.
- As Skip-Manager, I would like to be able to delete a team.

### Reporting and PDF Export

#### Description
Managers will be able to export inventories into standardized PDF reports. Reports are generated using ReportLab through AWS Lambda. Managers may also send these reports to supply managers for official record-keeping.

#### User Story
As a Skip-Manager I would like to be able to extract the supplies to a PDF

## Data Requirements

### Inputs and Outputs
Data enters the system in two phases.
First, administrators create item profiles by supplying NSN, common name, optional notes, and an image that is uploaded to S3. A profile can optionally be marked as a kit definition, allowing child profiles.
Second, technicians and managers log item-level status events during inventory. This includes presence/absence, functionality, condition notes, and user-entered comments. Each log creates an ItemReport entry associated to a specific Item.

All PDF exports are generated from DynamoDB data and pulled images from S3.

### Data Model
The system uses a single-table DynamoDB design. All entities share one table with strongly typed items and predictable primary key patterns. Relationships are expressed through PK/SK conventions and secondary indexes.

### Diagram TBD
Entities and Keys


| Name | PK | SK | Notes|
|------|----|----|------|
| User | USER#{userId} | PROFILE | Stores name, email, role, and the teamId the user belongs to. |
| Team | TEAM#{teamId} | PROFILE | Contains team metadata and leaderId.Team membership is represented by child items. |
| Location | LOCATION#{locationId} | PROFILE | Hierarchy via optional parentLocationId. Child locations referenced by querying GSI on parentLocationId. |
|  ItemProfile | ITEMPROFILE#{profileId} | PROFILE | Includes NSN, English name, description, S3 image key, and isKit boolean. |
| Item | ITEM#{itemId} | PROFILE | Contains profileId, serial/unique identifiers, lastKnownLocationId, ownerUserId, and optional parentItemId (kit structure). Child items stored with SK: CHILD#{childItemId} for efficient kit traversal. |
| ItemReport | ITEM#{itemId} | REPORT# {timestamp} | |

### Relationships Encoded through Keys
- Kits: Items may have parentItemId. Kit contents retrieved by querying PK = ITEM#{parentId} and SK prefix CHILD#.
- Profiles -> Items: Items store profileId; items for a profile are accessed via a GSI on profileId.
- Locations -> Items: Items store lastKnownLocationId; location inventories retrieved via GSI on locationId.
- Users -> Items: Items store ownerUserId; GSI allows per-user inventory pull.
- Items -> Reports: Reports stored in item’s partition; chronological scan is natural and ordered.
- Teams -> Users: Teams own MEMBER entries; users store back-reference to teamId.

### Reports
All data must be output in either a DA 2404 (maintenance form) or Component Listing Hand Sheet. These forms are a rigid structure and represent a significant constraint, the solving of which will be an integral part of the thesis of the project.

### Data Acquisition, Integrity, Retention, and Disposal
Currently, data is being stored and transferred using Amazon Web Services.  While it will not meet compliance standards for military systems, it will be used as a non network integrated service.  Best coding practices will be followed to ensure a software error does not expose vital information.  All structured data is stored in DynamoDB using strongly typed schemas validated at the API layer. Images and generated PDFs are stored in S3 with presigned access. AWS services handle durability and replication. Otherwise, AWS is to be responsible for ethical and realistic data acquisition, integrity, retention, and disposal.

## External Interface Requirements

### User Interfaces
The web application features a mobile responsive interface optimized for smartphone and desktop usage by army maintenance personnel. The system implements five primary software components requiring user interfaces: Sign-up/Login authentication module, Home dashboard, To Review queue, Reviewed items archive, and Forms management system. All screens will maintain consistent layout standards including standardized navigation elements, secure AWS-based authentication integration, and role based access controls that display different interface elements based on user permissions.

The To Review queue presents personnel with a prioritized list of equipment requiring inspection, enabling efficient workflow management. When personnel select an item from this queue, they access the product review screen, which provides a comprehensive view of the equipment's status. This interface enables users to document whether equipment is present or missing, record operational status, and access beneficial information including equipment photographs and military standard nomenclature. The screen also displays hierarchical relationships, linking parent and child components in order to provide complete equipment context.

The Forms management system accommodates standardized military paperwork with mobile optimized input fields and validation to ensure accurate data entry on smartphone devices. Upon completion of equipment reviews, the Forms page generates completed documentation that maintenance personnel can approve and print for submission to supply management.

### Software Interfaces
The web application will integrate with multiple AWS services to provide a comprehensive maintenance management system (Figure D). The primary software interfaces include AWS Cognito for user authentication and role-based access control, AWS S3 for secure storage and retrieval of equipment photos and documents, and AWS Amplify for application hosting and deployment. The system will utilize AWS DynamoDB for database operations, storing maintenance forms, user profiles, and equipment records. AWS Lambda functions will handle server-side processing including PDF generation of completed maintenance forms (DA Form 2404 and other army-specific documents) and business logic operations.


#### Figure
Figure D
System Design Diagram

### Hardware Interfaces
The web application requires no hardware interfaces, operating as a browser-based system on standard smartphones. The primary hardware requirement is camera access for capturing images of damaged equipment during maintenance inspections. The system also requires internet connectivity to communicate with AWS backend services and submit forms. The application uses the smartphone's default capabilities for PDF handling once the file is complete.

### Communications Interfaces
The web application will utilize standard HTTPS protocols for secure communication between the React frontend and AWS backend services through tRPC APIs. All data transmission will occur over encrypted HTTPS connections (website) and email. Email functionality will be integrated for user notifications and system alerts, though specific use cases are to be determined during development. The application will use standard HTTP request-response patterns for form submissions, user authentication through AWS Cognito, and file uploads to S3 storage.

## Quality Attributes – Non-Functional Requirements
### Usability
The Web Application will have a user interface with a menu option attached to the bottom of the page, similar to a mobile application for navigation, allowing ergonomics and efficiency of interactions. The design of the application is also very simplified, enhancing readability and use case for the user.

### Performance
Data Transfer must be efficient on call, and all actions and downloads must be no longer than 10 seconds. Access to inventory information must take no longer than 10 seconds to propagate. Actual Inventory process should be 25% of manual inventory process.

### Security
The product must conform to National Guard safe privacy practices. This includes things like two factor authentication, Sign up and Log in using Military Personnel Emails, and total (TLS 1.3) encryption. 

## Acceptance Criteria

#### Persona: Technician
1. The technician can log any item as present, missing, or broken.
2. When an item is marked broken, the technician is prompted for all information required to complete a maintenance report.
3. The technician can change an item’s status at any point before submitting the inventory.
4. The technician can mark an entire kit as complete, and all child items automatically inherit the updated status.
5. The technician can assign nicknames to items to improve search and identification.
6. The technician can review generated forms before they are sent.
7. The technician can press a single action that generates all required maintenance and status forms correctly.
8. The technician can automatically email completed reports to superiors.

#### Persona: Manager
1. The manager can create, add, and edit teams
2. The manager can add new inventory items into the system.
3. The manager can upload an image for each item.
4. The manager can provide common English names, NSNs, and all military-compliant naming data required for form generation.
5. The manager can designate whether an item belongs to a kit and define item nesting.
6. The manager can remove items that are no longer present on site.

#### Persona: Skip-manager:
1. Can add and remove permissions for others, and invite managers to the application

#### Other Requirements
We face regulatory issues with this project that are out of scope for us to completely address.  Most issues that arise from military compliance are likely related to hosting and data storage, which is handled by AWS, and access to information about how the process plays out in real time (including observational data taken by witnessing the workflow at the base), which is assisted by Sgt. Martin.

## Appendix A: Glossary of Terms

- AWS: Amazon Web Services
- AWS Amplify: Frontend web development service
- AWS Cognito: Authentication application
- AWS Lambda: Function as a service, event-driven Amazon application
- Amazon DynamoDB: Database service by Amazon
- Amazon S3: Object storage surface for large information retrieval 
Cloud hosted web application: A website that runs on virtual servers 
- DA form 2404: Form allowing technicians to mark inventory items as broken
- EOD: Explosives Ordinance Detection
- NSN: National/NATO Stock Number, a unique identifier for all kinds of items which may be stocked by the military
- Kit: A collection of items, typically in one location
- UIC: Unit Identification Code, a unique identifier for all members of the DoD’s many subsidiaries

