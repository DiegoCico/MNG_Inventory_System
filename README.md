# Inventory Management System repository (SupplyNet)

This is the main repository for the Inventory Management System project, developed for use by the Massachussetts National Guard.

### File layout

The following includes hyperlinks to section-specific docmentation:

- [Deployment](./deployment.md)
- [API documentation](src/api/README.md)
- [CDK documentation](src/cdk/README.md)
- [Frontend documentation](src/frontend/README.md)

### Overview of Project

The Inventory Management System (SupplyNet) is a web application designed to replace the Massachusetts Army National Guard’s paper-based inventory system. The existing process is slow, error-prone, and dependent on nested forms and inconsistent item naming, often requiring eight or more hours of repeated checks. SupplyNet modernizes this workflow by giving technicians an intuitive interface to log items, navigate nested kits, update statuses, and attach photos, while providing managers and supervisors the tools needed to create teams, manage personnel, update inventory structures, and export official documentation.

The system is built around role-based access (Technician, Manager, Skip-Manager) and supports the creation, updating, and review of both standalone items and multi-level kits. All logged data can be exported into standardized Army PDF forms generated through our backend system. These reports provide supply managers and leadership with accurate, compliant records of equipment status.

Overall, the goal of the system is to enable fast, accurate, low-training inventory sessions and ensure that all output is compliant with Army documentation standards.

### Development Context

##### Authorship

The code in this project was developed in Northeastern University's inaugural CS4535 class, taught by Dr. Mark Fontenot and Dr. Wendy Truran. Our team includes PM Diego Cicotiste, backend developers Reese Cantu, Steph Sayegh, and Lily Bedichek, and frontend develpoers Tyler Goldener and Ben Tran. Our military associate / client was Sgt. Paul Martin, State Innovation Officer and member of the 387th Explosive Ordinance Disposal Company. We partially included information from a document developed by a Tuft's ENP 0074 capstone class in Spring of 2025.

##### Scope and Limitations

Our job is to create a web-based application for use by inventory-taking technicians which will produce appropriate supply forms. We are working with a $50/month AWS budget and a limited bandwidth team. We are not automating the entire inventory process, only the frontend section done by military technicians. So, our project scope is essentially to make a frontend structure where inventory can be logged by technicians, a backend that stores hierarchies for form automation, and a program to automate filling out the forms.

## Architecture

SupplyNet operates entirely on AWS infrastructure, using Amplify for hosting, Cognito for authentication, DynamoDB for storing users, teams, items, and logs, S3 for item images and generated reports, and Lambda for server-side PDF generation. The system is browser-based, responsive, and optimized for desktop, laptop, and tablet usage. While not built for full mobile or offline operation, its lightweight design and cloud architecture allow fast, secure access for a small team of fewer than ten active users at a time, with the potential to scale to additional National Guard units.

---

# Remaining Project Tasks

To complete the project and prepare it for a production environment, a couople components need to be updated. At the moment, everything is still configured to use development settings. CloudFront is serving through its default auto-generated distribution URL, and SES is limited to verified email addresses only. These settings are suitable for testing but must be adjusted for a real deployment.

## What Still Needs To Be Done

1. **Assign a Custom Domain for CloudFront**
   Update the CloudFront configuration so it no longer uses the default CloudFront URL. Inside `src/cdk/lib/web-stack.ts` and `src/cdk/bin/app.ts`, provide the custom domain you want your application to use. This ensures the project is deployed under a clean, user-friendly domain.

2. **Connect a Verified Domain for SES**
   SES currently only works in sandbox mode, which restricts sending to verified emails. To finalize production readiness, configure SES with a fully verified domain. This will allow the system to send emails to unverified recipients and function as expected in production. Again look inside `src/cdk/lib/ses-stack.ts` and `src/cdk/bin/app.ts`

3. **Update CDK Stacks to Use Production Values**
   Replace development environment variables with your final domain name, hosted zone details, and SES identity. These updates should be made inside the CDK stacks under `src/cdk/lib/` and the application entry file at `src/cdk/bin/app.ts`.

4. **Update Account Number**
   Replace the current account number with your own AWS account number and region inside `src/cdk/bin/app.ts` line 24.

Once these changes are done and deployed, the infrastructure will be fully configured for production use, with a proper domain, unrestricted email sending, and CloudFront serving content under your chosen URL.

## Bugs

1. **Updating Database in Items**
   Currently, once a user updates the status of an item, it saves their userId, username, and name to that item as the last reviewed person. However, if a user then switches their name and/or username, it does not dynamically update the name and/or username to that already reviewed item. In order to fix this, we need to save only the userId to that item, and when getItems is called, the current username and name will be fetched based on that unique userId.
2. **Change URL**
   inside `src/cdk/bin/app.ts` once you set up your domain, make sure to switch all the URL with the correct domain URL.