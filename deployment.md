# Project Requirements

## Initial Setup

These steps prepare your local environment so the project can run and deploy correctly.

Ensure that Node.js 20 and the AWS CDK are installed on your system.

After cloning the repository, install all project dependencies:

```bash
npm install
```

Install all Node.js dependencies required for the project to compile, run tests, and deploy.
Run the test suite to confirm everything is functioning correctly:

```bash
npm run test
```

Bootstrap the CDK environment:

```bash
npm run bootstrap
```

## Deployment

These steps build and publish your infrastructure to AWS.

Build the project before deploying:

```bash
npm run build
```

To deploy to the development environment:

```bash
npm run deploy:dev
```

To deploy to the production environment:

```bash
npm run deploy:prod
```
